import type { MurmurPlan } from "./planCatalog";

export type PaywallKey = "pack" | "monthly" | "yearly";
export type PaywallChoices = {
  pack: MurmurPlan | undefined;
  monthly: MurmurPlan | undefined;
  yearly: MurmurPlan | undefined;
  defaultKey: PaywallKey | null;
};

export function paywallChoices(plans: MurmurPlan[]): PaywallChoices {
  const pack = plans.find((plan) => plan.term === "pack" && (plan.id === "trip_pass_60" || plan.id === "trip_pass_30"));
  const monthly = plans.find((plan) => plan.term === "monthly" && plan.tier === "pro");
  const yearly = plans.find((plan) => plan.term === "yearly" && plan.tier === "pro");
  return { pack, monthly, yearly, defaultKey: pack ? "pack" : yearly ? "yearly" : monthly ? "monthly" : null };
}
