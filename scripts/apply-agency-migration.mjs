/**
 * Aplica SQL de migration no projeto Supabase.
 * Tenta endpoints administrativos; service_role sozinha não executa DDL via PostgREST.
 */
import fs from "fs";
import path from "path";
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
      console.log("pg-meta", endpoint, res.status, text.slice(0, 200));
      if (res.ok) return true;
    } catch (e) {
      console.log("pg-meta fail", endpoint, e.message);
    }
  }
  return false;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing URL or SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (env.VITE_SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "AVISO: a service role está como VITE_SUPABASE_SERVICE_ROLE_KEY — renomeie para SUPABASE_SERVICE_ROLE_KEY (sem VITE_) para não vazar no frontend."
    );
  }

  const sqlPath = path.join(
    root,
    "supabase/migrations/20260805180000_agencies_multitenant.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  const ok = await tryPgMeta(url, serviceKey, sql);
  if (ok) {
    console.log("Migration applied via pg-meta");
  } else {
    console.log("pg-meta unavailable — verifying current schema with service role…");
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  const checks = ["agencies", "agency_members", "clients"];
  for (const table of checks) {
    const { error, count } = await sb.from(table).select("*", { count: "exact", head: true });
    console.log(table, error ? `ERR: ${error.message}` : `ok count=${count}`);
  }

  // Probe agency_id column
  const { error: colErr } = await sb.from("clients").select("id,agency_id").limit(1);
  console.log("clients.agency_id", colErr ? `ERR: ${colErr.message}` : "ok");

  if (!ok) {
    console.error(
      "\nNão foi possível executar DDL só com service_role via API REST.\n" +
        "Abra o SQL Editor do Supabase e rode o arquivo:\n" +
        "  supabase/migrations/20260805180000_agencies_multitenant.sql\n"
    );
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
