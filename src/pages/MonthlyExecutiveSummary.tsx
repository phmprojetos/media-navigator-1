import { useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileText, Download, DollarSign, BarChart3, Shield, Target,
  TrendingUp, AlertTriangle, PiggyBank, Activity,
} from "lucide-react";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { generateAlerts } from "@/types/alerts";
import { getMomentumCategory } from "@/lib/efficiencyCalculations";
import { computeRiskScore, riskLevelMeta, type RiskLevel } from "@/lib/benchmarkCalculations";
import { healthLevelMeta } from "@/types/operational";
import { cn } from "@/lib/utils";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import { materializeFeatureStore } from "@/lib/featureStoreHub";
import jsPDF from "jspdf";

export default function MonthlyExecutiveSummary() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();

  const campaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, filters, { activeOnly: true }),
    [syncedCampaigns, filters]
  );

  // ── SINGLE SOURCE OF TRUTH: Feature Store Hub ──
  const store = useMemo(() => materializeFeatureStore(campaigns), [campaigns]);
  const alerts = useMemo(() => generateAlerts(campaigns), [campaigns]);

  const agencyAgg = store.agencyAggregation;
  const recommendations = store.recommendations;
  const profitabilities = store.clientProfitabilities;
  const agencyFinancials = store.agencyFinancials;
  const healthIndex = store.agencyHealthIndex;

  const totalSpend = useMemo(() => campaigns.reduce((s, c) => s + c.rollingCPA * 500 * c.spendVelocity, 0), [campaigns]);
  const totalSavings = useMemo(() => campaigns.reduce((total, c) => {
    const plannedCPA = c.rollingCPA * 1.1;
    const conversions = Math.round(c.rollingConversionRate * 50000);
    return total + (plannedCPA - c.rollingCPA) * conversions;
  }, 0), [campaigns]);

  // Client risk distribution — uses Feature Store risk scores
  const riskDistribution = useMemo(() => {
    const dist: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    store.clientRiskScores.forEach((risk) => {
      dist[risk.level]++;
    });
    return dist;
  }, [store]);

  // Forecast accuracy — from Feature Store
  const forecastAccuracy = useMemo(() => {
    const forecasts = Array.from(store.campaignForecasts.values());
    const onTrack = forecasts.filter(f => f.overallStatus === "on_track" || f.overallStatus === "likely_exceed").length;
    return forecasts.length > 0 ? Math.round((onTrack / forecasts.length) * 100) : 0;
  }, [store]);

  const formatCurrency = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  const exportToPDF = useCallback(() => {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString("pt-BR");
    doc.setFontSize(20);
    doc.text("MediaHub — Executive Summary", 20, 25);
    doc.setFontSize(10);
    doc.text(`Gerado em ${now}`, 20, 33);

    doc.setFontSize(12);
    doc.text("KPIs Principais", 20, 48);
    doc.setFontSize(10);
    doc.text(`Mídia Gerenciada: ${formatCurrency(totalSpend)}`, 25, 58);
    doc.text(`Economia de Mídia: ${formatCurrency(totalSavings)}`, 25, 66);
    doc.text(`Receita da Agência: ${formatCurrency(agencyFinancials.totalRevenue)}`, 25, 74);
    doc.text(`Margem Bruta: ${agencyFinancials.marginPercent.toFixed(1)}%`, 25, 82);
    doc.text(`ISO (Saúde da Operação): ${store.iso.available ? `${store.iso.score} (${store.iso.classificationLabel})` : "Sem dados"}`, 25, 90);
    doc.text(`Agency Health Index: ${healthIndex.score} (${healthLevelMeta[healthIndex.level].label})`, 25, 98);
    doc.text(`Forecast Accuracy: ${forecastAccuracy}%`, 25, 106);

    doc.setFontSize(12);
    doc.text("Distribuição de Risco", 20, 122);
    doc.setFontSize(10);
    doc.text(`Baixo: ${riskDistribution.low} | Médio: ${riskDistribution.medium} | Alto: ${riskDistribution.high} | Crítico: ${riskDistribution.critical}`, 25, 132);

    doc.setFontSize(12);
    doc.text("Alertas & Recomendações", 20, 148);
    doc.setFontSize(10);
    doc.text(`Alertas Ativos: ${alerts.length}`, 25, 158);
    doc.text(`Recomendações Geradas: ${recommendations.length}`, 25, 166);

    doc.save(`MediaHub_Executive_Summary_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [totalSpend, totalSavings, agencyFinancials, agencyAgg, healthIndex, forecastAccuracy, riskDistribution, alerts, recommendations]);

  const hlMeta = healthLevelMeta[healthIndex.level];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FileText className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Resumo Executivo Mensal</h1>
              <PageInfoTooltip description="Relatório executivo mensal consolidado com KPIs, forecast, risco e recomendações exportável em PDF." />
              <Badge variant="outline" className="text-xs">Auto-gerado</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Relatório executivo mensal consolidado</p>
          </div>
          <Button onClick={exportToPDF} className="gap-2">
            <Download className="w-4 h-4" /> Exportar PDF
          </Button>
        </div>

        {/* Filters */}
        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* Main KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase">Mídia Gerenciada</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalSpend)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-status-success" />
                <span className="text-xs text-muted-foreground uppercase">Economia Gerada</span>
              </div>
              <p className={cn("text-2xl font-bold", totalSavings >= 0 ? "text-status-success" : "text-status-error")}>{formatCurrency(totalSavings)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase">Receita Agência</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(agencyFinancials.totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase">Margem Bruta</span>
              </div>
              <p className={cn("text-2xl font-bold", agencyFinancials.marginPercent >= 20 ? "text-status-success" : "text-status-error")}>
                {agencyFinancials.marginPercent.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Health & Forecast Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Agency Health Index</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-4xl font-bold", hlMeta.color)}>{healthIndex.score}</span>
                <Badge className={cn("text-xs", hlMeta.bg, hlMeta.color, hlMeta.border, "border")}>{hlMeta.label}</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Precisão de Forecast</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold text-foreground">{forecastAccuracy}%</span>
              </div>
              <Progress value={forecastAccuracy} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Distribuição de Risco</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(riskDistribution) as [RiskLevel, number][]).map(([level, count]) => {
                  const meta = riskLevelMeta[level];
                  return (
                    <div key={level} className={cn("p-2 rounded-lg text-center", meta.bg)}>
                      <p className={cn("text-lg font-bold", meta.color)}>{count}</p>
                      <p className="text-[10px] text-muted-foreground">{meta.label}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts & Recommendations Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-status-warning" />
                Alertas do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Gerados</span>
                  <span className="text-sm font-bold text-foreground">{alerts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Críticos</span>
                  <span className="text-sm font-bold text-status-error">{alerts.filter(a => a.severity === "critical").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Alto</span>
                  <span className="text-sm font-bold text-[hsl(25,90%,50%)]">{alerts.filter(a => a.severity === "high").length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Recomendações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Geradas</span>
                  <span className="text-sm font-bold text-foreground">{recommendations.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Alta Prioridade</span>
                  <span className="text-sm font-bold text-foreground">{recommendations.filter(r => r.severity === "high" || r.severity === "critical").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Impacto Estimado</span>
                  <span className="text-sm font-bold text-status-success">{formatCurrency(recommendations.reduce((s, r) => s + r.estimatedImpact, 0))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
