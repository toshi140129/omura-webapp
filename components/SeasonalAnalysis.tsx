"use client";
import type { RaceRow } from "@/app/page";

const SEASONS: { label: string; months: number[] }[] = [
  { label: "春(3-5月)", months: [3, 4, 5] },
  { label: "夏(6-8月)", months: [6, 7, 8] },
  { label: "秋(9-11月)", months: [9, 10, 11] },
  { label: "冬(12-2月)", months: [12, 1, 2] },
];

const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const DAYS = ["日","月","火","水","木","金","土"];

function isHit(r: RaceRow) {
  const c1 = r.r11.p1 === "1";
  const c3 = r.r12.p1 === "1";
  const c4 = [r.r11.p2, r.r11.p3].some((b) => [r.r12.p2, r.r12.p3].includes(b));
  const pay = parseInt(r.r12.pay || "0");
  const c5 = pay > 0 && pay < 4000;
  return c1 && c3 && c4 && c5;
}

function rate(hits: number, total: number) {
  return total ? Math.round((hits / total) * 100) : 0;
}

function payCategory(pay: number) {
  if (pay <= 0) return null;
  if (pay < 1000) return "低(~10倍)";
  if (pay < 5000) return "中(10~50倍)";
  return "高(50倍~)";
}

export default function SeasonalAnalysis({ data }: { data: RaceRow[] }) {
  const seasonStats = SEASONS.map(({ label, months }) => {
    const rows = data.filter((r) => months.includes(new Date(r.date).getMonth() + 1));
    const hits = rows.filter(isHit);
    return { label, total: rows.length, hit: hits.length, rate: rate(hits.length, rows.length) };
  });

  const monthStats = Array.from({ length: 12 }, (_, i) => {
    const rows = data.filter((r) => new Date(r.date).getMonth() === i);
    const hits = rows.filter(isHit);
    return { label: MONTHS[i], total: rows.length, hit: hits.length, rate: rate(hits.length, rows.length) };
  });

  const dayStats = Array.from({ length: 7 }, (_, i) => {
    const rows = data.filter((r) => new Date(r.date).getDay() === i);
    const hits = rows.filter(isHit);
    return { label: DAYS[i], total: rows.length, hit: hits.length, rate: rate(hits.length, rows.length) };
  });

  const payDist = { "低(~10倍)": 0, "中(10~50倍)": 0, "高(50倍~)": 0 };
  data.forEach((r) => {
    const cat = payCategory(parseInt(r.r12.pay || "0"));
    if (cat) payDist[cat as keyof typeof payDist]++;
  });
  const payTotal = Object.values(payDist).reduce((a, b) => a + b, 0);

  const seriesDayBuckets = ["1", "2", "3", "4", "5", "6", "7"];
  const seriesDayLabels: Record<string, string> = {
    "1": "1日目", "2": "2日目", "3": "3日目", "4": "4日目",
    "5": "5日目", "6": "6日目", "7": "7日目",
  };
  const seriesDayStats = seriesDayBuckets
    .map((b) => {
      const rows = data.filter((r) => r.seriesDay === b);
      const hits = rows.filter(isHit);
      return { label: seriesDayLabels[b], total: rows.length, hit: hits.length, rate: rate(hits.length, rows.length) };
    })
    .filter((s) => s.total > 0);

  const eventTypes = ["デイ", "ナイター", "ミッドナイト"];
  const eventTypeStats = eventTypes
    .map((t) => {
      const rows = data.filter((r) => r.eventType === t);
      const hits = rows.filter(isHit);
      return { label: t, total: rows.length, hit: hits.length, rate: rate(hits.length, rows.length) };
    })
    .filter((s) => s.total > 0);

  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">季節・時期別分析</h2>

      <h3 className="text-sm font-bold text-gray-400 mb-2">季節別的中率</h3>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {seasonStats.map((s) => (
          <div key={s.label} className="bg-gray-800 rounded p-2 text-xs">
            <div className="text-gray-400">{s.label}</div>
            <div className="font-bold text-lg">{s.rate}%</div>
            <div className="text-gray-500">{s.hit}/{s.total}日</div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-bold text-gray-400 mb-2">月別的中率</h3>
      <div className="grid grid-cols-4 gap-1 mb-4">
        {monthStats.map((m) => (
          <div key={m.label} className="bg-gray-800 rounded p-1 text-xs text-center">
            <div className="text-gray-400">{m.label}</div>
            <div className={`font-bold ${m.rate >= 50 ? "text-yellow-400" : ""}`}>{m.rate}%</div>
            <div className="text-gray-500">{m.total}日</div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-bold text-gray-400 mb-2">曜日別的中率</h3>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {dayStats.map((d) => (
          <div key={d.label} className="bg-gray-800 rounded p-1 text-xs text-center">
            <div className="text-gray-400">{d.label}</div>
            <div className={`font-bold ${d.rate >= 50 ? "text-yellow-400" : ""}`}>{d.rate}%</div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-bold text-gray-400 mb-2">12R払戻分布</h3>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {Object.entries(payDist).map(([label, count]) => (
          <div key={label} className="bg-gray-800 rounded p-2 text-xs text-center">
            <div className="text-gray-400">{label}</div>
            <div className="font-bold">{count}日</div>
            <div className="text-gray-500">{payTotal ? Math.round((count / payTotal) * 100) : 0}%</div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-bold text-gray-400 mb-2">節内開催日数別的中率</h3>
      {seriesDayStats.length === 0 ? (
        <div className="text-xs text-gray-500 mb-4">データなし</div>
      ) : (
        <div className={`grid gap-1 mb-4 ${seriesDayStats.length >= 7 ? "grid-cols-7" : "grid-cols-6"}`}>
          {seriesDayStats.map((s) => (
            <div key={s.label} className="bg-gray-800 rounded p-1 text-xs text-center">
              <div className="text-gray-400">{s.label}</div>
              <div className={`font-bold ${s.rate >= 50 ? "text-yellow-400" : ""}`}>{s.rate}%</div>
              <div className="text-gray-500">{s.hit}/{s.total}</div>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-bold text-gray-400 mb-2">開催種別別的中率</h3>
      {eventTypeStats.length === 0 ? (
        <div className="text-xs text-gray-500">データなし</div>
      ) : (
        <div className={`grid gap-2 ${eventTypeStats.length === 1 ? "grid-cols-1" : eventTypeStats.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {eventTypeStats.map((s) => (
            <div key={s.label} className="bg-gray-800 rounded p-2 text-xs text-center">
              <div className="text-gray-400">{s.label}</div>
              <div className={`font-bold text-lg ${s.rate >= 50 ? "text-yellow-400" : ""}`}>{s.rate}%</div>
              <div className="text-gray-500">{s.hit}/{s.total}日</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
