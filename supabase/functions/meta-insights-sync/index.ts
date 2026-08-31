import { createClient } from "jsr:@supabase/supabase-js@2";
import { classifySyncError, updateSyncStatus } from "../_shared/syncStatus.ts";
import { resolveUserId } from "../_shared/internalAuth.ts";
import { classifyMetaObjective } from "../_shared/funnelRole.ts";

const GRAPH_URL = "https://graph.facebook.com/v25.0";
const ATTR_WINDOWS = encodeURIComponent(JSON.stringify(["1d_click", "7d_click", "1d_view", "7d_view"]));

type ActionRow = { action_type: string; value?: string } & Record<string, string>;

function safeNum(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : n;
}

/** Somente eventos de venda (purchase). Leads / registro / cliques NÃO contam. */
const PURCHASE_ACTION_TYPES = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
  "web_in_store_purchase",
];

function isPurchaseAction(actionType: string): boolean {
  const t = (actionType ?? "").toLowerCase();
  return PURCHASE_ACTION_TYPES.some((p) => t === p || t.endsWith(`.${p}`) || t.includes("purchase"));
}

function extractPurchaseConversions(actions: ActionRow[] = []): number {
  return actions.filter((a) => isPurchaseAction(a.action_type)).reduce((s, a) => s + safeNum(a.value), 0);
}

function extractPurchaseConvWindow(actions: ActionRow[] = [], win: string): number {
  return actions.filter((a) => isPurchaseAction(a.action_type)).reduce((s, a) => s + safeNum(a[win] ?? "0"), 0);
}

function extractRevenue(actionValues: ActionRow[] = []): number {
  return actionValues.filter((a) => isPurchaseAction(a.action_type)).reduce((s, a) => s + safeNum(a.value), 0);
}

// Meta só aceita presets fixos (não um N arbitrário de dias) — mapeia pro preset mais próximo.
function daysToPreset(days: number): string {
  if (days <= 7) return "last_7d";
  if (days <= 30) return "last_30d";
  return "last_90d";
}

