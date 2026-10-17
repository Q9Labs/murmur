// Evaluation order matters: silence arbitrary dependency console writes before SDK imports.
import "./observability/consoleBoundary";
import worker from "./index";
import type { Env } from "./env";
import { withRequestLogPrivacy } from "./privacy";

export { CustomerLedgerDurableObject, RateLimitDurableObject } from "./index";
export default {
  ...worker,
  fetch: (request: Request, env: Env, context?: ExecutionContext) =>
    withRequestLogPrivacy(request, () => worker.fetch(request, env, context)),
};
