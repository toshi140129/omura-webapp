"use client";
import { useMemo, useState } from "react";
import type { RaceRow } from "@/app/page";

type Filter = "all" | "cond1" | "hit";
const PAGE = 30;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全日" },
  { key: "cond1", label: "①成立日" },
  { key: "hit", label: "的中日" },
];

function judge(row: RaceRow) {
  const cond1 = row.r11.p1 === "1";
  const cond3 = row.r12.p1 === "1";
  const r11_23 = [row.r11.p2, row.r11.p3];
  const r12_23 = [row.r12.p2, row.r12.p3];
  const cond4 = r11_23.some((b) => r12_23.includes(b));
  const pay = parseInt(row.r12.pay || "0");
  const hit = cond1 && cond3 && cond4 && pay > 0 && pay < 4000;
  return { cond1, hit };
}

function fmtPay(p: string) {
  const n = parseInt(p || "0");
  return n > 0 ? n.toLocaleString() : "-";
}

export default function ResultsTable({ data }: { data: RaceRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const judged = data.map((row) => ({ row, ...judge(row) }));
    if (filter === "cond1") return judged.filter((r) => r.cond1);
    if (filter === "hit") return judged.filter((r) => r.hit);
    return judged;
  }, [data, filter]);

  const counts = useMemo(() => {
    const judged = data.map(judge);
    return {
      all: data.length,
      cond1: judged.filter((j) => j.cond1).length,
      hit: judged.filter((j) => j.hit).length,
    };
  }, [data]);

  const visible = rows.slice(0, limit);

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setLimit(PAGE);
              }}
              className={`flex-1 rounded-full px-2 py-1.5 text-xs ${
                active
                  ? "bg-yellow-500 font-bold text-black"
                  : "bg-gray-800 text-gray-300"
              }`}
            >
              {f.label}
              <span className="ml-1 opacity-70 tabular-nums">({counts[f.key]})</span>
            </button>
          );
        })}
      </div>

      <table className="w-full text-center text-xs">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            <th className="py-2 pr-1 text-left font-normal">日付</th>
            <th className="py-2 font-normal">10R</th>
            <th className="py-2 font-normal">11R</th>
            <th className="py-2 font-normal">12R</th>
            <th className="py-2 pl-1 font-normal">天気</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(({ row, cond1, hit }) => (
            <tr
              key={row.date}
              className={`border-b border-gray-800 ${hit ? "bg-green-900/30" : ""}`}
            >
              <td className="py-1.5 pr-1 text-left text-gray-300 tabular-nums">
                <div>{row.date.slice(5)}</div>
                <div className="text-[10px] text-gray-500">{row.date.slice(0, 4)}</div>
              </td>
              <Cell race={row.r10} />
              <Cell race={row.r11} strong={cond1} />
              <Cell race={row.r12} strong={hit} />
              <td className="py-1.5 pl-1 text-gray-300">{row.weather || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="py-4 text-center text-xs text-gray-500">該当する日がありません</p>
      )}

      {limit < rows.length && (
        <button
          type="button"
          onClick={() => setLimit((v) => v + PAGE)}
          className="mt-3 w-full rounded-lg border border-gray-600 bg-gray-800 py-2.5 text-sm text-gray-200 active:bg-gray-700"
        >
          さらに表示（残り {rows.length - limit}日）
        </button>
      )}
    </div>
  );
}

function Cell({ race, strong }: { race: RaceRow["r10"]; strong?: boolean }) {
  return (
    <td className={`py-1.5 tabular-nums ${strong ? "font-bold text-green-400" : ""}`}>
      <div>
        {race.p1}-{race.p2}-{race.p3}
      </div>
      <div className="text-[10px] font-normal text-yellow-400">{fmtPay(race.pay)}</div>
    </td>
  );
}
