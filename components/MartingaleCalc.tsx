"use client";
import { useState } from "react";

const MIN_BET = 10000;

function roundUp100(v: number) {
  return Math.ceil(v / 100) * 100;
}

export default function MartingaleCalc() {
  const [loss, setLoss] = useState(0);
  const [odds, setOdds] = useState(1.8);
  const [target, setTarget] = useState(50000);

  const need = loss + target;
  // 式A：÷合成オッズ（従来式）
  const nextA = Math.max(MIN_BET, roundUp100(need / Math.max(odds, 0.01)));
  // 式B：÷(合成オッズ−1)。合成1倍以下は計算不能
  const nextB =
    odds > 1 ? Math.max(MIN_BET, roundUp100(need / (odds - 1))) : null;

  const inputCls =
    "w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-right text-base font-bold tabular-nums text-white";
  const chip =
    "rounded-full border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 active:bg-gray-700";

  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="mg-loss" className="text-gray-400">
            累積損失（円）
          </label>
          <div className="flex gap-1">
            <button type="button" className={chip} onClick={() => setLoss((v) => Math.max(0, v - 10000))}>
              −1万
            </button>
            <button type="button" className={chip} onClick={() => setLoss((v) => v + 10000)}>
              +1万
            </button>
            <button type="button" className={chip} onClick={() => setLoss(0)}>
              リセット
            </button>
          </div>
        </div>
        <input
          id="mg-loss"
          type="number"
          inputMode="numeric"
          min={0}
          step={100}
          value={loss}
          onChange={(e) => setLoss(Math.max(0, Number(e.target.value)))}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="mg-odds" className="mb-1 block text-gray-400">
          合成オッズ（倍）
        </label>
        <input
          id="mg-odds"
          type="number"
          inputMode="decimal"
          min={1}
          step={0.1}
          value={odds}
          onChange={(e) => setOdds(Number(e.target.value))}
          className={inputCls}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="mg-target" className="text-gray-400">
            目標利益（円）
          </label>
          <div className="flex gap-1">
            {[30000, 50000, 100000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTarget(v)}
                className={`${chip} ${target === v ? "border-yellow-500 text-yellow-400" : ""}`}
              >
                {v / 10000}万
              </button>
            ))}
          </div>
        </div>
        <input
          id="mg-target"
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          value={target}
          onChange={(e) => setTarget(Math.max(0, Number(e.target.value)))}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Result
          title="÷ 合成オッズ"
          note="従来式"
          value={nextA}
          net={nextA * odds - nextA - loss}
        />
        <Result
          title="÷ (合成オッズ−1)"
          note="目標利益が残る式"
          value={nextB}
          net={nextB === null ? null : nextB * odds - nextB - loss}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-gray-500">
        必要額＝累積損失＋目標利益。最低1万円、100円単位で切り上げ。
        「純利益」はその賭け金で的中したときに累積損失を差し引いて手元に残る額です。
      </p>
    </div>
  );
}

function Result({
  title,
  note,
  value,
  net,
}: {
  title: string;
  note: string;
  value: number | null;
  net: number | null;
}) {
  return (
    <div className="rounded-lg bg-gray-800 p-3">
      <div className="text-xs text-gray-400">{title}</div>
      <div className="text-[10px] text-gray-500">{note}</div>
      <div className="mt-1 text-xl font-bold text-yellow-400 tabular-nums">
        {value === null ? "—" : `${value.toLocaleString()}円`}
      </div>
      <div className="text-[11px] text-gray-400 tabular-nums">
        {net === null
          ? "合成1倍以下は計算不可"
          : `的中時の純利益 ${net >= 0 ? "+" : ""}${Math.round(net).toLocaleString()}円`}
      </div>
    </div>
  );
}
