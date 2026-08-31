import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity, TrendingUp, Radio, Layers, DollarSign, Users,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";
import { cn } from "@/lib/utils";
import { materializeFeatureStore } from "@/lib/featureStoreHub";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import {
  ELASTICITY_META,
  SATURATION_META,
  EFFICIENCY_PROFILE_META,
  MARGIN_PROFILE_META,
  GROWTH_PROFILE_META,
} from "@/types/statisticalIntelligence";

export default function StatisticalIntelligence() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();

  const campaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, filters, { activeOnly: true }),
    [syncedCampaigns, filters]
  );

  // ── Feature Store Hub (SSoT) ──
  const store = useMemo(() => materializeFeatureStore(campaigns), [campaigns]);
  const elasticities = store.elasticityAnalyses;
  const saturations = store.saturationAnalyses;
  const funnelInteractions = store.funnelInteractions;
  const marginSensitivities = store.marginSensitivities;
  const clusters = store.clientClusters;

  // Summaries
  const avgElasticity = elasticities.length > 0 ? elasticities.reduce((s, e) => s + e.elasticityScore, 0) / elasticities.length : 0;
  const highSatCount = saturations.filter(s => s.saturationRiskLevel === "high" || s.saturationRiskLevel === "critical").length;
  const avgLift = funnelInteractions.length > 0 ? Math.round(funnelInteractions.reduce((s, f) => s + f.liftSignalScore, 0) / funnelInteractions.length) : 0;
  const avgSensitivity = marginSensitivities.length > 0 ? marginSensitivities.reduce((s, m) => s + m.marginSensitivityScore, 0) / marginSensitivities.length : 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Activity className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Inteligência Estatística</h1>
            <PageInfoTooltip description="Modelos estatísticos determinísticos para análise de elasticidade, saturação, interação de funil e sensibilidade." />
            <Badge variant="outline" className="text-xs">Fase 11.2</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Modelos estatísticos determinísticos para decisão estratégica</p>
        </div>

        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Elasticidade Média</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{avgElasticity.toFixed(2)}</span>
              <p className="text-xs text-muted-foreground mt-1">{elasticities.filter(e => e.classification === "high").length} campanhas escaláveis</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Radio className="w-4 h-4 text-status-warning" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Risco Saturação</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{highSatCount}</span>
              <p className="text-xs text-muted-foreground mt-1">campanhas em risco alto+</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Lift Signal Médio</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{avgLift}</span>
              <p className="text-xs text-muted-foreground mt-1">correlação full-funnel</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Sensib. Margem</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{avgSensitivity.toFixed(2)}</span>
              <p className="text-xs text-muted-foreground mt-1">score médio</p>
            </CardContent>
          </Card>
        </div>

        {/* Elasticity Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
               Visão Geral de Elasticidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {elasticities.map(e => {
                const meta = ELASTICITY_META[e.classification];
                return (
                  <div key={e.campaignId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{e.campaignName}</p>
                      <p className="text-xs text-muted-foreground">{e.clientName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Spend Δ</p>
                        <span className={cn("text-sm font-medium", e.spendVariationPct > 0 ? "text-status-error" : "text-status-success")}>
                          {e.spendVariationPct > 0 ? "+" : ""}{e.spendVariationPct}%
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Conv Δ</p>
                        <span className={cn("text-sm font-medium", e.conversionVariationPct > 0 ? "text-status-success" : "text-status-error")}>
                          {e.conversionVariationPct > 0 ? "+" : ""}{e.conversionVariationPct}%
                        </span>
                      </div>
                      <div className="text-center w-20">
                        <p className="text-xs text-muted-foreground">Score</p>
                        <span className="text-sm font-bold text-foreground">{e.elasticityScore}</span>
                      </div>
                      <Badge className={cn("text-xs", meta.bg, meta.color)}>{meta.label}</Badge>
                      {e.diminishingReturnFlag && <AlertTriangle className="w-3.5 h-3.5 text-status-error" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Saturation Risk Map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-status-warning" />
               Mapa de Risco de Saturação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {saturations.map(s => {
                const meta = SATURATION_META[s.saturationRiskLevel];
                const freqPct = Math.min(100, (s.avgFrequency / 8) * 100);
                return (
                  <div key={s.campaignId} className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.campaignName}</p>
                        <p className="text-xs text-muted-foreground">{s.clientName}</p>
                      </div>
                      <Badge className={cn("text-xs", meta.bg, meta.color)}>{meta.label}</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Frequência: {s.avgFrequency}x</span>
                        <span className="text-xs text-muted-foreground">Drop point: {s.efficiencyDropPoint}x</span>
                      </div>
                      <Progress value={freqPct} className="h-1.5" />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">CVR Trend:</span>
                        <span className={cn("text-xs font-medium", s.conversionRateTrend >= 0 ? "text-status-success" : "text-status-error")}>
                          {s.conversionRateTrend > 0 ? "+" : ""}{s.conversionRateTrend}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Funnel Interaction Matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
               Matriz de Interação de Funil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnelInteractions.map(fi => (
                <div key={fi.clientId} className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-foreground">{fi.clientName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Lift Signal:</span>
                      <span className={cn("text-lg font-bold", fi.liftSignalScore >= 60 ? "text-status-success" : fi.liftSignalScore >= 40 ? "text-status-warning" : "text-status-error")}>{fi.liftSignalScore}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-lg bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Awareness</p>
                      <p className="text-sm font-bold text-foreground">R$ {(fi.awarenessSpend / 1000).toFixed(1)}k</p>
                      <p className="text-xs text-muted-foreground">Corr: {fi.awarenessVsConversionCorrelation}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Consideration</p>
                      <p className="text-sm font-bold text-foreground">R$ {(fi.considerationSpend / 1000).toFixed(1)}k</p>
                      <p className="text-xs text-muted-foreground">Corr: {fi.considerationVsConversionCorrelation}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Conversion</p>
                      <p className="text-sm font-bold text-foreground">R$ {(fi.conversionSpend / 1000).toFixed(1)}k</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Margin Sensitivity Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
               Sensibilidade de Margem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {marginSensitivities.map(ms => {
                const sensitivityColor = ms.marginSensitivityScore > 0.8 ? "text-status-error" : ms.marginSensitivityScore > 0.5 ? "text-status-warning" : "text-status-success";
                return (
                  <div key={ms.campaignId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ms.campaignName}</p>
                      <p className="text-xs text-muted-foreground">{ms.clientName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Spend Δ</p>
                        <span className="text-sm text-foreground">{ms.spendChangePct > 0 ? "+" : ""}{ms.spendChangePct}%</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Margin Δ</p>
                        <span className={cn("text-sm font-medium", ms.marginChangePct >= 0 ? "text-status-success" : "text-status-error")}>
                          {ms.marginChangePct > 0 ? "+" : ""}{ms.marginChangePct}%
                        </span>
                      </div>
                      <div className="text-center w-16">
                        <p className="text-xs text-muted-foreground">Score</p>
                        <span className={cn("text-sm font-bold", sensitivityColor)}>{ms.marginSensitivityScore}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Client Cluster Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Perfil de Inteligência do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusters.map(cl => (
                <div key={cl.clientId} className="p-4 rounded-lg border border-border">
                  <p className="text-sm font-semibold text-foreground mb-3">{cl.clientName}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge className={cn("text-xs", EFFICIENCY_PROFILE_META[cl.efficiencyProfile].bg, EFFICIENCY_PROFILE_META[cl.efficiencyProfile].color)}>
                      {cl.efficiencyProfile}
                    </Badge>
                    <Badge className={cn("text-xs", MARGIN_PROFILE_META[cl.marginProfile].bg, MARGIN_PROFILE_META[cl.marginProfile].color)}>
                      Margem {cl.marginProfile}
                    </Badge>
                    <Badge className={cn("text-xs", GROWTH_PROFILE_META[cl.growthProfile].bg, GROWTH_PROFILE_META[cl.growthProfile].color)}>
                      {cl.growthProfile}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">MBEI</p>
                      <p className="text-sm font-bold text-foreground">{cl.avgMBEI}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Elasticidade</p>
                      <p className="text-sm font-bold text-foreground">{cl.elasticityAvg}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Estabilidade</p>
                      <p className="text-sm font-bold text-foreground">{cl.momentumStability.toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
