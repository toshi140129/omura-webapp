"use client";
import { useMemo, useState } from "react";
import type { RaceRow, RaceData } from "@/app/page";

type RaceKey = "r10" | "r11" | "r12";
type Dimension = "boat" | "rank";

const RACES: { key: RaceKey; label: string }[] = [
  { key: "r10", label: "10R" },
  { key: "r11", label: "11R" },
  { key: "r12", label: "12R" },
];

const DIMS: { key: Dimension; label: string }[] = [
  { key: "boat", label: "1着号艇" },
  { key: "rank", label: "1着人気" },
];

type Bucket<T> = { label: string; match: (v: T) => boolean };

const WIND_BUCKETS: Bucket<number>[] = [
  { label: "無風(0m)", match: (n) => n === 0 },
  { label: "弱(1-2m)", match: (n) => n >= 1 && n <= 2 },
  { label: "中(3-4m)", match: (n) => n >= 3 && n <= 4 },
  { label: "強(5-6m)", match: (n) => n >= 5 && n <= 6 },
  { label: "強風(7m〜)", match: (n) => n >= 7 },
];

const WAVE_BUCKETS: Bucket<number>[] = [
  { label: "凪(0-1cm)", match: (n) => n >= 0 && n <= 1 },
  { label: "小(2-3cm)", match: (n) => n >= 2 && n <= 3 },
  { label: "中(4-6cm)", match: (n) => n >= 4 && n <= 6 },
  { label: "大(7-9cm)", match: (n) => n >= 7 && n <= 9 },
  { label: "荒(10cm〜)", match: (n) => n >= 10 },
];

const DIR_BUCKETS: Bucket<number>[] = [
  { label: "北(N)", match: (n) => n === 1 || n === 2 || n === 15 || n === 16 },
  { label: "東(E)", match: (n) => n >= 3 && n <= 6 },
  { label: "南(S)", match: (n) => n >= 7 && n <= 10 },
  { label: "西(W)", match: (n) => n >= 11 && n <= 14 },
];

const WEATHER_LABELS = ["晴", "曇り", "雨", "雪"] as const;

const BOATS = ["1", "2", "3", "4", "5", "6"] as const;

const RANK_BUCKETS = [
  { label: "1番", match: (n: number) => n === 1 },
  { label: "2番", match: (n: number) => n === 2 },
  { label: "3番", match: (n: number) => n === 3 },
  { label: "4-6番", match: (n: number) => n >= 4 && n <= 6 },
  { label: "7-20番", match: (n: number) => n >= 7 && n <= 20 },
  { label: "21番〜", match: (n: number) => n >= 21 },
];

function parseIntOrNull(raw: string): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

type Row = {
  label: string;
  total: number;
  dist: { key: string; count: number; rate: number }[];
  topKey: string | null;
  topRate: number;
};

function aggregate<T>(
  rows: RaceData[],
  getter: (r: RaceData) => number | null,
  buckets: Bucket<number>[],
  dim: Dimension
): Row[] {
  return buckets.map((b) => {
    const matched = rows.filter((r) => {
      const v = getter(r);
      return v !== null && b.match(v);
    });

    let dist: { key: string; count: number; rate: number }[];
    if (dim === "boat") {
      dist = BOATS.map((boat) => {
        const c = matched.filter((r) => r.p1 === boat).length;
        return {
          key: boat,
          count: c,
          rate: matched.length ? Math.round((c / matched.length) * 100) : 0,
        };
      });
    } else {
      dist = RANK_BUCKETS.map((rb) => {
        const c = matched.filter((r) => {
          const rk = parseIntOrNull(r.rank);
          return rk !== null && rb.match(rk);
        }).length;
        return {
          key: rb.label,
          count: c,
          rate: matched.length ? Math.round((c / matched.length) * 100) : 0,
        };
      });
    }

    const top = [...dist].sort((a, b) => b.count - a.count)[0];
    return {
      label: b.label,
      total: matched.length,
      dist,
      topKey: top && top.count > 0 ? top.key : null,
      topRate: top?.rate ?? 0,
    };
  });
}

