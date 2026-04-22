"use client";

import { useCallback, useEffect, useState } from "react";
import { Controls } from "@/components/Controls";
import { FieldGrid } from "@/components/FieldGrid";
import type { AvailabilityResponse } from "@/lib/types";
import type { Sport } from "@/lib/parks";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export default function Home() {
  const [sport, setSport] = useState<Sport>("Soccer");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDaysISO(todayISO(), 13));
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ sport, start: startDate, end: endDate });
      const res = await fetch(`/api/availability?${qs}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as AvailabilityResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sport, startDate, endDate]);

  useEffect(() => {
    run();
    // run once on mount; subsequent runs are user-triggered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 md:p-8">
      <header>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          NYC Parks · Field Finder
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          Find open fields across NYC in one view
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Pick a sport and date range. We pull issued-permits data directly from
          NYC Parks and show you every field with open time — no clicking pins
          one by one.
        </p>
      </header>

      <Controls
        sport={sport}
        startDate={startDate}
        endDate={endDate}
        loading={loading}
        onChange={(v) => {
          setSport(v.sport);
          setStartDate(v.startDate);
          setEndDate(v.endDate);
        }}
        onSubmit={run}
      />

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-emerald-300 dark:bg-emerald-800" />
          Open
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-rose-500/80" />
          Booked (issued permit)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-amber-200 dark:bg-amber-900" />
          Weekend
        </span>
        {data && (
          <span className="ml-auto text-[11px] text-zinc-500">
            {data.fields.length} fields · {data.sport} · fetched{" "}
            {new Date(data.fetchedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {data && data.warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Partial data:</strong>
          <ul className="mt-1 list-disc pl-5">
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {loading && !data && (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          Fetching permits from NYC Parks…
        </div>
      )}

      {data && <FieldGrid data={data} />}

      <footer className="mt-8 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        Data from{" "}
        <a
          className="underline hover:text-emerald-600"
          href="https://www.nycgovparks.org/permits/field-and-court/map"
          target="_blank"
          rel="noreferrer"
        >
          NYC Parks permit records
        </a>
        . Availability is the inverse of issued permits — physical closures or
        weather cancellations are not reflected. Apply for a permit through NYC
        Parks before planning your event.
      </footer>
    </main>
  );
}
