import { DurableObject } from "cloudflare:workers";

type Env = {
  PRODUCTION: Fetcher;
};

const productionOrigin = "https://murmur.q9labs.ai";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const productionUrl = new URL(`${url.pathname}${url.search}`, productionOrigin);
    return env.PRODUCTION.fetch(new Request(productionUrl, request));
  },
} satisfies ExportedHandler<Env>;

export class RateLimitDurableObject extends DurableObject {
  override fetch(): Response {
    return new Response("Gone", { status: 410 });
  }
}

export class CustomerLedgerDurableObject extends DurableObject {
  override fetch(): Response {
    return new Response("Gone", { status: 410 });
  }
}
