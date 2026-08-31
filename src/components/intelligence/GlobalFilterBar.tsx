import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, X, Building2 } from "lucide-react";
import { PLATFORMS } from "@/data/multiClientData";
import { displayClientName, useClient } from "@/contexts/ClientContext";

export interface FilterState {
  clientId: string;
  platform: string;
  campaignId: string;
  status: string;
}

interface GlobalFilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  campaigns?: { campaignId: string; campaignName: string; clientId: string; platform: string }[];
  showStatus?: boolean;
}

/**
 * Client comes only from the header ClientSwitcher (global context).
 * This bar filters platform / campaign / status within that client.
 */
export function GlobalFilterBar({ filters, onFiltersChange, campaigns = [], showStatus = true }: GlobalFilterBarProps) {
  const { selectedClient, selectedClientId } = useClient();
  const clientId = selectedClientId ?? filters.clientId;

  const filteredPlatforms = useMemo(() => {
    if (!clientId || clientId === "all") {
      const fromCampaigns = [...new Set(campaigns.map((c) => c.platform))];
      return fromCampaigns.length > 0 ? fromCampaigns : PLATFORMS;
    }
    const fromClient = [...new Set(campaigns.filter((c) => c.clientId === clientId).map((c) => c.platform))];
    return fromClient.length > 0 ? fromClient : PLATFORMS;
  }, [clientId, campaigns]);

  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (clientId && clientId !== "all") result = result.filter((c) => c.clientId === clientId);
    if (filters.platform && filters.platform !== "all") result = result.filter((c) => c.platform === filters.platform);
    return result;
  }, [clientId, filters.platform, campaigns]);

  const activeCount = [filters.platform, filters.campaignId, filters.status].filter((v) => v && v !== "all").length;

  const clearFilters = () =>
    onFiltersChange({
      clientId: selectedClientId ?? "all",
      platform: "all",
      campaignId: "all",
      status: "all",
    });

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span className="font-medium">Filtros</span>
        {activeCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {activeCount}
          </Badge>
        )}
      </div>

      <Badge variant="outline" className="h-8 gap-1.5 px-3 font-normal text-xs">
        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
        {selectedClient ? displayClientName(selectedClient) : "Nenhum cliente selecionado"}
      </Badge>

      <Select
        value={filters.platform || "all"}
        onValueChange={(v) => onFiltersChange({ ...filters, clientId: selectedClientId ?? filters.clientId, platform: v, campaignId: "all" })}
      >
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="DSP / Plataforma" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas DSPs</SelectItem>
          {filteredPlatforms.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.campaignId || "all"}
        onValueChange={(v) => onFiltersChange({ ...filters, clientId: selectedClientId ?? filters.clientId, campaignId: v })}
      >
        <SelectTrigger className="w-48 h-8 text-xs">
          <SelectValue placeholder="Campanha" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Campanhas</SelectItem>
          {filteredCampaigns.map((c) => (
            <SelectItem key={c.campaignId} value={c.campaignId}>
              {c.campaignName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showStatus && (
        <Select
          value={filters.status || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, clientId: selectedClientId ?? filters.clientId, status: v })}
        >
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
          </SelectContent>
        </Select>
      )}

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
          <X className="w-3 h-3 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
