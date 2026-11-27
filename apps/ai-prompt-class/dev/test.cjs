// 확인용: 가짜 앱스 스크립트 위에서 학생 페이지·결과판을 브라우저로 열어 수업 흐름을 따라가 봐요.
// 실행: node apps/ai-prompt-class/dev/test.cjs <스크린샷 폴더> [사진 파일]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { makeContext, callServer } = require('./gas-fake.cjs');

const OUT = path.resolve(process.argv[2] || 'shots');
const PHOTO = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.join(__dirname, '..');
const ctx = makeContext();
ctx.setup();
const CODE = ctx.__props.code, KEY = ctx.__props.teacherKey;
const errors = [];
const RESULT = {};
let calls = 0;

const SHIM = `
(function(){
  function runner(ok, fail){
    return new Proxy({}, { get: function(t, p){
      if (p === 'withSuccessHandler') return function(f){ return runner(f, fail); };
      if (p === 'withFailureHandler') return function(f){ return runner(ok, f); };
      return function(){
        var args = Array.prototype.slice.call(arguments);
        setTimeout(function(){
          window.__gs(p, JSON.stringify(args)).then(function(r){
            var v = JSON.parse(r);
            if (v.err) { if (fail) fail(new Error(v.err)); } else if (ok) ok(v.val);
          });
        }, 60 + Math.random()*120);
      };
    }});
  }
  window.google = { script: { run: runner(), url: { getLocation: function(cb){ var o = {}; location.search.replace(/^\\?/, '').split('&').forEach(function(kv){ if(!kv) return; var a = kv.split('='); o[decodeURIComponent(a[0])] = decodeURIComponent(a[1]||''); }); setTimeout(function(){ cb({ parameter: o }); }, 30); } } } };
})();`;

async function wire(page, name) {
  await page.exposeFunction('__gs', (fn, argsJson) => {
    calls++;
    try { return JSON.stringify({ val: callServer(ctx, fn, JSON.parse(argsJson)) }); }
    catch (e) { errors.push(`[${name}] 서버 ${fn}: ${e.message}`); return JSON.stringify({ err: e.message }); }
  });
  await page.addInitScript(SHIM);
  page.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::ERR/.test(m.text())) errors.push(`[${name}] console: ${m.text()}`); });
}

