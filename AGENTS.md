<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 答え合わせ（数字・判定を変えたら必ず）

見送りサイン（lib/skipRules.ts）・定額シミュレーター（lib/flatBetLog.ts・lib/flatBetStats.ts・scripts/build_flat_bet_log.py）を変えたら、
omura-boatrace の `omura_verify.py` で元データから計算し直した正解と突き合わせる。PR では GitHub Actions「システムの答え合わせ」が同じことを自動でやる。

```bash
python ../omura-boatrace/omura_verify.py --data-git origin/master --webapp . --no-sent-log
```
（omura-boatrace 側のフォルダで `git fetch origin master` してから。Node 22.18 以降と `pip install beautifulsoup4` が要る）
