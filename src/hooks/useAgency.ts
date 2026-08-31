import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Bootstrap UUID da Redmedia (migration 20260805180000). */
export const REDMEDIA_AGENCY_ID = "a0000000-0000-4000-8000-000000000001";

export interface Agency {
  id: string;
  name: string;
  slug: string;
  onboarding_status?: "pending" | "active";
  is_platform?: boolean;
  admin_email?: string | null;
}

interface UseAgencyResult {
  agency: Agency | null;
  agencyId: string | null;
  isPlatformOps: boolean;
  onboardingPending: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Agência (empresa) do usuário logado.
 * Sem membership: agency fica null — não cai mais na Redmedia.
 */
export function useAgency(): UseAgencyResult {
  const { user } = useAuth();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setAgency(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: membership, error } = await supabase
      .from("agency_members" as never)
      .select("agency_id, agencies(id, name, slug, onboarding_status, is_platform, admin_email)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error && /onboarding_status|is_platform|admin_email|schema cache|column/i.test(error.message)) {
      const fallback = await supabase
        .from("agency_members" as never)
        .select("agency_id, agencies(id, name, slug)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!fallback.error && fallback.data) {
        const row = fallback.data as { agency_id: string; agencies: Agency | Agency[] | null };
        const ag = Array.isArray(row.agencies) ? row.agencies[0] : row.agencies;
        if (ag) {
          setAgency({
            ...ag,
            onboarding_status: ag.id === REDMEDIA_AGENCY_ID ? "active" : "pending",
            is_platform: ag.id === REDMEDIA_AGENCY_ID,
          });
          setLoading(false);
          return;
        }
      }
    }

    if (!error && membership) {
      const row = membership as {
        agency_id: string;
        agencies: Agency | Agency[] | null;
      };
      const ag = Array.isArray(row.agencies) ? row.agencies[0] : row.agencies;
      if (ag) {
        setAgency(ag);
        setLoading(false);
        return;
      }
    }

    if (error && /agency_members|schema cache|does not exist/i.test(error.message)) {
      setAgency({ id: REDMEDIA_AGENCY_ID, name: "Redmedia", slug: "redmedia", onboarding_status: "active", is_platform: true });
      setLoading(false);
      return;
    }

    setAgency(null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      agency,
      agencyId: agency?.id ?? null,
      isPlatformOps: agency?.is_platform === true,
      onboardingPending: agency?.onboarding_status === "pending",
      loading,
      refresh,
    }),
    [agency, loading, refresh]
  );
}
