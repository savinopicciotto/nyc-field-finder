import { NextResponse } from "next/server";
import { CURATED_PARKS, SPORTS, type Sport } from "@/lib/parks";
import { fetchPermitsForParks } from "@/lib/nycParks";
import { computeFieldAvailability } from "@/lib/availability";
import type { AvailabilityResponse, FieldAvailability } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 0;

const DEFAULT_WINDOW_START = 6;
const DEFAULT_WINDOW_END = 22;
const MAX_DAYS = 30;

function parseLocalDate(s: string): Date | null {
  // Accept "YYYY-MM-DD". Construct a *local* midnight.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sport = url.searchParams.get("sport") as Sport | null;
  const startStr = url.searchParams.get("start");
  const endStr = url.searchParams.get("end");

  if (!sport || !SPORTS.includes(sport)) {
    return NextResponse.json(
      { error: `sport must be one of: ${SPORTS.join(", ")}` },
      { status: 400 },
    );
  }

  const startDate = startStr ? parseLocalDate(startStr) : null;
  const endDate = endStr ? parseLocalDate(endStr) : null;
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "start and end must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "end must be on or after start" },
      { status: 400 },
    );
  }
  const days = Math.round(
    (endDate.getTime() - startDate.getTime()) / 86_400_000,
  );
  if (days > MAX_DAYS) {
    return NextResponse.json(
      { error: `date range too large (max ${MAX_DAYS} days)` },
      { status: 400 },
    );
  }

  const { results, errors } = await fetchPermitsForParks(
    CURATED_PARKS.map((p) => p.code),
    4,
  );

  const fields: FieldAvailability[] = [];
  for (const park of CURATED_PARKS) {
    const permits = results.get(park.code);
    if (!permits) continue;
    const parkFields = computeFieldAvailability({
      parkCode: park.code,
      parkName: park.name,
      borough: park.borough,
      permits,
      sport,
      startDate,
      endDate,
      windowStartHour: DEFAULT_WINDOW_START,
      windowEndHour: DEFAULT_WINDOW_END,
    });
    fields.push(...parkFields);
  }

  const warnings: string[] = [];
  for (const [code, msg] of errors) {
    const park = CURATED_PARKS.find((p) => p.code === code);
    warnings.push(`Could not load ${park?.name ?? code}: ${msg}`);
  }

  const body: AvailabilityResponse = {
    sport,
    startDate: startStr!,
    endDate: endStr!,
    windowStartHour: DEFAULT_WINDOW_START,
    windowEndHour: DEFAULT_WINDOW_END,
    fields,
    warnings,
    fetchedAt: new Date().toISOString(),
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
