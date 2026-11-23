/**
 * boatrace.jp の「結果」「3連単オッズ」ページを読む（帳簿の自動入力用）。
 * 読み方は omura-boatrace/omura_line_notify.py の parse_raceresult / parse_odds3t（毎晩の実運用で使っているもの）と同じ。
 * Node だけで試せるように、ここには Next.js 固有のものを入れない。
 */

/** 3連単オッズ表に並んでいる順の組番（1-2-3, 2-1-3, … の120通り） */
export const ODDS_ORDER: string[] = (() => {
  const res: string[] = [];
  for (let row = 0; row < 20; row++) {
    for (let first = 1; first <= 6; first++) {
      const seconds = [1, 2, 3, 4, 5, 6].filter((s) => s !== first);
      const second = seconds[Math.floor(row / 4)];
      const thirds = [1, 2, 3, 4, 5, 6].filter((t) => t !== first && t !== second);
      res.push(`${first}-${second}-${thirds[row % 4]}`);
    }
  }
  return res;
})();

function nfkc(s: string): string {
  return s.normalize("NFKC").trim();
}

function plain(html: string): string {
  return nfkc(html.replace(/<[^>]+>/g, " ").replace(/&[#a-zA-Z0-9]+;/g, " "));
}

function noData(html: string): boolean {
  return !html || html.includes("データがありません");
}

/** {組番: オッズ}。欠場などで数字でない組番は null。120個そろわなければ空 */
export function parseOdds3t(html: string): Record<string, number | null> {
  if (noData(html)) return {};
  const vals = [...html.matchAll(/class="oddsPoint[^"]*">([^<]*)</g)].map((m) => nfkc(m[1]));
  if (vals.length !== 120) return {};
  const out: Record<string, number | null> = {};
  ODDS_ORDER.forEach((c, i) => {
    const v = parseFloat(vals[i]);
    out[c] = Number.isFinite(v) ? v : null;
  });
  return out;
}

/** いちばん低いオッズの組番（同じオッズが並んだらすべて） */
export function favoriteOf(odds: Record<string, number | null>): { combos: string[]; odds: number } | null {
  let best: number | null = null;
  for (const v of Object.values(odds)) if (v != null && v > 0 && (best == null || v < best)) best = v;
  if (best == null) return null;
  return { combos: ODDS_ORDER.filter((c) => odds[c] === best), odds: best };
}

/**
 * 結果ページの払戻表から3連単の組番と100円あたり払戻を読む。
 * 結果掲載直後は払戻表だけ先に出ることがあるので、払戻表を正とする（omura_line_notify.py と同じ）。
 * 返還・不成立で払戻が書かれていなければ pay は null。
 */
export function parseRaceResult(html: string): { combo: string; pay: number | null } | null {
  if (noData(html)) return null;
  const tables = [...html.matchAll(/<table[^>]*class="[^"]*\bis-w495\b[^"]*"[^>]*>([\s\S]*?)<\/table>/g)].map((m) => m[1]);
  for (const t of tables) {
    for (const tr of t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
      if (tds.length < 3 || !plain(tds[0]).includes("3連単")) continue;
      const digits = plain(tds[1]).match(/[1-6]/g) ?? [];
      if (digits.length !== 3) return null;
      const payDigits = plain(tds[2]).replace(/[^0-9]/g, "");
      return { combo: digits.join("-"), pay: payDigits ? Number(payDigits) : null };
    }
  }
  return null;
}
