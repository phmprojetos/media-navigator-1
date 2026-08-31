import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plug, Upload, Database, History, HeartPulse, Wifi, WifiOff,
  RefreshCw, Link2, Unlink, ShieldCheck, CheckCircle2, XCircle,
  AlertTriangle, Clock, FileUp, FileSpreadsheet, ExternalLink,
  Download, Info, ChevronDown, ChevronRight, Layers, Zap,
  Key, Code2, Plus, Eye, EyeOff, Copy, Trash2, Users, Search,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format, differenceInHours } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import {
  MOCK_DSP_CONNECTIONS, MOCK_WAREHOUSES, MOCK_UPLOADS, MOCK_SYNC_HISTORY,
  MOCK_TENANT_DATA_HEALTH,
} from "@/data/dataIntegrationsData";
import {
  FRESHNESS_CONFIG, SYNC_FREQ_LABELS, WAREHOUSE_META,
} from "@/types/dataIntegrations";
import {
  HEALTH_STATUS_CONFIG, VALIDATION_ISSUE_LABELS, SEVERITY_COLORS,
} from "@/types/dataArchitecture";
import { MOCK_VALIDATION_ISSUES } from "@/data/dataArchitectureData";
import type { ApiKey } from "@/types/integration";
import { INTERNAL_API_ENDPOINTS } from "@/types/integration";
import { API_KEYS, generateFakeApiKey, maskApiKey } from "@/data/integrationData";
import { ClientAccountLinkingPanel } from "@/components/data/ClientAccountLinkingPanel";
import { displayClientName, useClient } from "@/contexts/ClientContext";
import { describeSyncIssue, isSyncTimedOut } from "@/lib/syncStatusCopy";

// ── Helpers ──

const platformLabels: Record<string, string> = {
  meta_ads: "Meta Ads", google_ads: "Google Ads", dv360: "DV360",
  linkedin_ads: "LinkedIn Ads", tiktok_ads: "TikTok Ads",
  uploaded_file: "Upload", external_warehouse: "Warehouse",
};

const sourceLabels: Record<string, string> = {
  api: "API", upload: "Upload", warehouse_sync: "Warehouse",
};

