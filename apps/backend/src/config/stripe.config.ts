export const STRIPE_PRICES = {
  PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY || "price_1Tw3LtC8RNlc853MrrcSs283",
  PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY || "price_1Tw3hPC8RNlc853MpiOM6xZR",
  AGENCY_MONTHLY: process.env.STRIPE_PRICE_AGENCY_MONTHLY || "price_1Tw3MhC8RNlc853MOFMwLf29",
  AGENCY_YEARLY: process.env.STRIPE_PRICE_AGENCY_YEARLY || "price_1Tw3kcC8RNlc853MZgdWsTpo",
};

export function getPlanDetailsFromPriceId(priceId?: string | null, uploadCredits?: number) {
  if (priceId === STRIPE_PRICES.AGENCY_MONTHLY || priceId === STRIPE_PRICES.AGENCY_YEARLY) {
    return { plan: "AGENCY" as const, monthlyCredits: 500 };
  }
  if (priceId === STRIPE_PRICES.PRO_MONTHLY || priceId === STRIPE_PRICES.PRO_YEARLY) {
    return { plan: "PRO" as const, monthlyCredits: 100 };
  }
  if (typeof uploadCredits === "number" && uploadCredits >= 500) {
    return { plan: "AGENCY" as const, monthlyCredits: 500 };
  }
  if (typeof uploadCredits === "number" && uploadCredits >= 100) {
    return { plan: "PRO" as const, monthlyCredits: 100 };
  }
  return { plan: "FREE" as const, monthlyCredits: 10 };
}
