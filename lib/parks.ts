import type { Park } from "./types";

/**
 * Curated list of 15 NYC parks across all five boroughs. These were selected by
 * hand for demo purposes: every entry has been verified to return a non-empty
 * CSV at the NYC Parks `/permits/field-and-court/issued/{code}/csv` endpoint.
 * Extending this list = appending one line.
 */
export const CURATED_PARKS: Park[] = [
  // Manhattan
  { code: "M010", name: "Central Park", borough: "Manhattan" },
  { code: "M144", name: "East River Park", borough: "Manhattan" },
  { code: "M165", name: "Baruch Playground", borough: "Manhattan" },
  { code: "M017", name: "Corlears Hook", borough: "Manhattan" },
  { code: "M200", name: "Booker T. Washington Playground", borough: "Manhattan" },

  // Brooklyn
  { code: "B058", name: "McCarren Park", borough: "Brooklyn" },
  { code: "B073", name: "Prospect Park", borough: "Brooklyn" },
  { code: "B111", name: "Washington Park", borough: "Brooklyn" },
  { code: "B529", name: "Bushwick Inlet Park", borough: "Brooklyn" },

  // Queens
  { code: "Q099", name: "Flushing Meadows Corona Park", borough: "Queens" },
  { code: "Q020", name: "Highland Park", borough: "Queens" },
  { code: "Q086", name: "Flushing Fields", borough: "Queens" },
  { code: "Q471", name: "Hunter's Point South Park", borough: "Queens" },

  // Bronx
  { code: "X039", name: "Pelham Bay Park", borough: "Bronx" },
  { code: "X002", name: "Bronx Park", borough: "Bronx" },

  // Staten Island
  { code: "R017", name: "Freshkills Park", borough: "Staten Island" },
];

/**
 * The umbrella sport taxonomy the UI exposes. The CSV sport column is
 * more granular (e.g. "Baseball - 12 and Under (Little League)") so we
 * normalize to these buckets. See `normalizeSport`.
 */
export const SPORTS = [
  "Soccer",
  "Baseball",
  "Softball",
  "Basketball",
  "Football",
  "Volleyball",
  "Handball",
  "Tennis",
  "Cricket",
  "Rugby",
  "Lacrosse",
  "Kickball",
  "Track & Field",
  "Hockey",
  "Bocce",
  "Frisbee",
] as const;

export type Sport = (typeof SPORTS)[number];

/**
 * Normalize a raw CSV sport cell to one of the UI buckets. Unknown values
 * return `null` so the caller can decide to hide, warn, or pass through.
 * "Full Closure" / "Special Event" still block a field for every sport
 * but don't belong to a sport bucket — handled by callers, not here.
 */
export function normalizeSport(raw: string): Sport | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("baseball")) return "Baseball";
  if (s.startsWith("softball")) return "Softball";
  if (s.startsWith("soccer")) return "Soccer";
  if (s.startsWith("football")) return "Football";
  if (s.startsWith("basketball")) return "Basketball";
  if (s.startsWith("volleyball")) return "Volleyball";
  if (s.startsWith("handball")) return "Handball";
  if (s.startsWith("tennis")) return "Tennis";
  if (s.startsWith("cricket")) return "Cricket";
  if (s.startsWith("rugby")) return "Rugby";
  if (s.startsWith("lacrosse")) return "Lacrosse";
  if (s.startsWith("kickball")) return "Kickball";
  if (s.startsWith("track")) return "Track & Field";
  if (s.startsWith("hockey") || s.startsWith("field hockey")) return "Hockey";
  if (s.startsWith("bocce")) return "Bocce";
  if (s.startsWith("frisbee") || s.startsWith("ultimate")) return "Frisbee";
  return null;
}

/**
 * Field names in the CSV are like "Great Lawn-Softball-01" or "Soccer-01"
 * or "Grand Street - Soccer 01". Build a human-friendly label.
 */
export function formatFieldName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/-(\d)/g, " $1")
    .replace(/-/g, " – ")
    .replace(/\s+–\s+/g, " – ")
    .trim();
}
