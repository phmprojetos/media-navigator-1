import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserAgencyContext, oauthAppPath } from "../_shared/tenant.ts";

const GOOGLE_ADS_API_VERSION = "v22";

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
      `${appPath}?${ok ? "connected=google_ads" : `google_error=${encodeURIComponent(code)}`}`,
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
    const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;

    // Troca o code por access_token + refresh_token
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

    // Lista as contas Google Ads que esse usuário pode acessar
    const listRes = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
        },
      }
    );
    const listData = (await listRes.json()) as { resourceNames?: string[] };
    const customerIds = (listData.resourceNames ?? []).map((rn) => rn.replace("customers/", ""));

    const gaqlSearch = async (customerId: string, loginCustomerId: string, query: string) => {
      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": developerToken,
            "login-customer-id": loginCustomerId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        }
      );
      const data = await res.json();
      return (data?.results ?? []) as Record<string, unknown>[];
    };

    // Contas gerenciadoras (MCC) não têm métricas próprias — expandimos pras contas-cliente
    // reais de baixo dela, guardando por qual MCC foram acessadas (necessário depois no header
    // "login-customer-id" ao puxar métricas de campanha).
    const accountGroups = await Promise.all(
      customerIds.map(async (customerId) => {
        try {
          const infoRows = await gaqlSearch(customerId, customerId, "SELECT customer.descriptive_name, customer.manager FROM customer LIMIT 1");
          const customer = infoRows[0]?.customer as { descriptiveName?: string; manager?: boolean } | undefined;
          if (!customer?.manager) {
            return [{ id: customerId, name: customer?.descriptiveName ?? null, managerCustomerId: null as string | null }];
          }
          const clientRows = await gaqlSearch(
            customerId, customerId,
            "SELECT customer_client.client_customer, customer_client.descriptive_name FROM customer_client WHERE customer_client.manager = FALSE AND customer_client.level <= 1"
          );
          return clientRows
            .map((r) => {
              const cc = r.customerClient as { clientCustomer?: string; descriptiveName?: string } | undefined;
              const id = (cc?.clientCustomer ?? "").replace("customers/", "");
              return { id, name: cc?.descriptiveName ?? null, managerCustomerId: customerId };
            })
            .filter((c) => c.id);
        } catch {
          return [{ id: customerId, name: null, managerCustomerId: null as string | null }];
        }
      })
    );
    const accounts = accountGroups.flat();

    const rows = accounts.length > 0
      ? accounts.map((acc) => ({
          user_id: userId,
          platform: "google_ads",
          account_id: acc.id,
          account_name: acc.name,
          manager_customer_id: acc.managerCustomerId,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          scopes: tokenData.scope ?? null,
          status: "active",
          ...(tenant.agencyId ? { agency_id: tenant.agencyId } : {}),
        }))
      : [{
          user_id: userId,
          platform: "google_ads",
          account_id: "pending",
          account_name: null,
          manager_customer_id: null,
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
      .eq("platform", "google_ads");
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
    console.error("Erro em google-oauth-callback:", e);
    return popupResult(base, appPath, false, "internal_error");
  }
});
