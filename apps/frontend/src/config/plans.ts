export interface PlanConfig {
  maxWorkspaces: number;
  maxCredits: number;
  allowScheduling: boolean;
  allowTelegram: boolean;
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  FREE: {
    maxWorkspaces: 1,
    maxCredits: 10,
    allowScheduling: false,
    allowTelegram: false,
  },
  PRO: {
    maxWorkspaces: 3,
    maxCredits: 100,
    allowScheduling: true,
    allowTelegram: true,
  },
  AGENCY: {
    maxWorkspaces: Infinity,
    maxCredits: 500,
    allowScheduling: true,
    allowTelegram: true,
  },
};

export function getPlanConfig(planTier?: string): PlanConfig {
  const normalized = (planTier || "PRO").toUpperCase();
  return PLAN_CONFIGS[normalized] || PLAN_CONFIGS.PRO;
}
