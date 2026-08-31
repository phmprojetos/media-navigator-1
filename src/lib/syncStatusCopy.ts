/** Tempo máximo em "em andamento" (poll do DV360 no browser ~60s; worker ~45s). */
export const SYNCING_TIMEOUT_MS = 60_000;

export type SyncIssueTone = "ok" | "progress" | "warn" | "error";

export type SyncIssue = {
  tone: SyncIssueTone;
  /** Rótulo curto à direita do card. */
  label: string;
  /** Explicação para o cliente (tooltip / linha secundária). */
  detail: string;
};

function remainingMs(startedAt: string | null | undefined, now: number): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, SYNCING_TIMEOUT_MS - (now - start));
}

export function formatSyncRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 60) {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return sec > 0 ? `faltam ${min}min ${sec}s` : `faltam ${min}min`;
  }
  return `faltam ${s}s`;
}

export function isSyncTimedOut(
  status: string,
  startedAt: string | null | undefined,
  now = Date.now()
): boolean {
  return status === "syncing" && remainingMs(startedAt, now) <= 0;
}

function match(error: string, ...needles: string[]): boolean {
  const upper = error.toUpperCase();
  return needles.some((n) => upper.includes(n.toUpperCase()));
}

function fromErrorMessage(error: string): SyncIssue {
  if (match(error, "CUSTOMER_NOT_ENABLED")) {
    return {
      tone: "error",
      label: "Conta desabilitada",
      detail: "O Google Ads recusou esta conta: encerrada, suspensa ou ainda não ativada. Sincronizar de novo não resolve.",
    };
  }
  if (match(error, "PERMISSION_DENIED", "The caller does not have permission", "AUTHORIZATION_ERROR")) {
    return {
      tone: "error",
      label: "Sem permissão",
      detail: "O usuário conectado não tem acesso de leitura nesta conta. Reautentique com um usuário que tenha permissão.",
    };
  }
  if (match(error, "invalid_grant", "UNAUTHENTICATED", "AUTHENTICATION_ERROR", "Sem refresh token", "reconecte")) {
    return {
      tone: "error",
      label: "Sessão expirada",
      detail: "A autorização caiu. Reconecte a plataforma para voltar a sincronizar.",
    };
  }
  if (match(error, "Tempo esgotado", "não ficou pronto a tempo", "Timeout")) {
    return {
      tone: "error",
      label: "Tempo esgotado",
      detail: "O relatório não ficou pronto em 1 minuto. Marque a conta e sincronize de novo.",
    };
  }
  if (match(error, "500", "Unknown Error", "UNKNOWN")) {
    return {
      tone: "error",
      label: "Erro da plataforma",
      detail: "A API da plataforma falhou (erro temporário). Vale tentar de novo em instantes.",
    };
  }
  if (match(error, "401", "403")) {
    return {
      tone: "error",
      label: "Falha de autenticação",
      detail: "A plataforma recusou a credencial. Reautentique a conexão.",
    };
  }
  return {
    tone: "error",
    label: "Falha na sync",
    detail: error.slice(0, 180),
  };
}

export function describeSyncIssue(
  acc: {
    sync_status: string;
    sync_error: string | null;
    last_synced_at: string | null;
    updated_at?: string | null;
  },
  now = Date.now()
): SyncIssue {
  if (acc.sync_status === "syncing") {
    const left = remainingMs(acc.updated_at, now);
    if (left <= 0) {
      return {
        tone: "error",
        label: "Tempo esgotado",
        detail: "Passou de 1 minuto em andamento. O relatório não fechou — marque e sincronize de novo.",
      };
    }
    return {
      tone: "progress",
      label: formatSyncRemaining(left),
      detail: "Aguardando o relatório. Se não terminar em 1 minuto, a conta volta para nova tentativa.",
    };
  }

  if (acc.sync_status === "auth_error" || acc.sync_status === "failed") {
    return fromErrorMessage(acc.sync_error || "");
  }

  if (acc.sync_status === "ready_partial") {
    return {
      tone: "warn",
      label: "Parcial",
      detail: "A sync concluiu, mas só parte dos dados entrou. Pode atualizar de novo.",
    };
  }

  if (acc.sync_status === "pending" || !acc.last_synced_at) {
    return {
      tone: "warn",
      label: "Nunca sincronizou",
      detail: "Esta conta ainda não importou dados. Marque para sincronizar.",
    };
  }

  return {
    tone: "ok",
    label: "",
    detail: "",
  };
}
