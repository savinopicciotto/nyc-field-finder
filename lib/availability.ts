import type {
  Borough,
  DayAvailability,
  FieldAvailability,
  Permit,
  TimeBlock,
} from "./types";
import type { Sport } from "./parks";
import { formatFieldName } from "./parks";

export interface ComputeInput {
  parkCode: string;
  parkName: string;
  borough: Borough;
  permits: Permit[];
  sport: Sport;
  startDate: Date; // inclusive, NYC local midnight
  endDate: Date;   // inclusive, NYC local midnight
  windowStartHour: number; // e.g. 6
  windowEndHour: number;   // e.g. 22
}

/** Format a Date as YYYY-MM-DD using its local components. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Decimal hour of a Date (local). 4:30pm → 16.5 */
function localHour(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

/** Iterate YYYY-MM-DD strings across an inclusive local-date range. */
export function iterDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cur = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const stop = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  );
  while (cur <= stop) {
    dates.push(localDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Merge overlapping TimeBlocks and sort by start. Labels from overlaps are joined. */
export function mergeBlocks(blocks: TimeBlock[]): TimeBlock[] {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => a.startHour - b.startHour);
  const out: TimeBlock[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const b = sorted[i];
    if (b.startHour <= last.endHour) {
      last.endHour = Math.max(last.endHour, b.endHour);
      if (!last.label.includes(b.label)) {
        last.label = `${last.label}; ${b.label}`;
      }
    } else {
      out.push({ ...b });
    }
  }
  return out;
}

/**
 * Build per-field, per-day availability blocks from raw permits.
 * - `__blocker__` permits (Full Closure / Special Event) block *any* sport.
 * - Permits that span midnight are clipped per-day.
 * - Blocks are clipped to the [windowStartHour, windowEndHour] window.
 */
export function computeFieldAvailability(input: ComputeInput): FieldAvailability[] {
  const {
    parkCode,
    parkName,
    borough,
    permits,
    sport,
    startDate,
    endDate,
    windowStartHour,
    windowEndHour,
  } = input;

  // Group permits by raw field name.
  const byField = new Map<string, Permit[]>();
  const allFieldSports = new Map<string, Set<string>>();

  for (const p of permits) {
    if (!p.fieldName) continue;
    if (!allFieldSports.has(p.fieldName)) {
      allFieldSports.set(p.fieldName, new Set());
    }
    if (p.sport !== "__blocker__") {
      allFieldSports.get(p.fieldName)!.add(p.sport);
    }
    // Keep permits that either match sport OR are blockers (closures/events).
    const relevant = p.sport === sport || p.sport === "__blocker__";
    if (!relevant) continue;
    if (!byField.has(p.fieldName)) byField.set(p.fieldName, []);
    byField.get(p.fieldName)!.push(p);
  }

  // Only include fields where the sport has ever been permitted (so we don't
  // show a softball diamond when the user asked for basketball).
  const fieldNames = [...byField.keys()].filter((f) => {
    const sports = allFieldSports.get(f);
    return sports && sports.has(sport);
  });

  const rangeDates = iterDateRange(startDate, endDate);

  const results: FieldAvailability[] = [];
  for (const fieldName of fieldNames) {
    const perDay = new Map<string, TimeBlock[]>();
    for (const date of rangeDates) perDay.set(date, []);

    for (const p of byField.get(fieldName) ?? []) {
      // Clip permit to each day it touches.
      const startDay = new Date(
        p.start.getFullYear(),
        p.start.getMonth(),
        p.start.getDate(),
      );
      const endDay = new Date(
        p.end.getFullYear(),
        p.end.getMonth(),
        p.end.getDate(),
      );
      const day = new Date(startDay);
      while (day <= endDay) {
        const key = localDateKey(day);
        if (perDay.has(key)) {
          const dayStart = new Date(day);
          const dayEnd = new Date(day);
          dayEnd.setDate(dayEnd.getDate() + 1);
          const segStart = p.start > dayStart ? p.start : dayStart;
          const segEnd = p.end < dayEnd ? p.end : dayEnd;
          const s = Math.max(windowStartHour, localHour(segStart));
          const e = Math.min(windowEndHour, segEnd >= dayEnd ? 24 : localHour(segEnd));
          if (e > s) {
            const label =
              p.sport === "__blocker__"
                ? `${p.sportRaw || "Closure"}: ${p.eventName}`
                : `${p.eventName} (${p.organization})`;
            perDay.get(key)!.push({ startHour: s, endHour: e, label });
          }
        }
        day.setDate(day.getDate() + 1);
      }
    }

    const days: DayAvailability[] = rangeDates.map((date) => ({
      date,
      booked: mergeBlocks(perDay.get(date) ?? []),
    }));

    results.push({
      parkCode,
      parkName,
      borough,
      fieldName,
      fieldDisplayName: formatFieldName(fieldName),
      sports: [...(allFieldSports.get(fieldName) ?? [])],
      days,
    });
  }

  // Stable sort: park name → field name.
  results.sort(
    (a, b) =>
      a.parkName.localeCompare(b.parkName) ||
      a.fieldDisplayName.localeCompare(b.fieldDisplayName),
  );
  return results;
}
