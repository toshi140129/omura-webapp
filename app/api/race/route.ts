import type { NextRequest } from "next/server";
import { JCD, todayJST } from "@/lib/boatrace";
import { favoriteOf, parseOdds3t, parseRaceResult } from "@/lib/raceResult";

/**
 * GET /api/race?date=2026-11-23 … その日の大村12Rの「3連単1番人気（今のオッズ）」と「結果（3連単の組番・100円あたり払戻）」
 * 帳簿の自動入力用。個人の記録は含まないので合言葉は要らない。
 */

export const dynamic = "force-dynamic";

const BASE = "https://www.boatrace.jp/owpc/pc/race/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function html(page: string, hd: string, revalidate: number): Promise<string> {
  try {
    const res = await fetch(`${BASE}${page}?rno=12&jcd=${JCD}&hd=${hd}`, {
      headers: { "User-Agent": UA },
      next: { revalidate },
    });
    return res.ok ? await res.text() : "";
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayJST();
  const hd = date.replace(/-/g, "");
  const past = date < todayJST();
  // 当日のオッズは締切まで動くので短め、過去日は変わらないので長めにキャッシュする
  const [oddsHtml, resultHtml] = await Promise.all([
    html("odds3t", hd, past ? 86400 : 60),
    html("raceresult", hd, past ? 86400 : 60),
  ]);
  const favorite = favoriteOf(parseOdds3t(oddsHtml));
  const result = parseRaceResult(resultHtml);
  return Response.json(
    { date, favorite, result, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
