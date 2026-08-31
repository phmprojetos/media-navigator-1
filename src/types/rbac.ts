// RBAC Types for MediaHub Phase 1

export type AppRole = 
  | "media_operator"
  | "bi_analyst"
  | "finance"
  | "sales"
  | "executive"
  | "admin"
  | "super_admin";

export type AccessLevel = "none" | "read" | "full";

export interface RolePermission {
  role: AppRole;
  module: string;
  access: AccessLevel;
}

export interface NavigationGroup {
  id: string;
  label: string;
  modules: NavigationModule[];
}

export interface NavigationModule {
  name: string;
  href: string;
  icon: string;
  moduleKey: string; // Used for permission lookup
}

// Permission matrix: role -> module -> access level
export const ROLE_PERMISSIONS: Record<AppRole, Record<string, AccessLevel>> = {
  super_admin: {
    // Super admin has full access to everything including platform console
    dashboard: "full",
    planning: "full",
    taxonomy: "full",
    urls: "full",
    checklists: "full",
    creatives: "full",
    efficiency: "full",
    audit: "full",
    "insertion-orders": "full",
    clients: "full",
    suppliers: "full",
    "executive-dashboard": "full",
    "agency-index": "full",
    integrations: "full",
    settings: "full",
    profitability: "full",
    maturity: "full",
    proposals: "full",
    sla: "full",
    sales: "full",
    "creative-intelligence": "full",
    knowledge: "full",
    simulation: "full",
    governance: "full",
    incentives: "full",
    narrative: "full",
    alerts: "full",
    benchmark: "full",
    "financial-overview": "full",
    "optimization-center": "full",
    "subscription": "full",
    "agency-settings": "full",
    "integration-center": "full",
    "daily-brief": "full",
    "weekly-review": "full",
    "monthly-executive": "full",
    "impact": "full",
    "ai-insights": "full",
    "statistical-intelligence": "full",
    "pattern-intelligence": "full",
    "data-integrations": "full",
    "platform-console": "full",
    "ops-agencies": "full",
    "architecture": "full",
    "intelligence-overview": "full",
    "lead-gen": "full",
    "channels-formats": "full",
  },
  admin: {
    // Admin has full access to everything
    dashboard: "full",
    planning: "full",
    taxonomy: "full",
    urls: "full",
    checklists: "full",
    creatives: "full",
    efficiency: "full",
    audit: "full",
    "insertion-orders": "full",
    clients: "full",
    suppliers: "full",
    "executive-dashboard": "full",
    "agency-index": "full",
    integrations: "full",
    settings: "full",
    profitability: "full",
    maturity: "full",
    proposals: "full",
    sla: "full",
    sales: "full",
    "creative-intelligence": "full",
    knowledge: "full",
    simulation: "full",
    governance: "full",
    incentives: "full",
    narrative: "full",
    alerts: "full",
    benchmark: "full",
    "financial-overview": "full",
    "optimization-center": "full",
    "subscription": "full",
    "agency-settings": "full",
    "integration-center": "full",
    "daily-brief": "full",
    "weekly-review": "full",
    "monthly-executive": "full",
    "impact": "full",
    "ai-insights": "full",
    "statistical-intelligence": "full",
    "pattern-intelligence": "full",
    "data-integrations": "full",
    "architecture": "full",
    "intelligence-overview": "full",
    "lead-gen": "full",
    "channels-formats": "full",
  },
  media_operator: {
    dashboard: "full",
    planning: "full",
    taxonomy: "full",
    urls: "full",
    checklists: "full",
    creatives: "full",
    efficiency: "read",
    audit: "read",
    integrations: "full",
    "intelligence-overview": "read",
    "lead-gen": "full",
    "channels-formats": "full",
  },
  bi_analyst: {
    dashboard: "read",
    planning: "read",
    taxonomy: "read",
    urls: "read",
    checklists: "read",
    creatives: "read",
    efficiency: "full",
    audit: "full",
    "creative-intelligence": "full",
    knowledge: "full",
    simulation: "full",
    "daily-brief": "read",
    "weekly-review": "read",
    "ai-insights": "read",
    "statistical-intelligence": "read",
    "pattern-intelligence": "read",
    "intelligence-overview": "full",
  },
  finance: {
    "insertion-orders": "full",
    clients: "full",
    suppliers: "full",
    profitability: "full",
  },
  sales: {
    audit: "read",
    "executive-dashboard": "read",
    sales: "full",
    proposals: "full",
  },
  executive: {
    "executive-dashboard": "full",
    "agency-index": "full",
    efficiency: "read",
    profitability: "read",
    narrative: "full",
    "monthly-executive": "full",
    "daily-brief": "read",
    "weekly-review": "full",
    "impact": "read",
    "ai-insights": "read",
    "statistical-intelligence": "read",
    "pattern-intelligence": "read",
    "intelligence-overview": "full",
  },
};

/**
 * Merges permissions from multiple roles.
 * Higher access level wins (full > read > none).
 */
export function mergePermissions(roles: AppRole[]): Record<string, AccessLevel> {
  const merged: Record<string, AccessLevel> = {};
  
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role] || {};
    for (const [module, access] of Object.entries(perms)) {
      const current = merged[module] || "none";
      if (accessRank(access) > accessRank(current)) {
        merged[module] = access;
      }
    }
  }
  
  return merged;
}

function accessRank(level: AccessLevel): number {
  switch (level) {
    case "none": return 0;
    case "read": return 1;
    case "full": return 2;
  }
}

/**
 * Check if a user with given roles can access a module.
 */
export function canAccessModule(roles: AppRole[], moduleKey: string): boolean {
  const perms = mergePermissions(roles);
  return (perms[moduleKey] || "none") !== "none";
}

/**
 * Get the access level for a module given user roles.
 */
export function getModuleAccess(roles: AppRole[], moduleKey: string): AccessLevel {
  const perms = mergePermissions(roles);
  return perms[moduleKey] || "none";
}
