import type { NextRequest } from "next/server";
import { fetchRaceInfo, todayJST, REVALIDATE_SEC } from "@/lib/boatrace";
import { evaluateSigns, overallVerdict } from "@/lib/skipRules";

/**
 * GET /api/today            … 今日（JST）の大村12Rの見送りサイン
 * GET /api/today?date=2025-10-17 … 指定日（検証用）
 * boatrace.jp への問い合わせは REVALIDATE_SEC 秒キャッシュされる。
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayJST();
  const info = await fetchRaceInfo(date, 12);
  const signs = evaluateSigns(info);
  return Response.json(
    {
      ...info,
      signs,
      verdict: overallVerdict(signs),
      fetchedAt: new Date().toISOString(),
      cacheSec: REVALIDATE_SEC,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
