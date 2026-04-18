"use client";
import { useState } from "react";

export default function MartingaleCalc() {
  const [loss, setLoss] = useState(0);
  const [odds, setOdds] = useState(10);
  const [target, setTarget] = useState(50000);

  const next = Math.max(10000, Math.ceil((loss + target) / odds / 100) * 100);

  return (
    <div className="mb-6 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3 text-lg">マーチンゲール計算</h2>
      <div className="space-y-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-gray-400">累積損失（円）</span>
          <input
            type="number"
            value={loss}
            onChange={(e) => setLoss(Number(e.target.value))}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-400">合成オッズ（倍）</span>
          <input
            type="number"
            step="0.1"
            value={odds}
            onChange={(e) => setOdds(Number(e.target.value))}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-400">目標利益（円）</span>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </label>
        <div className="bg-yellow-500 text-black font-bold text-center py-2 rounded text-lg">
          次回賭け金：{next.toLocaleString()}円
        </div>
      </div>
    </div>
  );
}
