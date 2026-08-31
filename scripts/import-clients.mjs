/**
 * Importa Cliente.csv para public.clients da agência Redmedia.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-clients.mjs
 *   ou com VITE_SUPABASE_ANON_KEY (se RLS permitir / migration já aplicada e user autenticado)
 *
 * Agency fixa bootstrap: a0000000-0000-4000-8000-000000000001 (Redmedia)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env");
  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

const REDMEDIA_AGENCY_ID = "a0000000-0000-4000-8000-000000000001";

function digits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const delim = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], delim);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line, delim);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (cols[idx] ?? "").trim();
    });
    return row;
  });
}

function splitCsvLine(line, delim) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === delim && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function mapRow(row) {
  const tradeName = row["Nome"] || "";
  const companyName = row["Razão Social"] || tradeName;
  const cnpjDigits = digits(row["CNPJ"]);
  const cpfDigits = digits(row["CPF"]);
  const foreignId = (row["ID Estrangeiro"] || "").trim();

  let documentType = "cnpj";
  let document = cnpjDigits;
  if (!document && cpfDigits) {
    documentType = "cpf";
    document = cpfDigits;
  } else if (!document && foreignId) {
    documentType = "foreign";
    document = foreignId;
  } else if (!document) {
    documentType = "other";
    document = `NODOC-${tradeName || companyName}`.slice(0, 60);
  }

  const num = row["Número"] || "";
  const street = row["Endereço"] || "";
  const bairro = row["Bairro"] || "";
  const compl = row["Complemento"] || "";
  const addressParts = [street, num && `nº ${num}`, bairro, compl].filter(Boolean);

  const notes = [
    row["Observações"],
    row["Status"] && `Status importação: ${row["Status"]}`,
    row["Código"] && `Código: ${row["Código"]}`,
    row["Data fundação/Aniversário"] && `Fundação: ${row["Data fundação/Aniversário"]}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    agency_id: REDMEDIA_AGENCY_ID,
    company_name: companyName || tradeName || "Sem nome",
    trade_name: tradeName || null,
    cnpj: document,
    document_type: documentType,
    state_registration: row["Inscrição Estadual"] || null,
    address: addressParts.join(", ") || null,
    city: row["Cidade"] || null,
    state: row["Estado"] || null,
    zip_code: digits(row["CEP"]) || null,
    country: "Brasil",
    contact_name: row["Nome Contato"] || null,
    contact_email: row["E-mail Contato"] || row["Email principal"] || null,
    contact_phone: row["Telefone principal"] || null,
    notes: notes || null,
  };
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL / key");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const csvPath = path.join(root, "Cliente.csv");
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const payload = rows.map(mapRow).filter((r) => r.company_name);

  console.log(`Parsed ${payload.length} clients from CSV`);

  // Ensure Redmedia agency exists (idempotent if migration applied)
  const { error: agencyErr } = await sb.from("agencies").upsert(
    { id: REDMEDIA_AGENCY_ID, name: "Redmedia", slug: "redmedia" },
    { onConflict: "slug" }
  );
  if (agencyErr) {
    console.warn("Agency upsert warning (apply migration if column/table missing):", agencyErr.message);
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Upsert in batches by (agency_id, cnpj) — fetch existing first
  const { data: existing, error: exErr } = await sb
    .from("clients")
    .select("id,cnpj")
    .eq("agency_id", REDMEDIA_AGENCY_ID);

  if (exErr && /agency_id|document_type|column/.test(exErr.message)) {
    console.error(
      "\nSchema ainda sem colunas multi-tenant. Aplique a migration:\n" +
        "  supabase/migrations/20260805180000_agencies_multitenant.sql\n" +
        "no SQL Editor do Supabase e rode este script de novo.\n",
      exErr.message
    );
    process.exit(1);
  }
  if (exErr) {
    console.error("Failed listing existing clients:", exErr);
    process.exit(1);
  }

  const byDoc = new Map((existing ?? []).map((c) => [c.cnpj, c.id]));

  const batchSize = 50;
  for (let i = 0; i < payload.length; i += batchSize) {
    const chunk = payload.slice(i, i + batchSize);
    const toInsert = [];
    const toUpdate = [];

    for (const row of chunk) {
      const id = byDoc.get(row.cnpj);
      if (id) {
        toUpdate.push({ ...row, id });
        skipped++;
      } else {
        toInsert.push(row);
      }
    }

    if (toInsert.length) {
      const { data, error } = await sb.from("clients").insert(toInsert).select("id,cnpj");
      if (error) {
        console.error("Insert batch error:", error.message);
        errors += toInsert.length;
      } else {
        inserted += data?.length ?? 0;
        for (const r of data ?? []) byDoc.set(r.cnpj, r.id);
      }
    }

    for (const row of toUpdate) {
      const { id, ...rest } = row;
      const { error } = await sb.from("clients").update(rest).eq("id", id);
      if (error) {
        console.error("Update error:", row.company_name, error.message);
        errors++;
      }
    }
  }

  const { count } = await sb
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("agency_id", REDMEDIA_AGENCY_ID);

  console.log(JSON.stringify({ inserted, updatedOrSkipped: skipped, errors, totalInAgency: count }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
