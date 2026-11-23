/**
 * 帳簿機能のチェック（GitHub Actions「帳簿のチェック」が動かす）。
 *   node --no-warnings scripts/check_ledger.mjs          … 集計ルールと CSV の読み書き（ネット不要）
 *   node --no-warnings scripts/check_ledger.mjs --live   … 上に加えて boatrace.jp の実ページで「結果」「1番人気」の読み取りを確かめる
 * 集計ルールは共有フォルダの omura/帳簿/update_ledger.py と同じ（返還・結果待ちは回数・的中率・連敗に数えない）。
 * Node 22.18 以降（.ts をそのまま読める版）が必要。
 */
import { autoPayout, fromCSV, summarize, toCSV } from "../lib/ledger.ts";
import { favoriteOf, parseOdds3t, parseRaceResult } from "../lib/raceResult.ts";

let ng = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) ng++;
  console.log(`${ok ? "OK " : "NG "} ${label}: ${JSON.stringify(got)}${ok ? "" : `  （正解 ${JSON.stringify(want)}）`}`);
}

// ---------------------------------------------------------------- 集計ルール
const CSV = `﻿日付,場,レース,買い方,買い目,購入額,結果,払戻,収支,累計収支,メモ
2026-10-24,大村,12R,3連単1番人気1点,1-2-4,20000,1-3-4,0,,,"かっこ（全角）,カンマ入り"
2026-10-25,大村,12R,3連単1番人気1点,1-2-3,20000,1-2-3,146000,,,
2026-10-26,大村,12R,3連単1番人気1点,1-2-3,20000,返還,,,,
2026-10-27,大村,12R,3連単1番人気1点,1-2-4,20000,2-4-3,0,,,
2026-10-28,大村,12R,3連単1番人気1点,1-2-4,50000,1-3-5,0,,,
2026-10-29,大村,12R,3連単1番人気1点,1-2-4,50000,,,,,
`;
const rows = fromCSV(CSV);
const s = summarize(rows);
eq("行数", rows.length, 6);
eq("購入回数（返還・結果待ち除く）", s.bets, 4);
eq("的中", s.hits, 1);
eq("累計収支", s.total, -20000 + 126000 - 20000 - 50000);
eq("現在の連敗", s.streak, 2);
eq("最大連敗", s.maxStreak, 2);
eq("最大落ち込み", s.maxDD, -70000);
eq("返還・結果待ち", [s.refunds, s.pending], [1, 1]);
eq("返還行の払戻=購入額", s.rows[2].payout, 20000);
eq("メモの全角・カンマを保つ", rows[0].memo, "かっこ（全角）,カンマ入り");
eq("CSVの読み書きで変わらない", fromCSV(toCSV(rows)).map((r) => [r.date, r.combo, r.amount, r.result, r.payout, r.memo]), rows.map((r) => [r.date, r.combo, r.amount, r.result, r.result ? r.payout : 0, r.memo]));
eq("1点的中の払戻", autoPayout("1-2-5", 50000, "1-2-5", 430), 215000);
eq("ハズレの払戻", autoPayout("1-2-5", 50000, "1-4-2", 1030), 0);
eq("多点的中は手入力", autoPayout("1-2-5,1-4-2", 50000, "1-4-2", 1030), null);

// ---------------------------------------------------------------- boatrace.jp の実ページ
if (process.argv.includes("--live")) {
  // 帳簿に記録済みの日（結果・確定オッズの1番人気は帳簿のメモと omura_results.csv で確認済み）
  const KNOWN = [
    { date: "20261027", result: { combo: "2-4-3", pay: 20950 }, fav: "1-2-4", odds: 6.9 },
    { date: "20261030", result: { combo: "1-2-4", pay: 1020 }, fav: "1-2-3", odds: 7.3 },
    { date: "20261123", result: { combo: "1-4-2", pay: 1030 }, fav: "1-2-5", odds: 4.3 },
  ];
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  const get = async (page, hd) => {
    const res = await fetch(`https://www.boatrace.jp/owpc/pc/race/${page}?rno=12&jcd=24&hd=${hd}`, { headers: { "User-Agent": UA } });
    return res.ok ? res.text() : "";
  };
  for (const k of KNOWN) {
    eq(`${k.date} 結果`, parseRaceResult(await get("raceresult", k.date)), k.result);
    const f = favoriteOf(parseOdds3t(await get("odds3t", k.date)));
    eq(`${k.date} 1番人気`, f && { combo: f.combos[0], odds: f.odds }, { combo: k.fav, odds: k.odds });
  }
}

console.log(ng ? `\n${ng}件ずれています` : "\nすべて一致");
process.exit(ng ? 1 : 0);
