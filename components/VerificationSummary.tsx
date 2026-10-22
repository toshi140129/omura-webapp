/**
 * 12R 資金配分＋マーチンゲールの収支検証（2023-01-01〜2026-10-17）の要約。
 * 数字は omura/12R資金配分_検証結果.md（2026-10-22）からの固定値。
 * CSV の更新で自動では変わらないので、再検証したらここを更新する。
 */
const VERIFIED_RANGE = "2023-01-01〜2026-10-17";

const ROWS: { label: string; days: string; hit: string; result: string; tone: "bad" | "flat" | "good" }[] = [
  { label: "メイン理論（②あり）1万円固定", days: "549日", hit: "55%", result: "−70.2万 / 回収率87%", tone: "bad" },
  { label: "メイン理論（②なし）1万円固定", days: "582日", hit: "54%", result: "−88.6万", tone: "bad" },
  { label: "人気上位4点（11R1〜4番人気）1万円固定", days: "286日", hit: "40%", result: "−33.4万", tone: "bad" },
  { label: "人気上位4点（11R1番人気のみ）1万円固定", days: "107日", hit: "46%", result: "+7.5万（ほぼトントン）", tone: "flat" },
];

const ODDS_ROWS = [
  { band: "1.5倍未満", days: 260, hit: "68%", roi: "85.9%", pl: "−36.6万" },
  { band: "1.5〜2倍", days: 163, hit: "49%", roi: "81.4%", pl: "−30.3万" },
  { band: "2〜2.5倍", days: 55, hit: "47%", roi: "103.2%", pl: "+1.8万" },
  { band: "2.5〜3倍", days: 32, hit: "31%", roi: "85.4%", pl: "−4.7万" },
  { band: "3倍以上", days: 39, hit: "23%", roi: "98.7%", pl: "−0.5万" },
];

export default function VerificationSummary() {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-xs leading-relaxed text-red-200">
        軍資金30万・目標5万のマーチンゲールは、理論・式・②の有無を問わず
        <span className="font-bold">全パターンで2023年1〜4月に資金不足</span>で止まりました。
        原因は資金配分買いの回収率が100%未満（メイン理論で約87%）であることです。
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold text-gray-400">毎回1万円固定で買った場合の収支</h3>
        <div className="space-y-1">
          {ROWS.map((r) => (
            <div key={r.label} className="rounded-lg bg-gray-800 px-3 py-2">
              <div className="text-xs text-gray-200">{r.label}</div>
              <div className="mt-0.5 flex items-center justify-between text-xs tabular-nums">
                <span className="text-gray-400">
                  {r.days} / 的中 {r.hit}
                </span>
                <span
                  className={`font-bold ${
                    r.tone === "bad" ? "text-red-300" : r.tone === "good" ? "text-green-300" : "text-yellow-300"
                  }`}
                >
                  {r.result}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold text-gray-400">
          合成オッズ帯別（メイン理論・②あり・1万円固定）
        </h3>
        <table className="w-full text-center text-xs tabular-nums">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="py-1 text-left font-normal">合成オッズ</th>
              <th className="py-1 font-normal">日数</th>
              <th className="py-1 font-normal">的中</th>
              <th className="py-1 font-normal">回収率</th>
              <th className="py-1 text-right font-normal">収支</th>
            </tr>
          </thead>
          <tbody>
            {ODDS_ROWS.map((r) => (
              <tr key={r.band} className="border-b border-gray-800">
                <td className="py-1 text-left text-gray-300">{r.band}</td>
                <td className="py-1">{r.days}</td>
                <td className="py-1">{r.hit}</td>
                <td className={`py-1 ${parseFloat(r.roi) >= 100 ? "font-bold text-yellow-400" : ""}`}>{r.roi}</td>
                <td className={`py-1 text-right ${r.pl.startsWith("+") ? "text-green-300" : "text-red-300"}`}>{r.pl}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
          合成オッズが低い日ほど当たるが取り分が小さく負けている。2〜2.5倍の＋1.8万は55日分で偶然の範囲。
        </p>
      </div>

      <p className="text-[11px] text-gray-500">
        検証期間 {VERIFIED_RANGE}。確定オッズ・100円単位配分・最低1万円で計算。詳細は検証結果メモを参照。
      </p>
    </div>
  );
}
