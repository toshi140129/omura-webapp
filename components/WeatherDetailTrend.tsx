"use client";
import { useMemo } from "react";
import type { RaceRow } from "@/app/page";

const BOATS = ["1", "2", "3", "4", "5", "6"] as const;

type BoatDist = { boat: string; count: number; rate: number };

type Section = {
  label: string;
  total: number;
  dist: BoatDist[];
  topBoat: string | null;
  topRate: number;
};

function boatDist(rows: RaceRow[], filter: (r: RaceRow) => boolean): Section["dist"] {
  const matched = rows.filter(filter);
  return BOATS.map((b) => {
    const count = matched.filter((r) => r.r12.p1 === b).length;
    return {
      boat: b,
      count,
      rate: matched.length ? Math.round((count / matched.length) * 100) : 0,
    };
  });
}

function makeSection(label: string, dist: BoatDist[]): Section {
  const total = dist.reduce((s, d) => s + d.count, 0);
  const top = [...dist].sort((a, b) => b.count - a.count)[0];
  return {
    label,
    total,
    dist,
    topBoat: top && top.count > 0 ? top.boat : null,
    topRate: top?.rate ?? 0,
  };
}

function parseFloat2(s: string): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseInt2(s: string): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function SectionGrid({ sections, accentColor }: { sections: Section[]; accentColor: string }) {
  const borderClass = accentColor === "cyan" ? "border-cyan-400" : "border-green-400";
  const textClass = accentColor === "cyan" ? "text-cyan-400" : "text-green-400";
  const topBgClass = accentColor === "cyan" ? "bg-cyan-500" : "bg-green-500";
  const topTextClass = accentColor === "cyan" ? "text-cyan-300" : "text-green-300";

  return (
    <div className="space-y-2">
      {sections.map((s) => (
        <div key={s.label} className="bg-gray-800 rounded p-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`font-bold ${textClass}`}>{s.label}</span>
            <span className="text-gray-400">
              {s.total}日
              {s.topBoat && (
                <span className={`font-bold ml-2 ${topTextClass}`}>
                  最頻: {s.topBoat}号艇 ({s.topRate}%)
                </span>
              )}
            </span>
          </div>
          {s.total === 0 ? (
            <div className="text-xs text-gray-500">該当なし</div>
          ) : (
            <div className="grid grid-cols-6 gap-1 text-xs text-center">
              {s.dist.map((d) => {
                const isTop = d.boat === s.topBoat && d.count > 0;
                return (
                  <div
                    key={d.boat}
                    className={`rounded p-1 ${
                      isTop ? `${topBgClass} text-black font-bold` : "bg-gray-700 text-gray-200"
                    }`}
                  >
                    <div className="font-bold">{d.boat}号艇</div>
                    <div>{d.rate}%</div>
                    <div className="text-[10px] opacity-75">{d.count}日</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function WeatherDetailTrend({ data }: { data: RaceRow[] }) {
  const hasAirTemp = useMemo(() => data.some((r) => r.airTemp !== ""), [data]);
  const hasWaterTemp = useMemo(() => data.some((r) => r.waterTemp !== ""), [data]);
  const hasStabilizer = useMemo(() => data.some((r) => r.stabilizer !== ""), [data]);
  const hasTide = useMemo(() => data.some((r) => r.tideLevel !== ""), [data]);

  const airTempSections = useMemo<Section[]>(() => [
    makeSection("気温 低(<15℃)", boatDist(data, (r) => { const v = parseFloat2(r.airTemp); return v !== null && v < 15; })),
    makeSection("気温 中(15-25℃)", boatDist(data, (r) => { const v = parseFloat2(r.airTemp); return v !== null && v >= 15 && v <= 25; })),
    makeSection("気温 高(>25℃)", boatDist(data, (r) => { const v = parseFloat2(r.airTemp); return v !== null && v > 25; })),
  ], [data]);

  const waterTempSections = useMemo<Section[]>(() => [
    makeSection("水温 低(<20℃)", boatDist(data, (r) => { const v = parseFloat2(r.waterTemp); return v !== null && v < 20; })),
    makeSection("水温 中(20-25℃)", boatDist(data, (r) => { const v = parseFloat2(r.waterTemp); return v !== null && v >= 20 && v <= 25; })),
    makeSection("水温 高(>25℃)", boatDist(data, (r) => { const v = parseFloat2(r.waterTemp); return v !== null && v > 25; })),
  ], [data]);

  const stabSections = useMemo<Section[]>(() => [
    makeSection("安定板 使用なし(0艇)", boatDist(data, (r) => r.stabilizer === "0")),
    makeSection("安定板 使用あり(1艇〜)", boatDist(data, (r) => { const v = parseInt2(r.stabilizer); return v !== null && v >= 1; })),
  ], [data]);

  const tideSections = useMemo<Section[]>(() => {
    const tideLevels = data
      .map((r) => parseFloat2(r.tideLevel))
      .filter((v): v is number => v !== null);
    if (tideLevels.length === 0) return [];
    tideLevels.sort((a, b) => a - b);
    const p33 = tideLevels[Math.floor(tideLevels.length * 0.33)];
    const p66 = tideLevels[Math.floor(tideLevels.length * 0.66)];
    return [
      makeSection(`潮位 低(〜${Math.round(p33)}cm)`, boatDist(data, (r) => { const v = parseFloat2(r.tideLevel); return v !== null && v <= p33; })),
      makeSection(`潮位 中(${Math.round(p33)}〜${Math.round(p66)}cm)`, boatDist(data, (r) => { const v = parseFloat2(r.tideLevel); return v !== null && v > p33 && v <= p66; })),
      makeSection(`潮位 高(${Math.round(p66)}cm〜)`, boatDist(data, (r) => { const v = parseFloat2(r.tideLevel); return v !== null && v > p66; })),
    ];
  }, [data]);

  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">気象詳細・潮汐別の12R 1着号艇傾向</h2>
      <p className="text-xs text-gray-400 mb-4">
        気温・水温・安定板・潮位ごとに12R 1着号艇の分布を集計。
      </p>

      {hasAirTemp && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-cyan-400 mb-2 border-l-4 border-cyan-400 pl-2">
            気温別
          </h3>
          <SectionGrid sections={airTempSections} accentColor="cyan" />
        </div>
      )}

      {hasWaterTemp && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-cyan-400 mb-2 border-l-4 border-cyan-400 pl-2">
            水温別
          </h3>
          <SectionGrid sections={waterTempSections} accentColor="cyan" />
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-sm font-bold text-green-400 mb-2 border-l-4 border-green-400 pl-2">
          安定板使用別
        </h3>
        {hasStabilizer ? (
          <SectionGrid sections={stabSections} accentColor="green" />
        ) : (
          <div className="text-xs text-gray-500 bg-gray-800 rounded p-2">
            安定板データは現在収集中です。omura_tide_stabilizer_backfill.py 実行後に反映されます。
          </div>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-bold text-green-400 mb-2 border-l-4 border-green-400 pl-2">
          潮位別
        </h3>
        {hasTide ? (
          <SectionGrid sections={tideSections} accentColor="green" />
        ) : (
          <div className="text-xs text-gray-500 bg-gray-800 rounded p-2">
            潮位データは現在収集中です。omura_tide_stabilizer_backfill.py 実行後に反映されます。
          </div>
        )}
      </div>
    </div>
  );
}
