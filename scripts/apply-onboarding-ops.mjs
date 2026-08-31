/**
 * Aplica onboarding/ops no projeto remoto e verifica o schema.
 * Tenta pg-meta e, se houver senha do banco, psql no pooler.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

async function tryPgMeta(url, serviceKey, sql) {
  const endpoints = [
    `${url}/pg/query`,
    `${url}/pg-meta/default/query`,
    `${url.replace(/\/$/, "")}/pg/query`,
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      const text = await res.text();
      console.log("pg-meta", endpoint.replace(url, ""), res.status, text.slice(0, 180));
      if (res.ok) return true;
    } catch (e) {
      console.log("pg-meta fail", e.message);
    }
  }
  return false;
}

function tryPsql(env, sqlPath) {
  const dbUrl = env.DATABASE_URL || env.SUPABASE_DB_URL;
  if (dbUrl) {
    const r = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log("psql DATABASE_URL", r.status, (r.stderr || r.stdout || "").slice(0, 200));
    return r.status === 0;
  }

  const password = env.SUPABASE_DB_PASSWORD || env.POSTGRES_PASSWORD;
  if (!password) {
    console.log("psql skip: no DATABASE_URL / SUPABASE_DB_PASSWORD");
    return false;
  }

  const pooler =
    fs.existsSync(path.join(root, "supabase/.temp/pooler-url"))
      ? fs.readFileSync(path.join(root, "supabase/.temp/pooler-url"), "utf8").trim()
      : "";
  const parsed = pooler.match(/^postgresql:\/\/([^@]+)@([^:/]+):(\d+)\/(.+)$/);
  const user = parsed?.[1] || "postgres.skcmfxxkxcavyifrxajz";
  const host = parsed?.[2] || "aws-1-us-east-2.pooler.supabase.com";
  const port = parsed?.[3] || "5432";
  const db = parsed?.[4] || "postgres";

  const r = spawnSync(
    "psql",
    ["-h", host, "-p", port, "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1", "-f", sqlPath],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: password, PGSSLMODE: "require" },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const err = (r.stderr || r.stdout || "").replace(password, "***").slice(0, 240);
  console.log("psql pooler", r.status, err);
  return r.status === 0;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing URL or SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sqlPath = path.join(root, "supabase/migrations/20260817180000_agency_onboarding_ops.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  let applied = await tryPgMeta(url, serviceKey, sql);
  if (!applied) applied = tryPsql(env, sqlPath);

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("agencies")
    .select("id, name, is_platform, onboarding_status, admin_email")
    .eq("id", "a0000000-0000-4000-8000-000000000001")
    .maybeSingle();

  if (error) {
    console.log("schema check:", error.message);
  } else {
    console.log("redmedia:", JSON.stringify({
      name: data?.name,
      is_platform: data?.is_platform,
      onboarding_status: data?.onboarding_status,
      has_admin_email: data?.admin_email != null,
    }));
  }

  if (!applied || error) {
    console.error("DDL_NOT_APPLIED");
    process.exit(2);
  }
  console.log("ONBOARDING_OPS_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
