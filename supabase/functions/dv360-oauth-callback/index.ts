import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserAgencyContext, oauthAppPath } from "../_shared/tenant.ts";

const DV360_API_VERSION = "v4";

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

// O Supabase força Content-Type: text/plain e uma CSP travada (sandbox) nas respostas
// de Edge Function, então HTML/script inline aqui nunca roda. Por isso sempre redirecionamos
// de volta pro nosso próprio domínio — lá sim (no DataIntegrations.tsx) é que detectamos se
// essa aba é o popup (via window.opener) e fechamos ela com postMessage.
function popupResult(base: string, appPath: string, ok: boolean, code: string): Response {
  try {
    const dest = new URL(
      `${appPath}?${ok ? "connected=dv360" : `dv360_error=${encodeURIComponent(code)}`}`,
      base
    );
    return Response.redirect(dest.toString(), 302);
  } catch {
    return new Response(
      "Sessão de conexão inválida ou expirada. Feche esta aba e clique em \"Conectar\" novamente a partir do MediaHub.",
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let redirectOrigin = "";
  let userId: string | null = null;

  if (state) {
    const { data: stateRow } = await supabase
      .from("oauth_states")
      .select("user_id, redirect_origin")
      .eq("state", state)
      .maybeSingle();

    if (stateRow) {
      userId = stateRow.user_id as string;
      redirectOrigin = stateRow.redirect_origin as string;
      await supabase.from("oauth_states").delete().eq("state", state);
    }
  }

  const base = redirectOrigin;
  const tenant = userId ? await getUserAgencyContext(supabase, userId) : { agencyId: null, onboardingPending: false };
  const appPath = oauthAppPath(tenant.onboardingPending);

  if (oauthError || !code || !userId) {
    return popupResult(base, appPath, false, oauthError || "invalid_state");
  }

  try {
    const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
    const partnerId = Deno.env.get("DV360_PARTNER_ID")!;
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/dv360-oauth-callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Erro ao trocar code por token:", tokenData);
      return popupResult(base, appPath, false, "token_exchange_failed");
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token ?? null;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Lista os anunciantes acessíveis dentro do partner configurado
    const advertisers: { id: string; name: string | null }[] = [];
    let pageToken = "";
    for (let page = 0; page < 10; page++) {
      const listUrl = new URL(`https://displayvideo.googleapis.com/${DV360_API_VERSION}/advertisers`);
      listUrl.searchParams.set("partnerId", partnerId);
      listUrl.searchParams.set("pageSize", "200");
      if (pageToken) listUrl.searchParams.set("pageToken", pageToken);

      const listRes = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const listData = (await listRes.json()) as {
        advertisers?: { advertiserId?: string; displayName?: string }[];
        nextPageToken?: string;
      };
      if (!listRes.ok) break;
      for (const adv of listData.advertisers ?? []) {
        if (adv.advertiserId) advertisers.push({ id: adv.advertiserId, name: adv.displayName ?? null });
      }
      if (!listData.nextPageToken) break;
      pageToken = listData.nextPageToken;
    }

    const rows = advertisers.length > 0
      ? advertisers.map((adv) => ({
          user_id: userId,
          platform: "dv360",
          account_id: adv.id,
          account_name: adv.name,
          manager_customer_id: partnerId,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          scopes: tokenData.scope ?? null,
          status: "active",
          ...(tenant.agencyId ? { agency_id: tenant.agencyId } : {}),
        }))
      : [{
          user_id: userId,
          platform: "dv360",
          account_id: "pending",
          account_name: null,
          manager_customer_id: partnerId,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          scopes: tokenData.scope ?? null,
          status: "active",
          ...(tenant.agencyId ? { agency_id: tenant.agencyId } : {}),
        }];

    // Contas novas entram com is_selected=false (o usuário ainda não escolheu usá-las) —
    // mas contas já existentes não podem ter is_selected/sync_status resetados toda vez
    // que o usuário reautentica, então separamos insert (com esses defaults) de update
    // (só as colunas de token, sem tocar em is_selected/sync_status).
    const { data: existingRows } = await supabase
      .from("platform_connections")
      .select("account_id")
      .eq("user_id", userId)
      .eq("platform", "dv360");
    const existingIds = new Set((existingRows ?? []).map((r: { account_id: string }) => r.account_id));

    const newRows = rows.filter((r) => !existingIds.has(r.account_id)).map((r) => ({
      ...r, is_selected: false, sync_status: "pending",
    }));
    const updateRows = rows.filter((r) => existingIds.has(r.account_id));

    const results: { error: unknown }[] = await Promise.all([
      newRows.length > 0
        ? supabase.from("platform_connections").upsert(newRows, { onConflict: "user_id,platform,account_id" })
        : Promise.resolve({ error: null }),
      updateRows.length > 0
        ? supabase.from("platform_connections").upsert(updateRows, { onConflict: "user_id,platform,account_id" })
        : Promise.resolve({ error: null }),
    ]);
    const upsertError = results.find((r: { error: unknown }) => r.error)?.error;

    if (upsertError) {
      console.error("Erro ao salvar platform_connections:", upsertError);
      return popupResult(base, appPath, false, "save_failed");
    }

    return popupResult(base, appPath, true, "connected");
  } catch (e) {
    console.error("Erro em dv360-oauth-callback:", e);
    return popupResult(base, appPath, false, "internal_error");
  }
});
