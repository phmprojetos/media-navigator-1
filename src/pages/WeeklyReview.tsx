import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  BarChart3, Target, ArrowUp, ArrowDown, Minus, Brain, Sparkles,
} from "lucide-react";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { getMomentumMeta, getMomentumCategory } from "@/lib/efficiencyCalculations";
import { generateAlerts } from "@/types/alerts";
import { cn } from "@/lib/utils";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { displayClientName, useClient } from "@/contexts/ClientContext";
import { inferFunnelStage } from "@/lib/aiCopilotEngine";
import { FUNNEL_STAGE_META, FUNNEL_STAGES } from "@/types/aiCopilot";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import { materializeFeatureStore } from "@/lib/featureStoreHub";

// Simulate week-over-week by applying a factor
const PREVIOUS_WEEK_FACTOR = 0.94;

export default function WeeklyReview() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, selectedClientId, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();
  const clientOptions = clients.map(c => ({ id: c.id, name: displayClientName(c) }));

  const campaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, filters, { activeOnly: true }),
    [syncedCampaigns, filters]
  );

  // ── SINGLE SOURCE OF TRUTH: Feature Store Hub ──
  const store = useMemo(() => materializeFeatureStore(campaigns), [campaigns]);
  const alerts = useMemo(() => generateAlerts(campaigns), [campaigns]);

  const agencyAgg = store.agencyAggregation;
  const recommendations = store.recommendations;
  const agencyFinancials = store.agencyFinancials;

  // Simulated previous week values
  const prevMBEI = Math.round(agencyAgg.avgMBEI7d * PREVIOUS_WEEK_FACTOR);
  const mbeiChange = agencyAgg.avgMBEI7d - prevMBEI;
  const mbeiChangePct = prevMBEI > 0 ? ((mbeiChange) / prevMBEI) * 100 : 0;

  const totalAlerts = alerts.length;
  const resolvedAlerts = Math.round(totalAlerts * 0.35); // Simulated
  const resolvedPct = totalAlerts > 0 ? (resolvedAlerts / totalAlerts) * 100 : 0;

  const prevMargin = agencyFinancials.marginPercent * PREVIOUS_WEEK_FACTOR;
  const marginChange = agencyFinancials.marginPercent - prevMargin;

  const totalRecs = recommendations.length;
  const appliedRecs = Math.round(totalRecs * 0.4); // Simulated
  const appliedPct = totalRecs > 0 ? (appliedRecs / totalRecs) * 100 : 0;

  // Client performance ranking
  const clientPerf = useMemo(() => {
    return clientOptions.map(client => {
      const clientCamps = campaigns.filter(c => c.clientId === client.id);
      if (clientCamps.length === 0) return null;
      const avgMBEI = Math.round(clientCamps.reduce((s, c) => s + c.currentMBEI, 0) / clientCamps.length);
      const avgMBEI7d = Math.round(clientCamps.reduce((s, c) => s + c.avgMBEI7d, 0) / clientCamps.length);
      const { category, delta } = getMomentumCategory(avgMBEI, avgMBEI7d);
      const prevAvgMBEI = Math.round(avgMBEI * PREVIOUS_WEEK_FACTOR);
      const change = avgMBEI - prevAvgMBEI;
      return { ...client, avgMBEI, momentum: category, change, delta };
    }).filter(Boolean) as { id: string; name: string; avgMBEI: number; momentum: string; change: number; delta: number }[];
  }, [campaigns, clientOptions]);

  const topImproving = [...clientPerf].sort((a, b) => b.change - a.change).slice(0, 3);
  const topDeclining = [...clientPerf].sort((a, b) => a.change - b.change).slice(0, 3);

  const ChangeIndicator = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
    if (value > 0) return <span className="flex items-center gap-1 text-xs text-status-success"><ArrowUp className="w-3 h-3" />+{value.toFixed(1)}{suffix}</span>;
    if (value < 0) return <span className="flex items-center gap-1 text-xs text-status-error"><ArrowDown className="w-3 h-3" />{value.toFixed(1)}{suffix}</span>;
    return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Minus className="w-3 h-3" />0{suffix}</span>;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Calendar className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Revisão Semanal</h1>
            <PageInfoTooltip description="Comparativo semanal de KPIs para reunião de liderança com evolução de MBEI, alertas e margem." />
            <Badge variant="outline" className="text-xs">Reunião de Liderança</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Comparativo semanal para reunião de liderança</p>
        </div>

        {/* Filters */}
        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* Week-over-Week KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">MBEI Variação</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{agencyAgg.avgMBEI7d}</span>
                <ChangeIndicator value={mbeiChangePct} suffix="%" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Semana anterior: {prevMBEI}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-status-warning" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Alertas</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{totalAlerts}</span>
                <span className="text-xs text-muted-foreground">gerados</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={resolvedPct} className="h-1.5 flex-1" />
                <span className="text-xs text-status-success">{resolvedPct.toFixed(0)}% resolvidos</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-status-success" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Margem Variação</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{agencyFinancials.marginPercent.toFixed(1)}%</span>
                <ChangeIndicator value={marginChange} suffix="pp" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Semana anterior: {prevMargin.toFixed(1)}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Recomendações Aplicadas</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{appliedRecs}</span>
                <span className="text-xs text-muted-foreground">de {totalRecs}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={appliedPct} className="h-1.5 flex-1" />
                <span className="text-xs text-primary">{appliedPct.toFixed(0)}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Improving */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-status-success" />
                Top Clientes em Melhoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topImproving.map((c, i) => {
                  const mMeta = getMomentumMeta(c.momentum as any);
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground">MBEI: {c.avgMBEI}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("text-xs", mMeta.color)}>{mMeta.arrow} {mMeta.label}</Badge>
                        <ChangeIndicator value={c.change} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top Declining */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-status-error" />
                Top Clientes em Declínio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topDeclining.map((c, i) => {
                  const mMeta = getMomentumMeta(c.momentum as any);
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground">MBEI: {c.avgMBEI}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("text-xs", mMeta.color)}>{mMeta.arrow} {mMeta.label}</Badge>
                        <ChangeIndicator value={c.change} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Strategic Interpretation — from Feature Store */}
        <WeeklyAIBlock store={store} campaigns={campaigns} />

        {/* Campaign Trend Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Resumo de Performance por Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[...new Set(campaigns.map(c => c.platform))].map(platform => {
                const platformCamps = campaigns.filter(c => c.platform === platform);
                const avgMBEI = Math.round(platformCamps.reduce((s, c) => s + c.currentMBEI, 0) / platformCamps.length);
                const platformAlerts = alerts.filter(a => platformCamps.some(c => c.campaignId === a.campaign_id)).length;
                return (
                  <div key={platform} className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{platform}</p>
                    <p className="text-xl font-bold text-foreground">{avgMBEI}</p>
                    <p className="text-xs text-muted-foreground">{platformCamps.length} camps · {platformAlerts} alertas</p>
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

// ── AI Strategic Interpretation Block (consumes Feature Store signals) ──

import type { MaterializedFeatureStore } from "@/lib/featureStoreHub";
import type { CampaignWithClient } from "@/data/multiClientData";

function WeeklyAIBlock({ store, campaigns }: { store: MaterializedFeatureStore; campaigns: CampaignWithClient[] }) {
  const insights = store.aiInsights;
  const weeklySummary = insights.find(i => i.insightType === "weekly");
  const topInsights = insights.filter(i => i.insightType !== "weekly" && i.insightType !== "daily").slice(0, 4);

  // Funnel balance
  const funnelDist = useMemo(() => {
    const dist: Record<string, number> = {};
    campaigns.forEach(c => {
      const s = inferFunnelStage(c);
      dist[s] = (dist[s] || 0) + 1;
    });
    return dist;
  }, [campaigns]);

  if (!weeklySummary && topInsights.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
           Interpretação Estratégica da IA
          <Badge className="bg-primary/10 text-primary border-primary/30 border text-xs ml-2">Copilot</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {weeklySummary && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-foreground leading-relaxed">{weeklySummary.generatedText}</p>
                <span className="text-xs text-muted-foreground mt-1 inline-block">Confiança: {weeklySummary.confidenceScore}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Funnel Balance */}
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Distribuição por Funil</span>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {FUNNEL_STAGES.map(stage => {
              const meta = FUNNEL_STAGE_META[stage];
              return (
                <div key={stage} className="p-2 rounded-lg bg-muted/50 text-center">
                  <span className={cn("text-xs font-medium", meta.color)}>{meta.label}</span>
                  <p className="text-lg font-bold text-foreground">{funnelDist[stage] || 0}</p>
                </div>
              );
            })}
          </div>
        </div>

        {topInsights.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Insights da Semana</span>
            {topInsights.map(i => (
              <div key={i.id} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <AlertTriangle className="w-3.5 h-3.5 text-status-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-foreground">{i.generatedText}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={cn("text-xs", FUNNEL_STAGE_META[i.funnelStage].color)}>{FUNNEL_STAGE_META[i.funnelStage].label}</Badge>
                    <span className="text-xs text-muted-foreground">Confiança: {i.confidenceScore}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
