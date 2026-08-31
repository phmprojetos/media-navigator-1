import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ISOScoreCard } from "@/components/dashboard/ISOScoreCard";
import { AgencyISOBar } from "@/components/dashboard/AgencyISOBar";
import { CampaignTrendCard } from "@/components/dashboard/CampaignTrendCard";
import { materializeFeatureStore } from "@/lib/featureStoreHub";
import { generateAlerts } from "@/types/alerts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Activity, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalFilterBar } from "@/components/intelligence/GlobalFilterBar";
import { useIntelligenceFilters } from "@/hooks/useIntelligenceFilters";
import { NoCampaignData } from "@/components/intelligence/NoCampaignData";
import { useClient } from "@/contexts/ClientContext";
import type { CampaignWithClient } from "@/data/multiClientData";
import { applyCampaignFilters, useSyncedCampaigns } from "@/hooks/useSyncedCampaigns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";

type GroupBy = "none" | "client" | "dsp" | "campaign";

export default function Efficiency() {
  const { filters, setFilters } = useIntelligenceFilters();
  const { clients, loading: clientsLoading } = useClient();
  const { campaigns: syncedCampaigns, loading: campaignsLoading } = useSyncedCampaigns();
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const filteredCampaigns = useMemo(
    () => applyCampaignFilters(syncedCampaigns, filters),
    [syncedCampaigns, filters]
  );

  const store = useMemo(() => materializeFeatureStore(filteredCampaigns), [filteredCampaigns]);
  const allAlerts = useMemo(() => generateAlerts(filteredCampaigns), [filteredCampaigns]);
  const agencyData = store.agencyAggregation;
  const iso = store.iso;

  const grouped = useMemo(() => {
    if (groupBy === "none") return { "Todas as Campanhas": filteredCampaigns };
    const map: Record<string, CampaignWithClient[]> = {};
    filteredCampaigns.forEach(c => {
      const key = groupBy === "client" ? c.clientName : groupBy === "dsp" ? c.platform : c.campaignName;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [filteredCampaigns, groupBy]);

  const toggleGroup = (key: string) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">Eficiência de Mídia</h1>
              <PageInfoTooltip description="Análise avançada de eficiência de compra de mídia com ISO, momentum e economia real por campanha." />
              <Badge className="bg-primary/10 text-primary border-primary/20">Dashboard Avançado</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Análise de eficiência da compra de mídia e economia real</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Exportar</Button>
          </div>
        </div>

        {/* Global Filters */}
        <GlobalFilterBar filters={filters} onFiltersChange={setFilters} campaigns={syncedCampaigns} />

        {filteredCampaigns.length === 0 && <NoCampaignData hasClients={clients.length > 0} clientsLoading={clientsLoading} campaignsLoading={campaignsLoading} />}

        {/* Agency-Level ISO Bar */}
        <AgencyISOBar data={agencyData} iso={iso} />

        <div>
          <ISOScoreCard iso={iso} />
        </div>

        {/* Grouping Controls */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Agrupar por:</span>
          <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem agrupamento</SelectItem>
              <SelectItem value="client">Cliente</SelectItem>
              <SelectItem value="dsp">DSP / Plataforma</SelectItem>
              <SelectItem value="campaign">Campanha</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">{filteredCampaigns.length} campanhas</Badge>
        </div>

        {/* Campaign Trends by Group */}
        {filteredCampaigns.length > 0 && Object.entries(grouped).map(([groupLabel, campaigns]) => {
          const isCollapsed = collapsedGroups[groupLabel];
          const groupAvgEff = campaigns.length
            ? Math.round(campaigns.reduce((s, c) => s + c.currentMBEI, 0) / campaigns.length)
            : 0;

          return (
            <div key={groupLabel} className="space-y-3">
              {groupBy !== "none" && (
                <Collapsible open={!isCollapsed} onOpenChange={() => toggleGroup(groupLabel)}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-card border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      <span className="font-semibold text-foreground">{groupLabel}</span>
                      <Badge variant="outline" className="text-xs">{campaigns.length} campanhas</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Eficiência: <strong className={cn(groupAvgEff >= 100 ? "text-status-success" : groupAvgEff >= 90 ? "text-status-warning" : "text-status-error")}>{groupAvgEff}</strong></span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-3">
                      {campaigns.map(c => (
                        <CampaignTrendCard key={c.campaignId} campaign={c} alerts={allAlerts.filter(a => a.campaign_id === c.campaignId)} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {groupBy === "none" && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />Trend por Campanha (7 dias)
                    </h2>
                    <Badge variant="outline" className="text-xs">Métricas Contínuas</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {campaigns.map(c => (
                      <CampaignTrendCard key={c.campaignId} campaign={c} alerts={allAlerts.filter(a => a.campaign_id === c.campaignId)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
