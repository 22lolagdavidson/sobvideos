import "server-only";
import { prisma } from "@/lib/db";

export class RateLimited extends Error {}

/**
 * Fixed one-hour window per user and bucket, stored in Postgres so it works across
 * serverless instances. Throws RateLimited when over the limit.
 */
export async function rateLimit(bucket: "ai" | "tts", userId: string) {
  const limit = Number(bucket === "ai" ? process.env.RATE_LIMIT_AI_PER_HOUR || 20 : process.env.RATE_LIMIT_TTS_PER_HOUR || 10);
  const hour = new Date().toISOString().slice(0, 13);
  const key = `${bucket}:${userId}:${hour}`;
  const row = await prisma.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, expiresAt: new Date(Date.now() + 2 * 3600_000) },
    update: { count: { increment: 1 } },
  });
  if (row.count > limit) throw new RateLimited(`You've hit the limit of ${limit} per hour. Try again later.`);
  if (Math.random() < 0.02) await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
