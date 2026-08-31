import { useCallback, useEffect, useState } from "react";
import { type FilterState } from "@/components/intelligence/GlobalFilterBar";
import { useClient } from "@/contexts/ClientContext";

const EMPTY_FILTERS: FilterState = {
  clientId: "all",
  platform: "all",
  campaignId: "all",
  status: "all",
};

/**
 * Filter state always locked to the globally selected client (header switcher).
 * Changing platform/campaign/status does not change the client.
 */
export function useIntelligenceFilters() {
  const { selectedClientId } = useClient();
  const [filters, setFiltersState] = useState<FilterState>(() => ({
    ...EMPTY_FILTERS,
    clientId: selectedClientId ?? "all",
  }));

  useEffect(() => {
    setFiltersState((prev) => {
      const nextClientId = selectedClientId ?? "all";
      if (prev.clientId === nextClientId) return prev;
      return { ...prev, clientId: nextClientId, campaignId: "all" };
    });
  }, [selectedClientId]);

  const setFilters = useCallback(
    (next: FilterState) => {
      setFiltersState({
        ...next,
        clientId: selectedClientId ?? "all",
      });
    },
    [selectedClientId]
  );

  return { filters, setFilters };
}
