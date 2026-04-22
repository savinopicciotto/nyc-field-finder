import Papa from "papaparse";
import type { Permit } from "./types";
import { normalizeSport } from "./parks";

const CSV_BASE = "https://www.nycgovparks.org/permits/field-and-court/issued";
// NYC Parks' CDN rejects non-browser User-Agents (see README). We send a
// standard Chrome UA so the CSV downloads work. All fetches are cached
// server-side for 1 hour to stay well under the politeness threshold a human
// using the official site would hit.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 10_000;

type CacheEntry = { permits: Permit[]; at: number };
const cache = new Map<string, CacheEntry>();

interface CsvRow {
  Start: string;
  End: string;
  Field: string;
  "Sport or Event Type": string;
  "Event Name": string;
  Organization: string;
  "Event Status": string;
}

/** Parse a CSV date like `"3/20/2026 4:00 p.m."` into a Date (NYC local). */
export function parseCsvDate(raw: string): Date | null {
  const s = raw.trim().toLowerCase().replace(/\./g, "");
  // "3/20/2026 4:00 pm"
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/,
  );
  if (!m) return null;
  const [, mo, d, y, h, mi, ap] = m;
  let hour = Number(h) % 12;
  if (ap === "pm") hour += 12;
  // We keep NYC local semantics by constructing from local fields; the server
  // may run in UTC but since we never convert to UTC for display, the hour
  // arithmetic downstream uses the local hour directly.
  return new Date(Number(y), Number(mo) - 1, Number(d), hour, Number(mi), 0, 0);
}

/**
 * Fetch the issued-permits CSV for one park and parse it into `Permit`s.
 * In-memory cached for 1 hour to respect NYC Parks.
 */
export async function fetchPermitsForPark(code: string): Promise<Permit[]> {
  const cached = cache.get(code);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.permits;
  }

  const url = `${CSV_BASE}/${code}/csv`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let text: string;
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/csv,text/plain,*/*",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`NYC Parks CSV ${code}: HTTP ${res.status}`);
    }
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const permits: Permit[] = [];
  for (const row of parsed.data) {
    const start = parseCsvDate(row.Start);
    const end = parseCsvDate(row.End);
    if (!start || !end) continue;
    const sportRaw = (row["Sport or Event Type"] ?? "").trim();
    // Closures/events block the field regardless of sport.
    const sportBucket = normalizeSport(sportRaw) ?? "__blocker__";
    permits.push({
      start,
      end,
      fieldName: (row.Field ?? "").trim(),
      sport: sportBucket,
      sportRaw,
      eventName: (row["Event Name"] ?? "").trim(),
      organization: (row.Organization ?? "").trim(),
      status: (row["Event Status"] ?? "").trim(),
    });
  }

  cache.set(code, { permits, at: Date.now() });
  return permits;
}

/**
 * Fetch many parks in parallel with a simple concurrency cap. Failures on
 * individual parks are captured but do not fail the batch — the caller
 * gets warnings for any that failed.
 */
export async function fetchPermitsForParks(
  codes: string[],
  concurrency = 4,
): Promise<{ results: Map<string, Permit[]>; errors: Map<string, string> }> {
  const results = new Map<string, Permit[]>();
  const errors = new Map<string, string>();
  let cursor = 0;

  async function worker() {
    while (cursor < codes.length) {
      const i = cursor++;
      const code = codes[i];
      try {
        results.set(code, await fetchPermitsForPark(code));
      } catch (err) {
        errors.set(code, err instanceof Error ? err.message : String(err));
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, codes.length) }, worker),
  );
  return { results, errors };
}
