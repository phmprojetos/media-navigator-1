import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { toast } from "@/hooks/use-toast";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";

type AgencyUser = {
  user_id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
};

export default function AgencyUsers() {
  const { agency } = useAgency();
  const [users, setUsers] = useState<AgencyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_agency_users" as never);
    if (error) {
      toast({
        title: "Não foi possível listar usuários",
        description: error.message,
        variant: "destructive",
      });
      setUsers([]);
    } else {
      setUsers((data as AgencyUser[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Preencha nome, e-mail e senha", variant: "destructive" });
      return;
    }
    if (password.trim().length < 6) {
      toast({ title: "A senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("create_agency_user" as never, {
        p_name: name.trim(),
        p_email: email.trim(),
        p_password: password,
      } as never);

      if (error) throw error;
      const result = data as { ok?: boolean; user?: { email: string } } | null;
      toast({
        title: "Usuário criado",
        description: `${result?.user?.email ?? email} entrou na agência ${agency?.name ?? ""}.`,
      });
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      toast({
        title: "Não foi possível criar o usuário",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Usuários</h1>
            <Badge variant="outline" className="text-amber-400 border-amber-500/30">
              temporário
            </Badge>
            <PageInfoTooltip description="Fluxo temporário: cria o login e vincula à mesma agência de quem está autenticado. Não abre cadastro público." />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            O usuário novo fica no tenant <span className="text-foreground font-medium">{agency?.name ?? "—"}</span>
            {agency?.is_platform ? " (plataforma)" : ""}.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cadastrar usuário</CardTitle>
            <CardDescription>Nome, e-mail e senha. Sem tela pública de signup.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-3 md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Nome</Label>
                <Input
                  id="user-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-email">E-mail</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@redmedia.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-password">Senha</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
              </div>
              <div className="md:col-span-3">
                <Button type="submit" disabled={saving} className="gap-1.5">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  {saving ? "Criando…" : "Criar usuário"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Usuários do tenant</CardTitle>
              <CardDescription>
                {loading ? "Carregando…" : `${users.length} usuário${users.length === 1 ? "" : "s"}`}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário neste tenant.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
