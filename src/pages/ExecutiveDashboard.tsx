import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, TrendingUp, TrendingDown, DollarSign, AlertTriangle, BarChart3, Target, Users, Shield, ArrowUpDown, ChevronUp, ChevronDown, X, Zap, Activity, PiggyBank, ShieldAlert } from "lucide-react";
import type { CampaignWithClient } from "@/data/multiClientData";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { getMomentumMeta, getMomentumCategory } from "@/lib/efficiencyCalculations";
import { cn } from "@/lib/utils";
import { generateAlerts } from "@/types/alerts";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { displayClientName, useClient } from "@/contexts/ClientContext";
import { MARGIN_THRESHOLD, type ClientProfitability } from "@/types/financials";
import { riskLevelMeta } from "@/lib/benchmarkCalculations";
import { forecastStatusMeta } from "@/lib/forecastCalculations";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import { materializeFeatureStore, getStoreForecast, getStoreRiskScore, getStoreProfitability } from "@/lib/featureStoreHub";

type SortField = "name" | "mbei" | "spend" | "savings" | "alerts";
type SortDir = "asc" | "desc";

/** Savings: (PlannedCPA - RealCPA) × Conversions */
function computeSavings(campaigns: CampaignWithClient[]) {
  return campaigns.reduce((total, c) => {
    const plannedCPA = c.rollingCPA * 1.1;
    const conversions = Math.round(c.rollingConversionRate * 50000);
    return total + (plannedCPA - c.rollingCPA) * conversions;
  }, 0);
}

function computeTotalSpend(campaigns: CampaignWithClient[]) {
  return campaigns.reduce((s, c) => s + (c.spend ?? c.rollingCPA * 500 * c.spendVelocity), 0);
}

function getRiskLevel(mbei: number, momentum: string, criticalAlerts: number): "green" | "yellow" | "orange" | "red" {
  if (mbei < 80 || criticalAlerts > 0) return "red";
  if (mbei < 90 || momentum === "strong_negative") return "orange";
  if (mbei < 100 || momentum === "negative") return "yellow";
  return "green";
}

const riskColors = {
  green: { bg: "bg-status-success/15", text: "text-status-success", border: "border-status-success/30", label: "Saudável" },
  yellow: { bg: "bg-status-warning/15", text: "text-status-warning", border: "border-status-warning/30", label: "Atenção" },
  orange: { bg: "bg-[hsl(25,90%,50%)]/15", text: "text-[hsl(25,90%,50%)]", border: "border-[hsl(25,90%,50%)]/30", label: "Alto Risco" },
  red: { bg: "bg-status-error/15", text: "text-status-error", border: "border-status-error/30", label: "Crítico" },
};

