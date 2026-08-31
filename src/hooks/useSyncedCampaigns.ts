import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { displayClientName, useClient } from "@/contexts/ClientContext";
import { useAgency } from "@/hooks/useAgency";
import type { CampaignWithClient } from "@/data/multiClientData";
import type { FilterState } from "@/components/intelligence/GlobalFilterBar";
import {
  mapFunnelRowsToCampaigns,
  type AccountClient,
  type FunnelCampaignRow,
} from "@/lib/funnelToCampaigns";

export function applyCampaignFilters(
  campaigns: CampaignWithClient[],
  filters: FilterState,
  opts?: { activeOnly?: boolean }
): CampaignWithClient[] {
  let result = campaigns;
  if (opts?.activeOnly) result = result.filter((c) => c.status === "active");
  if (filters.clientId !== "all") result = result.filter((c) => c.clientId === filters.clientId);
  if (filters.platform !== "all") result = result.filter((c) => c.platform === filters.platform);
  if (filters.campaignId !== "all") result = result.filter((c) => c.campaignId === filters.campaignId);
  if (filters.status !== "all") result = result.filter((c) => c.status === filters.status);
  return result;
}

/**
 * Campanhas reais a partir de contas vinculadas + funnel_daily_records.
 * Escopo: cliente do header (ou todas as contas vinculadas da agência).
 */
export function useSyncedCampaigns() {
  const { selectedClientId, clients, loading: clientsLoading } = useClient();
  const { agencyId } = useAgency();
  const [campaigns, setCampaigns] = useState<CampaignWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientsLoading) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabase.from as any)("platform_connections")
          .select("platform, account_id, client_id, status")
          .not("client_id", "is", null)
          .eq("status", "active");

        if (agencyId) query = query.eq("agency_id", agencyId);
        if (selectedClientId) query = query.eq("client_id", selectedClientId);

        const { data: connections, error: connErr } = await query;
        if (connErr) throw connErr;

        const clientById = new Map(clients.map((c) => [c.id, c]));
        const accountToClient = new Map<string, AccountClient>();
        const accountIds: string[] = [];
        const accountKeys = new Set<string>();

        for (const row of (connections ?? []) as {
          platform: string;
          account_id: string;
          client_id: string;
        }[]) {
          const client = clientById.get(row.client_id);
          if (!client) continue;
          const key = `${row.platform}__${row.account_id}`;
          if (accountKeys.has(key)) continue;
          accountKeys.add(key);
          accountIds.push(row.account_id);
          accountToClient.set(key, { id: client.id, name: displayClientName(client) });
        }

        if (accountIds.length === 0) {
          if (!cancelled) {
            setCampaigns([]);
            setLoading(false);
          }
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows, error: rowsErr } = await (supabase.from as any)("funnel_daily_records")
          .select("platform, account_id, campaign_id, campaign_name, date, funnel_stage, investimento, impressoes, conversoes")
          .in("account_id", accountIds)
          .order("date", { ascending: true })
          .limit(30000);

        if (rowsErr) throw rowsErr;

        const filtered = ((rows ?? []) as FunnelCampaignRow[]).filter((r) =>
          accountKeys.has(`${r.platform}__${r.account_id}`)
        );

        if (!cancelled) {
          setCampaigns(mapFunnelRowsToCampaigns(filtered, accountToClient));
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setCampaigns([]);
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agencyId, selectedClientId, clients, clientsLoading]);

  return { campaigns, loading, error };
}
