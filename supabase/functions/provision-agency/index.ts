import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "agencia";
}

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "Token inválido" }, 401);

  const { data: ops } = await supabase
    .from("agency_members")
    .select("agency_id, agencies!inner(is_platform)")
    .eq("user_id", user.id)
    .eq("agencies.is_platform", true)
    .maybeSingle();

  if (!ops) return json({ error: "Apenas a operação da plataforma pode provisionar agências." }, 403);

  const body = await req.json() as {
    agency_name?: string;
    admin_name?: string;
    admin_email?: string;
    admin_password?: string;
  };

  const agencyName = (body.agency_name ?? "").trim();
  const adminName = (body.admin_name ?? "").trim();
  const adminEmail = (body.admin_email ?? "").trim().toLowerCase();
  if (!agencyName || !adminEmail) {
    return json({ error: "Informe o nome da agência e o e-mail do admin." }, 400);
  }

  let slug = slugify(agencyName);
  const { data: slugHit } = await supabase.from("agencies").select("id").eq("slug", slug).maybeSingle();
  if (slugHit) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;

  const { data: agency, error: agencyErr } = await supabase
    .from("agencies")
    .insert({
      name: agencyName,
      slug,
      onboarding_status: "pending",
      is_platform: false,
      admin_email: adminEmail,
    })
    .select("id, name, slug, onboarding_status, admin_email")
    .single();

  if (agencyErr || !agency) {
    return json({ error: agencyErr?.message ?? "Falha ao criar agência" }, 500);
  }

  const password = (body.admin_password ?? "").trim() || randomPassword();

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: { name: adminName || agencyName },
  });

  if (createErr || !created.user) {
    await supabase.from("agencies").delete().eq("id", agency.id);
    const msg = createErr?.message ?? "Falha ao criar usuário";
    const status = /already|registered|exists/i.test(msg) ? 409 : 500;
    return json({ error: status === 409 ? "Este e-mail já tem conta no MediaHub." : msg }, status);
  }

  const { error: memberErr } = await supabase.from("agency_members").insert({
    agency_id: agency.id,
    user_id: created.user.id,
    role: "admin",
  });

  if (memberErr) {
    await supabase.auth.admin.deleteUser(created.user.id);
    await supabase.from("agencies").delete().eq("id", agency.id);
    return json({ error: memberErr.message }, 500);
  }

  return json({
    ok: true,
    agency,
    admin: {
      user_id: created.user.id,
      email: adminEmail,
      name: adminName || agencyName,
      temporary_password: password,
    },
  });
});