type Agg = {
  investimento: number; alcance: number; frequencia: number; impressoes: number;
  conversoes: number; receita: number; count: number;
  c1dc: number; c7dc: number; c1dv: number; c7dv: number;
  ctr: number; cpm: number; cpc: number; uniqueClicks: number; uniqueCtr: number;
};
const newAgg = (): Agg => ({ investimento: 0, alcance: 0, frequencia: 0, impressoes: 0, conversoes: 0, receita: 0, count: 0, c1dc: 0, c7dc: 0, c1dv: 0, c7dv: 0, ctr: 0, cpm: 0, cpc: 0, uniqueClicks: 0, uniqueCtr: 0 });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json() as { account_ids: string[]; range_days?: number; _internal_user_id?: string };
    const auth = await resolveUserId(req, supabase, body);
    if ("errorResponse" in auth) return auth.errorResponse;
    const { userId } = auth;

    const { account_ids } = body;
    if (!account_ids?.length) return Response.json({ error: "Nenhuma conta selecionada" }, { status: 400 });

    const preset = daysToPreset(body.range_days ?? 90);

    const { data: connections } = await supabase
      .from("platform_connections")
      .select("account_id, account_name, access_token")
      .eq("user_id", userId)
      .eq("platform", "meta_ads")
      .eq("is_selected", true)
      .in("account_id", account_ids);

    if (!connections?.length) return Response.json({ error: "Conexões não encontradas" }, { status: 404 });

    const results: { account_id: string; days: number; campaigns: number; error?: string }[] = [];
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (const conn of connections) {
      try {
        const fetchInsights = async (
          datePreset: string,
          level: "account" | "campaign"
        ): Promise<{ rows: Record<string, unknown>[] | null; apiError?: string }> => {
          const baseFields = "spend,reach,frequency,impressions,ctr,cpm,cpc,unique_clicks,unique_ctr,actions,action_values";
          const fields = level === "campaign" ? `campaign_id,campaign_name,objective,${baseFields}` : baseFields;
          const url = `${GRAPH_URL}/${conn.account_id}/insights?fields=${fields}&level=${level}&date_preset=${datePreset}&time_increment=1&limit=1000&action_attribution_windows=${ATTR_WINDOWS}&access_token=${conn.access_token}`;
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 25000);
          try {
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(tid);
            const json = await resp.json() as { data?: Record<string, unknown>[]; error?: { message: string; code?: number } };
            if (json.error) return { rows: null, apiError: `[${json.error.code}] ${json.error.message}` };
            return { rows: json.data ?? [] };
          } catch (e) {
            clearTimeout(tid);
            return { rows: null, apiError: `Timeout/rede: ${String(e)}` };
          }
        };

        // ── Account-level ──
        let { rows, apiError } = await fetchInsights(preset, "account");
        if (apiError) {
          results.push({ account_id: conn.account_id, days: 0, campaigns: 0, error: apiError });
          await updateSyncStatus(supabase, userId, "meta_ads", conn.account_id, classifySyncError(apiError), apiError);
          await sleep(800); continue;
        }
        if (rows!.length === 0) {
          await sleep(500);
          const fb = await fetchInsights("last_year", "account");
          if (fb.rows !== null) rows = fb.rows;
        }
        if (!rows || rows.length === 0) {
          const msg = "Sem dados (testado: 90d e last_year). A conta pode estar inativa.";
          results.push({ account_id: conn.account_id, days: 0, campaigns: 0, error: msg });
          await updateSyncStatus(supabase, userId, "meta_ads", conn.account_id, "ready", null);
          await sleep(800);
          continue;
        }

        const byDateStage: Record<string, Agg> = {};

        for (const row of rows) {
          const date = String(row.date_start ?? "").slice(0, 10);
          const actions = (row.actions as ActionRow[]) ?? [];
          const conversoes = extractPurchaseConversions(actions);
          const receita = extractRevenue((row.action_values as ActionRow[]) ?? []);
          const c1dc = extractPurchaseConvWindow(actions, "1d_click");
          const c7dc = extractPurchaseConvWindow(actions, "7d_click");
          const c1dv = extractPurchaseConvWindow(actions, "1d_view");
          const c7dv = extractPurchaseConvWindow(actions, "7d_view");

          const tk = `${date}__topo`;
          if (!byDateStage[tk]) byDateStage[tk] = newAgg();
          const t = byDateStage[tk];
          t.investimento += safeNum(row.spend);
          t.alcance += safeNum(row.reach);
          t.frequencia += safeNum(row.frequency);
          t.impressoes += safeNum(row.impressions);
          t.ctr += safeNum(row.ctr);
          t.cpm += safeNum(row.cpm);
          t.cpc += safeNum(row.cpc);
          t.uniqueClicks += safeNum(row.unique_clicks);
          t.uniqueCtr += safeNum(row.unique_ctr);
          t.count++;

          if (conversoes > 0 || receita > 0) {
            const fk = `${date}__fundo`;
            if (!byDateStage[fk]) byDateStage[fk] = newAgg();
            const f = byDateStage[fk];
            f.conversoes += conversoes; f.receita += receita;
            f.c1dc += c1dc; f.c7dc += c7dc; f.c1dv += c1dv; f.c7dv += c7dv;
            f.count++;
          }
        }

        const accountRows = Object.entries(byDateStage).map(([key, g]) => {
          const [date, stage] = key.split("__");
          return {
            user_id: userId, platform: "meta_ads", account_id: conn.account_id, account_name: conn.account_name,
            campaign_id: "", campaign_name: null, objective: null,
            date, funnel_stage: stage,
            investimento: g.investimento,
            alcance: Math.round(g.alcance / (g.count || 1)),
            frequencia: g.frequencia / (g.count || 1),
            impressoes: Math.round(g.impressoes / (g.count || 1)),
            conversoes: g.conversoes, receita: g.receita,
            conv_1d_click: g.c1dc, conv_7d_click: g.c7dc, conv_1d_view: g.c1dv, conv_7d_view: g.c7dv,
            ctr: g.ctr / (g.count || 1), cpm: g.cpm / (g.count || 1), cpc: g.cpc / (g.count || 1),
            unique_clicks: g.uniqueClicks, unique_ctr: g.uniqueCtr / (g.count || 1),
            synced_at: new Date().toISOString(),
          };
        });

        let accountDays = 0;
        if (accountRows.length > 0) {
          await supabase.from("funnel_daily_records").upsert(accountRows, { onConflict: "user_id,platform,account_id,campaign_id,date,funnel_stage" });
          accountDays = accountRows.length;
        }

        await sleep(600);

        // ── Campaign-level ──
        let campaignRows_count = 0;
        const { rows: campRows, apiError: campErr } = await fetchInsights(preset, "campaign");
        if (!campErr && campRows && campRows.length > 0) {
          type CampAgg = Agg & { campaign_id: string; campaign_name: string; objective: string };
          const byCampDateStage: Record<string, CampAgg> = {};

          for (const row of campRows) {
            const date = String(row.date_start ?? "").slice(0, 10);
            const campId = String(row.campaign_id ?? "");
            const campName = String(row.campaign_name ?? "");
            const objective = String(row.objective ?? "");
            const stage = classifyMetaObjective(objective);
            const actions = (row.actions as ActionRow[]) ?? [];
            const conversoes = extractPurchaseConversions(actions);
            const receita = extractRevenue((row.action_values as ActionRow[]) ?? []);
            const c1dc = extractPurchaseConvWindow(actions, "1d_click"); const c7dc = extractPurchaseConvWindow(actions, "7d_click");
            const c1dv = extractPurchaseConvWindow(actions, "1d_view");  const c7dv = extractPurchaseConvWindow(actions, "7d_view");

            const key = `${campId}__${date}__${stage}`;
            if (!byCampDateStage[key]) byCampDateStage[key] = { campaign_id: campId, campaign_name: campName, objective, ...newAgg() };
            const g = byCampDateStage[key];
            g.investimento += safeNum(row.spend); g.alcance += safeNum(row.reach);
            g.frequencia += safeNum(row.frequency); g.impressoes += safeNum(row.impressions);
            g.conversoes += conversoes; g.receita += receita;
            g.c1dc += c1dc; g.c7dc += c7dc; g.c1dv += c1dv; g.c7dv += c7dv;
            g.ctr += safeNum(row.ctr); g.cpm += safeNum(row.cpm); g.cpc += safeNum(row.cpc);
            g.uniqueClicks += safeNum(row.unique_clicks); g.uniqueCtr += safeNum(row.unique_ctr);
            g.count++;
          }

          const campUpsertRows = Object.entries(byCampDateStage).map(([key, g]) => {
            const [campId, date, stage] = key.split("__");
            return {
              user_id: userId, platform: "meta_ads", account_id: conn.account_id, account_name: conn.account_name,
              campaign_id: campId, campaign_name: g.campaign_name, objective: g.objective,
              date, funnel_stage: stage,
              investimento: g.investimento,
              alcance: Math.round(g.alcance / (g.count || 1)),
              frequencia: g.frequencia / (g.count || 1),
              impressoes: Math.round(g.impressoes / (g.count || 1)),
              conversoes: g.conversoes, receita: g.receita,
              conv_1d_click: g.c1dc, conv_7d_click: g.c7dc, conv_1d_view: g.c1dv, conv_7d_view: g.c7dv,
              ctr: g.ctr / (g.count || 1), cpm: g.cpm / (g.count || 1), cpc: g.cpc / (g.count || 1),
              unique_clicks: g.uniqueClicks, unique_ctr: g.uniqueCtr / (g.count || 1),
              synced_at: new Date().toISOString(),
            };
          });

          if (campUpsertRows.length > 0) {
            await supabase.from("funnel_daily_records").upsert(campUpsertRows, { onConflict: "user_id,platform,account_id,campaign_id,date,funnel_stage" });
            campaignRows_count = campUpsertRows.length;
          }
        }

        results.push({ account_id: conn.account_id, days: accountDays, campaigns: campaignRows_count });
        await updateSyncStatus(supabase, userId, "meta_ads", conn.account_id, "ready", null);
      } catch (e) {
        const msg = String(e);
        results.push({ account_id: conn.account_id, days: 0, campaigns: 0, error: msg });
        await updateSyncStatus(supabase, userId, "meta_ads", conn.account_id, classifySyncError(msg), msg);
      }
      await sleep(800);
    }

    return Response.json({ ok: true, results }, { headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
});
