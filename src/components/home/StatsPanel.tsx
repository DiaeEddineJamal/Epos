import React from "react";
import { useTranslation } from "react-i18next";
import { Flame } from "lucide-react";
import type { DashboardStats } from "@/bindings";

/** Compact numeric label, e.g. 137600 -> "137.6K". */
const compact = (n: number, locale: string): string => {
  try {
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return String(n);
  }
};

interface StatsPanelProps {
  stats: DashboardStats | null;
}

/**
 * The right-hand institutional stats plaque: primary figures (words / wpm /
 * streak) over a hairline-divided next-milestone meter and a small 14-day
 * macrodata sparkline.
 */
export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const totalWords = stats?.total_words ?? 0;
  const wpm = stats?.average_wpm ?? 0;
  const streak = stats?.current_streak ?? 0;
  const nextMilestone = stats?.next_milestone ?? 0;
  const toNext = nextMilestone > 0 ? Math.max(nextMilestone - totalWords, 0) : 0;

  // Progress from the previous milestone floor to the next one.
  const progress =
    nextMilestone > 0
      ? Math.min(Math.max(totalWords / nextMilestone, 0), 1)
      : 1;

  const recent = stats?.recent_days ?? [];
  const peak = Math.max(1, ...recent.map((d) => d.words));

  return (
    <aside className="glass-panel rounded-sm p-5 flex flex-col gap-5 w-full">
      {/* Primary figures */}
      <dl className="flex flex-col gap-3.5">
        <StatRow
          value={compact(totalWords, locale)}
          label={t("home.stats.totalWords")}
          big
        />
        <StatRow
          value={String(Math.round(wpm))}
          label={t("home.stats.wpm")}
        />
        <StatRow
          value={String(streak)}
          label={t("home.stats.dayStreak", { count: streak })}
          icon={
            streak > 0 ? (
              <Flame size={15} strokeWidth={1.75} className="text-rec" />
            ) : undefined
          }
        />
      </dl>

      {/* Next-milestone meter */}
      <div className="border-t hairline pt-4 flex flex-col gap-2">
        <div
          className="h-1 w-full bg-hairline rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="block h-full bg-live transition-[width] duration-700 ease-lumon"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text/45">
          {nextMilestone > 0
            ? t("home.nextMilestone", { count: toNext })
            : t("home.milestoneReached")}
        </p>
      </div>

      {/* 14-day macrodata sparkline */}
      {recent.length > 0 && (
        <div className="border-t hairline pt-4 flex items-end gap-[3px] h-12">
          {recent.map((d) => (
            <span
              key={d.day}
              title={`${d.day}: ${d.words}`}
              className="flex-1 rounded-[1px] bg-live/70 min-h-[2px] transition-[height] duration-500 ease-lumon"
              style={{ height: `${Math.max((d.words / peak) * 100, 4)}%` }}
            />
          ))}
        </div>
      )}
    </aside>
  );
};

const StatRow: React.FC<{
  value: string;
  label: string;
  big?: boolean;
  icon?: React.ReactNode;
}> = ({ value, label, big, icon }) => (
  <div className="flex items-baseline gap-2.5">
    <dd
      className={`tabular-nums font-medium text-text leading-none ${
        big ? "text-[2rem]" : "text-[1.4rem]"
      }`}
    >
      {value}
    </dd>
    {icon}
    <dt className="text-[13px] text-text/55 lowercase tracking-wide">
      {label}
    </dt>
  </div>
);
