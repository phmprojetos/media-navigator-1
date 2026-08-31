import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Plus, Search, Edit, Trash2, Users, Eye } from "lucide-react";
import { toast } from "sonner";
import { Client, createEmptyClient, DEFAULT_REBATE_TIERS } from "@/types/client";
import { formatCNPJ, formatPhone, formatStateRegistration, formatMunicipalRegistration, formatCEP } from "@/lib/inputMasks";
import { PageInfoTooltip } from "@/components/ui/page-info-tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/contexts/ClientContext";
import { useAgency } from "@/hooks/useAgency";

// Map Supabase row → Client
function rowToClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    tradeName: (row.trade_name as string) ?? "",
    cnpj: row.cnpj as string,
    stateRegistration: (row.state_registration as string) ?? "",
    municipalRegistration: (row.municipal_registration as string) ?? "",
    address: (row.address as string) ?? "",
    city: (row.city as string) ?? "",
    state: (row.state as string) ?? "",
    zipCode: (row.zip_code as string) ?? "",
    country: (row.country as string) ?? "Brasil",
    contactName: (row.contact_name as string) ?? "",
    contactEmail: (row.contact_email as string) ?? "",
    contactPhone: (row.contact_phone as string) ?? "",
    notes: (row.notes as string) ?? "",
    rebateTiers: row.rebate_tiers ? (row.rebate_tiers as Client["rebateTiers"]) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Map Client → Supabase insert/update payload
function clientToRow(c: Client) {
  return {
    id: c.id,
    company_name: c.companyName,
    trade_name: c.tradeName || null,
    cnpj: c.cnpj,
    state_registration: c.stateRegistration || null,
    municipal_registration: c.municipalRegistration || null,
    address: c.address || null,
    city: c.city || null,
    state: c.state || null,
    zip_code: c.zipCode || null,
    country: c.country || "Brasil",
    contact_name: c.contactName || null,
    contact_email: c.contactEmail || null,
    contact_phone: c.contactPhone || null,
    notes: c.notes || null,
    rebate_tiers: c.rebateTiers ? JSON.stringify(c.rebateTiers) : null,
  };
}

