import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { generateAlerts } from "@/types/alerts";
import {
  getRecommendationStats,
  recommendationTypeMeta,
  severityMeta,
  type Recommendation,
  type RecommendationType,
  type RecommendationSeverity,
} from "@/lib/recommendationEngine";
import { materializeFeatureStore } from "@/lib/featureStoreHub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  ArrowLeftRight, RefreshCw, PauseCircle, TrendingUp,
  Lightbulb, AlertTriangle, DollarSign, Check, X, Target,
  Zap, ShieldAlert, Bot, Lock,
} from "lucide-react";
import { AUTOMATION_RULES } from "@/data/integrationData";
import { cn } from "@/lib/utils";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";

const typeIcons: Record<RecommendationType, React.ReactNode> = {
  budget_reallocation: <ArrowLeftRight className="w-5 h-5" />,
  creative_rotation: <RefreshCw className="w-5 h-5" />,
  pause: <PauseCircle className="w-5 h-5" />,
  scale: <TrendingUp className="w-5 h-5" />,
};

export default function OptimizationCenter() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statuses, setStatuses] = useState<Record<string, Recommendation["status"]>>({});

  const filteredCampaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, filters),
    [syncedCampaigns, filters]
  );

  // ── Feature Store Hub (SSoT) ──
  const store = useMemo(() => materializeFeatureStore(filteredCampaigns), [filteredCampaigns]);

  const recommendations = useMemo(() => {
    let recs = store.recommendations.map(r => ({ ...r, status: statuses[r.id] || r.status }));
    if (typeFilter !== "all") recs = recs.filter(r => r.type === typeFilter);
    if (severityFilter !== "all") recs = recs.filter(r => r.severity === severityFilter);
    return recs;
  }, [store, typeFilter, severityFilter, statuses]);

  const stats = useMemo(() => getRecommendationStats(store.recommendations), [store]);

  const updateStatus = (id: string, status: Recommendation["status"]) => {
    setStatuses(prev => ({ ...prev, [id]: status }));
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-foreground">Central de Otimização</h1>
            <PageInfoTooltip description="Recomendações automáticas de otimização baseadas em MBEI, momentum, forecast e alertas ativos." />
            <Badge className="bg-primary/10 text-primary border-primary/20">Motor de Recomendações</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Recomendações automáticas de otimização baseadas em MBEI, momentum, forecast e alertas</p>
        </div>

        {/* Filters */}
        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        <div className="flex flex-wrap items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="budget_reallocation">Realocação de Budget</SelectItem>
              <SelectItem value="creative_rotation">Rotação de Criativos</SelectItem>
              <SelectItem value="pause">Avaliação de Pausa</SelectItem>
              <SelectItem value="scale">Escalar Budget</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Lightbulb className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Recomendações Ativas</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-error/10"><ShieldAlert className="w-5 h-5 text-status-error" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Alta Prioridade</p>
                <p className="text-2xl font-bold text-foreground">{stats.highPriority}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-success/10"><DollarSign className="w-5 h-5 text-status-success" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Impacto Estimado</p>
                <p className="text-2xl font-bold text-foreground">R$ {stats.totalImpact.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><Target className="w-5 h-5 text-blue-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Por Tipo</p>
                <div className="flex gap-2 mt-1">
                  {Object.entries(stats.byType).map(([type, count]) => count > 0 && (
                    <Badge key={type} variant="outline" className="text-[10px] px-1.5 py-0">
                      {recommendationTypeMeta[type as RecommendationType].label.split(" ")[0]}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Automation Coming Soon */}
        <Card className="p-5 border-border border-dashed">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted">
                <Bot className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">Automação</p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Em Breve</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Regras automatizadas baseadas em triggers de performance</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Regras Ativas</p>
                <p className="text-lg font-bold text-foreground">{AUTOMATION_RULES.filter(r => r.status === "active").length}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-foreground">{AUTOMATION_RULES.length}</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" disabled>
                <Lock className="w-3.5 h-3.5" />Configurar
              </Button>
            </div>
          </div>
        </Card>

        {/* Recommendation Cards */}
        <div className="space-y-4">
          {recommendations.length === 0 && (
            <Card className="p-8 text-center border-border">
              <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma recomendação para os filtros selecionados.</p>
            </Card>
          )}

          {recommendations.map(rec => {
            const typeMeta = recommendationTypeMeta[rec.type];
            const sevMeta = severityMeta[rec.severity];
            const isActioned = rec.status !== "pending";

            return (
              <Card key={rec.id} className={cn("p-5 border transition-all", isActioned && "opacity-60", sevMeta.border)}>
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn("p-2.5 rounded-xl flex-shrink-0", typeMeta.bg)}>
                    <span className={typeMeta.color}>{typeIcons[rec.type]}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", sevMeta.bg, sevMeta.color, sevMeta.border, "border")}>{sevMeta.label}</Badge>
                        <Badge variant="outline" className="text-xs">{typeMeta.label}</Badge>
                        {isActioned && (
                          <Badge variant="secondary" className="text-xs">
                            {rec.status === "accepted" ? "✓ Aplicado" : "✗ Descartado"}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{rec.platform}</span>
                    </div>

                    <div>
                      <p className="font-semibold text-sm text-foreground">{rec.campaignName}</p>
                      <p className="text-xs text-muted-foreground">{rec.clientName}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                      <p className="text-xs text-muted-foreground"><strong>Razão:</strong> {rec.reason}</p>
                      <p className="text-xs text-foreground"><strong>Ação sugerida:</strong> {rec.suggestedAction}</p>
                    </div>

                    {/* Impact */}
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-status-success" />
                      <span className="text-xs font-medium text-status-success">{rec.impactLabel}</span>
                    </div>

                    {/* Forecast mini-summary */}
                    {rec.forecast && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>CPA Projetado: <strong className="text-foreground">R$ {rec.forecast.projectedCPA.toFixed(2)}</strong></span>
                        <span>MBEI Forecast: <strong className="text-foreground">{rec.forecast.forecastedMBEI}</strong></span>
                        <span>Prob. Meta: <strong className="text-foreground">{rec.forecast.goalProbability}%</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isActioned && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" className="text-xs gap-1 text-status-success border-status-success/30 hover:bg-status-success/10" onClick={() => updateStatus(rec.id, "accepted")}>
                        <Check className="w-3.5 h-3.5" />Aplicar
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs gap-1 text-muted-foreground" onClick={() => updateStatus(rec.id, "dismissed")}>
                        <X className="w-3.5 h-3.5" />Descartar
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
