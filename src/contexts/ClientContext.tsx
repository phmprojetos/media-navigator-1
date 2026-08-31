import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";

export interface AgencyClient {
  id: string;
  companyName: string;
  tradeName: string;
}

interface ClientContextType {
  clients: AgencyClient[];
  selectedClientId: string | null;
  selectedClient: AgencyClient | null;
  loading: boolean;
  setSelectedClientId: (id: string | null) => void;
  refreshClients: () => Promise<void>;
}

const STORAGE_KEY = "mediahub_selected_client_id";

const ClientContext = createContext<ClientContextType | null>(null);

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClient must be used within ClientProvider");
  return ctx;
}

function mapRow(row: {
  id: string;
  company_name: string;
  trade_name: string | null;
}): AgencyClient {
  return {
    id: row.id,
    companyName: row.company_name,
    tradeName: row.trade_name ?? "",
  };
}

export function displayClientName(client: AgencyClient): string {
  return client.tradeName || client.companyName;
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const { agencyId, loading: agencyLoading } = useAgency();
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshClients = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("clients")
      .select("id, company_name, trade_name")
      .order("company_name", { ascending: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (agencyId) query = (query as any).eq("agency_id", agencyId);

    const { data, error } = await query;

    if (error && /agency_id|schema cache|column/i.test(error.message)) {
      const fallback = await supabase
        .from("clients")
        .select("id, company_name, trade_name")
        .order("company_name", { ascending: true });
      if (fallback.error) {
        console.error("Failed to load clients:", fallback.error);
        setClients([]);
        setSelectedClientIdState(null);
        setLoading(false);
        return;
      }
      applyList((fallback.data ?? []).map(mapRow));
      return;
    }

    if (error) {
      console.error("Failed to load clients:", error);
      setClients([]);
      setSelectedClientIdState(null);
      setLoading(false);
      return;
    }

    applyList((data ?? []).map(mapRow));

    function applyList(mapped: AgencyClient[]) {
      setClients(mapped);
      setSelectedClientIdState((prev) => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (prev && mapped.some((c) => c.id === prev)) return prev;
        if (stored && mapped.some((c) => c.id === stored)) return stored;
        return mapped[0]?.id ?? null;
      });
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    if (agencyLoading) return;
    void refreshClients();
  }, [agencyLoading, refreshClients]);

  const setSelectedClientId = useCallback((id: string | null) => {
    setSelectedClientIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const value = useMemo<ClientContextType>(
    () => ({
      clients,
      selectedClientId,
      selectedClient,
      loading: loading || agencyLoading,
      setSelectedClientId,
      refreshClients,
    }),
    [clients, selectedClientId, selectedClient, loading, agencyLoading, setSelectedClientId, refreshClients]
  );

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}
