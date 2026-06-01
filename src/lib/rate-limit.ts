import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const limiter = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "mfm-rl",
    })
  : null;

export async function checkRateLimit(
  identifier: string,
): Promise<{ success: boolean }> {
  if (!limiter) return { success: true }; // graceful no-op without creds
  const { success } = await limiter.limit(identifier);
  return { success };
}
