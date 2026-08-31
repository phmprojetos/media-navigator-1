import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, Image, Video, FileText, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";
import { ALL_CREATIVES, type CreativeWithClient } from "@/data/multiClientData";
import { useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { cn } from "@/lib/utils";
import { getMomentumMeta } from "@/lib/efficiencyCalculations";
import type { MomentumCategory } from "@/types/efficiency";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";

const mockInsights = [
  { type: "scale", message: "Criativos com prova social têm 2x mais conversão", impact: "alto" },
  { type: "warning", message: "Carrossel de produtos está saturando (freq. 4.2)", impact: "médio" },
  { type: "opportunity", message: "UGC performa bem com público 25-34", impact: "alto" },
  { type: "info", message: "CTAs diretos ('Compre Agora') superam CTAs suaves em 35%", impact: "médio" },
];

type GroupBy = "none" | "client" | "dsp" | "campaign" | "angle";

export default function CreativeIntelligence() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const filtered = useMemo(() => {
    let result = ALL_CREATIVES;
    if (filters.clientId !== "all") result = result.filter(c => c.clientId === filters.clientId);
    if (filters.platform !== "all") result = result.filter(c => c.platform === filters.platform);
    if (filters.campaignId !== "all") result = result.filter(c => syncedCampaigns.find(camp => camp.campaignId === filters.campaignId)?.campaignName === c.campaignName);
    return result;
  }, [filters, syncedCampaigns]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return { "Todos": filtered };
    const map: Record<string, CreativeWithClient[]> = {};
    filtered.forEach(c => {
      const key = groupBy === "client" ? c.clientName : groupBy === "dsp" ? c.platform : groupBy === "campaign" ? c.campaignName : c.angle;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [filtered, groupBy]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      scaling: { variant: "default", label: "Escalando" },
      stable: { variant: "secondary", label: "Estável" },
      saturating: { variant: "destructive", label: "Saturando" },
      testing: { variant: "outline", label: "Testando" },
    };
    const s = styles[status] || styles.stable;
    return <Badge variant={s.variant} className="text-xs">{s.label}</Badge>;
  };

  const getFormatIcon = (format: string) => {
    if (format.includes("Video") || format.includes("video")) return <Video className="w-4 h-4 text-primary" />;
    if (format.includes("Imagem") || format.includes("image")) return <Image className="w-4 h-4 text-muted-foreground" />;
    return <FileText className="w-4 h-4 text-status-success" />;
  };

  const getMomentumBadge = (momentum: string) => {
    const meta = getMomentumMeta(momentum as MomentumCategory);
    return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", meta.color === "text-status-success" ? "bg-status-success/10 text-status-success" : meta.color === "text-status-error" ? "bg-status-error/10 text-status-error" : "bg-status-warning/10 text-status-warning")}>{meta.label}</span>;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-foreground">Inteligência de Criativos</h1><PageInfoTooltip description="Análise multi-cliente de performance de criativos com tags, insights e comparativo por formato e ângulo." /></div>
            <p className="text-sm text-muted-foreground">Análise multi-cliente de performance, tags e insights</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={viewMode === "table" ? "default" : "outline"} size="sm" onClick={() => setViewMode("table")}><List className="w-4 h-4" /></Button>
            <Button variant={viewMode === "cards" ? "default" : "outline"} size="sm" onClick={() => setViewMode("cards")}><LayoutGrid className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} showStatus={false} />

        {ALL_CREATIVES.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* Group By + Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Agrupar por:</span>
            <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem agrupamento</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="dsp">DSP / Plataforma</SelectItem>
                <SelectItem value="campaign">Campanha</SelectItem>
                <SelectItem value="angle">Ângulo Criativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="text-xs">{filtered.length} criativos</Badge>
        </div>

        {/* Insights */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><Lightbulb className="w-5 h-5 text-status-warning" />Insights Automáticos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mockInsights.map((insight, i) => (
                <div key={i} className={cn("p-3 rounded-lg border", insight.type === "scale" ? "border-status-success/30 bg-status-success/5" : insight.type === "warning" ? "border-status-warning/30 bg-status-warning/5" : insight.type === "opportunity" ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30")}>
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-foreground">{insight.message}</p>
                    <Badge variant="outline" className="text-xs ml-2">{insight.impact}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Breakdown */}
        {Object.entries(grouped).map(([groupLabel, creatives]) => (
          <Card key={groupLabel}>
            {groupBy !== "none" && (
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{groupLabel}</CardTitle>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{creatives.length} criativos</span>
                    <span>MBEI Médio: <strong className="text-foreground">{Math.round(creatives.reduce((s, c) => s + c.mbei, 0) / creatives.length)}</strong></span>
                  </div>
                </div>
              </CardHeader>
            )}
            <CardContent className={groupBy !== "none" ? "pt-0" : ""}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criativo</TableHead>
                      {groupBy !== "client" && <TableHead>Cliente</TableHead>}
                      {groupBy !== "dsp" && <TableHead>DSP</TableHead>}
                      {groupBy !== "campaign" && <TableHead>Campanha</TableHead>}
                      <TableHead>Tags</TableHead>
                      <TableHead className="text-right">MBEI</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                      <TableHead className="text-right">CVR</TableHead>
                      <TableHead>Momentum</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creatives.map(cr => (
                      <TableRow key={cr.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFormatIcon(cr.format)}
                            <div>
                              <p className="font-medium text-foreground text-sm">{cr.name}</p>
                              <p className="text-xs text-muted-foreground">{cr.format}</p>
                            </div>
                          </div>
                        </TableCell>
                        {groupBy !== "client" && <TableCell className="text-sm">{cr.clientName}</TableCell>}
                        {groupBy !== "dsp" && <TableCell className="text-sm">{cr.platform}</TableCell>}
                        {groupBy !== "campaign" && <TableCell className="text-sm text-muted-foreground">{cr.campaignName}</TableCell>}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-xs">{cr.angle}</Badge>
                            <Badge variant="outline" className="text-xs">{cr.emotion}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{cr.mbei}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{cr.ctr}%</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">R${cr.cpa}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{cr.cvr}%</TableCell>
                        <TableCell>{getMomentumBadge(cr.momentum)}</TableCell>
                        <TableCell>{getStatusBadge(cr.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
