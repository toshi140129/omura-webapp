/**
 * 定額買いの収支計算（components/FlatBetSimulator.tsx の画面と、omura-boatrace/omura_verify.py の答え合わせの両方が使う）。
 * 画面の数字はここで計算したものなので、答え合わせはこの関数を直接動かして照合する。
 */
import type { FlatBetRow } from "./flatBetLog";

export type DayResult = FlatBetRow & {
  bet: number;
  ret: number;
  pl: number;
  cum: number;
};

export type Bucket = { key: string; label: string; days: number; hits: number; pl: number; invested: number };

export type Summary = {
  rows: DayResult[];
  days: number;
  hits: number;
  invested: number;
  returned: number;
  total: number;
  maxDD: number;
  maxDDFrom: string;
  maxDDTo: string;
  maxStreak: number;
  maxStreakEnd: string;
  perYear: number;
  perMonth: number;
  months: Bucket[];
  years: Bucket[];
};

export function dayNumber(d: string) {
  return Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000);
}

export function simulate(log: FlatBetRow[], amount: number): Summary {
  let cum = 0;
  let peak = 0;
  let peakDate = log[0]?.d ?? "";
  let maxDD = 0;
  let maxDDFrom = "";
  let maxDDTo = "";
  let streak = 0;
  let maxStreak = 0;
  let maxStreakEnd = "";
  let hits = 0;
  let invested = 0;
  let returned = 0;
  const months = new Map<string, Bucket>();
  const years = new Map<string, Bucket>();
  const rows: DayResult[] = log.map((r) => {
    const ret = Math.round((r.pay * amount) / 100);
    const pl = ret - amount;
    cum += pl;
    invested += amount;
    returned += ret;
    if (r.pay > 0) {
      hits++;
      streak = 0;
    } else {
      streak++;
      if (streak > maxStreak) {
        maxStreak = streak;
        maxStreakEnd = r.d;
      }
    }
    if (cum > peak) {
      peak = cum;
      peakDate = r.d;
    }
    if (cum - peak < maxDD) {
      maxDD = cum - peak;
      maxDDFrom = peakDate;
      maxDDTo = r.d;
    }
    const ym = r.d.slice(0, 7);
    const y = r.d.slice(0, 4);
    const bump = (m: Map<string, Bucket>, key: string, label: string) => {
      const b = m.get(key) ?? { key, label, days: 0, hits: 0, pl: 0, invested: 0 };
      b.days++;
      b.hits += r.pay > 0 ? 1 : 0;
      b.pl += pl;
      b.invested += amount;
      m.set(key, b);
    };
    bump(months, ym, `${+ym.slice(5, 7)}月`);
    bump(years, y, `${y}年`);
    return { ...r, bet: amount, ret, pl, cum };
  });
  const total = cum;
  const span = log.length ? dayNumber(log[log.length - 1].d) - dayNumber(log[0].d) + 1 : 0;
  const perYear = span > 0 ? (total * 365) / span : 0;
  return {
    rows,
    days: log.length,
    hits,
    invested,
    returned,
    total,
    maxDD,
    maxDDFrom,
    maxDDTo,
    maxStreak,
    maxStreakEnd,
    perYear,
    perMonth: perYear / 12,
    months: [...months.values()],
    years: [...years.values()],
  };
}
