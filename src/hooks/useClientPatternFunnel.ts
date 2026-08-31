import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FunnelDailyRecord } from "@/types/funnelImpact";
import {
  buildClientFunnelFromCampaignRows,
  type ClassifiedCampaignSummary,
  type FunnelMetricRow,
} from "@/lib/funnelRole";

export type ClientPatternState = {
  loading: boolean;
  series: FunnelDailyRecord[];
  campaigns: ClassifiedCampaignSummary[];
  linkedAccounts: { platform: string; account_id: string; account_name: string | null }[];
  lastSync: string | null;
  attributionSummary: {
    conv1dClick: number;
    conv7dClick: number;
    conv1dView: number;
    conv7dView: number;
    viewThroughPct: number;
    cycleLengthRatio: number;
  } | null;
  clickEfficiency: {
    avgCtr: number;
    avgCpm: number;
    avgCpc: number;
    totalUniqueClicks: number;
    avgUniqueCtr: number;
  } | null;
  isClickProxy: boolean;
  error: string | null;
};

const empty: ClientPatternState = {
  loading: false,
  series: [],
  campaigns: [],
  linkedAccounts: [],
  lastSync: null,
  attributionSummary: null,
  clickEfficiency: null,
  isClickProxy: false,
  error: null,
};

/**
 * Carrega funil do cliente: todas as contas vinculadas (qualquer plataforma)
 * e agrega via Funnel Role Engine.
 */
export function useClientPatternFunnel(clientId: string | null): ClientPatternState {
  const [state, setState] = useState<ClientPatternState>({ ...empty, loading: !!clientId });

  useEffect(() => {
    if (!clientId) {
      setState({ ...empty });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: connections, error: connErr } = await (supabase.from as any)("platform_connections")
          .select("platform, account_id, account_name, status")
          .eq("client_id", clientId)
          .neq("status", "revoked");

        if (connErr) throw connErr;

        const accounts = (connections ?? []) as {
          platform: string;
          account_id: string;
          account_name: string | null;
        }[];

        // Dedup por platform+account
        const seen = new Set<string>();
        const linkedAccounts = accounts.filter((a) => {
          const k = `${a.platform}__${a.account_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        if (linkedAccounts.length === 0) {
          if (!cancelled) {
            setState({
              ...empty,
              loading: false,
              error: "Nenhuma conta vinculada a este cliente. Vincule em Dados & Integrações.",
            });
          }
          return;
        }

        const accountIds = linkedAccounts.map((a) => a.account_id);
        const accountKeys = new Set(linkedAccounts.map((a) => `${a.platform}__${a.account_id}`));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows, error: rowsErr } = await (supabase.from as any)("funnel_daily_records")
          .select(
            "platform, account_id, account_name, campaign_id, campaign_name, objective, date, funnel_stage, investimento, alcance, frequencia, impressoes, conversoes, receita, synced_at, conv_1d_click, conv_7d_click, conv_1d_view, conv_7d_view, ctr, cpm, cpc, unique_clicks, unique_ctr"
          )
          .in("account_id", accountIds)
          .order("date", { ascending: true })
          .limit(30000);

        if (rowsErr) throw rowsErr;

        const allRows = ((rows ?? []) as (FunnelMetricRow & { account_name?: string | null })[]).filter((r) =>
          accountKeys.has(`${r.platform}__${r.account_id}`)
        );

        const campaignRows = allRows.filter((r) => r.campaign_id && r.campaign_id !== "");
        const accountsWithCampaigns = new Set(
          campaignRows.map((r) => `${r.platform}__${r.account_id}`)
        );

        // Fallback: contas só com agregado (ex.: Meta sem campaign_id) → linhas sintéticas por estágio
        const accountLevel = allRows.filter(
          (r) =>
            (!r.campaign_id || r.campaign_id === "") &&
            !accountsWithCampaigns.has(`${r.platform}__${r.account_id}`)
        );

        const synthetic: FunnelMetricRow[] = accountLevel.map((r) => {
          const stage = r.funnel_stage === "meio" ? "meio" : r.funnel_stage === "fundo" ? "fundo" : "topo";
          const objective =
            stage === "topo"
              ? "OUTCOME_AWARENESS"
              : stage === "meio"
                ? "OUTCOME_TRAFFIC"
                : "OUTCOME_SALES";
          return {
            ...r,
            campaign_id: `__account__${r.account_id}__${stage}`,
            campaign_name: `${r.account_name || r.account_id} (agregado conta · ${stage})`,
            objective,
          };
        });

        const filtered = [...campaignRows, ...synthetic];
        const built = buildClientFunnelFromCampaignRows(filtered);
        const totalReceita = built.series.reduce((s, r) => s + r.receitaFundo, 0);
        const totalConv = built.series.reduce((s, r) => s + r.conversoesFundo, 0);
        const attrTotal = built.attribution.conv7dClick + built.attribution.conv7dView;

        if (!cancelled) {
          setState({
            loading: false,
            series: built.series,
            campaigns: built.campaigns,
            linkedAccounts,
            lastSync: built.lastSync,
            attributionSummary:
              attrTotal > 0
                ? {
                    ...built.attribution,
                    viewThroughPct: (built.attribution.conv7dView / attrTotal) * 100,
                    cycleLengthRatio:
                      built.attribution.conv7dClick > 0
                        ? built.attribution.conv1dClick / built.attribution.conv7dClick
                        : 0,
                  }
                : null,
            clickEfficiency: built.clickEfficiency,
            isClickProxy: totalConv > 0 && totalReceita === 0,
            error:
              built.series.length === 0
                ? "Contas vinculadas sem campanhas sincronizadas. Sincronize Meta, Google ou DV360."
                : null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            ...empty,
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return state;
}
