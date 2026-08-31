import { createClient } from "jsr:@supabase/supabase-js@2";
import { classifySyncError, updateSyncStatus } from "../_shared/syncStatus.ts";
import { resolveUserId } from "../_shared/internalAuth.ts";
import { classifyGoogleChannel } from "../_shared/funnelRole.ts";

const GOOGLE_ADS_API_VERSION = "v22";
const MICROS = 1_000_000;

function safeNum(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : n;
}

type GaqlRow = Record<string, unknown>;

type Agg = {
  investimento: number; alcance: number; impressoes: number;
  conversoes: number; receita: number; count: number;
  ctr: number; cpm: number; cpc: number;
};
const newAgg = (): Agg => ({ investimento: 0, alcance: 0, impressoes: 0, conversoes: 0, receita: 0, count: 0, ctr: 0, cpm: 0, cpc: 0 });

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Falha ao renovar token");
  }
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString() };
}

async function fetchCampaignMetrics(targetCustomerId: string, loginCustomerId: string, accessToken: string, developerToken: string, daysBack: number): Promise<GaqlRow[]> {
  // GAQL "DURING" só aceita literais fixas (LAST_30_DAYS etc.) — não existe LAST_90_DAYS, por isso usamos BETWEEN com datas explícitas.
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const query = `
    SELECT campaign.id, campaign.name, campaign.advertising_channel_type, segments.date,
           metrics.cost_micros, metrics.impressions, metrics.clicks,
           metrics.conversions, metrics.conversions_value, metrics.ctr,
           metrics.average_cpm, metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
  `;

  const rows: GaqlRow[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${targetCustomerId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "login-customer-id": loginCustomerId,
          "Content-Type": "application/json",
        },
        // O endpoint googleAds:search não aceita pageSize customizado — paginação vem em tamanho fixo do lado do Google.
        body: JSON.stringify({ query, pageToken }),
      }
    );
    const json = await res.json() as { results?: GaqlRow[]; nextPageToken?: string; error?: { message?: string; details?: unknown } };
    if (!res.ok) {
      console.error("Erro Google Ads API:", res.status, JSON.stringify(json.error));
      throw new Error(`[${res.status}] ${json.error?.message || "erro desconhecido"} ${JSON.stringify(json.error?.details ?? "")}`);
    }
    rows.push(...(json.results ?? []));
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return rows;
}

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

    const rangeDays = body.range_days ?? 90;

    const { data: connections } = await supabase
      .from("platform_connections")
      .select("account_id, account_name, manager_customer_id, access_token, refresh_token, token_expires_at")
      .eq("user_id", userId)
      .eq("platform", "google_ads")
      .eq("is_selected", true)
      .in("account_id", account_ids);

    if (!connections?.length) return Response.json({ error: "Conexões não encontradas" }, { status: 404 });

    const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
    const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;

    const results: { account_id: string; days: number; campaigns: number; error?: string }[] = [];
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (const conn of connections) {
      try {
        if (!conn.refresh_token) {
          const msg = "Sem refresh token — reconecte a conta.";
          results.push({ account_id: conn.account_id, days: 0, campaigns: 0, error: msg });
          await updateSyncStatus(supabase, userId, "google_ads", conn.account_id, "auth_error", msg);
          continue;
        }

        // Google Ads access tokens expiram em ~1h — renova se estiver vencido ou perto disso.
        let accessToken = conn.access_token;
        const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
        if (!accessToken || expiresAt < Date.now() + 60_000) {
          const refreshed = await refreshAccessToken(conn.refresh_token, clientId, clientSecret);
          accessToken = refreshed.accessToken;
          await supabase
            .from("platform_connections")
            .update({ access_token: refreshed.accessToken, token_expires_at: refreshed.expiresAt })
            .eq("user_id", userId).eq("platform", "google_ads").eq("account_id", conn.account_id);
        }

        // Contas descobertas via MCC guardam por qual gerenciadora foram acessadas — o Google exige
        // esse id no header "login-customer-id" pra autorizar o acesso via hierarquia.
        const loginId = conn.manager_customer_id ?? conn.account_id;
        const rows = await fetchCampaignMetrics(conn.account_id, loginId, accessToken!, developerToken, rangeDays);

        if (rows.length === 0) {
          results.push({ account_id: conn.account_id, days: 0, campaigns: 0, error: "Sem dados nos últimos 90 dias." });
          await updateSyncStatus(supabase, userId, "google_ads", conn.account_id, "ready", null);
          await sleep(400);
          continue;
        }

        // ── Account-level (agrega todas as campanhas por dia) ──
        const byDateStage: Record<string, Agg> = {};
        // ── Campaign-level (por campanha + dia, estágio pelo tipo de canal) ──
        type CampAgg = Agg & { campaign_id: string; campaign_name: string; channelType: string };
        const byCampDateStage: Record<string, CampAgg> = {};

        for (const row of rows) {
          const campaign = row.campaign as { id?: string; name?: string; advertisingChannelType?: string } | undefined;
          const segments = row.segments as { date?: string } | undefined;
          const metrics = row.metrics as {
            costMicros?: string; impressions?: string; conversions?: number;
            conversionsValue?: number; ctr?: number; averageCpm?: string; averageCpc?: string;
          } | undefined;

          const date = segments?.date ?? "";
          if (!date) continue;
          const campId = campaign?.id ?? "";
          const campName = campaign?.name ?? "";
          const channelType = campaign?.advertisingChannelType ?? "";
          const stage = classifyGoogleChannel(channelType);

          const cost = safeNum(metrics?.costMicros) / MICROS;
          const impressions = safeNum(metrics?.impressions);
          const conversions = safeNum(metrics?.conversions);
          const revenue = safeNum(metrics?.conversionsValue);
          const ctr = safeNum(metrics?.ctr) * 100;
          const cpm = safeNum(metrics?.averageCpm) / MICROS;
          const cpc = safeNum(metrics?.averageCpc) / MICROS;

          // Topo (pressão de topo = todo o investimento/impressões do dia)
          const tk = `${date}__topo`;
          if (!byDateStage[tk]) byDateStage[tk] = newAgg();
          const t = byDateStage[tk];
          t.investimento += cost; t.alcance += impressions; t.impressoes += impressions;
          t.ctr += ctr; t.cpm += cpm; t.cpc += cpc; t.count++;

          if (conversions > 0 || revenue > 0) {
            const fk = `${date}__fundo`;
            if (!byDateStage[fk]) byDateStage[fk] = newAgg();
            const f = byDateStage[fk];
            f.conversoes += conversions; f.receita += revenue; f.count++;
          }

          const ck = `${campId}__${date}__${stage}`;
          if (!byCampDateStage[ck]) byCampDateStage[ck] = { campaign_id: campId, campaign_name: campName, channelType, ...newAgg() };
          const c = byCampDateStage[ck];
          c.investimento += cost; c.alcance += impressions; c.impressoes += impressions;
          c.conversoes += conversions; c.receita += revenue;
          c.ctr += ctr; c.cpm += cpm; c.cpc += cpc; c.count++;
        }

        const accountRows = Object.entries(byDateStage).map(([key, g]) => {
          const [date, stage] = key.split("__");
          return {
            user_id: userId, platform: "google_ads", account_id: conn.account_id, account_name: conn.account_name,
            campaign_id: "", campaign_name: null, objective: null,
            date, funnel_stage: stage,
            investimento: g.investimento,
            // Google Ads não expõe "alcance" (reach) por dia no relatório de campanha — usamos impressões como proxy.
            alcance: Math.round(g.alcance / (g.count || 1)),
            frequencia: 0,
            impressoes: Math.round(g.impressoes / (g.count || 1)),
            conversoes: g.conversoes, receita: g.receita,
            conv_1d_click: 0, conv_7d_click: 0, conv_1d_view: 0, conv_7d_view: 0,
            ctr: g.ctr / (g.count || 1), cpm: g.cpm / (g.count || 1), cpc: g.cpc / (g.count || 1),
            unique_clicks: 0, unique_ctr: 0,
            synced_at: new Date().toISOString(),
          };
        });

        const campUpsertRows = Object.entries(byCampDateStage).map(([key, g]) => {
          const [campId, date, stage] = key.split("__");
          return {
            user_id: userId, platform: "google_ads", account_id: conn.account_id, account_name: conn.account_name,
            campaign_id: campId, campaign_name: g.campaign_name, objective: g.channelType,
            date, funnel_stage: stage,
            investimento: g.investimento,
            alcance: Math.round(g.alcance / (g.count || 1)),
            frequencia: 0,
            impressoes: Math.round(g.impressoes / (g.count || 1)),
            conversoes: g.conversoes, receita: g.receita,
            conv_1d_click: 0, conv_7d_click: 0, conv_1d_view: 0, conv_7d_view: 0,
            ctr: g.ctr / (g.count || 1), cpm: g.cpm / (g.count || 1), cpc: g.cpc / (g.count || 1),
            unique_clicks: 0, unique_ctr: 0,
            synced_at: new Date().toISOString(),
          };
        });

        if (accountRows.length > 0) {
          await supabase.from("funnel_daily_records").upsert(accountRows, { onConflict: "user_id,platform,account_id,campaign_id,date,funnel_stage" });
        }
        if (campUpsertRows.length > 0) {
          await supabase.from("funnel_daily_records").upsert(campUpsertRows, { onConflict: "user_id,platform,account_id,campaign_id,date,funnel_stage" });
        }

        results.push({ account_id: conn.account_id, days: accountRows.length, campaigns: campUpsertRows.length });
        await updateSyncStatus(supabase, userId, "google_ads", conn.account_id, "ready", null);
      } catch (e) {
        const msg = String(e);
        results.push({ account_id: conn.account_id, days: 0, campaigns: 0, error: msg });
        await updateSyncStatus(supabase, userId, "google_ads", conn.account_id, classifySyncError(msg), msg);
      }
      await sleep(400);
    }

    return Response.json({ ok: true, results }, { headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
});
