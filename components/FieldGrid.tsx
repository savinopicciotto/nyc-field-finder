"use client";

import { useState } from "react";
import type { AvailabilityResponse, FieldAvailability, TimeBlock, DayAvailability } from "@/lib/types";

interface Props {
  data: AvailabilityResponse;
}

function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const ampm = hh >= 12 ? "p" : "a";
  const disp = ((hh + 11) % 12) + 1;
  return mm === 0 ? `${disp}${ampm}` : `${disp}:${String(mm).padStart(2, "0")}${ampm}`;
}

function dateHeader(date: string): { dow: string; md: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.toLocaleDateString("en-US", { weekday: "short" });
  const md = dt.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
  return { dow, md };
}

function openMinutes(day: DayAvailability, windowStart: number, windowEnd: number): number {
  const total = (windowEnd - windowStart) * 60;
  const booked = day.booked.reduce(
    (acc, b) => acc + (Math.min(b.endHour, windowEnd) - Math.max(b.startHour, windowStart)) * 60,
    0,
  );
  return Math.max(0, total - Math.max(0, booked));
}

function DayBar({
  day,
  windowStart,
  windowEnd,
  onClick,
}: {
  day: DayAvailability;
  windowStart: number;
  windowEnd: number;
  onClick: () => void;
}) {
  const span = windowEnd - windowStart;
  const minutesOpen = openMinutes(day, windowStart, windowEnd);
  const fullyOpen = day.booked.length === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        fullyOpen
          ? "Open all day"
          : day.booked
              .map((b) => `${formatHour(b.startHour)}–${formatHour(b.endHour)}: ${b.label}`)
              .join("\n")
      }
      className="group relative h-7 w-full overflow-hidden rounded border border-zinc-200 bg-emerald-100 transition hover:border-emerald-500 dark:border-zinc-800 dark:bg-emerald-950/50"
    >
      {day.booked.map((b, i) => {
        const left = ((b.startHour - windowStart) / span) * 100;
        const width = ((b.endHour - b.startHour) / span) * 100;
        return (
          <span
            key={i}
            className="absolute inset-y-0 bg-rose-500/80"
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        );
      })}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-medium text-emerald-950/70 mix-blend-multiply dark:text-emerald-200">
        {fullyOpen ? "open" : `${Math.round(minutesOpen / 60)}h free`}
      </span>
    </button>
  );
}

