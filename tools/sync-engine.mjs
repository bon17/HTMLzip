#!/usr/bin/env node
// engine/engine.css 와 engine/engine.js 를 덱 파일의 엔진 구역에 그대로 넣는다.
//
//   node tools/sync-engine.mjs                 decks/ 아래 모든 .html 갱신
//   node tools/sync-engine.mjs decks/a.html    지정한 파일만 갱신
//   node tools/sync-engine.mjs --check         바꾸지 않고, 엔진이 최신이 아닌 덱만 알려 줌 (최신이 아니면 종료 코드 1)
//
// 덱 파일에는 아래 두 구역이 있어야 한다.
//   <style id="hz-engine-style"> ... </style>
//   <script id="hz-engine-script"> ... </script>
//
// 엔진 고정: <script id="hz-engine-script" data-engine-lock> 처럼 data-engine-lock을 붙인 덱은
// 지금 들어 있는 엔진을 그대로 두고 건너뛴다 (--check에서도 '고정'으로만 알려 줌).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(ROOT, 'engine/engine.css'), 'utf8').trim();
const js = readFileSync(join(ROOT, 'engine/engine.js'), 'utf8').trim();
if (/<\/style/i.test(css) || /<\/script/i.test(js)) {
  console.error('엔진 코드 안에 </style> 또는 </script> 문자열이 있으면 덱에 넣을 수 없어요.');
  process.exit(2);
}
const version = (js.match(/ENGINE v([\d.]+)/) || [])[1] || '?';

const args = process.argv.slice(2);
const check = args.includes('--check');
let files = args.filter(a => !a.startsWith('--'));
if (!files.length) {
  const walk = d => readdirSync(d).flatMap(n => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : (n.endsWith('.html') ? [p] : []);
  });
  const decks = join(ROOT, 'decks');
  files = existsSync(decks) ? walk(decks) : [];
}

const STYLE = /(<style\b[^>]*\bid=["']hz-engine-style["'][^>]*>)([\s\S]*?)(<\/style>)/i;
const SCRIPT = /(<script\b[^>]*\bid=["']hz-engine-script["'][^>]*>)([\s\S]*?)(<\/script>)/i;
let stale = 0, updated = 0, skipped = 0, locked = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const name = relative(ROOT, f);
  if (!STYLE.test(src) || !SCRIPT.test(src)) { console.log(`건너뜀  ${name} (엔진 구역 없음)`); skipped++; continue; }
  const sm = src.match(SCRIPT);
  if (/\bdata-engine-lock\b/i.test(sm[1])) {
    const v = (sm[2].match(/ENGINE v([\d.]+)/) || [])[1] || '?';
    console.log(`고정    ${name} (엔진 v${v}, data-engine-lock)`); locked++; continue;
  }
  const out = src
    .replace(STYLE, (m, a, _b, c) => `${a}\n${css}\n${c}`)
    .replace(SCRIPT, (m, a, _b, c) => `${a}\n${js}\n${c}`);
  if (out === src) { console.log(`최신    ${name}`); continue; }
  stale++;
  if (check) console.log(`오래됨  ${name}`);
  else { writeFileSync(f, out); updated++; console.log(`갱신    ${name} → 엔진 v${version}`); }
}
if (!files.length) console.log('덱 파일이 없어요.');
if (check) {
  console.log(stale ? `\n엔진이 최신이 아닌 덱 ${stale}개 · node tools/sync-engine.mjs 로 갱신하세요` : `\n고정하지 않은 덱이 모두 엔진 v${version}과 같아요${locked ? ` (고정 ${locked}개는 그대로)` : ''}.`);
  process.exit(stale ? 1 : 0);
}
console.log(`\n엔진 v${version} · 갱신 ${updated}개${locked ? ` · 고정 ${locked}개` : ''}${skipped ? ` · 건너뜀 ${skipped}개` : ''}`);
