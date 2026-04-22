"use client";

import { SPORTS, type Sport } from "@/lib/parks";

export interface ControlsProps {
  sport: Sport;
  startDate: string;
  endDate: string;
  onChange: (v: { sport: Sport; startDate: string; endDate: string }) => void;
  loading: boolean;
  onSubmit: () => void;
}

export function Controls(props: ControlsProps) {
  const { sport, startDate, endDate, onChange, loading, onSubmit } = props;
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="flex min-w-[180px] flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">Sport</span>
        <select
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
          value={sport}
          onChange={(e) =>
            onChange({ sport: e.target.value as Sport, startDate, endDate })
          }
        >
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">From</span>
        <input
          type="date"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
          value={startDate}
          max={endDate}
          onChange={(e) =>
            onChange({ sport, startDate: e.target.value, endDate })
          }
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">To</span>
        <input
          type="date"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
          value={endDate}
          min={startDate}
          onChange={(e) =>
            onChange({ sport, startDate, endDate: e.target.value })
          }
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Loading…" : "Find fields"}
      </button>
    </form>
  );
}