function DayDetail({
  field,
  day,
  onClose,
  windowStart,
  windowEnd,
}: {
  field: FieldAvailability;
  day: DayAvailability;
  onClose: () => void;
  windowStart: number;
  windowEnd: number;
}) {
  const openGaps: TimeBlock[] = [];
  let cursor = windowStart;
  for (const b of day.booked) {
    if (b.startHour > cursor) {
      openGaps.push({
        startHour: cursor,
        endHour: Math.min(b.startHour, windowEnd),
        label: "Open",
      });
    }
    cursor = Math.max(cursor, b.endHour);
  }
  if (cursor < windowEnd) {
    openGaps.push({ startHour: cursor, endHour: windowEnd, label: "Open" });
  }

  const { dow, md } = dateHeader(day.date);
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {field.parkName} · {field.borough}
            </div>
            <h3 className="text-base font-semibold">{field.fieldDisplayName}</h3>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {dow}, {md}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            ✕
          </button>
        </div>

        <div className="mb-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Open windows
        </div>
        {openGaps.length === 0 ? (
          <p className="text-sm text-zinc-600">No open windows within {formatHour(windowStart)}–{formatHour(windowEnd)}.</p>
        ) : (
          <ul className="mb-4 space-y-1 text-sm">
            {openGaps.map((g, i) => (
              <li
                key={i}
                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 dark:border-emerald-900 dark:bg-emerald-950/40"
              >
                {formatHour(g.startHour)} – {formatHour(g.endHour)}
              </li>
            ))}
          </ul>
        )}

        {day.booked.length > 0 && (
          <>
            <div className="mb-2 text-sm font-medium text-rose-700 dark:text-rose-400">
              Booked
            </div>
            <ul className="space-y-1 text-sm">
              {day.booked.map((b, i) => (
                <li
                  key={i}
                  className="rounded border border-rose-200 bg-rose-50 px-2 py-1 dark:border-rose-900 dark:bg-rose-950/40"
                >
                  <span className="font-medium">
                    {formatHour(b.startHour)} – {formatHour(b.endHour)}
                  </span>{" "}
                  · {b.label}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export function FieldGrid({ data }: Props) {
  const [selected, setSelected] = useState<{
    field: FieldAvailability;
    day: DayAvailability;
  } | null>(null);

  if (data.fields.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        No fields found for <strong>{data.sport}</strong> in the curated parks
        for this date range.
      </div>
    );
  }

  const dates = data.fields[0].days.map((d) => d.date);

  // Group fields by park for visual grouping.
  const byPark = new Map<string, FieldAvailability[]>();
  for (const f of data.fields) {
    const key = `${f.parkName} · ${f.borough}`;
    if (!byPark.has(key)) byPark.set(key, []);
    byPark.get(key)!.push(f);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div
        className="grid text-xs"
        style={{
          gridTemplateColumns: `minmax(220px, 260px) repeat(${dates.length}, minmax(56px, 1fr))`,
        }}
      >
        <div className="sticky left-0 z-10 border-b border-r border-zinc-200 bg-zinc-50 p-2 font-semibold dark:border-zinc-800 dark:bg-zinc-900">
          Field
        </div>
        {dates.map((d) => {
          const { dow, md } = dateHeader(d);
          const isWeekend = dow === "Sat" || dow === "Sun";
          return (
            <div
              key={d}
              className={`border-b border-r border-zinc-200 p-2 text-center dark:border-zinc-800 ${
                isWeekend ? "bg-amber-50 dark:bg-amber-950/30" : "bg-zinc-50 dark:bg-zinc-900"
              }`}
            >
              <div className="font-medium">{dow}</div>
              <div className="text-zinc-500">{md}</div>
            </div>
          );
        })}

        {[...byPark.entries()].map(([parkLabel, fields]) => (
          <ParkRows
            key={parkLabel}
            parkLabel={parkLabel}
            fields={fields}
            windowStart={data.windowStartHour}
            windowEnd={data.windowEndHour}
            onPick={(field, day) => setSelected({ field, day })}
            colSpan={dates.length}
          />
        ))}
      </div>

      {selected && (
        <DayDetail
          field={selected.field}
          day={selected.day}
          windowStart={data.windowStartHour}
          windowEnd={data.windowEndHour}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ParkRows({
  parkLabel,
  fields,
  windowStart,
  windowEnd,
  onPick,
  colSpan,
}: {
  parkLabel: string;
  fields: FieldAvailability[];
  windowStart: number;
  windowEnd: number;
  onPick: (f: FieldAvailability, d: DayAvailability) => void;
  colSpan: number;
}) {
  return (
    <>
      <div
        className="sticky left-0 z-10 col-span-full border-b border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        style={{ gridColumn: `span ${colSpan + 1} / span ${colSpan + 1}` }}
      >
        {parkLabel}
      </div>
      {fields.map((f) => (
        <FieldRow
          key={`${f.parkCode}|${f.fieldName}`}
          field={f}
          windowStart={windowStart}
          windowEnd={windowEnd}
          onPick={(d) => onPick(f, d)}
        />
      ))}
    </>
  );
}

function FieldRow({
  field,
  windowStart,
  windowEnd,
  onPick,
}: {
  field: FieldAvailability;
  windowStart: number;
  windowEnd: number;
  onPick: (d: DayAvailability) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-r border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="font-medium text-zinc-900 dark:text-zinc-100">
          {field.fieldDisplayName}
        </div>
        <div className="text-[10px] text-zinc-500">{field.fieldName}</div>
      </div>
      {field.days.map((d) => (
        <div
          key={d.date}
          className="border-b border-r border-zinc-200 p-1 dark:border-zinc-800"
        >
          <DayBar
            day={d}
            windowStart={windowStart}
            windowEnd={windowEnd}
            onClick={() => onPick(d)}
          />
        </div>
      ))}
    </>
  );
}
