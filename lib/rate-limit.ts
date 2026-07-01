// Rate Limiting Middleware for API Protection
import type { NextRequest } from "next/server";
import { getServiceClient } from "./supabase";

const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 60; // Max requests per window

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimits = new Map<string, RateLimitEntry>();
const inMemoryStore: Record<string, { count: number; resetAt: number }[]> = {};

export function rateLimit(
  ip: string,
  maxRequests: number = MAX_REQUESTS,
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const key = `rl:${ip}`;

  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + WINDOW_MS,
    };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// Persistent rate limiting for production (in-memory with periodic cleanup)
export async function persistentRateLimit(
  identifier: string,
  action: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const client = getServiceClient();
  const windowStart = Date.now() - WINDOW_MS;

  if (client) {
    try {
      const { data, error } = await client
        .from("rate_limits")
        .select("count")
        .eq("identifier", identifier)
        .eq("action", action)
        .gt("window_start", new Date(windowStart).toISOString());

      if (error) throw error;

      const count = data?.[0]?.count || 0;
      if (count >= MAX_REQUESTS) {
        return { allowed: false, remaining: 0 };
      }

      await client.from("rate_limits").upsert({
        identifier,
        action,
        count: count + 1,
        window_start: new Date().toISOString(),
      });

      return { allowed: true, remaining: MAX_REQUESTS - count - 1 };
    } catch (e) {
      console.warn("[RATELIMIT] DB failed, using in-memory:", e);
    }
  }

  // Fallback to in-memory
  const store = inMemoryStore[action] || [];
  const now = Date.now();
  const recent = store.filter((e) => now - e.resetAt < WINDOW_MS);

  const matching = recent.find((e) => e.count < MAX_REQUESTS);
  if (matching) {
    matching.count++;
    return { allowed: true, remaining: MAX_REQUESTS - matching.count };
  }

  if (recent.length === 0) {
    inMemoryStore[action] = [{ count: 1, resetAt: now + WINDOW_MS }];
  }

  return { allowed: true, remaining: MAX_REQUESTS - 1 };
}

// Middleware wrapper for API routes
export function withRateLimit(
  handler: (req: NextRequest, context: unknown) => Promise<Response>,
) {
  return async (req: NextRequest, context: unknown) => {
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const result = rateLimit(ip);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    const response = await handler(req, context);
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.resetAt.toString());

    return response;
  };
}
