import { useCallback, useEffect, useMemo, useState } from "react";
import { Link2, RefreshCw, Sparkles, Unlink, Check, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { displayClientName, useClient, type AgencyClient } from "@/contexts/ClientContext";
import { suggestClientForAccount, type MatchClient } from "@/lib/clientAccountMatch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  dv360: "DV360",
};

interface ConnectionRow {
  id: string;
  platform: string;
  account_id: string;
  account_name: string | null;
  client_id: string | null;
  status: string;
}

type FilterMode = "all" | "unlinked" | "linked" | "suggested";

function toMatchClient(c: AgencyClient): MatchClient {
  return { id: c.id, companyName: c.companyName, tradeName: c.tradeName };
}

export function ClientAccountLinkingPanel() {
  const { agencyId } = useAgency();
  const { clients, loading: clientsLoading } = useClient();
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [mode, setMode] = useState<FilterMode>("unlinked");
  const [draft, setDraft] = useState<Record<string, string>>({});

  const matchClients = useMemo(() => clients.map(toMatchClient), [clients]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("platform_connections")
      .select("id, platform, account_id, account_name, client_id, status")
      .neq("account_id", "pending")
      .order("platform")
      .order("account_name");

    if (agencyId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).eq("agency_id", agencyId);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Erro ao carregar contas", description: error.message, variant: "destructive" });
      setConnections([]);
    } else {
      setConnections((data as ConnectionRow[]) ?? []);
    }
    setLoading(false);
  }, [agencyId]);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  const rows = useMemo(() => {
    return connections.map((conn) => {
      const suggestion = !conn.client_id
        ? suggestClientForAccount(conn.account_name || conn.account_id, matchClients)
        : null;
      return { conn, suggestion };
    });
  }, [connections, matchClients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(({ conn, suggestion }) => {
      if (platformFilter !== "all" && conn.platform !== platformFilter) return false;
      if (mode === "unlinked" && conn.client_id) return false;
      if (mode === "linked" && !conn.client_id) return false;
      if (mode === "suggested" && (conn.client_id || !suggestion)) return false;
      if (!q) return true;
      const hay = `${conn.account_name ?? ""} ${conn.account_id} ${PLATFORM_LABELS[conn.platform] ?? ""}`.toLowerCase();
                  const clientName = conn.client_id
                    ? clientById.get(conn.client_id)
                      ? displayClientName(clientById.get(conn.client_id)!)
                      : ""
                    : "";
                  return hay.includes(q) || clientName.toLowerCase().includes(q);
    });
  }, [rows, search, platformFilter, mode, clientById]);

  const stats = useMemo(() => {
    const total = connections.length;
    const linked = connections.filter((c) => c.client_id).length;
    const suggested = rows.filter((r) => !r.conn.client_id && r.suggestion).length;
    return { total, linked, unlinked: total - linked, suggested };
  }, [connections, rows]);

  const applyLink = async (connectionId: string, clientId: string | null) => {
    setSavingId(connectionId);
    const { error } = await supabase
      .from("platform_connections")
      .update({ client_id: clientId })
      .eq("id", connectionId);
    setSavingId(null);

    if (error) {
      toast({ title: "Não foi possível vincular", description: error.message, variant: "destructive" });
      return;
    }

    setConnections((prev) =>
      prev.map((c) => (c.id === connectionId ? { ...c, client_id: clientId } : c))
    );
    setDraft((prev) => {
      const next = { ...prev };
      delete next[connectionId];
      return next;
    });
    toast({
      title: clientId ? "Conta vinculada" : "Vínculo removido",
      description: clientId
        ? `Conta associada a ${clientById.get(clientId) ? displayClientName(clientById.get(clientId)!) : "cliente"}`
        : "Conta ficou sem cliente CRM",
    });
  };

  const applyAllSuggestions = async () => {
    const targets = rows.filter((r) => !r.conn.client_id && r.suggestion);
    if (!targets.length) {
      toast({ title: "Nenhuma sugestão", description: "Não há matches automáticos para aplicar." });
      return;
    }

    setBulkSaving(true);
    let ok = 0;
    let fail = 0;

    for (const { conn, suggestion } of targets) {
      const clientId = suggestion!.client.id;
      const { error } = await supabase
        .from("platform_connections")
        .update({ client_id: clientId })
        .eq("id", conn.id);
      if (error) fail++;
      else {
        ok++;
        setConnections((prev) =>
          prev.map((c) => (c.id === conn.id ? { ...c, client_id: clientId } : c))
        );
      }
    }

    setBulkSaving(false);
    toast({
      title: "Sugestões aplicadas",
      description: `${ok} vinculadas${fail ? `, ${fail} falharam` : ""}.`,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                Vincular contas ↔ clientes
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Só contas com anúncio precisam de cliente CRM. Use sugestões por nome ou escolha manualmente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchConnections()} disabled={loading}>
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
                Atualizar
              </Button>
              <Button
                size="sm"
                onClick={() => void applyAllSuggestions()}
                disabled={bulkSaving || stats.suggested === 0}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Aplicar {stats.suggested} sugestões
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Contas" value={stats.total} />
            <Stat label="Vinculadas" value={stats.linked} tone="success" />
            <Stat label="Sem cliente" value={stats.unlinked} tone="warning" />
            <Stat label="Sugestões" value={stats.suggested} tone="primary" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Buscar conta ou cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56 text-xs"
            />
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas plataformas</SelectItem>
                <SelectItem value="meta_ads">Meta Ads</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="dv360">DV360</SelectItem>
              </SelectContent>
            </Select>
            <Select value={mode} onValueChange={(v) => setMode(v as FilterMode)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlinked">Só sem vínculo</SelectItem>
                <SelectItem value="suggested">Só com sugestão</SelectItem>
                <SelectItem value="linked">Só vinculadas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(loading || clientsLoading) && (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando contas e clientes…</p>
          )}

          {!loading && !clientsLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma conta neste filtro. Conecte plataformas em “Conexões DSP” ou limpe os filtros.
            </p>
          )}

          {!loading && !clientsLoading && filtered.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Plataforma</TableHead>
                    <TableHead className="text-xs">Conta de anúncio</TableHead>
                    <TableHead className="text-xs">Cliente CRM</TableHead>
                    <TableHead className="text-xs w-[140px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(({ conn, suggestion }) => {
                    const selected = draft[conn.id] ?? conn.client_id ?? "";
                    const linkedClient = conn.client_id ? clientById.get(conn.client_id) : null;
                    return (
                      <TableRow key={conn.id}>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px]">
                            {PLATFORM_LABELS[conn.platform] ?? conn.platform}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {conn.account_name || conn.account_id}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">{conn.account_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <Select
                              value={selected || "__none__"}
                              onValueChange={(v) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [conn.id]: v === "__none__" ? "" : v,
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-full max-w-[280px]">
                                <SelectValue placeholder="Selecionar cliente" />
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                <SelectItem value="__none__">Sem cliente</SelectItem>
                                {clients.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {displayClientName(c)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {suggestion && !conn.client_id && (
                              <button
                                type="button"
                                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    [conn.id]: suggestion.client.id,
                                  }))
                                }
                              >
                                <Sparkles className="w-3 h-3" />
                                Sugestão: {suggestion.client.tradeName || suggestion.client.companyName}
                                <span className="text-muted-foreground">({suggestion.score}%)</span>
                              </button>
                            )}
                            {linkedClient && selected === conn.client_id && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                Atual: {displayClientName(linkedClient)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs px-2"
                              disabled={
                                savingId === conn.id ||
                                (selected || null) === (conn.client_id || null) ||
                                (!selected && !conn.client_id)
                              }
                              onClick={() => void applyLink(conn.id, selected || null)}
                            >
                              {savingId === conn.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Salvar
                                </>
                              )}
                            </Button>
                            {conn.client_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 text-muted-foreground"
                                disabled={savingId === conn.id}
                                onClick={() => void applyLink(conn.id, null)}
                              >
                                <Unlink className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "primary";
}) {
  const color =
    tone === "success"
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "primary"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", color)}>{value}</p>
    </div>
  );
}
