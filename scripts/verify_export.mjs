/**
 * 答え合わせ用: 画面と同じ計算（lib/skipRules.ts・lib/flatBetStats.ts）を Node で直接動かし、結果を JSON で出す。
 * omura-boatrace の omura_verify.py が呼ぶ（手で動かす必要はない）。
 *
 *   node --no-warnings scripts/verify_export.mjs <cases.json> > out.json
 *
 * cases.json: { "amount": 20000, "cases": [{ "date": "YYYY-MM-DD", "info": RaceInfo }] }
 * Node 22.18 以降（.ts をそのまま読める版）が必要。
 */
import { readFileSync } from "node:fs";
import { SKIP_RULES, BOOST_RULES, EVIDENCE_UNTIL, evaluateSigns, evaluateBoosts, overallVerdict } from "../lib/skipRules.ts";
import { FLAT_BET_LOG, FLAT_BET_RANGE, FLAT_BET_REFUNDS } from "../lib/flatBetLog.ts";
import { simulate } from "../lib/flatBetStats.ts";

const input = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const amount = input.amount ?? 20000;

const signs = {};
for (const c of input.cases ?? []) {
  const s = evaluateSigns(c.info);
  signs[c.date] = {
    verdict: overallVerdict(s),
    signs: Object.fromEntries(s.map((x) => [x.id, x.status])),
    boosts: Object.fromEntries(evaluateBoosts(c.info).map((x) => [x.id, x.active])),
  };
}

const strip = ({ rows, months, ...rest }) => ({ ...rest, rowCount: rows.length, monthCount: months.length });
const all = simulate(FLAT_BET_LOG, amount);
const years = {};
for (const y of [...new Set(FLAT_BET_LOG.map((r) => r.d.slice(0, 4)))]) {
  years[y] = strip(simulate(FLAT_BET_LOG.filter((r) => r.d.startsWith(y)), amount));
}

process.stdout.write(
  JSON.stringify({
    signs,
    log: FLAT_BET_LOG,
    range: FLAT_BET_RANGE,
    refunds: FLAT_BET_REFUNDS,
    stats: { all: strip(all), years },
    evidenceUntil: EVIDENCE_UNTIL,
    rules: SKIP_RULES.map((r) => ({ id: r.id, label: r.label, enabled: r.enabled, evidence: r.evidence })),
    boostRules: BOOST_RULES.map((r) => ({ id: r.id, label: r.label, evidence: r.evidence })),
  }),
);
