import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Copy, Eye, EyeOff, Plus, RefreshCw, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgency, type Agency } from "@/hooks/useAgency";
import { Navigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";

type ProvisionResult = {
  agency: { id: string; name: string; slug: string; onboarding_status: string; admin_email: string };
  admin: { email: string; name: string; temporary_password: string };
};

export default function OpsAgencies() {
  const { isPlatformOps, loading: agencyLoading } = useAgency();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [credentials, setCredentials] = useState<ProvisionResult | null>(null);
  const [showPassword, setShowPassword] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agencies" as never)
      .select("id, name, slug, onboarding_status, is_platform, admin_email, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Não foi possível listar agências", description: error.message, variant: "destructive" });
      setAgencies([]);
    } else {
      setAgencies((data as Agency[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isPlatformOps) void load();
  }, [isPlatformOps]);

  const tenants = useMemo(() => agencies.filter((a) => !a.is_platform), [agencies]);

  if (agencyLoading) return null;
  if (!isPlatformOps) return <Navigate to="/" replace />;

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado` });
  };

  const handleCreate = async () => {
    if (!agencyName.trim() || !adminEmail.trim()) {
      toast({ title: "Preencha agência e e-mail do admin", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        p_agency_name: agencyName.trim(),
        p_admin_email: adminEmail.trim(),
        p_admin_name: adminName.trim() || null,
      };
      let result: (ProvisionResult & { error?: string }) | null = null;

      const rpc = await supabase.rpc("provision_agency", payload);
      if (!rpc.error && rpc.data) {
        result = rpc.data as ProvisionResult;
      } else {
        const fn = await supabase.functions.invoke<ProvisionResult & { error?: string }>(
          "provision-agency",
          { body: { agency_name: agencyName.trim(), admin_name: adminName.trim(), admin_email: adminEmail.trim() } }
        );
        if (fn.error || fn.data?.error) {
          throw new Error(fn.data?.error || rpc.error?.message || fn.error?.message || "Falha ao provisionar");
        }
        result = fn.data;
      }

      if (!result?.admin) throw new Error("Resposta inválida");
      setCredentials(result);
      setAgencyName("");
      setAdminName("");
      setAdminEmail("");
      await load();
    } catch (e) {
      toast({ title: "Não foi possível criar a agência", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Agências</h1>
              <PageInfoTooltip description="Operação cria o tenant e as credenciais do admin. A agência faz o onboarding sozinha (integrações e clientes)." />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Provisionamento interno. O admin recebe e-mail e senha temporária e cai no onboarding no primeiro acesso.
            </p>
          </div>
          <Button onClick={() => { setCredentials(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Nova agência
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenants</CardTitle>
            <CardDescription>{tenants.length} agência{tenants.length === 1 ? "" : "s"} além da plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma agência provisionada ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agência</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.slug}</p>
                      </TableCell>
                      <TableCell className="text-sm">{a.admin_email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={a.onboarding_status === "pending" ? "text-amber-400 border-amber-500/30" : "text-emerald-400 border-emerald-500/30"}>
                          {a.onboarding_status === "pending" ? "Onboarding" : "Ativa"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{credentials ? "Credenciais geradas" : "Provisionar agência"}</DialogTitle>
              <DialogDescription>
                {credentials
                  ? "Passe estes dados ao admin da agência. A senha só aparece agora."
                  : "Cria o tenant, o usuário admin e deixa o onboarding pendente."}
              </DialogDescription>
            </DialogHeader>

            {credentials ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/40 space-y-1">
                  <p className="text-xs text-muted-foreground">Agência</p>
                  <p className="font-medium">{credentials.agency.name}</p>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/40">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="font-medium truncate">{credentials.admin.email}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => copy(credentials.admin.email, "E-mail")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/40">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Senha temporária</p>
                    <p className="font-mono text-sm">{showPassword ? credentials.admin.temporary_password : "••••••••••••"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => copy(credentials.admin.temporary_password, "Senha")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-amber-400">Peça para o admin trocar a senha no primeiro acesso (Esqueci minha senha), se quiser.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome da agência</Label>
                  <Input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Ex.: Agencia Norte" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome do admin</Label>
                  <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Quem vai receber o acesso" />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail do admin</Label>
                  <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@agencia.com" />
                </div>
              </div>
            )}

            <DialogFooter>
              {credentials ? (
                <Button onClick={() => { setOpen(false); setCredentials(null); }}>Fechar</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
                  <Button onClick={handleCreate} disabled={saving} className="gap-1.5">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                    {saving ? "Criando…" : "Criar credenciais"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