function aggregateByWeather(
  data: RaceRow[],
  race: RaceKey,
  dim: Dimension
): Row[] {
  return WEATHER_LABELS.map((label) => {
    const matched = data.filter((r) => r.weather === label).map((r) => r[race]);
    let dist: { key: string; count: number; rate: number }[];
    if (dim === "boat") {
      dist = BOATS.map((boat) => {
        const c = matched.filter((r) => r.p1 === boat).length;
        return {
          key: boat,
          count: c,
          rate: matched.length ? Math.round((c / matched.length) * 100) : 0,
        };
      });
    } else {
      dist = RANK_BUCKETS.map((rb) => {
        const c = matched.filter((r) => {
          const rk = parseIntOrNull(r.rank);
          return rk !== null && rb.match(rk);
        }).length;
        return {
          key: rb.label,
          count: c,
          rate: matched.length ? Math.round((c / matched.length) * 100) : 0,
        };
      });
    }
    const top = [...dist].sort((a, b) => b.count - a.count)[0];
    return {
      label,
      total: matched.length,
      dist,
      topKey: top && top.count > 0 ? top.key : null,
      topRate: top?.rate ?? 0,
    };
  });
}

export default function WeatherTrend({ data }: { data: RaceRow[] }) {
  const [race, setRace] = useState<RaceKey>("r12");
  const [dim, setDim] = useState<Dimension>("boat");

  const hasWeather = useMemo(
    () => data.some((r) => r.r11.wind || r.r12.wave),
    [data]
  );

  const rows = useMemo(() => data.map((r) => r[race]), [data, race]);

  const windRows = useMemo(
    () => aggregate(rows, (r) => parseIntOrNull(r.wind), WIND_BUCKETS, dim),
    [rows, dim]
  );
  const waveRows = useMemo(
    () => aggregate(rows, (r) => parseIntOrNull(r.wave), WAVE_BUCKETS, dim),
    [rows, dim]
  );
  const dirRows = useMemo(
    () => aggregate(rows, (r) => parseIntOrNull(r.wdir), DIR_BUCKETS, dim),
    [rows, dim]
  );
  const weatherRows = useMemo(
    () => aggregateByWeather(data, race, dim),
    [data, race, dim]
  );

  if (!hasWeather) {
    return (
      <div className="mb-6 rounded-lg border border-gray-700 p-4">
        <h2 className="font-bold mb-3 text-lg">気象条件別の1着傾向</h2>
        <div className="text-xs text-gray-400">
          気象データがまだCSVに取り込まれていません。
          バックフィル完了後、再デプロイで反映されます。
        </div>
      </div>
    );
  }

  const gridCols = dim === "boat" ? "grid-cols-6" : "grid-cols-6";

  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">気象条件別の1着傾向</h2>
      <p className="text-xs text-gray-400 mb-3">
        選択レースの風速・波高・風向別に、1着号艇または1着人気の分布を集計。
      </p>

      <div className="flex flex-wrap gap-1 mb-2">
        <span className="text-xs text-gray-400 self-center mr-1">レース:</span>
        {RACES.map((r) => {
          const active = race === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setRace(r.key)}
              className={`px-2 py-1 text-xs rounded border ${
                active
                  ? "bg-yellow-500 text-black border-yellow-500 font-bold"
                  : "bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700"
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        <span className="text-xs text-gray-400 self-center mr-1">集計軸:</span>
        {DIMS.map((d) => {
          const active = dim === d.key;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setDim(d.key)}
              className={`px-2 py-1 text-xs rounded border ${
                active
                  ? "bg-yellow-500 text-black border-yellow-500 font-bold"
                  : "bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700"
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      <Section title="風速別" rows={windRows} gridCols={gridCols} />
      <Section title="波高別" rows={waveRows} gridCols={gridCols} />
      <Section title="風向別" rows={dirRows} gridCols={gridCols} />
      <Section title="天気別" rows={weatherRows} gridCols={gridCols} />
    </div>
  );
}

function Section({
  title,
  rows,
  gridCols,
}: {
  title: string;
  rows: Row[];
  gridCols: string;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-bold text-yellow-400 mb-2 border-l-4 border-yellow-400 pl-2">
        {title}
      </h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="bg-gray-800 rounded p-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-300 font-bold">{r.label}</span>
              <span className="text-gray-400">
                {r.total}日{" "}
                {r.topKey && (
                  <span className="text-yellow-300 font-bold ml-2">
                    最頻: {r.topKey} ({r.topRate}%)
                  </span>
                )}
              </span>
            </div>
            {r.total === 0 ? (
              <div className="text-xs text-gray-500">該当なし</div>
            ) : (
              <div className={`grid ${gridCols} gap-1 text-xs text-center`}>
                {r.dist.map((d) => {
                  const isTop = d.key === r.topKey && d.count > 0;
                  return (
                    <div
                      key={d.key}
                      className={`rounded p-1 ${
                        isTop
                          ? "bg-yellow-500 text-black font-bold"
                          : "bg-gray-700 text-gray-200"
                      }`}
                    >
                      <div className="font-bold">{d.key}</div>
                      <div>{d.rate}%</div>
                      <div className="text-[10px] opacity-75">{d.count}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