const wait = ms => new Promise(r => setTimeout(r, ms));
function fakeThumb() {
  if (PHOTO && fs.existsSync(PHOTO + '.thumb')) return fs.readFileSync(PHOTO + '.thumb', 'utf8');
  return '';
}

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  const file = n => 'file://' + path.join(ROOT, n);

  // 결과판 (교사)
  const bctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const board = await bctx.newPage(); await wire(board, '결과판');
  await board.goto(file('board.html') + '?p=board&k=' + KEY + '&c=3');
  await wait(1500);
  await board.screenshot({ path: path.join(OUT, 'b0-wait.png') });

  // 학생 (태블릿 가로, 터치)
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await sctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const st = await sctx.newPage(); await wire(st, '학생');
  await st.goto(file('student.html'));
  await wait(800);
  await st.screenshot({ path: path.join(OUT, 's0-join.png') });
  await st.fill('#in-code', '0000'); await st.selectOption('#in-cls', '3'); await st.selectOption('#in-num', '12');
  await st.tap('#btn-join'); await wait(800);
  const msg = await st.textContent('#join-msg');
  await st.fill('#in-code', CODE); await st.tap('#btn-join'); await wait(1000);
  await st.screenshot({ path: path.join(OUT, 's1-wait.png') });

  // 교사가 미션 1을 열어요
  await board.click('#tbar [data-m="1"]'); await wait(800);
  await st.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(1200);
  const mtitle = await st.textContent('#mission h1');
  await st.screenshot({ path: path.join(OUT, 's2-m1.png'), fullPage: true });
  const p1 = await st.textContent('#prompt');
  await st.tap('#btn-roll'); await wait(1400);
  const p2 = await st.textContent('#prompt');
  await st.tap('[data-copy="after"]'); await wait(400);
  const clip = await st.evaluate(() => navigator.clipboard.readText().catch(() => '(읽기 막힘)'));

  // 다른 학생들이 올려요 (서버 직접 호출)
  const thumb = fakeThumb();
  const img = PHOTO ? fs.readFileSync(PHOTO).toString('base64') : 'AA==';
  for (const n of [4, 7, 9, 15, 21]) {
    callServer(ctx, 'submit', [{ cls: 3, num: n, mission: 1, kind: 'before', image: img, thumb: thumb || 'data:image/jpeg;base64,AA==' }]);
    if (n !== 21) callServer(ctx, 'submit', [{ cls: 3, num: n, mission: 1, kind: 'after', image: img, thumb: thumb || 'data:image/jpeg;base64,AA==' }]);
  }
  callServer(ctx, 'submit', [{ cls: 1, num: 3, mission: 1, kind: 'after', image: img, thumb: thumb || 'data:image/jpeg;base64,AA==' }]);

  // 내 Before·After 사진 올리기
  if (PHOTO) {
    await st.setInputFiles('[data-file="before"]', PHOTO); await wait(1200);
    await st.tap('[data-send="before"]'); await wait(1200);
    await st.setInputFiles('[data-file="after"]', PHOTO); await wait(1200);
    await st.tap('[data-send="after"]'); await wait(2500);
  }
  await st.screenshot({ path: path.join(OUT, 's3-uploaded.png'), fullPage: true });
  const cards = await st.$$eval('#vote-grid .w', els => els.length);
  // 한 표
  if (cards) { await st.tap('#vote-grid .w >> nth=0'); await wait(600); await st.screenshot({ path: path.join(OUT, 's4-modal.png') }); await st.tap('#btn-vote'); await wait(1000); }
  await st.screenshot({ path: path.join(OUT, 's5-voted.png'), fullPage: true });
  // 다른 학생들 표
  [[4, 7], [9, 7], [15, 7], [21, 9], [7, 4]].forEach(([v, t]) => callServer(ctx, 'vote', [3, v, 1, t]));
  const selfVote = callServer(ctx, 'vote', [3, 5, 1, 5]);

  await wait(4500);
  await board.screenshot({ path: path.join(OUT, 'b1-class3.png') });
  await board.click('#tabs [data-t="all"]'); await wait(1500);
  await board.screenshot({ path: path.join(OUT, 'b2-all.png') });
  await board.click('#tabs [data-t="3"]'); await wait(1200);
  await board.click('#grid .card >> nth=0'); await wait(800);
  await board.screenshot({ path: path.join(OUT, 'b3-modal.png') });
  await board.click('#mx');

  // 미션 2 (글)
  await board.click('#tbar [data-m="2"]'); await wait(800);
  await st.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(1500);
  const m2 = await st.textContent('#mission h1');
  await st.fill('[data-text="before"]', '라면 끓이는 법\n1. 물 550ml를 끓인다\n2. 면과 스프를 넣는다'); await st.tap('[data-send="before"]'); await wait(1000);
  await st.fill('[data-text="after"]', '무인도 10분 생존 라면!\n1. 빗물을 냄비에…'); await st.tap('[data-send="after"]'); await wait(1500);
  for (const n of [2, 8, 30]) { callServer(ctx, 'submit', [{ cls: 3, num: n, mission: 2, kind: 'before', text: '김밥 만드는 법: 밥을 펴고…' }]); callServer(ctx, 'submit', [{ cls: 3, num: n, mission: 2, kind: 'after', text: '조선시대 수라간에서 불 없이 만드는 ' + n + '번의 김밥: 먼저 아궁이 대신…' }]); }
  callServer(ctx, 'vote', [3, 2, 2, 8]);
  await wait(4500);
  await st.screenshot({ path: path.join(OUT, 's6-m2.png'), fullPage: true });
  await board.screenshot({ path: path.join(OUT, 'b4-m2.png') });

  // 미션 4: 재료 고르고 ‘복사하고 제미나이 열기’ → 복사된 글자, 새 탭, 고정 막대, 돌아오면 올리기 칸
  await sctx.route('https://gemini.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Gemini</title>gemini' }));
  await board.click('#tbar [data-m="4"]'); await wait(800);
  await st.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(1500);
  await st.tap('#c1 .chip >> text=아편 전쟁'); await wait(300);
  await st.tap('#c2 .chip >> text=OX 퀴즈 5개'); await wait(300);
  await st.evaluate(() => { const c = document.querySelector('#c2 .slot'); window.scrollTo(0, c.getBoundingClientRect().top + window.pageYOffset - 100); window.dispatchEvent(new Event('scroll')); }); await wait(500);
  const dockOn = await st.evaluate(() => document.getElementById('dock').className === 'on');
  const dockText = await st.textContent('#dock-pv');
  await st.screenshot({ path: path.join(OUT, 's9-m4-dock.png') });
  const popP = sctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
  await st.tap(dockOn ? '#dock-go' : '[data-go="after"]'); const pop = await popP; await wait(600);
  const copied = await st.evaluate(() => navigator.clipboard.readText().catch(() => '(읽기 막힘)'));
  const popUrl = pop ? pop.url() : null;
  if (pop) await pop.close();
  await st.bringToFront();
  await st.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(1200);
  const flashed = await st.evaluate(() => document.getElementById('up-after').className);
  await st.screenshot({ path: path.join(OUT, 's10-m4-back.png') });
  await st.evaluate(() => window.scrollTo(0, 0)); await wait(300);
  const popP2 = sctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
  await st.tap('[data-go="before"]'); const pop2 = await popP2; await wait(500);
  const copiedBefore = await st.evaluate(() => navigator.clipboard.readText().catch(() => '(읽기 막힘)'));
  if (pop2) await pop2.close();
  RESULT.m4 = { dockOn, dockText, copied, popUrl, flashed, copiedBefore, beforeTab: !!pop2 };

  // 미션 6 화면 (내 이야기)
  await board.click('#tbar [data-m="6"]'); await wait(800);
  await st.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(1500);
  const p6a = await st.textContent('#prompt');
  await st.evaluate(() => { const c = document.querySelector('#c2 .slot'); window.scrollTo(0, c.getBoundingClientRect().top + window.pageYOffset - 80); window.dispatchEvent(new Event('scroll')); }); await wait(500);
  RESULT.m6dock = await st.evaluate(() => [document.getElementById('dock').className, document.getElementById('dock-pv').textContent.slice(0, 80)]);
  await st.screenshot({ path: path.join(OUT, 's7b-m6-dock.png') });
  await st.evaluate(() => window.scrollTo(0, 0)); await wait(300);
  await st.fill('[data-story="when"]', '초등학교 6학년 운동회'); await wait(300);
  const p6b = await st.textContent('#prompt');
  await st.screenshot({ path: path.join(OUT, 's7-m6.png'), fullPage: true });

  // 반 대표 대결
  for (let c = 1; c <= 5; c++) if (c !== 3) { callServer(ctx, 'submit', [{ cls: c, num: 1, mission: 2, kind: 'after', text: c + '반 1번 작품: 해적선에서 만드는 핫초코…' }]); callServer(ctx, 'vote', [c, 2, 2, 1]); }
  board.on('dialog', d => d.accept());
  await board.click('#tf'); await wait(1500);
  await st.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(1800);
  const fcards = await st.$$eval('#final-grid .w', els => els.length);
  if (fcards) { await st.tap('#final-grid .w >> nth=1'); await wait(500); const b = await st.$('#btn-fvote'); if (b) { await b.tap(); await wait(1000); } }
  [[1, 5, '2-3-8'], [2, 5, '2-1-1'], [4, 9, '2-3-8'], [5, 9, '2-3-8']].forEach(([c, n, k]) => callServer(ctx, 'voteFinal', [c, n, k]));
  await wait(3500);
  await st.screenshot({ path: path.join(OUT, 's8-final.png'), fullPage: true });
  await board.screenshot({ path: path.join(OUT, 'b5-final.png') });

  // 새로고침해도 이어지는지
  await st.reload(); await wait(1500);
  const after = await st.evaluate(() => document.querySelector('.scr.on').id);

  console.log(JSON.stringify({
    code: CODE, wrongCodeMsg: msg, missionTitle: mtitle, promptBefore: p1, promptAfterRoll: p2, clipboard: clip,
    voteCards: cards, selfVote, m2, p6a, p6b, finalCards: fcards, afterReload: after,
    sheets: Object.keys(ctx.__ss.sheets), drive: ctx.__files.length, calls, finalists: ctx.__props.finalists, ...RESULT
  }, null, 1));
  console.log('ERRORS', JSON.stringify(errors, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
