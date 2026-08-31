import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sun, AlertTriangle, TrendingDown, Target, Lightbulb, DollarSign,
  Activity, ShieldAlert, Heart, BarChart3, Brain, Sparkles,
} from "lucide-react";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { getMomentumMeta } from "@/lib/efficiencyCalculations";
import { generateAlerts } from "@/types/alerts";
import { MARGIN_THRESHOLD } from "@/types/financials";
import { cn } from "@/lib/utils";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";
import { FUNNEL_STAGE_META, INSIGHT_TYPE_META } from "@/types/aiCopilot";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import { materializeFeatureStore } from "@/lib/featureStoreHub";
import { isoClassificationMeta, ISO_COMPONENT_LABELS, formatISOScore } from "@/types/iso";

function StatusDot({ status }: { status: "green" | "yellow" | "red" }) {
  const colors = {
    green: "bg-status-success",
    yellow: "bg-status-warning",
    red: "bg-status-error",
  };
  return <span className={cn("inline-block w-2.5 h-2.5 rounded-full", colors[status])} />;
}

export default function DailyBrief() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();

  const campaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, filters, { activeOnly: true }),
    [syncedCampaigns, filters]
  );

  const store = useMemo(() => materializeFeatureStore(campaigns), [campaigns]);
  const alerts = useMemo(() => generateAlerts(campaigns), [campaigns]);

  const agencyAgg = store.agencyAggregation;
  const momentumMeta = getMomentumMeta(agencyAgg.momentum);
  const recommendations = store.recommendations;
  const profitabilities = store.clientProfitabilities;
  const iso = store.iso;
  const isoMeta = isoClassificationMeta[iso.classification];

  const criticalAlerts = useMemo(() => alerts.filter(a => a.severity === "critical" && a.status === "active"), [alerts]);
  const highAlerts = useMemo(() => alerts.filter(a => a.severity === "high" && a.status === "active"), [alerts]);
  const campaignsAtRisk = useMemo(() => campaigns.filter(c => c.currentMBEI < 85), [campaigns]);
  const highSevRecs = useMemo(() => recommendations.filter(r => r.severity === "high" || r.severity === "critical"), [recommendations]);

  const forecastRiskCampaigns = useMemo(() => {
    return Array.from(store.campaignForecasts.values()).filter(f => f.overallStatus === "high_risk");
  }, [store]);

  const clientsBelowMargin = useMemo(() => profitabilities.filter(p => p.marginPercent < MARGIN_THRESHOLD), [profitabilities]);

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const getStatus = (value: number, thresholdYellow: number, thresholdRed: number, invert = false): "green" | "yellow" | "red" => {
    if (invert) {
      if (value >= thresholdRed) return "red";
      if (value >= thresholdYellow) return "yellow";
      return "green";
    }
    if (value <= thresholdRed) return "red";
    if (value <= thresholdYellow) return "yellow";
    return "green";
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Sun className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Briefing Diário</h1>
              <PageInfoTooltip description="Resumo diário auto-gerado com ISO, alertas críticos, insights de IA e ações prioritárias." />
              <Badge variant="outline" className="text-xs">Auto-gerado</Badge>
            </div>
            <p className="text-sm text-muted-foreground capitalize">{today}</p>
          </div>
          <div className={cn("flex items-center gap-3 px-4 py-2 rounded-xl border", isoMeta.bg, isoMeta.border)}>
            <Activity className={cn("w-5 h-5", isoMeta.color)} />
            <div>
              <p className="text-xs text-muted-foreground">ISO</p>
              <p className={cn("text-xl font-bold", isoMeta.color)}>{formatISOScore(iso)}</p>
            </div>
            <Badge className={cn("text-xs", isoMeta.bg, isoMeta.color, isoMeta.border, "border")}>{iso.classificationLabel}</Badge>
          </div>
        </div>

        {/* Filters */}
        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* ISO */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">ISO — Saúde da Operação</span>
                </div>
                {iso.available ? (
                  <StatusDot status={getStatus(iso.score, 75, 60)} />
                ) : (
                  <StatusDot status="yellow" />
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-foreground">{formatISOScore(iso)}</span>
                {iso.available && (
                  <span className={cn("text-sm font-medium", momentumMeta.color)}>
                    {momentumMeta.arrow} {agencyAgg.momentumDelta >= 0 ? "+" : ""}{agencyAgg.momentumDelta.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{iso.classificationLabel}</p>
            </CardContent>
          </Card>

          {/* Critical Alerts */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-status-error" />
                  <span className="text-sm font-medium text-foreground">Alertas Críticos</span>
                </div>
                <StatusDot status={getStatus(criticalAlerts.length, 1, 3, true)} />
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-foreground">{criticalAlerts.length}</span>
                <span className="text-sm text-muted-foreground">+ {highAlerts.length} alto</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{alerts.length} total ativos</p>
            </CardContent>
          </Card>

          {/* Campaigns at Risk */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-status-warning" />
                  <span className="text-sm font-medium text-foreground">Campanhas em Risco</span>
                </div>
                <StatusDot status={getStatus(campaignsAtRisk.length, 1, 3, true)} />
              </div>
              <span className="text-3xl font-bold text-foreground">{campaignsAtRisk.length}</span>
              <span className="text-sm text-muted-foreground ml-2">de {campaigns.length}</span>
              <p className="text-xs text-muted-foreground mt-1">Eficiência abaixo do limiar</p>
            </CardContent>
          </Card>

          {/* Forecast Risk */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-status-error" />
                  <span className="text-sm font-medium text-foreground">Forecast em Risco</span>
                </div>
                <StatusDot status={getStatus(forecastRiskCampaigns.length, 1, 3, true)} />
              </div>
              <span className="text-3xl font-bold text-foreground">{forecastRiskCampaigns.length}</span>
              <span className="text-sm text-muted-foreground ml-2">campanhas</span>
              <p className="text-xs text-muted-foreground mt-1">Alto risco de descumprimento</p>
            </CardContent>
          </Card>

          {/* Pending Recommendations */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Recomendações Pendentes</span>
                </div>
                <StatusDot status={getStatus(highSevRecs.length, 2, 4, true)} />
              </div>
              <span className="text-3xl font-bold text-foreground">{highSevRecs.length}</span>
              <span className="text-sm text-muted-foreground ml-2">alta severidade</span>
              <p className="text-xs text-muted-foreground mt-1">{recommendations.length} total</p>
            </CardContent>
          </Card>

          {/* Clients Below Margin */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-status-warning" />
                  <span className="text-sm font-medium text-foreground">Clientes Abaixo da Margem</span>
                </div>
                <StatusDot status={getStatus(clientsBelowMargin.length, 1, 2, true)} />
              </div>
              <span className="text-3xl font-bold text-foreground">{clientsBelowMargin.length}</span>
              <span className="text-sm text-muted-foreground ml-2">de {profitabilities.length}</span>
              <p className="text-xs text-muted-foreground mt-1">Margem {"<"} {MARGIN_THRESHOLD}%</p>
            </CardContent>
          </Card>
        </div>

        {/* ISO Components Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              ISO — Componentes do Índice de Saúde
            </CardTitle>
          </CardHeader>
          <CardContent>
            {iso.available ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {(Object.entries(iso.components) as [keyof typeof iso.components, number][]).map(([key, value]) => {
                  const comp = ISO_COMPONENT_LABELS[key];
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{comp.label}</span>
                        <span className="text-xs font-bold text-foreground">{value}</span>
                      </div>
                      <Progress value={value} className="h-1.5" />
                      <span className="text-[10px] text-muted-foreground">{comp.weight}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{iso.aiSummary}</p>
            )}
          </CardContent>
        </Card>

        {/* AI Strategic Summary — from Feature Store */}
        <AIStrategicSummary store={store} />

        {/* Campaigns at Risk Detail */}
        {campaignsAtRisk.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-status-error" />
                Campanhas em Risco — Detalhamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {campaignsAtRisk.map(c => {
                  const mMeta = getMomentumMeta(c.momentum);
                  return (
                    <div key={c.campaignId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.campaignName}</p>
                        <p className="text-xs text-muted-foreground">{c.clientName} · {c.platform}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Eficiência</p>
                          <p className="text-sm font-bold text-status-error">{c.currentMBEI}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">CPA</p>
                          <p className="text-sm font-bold text-foreground">R$ {c.rollingCPA.toFixed(2)}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-xs", mMeta.color)}>
                          {mMeta.arrow} {mMeta.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// ── AI Strategic Summary Sub-Component (consumes Feature Store signals) ──

import type { MaterializedFeatureStore } from "@/lib/featureStoreHub";

function AIStrategicSummary({ store }: { store: MaterializedFeatureStore }) {
  const insights = store.aiInsights;
  const dailySummary = insights.find(i => i.insightType === "daily");
  const topAnomalies = insights.filter(i => i.insightType === "anomaly").slice(0, 3);
  const forecastRisks = insights.filter(i => i.insightType === "forecast").slice(0, 2);

  if (!dailySummary && topAnomalies.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
           Resumo Estratégico da IA
          <Badge className="bg-primary/10 text-primary border-primary/30 border text-xs ml-2">Copilot</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dailySummary && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-foreground leading-relaxed">{dailySummary.generatedText}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground">Confiança: {dailySummary.confidenceScore}%</span>
                  <Badge variant="outline" className={cn("text-xs", FUNNEL_STAGE_META[dailySummary.funnelStage].color)}>
                    Estágio dominante: {FUNNEL_STAGE_META[dailySummary.funnelStage].label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {topAnomalies.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Anomalias Detectadas</span>
            {topAnomalies.map(a => (
              <div key={a.id} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <AlertTriangle className="w-3.5 h-3.5 text-status-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-foreground">{a.generatedText}</p>
                  <span className="text-xs text-muted-foreground">Confiança: {a.confidenceScore}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {forecastRisks.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Riscos de Forecast</span>
            {forecastRisks.map(f => (
              <div key={f.id} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <Target className="w-3.5 h-3.5 text-status-error mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-foreground">{f.generatedText}</p>
                  <span className="text-xs text-muted-foreground">Confiança: {f.confidenceScore}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
