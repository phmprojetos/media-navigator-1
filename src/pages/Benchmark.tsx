import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Target, Users, ShieldAlert, ArrowUpDown, ChevronUp, ChevronDown, Download, Activity, Gauge, TrendingUp, DollarSign, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { MARGIN_THRESHOLD } from "@/types/financials";
import { generateAlerts } from "@/types/alerts";
import { getMomentumMeta, getMomentumCategory } from "@/lib/efficiencyCalculations";
import { getPercentile, riskLevelMeta, percentileMeta } from "@/lib/benchmarkCalculations";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { displayClientName, useClient } from "@/contexts/ClientContext";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import { materializeFeatureStore } from "@/lib/featureStoreHub";

type ClientSortField = "rank" | "efficiency" | "margin" | "spend" | "alerts" | "risk";
type DspSortField = "efficiency" | "cpa" | "spend" | "alerts";
type SortDir = "asc" | "desc";

export default function Benchmark() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, selectedClientId, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();
  const clientOptions = clients.map(c => ({ id: c.id, name: displayClientName(c) }));
  const [clientSort, setClientSort] = useState<ClientSortField>("efficiency");
  const [clientSortDir, setClientSortDir] = useState<SortDir>("desc");
  const [dspSort, setDspSort] = useState<DspSortField>("efficiency");
  const [dspSortDir, setDspSortDir] = useState<SortDir>("desc");

  const filteredCampaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, { ...filters, campaignId: "all" }),
    [syncedCampaigns, filters]
  );

  const allAlerts = useMemo(() => generateAlerts(filteredCampaigns), [filteredCampaigns]);

  // ── Feature Store Hub (SSoT) ──
  const store = useMemo(() => materializeFeatureStore(filteredCampaigns), [filteredCampaigns]);
  const profitabilities = store.clientProfitabilities;
  const benchmark = store.agencyBenchmark;

  // Client ranking with risk scores — from Feature Store
  const clientRanking = useMemo(() => {
    return clientOptions.map(client => {
      const campaigns = filteredCampaigns.filter(c => c.clientId === client.id);
      if (campaigns.length === 0) return null;
      const avgMBEI = Math.round(campaigns.reduce((s, c) => s + c.currentMBEI, 0) / campaigns.length);
      const avgMBEI7d = Math.round(campaigns.reduce((s, c) => s + c.avgMBEI7d, 0) / campaigns.length);
      const { category, delta } = getMomentumCategory(avgMBEI, avgMBEI7d);
      const alerts = allAlerts.filter(a => campaigns.some(c => c.campaignId === a.campaign_id) && a.status === "active").length;
      const prof = profitabilities.find(p => p.clientId === client.id);
      const marginPercent = prof?.marginPercent ?? 0;
      const spend = campaigns.reduce((s, c) => s + c.rollingCPA * 500 * c.spendVelocity, 0);
      const risk = store.clientRiskScores.get(client.id) || { score: 0, level: "low" };
      return { ...client, avgMBEI, momentum: category, momentumDelta: delta, marginPercent, alerts, spend, risk };
    }).filter(Boolean) as any[];
  }, [filteredCampaigns, allAlerts, profitabilities, store, clientOptions]);

  const sortedClients = useMemo(() => {
    const sorted = [...clientRanking].sort((a, b) => {
      let av: number, bv: number;
      switch (clientSort) {
        case "rank": case "efficiency": av = a.avgMBEI; bv = b.avgMBEI; break;
        case "margin": av = a.marginPercent; bv = b.marginPercent; break;
        case "spend": av = a.spend; bv = b.spend; break;
        case "alerts": av = a.alerts; bv = b.alerts; break;
        case "risk": av = a.risk.score; bv = b.risk.score; break;
        default: av = a.avgMBEI; bv = b.avgMBEI;
      }
      return clientSortDir === "asc" ? av - bv : bv - av;
    });
    return sorted.map((c, i) => ({ ...c, rank: i + 1, percentile: getPercentile(i + 1, sorted.length) }));
  }, [clientRanking, clientSort, clientSortDir]);

  // DSP stats
  const dspStats = useMemo(() => {
    const platforms = [...new Set(filteredCampaigns.map(c => c.platform))];
    return platforms.map(p => {
      const campaigns = filteredCampaigns.filter(c => c.platform === p);
      const avgMBEI = Math.round(campaigns.reduce((s, c) => s + c.currentMBEI, 0) / campaigns.length);
      const avgCPA = Math.round(campaigns.reduce((s, c) => s + c.rollingCPA, 0) / campaigns.length * 100) / 100;
      const spend = campaigns.reduce((s, c) => s + c.rollingCPA * 500 * c.spendVelocity, 0);
      const alerts = allAlerts.filter(a => campaigns.some(c => c.campaignId === a.campaign_id) && a.status === "active").length;
      const alertDensity = campaigns.length > 0 ? (alerts / campaigns.length * 100).toFixed(0) : "0";
      const avgMBEI7d = Math.round(campaigns.reduce((s, c) => s + c.avgMBEI7d, 0) / campaigns.length);
      const { category, delta } = getMomentumCategory(avgMBEI, avgMBEI7d);
      return { platform: p, campaigns: campaigns.length, avgMBEI, avgCPA, spend, alerts, alertDensity, momentum: category, momentumDelta: delta };
    });
  }, [filteredCampaigns, allAlerts]);

  const sortedDsps = useMemo(() => {
    return [...dspStats].sort((a, b) => {
      let av: number, bv: number;
      switch (dspSort) {
        case "efficiency": av = a.avgMBEI; bv = b.avgMBEI; break;
        case "cpa": av = a.avgCPA; bv = b.avgCPA; break;
        case "spend": av = a.spend; bv = b.spend; break;
        case "alerts": av = a.alerts; bv = b.alerts; break;
        default: av = a.avgMBEI; bv = b.avgMBEI;
      }
      return dspSortDir === "asc" ? av - bv : bv - av;
    });
  }, [dspStats, dspSort, dspSortDir]);

  const fmt = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  const toggleClientSort = (f: ClientSortField) => {
    if (clientSort === f) setClientSortDir(d => d === "asc" ? "desc" : "asc");
    else { setClientSort(f); setClientSortDir("desc"); }
  };
  const toggleDspSort = (f: DspSortField) => {
    if (dspSort === f) setDspSortDir(d => d === "asc" ? "desc" : "asc");
    else { setDspSort(f); setDspSortDir("desc"); }
  };

  const CSortIcon = ({ field }: { field: ClientSortField }) => {
    if (clientSort !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return clientSortDir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };
  const DSortIcon = ({ field }: { field: DspSortField }) => {
    if (dspSort !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return dspSortDir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
             <h1 className="text-2xl font-bold text-foreground">Benchmark & Ranking</h1>
              <PageInfoTooltip description="Benchmarks internos, ranking de clientes por eficiência e CPA, scoring de risco e análise comparativa por DSP." />
              <Badge variant="outline" className="text-xs">Inteligência Interna</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Benchmarks internos, ranking de clientes e scoring de risco</p>
          </div>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Exportar</Button>
        </div>

        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} showStatus={false} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* Agency Benchmarks */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <BarChart3 className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Eficiência Média</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{benchmark.avgMBEI}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">CPA Médio</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">R$ {benchmark.avgCPA}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">CVR Médio</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{(benchmark.avgConversionRate * 100).toFixed(2)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-5 h-5 text-status-success mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Margem Média</p>
              <p className={cn("text-2xl font-bold tabular-nums", benchmark.avgMarginPercent >= MARGIN_THRESHOLD ? "text-status-success" : "text-status-error")}>{benchmark.avgMarginPercent}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Activity className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Velocidade de Gasto</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{benchmark.avgSpendVelocity}x</p>
            </CardContent>
          </Card>
        </div>

        {/* Client Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Ranking de Performance por Cliente</CardTitle>
            <CardDescription>Ranking com score de risco e percentil de performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 cursor-pointer" onClick={() => toggleClientSort("rank")}>
                      <span className="flex items-center gap-1">Rank<CSortIcon field="rank" /></span>
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleClientSort("efficiency")}>
                      <span className="flex items-center gap-1">Eficiência<CSortIcon field="efficiency" /></span>
                    </TableHead>
                    <TableHead>Momentum</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleClientSort("margin")}>
                      <span className="flex items-center gap-1">Margem %<CSortIcon field="margin" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleClientSort("spend")}>
                      <span className="flex items-center gap-1">Spend<CSortIcon field="spend" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleClientSort("alerts")}>
                      <span className="flex items-center gap-1">Alertas<CSortIcon field="alerts" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleClientSort("risk")}>
                      <span className="flex items-center gap-1">Score de Risco<CSortIcon field="risk" /></span>
                    </TableHead>
                    <TableHead>Percentil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedClients.map((c: any) => {
                    const mom = getMomentumMeta(c.momentum);
                    const rl = riskLevelMeta[c.risk.level as keyof typeof riskLevelMeta];
                    const pl = percentileMeta[c.percentile as keyof typeof percentileMeta];
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/30">
                        <TableCell>
                          <span className={cn("w-7 h-7 inline-flex items-center justify-center rounded-full text-xs font-bold",
                            c.rank === 1 && "bg-status-success text-background",
                            c.rank === 2 && "bg-primary text-background",
                            c.rank === 3 && "bg-status-warning text-background",
                            c.rank > 3 && "bg-muted text-muted-foreground"
                          )}>{c.rank}</span>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                        <TableCell>
                          <span className={cn("font-bold tabular-nums", c.avgMBEI >= 110 ? "text-status-success" : c.avgMBEI >= 90 ? "text-foreground" : "text-status-error")}>{c.avgMBEI}</span>
                        </TableCell>
                        <TableCell>
                          <span className={cn("text-sm font-medium", mom.color)}>{mom.arrow} {c.momentumDelta >= 0 ? "+" : ""}{c.momentumDelta.toFixed(1)}%</span>
                        </TableCell>
                        <TableCell>
                          <span className={cn("font-bold tabular-nums", c.marginPercent >= MARGIN_THRESHOLD ? "text-status-success" : "text-status-error")}>{c.marginPercent.toFixed(1)}%</span>
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{fmt(c.spend)}</TableCell>
                        <TableCell>
                          {c.alerts > 0 ? (
                            <Badge variant="outline" className="text-xs border-status-warning/50 text-status-warning">{c.alerts}</Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-2 bg-muted rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full", rl.bg.replace("/10", ""))} style={{ width: `${c.risk.score}%` }} />
                            </div>
                            <span className={cn("text-xs font-medium px-2 py-0.5 rounded border", rl.bg, rl.color, rl.border)}>{c.risk.score}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded", pl.bg, pl.color)}>{pl.label}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* DSP Benchmark */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-primary" />Benchmark de Performance por DSP</CardTitle>
            <CardDescription>Eficiência, CPA e alertas por plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DSP</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleDspSort("efficiency")}>
                      <span className="flex items-center gap-1">Eficiência<DSortIcon field="efficiency" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleDspSort("cpa")}>
                      <span className="flex items-center gap-1">CPA Médio<DSortIcon field="cpa" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleDspSort("spend")}>
                      <span className="flex items-center gap-1">Spend<DSortIcon field="spend" /></span>
                    </TableHead>
                    <TableHead>Campanhas</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleDspSort("alerts")}>
                      <span className="flex items-center gap-1">Densidade de Alertas<DSortIcon field="alerts" /></span>
                    </TableHead>
                    <TableHead>Momentum</TableHead>
                    <TableHead>Eficiência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDsps.map(dsp => {
                    const mom = getMomentumMeta(dsp.momentum);
                    const maxMBEI = Math.max(...sortedDsps.map(d => d.avgMBEI), 1);
                    return (
                      <TableRow key={dsp.platform} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground">{dsp.platform}</TableCell>
                        <TableCell>
                          <span className={cn("font-bold tabular-nums", dsp.avgMBEI >= 110 ? "text-status-success" : dsp.avgMBEI >= 90 ? "text-foreground" : "text-status-error")}>{dsp.avgMBEI}</span>
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">R$ {dsp.avgCPA}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{fmt(dsp.spend)}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{dsp.campaigns}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", Number(dsp.alertDensity) > 50 ? "border-status-error/50 text-status-error" : "border-muted-foreground/30 text-muted-foreground")}>
                            {dsp.alertDensity}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={cn("text-sm font-medium", mom.color)}>{mom.arrow} {dsp.momentumDelta >= 0 ? "+" : ""}{dsp.momentumDelta.toFixed(1)}%</span>
                        </TableCell>
                        <TableCell>
                          <div className="w-28 h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", dsp.avgMBEI >= 110 ? "bg-status-success" : dsp.avgMBEI >= 90 ? "bg-primary" : "bg-status-error")}
                              style={{ width: `${(dsp.avgMBEI / maxMBEI) * 100}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