export default function Clients() {
  const navigate = useNavigate();
  const { refreshClients } = useClient();
  const { agencyId } = useAgency();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<Client>(createEmptyClient());

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar clientes");
    } else {
      setClients((data ?? []).map(rowToClient));
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const filteredClients = clients.filter(
    (c) =>
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj.includes(search) ||
      c.contactName.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenDialog = (client?: Client) => {
    if (client) { setEditingClient(client); setFormData(client); }
    else { setEditingClient(null); setFormData(createEmptyClient()); }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.companyName || !formData.cnpj) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    const payload = {
      ...clientToRow(formData),
      ...(agencyId ? { agency_id: agencyId } : {}),
    };

    if (editingClient) {
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editingClient.id);
      if (error) { toast.error("Erro ao atualizar cliente"); return; }
      toast.success("Cliente atualizado com sucesso!");
    } else {
      const { error } = await supabase
        .from("clients")
        .insert(payload);
      if (error) { toast.error("Erro ao cadastrar cliente"); return; }
      toast.success("Cliente cadastrado com sucesso!");
    }

    setDialogOpen(false);
    setEditingClient(null);
    setFormData(createEmptyClient());
    fetchClients();
    void refreshClients();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir cliente"); return; }
    toast.success("Cliente excluído com sucesso!");
    fetchClients();
    void refreshClients();
  };

  const updateField = <K extends keyof Client>(field: K, value: Client[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const now = new Date();
  const thisMonthCount = clients.filter((c) => {
    const d = new Date(c.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const lastUpdated =
    clients.length > 0
      ? new Date(Math.max(...clients.map((c) => new Date(c.updatedAt).getTime()))).toLocaleDateString("pt-BR")
      : "-";

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Users className="w-7 h-7 text-primary" />
              Cadastro de Clientes
              <PageInfoTooltip description="Cadastre e gerencie clientes com dados fiscais para preenchimento automático em PIs e planejamentos." />
            </h1>
            <p className="text-muted-foreground">Gerencie seus clientes e use os dados na emissão de PIs</p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />Novo Cliente
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total de Clientes</div><div className="text-2xl font-bold">{clients.length}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Cadastrados este mês</div><div className="text-2xl font-bold text-primary">{thisMonthCount}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Última atualização</div><div className="text-lg font-medium">{lastUpdated}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Clientes Cadastrados</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                  ) : filteredClients.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}</TableCell></TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.tradeName || client.companyName}</TableCell>
                        <TableCell>{client.cnpj}</TableCell>
                        <TableCell>{client.contactName || "-"}</TableCell>
                        <TableCell>{client.contactEmail || "-"}</TableCell>
                        <TableCell>{client.city ? `${client.city}/${client.state}` : "-"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/clients/${client.id}`)}><Eye className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(client)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {editingClient ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Label>Razão Social *</Label><Input value={formData.companyName} onChange={(e) => updateField("companyName", e.target.value)} placeholder="Razão social da empresa" /></div>
                <div><Label>Nome Fantasia</Label><Input value={formData.tradeName} onChange={(e) => updateField("tradeName", e.target.value)} placeholder="Nome fantasia" /></div>
                <div><Label>CNPJ *</Label><Input value={formData.cnpj} onChange={(e) => updateField("cnpj", formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" /></div>
                <div><Label>Inscrição Estadual</Label><Input value={formData.stateRegistration} onChange={(e) => updateField("stateRegistration", formatStateRegistration(e.target.value))} placeholder="Isento" /></div>
                <div><Label>Inscrição Municipal</Label><Input value={formData.municipalRegistration} onChange={(e) => updateField("municipalRegistration", formatMunicipalRegistration(e.target.value))} placeholder="0.000.000-0" /></div>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Endereço</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><Label>Endereço</Label><Input value={formData.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Rua, número, complemento" /></div>
                  <div><Label>Cidade</Label><Input value={formData.city} onChange={(e) => updateField("city", e.target.value)} placeholder="Cidade" /></div>
                  <div><Label>Estado</Label><Input value={formData.state} onChange={(e) => updateField("state", e.target.value)} placeholder="UF" /></div>
                  <div><Label>CEP</Label><Input value={formData.zipCode} onChange={(e) => updateField("zipCode", formatCEP(e.target.value))} placeholder="00.000-000" /></div>
                  <div><Label>País</Label><Input value={formData.country} onChange={(e) => updateField("country", e.target.value)} placeholder="Brasil" /></div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Contato</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Nome do Contato</Label><Input value={formData.contactName} onChange={(e) => updateField("contactName", e.target.value)} placeholder="Nome do responsável" /></div>
                  <div><Label>Telefone</Label><Input value={formData.contactPhone} onChange={(e) => updateField("contactPhone", formatPhone(e.target.value))} placeholder="(00) 0.0000-0000" /></div>
                  <div className="col-span-2"><Label>Email</Label><Input type="email" value={formData.contactEmail} onChange={(e) => updateField("contactEmail", e.target.value)} placeholder="email@empresa.com" /></div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">💰 Política de Incentivo (Rebate)</h4>
                <div className="space-y-2">
                  {(formData.rebateTiers || DEFAULT_REBATE_TIERS).map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-muted/50 rounded-md px-3 py-2">
                      <span className="text-sm font-medium min-w-[60px]">{tier.label}</span>
                      <span className="text-xs text-muted-foreground flex-1">
                        {tier.maxValue
                          ? `R$ ${tier.minValue.toLocaleString("pt-BR")} – R$ ${tier.maxValue.toLocaleString("pt-BR")}`
                          : `Acima de R$ ${tier.minValue.toLocaleString("pt-BR")}`}
                      </span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" min={0} max={100} step={0.5}
                          value={tier.percentage}
                          onChange={(e) => {
                            const currentTiers = formData.rebateTiers || DEFAULT_REBATE_TIERS.map((t) => ({ ...t }));
                            const updated = currentTiers.map((t, i) =>
                              i === idx ? { ...t, percentage: parseFloat(e.target.value) || 0 } : t
                            );
                            updateField("rebateTiers", updated);
                          }}
                          className="w-20 h-8 text-center text-sm"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <Label>Observações</Label>
                <Textarea value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Anotações sobre o cliente..." rows={3} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave}>{editingClient ? "Salvar Alterações" : "Cadastrar Cliente"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
