#!/usr/bin/env node
/* engine/의 최신 엔진을 덱의 엔진 구역에 그대로 넣는다 (docs/PRINCIPLES.md §6.1)
   사용법: node tools/sync-engine.js            → decks/ 안의 모든 덱
           node tools/sync-engine.js 파일.html …  → 고른 덱만
   덱의 엔진 구역 표시: <style id="hz-engine-style"> … </style>, <script id="hz-engine-script"> … </script> */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'engine', 'engine.css'), 'utf8').trim();
const js = fs.readFileSync(path.join(root, 'engine', 'engine.js'), 'utf8').trim();
const ver = (s) => (s.match(/ENGINE v(\d+(?:\.\d+)*)/) || [])[1];
if (!ver(css) || ver(css) !== ver(js)) { console.error('engine.css와 engine.js의 ENGINE 버전 표시가 다르거나 없어요:', ver(css), ver(js)); process.exit(1); }
if (/<\/style/i.test(css) || /<\/script/i.test(js)) { console.error('엔진 안에 </style> 또는 </script>가 있으면 덱에 넣을 수 없어요.'); process.exit(1); }

function findDecks(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'assets' ? [] : findDecks(p);
    return /\.html?$/i.test(d.name) ? [p] : [];
  });
}

const targets = process.argv.slice(2).length ? process.argv.slice(2).map((p) => path.resolve(p)) : findDecks(path.join(root, 'decks'));
let changed = 0;
for (const file of targets) {
  const src = fs.readFileSync(file, 'utf8');
  const reStyle = /(<style id="hz-engine-style">)[\s\S]*?(<\/style>)/;
  const reScript = /(<script id="hz-engine-script">)[\s\S]*?(<\/script>)/;
  if (!reStyle.test(src) || !reScript.test(src)) { console.warn('건너뜀 (엔진 구역 표시 없음):', path.relative(root, file)); continue; }
  const out = src.replace(reStyle, (m, a, b) => a + '\n' + css + '\n' + b).replace(reScript, (m, a, b) => a + '\n' + js + '\n' + b);
  if (out !== src) { fs.writeFileSync(file, out); changed++; console.log('엔진 v' + ver(css) + ' 넣음:', path.relative(root, file)); }
  else console.log('이미 최신 (v' + ver(css) + '):', path.relative(root, file));
}
console.log(changed + '개 덱을 바꿨어요.');
