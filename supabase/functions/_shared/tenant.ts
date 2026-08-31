export type AgencyContext = {
  agencyId: string | null;
  onboardingPending: boolean;
};

export async function getUserAgencyContext(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
): Promise<AgencyContext> {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id, agencies(onboarding_status)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!data) return { agencyId: null, onboardingPending: false };
  const agencies = data.agencies as { onboarding_status?: string } | { onboarding_status?: string }[] | null;
  const agency = Array.isArray(agencies) ? agencies[0] : agencies;
  return {
    agencyId: data.agency_id as string,
    onboardingPending: agency?.onboarding_status === "pending",
  };
}

export function oauthAppPath(onboardingPending: boolean): string {
  return onboardingPending ? "/onboarding" : "/data-integrations";
}
