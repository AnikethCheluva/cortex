import { NextResponse } from "next/server";
import { readCards, readReviews } from "@/lib/srs/store";
import { computeStats, dueCount } from "@/lib/srs/stats";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET → the recall dashboard's metrics, computed from the card bank + review log.
export async function GET() {
  const [bank, reviews] = await Promise.all([readCards(), readReviews()]);
  const now = new Date().toISOString();
  const stats = computeStats(bank, reviews, now, dueCount(Object.values(bank), now));
  return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
}
