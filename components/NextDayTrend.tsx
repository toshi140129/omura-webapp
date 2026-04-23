"use client";
import type { RaceRow } from "@/app/page";

const BOATS = ["1", "2", "3", "4", "5", "6"] as const;
const RACES = [
  { key: "r10", label: "10R" },
  { key: "r11", label: "11R" },
  { key: "r12", label: "12R" },
] as const;

function nextDate(d: string): string {
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

type BoatRate = { boat: string; count: number; rate: number };

export default function NextDayTrend({ data }: { data: RaceRow[] }) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((r) => [r.date, r]));

  const pivotBoats = ["1", "2", "3", "4"];

  const stats = pivotBoats.map((boat) => {
    const matches = sorted.filter(
      (r) => r.r11.p1 === boat && byDate.has(nextDate(r.date))
    );

    const raceStats = RACES.map(({ key, label }) => {
      const counts: Record<string, number> = {};
      matches.forEach((r) => {
        const next = byDate.get(nextDate(r.date))!;
        const winner = next[key].p1;
        if (winner) counts[winner] = (counts[winner] || 0) + 1;
      });

      const ranking: BoatRate[] = BOATS.map((b) => ({
        boat: b,
        count: counts[b] || 0,
        rate: matches.length
          ? Math.round(((counts[b] || 0) / matches.length) * 100)
          : 0,
      }));

      const top = [...ranking].sort((a, b) => b.count - a.count);
      const topBoat = top[0]?.count ? top[0].boat : null;

      return { label, ranking, topBoat, topRate: top[0]?.rate ?? 0 };
    });

    return { boat, total: matches.length, raceStats };
  });

  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">翌日の1着傾向（11R勝者別）</h2>
      <p className="text-xs text-gray-400 mb-3">
        11Rで各号艇が1着になった日の翌日、各レースで1着になりやすい号艇の傾向。
        <br />
        ※CSVに人気順データがないため号艇番号で集計しています。翌日データが存在する日のみ対象。
      </p>

      {stats.map((s) => (
        <div key={s.boat} className="mb-5">
          <h3 className="text-sm font-bold text-yellow-400 mb-2 border-l-4 border-yellow-400 pl-2">
            11R 1着 = {s.boat}号艇
            <span className="text-gray-400 text-xs ml-2 font-normal">
              （{s.total}日分の翌日を分析）
            </span>
          </h3>
          {s.total === 0 ? (
            <div className="text-xs text-gray-500 pl-2">該当日なし</div>
          ) : (
            <div className="space-y-2">
              {s.raceStats.map((rs) => (
                <div key={rs.label} className="bg-gray-800 rounded p-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">翌日 {rs.label} 1着分布</span>
                    {rs.topBoat && (
                      <span className="text-yellow-300 font-bold">
                        最頻: {rs.topBoat}号艇 ({rs.topRate}%)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-1 text-xs text-center">
                    {rs.ranking.map((b) => {
                      const isTop = b.boat === rs.topBoat && b.count > 0;
                      return (
                        <div
                          key={b.boat}
                          className={`rounded p-1 ${
                            isTop
                              ? "bg-yellow-500 text-black font-bold"
                              : "bg-gray-700 text-gray-200"
                          }`}
                        >
                          <div className="font-bold">{b.boat}号</div>
                          <div>{b.rate}%</div>
                          <div className="text-[10px] opacity-75">
                            {b.count}日
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
