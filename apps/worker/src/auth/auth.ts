/// <reference types="@cloudflare/workers-types" />

import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { anonymous, emailOTP } from "better-auth/plugins";

import { freeAllowancePeriod } from "../billing/allowancePeriods";
import { ensureCurrentAllowance } from "../billing/allowanceService";
import { callCustomerLedger } from "../billing/customerLedgerDurableObject";
import {
  freeAllowanceClaimHashFromRequest,
  transferFreeAllowanceClaim,
} from "../billing/freeAllowanceClaims";
import { mergeGuestCustomer } from "../billing/guestAccountMerge";
import type { Env } from "../env";

const localDevelopmentSecret = "murmur-local-development-secret-change-before-deploy";
const guestEmailDomain = "guest.murmur.invalid";

export function createMurmurAuth(
  env: Env,
  request?: Request,
  _context?: ExecutionContext,
) {
  const database = env.BILLING_DB;
  const secret = env.BETTER_AUTH_SECRET?.trim() ||
    (env.MURMUR_ENV === "development" ? localDevelopmentSecret : null);
  if (!database || !secret) {
    return null;
  }

  return betterAuth({
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
        disableImplicitLinking: true,
      },
      encryptOAuthTokens: true,
    },
    advanced: {
      cookiePrefix: "murmur",
      database: {
        generateId: () => crypto.randomUUID(),
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
    basePath: "/api/auth",
    baseURL: env.BETTER_AUTH_URL ?? "https://murmur.q9labs.ai/api/auth",
    database,
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const nowMs = Date.now();
            await bootstrapFreeAllowance(
              env,
              request,
              user.id,
              user.email.endsWith(`@${guestEmailDomain}`) ? "anonymous" : "email",
              nowMs,
            );
          },
        },
        delete: {
          before: async (user) => {
            const deletion = await callCustomerLedger(env.CUSTOMER_LEDGER, user.id, {
              action: "delete_customer",
              customerId: user.id,
              nowMs: Date.now(),
            });
            if (!deletion.result.ok) {
              throw new Error(`customer deletion failed: ${deletion.result.code}`);
            }
          },
        },
      },
    },
    plugins: [
      expo(),
      anonymous({
        emailDomainName: guestEmailDomain,
        generateName: () => "Guest",
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          const nowMs = Date.now();
          await bootstrapFreeAllowance(env, request, anonymousUser.user.id, "anonymous", nowMs);
          const freeClaimHash = request
            ? await freeAllowanceClaimHashFromRequest(request, env)
            : null;
          if (!freeClaimHash) {
            throw new Error("Free allowance identity is missing during account registration");
          }
          await transferFreeAllowanceClaim({
            claimHash: freeClaimHash,
            database: env.BILLING_DB,
            destinationCustomerId: newUser.user.id,
            nowMs,
            periodKey: freeAllowancePeriod(nowMs).periodKey,
            sourceCustomerId: anonymousUser.user.id,
          });
          await bootstrapFreeAllowance(env, request, newUser.user.id, "email", nowMs);
          await mergeGuestCustomer({
            database: env.BILLING_DB,
            destinationCustomerId: newUser.user.id,
            nowMs,
            sourceCustomerId: anonymousUser.user.id,
          });
        },
      }),
      emailOTP({
        expiresIn: 600,
        otpLength: 6,
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: async ({ email, otp }) => {
          await sendOtpEmail(env, email, otp);
        },
        storeOTP: "hashed",
      }),
    ],
    rateLimit: {
      enabled: true,
      max: 20,
      window: 60,
    },
    secret,
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      freshAge: 60 * 60 * 24,
      updateAge: 60 * 60 * 24,
    },
    user: {
      deleteUser: { enabled: true },
    },
    trustedOrigins: trustedOrigins(env.MURMUR_ENV),
  });
}

async function bootstrapFreeAllowance(
  env: Env,
  request: Request | undefined,
  customerId: string,
  principalProvider: "anonymous" | "email",
  nowMs: number,
): Promise<void> {
  const freeClaimHash = request
    ? await freeAllowanceClaimHashFromRequest(request, env)
    : null;
  const ledger = await ensureCurrentAllowance({
    customerId,
    env,
    freeClaimHash,
    nowMs,
    principalProvider,
  });
  if (!ledger.result.ok) {
    throw new Error(`customer bootstrap failed: ${ledger.result.code}`);
  }
}

export async function getMurmurSession(
  request: Request,
  env: Env,
  context?: ExecutionContext,
) {
  const auth = createMurmurAuth(env, request, context);
  if (!auth) {
    return null;
  }
  return auth.api.getSession({ headers: request.headers });
}

async function sendOtpEmail(env: Env, email: string, otp: string): Promise<void> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("email delivery is not configured");
  }
  const result = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from,
      subject: "Your Murmur sign-in code",
      text: `Your Murmur sign-in code is ${otp}. It expires in 10 minutes.`,
      to: [email],
    }),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!result.ok) {
    throw new Error(`email delivery failed with status ${result.status}`);
  }
}

function trustedOrigins(environment: string | undefined): string[] {
  const origins = ["murmur://", "murmur://*", "https://murmur.q9labs.ai"];
  if (environment !== "production") {
    origins.push("exp://", "exp://**", "http://localhost:*", "http://127.0.0.1:*");
  }
  return origins;
}
