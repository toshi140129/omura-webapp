"use client";
import { useCallback, useEffect, useState } from "react";
import type { RaceInfo } from "@/lib/boatrace";
import type { SignResult, Verdict } from "@/lib/skipRules";

type Payload = RaceInfo & {
  signs: SignResult[];
  verdict: Verdict;
  fetchedAt: string;
};

const POLL_MS = 5 * 60 * 1000;

function jstTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(11, 16);
}

const STATUS_ICON: Record<SignResult["status"], string> = {
  skip: "⚠️",
  ok: "✅",
  pending: "⏳",
};

export default function TodaySigns() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/today", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Payload);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (loading) {
    return <p className="text-sm text-gray-400">boatrace.jp から取得中…</p>;
  }
  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-200">
        取得できませんでした。
        <button type="button" onClick={load} className="ml-2 underline">
          再読み込み
        </button>
      </div>
    );
  }
  if (!data.raceListAvailable) {
    return (
      <p className="text-sm text-gray-400">
        {data.date} の大村12R 出走表はまだありません（開催なし、または未発表）。
      </p>
    );
  }

  const banner =
    data.verdict === "skip"
      ? { cls: "bg-red-600 text-white", text: "見送り推奨" }
      : data.verdict === "go"
        ? { cls: "bg-green-600 text-white", text: "見送り条件なし" }
        : { cls: "bg-gray-700 text-gray-100", text: "判定待ち（直前情報が出たら確定）" };
  const skipCount = data.signs.filter((s) => s.status === "skip").length;

  return (
    <div>
      <div className={`mb-3 rounded-lg px-3 py-3 text-center text-lg font-bold ${banner.cls}`}>
        {banner.text}
        {skipCount > 0 && <span className="ml-2 text-sm font-normal">（{skipCount}件該当）</span>}
      </div>

      <div className="mb-3 text-xs text-gray-400">
        {data.date} 大村12R{data.raceType ? ` ${data.raceType}` : ""}
        {data.title ? ` / ${data.title}` : ""}
      </div>

      <div className="space-y-1.5">
        {data.signs.map((s) => (
          <div
            key={s.id}
            className={`rounded-lg px-3 py-2 ${
              s.status === "skip"
                ? "bg-red-900/30 ring-1 ring-red-700"
                : s.status === "ok"
                  ? "bg-gray-800"
                  : "bg-gray-800/50"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-base leading-6">{STATUS_ICON[s.status]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-bold ${s.status === "skip" ? "text-red-300" : ""}`}>
                    {s.label}
                  </span>
                  <span className="shrink-0 rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300">
                    {s.stage}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-gray-200 tabular-nums">{s.detail}</div>
                <div className="text-[10px] text-gray-500">{s.evidence}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="text-[10px] text-gray-500">
            <tr>
              <th className="py-1 text-left">枠</th>
              <th className="py-1 text-left">選手</th>
              <th className="py-1">級</th>
              <th className="py-1 text-right">全国</th>
              <th className="py-1 text-right">当地</th>
              <th className="py-1 text-right">平均ST</th>
              <th className="py-1 text-right">展示</th>
            </tr>
          </thead>
          <tbody>
            {data.boats.map((b) => (
              <tr key={b.waku} className={`border-t border-gray-800 ${b.waku === "1" ? "text-yellow-300" : "text-gray-200"}`}>
                <td className="py-1 font-bold">{b.waku}</td>
                <td className="py-1">{b.name || "-"}</td>
                <td className="py-1 text-center">{b.klass || "-"}</td>
                <td className="py-1 text-right">{b.winRate?.toFixed(2) ?? "-"}</td>
                <td className="py-1 text-right">{b.localWinRate?.toFixed(2) ?? "-"}</td>
                <td className="py-1 text-right">{b.avgST?.toFixed(2) ?? "-"}</td>
                <td className="py-1 text-right">{b.exhibitionTime?.toFixed(2) ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10px] text-gray-600">
        更新 {jstTime(data.fetchedAt)}（5分ごとに自動更新）。見送っても回収率は95%前後で、負けを減らす条件です。
      </p>
    </div>
  );
}
