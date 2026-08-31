import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Eye, Search, Target, Heart, AlertTriangle, TrendingDown,
  DollarSign, Calendar, Sparkles, Filter, ChevronDown, ChevronUp,
  ShieldCheck,
} from "lucide-react";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { inferFunnelStage } from "@/lib/aiCopilotEngine";
import { materializeFeatureStore } from "@/lib/featureStoreHub";
import {
  FUNNEL_STAGES, FUNNEL_STAGE_META, FUNNEL_METRIC_PRIORITY,
  INSIGHT_TYPE_META, type FunnelStage, type InsightType,
} from "@/types/aiCopilot";
import { cn } from "@/lib/utils";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";

const funnelIcons: Record<FunnelStage, React.ReactNode> = {
  awareness: <Eye className="w-4 h-4" />,
  consideration: <Search className="w-4 h-4" />,
  conversion: <Target className="w-4 h-4" />,
  retention: <Heart className="w-4 h-4" />,
};

const insightTypeIcons: Record<InsightType, React.ReactNode> = {
  daily: <Sparkles className="w-4 h-4" />,
  weekly: <Calendar className="w-4 h-4" />,
  anomaly: <AlertTriangle className="w-4 h-4" />,
  forecast: <TrendingDown className="w-4 h-4" />,
  margin: <DollarSign className="w-4 h-4" />,
};

export default function AIInsightsCenter() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();
  const [funnelFilter, setFunnelFilter] = useState<string>("all");
  const [insightTypeFilter, setInsightTypeFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const campaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, filters, { activeOnly: true }),
    [syncedCampaigns, filters]
  );

  // ── Feature Store Hub (SSoT) ──
  const store = useMemo(() => materializeFeatureStore(campaigns), [campaigns]);
  const insights = store.aiInsights;

  const filteredInsights = useMemo(() => {
    let result = insights;
    if (funnelFilter !== "all") result = result.filter(i => i.funnelStage === funnelFilter);
    if (insightTypeFilter !== "all") result = result.filter(i => i.insightType === insightTypeFilter);
    return result;
  }, [insights, funnelFilter, insightTypeFilter]);

  // Funnel distribution
  const funnelDist = useMemo(() => {
    const dist: Record<FunnelStage, number> = { awareness: 0, consideration: 0, conversion: 0, retention: 0 };
    campaigns.forEach(c => { dist[inferFunnelStage(c)]++; });
    return dist;
  }, [campaigns]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Brain className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Central de Insights de IA</h1>
              <PageInfoTooltip description="Inteligência contextual gerada por IA com insights por estágio de funil, anomalias, forecast e análise de margem." />
              <Badge variant="outline" className="text-xs">Copilot</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Inteligência contextual por estágio de funil</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card">
            <ShieldCheck className="w-4 h-4 text-status-success" />
            <span className="text-xs text-muted-foreground">AI Copilot</span>
            <Badge className="bg-status-success/10 text-status-success border-status-success/30 border text-xs">Ativo</Badge>
          </div>
        </div>

        {/* Filters */}
        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* Funnel Distribution */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FUNNEL_STAGES.map(stage => {
            const meta = FUNNEL_STAGE_META[stage];
            const count = funnelDist[stage];
            const stageInsights = insights.filter(i => i.funnelStage === stage).length;
            return (
              <Card key={stage} className={cn("cursor-pointer transition-all", funnelFilter === stage && "ring-2 ring-primary")}
                onClick={() => setFunnelFilter(funnelFilter === stage ? "all" : stage)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("p-1.5 rounded-lg", meta.bg)}>{funnelIcons[stage]}</div>
                    <span className={cn("text-sm font-medium", meta.color)}>{meta.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">{count}</span>
                    <span className="text-xs text-muted-foreground">campanhas</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stageInsights} insights gerados</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Insight Type Filter + Insights List */}
        <Tabs defaultValue="all" onValueChange={v => setInsightTypeFilter(v)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="daily">Diário</TabsTrigger>
            <TabsTrigger value="weekly">Semanal</TabsTrigger>
            <TabsTrigger value="anomaly">Anomalias</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="margin">Margem</TabsTrigger>
          </TabsList>

          <TabsContent value={insightTypeFilter} className="mt-4 space-y-3">
            {filteredInsights.length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum insight encontrado para os filtros selecionados.</CardContent></Card>
            )}
            {filteredInsights.map(insight => {
              const typeMeta = INSIGHT_TYPE_META[insight.insightType];
              const stageMeta = FUNNEL_STAGE_META[insight.funnelStage];
              const isExpanded = expandedId === insight.id;
              return (
                <Card key={insight.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedId(isExpanded ? null : insight.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={cn("p-2 rounded-lg mt-0.5", typeMeta.bg)}>
                          {insightTypeIcons[insight.insightType]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={cn("text-xs", typeMeta.bg, typeMeta.color)}>{typeMeta.label}</Badge>
                            <Badge variant="outline" className={cn("text-xs", stageMeta.color)}>{stageMeta.label}</Badge>
                            {insight.clientName !== "Agência" && (
                              <span className="text-xs text-muted-foreground">{insight.clientName} · {insight.campaignName}</span>
                            )}
                          </div>
                          <p className={cn("text-sm text-foreground", !isExpanded && "line-clamp-2")}>{insight.generatedText}</p>
                          {isExpanded && (
                            <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-2">
                              <div className="flex items-center gap-4">
                                <div>
                                  <span className="text-xs text-muted-foreground">Confiança</span>
                                  <p className="text-sm font-bold text-foreground">{insight.confidenceScore}%</p>
                                </div>
                                <div>
                                  <span className="text-xs text-muted-foreground">Estágio</span>
                                  <p className={cn("text-sm font-bold", stageMeta.color)}>{stageMeta.label}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-muted-foreground">Métricas Prioritárias</span>
                                  <p className="text-xs text-foreground">{FUNNEL_METRIC_PRIORITY[insight.funnelStage].primaryMetrics.slice(0, 4).join(", ")}</p>
                                </div>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">Foco de Análise AI</span>
                                <p className="text-xs text-foreground">{FUNNEL_METRIC_PRIORITY[insight.funnelStage].aiFocus.join(" · ")}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground">Confiança</span>
                          <p className={cn("text-sm font-bold", insight.confidenceScore >= 85 ? "text-status-success" : insight.confidenceScore >= 70 ? "text-status-warning" : "text-status-error")}>{insight.confidenceScore}%</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>

        {/* Funnel Stage Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              Análise por Estágio de Funil — Métricas Prioritárias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FUNNEL_STAGES.map(stage => {
                const meta = FUNNEL_STAGE_META[stage];
                const config = FUNNEL_METRIC_PRIORITY[stage];
                return (
                  <div key={stage} className="p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={cn("p-1.5 rounded-lg", meta.bg)}>{funnelIcons[stage]}</div>
                      <span className={cn("text-sm font-semibold", meta.color)}>{meta.label}</span>
                      <Badge variant="outline" className="text-xs ml-auto">{funnelDist[stage]} campanhas</Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-muted-foreground font-medium">Métricas Primárias</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {config.primaryMetrics.map(m => <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>)}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground font-medium">Foco AI</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {config.aiFocus.map(f => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
