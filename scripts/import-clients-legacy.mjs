/**
 * Import Cliente.csv into public.clients (schema atual, sem agency_id).
 * Depois da migration multi-tenant, rode scripts/import-clients.mjs.
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

function digits(v) {
  return String(v ?? "").replace(/\D/g, "");
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
      } else inQ = !inQ;
    } else if (ch === delim && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const delim = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], delim).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line, delim);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    return row;
  });
}

function mapRow(row) {
  const tradeName = row["Nome"] || "";
  const companyName = row["Razão Social"] || tradeName;
  const cnpjDigits = digits(row["CNPJ"]);
  const cpfDigits = digits(row["CPF"]);
  const foreignId = (row["ID Estrangeiro"] || "").trim();
  const document = cnpjDigits || cpfDigits || foreignId || `NODOC-${(tradeName || companyName).slice(0, 40)}`;

  const num = row["Número"] || "";
  const street = row["Endereço"] || "";
  const bairro = row["Bairro"] || "";
  const compl = row["Complemento"] || "";
  const addressParts = [street, num && `nº ${num}`, bairro, compl].filter(Boolean);

  const notes = [
    row["Observações"],
    row["Status"] && `Status importação: ${row["Status"]}`,
    row["Código"] && `Código: ${row["Código"]}`,
    cpfDigits && !cnpjDigits && `CPF: ${row["CPF"]}`,
    row["Data fundação/Aniversário"] && `Fundação: ${row["Data fundação/Aniversário"]}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    company_name: companyName || tradeName || "Sem nome",
    trade_name: tradeName || null,
    cnpj: document,
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
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const rows = parseCsv(fs.readFileSync(path.join(root, "Cliente.csv"), "utf8")).map(mapRow);
  console.log(`Parsed ${rows.length} rows`);

  const { data: existing, error: listErr } = await sb.from("clients").select("id,cnpj");
  if (listErr) {
    console.error(listErr);
    process.exit(1);
  }
  const byDoc = new Map((existing ?? []).map((c) => [c.cnpj, c.id]));

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const id = byDoc.get(row.cnpj);
    if (id) {
      const { error } = await sb.from("clients").update(row).eq("id", id);
      if (error) {
        console.error("update", row.company_name, error.message);
        errors++;
      } else updated++;
    } else {
      const { data, error } = await sb.from("clients").insert(row).select("id,cnpj").single();
      if (error) {
        console.error("insert", row.company_name, error.message);
        errors++;
      } else {
        inserted++;
        byDoc.set(data.cnpj, data.id);
      }
    }
  }

  const { count } = await sb.from("clients").select("*", { count: "exact", head: true });
  console.log(JSON.stringify({ inserted, updated, errors, total: count }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
