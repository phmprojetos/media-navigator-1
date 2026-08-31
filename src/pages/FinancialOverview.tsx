import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, AlertTriangle, ArrowUpDown, ChevronUp, ChevronDown, Download, PiggyBank, Target, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { MARGIN_THRESHOLD, type ClientProfitability } from "@/types/financials";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import { materializeFeatureStore } from "@/lib/featureStoreHub";

type SortField = "name" | "margin" | "revenue" | "mbei" | "spend" | "alerts";
type SortDir = "asc" | "desc";

export default function FinancialOverview() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();
  const [sortField, setSortField] = useState<SortField>("margin");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filteredCampaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, { ...filters, campaignId: "all" }),
    [syncedCampaigns, filters]
  );

  // ── Feature Store Hub (SSoT) ──
  const store = useMemo(() => materializeFeatureStore(filteredCampaigns), [filteredCampaigns]);
  const profitabilities = store.clientProfitabilities;
  const agencyFinancials = store.agencyFinancials;

  const sorted = useMemo(() => {
    const arr = [...profitabilities];
    arr.sort((a, b) => {
      let av: number, bv: number;
      switch (sortField) {
        case "name": return sortDir === "asc" ? a.clientName.localeCompare(b.clientName) : b.clientName.localeCompare(a.clientName);
        case "margin": av = a.marginPercent; bv = b.marginPercent; break;
        case "revenue": av = a.grossRevenue; bv = b.grossRevenue; break;
        case "mbei": av = a.avgMBEI; bv = b.avgMBEI; break;
        case "spend": av = a.mediaSpend; bv = b.mediaSpend; break;
        case "alerts": av = a.alertsCount; bv = b.alertsCount; break;
        default: av = a.marginPercent; bv = b.marginPercent;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [profitabilities, sortField, sortDir]);

  const topProfitable = useMemo(() => [...profitabilities].sort((a, b) => b.grossMargin - a.grossMargin).slice(0, 5), [profitabilities]);
  const belowTarget = profitabilities.filter(p => p.financialRisk);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const fmt = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">Financeiro da Agência</h1>
              <PageInfoTooltip description="Visão consolidada de receita, margem bruta e rentabilidade por cliente da agência." />
              <Badge variant="outline" className="text-xs">Financial Overview</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Receita, margem e rentabilidade por cliente</p>
          </div>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Exportar</Button>
        </div>

        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} showStatus={false} />

        {syncedCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* Agency KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Receita Total</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{fmt(agencyFinancials.totalRevenue)}</p>
                  <p className="text-[11px] text-muted-foreground">Este mês</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-status-success/10"><PiggyBank className="w-5 h-5 text-status-success" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Margem Bruta</p>
                  <p className={cn("text-2xl font-bold tabular-nums", agencyFinancials.totalMargin >= 0 ? "text-status-success" : "text-status-error")}>{fmt(agencyFinancials.totalMargin)}</p>
                  <p className="text-[11px] text-muted-foreground">{agencyFinancials.marginPercent.toFixed(1)}% margem</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10"><Target className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Margem %</p>
                  <p className={cn("text-2xl font-bold tabular-nums", agencyFinancials.marginPercent >= MARGIN_THRESHOLD ? "text-status-success" : "text-status-error")}>{agencyFinancials.marginPercent.toFixed(1)}%</p>
                  <p className="text-[11px] text-muted-foreground">Meta: {MARGIN_THRESHOLD}%</p>
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
                  <p className="text-[11px] text-muted-foreground">clientes &lt; {MARGIN_THRESHOLD}% margem</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-status-success" />Top 5 Mais Rentáveis</CardTitle>
              <CardDescription>Clientes com maior margem bruta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProfitable.map((p, i) => (
                  <div key={p.clientId} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <span className={cn("w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold", i === 0 && "bg-status-success text-background", i === 1 && "bg-primary text-background", i === 2 && "bg-status-warning text-background", i > 2 && "bg-muted text-muted-foreground")}>{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{p.clientName}</p>
                      <p className="text-xs text-muted-foreground">Receita: {fmt(p.grossRevenue)}</p>
                    </div>
                    <div className="text-right">
                      <span className={cn("text-lg font-bold tabular-nums", p.marginPercent >= MARGIN_THRESHOLD ? "text-status-success" : "text-status-error")}>{p.marginPercent.toFixed(1)}%</span>
                      <p className="text-xs text-muted-foreground">{fmt(p.grossMargin)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Below Target */}
          <Card className={belowTarget.length > 0 ? "border-status-error/30" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className={cn("w-5 h-5", belowTarget.length > 0 ? "text-status-error" : "text-muted-foreground")} />Clientes Abaixo da Meta</CardTitle>
              <CardDescription>Margem abaixo de {MARGIN_THRESHOLD}% — risco financeiro</CardDescription>
            </CardHeader>
            <CardContent>
              {belowTarget.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum cliente abaixo da meta ✓</p>
              ) : (
                <div className="space-y-3">
                  {belowTarget.map(p => (
                    <div key={p.clientId} className="p-4 rounded-lg border border-status-error/20 bg-status-error/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{p.clientName}</p>
                          <Badge variant="destructive" className="text-[10px]">Risco Financeiro</Badge>
                        </div>
                        <span className="text-lg font-bold text-status-error tabular-nums">{p.marginPercent.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Receita: {fmt(p.grossRevenue)}</span>
                        <span>Custo: {fmt(p.operationalCost)}</span>
                        <span>MBEI: {p.avgMBEI}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Full Profitability Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rentabilidade por Cliente</CardTitle>
            <CardDescription>Visão completa de receita, margem e eficiência</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {([
                      ["name", "Cliente"],
                      ["spend", "Media Spend"],
                      ["revenue", "Receita Gestão"],
                    ] as [SortField, string][]).map(([f, l]) => (
                      <TableHead key={f} className="cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort(f)}>
                        <span className="flex items-center gap-1">{l}<SortIcon field={f} /></span>
                      </TableHead>
                    ))}
                    <TableHead>BV</TableHead>
                    <TableHead>Receita Bruta</TableHead>
                    <TableHead>Custo Op.</TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort("margin")}>
                      <span className="flex items-center gap-1">Margem<SortIcon field="margin" /></span>
                    </TableHead>
                    <TableHead>Margem %</TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort("mbei")}>
                      <span className="flex items-center gap-1">MBEI<SortIcon field="mbei" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort("alerts")}>
                      <span className="flex items-center gap-1">Alertas<SortIcon field="alerts" /></span>
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(p => (
                    <TableRow key={p.clientId} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">{p.clientName}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{fmt(p.mediaSpend)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{fmt(p.managementRevenue)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{fmt(p.bvRevenue)}</TableCell>
                      <TableCell className="tabular-nums font-medium">{fmt(p.grossRevenue)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{fmt(p.operationalCost)}</TableCell>
                      <TableCell className={cn("tabular-nums font-medium", p.grossMargin >= 0 ? "text-status-success" : "text-status-error")}>{fmt(p.grossMargin)}</TableCell>
                      <TableCell>
                        <span className={cn("font-bold tabular-nums", p.marginPercent >= MARGIN_THRESHOLD ? "text-status-success" : p.marginPercent >= 10 ? "text-status-warning" : "text-status-error")}>{p.marginPercent.toFixed(1)}%</span>
                      </TableCell>
                      <TableCell>
                        <span className={cn("font-bold tabular-nums", p.avgMBEI >= 110 ? "text-status-success" : p.avgMBEI >= 90 ? "text-foreground" : "text-status-error")}>{p.avgMBEI}</span>
                      </TableCell>
                      <TableCell>
                        {p.alertsCount > 0 ? (
                          <Badge variant="outline" className="text-xs border-status-warning/50 text-status-warning">{p.alertsCount}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {p.financialRisk ? (
                          <Badge variant="destructive" className="text-[10px]">Risco</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-status-success/50 text-status-success">Saudável</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
