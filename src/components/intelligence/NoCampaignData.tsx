import { Link } from "react-router-dom";
import { BarChart3, Layers, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface NoCampaignDataProps {
  /** After clients finished loading — do not pass false while still loading. */
  hasClients?: boolean;
  clientsLoading?: boolean;
  campaignsLoading?: boolean;
}

/**
 * Empty state for intelligence pages that depend on campaign metrics.
 * Primary gap is always campaign sync — clients alone do not feed these screens.
 */
export function NoCampaignData({ hasClients = true, clientsLoading = false, campaignsLoading = false }: NoCampaignDataProps) {
  if (clientsLoading || campaignsLoading) {
    return (
      <Card className="border-dashed border-border/80 bg-muted/20">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {campaignsLoading ? "Carregando campanhas sincronizadas…" : "Carregando clientes…"}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-border/80 bg-muted/20">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
        <div className="p-3 rounded-xl bg-muted/60">
          <BarChart3 className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="space-y-1 max-w-lg">
          <h3 className="text-base font-semibold text-foreground">Sem dados de campanha</h3>
          <p className="text-sm text-muted-foreground">
            Esta tela não usa só a lista de clientes. Ela precisa de métricas de campanha
            sincronizadas (Meta, Google, DV360) para calcular ISO, alertas e recomendações.
            {hasClients
              ? " Seus clientes já estão cadastrados — falta conectar e sincronizar os dados de mídia."
              : " Cadastre um cliente e depois sincronize as plataformas de anúncios."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="sm">
            <Link to="/data-integrations">
              <Layers className="w-4 h-4 mr-2" />
              Dados & Integrações
            </Link>
          </Button>
          {!hasClients && (
            <Button asChild size="sm" variant="outline">
              <Link to="/clients">
                <Users className="w-4 h-4 mr-2" />
                Ver clientes
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
