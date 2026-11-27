// 확인용: 슬라이드 안에 넣는 결과판(embed=1)과 상태 칸(embed=status)
// 실행: node apps/ai-prompt-class/dev/test-embed.cjs <스크린샷 폴더> [작은 그림 data URL 파일]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { makeContext, callServer } = require('./gas-fake.cjs');

const OUT = path.resolve(process.argv[2] || 'shots'); fs.mkdirSync(OUT, { recursive: true });
const THUMB = process.argv[3] && fs.existsSync(process.argv[3]) ? fs.readFileSync(process.argv[3], 'utf8') : 'data:image/jpeg;base64,AA==';
const ROOT = path.join(__dirname, '..');
const ctx = makeContext(); ctx.setup();
const KEY = ctx.__props.teacherKey;
const errors = [], posts = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const SHIM = `(function(){function runner(ok,fail){return new Proxy({},{get:function(t,p){if(p==='withSuccessHandler')return function(f){return runner(f,fail)};if(p==='withFailureHandler')return function(f){return runner(ok,f)};return function(){var a=Array.prototype.slice.call(arguments);setTimeout(function(){window.__gs(p,JSON.stringify(a)).then(function(r){var v=JSON.parse(r);if(v.err){if(fail)fail(new Error(v.err))}else if(ok)ok(v.val)})},40)}}})}
window.google={script:{run:runner(),url:{getLocation:function(cb){var o={};location.search.replace(/^\\?/,'').split('&').forEach(function(kv){if(!kv)return;var a=kv.split('=');o[decodeURIComponent(a[0])]=decodeURIComponent(a[1]||'')});setTimeout(function(){cb({parameter:o})},20)}}}};
var _pm=window.postMessage.bind(window);window.postMessage=function(m,o){window.__post(JSON.stringify(m));return _pm(m,o)};})();`;

async function open(browser, q, w, h, name) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  await p.exposeFunction('__gs', (fn, a) => { try { return JSON.stringify({ val: callServer(ctx, fn, JSON.parse(a)) }); } catch (e) { errors.push(`[${name}] ${fn}: ${e.message}`); return JSON.stringify({ err: e.message }); } });
  await p.exposeFunction('__post', m => posts.push(JSON.parse(m)));
  await p.addInitScript(SHIM);
  p.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
  await p.goto('file://' + path.join(ROOT, 'board.html') + q);
  return p;
}
const statusText = p => p.evaluate(() => ['s-mb', 's-st', 's-cnt', 's-code'].map(i => document.getElementById(i).textContent).join(' | '));

(async () => {
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  const R = {};
  // 상태 칸: 들어오면 미션 1을 열어요
  const s1 = await open(browser, `?p=board&embed=status&m=1&start=1&k=${KEY}`, 340, 150, '상태1');
  await wait(900);
  R.afterStart = ctx.__props.mission;
  for (const n of [3, 5, 8]) callServer(ctx, 'submit', [{ cls: 2, num: n, mission: 1, kind: 'before', image: 'AA==', thumb: THUMB }]);
  for (const n of [3, 5]) callServer(ctx, 'submit', [{ cls: 2, num: n, mission: 1, kind: 'after', image: 'AA==', thumb: THUMB }]);
  callServer(ctx, 'submit', [{ cls: 4, num: 1, mission: 1, kind: 'after', image: 'AA==', thumb: THUMB }]);
  callServer(ctx, 'vote', [2, 8, 1, 3]);
  await wait(4800);
  R.status1 = await statusText(s1);
  await s1.screenshot({ path: path.join(OUT, 'e-status.png') });
  // 결과판(미션 1)
  const b1 = await open(browser, `?p=board&embed=1&m=1`, 1180, 820, '결과판1');
  await wait(1500);
  R.cards = await b1.$$eval('#grid .card', els => els.length);
  R.stat = await b1.textContent('#stat');
  await b1.screenshot({ path: path.join(OUT, 'e-board.png') });
  // 이동 키를 덱으로 보내는지
  posts.length = 0; await b1.keyboard.press('PageDown'); await wait(200);
  R.forward = posts.slice();
  // 앞으로만: 미션 3을 연 뒤 미션 1 칸에 다시 들어와도 미션 3 그대로
  callServer(ctx, 'teacher', [KEY, 'mission', 3]);
  const s1b = await open(browser, `?p=board&embed=status&m=1&start=1&k=${KEY}`, 340, 150, '상태1b');
  await wait(1200);
  R.afterBack = ctx.__props.mission; R.status1b = await statusText(s1b);
  // 틀린 교사 키
  posts.length = 0;
  const sbad = await open(browser, `?p=board&embed=status&m=4&start=1&k=wrong`, 340, 150, '상태bad');
  await wait(1000);
  R.badStatus = await statusText(sbad); R.badPost = posts.slice(); R.afterBad = ctx.__props.mission;
  await sbad.screenshot({ path: path.join(OUT, 'e-status-bad.png') });
  // 반 대표 대결: 들어오면 열리고 표 막대
  const bf = await open(browser, `?p=board&embed=1&m=F&start=1&k=${KEY}`, 1180, 820, '대결');
  await wait(1800);
  R.final = ctx.__props.final; R.finalists = ctx.__props.finalists;
  R.finalCards = await bf.$$eval('#final .fc', els => els.length);
  await bf.screenshot({ path: path.join(OUT, 'e-final.png') });
  // 대결이 열린 뒤에는 미션 칸이 미션을 바꾸지 않아요
  const s5 = await open(browser, `?p=board&embed=status&m=5&start=1&k=${KEY}`, 340, 150, '상태5');
  await wait(1000);
  R.afterFinal = ctx.__props.mission; R.status5 = await statusText(s5);
  await s5.screenshot({ path: path.join(OUT, 'e-status-final.png') });
  await s1b.screenshot({ path: path.join(OUT, 'e-status-past.png') });
  console.log(JSON.stringify(R, null, 1));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
