import { useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { materializeFeatureStore } from "@/lib/featureStoreHub";
import { ClientSelector } from "@/components/maturity/ClientSelector";
import { AgencyConsolidatedView } from "@/components/maturity/AgencyConsolidatedView";
import { ClientDeepFocusView } from "@/components/maturity/ClientDeepFocusView";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";

export default function Maturity() {
  const { clients, loading: clientsLoading, selectedClientId, setSelectedClientId } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();

  const store = useMemo(
    () => materializeFeatureStore(syncedCampaigns.filter((c) => c.status === "active")),
    [syncedCampaigns]
  );
  const summary = store.agencyIMCSummary;

  const selectedIMC = useMemo(
    () => (selectedClientId ? summary.clientScores.find((c) => c.clientId === selectedClientId) ?? null : null),
    [selectedClientId, summary.clientScores]
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {selectedIMC && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedClientId(clients[0]?.id ?? null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <h1 className="text-2xl font-bold text-foreground">Maturidade do Cliente</h1>
              <PageInfoTooltip description="Diagnóstico de maturidade estrutural por cliente. O IMC mede disciplina e organização, não performance direta." />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedIMC
                ? `Visão detalhada — ${selectedIMC.clientName}`
                : "Panorama de maturidade da agência e ranking interno por cliente"}
            </p>
          </div>
          <ClientSelector
            clients={summary.clientScores}
            selectedClientId={selectedClientId}
            onSelect={(id) => setSelectedClientId(id ?? clients[0]?.id ?? null)}
          />
        </div>

        {summary.clientScores.length === 0 ? (
          <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />
        ) : selectedIMC ? (
          <ClientDeepFocusView imc={selectedIMC} />
        ) : (
          <AgencyConsolidatedView summary={summary} onSelectClient={setSelectedClientId} />
        )}
      </div>
    </AppLayout>
  );
}
