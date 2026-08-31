/** Matching heurístico conta de anúncio ↔ cliente CRM por nome. */

export interface MatchClient {
  id: string;
  companyName: string;
  tradeName: string;
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapScore(a: string, b: string): number {
  const at = a.split(" ").filter((t) => t.length > 2);
  const bt = b.split(" ").filter((t) => t.length > 2);
  if (!at.length || !bt.length) return 0;
  const setA = new Set(at);
  const hits = bt.filter((t) => setA.has(t)).length;
  const ratio = hits / Math.max(at.length, bt.length);
  return Math.round(ratio * 70);
}

/** Score 0–100 de similaridade entre nome da conta e um cliente. */
export function scoreAccountToClient(accountName: string, client: MatchClient): number {
  const account = normalizeName(accountName || "");
  if (!account) return 0;

  const candidates = [client.tradeName, client.companyName]
    .filter(Boolean)
    .map((n) => normalizeName(n));

  let best = 0;
  for (const name of candidates) {
    if (!name) continue;
    if (account === name) best = Math.max(best, 100);
    else if (account.includes(name) || name.includes(account)) best = Math.max(best, 85);
    else best = Math.max(best, tokenOverlapScore(account, name));
  }
  return best;
}

export interface ClientSuggestion {
  client: MatchClient;
  score: number;
}

/** Melhor cliente sugerido para uma conta (ou null se score baixo). */
export function suggestClientForAccount(
  accountName: string,
  clients: MatchClient[],
  minScore = 60
): ClientSuggestion | null {
  let best: ClientSuggestion | null = null;
  for (const client of clients) {
    const score = scoreAccountToClient(accountName, client);
    if (score < minScore) continue;
    if (!best || score > best.score) best = { client, score };
  }
  return best;
}
