import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Link2, Plug, RefreshCw, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { displayClientName, useClient } from "@/contexts/ClientContext";
import { useAgency } from "@/hooks/useAgency";
import { useAuth } from "@/hooks/useAuth";
import { ClientAccountLinkingPanel } from "@/components/data/ClientAccountLinkingPanel";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

const STEPS = [
  { id: 1 as const, label: "Integrações", icon: Plug },
  { id: 2 as const, label: "Clientes", icon: Users },
  { id: 3 as const, label: "Vincular contas", icon: Link2 },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { agency, agencyId, onboardingPending, refresh } = useAgency();
  const { clients, refreshClients } = useClient();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [connections, setConnections] = useState<{ platform: string; is_selected: boolean }[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    const { data } = await supabase
      .from("platform_connections")
      .select("platform, is_selected, account_id")
      .neq("account_id", "pending");
    setConnections((data as { platform: string; is_selected: boolean }[]) ?? []);
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const googleError = searchParams.get("google_error");
    const dv360Error = searchParams.get("dv360_error");
    const metaError = searchParams.get("meta_error");

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

    if (connected) {
      toast({ title: "Plataforma conectada", description: "Selecione as contas em Dados & Integrações se ainda não apareceram." });
      void loadConnections();
    }
    if (metaError || googleError || dv360Error) {
      toast({ title: "Falha na conexão", description: metaError || googleError || dv360Error || "", variant: "destructive" });
    }
    if (connected || metaError || googleError || dv360Error) {
      const next = new URLSearchParams(searchParams);
      next.delete("connected");
      next.delete("meta_error");
      next.delete("google_error");
      next.delete("dv360_error");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, loadConnections]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const startOAuth = async (fn: string, platform: string) => {
    setConnecting(platform);
    const popupFeatures = [
      "width=520", "height=680",
      `left=${Math.round(window.screenX + (window.outerWidth - 520) / 2)}`,
      `top=${Math.round(window.screenY + (window.outerHeight - 680) / 2)}`,
      "menubar=no", "toolbar=no", "location=no", "status=no", "resizable=yes", "scrollbars=yes",
    ].join(",");
    const popup = platform === "meta_ads" ? null : window.open("about:blank", `${platform}_oauth_popup`, popupFeatures);

    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        fn,
        { body: { redirectOrigin: window.location.origin } }
      );
      if (error || !data?.url) throw error || new Error(data?.error || "URL não retornada");

      if (platform === "meta_ads" || !popup) {
        window.location.href = data.url;
        return;
      }

      popup.location.href = data.url;
      const source = platform === "google_ads" ? "mediahub-google-oauth" : "mediahub-dv360-oauth";
      const handleMessage = (event: MessageEvent) => {
        const payload = event.data as { source?: string; ok?: boolean } | undefined;
        if (!payload || payload.source !== source) return;
        window.removeEventListener("message", handleMessage);
        setConnecting(null);
        void loadConnections();
        if (payload.ok) toast({ title: "Conectado" });
        else toast({ title: "Falha na conexão", variant: "destructive" });
      };
      window.addEventListener("message", handleMessage);
    } catch (e) {
      popup?.close();
      toast({ title: "Erro ao iniciar conexão", description: String(e), variant: "destructive" });
      setConnecting(null);
    }
  };

  const addClient = async () => {
    if (!companyName.trim() || !agencyId) return;
    const { error } = await supabase.from("clients").insert({
      company_name: companyName.trim(),
      trade_name: tradeName.trim() || null,
      agency_id: agencyId,
      cnpj: null,
    });
    if (error) {
      toast({ title: "Não foi possível cadastrar", description: error.message, variant: "destructive" });
      return;
    }
    setCompanyName("");
    setTradeName("");
    await refreshClients();
    toast({ title: "Cliente cadastrado" });
  };

  const finish = async () => {
    if (!agencyId) return;
    setSaving(true);
    const { error } = await supabase
      .from("agencies" as never)
      .update({ onboarding_status: "active" } as never)
      .eq("id", agencyId);
    setSaving(false);
    if (error) {
      toast({ title: "Não foi possível concluir", description: error.message, variant: "destructive" });
      return;
    }
    await refresh();
    navigate("/executive-dashboard", { replace: true });
  };

  const selectedCount = connections.filter((c) => c.is_selected).length;
  const platforms = {
    meta_ads: connections.some((c) => c.platform === "meta_ads"),
    google_ads: connections.some((c) => c.platform === "google_ads"),
    dv360: connections.some((c) => c.platform === "dv360"),
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <span className="font-semibold">MediaHub</span>
          {agency && <Badge variant="outline" className="ml-2">{agency.name}</Badge>}
        </div>
        <button
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={async () => { await signOut(); navigate("/login"); }}
        >
          Sair ({user?.email})
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Configurar sua agência</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte as plataformas, cadastre os anunciantes e vincule as contas. Leva poucos minutos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={cn(
                "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm",
                step === s.id ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground"
              )}
            >
              <s.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{s.label}</span>
              {i < STEPS.length - 1 && <span className="sr-only">próximo</span>}
            </button>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Integrações</CardTitle>
              <CardDescription>
                Conecte Meta, Google Ads e DV360. Depois selecione as contas em Dados & Integrações se o OAuth descobrir várias.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "meta_ads", label: "Meta Ads", fn: "meta-oauth-start" },
                { key: "google_ads", label: "Google Ads", fn: "google-oauth-start" },
                { key: "dv360", label: "DV360", fn: "dv360-oauth-start" },
              ].map((p) => (
                <div key={p.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {platforms[p.key as keyof typeof platforms] ? "Conectado" : "Não conectado"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={platforms[p.key as keyof typeof platforms] ? "outline" : "default"}
                    disabled={connecting === p.key}
                    onClick={() => startOAuth(p.fn, p.key)}
                  >
                    {connecting === p.key ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : platforms[p.key as keyof typeof platforms] ? "Reconectar" : "Conectar"}
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{selectedCount} conta{selectedCount === 1 ? "" : "s"} selecionada{selectedCount === 1 ? "" : "s"} para sync.</p>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)}>Continuar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clientes da agência</CardTitle>
              <CardDescription>Cadastre os anunciantes. O CNPJ completo pode ficar para depois.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Razão social</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="HOTEL KEMBALI LTDA" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome fantasia</Label>
                  <Input value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Kembali Hotel" />
                </div>
              </div>
              <Button variant="outline" onClick={addClient} disabled={!companyName.trim()}>Adicionar cliente</Button>
              <ul className="space-y-1.5">
                {clients.map((c) => (
                  <li key={c.id} className="text-sm flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    {displayClientName(c)}
                  </li>
                ))}
                {clients.length === 0 && <li className="text-sm text-muted-foreground">Nenhum cliente ainda.</li>}
              </ul>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
                <Button onClick={() => setStep(3)}>Continuar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <ClientAccountLinkingPanel />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={finish} disabled={saving || !onboardingPending} className="gap-1.5">
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Concluir onboarding
              </Button>
            </div>
            {clients.length === 0 || selectedCount === 0 ? (
              <p className="text-xs text-amber-400">
                Pode concluir mesmo incompleto. Sem cliente vinculado, o painel do anunciante fica vazio até você ligar as contas.
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