export default function ExecutiveDashboard() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, selectedClientId, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();
  const clientOptions = clients.map(c => ({ id: c.id, name: displayClientName(c) }));
  const [sortField, setSortField] = useState<SortField>("mbei");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drillClient, setDrillClient] = useState<string | null>(null);

  // Apply drill-down on top of global filters
  const effectiveFilters = useMemo(() => {
    if (drillClient) return { ...filters, clientId: drillClient };
    return filters;
  }, [filters, drillClient]);

  const filteredCampaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, effectiveFilters),
    [syncedCampaigns, effectiveFilters]
  );

  // ── Feature Store Hub (SSoT) ──
  const store = useMemo(() => materializeFeatureStore(filteredCampaigns), [filteredCampaigns]);
  const allAlerts = useMemo(() => generateAlerts(filteredCampaigns), [filteredCampaigns]);
  const agencyData = store.agencyAggregation;
  const totalSavings = useMemo(() => computeSavings(filteredCampaigns), [filteredCampaigns]);
  const totalSpend = useMemo(() => computeTotalSpend(filteredCampaigns), [filteredCampaigns]);
  const momentumMeta = getMomentumMeta(agencyData.momentum);

  const criticalAlerts = useMemo(() => allAlerts.filter(a => a.severity === "critical" && a.status === "active"), [allAlerts]);
  const highAlerts = useMemo(() => allAlerts.filter(a => a.severity === "high" && a.status === "active"), [allAlerts]);

  // Financial data — from Feature Store
  const agencyFinancials = store.agencyFinancials;

  // Client profitabilities with risk — from Feature Store
  const clientProfitabilities = useMemo(() => {
    return store.clientProfitabilities.map(prof => {
      const risk = store.clientRiskScores.get(prof.clientId);
      const camps = filteredCampaigns.filter(c => c.clientId === prof.clientId);
      if (camps.length === 0) return null;
      const avgMBEI7d = Math.round(camps.reduce((s, c) => s + c.avgMBEI7d, 0) / camps.length);
      const { category } = getMomentumCategory(prof.avgMBEI, avgMBEI7d);
      return { ...prof, momentum: category, risk: risk || { score: 0, level: "low" } };
    }).filter(Boolean) as (ClientProfitability & { momentum: string; risk: { score: number; level: string } })[];
  }, [store, filteredCampaigns]);

  // Executive Insights
  const insights = useMemo(() => {
    if (clientProfitabilities.length === 0) return null;
    const byMBEI = [...clientProfitabilities].sort((a, b) => b.avgMBEI - a.avgMBEI);
    const byMargin = [...clientProfitabilities].sort((a, b) => b.grossMargin - a.grossMargin);
    const byRisk = [...clientProfitabilities].sort((a, b) => b.risk.score - a.risk.score);
    const dsps = [...new Set(filteredCampaigns.map(c => c.platform))].map(p => {
      const camps = filteredCampaigns.filter(c => c.platform === p);
      const avgMBEI = Math.round(camps.reduce((s, c) => s + c.currentMBEI, 0) / camps.length);
      const alerts = allAlerts.filter(a => camps.some(c => c.campaignId === a.campaign_id) && a.status === "active").length;
      return { platform: p, avgMBEI, alerts };
    });
    const bestDsp = [...dsps].sort((a, b) => b.avgMBEI - a.avgMBEI)[0];
    const worstDsp = [...dsps].sort((a, b) => b.alerts - a.alerts)[0];
    return {
      topClient: byMBEI[0],
      worstClient: byMBEI[byMBEI.length - 1],
      mostProfitable: byMargin[0],
      highestRisk: byRisk[0],
      bestDsp,
      alertDsp: worstDsp,
    };
  }, [clientProfitabilities, filteredCampaigns, allAlerts]);

  // Forecast data — from Feature Store
  const forecastData = useMemo(() => {
    const campaignForecasts = Array.from(store.campaignForecasts.values());
    const riskCampaigns = campaignForecasts.filter(f => f.overallStatus === "high_risk" || f.overallStatus === "slight_risk");
    const clientForecasts = store.clientFinancialForecasts;
    const riskClients = clientForecasts.filter(f => f.projectedRisk);
    const totalProjectedRevenue = clientForecasts.reduce((s, f) => s + f.projectedRevenue, 0);
    return { campaignForecasts, riskCampaigns, clientForecasts, riskClients, totalProjectedRevenue };
  }, [store]);

  // Client stats
  const clientStats = useMemo(() => {
    const clients = drillClient ? clientOptions.filter(c => c.id === drillClient) : clientOptions;
    return clients.map(client => {
      const campaigns = filteredCampaigns.filter(c => c.clientId === client.id);
      if (campaigns.length === 0) return null;
      const avgMBEI = Math.round(campaigns.reduce((s, c) => s + c.currentMBEI, 0) / campaigns.length);
      const avgMBEI7d = Math.round(campaigns.reduce((s, c) => s + c.avgMBEI7d, 0) / campaigns.length);
      const { category, delta } = getMomentumCategory(avgMBEI, avgMBEI7d);
      const alerts = allAlerts.filter(a => campaigns.some(c => c.campaignId === a.campaign_id) && a.status === "active");
      const critical = alerts.filter(a => a.severity === "critical").length;
      const spend = computeTotalSpend(campaigns);
      const savings = computeSavings(campaigns);
      const risk = getRiskLevel(avgMBEI, category, critical);
      return { ...client, campaigns: campaigns.length, avgMBEI, momentum: category, momentumDelta: delta, activeAlerts: alerts.length, criticalAlerts: critical, spend, savings, risk };
    }).filter(Boolean) as NonNullable<ReturnType<typeof Array.prototype.map>[number]>[];
  }, [filteredCampaigns, allAlerts, drillClient, clientOptions]);

  const sortedClientStats = useMemo(() => {
    const sorted = [...clientStats];
    sorted.sort((a: any, b: any) => {
      let av: number, bv: number;
      switch (sortField) {
        case "name": return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case "mbei": av = a.avgMBEI; bv = b.avgMBEI; break;
        case "spend": av = a.spend; bv = b.spend; break;
        case "savings": av = a.savings; bv = b.savings; break;
        case "alerts": av = a.activeAlerts; bv = b.activeAlerts; break;
        default: av = a.avgMBEI; bv = b.avgMBEI;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return sorted;
  }, [clientStats, sortField, sortDir]);

  // DSP stats
  const dspStats = useMemo(() => {
    const platforms = [...new Set(filteredCampaigns.map(c => c.platform))];
    return platforms.map(p => {
      const campaigns = filteredCampaigns.filter(c => c.platform === p);
      const avgMBEI = Math.round(campaigns.reduce((s, c) => s + c.currentMBEI, 0) / campaigns.length);
      const spend = computeTotalSpend(campaigns);
      const alerts = allAlerts.filter(a => campaigns.some(c => c.campaignId === a.campaign_id) && a.status === "active").length;
      return { platform: p, campaigns: campaigns.length, avgMBEI, spend, alerts };
    }).sort((a, b) => b.avgMBEI - a.avgMBEI);
  }, [filteredCampaigns, allAlerts]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const formatCurrency = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">Painel Executivo</h1>
              <PageInfoTooltip description="Visão executiva de alto nível com MBEI, savings, risco e drill-down por cliente e DSP para liderança." />
              <Badge variant="outline" className="text-xs">Inteligência Estratégica</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Visão executiva de alto nível para liderança da agência</p>
          </div>
          {drillClient && (
            <Button variant="outline" size="sm" onClick={() => setDrillClient(null)}>
              <X className="w-3 h-3 mr-1" />Sair do drill-down
            </Button>
          )}
        </div>

        {/* Global Filters */}
        <GlobalFilterBar filters={filters} onFiltersChange={f => { setFilters(f); setDrillClient(null); }} campaigns={syncedCampaigns} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {drillClient && (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            Drill-down: {clientOptions.find(c => c.id === drillClient)?.name}
          </Badge>
        )}

        {/* ── 1. AGENCY KPIs ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10"><BarChart3 className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">MBEI Médio (30d)</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{agencyData.avgMBEI7d}</p>
                  <p className="text-[11px] text-muted-foreground">{filteredCampaigns.length} campanhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-status-success/10"><DollarSign className="w-5 h-5 text-status-success" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Verba Gerenciada</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(totalSpend)}</p>
                  <p className="text-[11px] text-muted-foreground">{clientOptions.length} clientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10"><TrendingUp className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Economia de Mídia</p>
                  <p className={cn("text-2xl font-bold tabular-nums", totalSavings >= 0 ? "text-status-success" : "text-status-error")}>{formatCurrency(totalSavings)}</p>
                  <p className="text-[11px] text-muted-foreground">Este período</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-status-error/10"><AlertTriangle className="w-5 h-5 text-status-error" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Alertas Ativos</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{highAlerts.length + criticalAlerts.length}</p>
                  <p className="text-[11px] text-muted-foreground">{criticalAlerts.length} críticos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl", agencyData.momentumDelta >= 0 ? "bg-status-success/10" : "bg-status-error/10")}>
                  <Activity className={cn("w-5 h-5", momentumMeta.color)} />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Momentum</p>
                  <p className={cn("text-2xl font-bold tabular-nums", momentumMeta.color)}>
                    {momentumMeta.arrow} {agencyData.momentumDelta >= 0 ? "+" : ""}{agencyData.momentumDelta.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">{momentumMeta.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── FINANCIAL KPIs ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Receita da Agência</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(agencyFinancials.totalRevenue)}</p>
                  <p className="text-[11px] text-muted-foreground">Período selecionado</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-status-success/10"><PiggyBank className="w-5 h-5 text-status-success" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Margem Bruta %</p>
                  <p className={cn("text-2xl font-bold tabular-nums", agencyFinancials.marginPercent >= MARGIN_THRESHOLD ? "text-status-success" : "text-status-error")}>{agencyFinancials.marginPercent.toFixed(1)}%</p>
                  <p className="text-[11px] text-muted-foreground">Meta: {MARGIN_THRESHOLD}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl", agencyFinancials.totalMargin >= 0 ? "bg-status-success/10" : "bg-status-error/10")}>
                  <TrendingUp className={cn("w-5 h-5", agencyFinancials.totalMargin >= 0 ? "text-status-success" : "text-status-error")} />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Margem Bruta</p>
                  <p className={cn("text-2xl font-bold tabular-nums", agencyFinancials.totalMargin >= 0 ? "text-status-success" : "text-status-error")}>{formatCurrency(agencyFinancials.totalMargin)}</p>
                  <p className="text-[11px] text-muted-foreground">Receita - Custo Op.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-status-error/10"><ShieldAlert className="w-5 h-5 text-status-error" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Abaixo da Meta</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{agencyFinancials.belowTarget}</p>
                  <p className="text-[11px] text-muted-foreground">Clientes &lt; {MARGIN_THRESHOLD}% margem</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── 2. CLIENT DISTRIBUTION TABLE ── */}
        {!drillClient && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Eficiência por Cliente</CardTitle>
              <CardDescription>Clique em um cliente para drill-down</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        { field: "name" as SortField, label: "Cliente" },
                        { field: "mbei" as SortField, label: "MBEI Médio" },
                        { field: "spend" as SortField, label: "Spend Total" },
                        { field: "savings" as SortField, label: "Economia" },
                        { field: "alerts" as SortField, label: "Alertas" },
                      ].map(col => (
                        <th key={col.field} className="py-3 px-4 text-left cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort(col.field)}>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground uppercase tracking-wide">
                            {col.label}<SortIcon field={col.field} />
                          </span>
                        </th>
                      ))}
                      <th className="py-3 px-4 text-left"><span className="text-xs text-muted-foreground uppercase tracking-wide">Momentum</span></th>
                      <th className="py-3 px-4 text-left"><span className="text-xs text-muted-foreground uppercase tracking-wide">Risco</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClientStats.map((client: any) => {
                      const mom = getMomentumMeta(client.momentum);
                      const risk = riskColors[client.risk as keyof typeof riskColors];
                      return (
                        <tr
                          key={client.id}
                          className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => setDrillClient(client.id)}
                        >
                          <td className="py-3 px-4 font-medium text-foreground">{client.name}</td>
                          <td className="py-3 px-4">
                            <span className={cn("font-bold tabular-nums", client.avgMBEI >= 110 ? "text-status-success" : client.avgMBEI >= 90 ? "text-foreground" : "text-status-error")}>{client.avgMBEI}</span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground tabular-nums">{formatCurrency(client.spend)}</td>
                          <td className="py-3 px-4">
                            <span className={cn("font-medium tabular-nums", client.savings >= 0 ? "text-status-success" : "text-status-error")}>{formatCurrency(client.savings)}</span>
                          </td>
                          <td className="py-3 px-4">
                            {client.activeAlerts > 0 ? (
                              <Badge variant="outline" className={cn("text-xs", client.criticalAlerts > 0 ? "border-status-error/50 text-status-error" : "border-status-warning/50 text-status-warning")}>
                                {client.activeAlerts}{client.criticalAlerts > 0 && ` (${client.criticalAlerts} crit)`}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn("text-sm font-medium", mom.color)}>{mom.arrow} {client.momentumDelta >= 0 ? "+" : ""}{client.momentumDelta.toFixed(1)}%</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn("px-2 py-0.5 rounded text-xs font-medium", risk.bg, risk.text, "border", risk.border)}>{risk.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 3. RISK OVERVIEW ── */}
        <Card className="border-status-warning/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Shield className="w-5 h-5 text-status-warning" />Mapa de Risco</CardTitle>
            <CardDescription>Classificação de risco por cliente baseada em MBEI, momentum e alertas críticos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {(["green", "yellow", "orange", "red"] as const).map(level => {
                const clients = clientStats.filter((c: any) => c.risk === level);
                const rc = riskColors[level];
                return (
                  <div key={level} className={cn("p-4 rounded-xl border", rc.border, rc.bg)}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn("text-xs font-semibold uppercase tracking-wide", rc.text)}>{rc.label}</span>
                      <span className={cn("text-xl font-bold tabular-nums", rc.text)}>{clients.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {clients.length === 0 && <p className="text-xs text-muted-foreground">Nenhum cliente</p>}
                      {clients.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <span className="text-foreground font-medium truncate mr-2">{c.name}</span>
                          <span className={cn("font-bold tabular-nums", rc.text)}>{c.avgMBEI}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── 4. DSP PERFORMANCE ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Target className="w-5 h-5 text-primary" />Performance por DSP</CardTitle>
            <CardDescription>MBEI, spend e alertas por plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-4 text-left text-xs text-muted-foreground uppercase tracking-wide">Plataforma</th>
                    <th className="py-3 px-4 text-left text-xs text-muted-foreground uppercase tracking-wide">MBEI</th>
                    <th className="py-3 px-4 text-left text-xs text-muted-foreground uppercase tracking-wide">Spend</th>
                    <th className="py-3 px-4 text-left text-xs text-muted-foreground uppercase tracking-wide">Campanhas</th>
                    <th className="py-3 px-4 text-left text-xs text-muted-foreground uppercase tracking-wide">Alertas</th>
                    <th className="py-3 px-4 text-left text-xs text-muted-foreground uppercase tracking-wide">Eficiência</th>
                  </tr>
                </thead>
                <tbody>
                  {dspStats.map(dsp => (
                    <tr key={dsp.platform} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">{dsp.platform}</td>
                      <td className="py-3 px-4">
                        <span className={cn("font-bold tabular-nums", dsp.avgMBEI >= 110 ? "text-status-success" : dsp.avgMBEI >= 90 ? "text-foreground" : "text-status-error")}>{dsp.avgMBEI}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground tabular-nums">{formatCurrency(dsp.spend)}</td>
                      <td className="py-3 px-4 text-muted-foreground tabular-nums">{dsp.campaigns}</td>
                      <td className="py-3 px-4">
                        {dsp.alerts > 0 ? (
                          <Badge variant="outline" className="text-xs border-status-warning/50 text-status-warning">{dsp.alerts}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", dsp.avgMBEI >= 110 ? "bg-status-success" : dsp.avgMBEI >= 90 ? "bg-primary" : "bg-status-error")}
                            style={{ width: `${Math.min(dsp.avgMBEI / 1.5, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── EXECUTIVE INSIGHTS ── */}
        {insights && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-primary" />Executive Insights</CardTitle>
              <CardDescription>Destaques estratégicos do período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: "Top Performance", value: insights.topClient?.clientName, metric: `MBEI ${insights.topClient?.avgMBEI}`, color: "text-status-success", bg: "bg-status-success/10" },
                  { label: "Pior Performance", value: insights.worstClient?.clientName, metric: `MBEI ${insights.worstClient?.avgMBEI}`, color: "text-status-error", bg: "bg-status-error/10" },
                  { label: "Mais Rentável", value: insights.mostProfitable?.clientName, metric: `${insights.mostProfitable?.marginPercent.toFixed(1)}% margem`, color: "text-status-success", bg: "bg-status-success/10" },
                  { label: "Maior Risco", value: insights.highestRisk?.clientName, metric: `Score ${insights.highestRisk?.risk.score}`, color: "text-status-error", bg: "bg-status-error/10" },
                  { label: "Melhor DSP", value: insights.bestDsp?.platform, metric: `MBEI ${insights.bestDsp?.avgMBEI}`, color: "text-primary", bg: "bg-primary/10" },
                  { label: "DSP + Alertas", value: insights.alertDsp?.platform, metric: `${insights.alertDsp?.alerts} alertas`, color: "text-status-warning", bg: "bg-status-warning/10" },
                ].map((item, i) => (
                  <div key={i} className={cn("p-4 rounded-xl border border-border", item.bg)}>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{item.label}</p>
                    <p className="font-semibold text-foreground">{item.value}</p>
                    <p className={cn("text-sm font-medium mt-1", item.color)}>{item.metric}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── PROJECTED END-OF-MONTH OUTLOOK ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Projeção de Receita</CardTitle>
              <CardDescription>Receita projetada vs atual para o período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Receita Atual</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{formatCurrency(agencyFinancials.totalRevenue)}</p>
                  </div>
                  <div className="text-center px-4">
                    <Activity className="w-5 h-5 text-muted-foreground mx-auto" />
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Projetada</p>
                    <p className={cn("text-xl font-bold tabular-nums", forecastData.totalProjectedRevenue >= agencyFinancials.totalRevenue ? "text-status-success" : "text-status-error")}>
                      {formatCurrency(forecastData.totalProjectedRevenue)}
                    </p>
                  </div>
                </div>
                {forecastData.clientForecasts.map(f => (
                  <div key={f.clientId} className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{f.clientName}</span>
                    <div className="flex items-center gap-3">
                      <span className={cn("tabular-nums font-medium", f.projectedMarginPercent >= 20 ? "text-status-success" : "text-status-error")}>{f.projectedMarginPercent}%</span>
                      {f.projectedRisk && <Badge variant="destructive" className="text-[10px]">Risco</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={forecastData.riskClients.length > 0 ? "border-status-error/30" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className={cn("w-5 h-5", forecastData.riskClients.length > 0 ? "text-status-error" : "text-muted-foreground")} />Clientes em Risco Projetado</CardTitle>
              <CardDescription>Projeção de margem abaixo da meta</CardDescription>
            </CardHeader>
            <CardContent>
              {forecastData.riskClients.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum cliente em risco projetado ✓</p>
              ) : (
                <div className="space-y-3">
                  {forecastData.riskClients.map(f => (
                    <div key={f.clientId} className="p-4 rounded-lg border border-status-error/20 bg-status-error/5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-foreground">{f.clientName}</p>
                        <span className="text-lg font-bold text-status-error tabular-nums">{f.projectedMarginPercent}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Receita projetada: {formatCurrency(f.projectedRevenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Forecast Risk Campaigns Summary */}
        {forecastData.riskCampaigns.length > 0 && (
          <Card className="border-status-warning/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-status-warning" />Campanhas com Risco Projetado</CardTitle>
              <CardDescription>{forecastData.riskCampaigns.length} campanhas com forecast de underperformance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {forecastData.riskCampaigns.slice(0, 6).map(f => {
                  const fsMeta = forecastStatusMeta[f.overallStatus];
                  return (
                    <div key={f.campaignId} className={cn("p-3 rounded-lg border", fsMeta.border, fsMeta.bg)}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-foreground truncate mr-2">
                          {filteredCampaigns.find(c => c.campaignId === f.campaignId)?.campaignName || f.campaignId}
                        </p>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", fsMeta.bg, fsMeta.color, fsMeta.border)}>{fsMeta.label}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                        <div><span className="text-muted-foreground">MBEI →</span> <span className={cn("font-bold", f.forecastedMBEI >= 95 ? "text-status-success" : "text-status-error")}>{f.forecastedMBEI}</span></div>
                        <div><span className="text-muted-foreground">CPA →</span> <span className="font-bold text-foreground">R${f.projectedCPA.toFixed(0)}</span></div>
                        <div><span className="text-muted-foreground">Meta</span> <span className={cn("font-bold", f.goalProbability >= 90 ? "text-status-success" : "text-status-error")}>{f.goalProbability}%</span></div>
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
