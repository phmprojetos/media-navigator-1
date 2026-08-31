import { createClient } from "jsr:@supabase/supabase-js@2";
import { updateSyncStatus } from "../_shared/syncStatus.ts";

// Chamado pelo pg_cron a cada 2 minutos (drenagem da fila). Nunca é chamado pelo frontend —
// só aceita o pedido se o Authorization vier com a própria service role key, e é isso que
// autoriza as 4 funções de sync a tratar essa chamada como "interna" (ver _shared/internalAuth.ts).
const MAX_JOBS_PER_RUN = 5;
const DV360_POLL_INTERVAL_MS = 5000;
const DV360_POLL_MAX_ATTEMPTS = 9; // ~45s de polling — cabe dentro do limite de execução da function.

type SyncJob = { id: string; user_id: string; platform: string; account_id: string; range_days: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callFunction(baseUrl: string, serviceRoleKey: string, name: string, body: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function runDv360Job(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  baseUrl: string,
  serviceRoleKey: string,
  job: SyncJob,
): Promise<{ ok: boolean; error?: string }> {
  const startRes = await callFunction(baseUrl, serviceRoleKey, "dv360-sync", {
    account_ids: [job.account_id],
    range_days: job.range_days,
    _internal_user_id: job.user_id,
  }) as { ok?: boolean; jobs?: { account_id: string; query_id?: string; report_id?: string; error?: string }[]; error?: string };

  const jobInfo = startRes.jobs?.find((j) => j.account_id === job.account_id);
  if (!jobInfo || jobInfo.error) return { ok: false, error: jobInfo?.error ?? startRes.error ?? "Falha ao iniciar consulta DV360" };
  if (!jobInfo.query_id || !jobInfo.report_id) return { ok: false, error: "DV360 não retornou query_id/report_id" };

  for (let attempt = 0; attempt < DV360_POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(DV360_POLL_INTERVAL_MS);
    const pollRes = await callFunction(baseUrl, serviceRoleKey, "dv360-sync-poll", {
      account_id: job.account_id,
      query_id: jobInfo.query_id,
      report_id: jobInfo.report_id,
      _internal_user_id: job.user_id,
    }) as { done?: boolean; error?: string };

    if (pollRes.done) {
      // "sem dados" também vem com done:true + error preenchido, mas já foi tratado como
      // sync_status='ready' dentro do dv360-sync-poll — não é uma falha real do job.
      return { ok: true };
    }
  }

  const timeoutMsg = "Tempo esgotado: o relatório do DV360 não ficou pronto em 1 min.";
  await updateSyncStatus(supabase, job.user_id, "dv360", job.account_id, "failed", timeoutMsg);
  return { ok: false, error: timeoutMsg };
}

async function runSimpleJob(baseUrl: string, serviceRoleKey: string, functionName: string, job: SyncJob): Promise<{ ok: boolean; error?: string }> {
  const res = await callFunction(baseUrl, serviceRoleKey, functionName, {
    account_ids: [job.account_id],
    range_days: job.range_days,
    _internal_user_id: job.user_id,
  }) as { ok?: boolean; results?: { account_id: string; error?: string }[]; error?: string };

  if (!res.ok) return { ok: false, error: res.error ?? "Falha desconhecida" };
  const result = res.results?.find((r) => r.account_id === job.account_id);
  // "sem dados" também retorna um `error` descritivo nos results, mas já foi persistido como
  // sync_status='ready' dentro da função de sync — não é uma falha real do job.
  return { ok: true, error: result?.error };
}

Deno.serve(async (req) => {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(baseUrl, serviceRoleKey);

  try {
    const { data: jobs, error: fetchError } = await supabase
      .from("sync_jobs")
      .select("id, user_id, platform, account_id, range_days")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 });
    if (!jobs?.length) return Response.json({ ok: true, processed: 0 });

    const results: { job_id: string; ok: boolean; error?: string }[] = [];

    for (const job of jobs as SyncJob[]) {
      await supabase.from("sync_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", job.id);

      try {
        const outcome = job.platform === "dv360"
          ? await runDv360Job(supabase, baseUrl, serviceRoleKey, job)
          : await runSimpleJob(baseUrl, serviceRoleKey, job.platform === "meta_ads" ? "meta-insights-sync" : "google-ads-sync", job);

        await supabase.from("sync_jobs").update({
          status: outcome.ok ? "done" : "error",
          error_message: outcome.error ?? null,
          finished_at: new Date().toISOString(),
        }).eq("id", job.id);

        results.push({ job_id: job.id, ok: outcome.ok, error: outcome.error });
      } catch (e) {
        const msg = String(e);
        await supabase.from("sync_jobs").update({ status: "error", error_message: msg, finished_at: new Date().toISOString() }).eq("id", job.id);
        results.push({ job_id: job.id, ok: false, error: msg });
      }
    }

    return Response.json({ ok: true, processed: results.length, results });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