const statusBadge = (status: string) => {
  switch (status) {
    case "success": return { label: "Sucesso", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    case "partial": return { label: "Parcial", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
    case "failed": return { label: "Falha", cls: "bg-red-500/20 text-red-400 border-red-500/30" };
    default: return { label: status, cls: "bg-muted text-muted-foreground" };
  }
};

// ═════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════

export default function DataIntegrations() {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-foreground">Dados & Integrações</h1>
            <PageInfoTooltip description="Gerencie conexões com plataformas de mídia, envie dados manualmente, conecte warehouses externos e monitore a saúde da ingestão de dados." />
            <Badge className="bg-primary/10 text-primary border-primary/20">Tenant</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Conecte suas fontes de dados, monitore sincronizações e garanta a qualidade dos dados que alimentam toda a plataforma.
          </p>
        </div>

        <Tabs defaultValue="dsp" className="space-y-4">
          <TabsList className="bg-muted/50 flex-wrap h-auto p-1 gap-1">
            <TabsTrigger value="dsp" className="text-xs gap-1.5"><Plug className="w-3.5 h-3.5" />Conexões DSP</TabsTrigger>
            <TabsTrigger value="client-links" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5" />Clientes ↔ Contas</TabsTrigger>
            <TabsTrigger value="upload" className="text-xs gap-1.5"><Upload className="w-3.5 h-3.5" />Upload de Dados</TabsTrigger>
            <TabsTrigger value="warehouse" className="text-xs gap-1.5"><Database className="w-3.5 h-3.5" />Warehouse Externo</TabsTrigger>
            <TabsTrigger value="sync-history" className="text-xs gap-1.5"><History className="w-3.5 h-3.5" />Histórico de Sync</TabsTrigger>
            <TabsTrigger value="data-health" className="text-xs gap-1.5"><HeartPulse className="w-3.5 h-3.5" />Saúde dos Dados</TabsTrigger>
            <TabsTrigger value="api-keys" className="text-xs gap-1.5"><Key className="w-3.5 h-3.5" />API Keys</TabsTrigger>
            <TabsTrigger value="endpoints" className="text-xs gap-1.5"><Code2 className="w-3.5 h-3.5" />API Endpoints</TabsTrigger>
          </TabsList>

          <TabsContent value="dsp"><DSPTab /></TabsContent>
          <TabsContent value="client-links"><ClientAccountLinkingPanel /></TabsContent>
          <TabsContent value="upload"><UploadTab /></TabsContent>
          <TabsContent value="warehouse"><WarehouseTab /></TabsContent>
          <TabsContent value="sync-history"><SyncHistoryTab /></TabsContent>
          <TabsContent value="data-health"><DataHealthTab /></TabsContent>
          <TabsContent value="api-keys"><ApiKeysTab /></TabsContent>
          <TabsContent value="endpoints"><ApiEndpointsTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ═════════════════════════════════════════════════════════
// TAB 1: DSP CONNECTIONS
// ═════════════════════════════════════════════════════════

interface PlatformConnectionRow {
  id: string;
  account_id: string;
  account_name: string | null;
  connected_at: string;
  updated_at?: string | null;
  is_selected: boolean;
  client_id: string | null;
  sync_status: "pending" | "syncing" | "ready_partial" | "ready" | "auth_error" | "failed";
  sync_error: string | null;
  last_synced_at: string | null;
}

function DSPTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [metaConnections, setMetaConnections] = useState<PlatformConnectionRow[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [googleConnections, setGoogleConnections] = useState<PlatformConnectionRow[]>([]);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [dv360Connections, setDv360Connections] = useState<PlatformConnectionRow[]>([]);
  const [dv360Loading, setDv360Loading] = useState(true);
  const [dv360Connecting, setDv360Connecting] = useState(false);

  const CONNECTION_FIELDS = "id, account_id, account_name, connected_at, updated_at, is_selected, client_id, sync_status, sync_error, last_synced_at";

  const fetchMetaConnections = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("platform_connections")
      .select(CONNECTION_FIELDS)
      .eq("platform", "meta_ads");
    if (!error && data) setMetaConnections(data as PlatformConnectionRow[]);
    setMetaLoading(false);
  }, []);

  const fetchGoogleConnections = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("platform_connections")
      .select(CONNECTION_FIELDS)
      .eq("platform", "google_ads");
    if (!error && data) setGoogleConnections(data as PlatformConnectionRow[]);
    setGoogleLoading(false);
  }, []);

  const fetchDv360Connections = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("platform_connections")
      .select(CONNECTION_FIELDS)
      .eq("platform", "dv360");
    if (!error && data) setDv360Connections(data as PlatformConnectionRow[]);
    setDv360Loading(false);
  }, []);

  useEffect(() => {
    fetchMetaConnections();
    fetchGoogleConnections();
    fetchDv360Connections();
  }, [fetchMetaConnections, fetchGoogleConnections, fetchDv360Connections]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const metaError = searchParams.get("meta_error");
    const googleError = searchParams.get("google_error");
    const dv360Error = searchParams.get("dv360_error");

    // Se essa aba é o popup do OAuth do Google/DV360 (foi aberta via window.open a partir
    // dessa mesma origem), avisa a aba principal por postMessage e fecha, em vez de
    // tratar a conexão aqui dentro do popup.
    if (window.opener && (connected === "google_ads" || googleError)) {
      window.opener.postMessage(
        { source: "mediahub-google-oauth", ok: connected === "google_ads", code: googleError || "connected" },
        window.location.origin
      );
      window.close();
      return;
    }
    if (window.opener && (connected === "dv360" || dv360Error)) {
      window.opener.postMessage(
        { source: "mediahub-dv360-oauth", ok: connected === "dv360", code: dv360Error || "connected" },
        window.location.origin
      );
      window.close();
      return;
    }

    if (connected === "meta_ads") {
      toast({ title: "Meta Ads conectado!", description: "Sua conta foi conectada com sucesso." });
      fetchMetaConnections();
    } else if (metaError) {
      toast({ title: "Erro ao conectar Meta Ads", description: metaError, variant: "destructive" });
    }

    if (connected === "google_ads") {
      toast({ title: "Google Ads conectado!", description: "Sua conta foi conectada com sucesso." });
      fetchGoogleConnections();
    } else if (googleError) {
      toast({ title: "Erro ao conectar Google Ads", description: googleError, variant: "destructive" });
    }

    if (connected === "dv360") {
      toast({ title: "DV360 conectado!", description: "Sua conta foi conectada com sucesso." });
      fetchDv360Connections();
    } else if (dv360Error) {
      toast({ title: "Erro ao conectar DV360", description: dv360Error, variant: "destructive" });
    }

    if (connected || metaError || googleError || dv360Error) {
      const next = new URLSearchParams(searchParams);
      next.delete("connected");
      next.delete("meta_error");
      next.delete("google_error");
      next.delete("dv360_error");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectMeta = useCallback(async () => {
    setMetaConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        "meta-oauth-start",
        { body: { redirectOrigin: window.location.origin } }
      );
      if (error || !data?.url) throw error || new Error(data?.error || "URL não retornada");
      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao iniciar conexão", description: "Tente novamente em instantes.", variant: "destructive" });
      setMetaConnecting(false);
    }
  }, []);

  const handleDisconnectMeta = useCallback(async () => {
    const { error } = await (supabase as any).from("platform_connections").delete().eq("platform", "meta_ads");
    if (error) {
      toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" });
      return;
    }
    setMetaConnections([]);
    toast({ title: "Meta Ads desconectado", description: "Conexão removida com sucesso." });
  }, []);

  const handleConnectGoogle = useCallback(async () => {
    setGoogleConnecting(true);

    // Abre a janela em branco de forma síncrona (dentro do clique) para não ser bloqueada
    // pelo navegador — só definimos a URL depois que a Edge Function responder.
    // As flags "menubar/toolbar/location=no" sinalizam pro navegador que é um popup de
    // autenticação, não uma aba normal — alguns navegadores/extensões podem ainda assim
    // preferir abrir como aba, mas o fechamento automático ao final funciona de qualquer forma.
    const popupFeatures = [
      "width=520", "height=680",
      `left=${Math.round(window.screenX + (window.outerWidth - 520) / 2)}`,
      `top=${Math.round(window.screenY + (window.outerHeight - 680) / 2)}`,
      "menubar=no", "toolbar=no", "location=no", "status=no", "resizable=yes", "scrollbars=yes",
    ].join(",");
    const popup = window.open("about:blank", "google_oauth_popup", popupFeatures);

    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        "google-oauth-start",
        { body: { redirectOrigin: window.location.origin } }
      );
      if (error || !data?.url) throw error || new Error(data?.error || "URL não retornada");

      if (!popup) {
        // Popup bloqueado pelo navegador — volta pro fluxo de página inteira
        window.location.href = data.url;
        return;
      }

      popup.location.href = data.url;

      const handleMessage = (event: MessageEvent) => {
        const payload = event.data as { source?: string; ok?: boolean; code?: string } | undefined;
        if (!payload || payload.source !== "mediahub-google-oauth") return;
        window.removeEventListener("message", handleMessage);
        setGoogleConnecting(false);
        if (payload.ok) {
          toast({ title: "Google Ads conectado!", description: "Sua conta foi conectada com sucesso." });
          fetchGoogleConnections();
        } else {
          toast({ title: "Erro ao conectar Google Ads", description: payload.code || "Tente novamente.", variant: "destructive" });
        }
      };
      window.addEventListener("message", handleMessage);
    } catch (e) {
      console.error(e);
      popup?.close();
      toast({ title: "Erro ao iniciar conexão", description: "Tente novamente em instantes.", variant: "destructive" });
      setGoogleConnecting(false);
    }
  }, [fetchGoogleConnections]);

  const handleDisconnectGoogle = useCallback(async () => {
    const { error } = await (supabase as any).from("platform_connections").delete().eq("platform", "google_ads");
    if (error) {
      toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" });
      return;
    }
    setGoogleConnections([]);
    toast({ title: "Google Ads desconectado", description: "Conexão removida com sucesso." });
  }, []);

  const handleConnectDV360 = useCallback(async () => {
    setDv360Connecting(true);

    const popupFeatures = [
      "width=520", "height=680",
      `left=${Math.round(window.screenX + (window.outerWidth - 520) / 2)}`,
      `top=${Math.round(window.screenY + (window.outerHeight - 680) / 2)}`,
      "menubar=no", "toolbar=no", "location=no", "status=no", "resizable=yes", "scrollbars=yes",
    ].join(",");
    const popup = window.open("about:blank", "dv360_oauth_popup", popupFeatures);

    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        "dv360-oauth-start",
        { body: { redirectOrigin: window.location.origin } }
      );
      if (error || !data?.url) throw error || new Error(data?.error || "URL não retornada");

      if (!popup) {
        window.location.href = data.url;
        return;
      }

      popup.location.href = data.url;

      const handleMessage = (event: MessageEvent) => {
        const payload = event.data as { source?: string; ok?: boolean; code?: string } | undefined;
        if (!payload || payload.source !== "mediahub-dv360-oauth") return;
        window.removeEventListener("message", handleMessage);
        setDv360Connecting(false);
        if (payload.ok) {
          toast({ title: "DV360 conectado!", description: "Sua conta foi conectada com sucesso." });
          fetchDv360Connections();
        } else {
          toast({ title: "Erro ao conectar DV360", description: payload.code || "Tente novamente.", variant: "destructive" });
        }
      };
      window.addEventListener("message", handleMessage);
    } catch (e) {
      console.error(e);
      popup?.close();
      toast({ title: "Erro ao iniciar conexão", description: "Tente novamente em instantes.", variant: "destructive" });
      setDv360Connecting(false);
    }
  }, [fetchDv360Connections]);

  const handleDisconnectDV360 = useCallback(async () => {
    const { error } = await (supabase as any).from("platform_connections").delete().eq("platform", "dv360");
    if (error) {
      toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" });
      return;
    }
    setDv360Connections([]);
    toast({ title: "DV360 desconectado", description: "Conexão removida com sucesso." });
  }, []);

  const handleAction = (platform: string, action: string) => {
    toast({ title: `${action}`, description: `Ação "${action}" para ${platform} iniciada.` });
  };

  const metaDsp = MOCK_DSP_CONNECTIONS.find(d => d.platform === "meta_ads")!;
  const googleDsp = MOCK_DSP_CONNECTIONS.find(d => d.platform === "google_ads")!;
  const dv360Dsp = MOCK_DSP_CONNECTIONS.find(d => d.platform === "dv360")!;
  const otherDsps = MOCK_DSP_CONNECTIONS.filter(d => d.platform !== "meta_ads" && d.platform !== "google_ads" && d.platform !== "dv360");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <MetaAdsCard
        meta={metaDsp}
        connections={metaConnections}
        loading={metaLoading}
        connecting={metaConnecting}
        onConnect={handleConnectMeta}
        onDisconnect={handleDisconnectMeta}
        onAccountsUpdated={fetchMetaConnections}
      />

      <GoogleAdsCard
        google={googleDsp}
        connections={googleConnections}
        loading={googleLoading}
        connecting={googleConnecting}
        onConnect={handleConnectGoogle}
        onDisconnect={handleDisconnectGoogle}
        onAccountsUpdated={fetchGoogleConnections}
      />

      <DV360Card
        dv360={dv360Dsp}
        connections={dv360Connections}
        loading={dv360Loading}
        connecting={dv360Connecting}
        onConnect={handleConnectDV360}
        onDisconnect={handleDisconnectDV360}
        onAccountsUpdated={fetchDv360Connections}
      />

      {otherDsps.map(dsp => {
        const fresh = FRESHNESS_CONFIG[dsp.freshness];
        const health = HEALTH_STATUS_CONFIG[dsp.healthStatus];
        const isConnected = dsp.connectionStatus === "connected";

        return (
          <Card key={dsp.platform} className="border-border/50 bg-card/80 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-xl", isConnected ? "bg-emerald-500/10" : "bg-muted")}>
                    {isConnected
                      ? <Wifi className="w-5 h-5 text-emerald-400" />
                      : <WifiOff className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{dsp.displayName}</p>
                    <p className="text-xs text-muted-foreground">{dsp.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className={cn("text-xs", isConnected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground")}>
                  {isConnected ? "Conectado" : "Desconectado"}
                </Badge>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span className="text-muted-foreground">Contas</span>
                  <span className="font-medium">{dsp.accountsLinked}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span className="text-muted-foreground">Frequência</span>
                  <span className="font-medium">{SYNC_FREQ_LABELS[dsp.syncFrequency]}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span className="text-muted-foreground">Último Sync</span>
                  <span className="font-medium">{dsp.lastSyncAt ? format(new Date(dsp.lastSyncAt), "dd/MM HH:mm") : "—"}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/30">
                  <span className="text-muted-foreground">Frescor</span>
                  <span className={cn("font-medium", fresh.color)}>{fresh.label}</span>
                </div>
              </div>

              {/* Health */}
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-muted-foreground">Saúde do Sync</span>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", health.bg)} />
                  <span className={cn("text-xs font-medium", health.color)}>{health.label}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                {isConnected ? (
                  <>
                    <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleAction(dsp.displayName, "Sync Manual")}>
                      <RefreshCw className="w-3.5 h-3.5" />Sync Manual
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleAction(dsp.displayName, "Reautenticar")}>
                      <ShieldCheck className="w-3.5 h-3.5" />Reautenticar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs gap-1.5 text-muted-foreground col-span-2" onClick={() => handleAction(dsp.displayName, "Desconectar")}>
                      <Unlink className="w-3.5 h-3.5" />Desconectar
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="text-xs gap-1.5 col-span-2" onClick={() => handleAction(dsp.displayName, "Conectar")}>
                    <Link2 className="w-3.5 h-3.5" />Conectar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Resultado de sync por conta (usado nos modais de Meta/Google/DV360) ──

type SyncResultItem = {
  account_id: string;
  account_name: string;
  status: "success" | "no_data" | "error";
  message?: string;
};

function SyncResultsList({ results }: { results: SyncResultItem[] }) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto py-1">
      {results.map(r => (
        <div key={r.account_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
          {r.status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
          {r.status === "no_data" && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
          {r.status === "error" && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{r.account_name || r.account_id}</p>
            <p className={cn(
              "text-xs",
              r.status === "success" && "text-emerald-400",
              r.status === "no_data" && "text-amber-400",
              r.status === "error" && "text-red-400"
            )}>
              {r.status === "success" ? r.message : r.message || "Sem dados no período"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function accountNeedsSync(acc: PlatformConnectionRow, now = Date.now()): boolean {
  if (isSyncTimedOut(acc.sync_status, acc.updated_at, now)) return true;
  if (acc.sync_status === "syncing") return false;
  if (acc.last_synced_at && (acc.sync_status === "ready" || acc.sync_status === "ready_partial")) return false;
  return true;
}

function defaultSyncSelection(accounts: PlatformConnectionRow[], maxSelect?: number): string[] {
  const ids = accounts.filter((a) => accountNeedsSync(a)).map(a => a.account_id);
  return typeof maxSelect === "number" ? ids.slice(0, maxSelect) : ids;
}

function formatLastSyncedAt(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "nunca";
  const hours = differenceInHours(new Date(), d);
  if (hours < 1) return "agora";
  if (hours < 24) return `há ${hours}h`;
  if (hours < 48) return "ontem";
  return format(d, "dd/MM HH:mm");
}

function AccountSyncList({
  accounts,
  selectedIds,
  onToggle,
  maxSelect,
}: {
  accounts: PlatformConnectionRow[];
  selectedIds: string[];
  onToggle: (accountId: string) => void;
  maxSelect?: number;
}) {
  const { clients } = useClient();
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, displayClientName(c)));
    return map;
  }, [clients]);

  useEffect(() => {
    if (!accounts.some((a) => a.sync_status === "syncing")) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(acc => {
      const client = acc.client_id ? clientNameById.get(acc.client_id) ?? "" : "";
      return (
        (acc.account_name || "").toLowerCase().includes(q) ||
        acc.account_id.toLowerCase().includes(q) ||
        client.toLowerCase().includes(q)
      );
    });
  }, [accounts, query, clientNameById]);

  const needsSync = filtered.filter((a) => accountNeedsSync(a, now));
  const inProgress = filtered.filter((a) => a.sync_status === "syncing" && !isSyncTimedOut(a.sync_status, a.updated_at, now));
  const synced = filtered.filter((a) => !accountNeedsSync(a, now) && a.sync_status !== "syncing");
  const atLimit = typeof maxSelect === "number" && selectedIds.length >= maxSelect;

  const toneClass: Record<string, string> = {
    ok: "text-emerald-400",
    progress: "text-sky-400",
    warn: "text-amber-400",
    error: "text-red-400",
  };

  const renderRow = (acc: PlatformConnectionRow, emphasize: boolean) => {
    const checked = selectedIds.includes(acc.account_id);
    const liveSync = acc.sync_status === "syncing" && !isSyncTimedOut(acc.sync_status, acc.updated_at, now);
    const disabled = liveSync || (atLimit && !checked);
    const clientName = acc.client_id ? clientNameById.get(acc.client_id) : null;
    const primary = clientName || acc.account_name || acc.account_id;
    const issue = describeSyncIssue(acc, now);
    const secondary = issue.tone === "ok"
      ? (clientName ? acc.account_name || acc.account_id : "Sem cliente CRM")
      : issue.detail;
    const rightLabel = issue.tone === "ok" ? formatLastSyncedAt(acc.last_synced_at) : issue.label;

    return (
      <button
        type="button"
        key={acc.account_id}
        disabled={disabled}
        onClick={() => { if (!disabled) onToggle(acc.account_id); }}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border",
          checked && "bg-primary/10 border-primary/30",
          !checked && emphasize && "bg-amber-500/5 border-amber-500/25 hover:bg-amber-500/10",
          !checked && !emphasize && "bg-muted/20 border-transparent hover:bg-muted/40",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <Checkbox checked={checked} disabled={disabled} className="pointer-events-none" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate leading-tight">{primary}</p>
          <p className={cn("text-[11px] truncate mt-0.5", issue.tone === "ok" ? "text-muted-foreground" : toneClass[issue.tone])}>
            {secondary}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("text-[11px] font-medium shrink-0 text-right max-w-[8.5rem] leading-tight tabular-nums", toneClass[issue.tone])}>
              {liveSync && <RefreshCw className="w-3 h-3 inline-block mr-1 animate-spin" />}
              {rightLabel}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs text-xs">
            {issue.detail || `Última sync: ${formatLastSyncedAt(acc.last_synced_at)}`}
          </TooltipContent>
        </Tooltip>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {accounts.length > 8 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar conta ou cliente…"
            className="h-8 text-sm pl-8"
          />
        </div>
      )}
      <div className="space-y-3 max-h-80 overflow-y-auto py-1 pr-1">
        {needsSync.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-amber-400 font-medium px-0.5">
              Sincronizar agora ({needsSync.length})
            </p>
            {needsSync.map(acc => renderRow(acc, true))}
          </div>
        )}
        {inProgress.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-sky-400 font-medium px-0.5">
              Em andamento ({inProgress.length}) · limite 1 min
            </p>
            {inProgress.map(acc => renderRow(acc, false))}
          </div>
        )}
        {synced.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-0.5">
              Já sincronizadas ({synced.length})
            </p>
            {synced.map(acc => renderRow(acc, false))}
          </div>
        )}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta encontrada.</p>
        )}
      </div>
    </div>
  );
}

// ── Seleção de contas descobertas (usado nos 3 cards de DSP) ──
// Contas chegam de uma conexão OAuth com is_selected=false — o usuário escolhe explicitamente
// quais entram no produto antes de poderem ser sincronizadas.

function AccountSelectionDialog({
  open, onOpenChange, accounts, platformLabel, onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: PlatformConnectionRow[];
  platformLabel: string;
  onConfirm: (ids: string[]) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleConfirm = async () => {
    if (!selectedIds.length) return;
    setSaving(true);
    try {
      await onConfirm(selectedIds);
      setSelectedIds([]);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSelectedIds([]); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selecionar contas do {platformLabel}</DialogTitle>
          <DialogDescription>
            Escolha quais contas você quer usar no MediaHub. Só as contas selecionadas entram na análise e podem ser sincronizadas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto py-1">
          {accounts.map(acc => (
            <label
              key={acc.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(acc.id)}
                onChange={() => toggle(acc.id)}
                className="w-4 h-4 accent-primary flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{acc.account_name || acc.account_id}</p>
                <p className="text-xs text-muted-foreground">{acc.account_id}</p>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!selectedIds.length || saving} className="gap-1.5">
            {saving
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <CheckCircle2 className="w-3.5 h-3.5" />}
            {saving ? "Salvando..." : `Selecionar${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SyncStatusSummary({ accounts }: { accounts: PlatformConnectionRow[] }) {
  if (accounts.length === 0) return null;
  const ready = accounts.filter(a => a.sync_status === "ready").length;
  const syncing = accounts.filter(a => a.sync_status === "syncing").length;
  const pending = accounts.filter(a => a.sync_status === "pending").length;
  const errors = accounts.filter(a => a.sync_status === "auth_error" || a.sync_status === "failed").length;

  const parts: string[] = [];
  if (ready > 0) parts.push(`${ready} pronta${ready > 1 ? "s" : ""}`);
  if (syncing > 0) parts.push(`${syncing} sincronizando`);
  if (pending > 0) parts.push(`${pending} pendente${pending > 1 ? "s" : ""}`);
  if (errors > 0) parts.push(`${errors} com erro`);

  return <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>;
}

// ── Meta Ads Card (real connection via Supabase) ──

function MetaAdsCard({
  meta, connections, loading, connecting, onConnect, onDisconnect, onAccountsUpdated,
}: {
  meta: typeof MOCK_DSP_CONNECTIONS[number];
  connections: PlatformConnectionRow[];
  loading: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onAccountsUpdated: () => void;
}) {
  const isConnected = connections.length > 0;
  const realAccounts = connections.filter(c => c.account_id !== "pending" && c.is_selected);
  const discoveredAccounts = connections.filter(c => c.account_id !== "pending" && !c.is_selected);

  const [syncOpen, setSyncOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResultItem[] | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);

  const toggleAccount = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSync = async () => {
    if (!selectedIds.length) return;
    setSyncing(true);
    setSyncResults(null);
    try {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        results: { account_id: string; days: number; error?: string }[];
      }>("meta-insights-sync", { body: { account_ids: selectedIds } });

      if (error) throw error;

      const nameFor = (id: string) => realAccounts.find(a => a.account_id === id)?.account_name || id;
      const results: SyncResultItem[] = (data?.results ?? []).map(r => ({
        account_id: r.account_id,
        account_name: nameFor(r.account_id),
        status: r.error ? "error" : r.days === 0 ? "no_data" : "success",
        message: r.error || (r.days > 0 ? `${r.days} registros importados` : undefined),
      }));
      setSyncResults(results);
      onAccountsUpdated();
    } catch (e) {
      toast({ title: "Erro na sincronização", description: String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", isConnected ? "bg-emerald-500/10" : "bg-muted")}>
              {isConnected
                ? <Wifi className="w-5 h-5 text-emerald-400" />
                : <WifiOff className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-semibold text-foreground">{meta.displayName}</p>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs", isConnected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground")}>
            {loading ? "Carregando..." : isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>

        {/* Accounts summary */}
        {isConnected && (
          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400 space-y-1">
            <p>
              {realAccounts.length > 0
                ? `${realAccounts.length} conta${realAccounts.length > 1 ? "s" : ""} de anúncio conectada${realAccounts.length > 1 ? "s" : ""}`
                : "Autenticado — aguardando seleção de contas"}
            </p>
            <SyncStatusSummary accounts={realAccounts} />
          </div>
        )}

        {isConnected && discoveredAccounts.length > 0 && (
          <button
            onClick={() => setSelectOpen(true)}
            className="w-full text-left p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            {discoveredAccounts.length} conta{discoveredAccounts.length > 1 ? "s" : ""} nova{discoveredAccounts.length > 1 ? "s" : ""} descoberta{discoveredAccounts.length > 1 ? "s" : ""} — selecionar para sincronizar
          </button>
        )}

        {!isConnected && !loading && (
          <p className="text-xs text-muted-foreground">
            Conecte sua conta do Meta Ads (Facebook/Instagram) para alimentar a análise de funil com seus dados de campanha.
          </p>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          {isConnected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={() => setSyncOpen(true)}
                disabled={!realAccounts.length}
              >
                <RefreshCw className="w-3.5 h-3.5" />Sincronizar dados
              </Button>
              <Button size="sm" variant="ghost" className="text-xs gap-1.5 text-muted-foreground" onClick={onDisconnect}>
                <Unlink className="w-3.5 h-3.5" />Desconectar
              </Button>
            </>
          ) : (
            <Button size="sm" className="text-xs gap-1.5 col-span-2" onClick={onConnect} disabled={connecting || loading}>
              <Link2 className="w-3.5 h-3.5" />{connecting ? "Redirecionando..." : "Conectar"}
            </Button>
          )}
        </div>

        {/* Account Selection Modal */}
        <AccountSelectionDialog
          open={selectOpen}
          onOpenChange={setSelectOpen}
          accounts={discoveredAccounts}
          platformLabel="Meta Ads"
          onConfirm={async (ids) => {
            const { error } = await (supabase as any).from("platform_connections").update({ is_selected: true }).in("id", ids);
            if (error) {
              toast({ title: "Erro ao selecionar contas", description: error.message, variant: "destructive" });
              return;
            }
            const jobRows = discoveredAccounts.filter(a => ids.includes(a.id)).flatMap(a => ([
              { platform: "meta_ads", account_id: a.account_id, range_days: 7 },
              { platform: "meta_ads", account_id: a.account_id, range_days: 90 },
            ]));
            if (jobRows.length > 0) await (supabase as any).from("sync_jobs").insert(jobRows);
            toast({ title: "Contas selecionadas!", description: `${ids.length} conta${ids.length > 1 ? "s" : ""} adicionada${ids.length > 1 ? "s" : ""} ao MediaHub. A sincronização vai começar automaticamente.` });
            onAccountsUpdated();
          }}
        />

        {/* Sync Modal */}
        <Dialog open={syncOpen} onOpenChange={(open) => {
          setSyncOpen(open);
          if (!open) { setSelectedIds([]); setSyncResults(null); }
          else setSelectedIds(defaultSyncSelection(realAccounts, 3));
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sincronizar dados do Meta Ads</DialogTitle>
              <DialogDescription>
                {syncResults
                  ? "Resultado da sincronização por conta."
                  : "Novas já vêm marcadas. Nas sincronizadas, a data fica à direita. Até 3 por vez."}
              </DialogDescription>
            </DialogHeader>
            {syncResults ? (
              <SyncResultsList results={syncResults} />
            ) : (
              <AccountSyncList
                accounts={realAccounts}
                selectedIds={selectedIds}
                onToggle={toggleAccount}
                maxSelect={3}
              />
            )}
            <DialogFooter className="gap-2">
              {syncResults ? (
                <Button size="sm" onClick={() => { setSyncOpen(false); setSelectedIds([]); setSyncResults(null); }}>
                  Fechar
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setSyncOpen(false)} disabled={syncing}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSync} disabled={!selectedIds.length || syncing} className="gap-1.5">
                    {syncing
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Zap className="w-3.5 h-3.5" />}
                    {syncing ? "Sincronizando..." : `Sincronizar${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ── Google Ads Card (real connection via Supabase) ──

function GoogleAdsCard({
  google, connections, loading, connecting, onConnect, onDisconnect, onAccountsUpdated,
}: {
  google: typeof MOCK_DSP_CONNECTIONS[number];
  connections: PlatformConnectionRow[];
  loading: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onAccountsUpdated: () => void;
}) {
  const isConnected = connections.length > 0;
  const realAccounts = connections.filter(c => c.account_id !== "pending" && c.is_selected);
  const discoveredAccounts = connections.filter(c => c.account_id !== "pending" && !c.is_selected);

  const [syncOpen, setSyncOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResultItem[] | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);

  const toggleAccount = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSync = async () => {
    if (!selectedIds.length) return;
    setSyncing(true);
    setSyncResults(null);
    try {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        results: { account_id: string; days: number; error?: string }[];
      }>("google-ads-sync", { body: { account_ids: selectedIds } });

      if (error) throw error;

      const nameFor = (id: string) => realAccounts.find(a => a.account_id === id)?.account_name || id;
      const results: SyncResultItem[] = (data?.results ?? []).map(r => ({
        account_id: r.account_id,
        account_name: nameFor(r.account_id),
        status: r.error ? "error" : r.days === 0 ? "no_data" : "success",
        message: r.error || (r.days > 0 ? `${r.days} registros importados` : undefined),
      }));
      setSyncResults(results);
      onAccountsUpdated();
    } catch (e) {
      toast({ title: "Erro na sincronização", description: String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", isConnected ? "bg-emerald-500/10" : "bg-muted")}>
              {isConnected
                ? <Wifi className="w-5 h-5 text-emerald-400" />
                : <WifiOff className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-semibold text-foreground">{google.displayName}</p>
              <p className="text-xs text-muted-foreground">{google.description}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs", isConnected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground")}>
            {loading ? "Carregando..." : isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>

        {/* Accounts summary */}
        {isConnected && (
          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400 space-y-1">
            <p>
              {realAccounts.length > 0
                ? `${realAccounts.length} conta${realAccounts.length > 1 ? "s" : ""} de anúncio conectada${realAccounts.length > 1 ? "s" : ""}`
                : "Autenticado — aguardando seleção de contas"}
            </p>
            <SyncStatusSummary accounts={realAccounts} />
          </div>
        )}

        {isConnected && discoveredAccounts.length > 0 && (
          <button
            onClick={() => setSelectOpen(true)}
            className="w-full text-left p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            {discoveredAccounts.length} conta{discoveredAccounts.length > 1 ? "s" : ""} nova{discoveredAccounts.length > 1 ? "s" : ""} descoberta{discoveredAccounts.length > 1 ? "s" : ""} — selecionar para sincronizar
          </button>
        )}

        {!isConnected && !loading && (
          <p className="text-xs text-muted-foreground">
            Conecte sua conta do Google Ads para alimentar a análise de funil com seus dados de campanha.
          </p>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          {isConnected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={() => setSyncOpen(true)}
                disabled={!realAccounts.length}
              >
                <RefreshCw className="w-3.5 h-3.5" />Sincronizar dados
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={onConnect}>
                <ShieldCheck className="w-3.5 h-3.5" />Reautenticar
              </Button>
              <Button size="sm" variant="ghost" className="text-xs gap-1.5 text-muted-foreground col-span-2" onClick={onDisconnect}>
                <Unlink className="w-3.5 h-3.5" />Desconectar
              </Button>
            </>
          ) : (
            <Button size="sm" className="text-xs gap-1.5 col-span-2" onClick={onConnect} disabled={connecting || loading}>
              <Link2 className="w-3.5 h-3.5" />{connecting ? "Redirecionando..." : "Conectar"}
            </Button>
          )}
        </div>

        {/* Account Selection Modal */}
        <AccountSelectionDialog
          open={selectOpen}
          onOpenChange={setSelectOpen}
          accounts={discoveredAccounts}
          platformLabel="Google Ads"
          onConfirm={async (ids) => {
            const { error } = await (supabase as any).from("platform_connections").update({ is_selected: true }).in("id", ids);
            if (error) {
              toast({ title: "Erro ao selecionar contas", description: error.message, variant: "destructive" });
              return;
            }
            const jobRows = discoveredAccounts.filter(a => ids.includes(a.id)).flatMap(a => ([
              { platform: "google_ads", account_id: a.account_id, range_days: 7 },
              { platform: "google_ads", account_id: a.account_id, range_days: 90 },
            ]));
            if (jobRows.length > 0) await (supabase as any).from("sync_jobs").insert(jobRows);
            toast({ title: "Contas selecionadas!", description: `${ids.length} conta${ids.length > 1 ? "s" : ""} adicionada${ids.length > 1 ? "s" : ""} ao MediaHub. A sincronização vai começar automaticamente.` });
            onAccountsUpdated();
          }}
        />

        {/* Sync Modal */}
        <Dialog open={syncOpen} onOpenChange={(open) => {
          setSyncOpen(open);
          if (!open) { setSelectedIds([]); setSyncResults(null); }
          else setSelectedIds(defaultSyncSelection(realAccounts));
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sincronizar dados do Google Ads</DialogTitle>
              <DialogDescription>
                {syncResults
                  ? "Resultado da sincronização por conta."
                  : "Novas já vêm marcadas. Nas sincronizadas, a data fica à direita — marque só para atualizar."}
              </DialogDescription>
            </DialogHeader>
            {syncResults ? (
              <SyncResultsList results={syncResults} />
            ) : (
              <AccountSyncList
                accounts={realAccounts}
                selectedIds={selectedIds}
                onToggle={toggleAccount}
              />
            )}
            <DialogFooter className="gap-2">
              {syncResults ? (
                <Button size="sm" onClick={() => { setSyncOpen(false); setSelectedIds([]); setSyncResults(null); }}>
                  Fechar
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setSyncOpen(false)} disabled={syncing}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSync} disabled={!selectedIds.length || syncing} className="gap-1.5">
                    {syncing
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Zap className="w-3.5 h-3.5" />}
                    {syncing ? "Sincronizando..." : `Sincronizar${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ── DV360 Card (real connection via Supabase) ──

function DV360Card({
  dv360, connections, loading, connecting, onConnect, onDisconnect, onAccountsUpdated,
}: {
  dv360: typeof MOCK_DSP_CONNECTIONS[number];
  connections: PlatformConnectionRow[];
  loading: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onAccountsUpdated: () => void;
}) {
  const isConnected = connections.length > 0;
  const realAccounts = connections.filter(c => c.account_id !== "pending" && c.is_selected);
  const discoveredAccounts = connections.filter(c => c.account_id !== "pending" && !c.is_selected);

  const [syncOpen, setSyncOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [syncResults, setSyncResults] = useState<SyncResultItem[] | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);

  const toggleAccount = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // O relatório do DV360 é gerado de forma assíncrona pelo Google e pode levar minutos —
  // bem mais que o limite de execução de uma Edge Function. Por isso: uma chamada inicia o
  // relatório (rápido) e o navegador fica perguntando "já ficou pronto?" a cada poucos segundos.
  const handleSync = async () => {
    if (!selectedIds.length) return;
    setSyncing(true);
    setSyncResults(null);
    setSyncProgress("Iniciando relatórios...");
    try {
      const { data: startData, error: startError } = await supabase.functions.invoke<{
        ok: boolean;
        jobs: { account_id: string; query_id?: string; report_id?: string; error?: string }[];
      }>("dv360-sync", { body: { account_ids: selectedIds } });

      if (startError) throw startError;
      const jobs = startData?.jobs ?? [];

      const results: { account_id: string; days: number; error?: string }[] = [];
      const pending = jobs.filter(j => j.query_id && j.report_id);
      for (const j of jobs) {
        if (j.error) results.push({ account_id: j.account_id, days: 0, error: j.error });
      }

      const maxAttempts = 30; // ~30 * 2s = ~60s de espera total pelo lado do navegador (relatório costuma ficar pronto em segundos)
      for (let attempt = 0; attempt < maxAttempts && pending.length > 0; attempt++) {
        setSyncProgress(`Aguardando relatório do DV360... (${jobs.length - pending.length}/${jobs.length} prontos)`);
        await sleep(2000);

        for (let i = pending.length - 1; i >= 0; i--) {
          const job = pending[i];
          const { data: pollData, error: pollError } = await supabase.functions.invoke<{ done: boolean; days?: number; error?: string }>(
            "dv360-sync-poll",
            { body: { account_id: job.account_id, query_id: job.query_id, report_id: job.report_id } }
          );
          if (pollError) continue; // tenta de novo no próximo ciclo
          if (pollData?.done) {
            results.push({ account_id: job.account_id, days: pollData.days ?? 0, error: pollData.error });
            pending.splice(i, 1);
          }
        }
      }
      for (const job of pending) {
        results.push({ account_id: job.account_id, days: 0, error: "Relatório não ficou pronto a tempo. Tente sincronizar de novo." });
      }

      const nameFor = (id: string) => realAccounts.find(a => a.account_id === id)?.account_name || id;
      const items: SyncResultItem[] = results.map(r => {
        const isNoData = r.error?.includes("Sem dados");
        return {
          account_id: r.account_id,
          account_name: nameFor(r.account_id),
          status: r.error ? (isNoData ? "no_data" : "error") : r.days > 0 ? "success" : "no_data",
          message: r.error && !isNoData ? r.error : r.days > 0 ? `${r.days} registros importados` : undefined,
        };
      });
      setSyncResults(items);
      onAccountsUpdated();
    } catch (e) {
      toast({ title: "Erro na sincronização", description: String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
      setSyncProgress("");
    }
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", isConnected ? "bg-emerald-500/10" : "bg-muted")}>
              {isConnected
                ? <Wifi className="w-5 h-5 text-emerald-400" />
                : <WifiOff className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-semibold text-foreground">{dv360.displayName}</p>
              <p className="text-xs text-muted-foreground">{dv360.description}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs", isConnected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground")}>
            {loading ? "Carregando..." : isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>

        {/* Accounts summary */}
        {isConnected && (
          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400 space-y-1">
            <p>
              {realAccounts.length > 0
                ? `${realAccounts.length} anunciante${realAccounts.length > 1 ? "s" : ""} conectado${realAccounts.length > 1 ? "s" : ""}`
                : "Autenticado — aguardando seleção de anunciantes"}
            </p>
            <SyncStatusSummary accounts={realAccounts} />
          </div>
        )}

        {isConnected && discoveredAccounts.length > 0 && (
          <button
            onClick={() => setSelectOpen(true)}
            className="w-full text-left p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            {discoveredAccounts.length} anunciante{discoveredAccounts.length > 1 ? "s" : ""} novo{discoveredAccounts.length > 1 ? "s" : ""} descoberto{discoveredAccounts.length > 1 ? "s" : ""} — selecionar para sincronizar
          </button>
        )}

        {!isConnected && !loading && (
          <p className="text-xs text-muted-foreground">
            Conecte sua conta do Display & Video 360 para alimentar a análise de funil com seus dados de campanha.
          </p>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          {isConnected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={() => setSyncOpen(true)}
                disabled={!realAccounts.length}
              >
                <RefreshCw className="w-3.5 h-3.5" />Sincronizar dados
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={onConnect}>
                <ShieldCheck className="w-3.5 h-3.5" />Reautenticar
              </Button>
              <Button size="sm" variant="ghost" className="text-xs gap-1.5 text-muted-foreground col-span-2" onClick={onDisconnect}>
                <Unlink className="w-3.5 h-3.5" />Desconectar
              </Button>
            </>
          ) : (
            <Button size="sm" className="text-xs gap-1.5 col-span-2" onClick={onConnect} disabled={connecting || loading}>
              <Link2 className="w-3.5 h-3.5" />{connecting ? "Redirecionando..." : "Conectar"}
            </Button>
          )}
        </div>

        {/* Account Selection Modal */}
        <AccountSelectionDialog
          open={selectOpen}
          onOpenChange={setSelectOpen}
          accounts={discoveredAccounts}
          platformLabel="DV360"
          onConfirm={async (ids) => {
            const { error } = await (supabase as any).from("platform_connections").update({ is_selected: true }).in("id", ids);
            if (error) {
              toast({ title: "Erro ao selecionar contas", description: error.message, variant: "destructive" });
              return;
            }
            const jobRows = discoveredAccounts.filter(a => ids.includes(a.id)).flatMap(a => ([
              { platform: "dv360", account_id: a.account_id, range_days: 7 },
              { platform: "dv360", account_id: a.account_id, range_days: 90 },
            ]));
            if (jobRows.length > 0) await (supabase as any).from("sync_jobs").insert(jobRows);
            toast({ title: "Contas selecionadas!", description: `${ids.length} conta${ids.length > 1 ? "s" : ""} adicionada${ids.length > 1 ? "s" : ""} ao MediaHub. A sincronização vai começar automaticamente.` });
            onAccountsUpdated();
          }}
        />

        {/* Sync Modal */}
        <Dialog open={syncOpen} onOpenChange={(open) => {
          setSyncOpen(open);
          if (!open) { setSelectedIds([]); setSyncResults(null); }
          else setSelectedIds(defaultSyncSelection(realAccounts));
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sincronizar dados do DV360</DialogTitle>
              <DialogDescription>
                {syncResults
                  ? "Resultado da sincronização por conta."
                  : "Novos já vêm marcados. Nos sincronizados, a data fica à direita — marque só para atualizar."}
              </DialogDescription>
            </DialogHeader>
            {syncResults ? (
              <SyncResultsList results={syncResults} />
            ) : (
              <AccountSyncList
                accounts={realAccounts}
                selectedIds={selectedIds}
                onToggle={toggleAccount}
              />
            )}
            {syncing && syncProgress && (
              <p className="text-xs text-muted-foreground">{syncProgress}</p>
            )}
            <DialogFooter className="gap-2">
              {syncResults ? (
                <Button size="sm" onClick={() => { setSyncOpen(false); setSelectedIds([]); setSyncResults(null); }}>
                  Fechar
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setSyncOpen(false)} disabled={syncing}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSync} disabled={!selectedIds.length || syncing} className="gap-1.5">
                    {syncing
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Zap className="w-3.5 h-3.5" />}
                    {syncing ? "Sincronizando..." : `Sincronizar${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════
// TEMPLATE COLUMNS — the canonical schema for uploads
// ═════════════════════════════════════════════════════════

const TEMPLATE_COLUMNS = [
  "Data", "Plataforma", "Conta", "Campanha", "Grupo de Anúncio", "Anúncio",
  "Formato", "Objetivo", "Público-Alvo", "Região", "Impressões", "Cliques",
  "CTR (%)", "CPC (R$)", "CPM (R$)", "Investimento (R$)", "Conversões",
  "Receita (R$)", "CPA (R$)", "ROAS", "Visualizações de Vídeo",
  "Taxa de Visualização (%)", "Engajamentos", "Taxa de Engajamento (%)",
  "Alcance", "Frequência", "Observações",
];

const TEMPLATE_SAMPLE_ROWS = [
  ["15/02/2026","Meta Ads","Conta Principal","Campanha Awareness Q1","Grupo 18-25","Anúncio Video 01","Video 15s","Awareness","18-25 anos, SP","São Paulo",125000,3750,"3.00","0.45","16.80",2100,42,8400,"50.00","4.00",98000,"78.40",4200,"3.36",95000,"1.32",""],
  ["15/02/2026","Google Ads","Conta Search","Campanha Search Marca","Grupo Marca Exact","Anúncio Texto Marca","Search Text","Conversão","Interesse em marca","Nacional",45000,6750,"15.00","1.20","54.00",2430,189,28350,"12.86","11.67",0,"0.00",0,"0.00",45000,"1.00","Alta performance"],
  ["14/02/2026","LinkedIn Ads","Conta Corp","Campanha B2B Leads","Grupo Decisores","Anúncio Carousel","Carousel","Lead Generation","C-Level, Diretores","Brasil",18000,540,"3.00","8.50","153.00",2754,27,0,"102.00","0.00",0,"0.00",320,"1.78",12000,"1.50","Custo elevado"],
  ["14/02/2026","TikTok Ads","Conta TK","Campanha Viral","Grupo Gen-Z","Anúncio Spark","Spark Ad","Engajamento","16-24 anos","RJ, SP",320000,9600,"3.00","0.25","7.50",2400,0,0,"0.00","0.00",256000,"80.00",28800,"9.00",280000,"1.14",""],
  ["13/02/2026","DV360","Conta Programática","Campanha Display Retargeting","IO Retarget","Banner 300x250","Display Banner","Retargeting","Visitantes 30d","Nacional",580000,4060,"0.70","0.98","6.86",3976,116,17400,"34.28","4.38",0,"0.00",0,"0.00",210000,"2.76","Otimizar criativos"],
];

function normalizeHeader(header: string): string {
  return header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function buildColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => { map[normalizeHeader(h)] = i; });
  return map;
}

function parseLocalizedNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (val == null || val === "") return 0;
  let s = String(val).replace(/[R$\s%]/g, "");
  if (/\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) { s = s.replace(/\./g, "").replace(",", "."); }
  else { s = s.replace(",", ""); }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseDateValue(val: unknown): string {
  if (val == null || val === "") return "";
  if (typeof val === "number") { const d = new Date((val - 25569) * 86400 * 1000); return d.toLocaleDateString("pt-BR"); }
  const s = String(val).trim();
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) return s;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return s;
}

// ═════════════════════════════════════════════════════════
// TAB 2: DATA UPLOAD (fully functional)
// ═════════════════════════════════════════════════════════

function UploadTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    fileName: string; total: number; processed: number; rejected: number;
    errors: string[]; preview: Record<string, unknown>[];
  } | null>(null);

  const handleDownloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ...TEMPLATE_SAMPLE_ROWS]);
    ws["!cols"] = TEMPLATE_COLUMNS.map((col) => ({ wch: Math.max(col.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, "Template MediaHub");
    const instrData = [
      ["Template Padronizado — MediaHub"], [""],
      ["Instruções de Preenchimento"], [""],
      ["1. Não altere os nomes das colunas na primeira linha."],
      ["2. Datas no formato DD/MM/AAAA."],
      ["3. Valores monetários em R$ (ex: 1234.56 ou 1.234,56)."],
      ["4. Percentuais sem o símbolo % (ex: 3.5)."],
      ["5. Campos obrigatórios: Data, Plataforma, Campanha, Investimento (R$)."],
      ["6. Plataformas: Meta Ads, Google Ads, DV360, LinkedIn Ads, TikTok Ads, Kwai Ads, Spotify Ads, Amazon DSP."],
      ["7. Campos não utilizados podem ficar em branco."],
      ["8. Máximo de 50.000 linhas por upload."],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
    wsInstr["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");
    XLSX.writeFile(wb, "MediaHub_Template_Upload.xlsx");
    toast({ title: "Template baixado!", description: "O arquivo MediaHub_Template_Upload.xlsx foi salvo." });
  }, []);

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      toast({ title: "Formato inválido", description: "Use arquivos CSV ou XLSX.", variant: "destructive" }); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 20MB.", variant: "destructive" }); return;
    }
    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (raw.length < 2) {
        toast({ title: "Arquivo vazio", description: "Nenhum dado encontrado.", variant: "destructive" });
        setIsProcessing(false); return;
      }
      const headers = (raw[0] as string[]).map(String);
      const colMap = buildColumnMap(headers);
      const allErrors: string[] = [];
      let processed = 0, rejected = 0;
      const preview: Record<string, unknown>[] = [];
      for (let i = 1; i < raw.length; i++) {
        const row = raw[i] as unknown[];
        if (!row || row.every((c) => c == null || c === "")) continue;
        const rowObj: Record<string, unknown> = {};
        headers.forEach((h, idx) => {
          const norm = normalizeHeader(h);
          if (norm.includes("data") || norm.includes("date")) { rowObj[h] = parseDateValue(row[idx]); }
          else if (norm.includes("r$") || norm.includes("investimento") || norm.includes("cpc") || norm.includes("cpm") || norm.includes("cpa") || norm.includes("roas") || norm.includes("receita") || norm.includes("impresso") || norm.includes("cliques") || norm.includes("convers") || norm.includes("alcance") || norm.includes("frequencia") || norm.includes("engajamento") || norm.includes("visualiza") || norm.includes("ctr") || norm.includes("taxa")) { rowObj[h] = parseLocalizedNumber(row[idx]); }
          else { rowObj[h] = row[idx] ?? ""; }
        });
        const errs: string[] = [];
        const dateIdx = colMap["data"]; const platIdx = colMap["plataforma"]; const campIdx = colMap["campanha"];
        const invIdx = colMap["investimento r$"] ?? colMap["investimento"];
        if (dateIdx === undefined || !row[dateIdx]) errs.push("Data ausente");
        if (platIdx === undefined || !row[platIdx]) errs.push("Plataforma ausente");
        if (campIdx === undefined || !row[campIdx]) errs.push("Campanha ausente");
        if (invIdx !== undefined && row[invIdx] && parseLocalizedNumber(row[invIdx]) < 0) errs.push("Investimento negativo");
        if (errs.length > 0) { rejected++; allErrors.push(`Linha ${i + 1}: ${errs.join(", ")}`); }
        else { processed++; if (preview.length < 5) preview.push(rowObj); }
      }
      setUploadResults({ fileName: file.name, total: raw.length - 1, processed, rejected, errors: allErrors.slice(0, 20), preview });
      toast(rejected === 0
        ? { title: "Upload processado!", description: `${processed} registros importados de ${file.name}.` }
        : { title: "Upload parcial", description: `${processed} importados, ${rejected} rejeitados.`, variant: "destructive" }
      );
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao processar", description: "Verifique o formato do arquivo.", variant: "destructive" });
    } finally { setIsProcessing(false); }
  }, []);

  const handleSheetsImport = useCallback(async () => {
    if (!sheetsUrl.trim()) { toast({ title: "URL vazia", description: "Cole a URL do Google Sheets.", variant: "destructive" }); return; }
    const match = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) { toast({ title: "URL inválida", description: "Use uma URL válida: https://docs.google.com/spreadsheets/d/ID/edit", variant: "destructive" }); return; }
    setIsProcessing(true);
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      await processFile(new File([data], `sheets_${match[1].slice(0, 8)}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    } catch {
      toast({ title: "Erro ao importar", description: "Verifique se a planilha está com acesso público (\"Qualquer pessoa com o link\").", variant: "destructive" });
      setIsProcessing(false);
    }
  }, [sheetsUrl, processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }, [processFile]);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }, [processFile]);

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileUp className="w-4 h-4 text-primary" />Enviar Dados</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          <div
            className={cn("border-2 border-dashed rounded-xl p-8 text-center space-y-3 transition-colors cursor-pointer", isDragging ? "border-primary bg-primary/5" : "border-border", isProcessing && "opacity-50 pointer-events-none")}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
          >
            {isProcessing ? <RefreshCw className="w-10 h-10 text-primary mx-auto animate-spin" /> : <Upload className="w-10 h-10 text-muted-foreground mx-auto" />}
            <div>
              <p className="text-sm font-medium">{isProcessing ? "Processando arquivo..." : isDragging ? "Solte o arquivo aqui" : "Arraste arquivos CSV ou XLSX aqui"}</p>
              <p className="text-xs text-muted-foreground mt-1">{isProcessing ? "Aguarde a validação" : "ou clique para selecionar"}</p>
            </div>
            {!isProcessing && <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><FileUp className="w-3.5 h-3.5" />Selecionar Arquivo</Button>}
          </div>

          <div className="flex items-center gap-4"><div className="flex-1 border-t border-border" /><span className="text-xs text-muted-foreground">ou</span><div className="flex-1 border-t border-border" /></div>

          <div className="flex items-center gap-3">
            <Input placeholder="Cole a URL do Google Sheets (ex: https://docs.google.com/spreadsheets/d/...)" className="flex-1 text-sm" value={sheetsUrl} onChange={(e) => setSheetsUrl(e.target.value)} disabled={isProcessing} />
            <Button size="sm" variant="outline" className="text-xs gap-1.5 whitespace-nowrap" onClick={handleSheetsImport} disabled={isProcessing || !sheetsUrl.trim()}><ExternalLink className="w-3.5 h-3.5" />Importar</Button>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Info className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-xs text-muted-foreground">Use nosso template padronizado para garantir processamento correto. Campos obrigatórios: <strong>Data, Plataforma, Campanha, Investimento (R$)</strong>.</p>
          </div>

          <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={handleDownloadTemplate}><Download className="w-3.5 h-3.5" />Baixar Template Padronizado (.xlsx)</Button>
        </CardContent>
      </Card>

      {uploadResults && (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" />Resultado: {uploadResults.fileName}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/30 text-center"><p className="text-2xl font-bold text-foreground">{uploadResults.total}</p><p className="text-xs text-muted-foreground">Total de linhas</p></div>
              <div className="p-3 rounded-lg bg-emerald-500/10 text-center"><p className="text-2xl font-bold text-emerald-400">{uploadResults.processed}</p><p className="text-xs text-muted-foreground">Processados</p></div>
              <div className="p-3 rounded-lg bg-red-500/10 text-center"><p className="text-2xl font-bold text-red-400">{uploadResults.rejected}</p><p className="text-xs text-muted-foreground">Rejeitados</p></div>
            </div>
            {uploadResults.errors.length > 0 && (
              <div className="space-y-1"><p className="text-xs font-medium text-red-400">Erros encontrados:</p><div className="max-h-32 overflow-y-auto space-y-1">{uploadResults.errors.map((err, i) => (<p key={i} className="text-xs text-muted-foreground font-mono bg-red-500/5 px-2 py-1 rounded">{err}</p>))}</div></div>
            )}
            {uploadResults.preview.length > 0 && (
              <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Preview (primeiras {uploadResults.preview.length} linhas):</p><div className="overflow-x-auto"><Table><TableHeader><TableRow>{Object.keys(uploadResults.preview[0]).slice(0, 8).map((k) => (<TableHead key={k} className="text-xs whitespace-nowrap">{k}</TableHead>))}</TableRow></TableHeader><TableBody>{uploadResults.preview.map((row, i) => (<TableRow key={i}>{Object.values(row).slice(0, 8).map((v, j) => (<TableCell key={j} className="text-xs whitespace-nowrap">{String(v ?? "")}</TableCell>))}</TableRow>))}</TableBody></Table></div></div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-primary" />Histórico de Uploads</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Arquivo</TableHead><TableHead>Tipo</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Processados</TableHead><TableHead className="text-right">Rejeitados</TableHead><TableHead className="text-right">Erros</TableHead><TableHead>Feature Store</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {MOCK_UPLOADS.map(u => {
                const st = statusBadge(u.status);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{u.fileName}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{u.fileType.toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(u.uploadedAt), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{u.recordsProcessed.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{u.recordsRejected > 0 ? <span className="text-orange-400">{u.recordsRejected}</span> : "0"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{u.validationErrors > 0 ? <span className="text-red-400">{u.validationErrors}</span> : "0"}</TableCell>
                    <TableCell>{u.featureStoreUpdated ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-xs", st.cls)}>{st.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// TAB 3: EXTERNAL WAREHOUSE
// ═════════════════════════════════════════════════════════

function WarehouseTab() {
  const handleAction = (wh: string, action: string) => {
    toast({ title: action, description: `Ação "${action}" para ${wh} iniciada.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Info className="w-4 h-4 text-primary flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Ao conectar um warehouse externo, os dados serão replicados para o warehouse interno do MediaHub.
          Nenhuma análise é executada diretamente no warehouse externo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK_WAREHOUSES.map(wh => {
          const meta = WAREHOUSE_META[wh.provider];
          const isConnected = wh.connectionStatus === "connected";

          return (
            <Card key={wh.provider} className="border-border/50 bg-card/80 backdrop-blur">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl", isConnected ? "bg-emerald-500/10" : "bg-muted")}>
                      <Database className={cn("w-5 h-5", isConnected ? meta.color : "text-muted-foreground")} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{meta.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {isConnected ? `Dataset: ${wh.datasetSelected}` : "Não conectado"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-xs", isConnected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground")}>
                    {isConnected ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>

                {isConnected && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 rounded bg-muted/30">
                      <span className="text-muted-foreground">Modo Sync</span>
                      <span className="font-medium">{wh.syncMode === "incremental" ? "Incremental" : "Completo"}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-muted/30">
                      <span className="text-muted-foreground">Último Sync</span>
                      <span className="font-medium">{wh.lastSyncAt ? format(new Date(wh.lastSyncAt), "dd/MM HH:mm") : "—"}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-muted/30 col-span-2">
                      <span className="text-muted-foreground">Compatibilidade de Schema</span>
                      <span className={cn("font-medium", wh.schemaCompatible ? "text-emerald-400" : "text-red-400")}>
                        {wh.schemaCompatible ? "Compatível" : "Incompatível"}
                      </span>
                    </div>
                  </div>
                )}

                {isConnected ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleAction(meta.displayName, "Sync Manual")}>
                      <RefreshCw className="w-3.5 h-3.5" />Sync Manual
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs gap-1.5 text-muted-foreground" onClick={() => handleAction(meta.displayName, "Desconectar")}>
                      <Unlink className="w-3.5 h-3.5" />Desconectar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" className="text-xs gap-1.5 w-full" onClick={() => handleAction(meta.displayName, "Conectar")}>
                    <Link2 className="w-3.5 h-3.5" />Conectar
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// TAB 4: SYNC HISTORY
// ═════════════════════════════════════════════════════════

function SyncHistoryTab() {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = MOCK_SYNC_HISTORY.filter(log => {
    if (platformFilter !== "all" && log.platform !== platformFilter) return false;
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    return true;
  });

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base">Histórico de Sincronizações</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Plataforma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Plataformas</SelectItem>
                <SelectItem value="meta_ads">Meta Ads</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="linkedin_ads">LinkedIn Ads</SelectItem>
                <SelectItem value="dv360">DV360</SelectItem>
                <SelectItem value="tiktok_ads">TikTok Ads</SelectItem>
                <SelectItem value="uploaded_file">Upload</SelectItem>
                <SelectItem value="external_warehouse">Warehouse</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead className="text-right">Registros</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Duração</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(log => {
              const st = statusBadge(log.status);
              const isExpanded = expandedRow === log.id;
              return (
                <>
                  <TableRow key={log.id} className={cn(log.error_message && "cursor-pointer")} onClick={() => log.error_message && setExpandedRow(isExpanded ? null : log.id)}>
                    <TableCell className="w-8">
                      {log.error_message && (
                        isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.ingestion_time), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{sourceLabels[log.source_type]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{platformLabels[log.platform] || log.platform}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{log.records_processed.toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", st.cls)}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {log.duration_ms >= 1000 ? `${(log.duration_ms / 1000).toFixed(1)}s` : `${log.duration_ms}ms`}
                    </TableCell>
                  </TableRow>
                  {isExpanded && log.error_message && (
                    <TableRow key={`${log.id}-detail`}>
                      <TableCell colSpan={7} className="bg-muted/20 border-l-2 border-red-500/50">
                        <div className="flex items-start gap-2 p-2">
                          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground">{log.error_message}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">Nenhum registro encontrado com os filtros selecionados.</div>
        )}
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════
// TAB 5: DATA HEALTH
// ═════════════════════════════════════════════════════════

function DataHealthTab() {
  const h = MOCK_TENANT_DATA_HEALTH;
  const unresolvedIssues = MOCK_VALIDATION_ISSUES.filter(v => !v.resolved_flag);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <HealthKPI
          label="Frescor dos Dados"
          value={`${h.freshnessScore}%`}
          tooltip="Percentual de fontes de dados atualizadas nas últimas 24 horas."
          status={h.freshnessScore >= 80 ? "healthy" : h.freshnessScore >= 50 ? "warning" : "critical"}
        />
        <HealthKPI
          label="Taxa de Erros"
          value={`${h.validationErrorRate}%`}
          tooltip="Percentual de registros que falharam na validação automática."
          status={h.validationErrorRate <= 2 ? "healthy" : h.validationErrorRate <= 5 ? "warning" : "critical"}
        />
        <HealthKPI
          label="Dados Ausentes"
          value={String(h.missingDataFlags)}
          tooltip="Número de fontes de dados com lacunas identificadas."
          status={h.missingDataFlags === 0 ? "healthy" : h.missingDataFlags <= 3 ? "warning" : "critical"}
        />
        <HealthKPI
          label="Schema Incompatível"
          value={String(h.schemaMismatchAlerts)}
          tooltip="Fontes com estrutura de dados diferente do esperado pelo MediaHub."
          status={h.schemaMismatchAlerts === 0 ? "healthy" : "warning"}
        />
        <HealthKPI
          label="Latência Feature Store"
          value={`${(h.featureStoreLatency / 1000).toFixed(1)}s`}
          tooltip="Tempo médio para atualizar o Feature Store após a ingestão de novos dados."
          status={h.featureStoreLatency <= 3000 ? "healthy" : h.featureStoreLatency <= 6000 ? "warning" : "critical"}
        />
      </div>

      {/* Platform freshness */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Frescor por Plataforma
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plataforma</TableHead>
                <TableHead>Último Sync</TableHead>
                <TableHead>Frescor</TableHead>
                <TableHead className="text-right">Campanhas Impactadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {h.platformFreshness.map(pf => {
                const fresh = FRESHNESS_CONFIG[pf.freshness];
                return (
                  <TableRow key={pf.platform}>
                    <TableCell className="font-medium">{pf.platform}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {pf.lastSync ? format(new Date(pf.lastSync), "dd/MM/yyyy HH:mm") : "Nunca sincronizado"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", fresh.bg, fresh.color)}>
                        {fresh.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {pf.impactedCampaigns > 0
                        ? <span className="text-sm font-medium text-orange-400">{pf.impactedCampaigns}</span>
                        : <span className="text-sm text-muted-foreground">0</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Validation Issues */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            Problemas de Validação Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unresolvedIssues.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Nenhum problema de validação pendente.
            </div>
          ) : (
            <div className="space-y-2">
              {unresolvedIssues.map(issue => (
                <div key={issue.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn("text-xs", SEVERITY_COLORS[issue.severity])}>
                      {issue.severity}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{VALIDATION_ISSUE_LABELS[issue.issue_type]}</p>
                      <p className="text-xs text-muted-foreground">Detectado em {format(new Date(issue.detected_at), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{issue.affected_record_count}</p>
                    <p className="text-xs text-muted-foreground">registros</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Explainer */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Como interpretar a saúde dos dados?</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li><span className="text-emerald-400 font-medium">● Saudável</span> — Dados atualizados, sem erros de validação, Feature Store sincronizado.</li>
            <li><span className="text-yellow-400 font-medium">● Atenção</span> — Possíveis atrasos ou pequenos erros que merecem revisão.</li>
            <li><span className="text-red-400 font-medium">● Crítico</span> — Dados desatualizados ou erros graves que afetam a precisão das análises.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Health KPI Card ──

function HealthKPI({ label, value, tooltip, status }: { label: string; value: string; tooltip: string; status: "healthy" | "warning" | "critical" }) {
  const config = HEALTH_STATUS_CONFIG[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="border-border/50 bg-card/80 backdrop-blur cursor-help">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <div className={cn("w-2 h-2 rounded-full", config.bg)} />
            </div>
            <p className={cn("text-xl font-bold", config.color)}>{value}</p>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px] text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// ═════════════════════════════════════════════════════════
// TAB 6: API KEYS
// ═════════════════════════════════════════════════════════

function ApiKeysTab() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(API_KEYS);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleGenerateKey = () => {
    if (!newKeyName.trim()) return;
    const rawKey = generateFakeApiKey();
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      tenantId: "tenant-001",
      keyName: newKeyName.trim(),
      apiKeyHash: maskApiKey(rawKey),
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      status: "active",
    };
    setApiKeys(prev => [newKey, ...prev]);
    setGeneratedKey(rawKey);
    setNewKeyName("");
    setShowKey(true);
  };

  const handleRevokeKey = (id: string) => {
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, status: "revoked" as const } : k));
    toast({ title: "API Key revogada", description: "A chave foi desativada com sucesso." });
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copiado!", description: "Chave copiada para a área de transferência." });
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">API Keys</h3>
          <p className="text-xs text-muted-foreground">Chaves para acesso à API interna — visíveis apenas na criação</p>
        </div>
        <Dialog open={showKeyDialog} onOpenChange={(open) => { setShowKeyDialog(open); if (!open) { setGeneratedKey(null); setShowKey(false); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" />Gerar Nova Chave</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar API Key</DialogTitle>
              <DialogDescription>
                {generatedKey
                  ? "Copie a chave abaixo. Ela não será exibida novamente."
                  : "Dê um nome para identificar esta chave."}
              </DialogDescription>
            </DialogHeader>
            {!generatedKey ? (
              <div className="space-y-3">
                <Input
                  placeholder="Nome da chave (ex: Production API)"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                />
                <DialogFooter>
                  <Button onClick={handleGenerateKey} disabled={!newKeyName.trim()}>Gerar</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted font-mono text-sm break-all">
                  <span className="flex-1">{showKey ? generatedKey : maskApiKey(generatedKey)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleCopyKey(generatedKey)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-orange-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Esta chave não será exibida novamente. Guarde-a em local seguro.
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowKeyDialog(false); setGeneratedKey(null); setShowKey(false); }}>Fechar</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Chave</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead>Último Uso</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.map(k => (
            <TableRow key={k.id}>
              <TableCell className="font-medium text-foreground">{k.keyName}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{k.apiKeyHash}</TableCell>
              <TableCell className="text-xs">{format(new Date(k.createdAt), "dd/MM/yyyy")}</TableCell>
              <TableCell className="text-xs">{k.lastUsedAt ? format(new Date(k.lastUsedAt), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("text-xs", k.status === "active" ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground border-border")}>
                  {k.status === "active" ? "Ativa" : "Revogada"}
                </Badge>
              </TableCell>
              <TableCell>
                {k.status === "active" && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/70 hover:text-red-400" onClick={() => handleRevokeKey(k.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════
// TAB 7: API ENDPOINTS
// ═════════════════════════════════════════════════════════

function ApiEndpointsTab() {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">API Endpoints (Read-Only)</h3>
        <p className="text-xs text-muted-foreground">Estrutura da API interna — todos scoped por tenant_id com RBAC e plano</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Endpoint</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Módulos RBAC</TableHead>
            <TableHead>Plan-Gated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {INTERNAL_API_ENDPOINTS.map(ep => (
            <TableRow key={ep.path}>
              <TableCell className="font-mono text-xs text-primary">{ep.path}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">GET</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">{ep.description}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {ep.rbacModules.map(m => (
                    <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                {ep.planGated ? (
                  <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30">Sim</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Não</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
