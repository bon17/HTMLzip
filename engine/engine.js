// ===== ENGINE v2.1 =====
// HTMLzip 슬라이드 엔진: 이동·필기·칠판·타이머·전체 화면·모션·상호작용·편집·저장·점검
// 디자인은 정하지 않는다. 덱 디자인의 CSS 변수(--bg, --fg, --muted, --accent)를 읽어 쓴다.
(() => {
'use strict';
const VERSION = '2.1';
if (window.__hzEngine) return;
window.__hzEngine = VERSION;

const W = 1920, H = 1080;
const doc = document, root = doc.documentElement;
const deck = doc.getElementById('deck');
if (!deck) { console.warn('[HTMLzip] <main id="deck">를 찾지 못했습니다.'); return; }

/* ------------------------------------------------------------------ */
/* 유틸리티                                                            */
/* ------------------------------------------------------------------ */
const $ = (s, r = doc) => r.querySelector(s);
const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d = 0) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
const round1 = v => Math.round(v * 10) / 10;
const rand = (a, b) => a + Math.random() * (b - a);
const wait = ms => new Promise(r => setTimeout(r, ms));
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const EASE_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const EASE_IO = 'cubic-bezier(0.65, 0, 0.35, 1)';

function h(tag, attrs, ...kids) {
  const el = doc.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : doc.createTextNode(String(c)));
  return el;
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function accent() { return (getComputedStyle(root).getPropertyValue('--accent') || '').trim() || '#f26b3a'; }
function accent2() { return (getComputedStyle(root).getPropertyValue('--accent-2') || '').trim() || '#ffd34d'; }

/* ------------------------------------------------------------------ */
/* 저장소·설정                                                         */
/* ------------------------------------------------------------------ */
const DECK_ID = deck.dataset.deckId || decodeURIComponent(location.pathname.split('/').pop() || 'deck');
const KEY = k => `htmlzip:${DECK_ID}:${k}`;
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(KEY(k), JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(KEY(k)); } catch (e) { /* 저장소 없음 */ } }
};
const REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const S = Object.assign({
  strength: REDUCE ? 'calm' : 'default', speed: 1, caseVertical: false, caseAt: null, caseFolded: false, navArrows: true, pageInFull: true,
  timerMin: 10, color: 0, width: 1, eraserMode: 'stroke', eraserSize: 1, theme: null, view: 'basic'
}, (() => {
  // v2.0부터 툴바 대신 필통·메뉴 서랍을 쓴다: 예전 툴바 설정은 버린다
  const saved = store.get('settings', {}) || {};
  if (saved._v !== 3) { ['quick', 'pos', 'collapsed'].forEach(k => delete saved[k]); saved._v = 3; }
  return saved;
})());
const saveSettings = () => store.set('settings', S);

const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ffffff', '#1c1c1e'];
const COLOR_NAMES = ['빨강', '노랑', '초록', '파랑', '흰색', '검정'];
const WIDTHS = [4, 8, 14];
const ERASERS = [26, 52, 100];
const ORIG_THEME = root.getAttribute('data-theme');
const THEMES = (deck.dataset.themes || '').split(/\s+/).filter(Boolean);
const T = ms => ms * S.speed;
let forceMotion = false; // 편집 모드 미리보기는 설정과 상관없이 실제 효과를 보여 준다
const strength = () => forceMotion ? 'default' : S.strength;

/* ------------------------------------------------------------------ */
/* 아이콘 (인라인 SVG)                                                 */
/* ------------------------------------------------------------------ */
const P = {
  prev: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  hand: '<path d="M5 3l6.5 17 2.4-7.1L21 10.5z"/>',
  pen: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/><path d="M15 5l4 4"/>',
  hl: '<path d="M9 11l-6 6v3h9l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  eraser: '<path d="M7 21l-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L11 21z"/><path d="M22 21H7"/><path d="M5 11l9 9"/>',
  laser: '<circle cx="12" cy="12" r="2.2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  trashAll: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 9h10M7 12h6M12 16v4M8 20h8"/>',
  board: '<rect x="3" y="3" width="18" height="13" rx="1.5"/><path d="M7 20l3-4M17 20l-3-4M7 8l3 3 3-3 3 3"/>',
  view: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M10 2h4"/>',
  party: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  toc: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  full: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  pos: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15.5h18"/>',
  collapse: '<path d="M6 9l6 6 6-6"/>',
  expand: '<path d="M18 15l-6-6-6 6"/>',
  settings: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4.5M12 17.5h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  text: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
  rect: '<rect x="3" y="6" width="18" height="12" rx="2.5"/>',
  circle: '<circle cx="12" cy="12" r="8.5"/>',
  arrow: '<path d="M4 12h15M14 6l6 6-6 6"/>',
  line: '<path d="M5 19L19 5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  front: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  back: '<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 22 12a14 14 0 0 1-2.6 3.4M6.6 6.6A14 14 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  done: '<path d="M20 6L9 17l-5-5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  alL: '<path d="M4 3v18"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/>',
  alC: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  alR: '<path d="M20 3v18"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="7" height="4" rx="1"/>',
  alT: '<path d="M3 4h18"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="7" rx="1"/>',
  alM: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  alB: '<path d="M3 20h18"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="7" rx="1"/>',
  disH: '<path d="M4 3v18M20 3v18"/><rect x="9" y="8" width="6" height="8" rx="1"/>',
  disV: '<path d="M3 4h18M3 20h18"/><rect x="8" y="9" width="8" height="6" rx="1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>'
};
const icon = n => `<svg class="hz-i" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

/* ------------------------------------------------------------------ */
/* UI 골격                                                             */
/* ------------------------------------------------------------------ */
const ui = h('div', { id: 'hz-ui' });
const runtimeStyle = h('style', { id: 'hz-runtime-style', 'data-hz-runtime': '' });
doc.head.appendChild(runtimeStyle);

const overlay = h('div', { class: 'hz-overlay' });
const boardBg = h('div', { class: 'hz-board-bg' });
const inkC = h('canvas', { class: 'hz-ink' });
const liveC = h('canvas', { class: 'hz-live' });
const laserC = h('canvas', { class: 'hz-laser' });
const fxLayer = h('div', { class: 'hz-fx-layer' });
const pageTxt = h('b');
const pageLine = h('span');
const pageno = h('div', { class: 'hz-page' }, pageTxt, h('i', {}, pageLine));
const selLayer = h('div', { class: 'hz-sel-layer' });
const input = h('div', { class: 'hz-input' });
overlay.append(boardBg, inkC, liveC, fxLayer, pageno, laserC, selLayer, input);
const ictx = inkC.getContext('2d'), lctx = liveC.getContext('2d'), zctx = laserC.getContext('2d');

const SHORT = {
  prev: '←', next: '→', hand: 'V', pen: 'P', hl: 'H', eraser: 'E', laser: 'L', color: 'C', undo: 'Ctrl+Z', redo: 'Ctrl+Shift+Z',
  clear: 'X', clearAll: 'Shift+X', board: 'B', edit: 'Shift+E', timer: 'T', celebrate: 'G', toc: 'O', full: 'F', help: '?'
};
const tip = (cmd, label) => label + (SHORT[cmd] ? ` (${SHORT[cmd]})` : '');
/* 편집 도구 막대 버튼 (아이콘 + 이름) */
function btn(cmd, label, ic, extra = '') {
  const b = h('button', { class: 'hz-btn ' + extra, 'data-cmd': cmd, type: 'button', title: tip(cmd, label), 'aria-label': label });
  b.innerHTML = icon(ic) + `<span class="hz-lbl">${label}</span>`;
  return b;
}
const sep = () => h('span', { class: 'hz-sep' });
/* 필통 버튼 (아이콘만) */
function tbtn(cmd, label, ic) {
  const b = h('button', { class: 'hz-tb', 'data-cmd': cmd, type: 'button', title: tip(cmd, label), 'aria-label': label });
  b.innerHTML = ic === 'swatch' ? '<span class="hz-swatch"></span>' : icon(ic);
  return b;
}
/* 메뉴 서랍 타일 (아이콘 + 큰 이름) */
function tile(cmd, label, ic) {
  const b = h('button', { class: 'hz-tile', 'data-cmd': cmd, type: 'button', title: tip(cmd, label) });
  b.innerHTML = icon(ic) + `<span class="hz-lbl">${label}</span>`;
  return b;
}

/* 필통 */
const caseGrip = h('span', { class: 'hz-grip', title: '끌어서 옮기기 · 두 번 누르면 가로/세로' }, ...Array.from({ length: 6 }, () => h('i')));
const caseBar = h('div', { class: 'hz-case hz-chrome', role: 'toolbar', 'aria-label': '필통' }, caseGrip,
  tbtn('hand', '손', 'hand'), tbtn('pen', '펜', 'pen'), tbtn('hl', '형광펜', 'hl'), tbtn('eraser', '지우개', 'eraser'),
  tbtn('laser', '레이저', 'laser'), tbtn('color', '색·굵기', 'swatch'), tbtn('undo', '되돌리기', 'undo'), tbtn('fold', '필통 접기', 'minimize'));
const caseMini = h('button', { class: 'hz-case-mini hz-chrome', type: 'button', 'data-cmd': 'unfold', title: '필통 펼치기', 'aria-label': '필통 펼치기' });
/* 메뉴 버튼·넘김 화살표 */
const menuBtn = h('button', { class: 'hz-menu-btn hz-chrome', type: 'button', 'data-cmd': 'menu', title: '메뉴 (도구·슬라이드·설정)', 'aria-label': '메뉴' });
menuBtn.innerHTML = icon('menu') + '<span class="hz-dot"></span>';
const navPrev = h('button', { class: 'hz-nav hz-nav-l hz-chrome', type: 'button', 'data-cmd': 'prev', title: '이전 (←)', 'aria-label': '이전', html: icon('prev') });
const navNext = h('button', { class: 'hz-nav hz-nav-r hz-chrome', type: 'button', 'data-cmd': 'next', title: '다음 (→)', 'aria-label': '다음', html: icon('next') });
/* 메뉴 서랍 */
const drawer = h('aside', { class: 'hz-drawer', 'aria-label': '메뉴 서랍' });
const drTabs = h('div', { class: 'hz-dr-tabs', role: 'tablist' });
const drMenu = h('div', { class: 'hz-dr-body', 'data-tab': 'menu' });
const drSlides = h('div', { class: 'hz-dr-body', 'data-tab': 'slides' });
const drClose = h('button', { class: 'hz-x', type: 'button', 'data-cmd': 'closeMenu', title: '닫기 (Esc)', 'aria-label': '닫기', html: icon('x') });
[['menu', '메뉴'], ['slides', '슬라이드']].forEach(([k, l]) => drTabs.appendChild(h('button', { type: 'button', role: 'tab', 'data-tab': k }, l)));
drawer.append(h('div', { class: 'hz-dr-head' }, drTabs, drClose), drMenu, drSlides);
const section = (title, ...tiles) => h('div', { class: 'hz-dr-sec' }, h('h4', {}, title), h('div', { class: 'hz-tiles' }, ...tiles));
drMenu.append(
  section('수업', tile('toc', '목차', 'toc'), tile('board', '칠판', 'board'), tile('timer', '타이머', 'timer'),
    tile('celebrate', '축하', 'party'), tile('view', '발표자 보기', 'view'), tile('full', '전체 화면', 'full')),
  section('필기', tile('clear', '이 장 지우기', 'trash'), tile('clearAll', '전체 지우기', 'trashAll'), tile('redo', '다시 하기', 'redo')),
  section('만들기', tile('edit', '편집', 'edit'), tile('check', '점검', 'check'), tile('settings', '설정', 'settings'), tile('help', '단축키', 'help')));

const boardBar = h('div', { class: 'hz-boardbar hz-chrome' });
const timerEl = h('div', { class: 'hz-timer' });
const toastEl = h('div', { class: 'hz-toast', role: 'status' });
const modalWrap = h('div', { class: 'hz-modal-wrap' });
const colorPop = h('div', { class: 'hz-pop' });
const emojiPop = h('div', { class: 'hz-pop' });
const presenterCol = h('div', { class: 'hz-presenter-col hz-chrome' });
const editBar = h('div', { class: 'hz-editbar' });
const propsPanel = h('aside', { class: 'hz-props' });
const confettiC = h('canvas', { class: 'hz-confetti' });

ui.append(overlay, navPrev, navNext, caseBar, caseMini, menuBtn, boardBar, timerEl, drawer,
  presenterCol, editBar, propsPanel, colorPop, emojiPop, toastEl, modalWrap, confettiC);
doc.body.appendChild(ui);
root.classList.add('hz-on');

/* 토스트 */
let toastT = 0;
function toast(msg, ms = 1400) {
  toastEl.textContent = msg; toastEl.classList.add('hz-show');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('hz-show'), ms);
}

/* ------------------------------------------------------------------ */
/* 배치: 무대를 화면에 맞춘다                                         */
/* ------------------------------------------------------------------ */
const DRAWER_W = 340;
let scale = 1, stageX = 0, stageY = 0;
function layout() {
  const vw = innerWidth, vh = innerHeight;
  const full = root.classList.contains('hz-full');
  const editing = root.classList.contains('hz-editing');
  let L = 12, T0 = 12, R = 12, B = 12, pcol = 380;
  if (full) { L = T0 = R = B = 0; }
  else if (editing) { T0 = 60 + 14; R = 320 + 14; L = DRAWER_W + 14; }
  else if (root.classList.contains('hz-presenter')) {
    const col = pcol = clamp((vw - L - R) * 0.32, 260, 440);
    R += col + 16;
  }
  const aw = Math.max(100, vw - L - R), ah = Math.max(100, vh - T0 - B);
  scale = Math.min(aw / W, ah / H);
  stageX = L + (aw - W * scale) / 2; stageY = T0 + (ah - H * scale) / 2;
  runtimeStyle.textContent = `:root{--hz-x:${stageX}px;--hz-y:${stageY}px;--hz-s:${scale};--hz-inv:${1 / scale};--hz-pcol:${pcol}px}`;
  sizeCanvases();
  placeCase();
  if (typeof renderSelBoxes === 'function') renderSelBoxes();
}
/* 필통 자리: 화면 비율로 기억해서 창 크기가 바뀌어도 같은 쪽에 있게 */
function placeCase() {
  const vw = innerWidth, vh = innerHeight;
  const el = S.caseFolded ? caseMini : caseBar;
  const r = el.getBoundingClientRect();
  const w = r.width || 60, hh = r.height || 60;
  let x = 18, y = vh - hh - 18;
  if (S.caseAt) { x = S.caseAt.x * (vw - w); y = S.caseAt.y * (vh - hh); }
  x = clamp(x, 6, Math.max(6, vw - w - 6)); y = clamp(y, 6, Math.max(6, vh - hh - 6));
  [caseBar, caseMini].forEach(e => { e.style.left = Math.round(x) + 'px'; e.style.top = Math.round(y) + 'px'; });
}
function applyCase() {
  root.classList.toggle('hz-case-v', !!S.caseVertical);
  root.classList.toggle('hz-case-folded', !!S.caseFolded);
  requestAnimationFrame(placeCase);
}
let gripTap = 0;
caseGrip.addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation();
  const r = caseBar.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
  let moved = false;
  try { caseGrip.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  const mv = ev => {
    if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
    moved = true;
    const x = clamp(ev.clientX - ox, 6, innerWidth - r.width - 6), y = clamp(ev.clientY - oy, 6, innerHeight - r.height - 6);
    [caseBar, caseMini].forEach(el => { el.style.left = x + 'px'; el.style.top = y + 'px'; });
  };
  const up = () => {
    caseGrip.removeEventListener('pointermove', mv); caseGrip.removeEventListener('pointerup', up); caseGrip.removeEventListener('pointercancel', up);
    if (moved) {
      const rr = caseBar.getBoundingClientRect();
      S.caseAt = { x: rr.left / Math.max(1, innerWidth - rr.width), y: rr.top / Math.max(1, innerHeight - rr.height) };
      saveSettings(); return;
    }
    const now = Date.now();
    if (now - gripTap < 380) { gripTap = 0; toggleCaseDir(); } else gripTap = now;
  };
  caseGrip.addEventListener('pointermove', mv); caseGrip.addEventListener('pointerup', up); caseGrip.addEventListener('pointercancel', up);
});
function toggleCaseDir() {
  S.caseVertical = !S.caseVertical; saveSettings(); applyCase(); closePops();
  toast(S.caseVertical ? '필통: 세로' : '필통: 가로', 900);
}
function setCaseFolded(v) { S.caseFolded = v; saveSettings(); closePops(); applyCase(); updateChrome(); }

/* 메뉴 서랍 */
let drawerTab = 'menu';
const drawerOpen = () => drawer.classList.contains('hz-open');
function openDrawer(tab = drawerTab) {
  drawerTab = tab;
  drawer.classList.add('hz-open'); root.classList.add('hz-drawer-open');
  $$('button', drTabs).forEach(b => b.classList.toggle('hz-sel', b.dataset.tab === tab));
  [drMenu, drSlides].forEach(b => b.classList.toggle('hz-sel', b.dataset.tab === tab));
  closePops();
  if (tab === 'slides' && typeof renderThumbs === 'function') renderThumbs();
  layout();
}
function closeDrawer(force = false) {
  if (!drawerOpen() || (root.classList.contains('hz-editing') && !force)) return;
  drawer.classList.remove('hz-open'); root.classList.remove('hz-drawer-open');
  layout();
}
drTabs.addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) openDrawer(b.dataset.tab); });

function toStage(e) { return { x: (e.clientX - stageX) / scale, y: (e.clientY - stageY) / scale }; }
function stageRect(el) {
  const r = el.getBoundingClientRect();
  return { x: (r.left - stageX) / scale, y: (r.top - stageY) / scale, w: r.width / scale, h: r.height / scale };
}

/* ------------------------------------------------------------------ */
/* 모션 실행 기반: 진행 중인 모션을 모아 두고 한 번에 끝낼 수 있게    */
/* ------------------------------------------------------------------ */
const running = new Set();   // 끝이 있는 애니메이션·트윈
const timers = new Set();    // 예약된 모션
const tweens = new Set();
function anim(el, k, o) {
  let a;
  try { a = el.animate(k, o); } catch (e) { return null; }
  if (o.iterations !== Infinity) {
    running.add(a);
    const done = () => running.delete(a);
    a.finished.then(done, done);
  }
  return a;
}
function later(ms, fn, flush = true) {
  const t = { fn, flush };
  t.id = setTimeout(() => { timers.delete(t); fn(); }, Math.max(0, ms));
  timers.add(t);
  return t;
}
function tween(el, delay, dur, upd, onFinish, onCancel) {
  const tw = { el, done: false, raf: 0, t: 0 };
  const stop = () => { tw.done = true; cancelAnimationFrame(tw.raf); clearTimeout(tw.t); running.delete(tw); tweens.delete(tw); };
  tw.finish = () => { if (tw.done) return; stop(); upd(1); onFinish && onFinish(); };
  tw.cancel = () => { if (tw.done) return; stop(); onCancel && onCancel(); };
  running.add(tw); tweens.add(tw); upd(0);
  tw.t = setTimeout(() => {
    const t0 = performance.now();
    const step = now => {
      if (tw.done) return;
      const p = Math.min(1, (now - t0) / Math.max(1, dur));
      upd(p);
      if (p < 1) tw.raf = requestAnimationFrame(step); else tw.finish();
    };
    tw.raf = requestAnimationFrame(step);
  }, Math.max(0, delay));
  return tw;
}
function finishAll() {
  for (let i = 0; i < 6 && (timers.size || running.size); i++) {
    const ts = [...timers]; timers.clear();
    ts.forEach(t => { clearTimeout(t.id); if (t.flush) t.fn(); });
    [...running].forEach(a => { try { a.finish(); } catch (e) { try { a.cancel(); } catch (_) { /* 무시 */ } } });
    running.clear();
  }
}
const isCssAnim = a => ('animationName' in a) || ('transitionProperty' in a);

/* 런타임으로 넣은 것(글자 나누기, 효과 요소, 상태 클래스)을 원래대로 */
const RUNTIME_CLASSES = ['hz-pre', 'hz-gone', 'hz-struck', 'hz-fx-color', 'hz-fx-rel', 'hz-fx-host', 'hz-flipped', 'hz-correct', 'hz-wrong', 'hz-zoomed'];
function unwrapIn(r) {
  const wraps = $$('[data-hz-wrap]', r).reverse();
  const parents = new Set();
  wraps.forEach(w => { const p = w.parentNode; if (!p) return; while (w.firstChild) p.insertBefore(w.firstChild, w); p.removeChild(w); parents.add(p); });
  parents.forEach(p => p.normalize && p.normalize());
  $$('[data-hz-split]', r).forEach(e => e.removeAttribute('data-hz-split'));
  if (r.removeAttribute) r.removeAttribute('data-hz-split');
}
function numText(el) {
  const w = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) if (/\d/.test(w.currentNode.nodeValue)) return w.currentNode;
  return null;
}
function restoreCounts(r) {
  const list = $$('[data-hz-text]', r);
  if (r.hasAttribute && r.hasAttribute('data-hz-text')) list.push(r);
  list.forEach(el => { const tn = numText(el); if (tn) tn.nodeValue = el.getAttribute('data-hz-text'); el.removeAttribute('data-hz-text'); });
}
function cleanEl(el, keepAnims = false) {
  if (!keepAnims) el.getAnimations({ subtree: true }).forEach(a => { if (!isCssAnim(a)) a.cancel(); });
  [...tweens].forEach(t => { if (el.contains(t.el)) t.cancel(); });
  $$('[data-hz-runtime]', el).forEach(n => n.remove());
  unwrapIn(el); restoreCounts(el);
  el.classList.remove(...RUNTIME_CLASSES);
  $$('.' + RUNTIME_CLASSES.join(',.'), el).forEach(n => n.classList.remove(...RUNTIME_CLASSES));
  const c = circleOf.get(el); if (c) { c.remove(); circleOf.delete(el); }
}
function ensureHost(el) {
  if (getComputedStyle(el).position === 'static') el.classList.add('hz-fx-rel');
  el.classList.add('hz-fx-host');
}

/* 글자를 단어·글자 단위로 나눈다 (끝나면 unwrapIn으로 원상복구) */
function splitText(el, mode) {
  const out = [];
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeValue.trim() && !n.parentElement.closest('[data-hz-runtime],svg,script,style')) ? 1 : 3
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    const frag = doc.createDocumentFragment();
    n.nodeValue.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); return; }
      const w = h('span', { class: 'hz-w', 'data-hz-wrap': '' });
      if (mode === 'w') { w.textContent = part; out.push(w); }
      else [...part].forEach(ch => { const c = h('span', { class: 'hz-c', 'data-hz-wrap': '' }, ch); w.appendChild(c); out.push(c); });
      frag.appendChild(w);
    });
    n.parentNode.replaceChild(frag, n);
  });
  el.setAttribute('data-hz-split', '');
  return out;
}

/* 줄 단위 글자 영역 (형광펜·밑줄·취소선 위치 계산) */
function lineRects(el) {
  const er = el.getBoundingClientRect();
  const lines = [];
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.nodeValue.trim() && !n.parentElement.closest('[data-hz-runtime]')) ? 1 : 3 });
  const range = doc.createRange();
  while (walker.nextNode()) {
    range.selectNodeContents(walker.currentNode);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      const l = lines.find(L => Math.abs(L.top - r.top) < r.height * 0.5);
      if (l) { l.left = Math.min(l.left, r.left); l.right = Math.max(l.right, r.right); l.top = Math.min(l.top, r.top); l.bottom = Math.max(l.bottom, r.bottom); }
      else lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
  }
  const bl = el.clientLeft || 0, bt = el.clientTop || 0;
  return lines.map(l => ({ x: (l.left - er.left) / scale - bl, y: (l.top - er.top) / scale - bt, w: (l.right - l.left) / scale, h: (l.bottom - l.top) / scale }));
}

/* ------------------------------------------------------------------ */
/* 모션 라이브러리 (docs/PRINCIPLES.md §4.3과 같아야 한다)             */
/* ------------------------------------------------------------------ */
const LIB = {
  transition: ['fade', 'slide', 'push', 'cover', 'zoom', 'flip', 'wipe', 'circle', 'morph', 'none'],
  anim: ['fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'slide-left', 'slide-right', 'scale-in', 'pop', 'drop', 'flip-in', 'rotate-in', 'blur-in', 'wipe', 'split-words', 'split-chars', 'typewriter', 'stagger', 'count-up', 'bar-grow', 'draw', 'progress-ring', 'connect', 'flow'],
  emphasis: ['pulse', 'shake', 'wiggle', 'bounce', 'glow', 'highlight', 'underline', 'circle', 'color-shift', 'spotlight', 'zoom-focus'],
  exit: ['fade-out', 'scale-out', 'slide-out-left', 'slide-out-right', 'drop-out', 'strike'],
  ambient: ['float', 'drift', 'gradient', 'particles', 'sparkle'],
  interact: ['flip', 'reveal', 'quiz', 'zoom', 'hotspot'],
  celebrate: ['confetti', 'stars']
};
const LABEL = {
  fade: '서서히', slide: '옆으로', push: '밀어내기', cover: '덮기', zoom: '확대', flip: '뒤집기', wipe: '쓸어내기', circle: '원형', morph: '모프', none: '없음',
  'fade-up': '아래에서 위로', 'fade-down': '위에서 아래로', 'fade-left': '오른쪽에서 왼쪽으로', 'fade-right': '왼쪽에서 오른쪽으로',
  'slide-left': '오른쪽에서 밀려 들어옴', 'slide-right': '왼쪽에서 밀려 들어옴', 'scale-in': '커지며', pop: '톡 튀어나옴', drop: '떨어져 튐',
  'flip-in': '돌며 나타남', 'rotate-in': '회전하며', 'blur-in': '흐릿 → 선명', 'split-words': '단어씩', 'split-chars': '글자씩', typewriter: '타자기',
  stagger: '자식 차례로', 'count-up': '숫자 올라가기', 'bar-grow': '막대 자라기', draw: '선 그리기', 'progress-ring': '원형 진행', connect: '선 잇기', flow: '흐름',
  pulse: '두근', shake: '흔들기', wiggle: '꿈틀', bounce: '통통', glow: '빛나기', highlight: '형광펜', underline: '밑줄', 'color-shift': '강조색으로', spotlight: '스포트라이트', 'zoom-focus': '확대해서 보기',
  'fade-out': '서서히 사라짐', 'scale-out': '작아지며', 'slide-out-left': '왼쪽으로 나감', 'slide-out-right': '오른쪽으로 나감', 'drop-out': '떨어지며', strike: '취소선',
  float: '둥실둥실', drift: '떠다니는 도형', gradient: '흐르는 배경색', particles: '입자', sparkle: '반짝임',
  reveal: '가리개', quiz: '퀴즈', hotspot: '핫스팟', confetti: '색종이', stars: '별'
};
const lbl = n => (LABEL[n] ? `${LABEL[n]} (${n})` : n);

const ENTER = {
  fade: [{ opacity: 0 }, { opacity: 1 }],
  'fade-up': [{ opacity: 0, transform: 'translateY(48px)' }, { opacity: 1, transform: 'none' }],
  'fade-down': [{ opacity: 0, transform: 'translateY(-48px)' }, { opacity: 1, transform: 'none' }],
  'fade-left': [{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'none' }],
  'fade-right': [{ opacity: 0, transform: 'translateX(-60px)' }, { opacity: 1, transform: 'none' }],
  'slide-left': [{ opacity: 0, transform: 'translateX(340px)' }, { opacity: 1, transform: 'none' }],
  'slide-right': [{ opacity: 0, transform: 'translateX(-340px)' }, { opacity: 1, transform: 'none' }],
  'scale-in': [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }],
  pop: [{ opacity: 0, transform: 'scale(.35)' }, { opacity: 1, transform: 'scale(1)' }],
  drop: [
    { opacity: 0, transform: 'translateY(-170px)', easing: 'cubic-bezier(.5,0,1,.5)' },
    { opacity: 1, transform: 'translateY(0)', offset: .5, easing: 'cubic-bezier(0,.5,.5,1)' },
    { transform: 'translateY(-38px)', offset: .7, easing: 'cubic-bezier(.5,0,1,.5)' },
    { transform: 'translateY(0)', offset: .85, easing: 'cubic-bezier(0,.5,.5,1)' },
    { transform: 'translateY(-10px)', offset: .93, easing: 'cubic-bezier(.5,0,1,.5)' },
    { opacity: 1, transform: 'none' }],
  'flip-in': [{ opacity: 0, transform: 'perspective(1400px) rotateY(-85deg)' }, { opacity: 1, transform: 'perspective(1400px) rotateY(0deg)' }],
  'rotate-in': [{ opacity: 0, transform: 'rotate(-160deg) scale(.5)' }, { opacity: 1, transform: 'none' }],
  'blur-in': [{ opacity: 0, filter: 'blur(18px)', transform: 'scale(1.06)' }, { opacity: 1, filter: 'blur(0px)', transform: 'none' }],
  wipe: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }]
};
const EASE_OF = { pop: EASE_BACK, drop: 'linear', wipe: EASE_IO, 'rotate-in': EASE_BACK };
const DUR = { pop: 620, drop: 950, 'flip-in': 820, 'blur-in': 900, wipe: 900, 'split-words': 620, 'split-chars': 520, 'count-up': 1600, 'bar-grow': 950, draw: 1300, 'progress-ring': 1500, connect: 900, flow: 700, 'rotate-in': 800 };

const CUSTOM = {
  stagger(el, delay) {
    const kids = [...el.children].filter(c => c.dataset.step == null && !c.hasAttribute('data-hz-runtime'));
    const gap = T(num(el.dataset.gap, 110));
    let end = delay;
    kids.forEach((c, i) => {
      const nm = c.dataset.anim && c.dataset.anim !== 'stagger' ? c.dataset.anim : 'fade-up';
      end = Math.max(end, enter(c, nm, delay + i * gap));
    });
    return end;
  },
  'split-words': (el, delay, dur) => splitAnim(el, delay, dur, 'w'),
  'split-chars': (el, delay, dur) => splitAnim(el, delay, dur, 'c'),
  typewriter(el, delay) {
    const chars = splitText(el, 'c');
    const n = chars.length;
    if (!n) return delay;
    const sp = T(num(el.dataset.speed, 42));
    chars.forEach((c, i) => anim(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: delay + i * sp, fill: 'backwards', easing: 'steps(1, end)' }));
    const caret = h('span', { class: 'hz-caret', 'data-hz-runtime': '' });
    chars[0].before(caret);
    tween(el, delay, n * sp, p => { const i = Math.min(n, Math.round(p * n)); const ref = chars[i - 1]; if (ref) ref.after(caret); });
    return delay + n * sp;
  },
  'count-up'(el, delay, dur) {
    const tn = numText(el);
    if (!tn) return CUSTOM.fallback(el, delay, dur);
    const orig = tn.nodeValue;
    const m = orig.match(/-?\d[\d,]*(\.\d+)?/);
    const target = el.dataset.to != null ? num(el.dataset.to) : num(m[0].replace(/,/g, ''));
    const decimals = el.dataset.to != null ? ((el.dataset.to.split('.')[1] || '').length) : ((m[1] || '').length ? m[1].length - 1 : 0);
    const comma = m[0].includes(',') || target >= 10000;
    const pre = orig.slice(0, m.index), post = orig.slice(m.index + m[0].length);
    const fmt = v => pre + (comma ? v.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : v.toFixed(decimals)) + post;
    el.setAttribute('data-hz-text', orig);
    anim(el, ENTER['fade-up'], { duration: T(450), delay, easing: EASE, fill: 'backwards' });
    tween(el, delay, dur, p => { tn.nodeValue = fmt(target * (1 - Math.pow(1 - p, 3))); },
      () => { if (el.dataset.to == null) tn.nodeValue = orig; },
      () => { tn.nodeValue = orig; el.removeAttribute('data-hz-text'); });
    return delay + dur;
  },
  'bar-grow'(el, delay, dur) {
    const vertical = el.dataset.axis ? el.dataset.axis === 'y' : el.offsetHeight > el.offsetWidth;
    const k = vertical
      ? [{ transform: 'scaleY(0)', transformOrigin: '50% 100%' }, { transform: 'scaleY(1)', transformOrigin: '50% 100%' }]
      : [{ transform: 'scaleX(0)', transformOrigin: '0% 50%' }, { transform: 'scaleX(1)', transformOrigin: '0% 50%' }];
    anim(el, k, { duration: dur, delay, easing: EASE, fill: 'backwards' });
    return delay + dur;
  },
  draw: (el, delay, dur) => drawShapes(el, delay, dur, {}),
  connect: (el, delay, dur) => drawShapes(el, delay, dur, { ease: EASE_IO }),
  'progress-ring'(el, delay, dur) {
    const end = drawShapes(el, delay, dur, { ring: true });
    $$('[data-to]', el).forEach(n => CUSTOM['count-up'](n, delay, dur));
    return end;
  },
  flow(el, delay, dur) {
    anim(el, ENTER.fade, { duration: dur, delay, easing: EASE, fill: 'backwards' });
    svgShapes(el).forEach(sh => {
      const cs = getComputedStyle(sh);
      if (cs.stroke === 'none') return;
      const da = cs.strokeDasharray !== 'none' ? cs.strokeDasharray : '10 14';
      const len = da.split(/[\s,]+/).reduce((s, v) => s + num(v), 0) || 24;
      anim(sh, [{ strokeDasharray: da, strokeDashoffset: 0 }, { strokeDasharray: da, strokeDashoffset: -len * 2 }],
        { duration: 1100, delay, iterations: Infinity, easing: 'linear' });
    });
    return delay + dur;
  },
  fallback(el, delay, dur) { anim(el, ENTER.fade, { duration: dur, delay, easing: EASE, fill: 'backwards' }); return delay + dur; }
};
function splitAnim(el, delay, dur, mode) {
  const parts = splitText(el, mode);
  const n = parts.length;
  if (!n) return CUSTOM.fallback(el, delay, dur);
  const gap = Math.min(mode === 'w' ? 95 : 42, 1500 / n);
  const k = mode === 'w'
    ? [{ opacity: 0, transform: 'translateY(.5em)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }]
    : [{ opacity: 0, transform: 'translateY(.35em) scale(.3)' }, { opacity: 1, transform: 'none' }];
  parts.forEach((p, i) => anim(p, k, { duration: dur, delay: delay + i * gap, easing: mode === 'w' ? EASE : EASE_BACK, fill: 'backwards' }));
  return delay + (n - 1) * gap + dur;
}
const svgShapes = el => (el.matches('path,line,polyline,polygon,circle,ellipse,rect') ? [el] : $$('path,line,polyline,polygon,circle,ellipse,rect', el)).filter(s => s.closest('svg'));
function drawShapes(el, delay, dur, o) {
  const shapes = svgShapes(el);
  if (!shapes.length) return CUSTOM.fallback(el, delay, dur);
  let end = delay;
  shapes.forEach((sh, i) => {
    const cs = getComputedStyle(sh);
    const sd = delay + i * Math.min(dur * 0.25, 220);
    if (!cs.stroke || cs.stroke === 'none') {
      anim(sh, [{ opacity: 0 }, { opacity: 1 }], { duration: T(320), delay: sd + dur * 0.7, fill: 'backwards' });
      end = Math.max(end, sd + dur * 0.7 + T(320));
      return;
    }
    let L = 1000;
    const pl = sh.getAttribute('pathLength');
    try { L = pl ? num(pl, 100) : sh.getTotalLength(); } catch (e) { /* 길이를 모름 */ }
    const authored = cs.strokeDasharray && cs.strokeDasharray !== 'none';
    if (authored && o.ring) {
      anim(sh, [{ strokeDashoffset: L }, { strokeDashoffset: num(cs.strokeDashoffset) }], { duration: dur, delay: sd, easing: EASE, fill: 'backwards' });
    } else if (authored) {
      anim(sh, [{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.6, delay: sd, fill: 'backwards' });
    } else {
      anim(sh, [{ strokeDasharray: `${L} ${L}`, strokeDashoffset: L }, { strokeDasharray: `${L} ${L}`, strokeDashoffset: 0 }],
        { duration: dur, delay: sd, easing: o.ease || 'cubic-bezier(.45,.05,.25,1)', fill: 'backwards' });
    }
    end = Math.max(end, sd + dur);
  });
  $$('text', el).forEach(t => anim(t, [{ opacity: 0 }, { opacity: 1 }], { duration: T(400), delay: delay + dur * 0.6, fill: 'backwards' }));
  return end;
}

/* 등장 */
function enter(el, name, extra = 0) {
  name = name || el.dataset.anim || 'fade';
  const st = strength();
  const delay = T(num(el.dataset.delay)) + extra;
  const dur = T(num(el.dataset.duration, DUR[name] || 700));
  el.classList.remove('hz-pre');
  let end = delay;
  if (st === 'off') {
    if (name === 'stagger') [...el.children].forEach(c => c.classList.remove('hz-pre'));
  } else if (st === 'calm') {
    if (name === 'stagger') [...el.children].forEach(c => c.classList.remove('hz-pre'));
    anim(el, ENTER.fade, { duration: dur * 0.6, delay, easing: EASE, fill: 'backwards' });
    end = delay + dur * 0.6;
  } else if (CUSTOM[name]) end = CUSTOM[name](el, delay, dur);
  else {
    anim(el, ENTER[name] || ENTER.fade, { duration: dur, delay, easing: EASE_OF[name] || EASE, fill: 'backwards' });
    end = delay + dur;
  }
  if (el.dataset.emphasis && el.dataset.emphasisStep == null) later(end + 60, () => emphasize(el));
  // 안쪽 요소의 강조(단계 없음)는 이 요소가 나타난 직후에
  $$('[data-emphasis]', el).forEach(d => {
    if (d.dataset.emphasisStep == null && !isEntrance(d) && entranceAncestor(d) === el) later(end + 60, () => emphasize(d));
  });
  return end;
}
function entranceAncestor(el) {
  for (let p = el.parentElement; p && !p.classList.contains('slide'); p = p.parentElement) if (isEntrance(p)) return p;
  return null;
}

/* 강조 */
const EMPH = {
  pulse: { k: [{ transform: 'none' }, { transform: 'scale(1.12)' }, { transform: 'none' }], d: 650, it: 2, add: true },
  shake: { k: [{ transform: 'none' }, { transform: 'translateX(-16px)' }, { transform: 'translateX(14px)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }], d: 650, add: true },
  wiggle: { k: [{ transform: 'none' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(3deg)' }, { transform: 'none' }], d: 800, add: true },
  bounce: { k: [{ transform: 'none' }, { transform: 'translateY(-34px)', offset: .3 }, { transform: 'none', offset: .55 }, { transform: 'translateY(-14px)', offset: .75 }, { transform: 'none' }], d: 900, add: true },
  glow: { k: () => [{ filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' }, { filter: `drop-shadow(0 0 26px ${accent()})` }, { filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' }], d: 1100, it: 2 }
};
const circleOf = new WeakMap();
let spot = null;
function emphasize(el, name = el.dataset.emphasis, instant = false) {
  if (!name || !el.isConnected) return 0;
  const st = strength();
  const still = instant || st === 'off' || st === 'calm';
  switch (name) {
    case 'highlight': case 'underline': return lineFx(el, name === 'highlight' ? 'hl' : 'ul', still);
    case 'circle': return circleFx(el, still);
    case 'color-shift': {
      const prev = getComputedStyle(el).color;
      el.classList.add('hz-fx-color');
      if (!still) anim(el, [{ color: prev }, { color: accent() }], { duration: T(600), easing: EASE });
      return T(600);
    }
    case 'spotlight': if (instant) return 0; showSpot(el, still); return T(450);
    case 'zoom-focus': {
      if (still) return 0;
      const slide = el.closest('.slide'), r = stageRect(el);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, k = clamp(Math.min(1500 / r.w, 800 / r.h), 1.15, 1.8);
      anim(slide, [{ transformOrigin: `${cx}px ${cy}px`, transform: 'scale(1)' }, { transformOrigin: `${cx}px ${cy}px`, transform: `scale(${k})`, offset: .3 },
        { transformOrigin: `${cx}px ${cy}px`, transform: `scale(${k})`, offset: .72 }, { transformOrigin: `${cx}px ${cy}px`, transform: 'scale(1)' }],
      { duration: T(2600), easing: EASE_IO });
      return T(2600);
    }
    default: {
      if (still) return 0;
      const e = EMPH[name];
      if (!e) return 0;
      anim(el, typeof e.k === 'function' ? e.k() : e.k, { duration: T(e.d), iterations: e.it || 1, easing: 'ease-in-out', composite: e.add ? 'add' : 'replace' });
      return T(e.d) * (e.it || 1);
    }
  }
}
function lineFx(el, kind, still) {
  ensureHost(el);
  const rects = lineRects(el);
  rects.forEach((r, i) => {
    const s = h('span', { class: kind === 'hl' ? 'hz-fx-hl' : 'hz-fx-ul', 'data-hz-runtime': '' });
    if (kind === 'hl') Object.assign(s.style, { left: r.x - 6 + 'px', top: r.y + r.h * 0.1 + 'px', width: r.w + 12 + 'px', height: r.h * 0.84 + 'px' });
    else { const th = Math.max(5, r.h * 0.09); Object.assign(s.style, { left: r.x + 'px', top: r.y + r.h - th * 0.6 + 'px', width: r.w + 'px', height: th + 'px' }); }
    el.appendChild(s);
    if (!still) anim(s, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: T(560), delay: i * T(260), easing: EASE_IO, fill: 'backwards' });
  });
  return T(560) + rects.length * T(260);
}
function circleFx(el, still) {
  const old = circleOf.get(el); if (old) old.remove();
  const r = stageRect(el), pad = 26;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rx = r.w / 2 + pad, ry = r.h / 2 + pad * 0.85;
  const pts = [];
  const a0 = -2.3;
  for (let i = 0; i <= 64; i++) {
    const a = a0 + (Math.PI * 2 + 0.45) * (i / 64);
    const k = 1 + 0.035 * Math.sin(a * 3) + (i / 64) * 0.06;
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
  }
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'hz-fx-circle');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.style.left = '0px'; svg.style.top = '0px';
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M' + pts.join(' L'));
  svg.appendChild(path); fxLayer.appendChild(svg); circleOf.set(el, svg);
  if (!still) { const L = path.getTotalLength(); anim(path, [{ strokeDasharray: `${L} ${L}`, strokeDashoffset: L }, { strokeDasharray: `${L} ${L}`, strokeDashoffset: 0 }], { duration: T(800), easing: EASE_IO }); }
  return T(800);
}
function showSpot(el, still) {
  clearSpot();
  const r = stageRect(el), pad = 22;
  spot = h('div', { class: 'hz-spotlight' });
  Object.assign(spot.style, { left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.w + pad * 2 + 'px', height: r.h + pad * 2 + 'px' });
  fxLayer.appendChild(spot);
  if (!still) anim(spot, [{ opacity: 0 }, { opacity: 1 }], { duration: T(450), easing: EASE });
}
function clearSpot() { if (spot) { spot.remove(); spot = null; } }
function removeEmphasis(el) {
  $$(':scope > .hz-fx-hl, :scope > .hz-fx-ul', el).forEach(n => n.remove());
  el.classList.remove('hz-fx-color');
  const c = circleOf.get(el); if (c) { c.remove(); circleOf.delete(el); }
}

/* 퇴장 */
const EXIT = {
  'fade-out': [{ opacity: 1 }, { opacity: 0 }],
  'scale-out': [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }],
  'slide-out-left': [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-340px)' }],
  'slide-out-right': [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(340px)' }],
  'drop-out': [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(240px) rotate(10deg)' }]
};
function exitEl(el, name = el.dataset.exit, instant = false) {
  const st = strength();
  const still = instant || st === 'off';
  if (name === 'strike') {
    ensureHost(el);
    const rects = lineRects(el);
    rects.forEach((r, i) => {
      const th = Math.max(4, r.h * 0.07);
      const s = h('span', { class: 'hz-fx-strike', 'data-hz-runtime': '' });
      Object.assign(s.style, { left: r.x - 4 + 'px', top: r.y + r.h * 0.52 - th / 2 + 'px', width: r.w + 8 + 'px', height: th + 'px' });
      el.appendChild(s);
      if (!still) anim(s, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: T(420), delay: i * T(180), easing: EASE_IO, fill: 'backwards' });
    });
    if (still) el.classList.add('hz-struck');
    else later(T(420) + rects.length * T(180), () => el.classList.add('hz-struck'));
    return T(800);
  }
  if (still) { el.classList.add('hz-gone'); return 0; }
  const k = st === 'calm' ? EXIT['fade-out'] : (EXIT[name] || EXIT['fade-out']);
  const d = T(st === 'calm' ? 320 : 520);
  const a = anim(el, k, { duration: d, easing: name === 'drop-out' ? 'cubic-bezier(.5,0,.75,0)' : EASE, fill: 'forwards' });
  if (a) a.finished.then(() => { el.classList.add('hz-gone'); a.cancel(); }, () => {});
  else el.classList.add('hz-gone');
  return d;
}

/* ------------------------------------------------------------------ */
/* 슬라이드 전환                                                       */
/* ------------------------------------------------------------------ */
function boxesOf(slide) { return [...slide.children].filter(c => !c.classList.contains('notes') && !c.hasAttribute('data-hz-runtime') && c.tagName !== 'TEMPLATE' && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE'); }
function transit(from, to, type, dir, onDone) {
  return new Promise(res => {
    let finished = false;
    const resolve = () => { if (finished) return; finished = true; running.delete(tracker); if (onDone) onDone(); res(); };
    const tracker = { finish: () => end(), cancel: () => end() };
    const st = strength();
    const t = st === 'off' ? 'none' : (st === 'calm' && type !== 'none') ? 'fade' : (LIB.transition.includes(type) ? type : 'fade');
    to.classList.add('hz-active', 'hz-top');
    if (!from || from === to || t === 'none') {
      if (from && from !== to) from.classList.remove('hz-active');
      to.classList.remove('hz-top');
      resolve(); return;
    }
    from.classList.remove('hz-active'); from.classList.add('hz-leaving');
    const d = T({ flip: 820, circle: 820, wipe: 760, morph: 820, cover: 700, push: 680 }[t] || 600) * (st === 'calm' ? 0.6 : 1);
    const A = [];
    const go = (el, k, o = {}) => { const a = anim(el, k, Object.assign({ duration: d, easing: EASE, fill: 'both' }, o)); if (a) A.push(a); };
    const fwd = dir > 0;
    switch (t) {
      case 'fade':
        go(to, [{ opacity: 0 }, { opacity: 1 }]); go(from, [{ opacity: 1 }, { opacity: 0 }]); break;
      case 'slide':
        go(to, [{ opacity: 0, transform: `translateX(${dir * 10}%)` }, { opacity: 1, transform: 'none' }]);
        go(from, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 10}%)` }]); break;
      case 'push':
        go(to, [{ transform: `translateX(${dir * 100}%)` }, { transform: 'none' }], { easing: EASE_IO });
        go(from, [{ transform: 'none' }, { transform: `translateX(${-dir * 100}%)` }], { easing: EASE_IO }); break;
      case 'cover':
        if (fwd) {
          go(to, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { easing: EASE_IO });
          go(from, [{ transform: 'none', filter: 'brightness(1)' }, { transform: 'scale(.92)', filter: 'brightness(.45)' }], { easing: EASE_IO });
        } else {
          to.classList.remove('hz-top'); from.classList.add('hz-top');
          go(from, [{ transform: 'none' }, { transform: 'translateY(100%)' }], { easing: EASE_IO });
          go(to, [{ transform: 'scale(.92)', filter: 'brightness(.45)' }, { transform: 'none', filter: 'brightness(1)' }], { easing: EASE_IO });
        }
        break;
      case 'zoom':
        go(to, [{ opacity: 0, transform: `scale(${fwd ? .6 : 1.4})` }, { opacity: 1, transform: 'none' }]);
        go(from, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `scale(${fwd ? 1.4 : .6})` }]); break;
      case 'flip':
        go(from, [{ transform: 'perspective(2600px) rotateY(0deg)' }, { transform: `perspective(2600px) rotateY(${-dir * 90}deg)` }], { duration: d / 2, easing: 'cubic-bezier(.5,0,1,1)' });
        go(to, [{ transform: `perspective(2600px) rotateY(${dir * 90}deg)` }, { transform: 'perspective(2600px) rotateY(0deg)' }], { duration: d / 2, delay: d / 2, easing: 'cubic-bezier(0,0,.5,1)' }); break;
      case 'wipe':
        go(to, [{ clipPath: fwd ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0)' }], { easing: EASE_IO }); break;
      case 'circle':
        go(to, [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], { easing: EASE_IO }); break;
      case 'morph': {
        const matched = new Set();
        $$('[data-morph]', to).forEach(n => {
          const o = from.querySelector(`[data-morph="${CSS.escape(n.dataset.morph)}"]`);
          if (!o) return;
          const r1 = stageRect(o), r2 = stageRect(n), c1 = getComputedStyle(o), c2 = getComputedStyle(n);
          const sx = r1.w / Math.max(1, r2.w), sy = r1.h / Math.max(1, r2.h);
          n.classList.remove('hz-pre'); n.__hzMorphed = true;
          go(n, [
            { transformOrigin: '0 0', transform: `translate(${r1.x - r2.x}px, ${r1.y - r2.y}px) scale(${sx}, ${sy})`, color: c1.color, backgroundColor: c1.backgroundColor, borderRadius: c1.borderRadius, opacity: c1.opacity },
            { transformOrigin: '0 0', transform: 'none', color: c2.color, backgroundColor: c2.backgroundColor, borderRadius: c2.borderRadius, opacity: c2.opacity }
          ], { easing: EASE_IO });
          matched.add(n);
        });
        boxesOf(to).forEach(b => { if (![...matched].some(m => b === m || b.contains(m))) go(b, [{ opacity: 0 }, { opacity: 1 }], { duration: d * 0.5, delay: d * 0.5 }); });
        go(to, [{ opacity: 0 }, { opacity: 1 }], { duration: d * 0.25 });
        break;
      }
    }
    function end() {
      if (finished) return;
      from.classList.remove('hz-leaving', 'hz-top'); to.classList.remove('hz-top');
      A.forEach(a => { try { a.cancel(); } catch (e) { /* 무시 */ } });
      resolve();
    }
    running.add(tracker);
    Promise.all(A.map(a => a.finished.catch(() => {}))).then(end);
  });
}

/* ------------------------------------------------------------------ */
/* 배경 움직임                                                         */
/* ------------------------------------------------------------------ */
const ambStops = new Map();
function ambLayer(slide) { const l = h('div', { class: 'hz-amb', 'data-hz-runtime': '' }); slide.prepend(l); anim(l, [{ opacity: 0 }, { opacity: 1 }], { duration: 1000, easing: 'ease-out' }); return l; }
const AMB_SLIDE = {
  drift(slide, rich) {
    const l = ambLayer(slide);
    for (let i = 0; i < (rich ? 8 : 5); i++) {
      const s = rand(260, 540);
      const b = h('div', { class: 'hz-blob' });
      Object.assign(b.style, { width: s + 'px', height: s + 'px', left: rand(-8, 88) + '%', top: rand(-12, 78) + '%', opacity: rand(.16, rich ? .4 : .28) });
      l.appendChild(b);
      anim(b, [{ translate: '0 0' }, { translate: `${rand(-260, 260)}px ${rand(-160, 160)}px` }], { duration: rand(12000, 22000), iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    }
  },
  gradient(slide, rich) {
    const l = ambLayer(slide);
    const g = h('div', { class: 'hz-amb-grad', style: `opacity:${rich ? 1 : .8}` });
    l.appendChild(g);
    anim(g, [{ transform: 'translate(0,0) rotate(0deg)' }, { transform: 'translate(-10%, 7%) rotate(28deg)' }], { duration: 17000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  },
  particles(slide, rich) {
    const l = ambLayer(slide);
    const c = h('canvas', { width: 960, height: 540 });
    l.appendChild(c);
    const ctx = c.getContext('2d');
    const cols = [accent(), (getComputedStyle(slide).color || '#fff')];
    const ps = Array.from({ length: rich ? 90 : 50 }, () => ({ x: rand(0, 960), y: rand(0, 540), r: rand(.8, 2.6), vy: rand(.12, .45), ph: rand(0, 6.28), c: cols[Math.random() < .55 ? 0 : 1], a: rand(.2, .55) }));
    let raf = 0;
    const frame = t => {
      ctx.clearRect(0, 0, 960, 540);
      ps.forEach(p => {
        p.y -= p.vy; if (p.y < -6) { p.y = 546; p.x = rand(0, 960); }
        ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.beginPath();
        ctx.arc(p.x + Math.sin(t / 1600 + p.ph) * 8, p.y, p.r, 0, 6.283); ctx.fill();
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }
};
const AMB_EL = {
  float(el) { anim(el, [{ translate: '0 0' }, { translate: '0 -18px' }, { translate: '0 0' }], { duration: 4200, iterations: Infinity, easing: 'ease-in-out' }); },
  sparkle(el, slide, rich) {
    const iv = setInterval(() => {
      if (!el.isConnected) return;
      const r = stageRect(el);
      const s = h('span', { class: 'hz-sparkle', 'data-hz-runtime': '' }, '✦');
      Object.assign(s.style, { left: r.x + rand(-20, r.w) + 'px', top: r.y + rand(-20, r.h) + 'px', fontSize: rand(22, 44) + 'px' });
      slide.appendChild(s);
      const a = anim(s, [{ opacity: 0, transform: 'scale(0) rotate(0deg)' }, { opacity: 1, transform: 'scale(1) rotate(90deg)', offset: .4 }, { opacity: 0, transform: 'scale(0) rotate(180deg)' }], { duration: 1000, easing: 'ease-in-out' });
      if (a) a.finished.then(() => s.remove(), () => s.remove()); else s.remove();
    }, rich ? 520 : 950);
    return () => clearInterval(iv);
  }
};
function startAmbient(slide) {
  stopAmbient(slide);
  const st = strength();
  if (st === 'off' || st === 'calm') return;
  const rich = st === 'rich', fns = [];
  const nm = slide.dataset.ambient;
  if (nm && AMB_SLIDE[nm]) fns.push(AMB_SLIDE[nm](slide, rich));
  $$('[data-ambient]', slide).forEach(el => { const f = AMB_EL[el.dataset.ambient]; if (f) fns.push(f(el, slide, rich)); });
  ambStops.set(slide, fns.filter(f => typeof f === 'function'));
}
function stopAmbient(slide) {
  (ambStops.get(slide) || []).forEach(f => { try { f(); } catch (e) { /* 무시 */ } });
  ambStops.delete(slide);
  $$(':scope > .hz-amb', slide).forEach(n => n.remove());
  $$('[data-ambient]', slide).forEach(el => el.getAnimations().forEach(a => { if (!isCssAnim(a)) a.cancel(); }));
}

/* ------------------------------------------------------------------ */
/* 상호작용                                                            */
/* ------------------------------------------------------------------ */
const HINT = { flip: '눌러서 뒤집기', quiz: '골라 보세요', zoom: '눌러서 크게 보기' };
function armInteractions(slide) {
  $$('[data-interact]', slide).forEach(el => {
    const t = el.dataset.interact;
    el.classList.remove('hz-flipped');
    if (t === 'quiz') $$('[data-option]', el).forEach(o => o.classList.remove('hz-correct', 'hz-wrong'));
    if (t === 'reveal') { ensureHost(el); el.appendChild(h('div', { class: 'hz-cover', 'data-hz-runtime': '' }, el.dataset.coverText || '클릭해서 확인')); }
    if (HINT[t] && el.tagName !== 'IMG' && strength() !== 'off') { ensureHost(el); el.appendChild(h('span', { class: 'hz-hint', 'data-hz-runtime': '' }, HINT[t])); }
  });
}
const dropHint = el => $$(':scope > .hz-hint', el).forEach(n => n.remove());
let zoomed = null;
function handleInteract(target) {
  if (!(target instanceof Element)) return false;
  const sp = target.closest('[data-spot]');
  if (sp) { toggleTip(sp); return true; }
  const opt = target.closest('[data-option]');
  const quiz = opt && opt.closest('[data-interact="quiz"]');
  if (quiz) { answer(quiz, opt); return true; }
  const cover = target.closest('.hz-cover');
  if (cover) { uncover(cover); return true; }
  if (zoomed) { toggleZoom(zoomed); return true; }
  const it = target.closest('[data-interact]');
  if (it) {
    const t = it.dataset.interact;
    if (t === 'flip') { it.classList.toggle('hz-flipped'); dropHint(it); }
    else if (t === 'zoom') toggleZoom(it);
    else if (t === 'hotspot') hideTips();
    return true;
  }
  return !!target.closest('a[href],button,input,select,textarea,label,video,audio,summary');
}
function answer(quiz, opt) {
  dropHint(quiz);
  if (opt.hasAttribute('data-correct')) {
    opt.classList.remove('hz-wrong'); opt.classList.add('hz-correct');
    if (strength() !== 'off') anim(opt, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: T(500), easing: EASE_BACK, composite: 'add' });
    const r = opt.getBoundingClientRect();
    celebrate('confetti', false, { x: r.left + r.width / 2, y: r.top + r.height / 2, small: true });
  } else {
    opt.classList.add('hz-wrong');
    if (strength() !== 'off') anim(opt, EMPH.shake.k, { duration: T(520), easing: 'ease-in-out', composite: 'add' });
  }
}
function uncover(cover) {
  const host = cover.parentElement;
  const done = () => cover.remove();
  if (strength() === 'off') return done();
  const a = anim(cover, [{ clipPath: 'inset(0 0 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 100% 0)', opacity: .6 }], { duration: T(520), easing: EASE_IO, fill: 'forwards' });
  if (a) a.finished.then(done, done); else done();
  if (host) later(T(560), () => { if (host.dataset.emphasis && host.dataset.emphasisStep == null) emphasize(host); });
}
function toggleZoom(el) {
  const slide = el.closest('.slide');
  if (zoomed === el) {
    const bd = $(':scope > .hz-backdrop', slide);
    const fin = () => { el.getAnimations().forEach(a => { if (!isCssAnim(a)) a.cancel(); }); el.classList.remove('hz-zoomed'); if (bd) bd.remove(); };
    zoomed = null;
    const cur = el.getAnimations().find(a => !isCssAnim(a));
    if (cur && strength() !== 'off') { cur.reverse(); cur.finished.then(fin, fin); if (bd) anim(bd, [{ opacity: 1 }, { opacity: 0 }], { duration: T(350), fill: 'forwards' }); }
    else fin();
    return;
  }
  if (zoomed) toggleZoom(zoomed);
  dropHint(el);
  const r = stageRect(el);
  const k = clamp(Math.min(1640 / r.w, 920 / r.h), 1, 4);
  const dx = W / 2 - (r.x + r.w / 2), dy = H / 2 - (r.y + r.h / 2);
  ensureHost(el); el.classList.add('hz-zoomed');
  const bd = h('div', { class: 'hz-backdrop', 'data-hz-runtime': '' });
  slide.appendChild(bd);
  zoomed = el;
  const dur = strength() === 'off' ? 1 : T(480);
  anim(bd, [{ opacity: 0 }, { opacity: 1 }], { duration: dur, fill: 'forwards' });
  const cs = getComputedStyle(el).transformOrigin;
  el.animate([{ transformOrigin: cs, transform: 'none' }, { transformOrigin: '50% 50%', transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: dur, easing: EASE, fill: 'forwards' });
}
function closeZoom() { if (zoomed) { const el = zoomed; zoomed = null; el.getAnimations().forEach(a => { if (!isCssAnim(a)) a.cancel(); }); el.classList.remove('hz-zoomed'); $$('.hz-backdrop').forEach(b => b.remove()); } }
function toggleTip(sp) {
  const open = sp.nextElementSibling && sp.nextElementSibling.classList.contains('hz-tip');
  hideTips();
  if (open) return;
  const tip = h('div', { class: 'hz-tip', 'data-hz-runtime': '' }, sp.dataset.tip || '');
  const left = sp.offsetLeft + 30, top = sp.offsetTop - 20;
  Object.assign(tip.style, { left: left + 'px', top: top + 'px' });
  sp.after(tip);
  const host = sp.parentElement;
  if (host && left + tip.offsetWidth > host.clientWidth) tip.style.left = Math.max(0, sp.offsetLeft - 30 - tip.offsetWidth) + 'px';
  if (strength() !== 'off') anim(tip, [{ opacity: 0, transform: 'translateY(8px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: T(260), easing: EASE });
}
function hideTips() { $$('#deck .hz-tip').forEach(t => t.remove()); }

/* ------------------------------------------------------------------ */
/* 보상: 색종이·별                                                     */
/* ------------------------------------------------------------------ */
const cctx = confettiC.getContext('2d');
let parts = [], confRaf = 0;
function celebrate(name = 'confetti', manual = false, at = null) {
  const st = strength();
  if (st === 'off' || st === 'calm') { if (manual) toast('모션 강도가 ‘끄기’나 ‘차분’이라 축하 효과가 꺼져 있어요'); return; }
  const rich = st === 'rich';
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (confettiC.width !== Math.round(innerWidth * dpr)) { confettiC.width = Math.round(innerWidth * dpr); confettiC.height = Math.round(innerHeight * dpr); }
  const cols = [accent(), accent2(), '#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#af52de', '#ff9500'];
  const vw = innerWidth, vh = innerHeight, sp = vh / 900;
  const add = p => parts.push(Object.assign({ rot: rand(0, 6.28), vr: rand(-.25, .25), born: performance.now(), life: rand(2400, 3600), c: cols[(Math.random() * cols.length) | 0], s: rand(7, 14) * sp }, p));
  if (name === 'stars') {
    const x = at ? at.x : vw / 2, y = at ? at.y : vh / 2;
    for (let i = 0; i < (rich ? 40 : 26); i++) { const a = rand(0, 6.28), v = rand(4, 11) * sp; add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, shape: 'star', g: .08 * sp, drag: .95, s: rand(12, 24) * sp, c: [accent2(), '#ffd34d', '#fff'][i % 3] }); }
  } else if (at && at.small) {
    for (let i = 0; i < (rich ? 90 : 55); i++) { const a = rand(-Math.PI, 0), v = rand(5, 13) * sp; add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3 * sp, shape: Math.random() < .5 ? 'rect' : 'circle', g: .32 * sp, drag: .975 }); }
  } else {
    const n = rich ? 300 : 170;
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      const a = (left ? -60 : -120) * Math.PI / 180 + rand(-.32, .32), v = rand(15, 27) * sp;
      add({ x: left ? -10 : vw + 10, y: vh + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, shape: Math.random() < .6 ? 'rect' : 'circle', g: .36 * sp, drag: .983 });
    }
  }
  if (!confRaf) confRaf = requestAnimationFrame(confFrame);
}
function starPath(c, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * .45 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }
function confFrame(now) {
  const dpr = confettiC.width / innerWidth;
  cctx.setTransform(1, 0, 0, 1, 0, 0); cctx.clearRect(0, 0, confettiC.width, confettiC.height);
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  parts = parts.filter(p => now - p.born < p.life && p.y < innerHeight + 60);
  parts.forEach(p => {
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    const age = (now - p.born) / p.life;
    cctx.globalAlpha = age > .75 ? (1 - age) / .25 : 1;
    cctx.fillStyle = p.c; cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.rot);
    if (p.shape === 'rect') cctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * (0.6 + 0.4 * Math.abs(Math.sin(p.rot * 3))));
    else if (p.shape === 'star') { starPath(cctx, p.s / 2); cctx.fill(); }
    else { cctx.beginPath(); cctx.arc(0, 0, p.s / 3, 0, 6.283); cctx.fill(); }
    cctx.restore();
  });
  if (parts.length) confRaf = requestAnimationFrame(confFrame);
  else { confRaf = 0; cctx.setTransform(1, 0, 0, 1, 0, 0); cctx.clearRect(0, 0, confettiC.width, confettiC.height); }
}

/* ------------------------------------------------------------------ */
/* 슬라이드 상태·단계                                                  */
/* ------------------------------------------------------------------ */
let slides = [], cur = 0, stepIdx = 0, steps = [], navToken = 0;
let editing = false, boardMode = false, tool = 'hand';
const PERSIST = ['highlight', 'underline', 'circle', 'color-shift'];

function scan() { slides = $$(':scope > section.slide', deck); ensureIds(); }
function ensureIds() {
  const seen = new Set();
  slides.forEach((s, i) => {
    let id = s.dataset.id;
    if (!id || seen.has(id)) {
      const base = id || 'auto-' + (i + 1);
      let cand = base, k = 2;
      while (seen.has(cand) || (cand !== id && slides.some(o => o !== s && o.dataset.id === cand))) cand = base + '-' + (k++);
      s.dataset.id = cand;
    }
    seen.add(s.dataset.id);
  });
}
const newId = () => { let id; do { id = 's-' + Math.random().toString(36).slice(2, 8); } while (deck.querySelector(`[data-id="${id}"]`)); return id; };
const hasStep = el => el.dataset.step != null && el.dataset.step !== '';
const isEntrance = el => el.dataset.anim != null || hasStep(el);
const staggerChildAuto = el => { const p = el.parentElement; return !!p && p.dataset.anim === 'stagger' && !hasStep(el); };
const stepVal = v => (v == null || v === '' ? NaN : parseFloat(v));
function motionEls(slide) {
  return $$('[data-anim],[data-step],[data-emphasis],[data-exit]', slide).filter(el => !el.closest('template,.notes,[data-hz-runtime]'));
}
function stepsOf(slide) {
  const set = new Set();
  motionEls(slide).forEach(el => [el.dataset.step, el.dataset.emphasisStep, el.dataset.exitStep].forEach(v => { const n = stepVal(v); if (!isNaN(n)) set.add(n); }));
  return [...set].sort((a, b) => a - b);
}
const visible = () => slides.filter(s => editing || !s.hasAttribute('data-hidden'));
function nextIndex(d) {
  for (let i = cur + d; i >= 0 && i < slides.length; i += d) if (editing || !slides[i].hasAttribute('data-hidden')) return i;
  return cur;
}

function setInitial(slide) {
  motionEls(slide).forEach(el => {
    if (el.dataset.anim === 'stagger') [...el.children].forEach(c => { if (!hasStep(c) && !c.hasAttribute('data-hz-runtime')) c.classList.add('hz-pre'); });
    else if (isEntrance(el) && !staggerChildAuto(el)) el.classList.add('hz-pre');
  });
}
function finalPre(slide) {
  motionEls(slide).forEach(el => {
    el.classList.remove('hz-pre');
    if (el.dataset.exit && !isNaN(stepVal(el.dataset.exitStep)) && el.dataset.exit !== 'strike') el.classList.add('hz-gone');
  });
}
function finalPost(slide) {
  motionEls(slide).forEach(el => {
    if (el.dataset.exit === 'strike' && !isNaN(stepVal(el.dataset.exitStep))) exitEl(el, 'strike', true);
    if (PERSIST.includes(el.dataset.emphasis)) emphasize(el, el.dataset.emphasis, true);
  });
}
function playAuto(slide) {
  let end = 0;
  motionEls(slide).forEach(el => {
    if (el.__hzMorphed) {
      delete el.__hzMorphed; el.classList.remove('hz-pre');
      if (el.dataset.emphasis && el.dataset.emphasisStep == null) later(300, () => emphasize(el));
      return;
    }
    if (isEntrance(el)) { if (!hasStep(el) && !staggerChildAuto(el)) end = Math.max(end, enter(el)); }
    else if (el.dataset.emphasis && el.dataset.emphasisStep == null && !entranceAncestor(el)) {
      const d = T(num(el.dataset.delay)) + 300;
      later(d, () => emphasize(el)); end = Math.max(end, d + 900);
    }
  });
  return end;
}
function doStep(slide, s) {
  let end = 0;
  motionEls(slide).forEach(el => {
    if (stepVal(el.dataset.step) === s && isEntrance(el)) end = Math.max(end, enter(el));
    if (stepVal(el.dataset.emphasisStep) === s) end = Math.max(end, emphasize(el));
    if (stepVal(el.dataset.exitStep) === s) end = Math.max(end, exitEl(el));
  });
  return end;
}
function revertStep(slide, s) {
  motionEls(slide).forEach(el => {
    if (stepVal(el.dataset.exitStep) === s) {
      el.getAnimations().forEach(a => { if (!isCssAnim(a)) a.cancel(); });
      el.classList.remove('hz-gone', 'hz-struck');
      $$(':scope > .hz-fx-strike', el).forEach(n => n.remove());
    }
    if (stepVal(el.dataset.emphasisStep) === s) { removeEmphasis(el); clearSpot(); }
    if (stepVal(el.dataset.step) === s && isEntrance(el)) {
      el.getAnimations({ subtree: true }).forEach(a => { if (!isCssAnim(a)) a.cancel(); });
      [...tweens].forEach(t => { if (el.contains(t.el)) t.cancel(); });
      $$('[data-hz-runtime]', el).forEach(n => { if (!n.matches('.hz-cover,.hz-hint')) n.remove(); });
      unwrapIn(el); restoreCounts(el); removeEmphasis(el); $$('[data-emphasis]', el).forEach(removeEmphasis);
      if (el.dataset.anim === 'stagger') [...el.children].forEach(c => { if (!hasStep(c) && !c.hasAttribute('data-hz-runtime')) c.classList.add('hz-pre'); });
      else el.classList.add('hz-pre');
    }
  });
}
function cleanupSlide(slide) {
  if (!slide) return;
  stopAmbient(slide);
  cleanEl(slide);
}

/* ------------------------------------------------------------------ */
/* 이동                                                                */
/* ------------------------------------------------------------------ */
function go(n, o = {}) {
  if (!slides.length) return;
  n = clamp(n, 0, slides.length - 1);
  const from = slides[cur], to = slides[n];
  const same = from === to;
  if (same && !o.force) return;
  const dir = o.dir || (n >= cur ? 1 : -1);
  finishAll(); clearSpot(); closeZoom(); hideTips(); fxLayer.innerHTML = '';
  if (boardMode) setBoard(false);
  const token = ++navToken;
  cleanupSlide(to);
  cur = n; steps = stepsOf(to); stepIdx = 0;
  if (editing) {
    slides.forEach(s => { if (s !== to) { s.classList.remove('hz-active', 'hz-leaving', 'hz-top'); cleanupSlide(s); } });
    to.classList.add('hz-active');
    afterNav(); return;
  }
  const forward = dir > 0 && !o.final;
  if (forward) setInitial(to); else { finalPre(to); stepIdx = steps.length; }
  armInteractions(to);
  startAmbient(to);
  const type = o.instant ? 'none' : (dir > 0 ? (to.dataset.transition || deck.dataset.transition || 'fade') : ((from && from.dataset.transition) || deck.dataset.transition || 'fade'));
  transit(same ? null : from, to, type, dir, () => {
    if (from && !same && from !== slides[cur]) cleanupSlide(from);
    if (token !== navToken) return;
    if (forward) {
      const end = playAuto(to);
      if (to.dataset.celebrate) later(end + 250, () => celebrate(to.dataset.celebrate), false);
    } else finalPost(to);
  });
  afterNav();
}
function afterNav() {
  updateChrome(); renderInk(); updateHash(); syncThumbs(); renderPresenter();
  if (editing) { selectEls([]); }
}
function next() {
  if (modalOpen()) return;
  if (boardMode) return boardNav(1);
  if (editing) return go(nextIndex(1), { instant: true });
  finishAll(); clearSpot(); closeZoom(); hideTips();
  if (stepIdx < steps.length) { doStep(slides[cur], steps[stepIdx++]); updateChrome(); return; }
  const n = nextIndex(1);
  if (n !== cur) go(n, { dir: 1 });
}
function prev() {
  if (modalOpen()) return;
  if (boardMode) return boardNav(-1);
  if (editing) return go(nextIndex(-1), { instant: true });
  finishAll(); clearSpot(); closeZoom(); hideTips();
  if (stepIdx > 0) { revertStep(slides[cur], steps[--stepIdx]); updateChrome(); return; }
  const n = nextIndex(-1);
  if (n !== cur) go(n, { dir: -1 });
}
function goVisible(k) { const v = visible(); const s = v[clamp(k, 1, v.length) - 1]; if (s) go(slides.indexOf(s)); }
function replay() {
  if (editing) return previewSlide();
  go(cur, { force: true, dir: 1, instant: true });
}
function updateHash() {
  const hsh = '#' + (cur + 1);
  if (location.hash !== hsh) { try { history.replaceState(null, '', hsh); } catch (e) { /* file:// 등 */ } }
}

/* ------------------------------------------------------------------ */
/* 필기                                                                */
/* ------------------------------------------------------------------ */
let ink = store.get('ink', {}); if (!ink || typeof ink !== 'object') ink = {};
let boards = store.get('boards', null); if (!Array.isArray(boards) || !boards.length) boards = ['b1'];
let boardIdx = 0, inkR = 0;
const inkUndo = [], inkRedo = [];
const surf = () => (boardMode ? boards[boardIdx] : (slides[cur] && slides[cur].dataset.id));
const strokesOf = id => ink[id] || [];
let inkWarned = false;
const saveInk = debounce(() => {
  for (const k in ink) if (!ink[k] || !ink[k].length) delete ink[k];
  if (!store.set('ink', ink) && !inkWarned) { inkWarned = true; toast('브라우저 저장 공간이 부족해 필기를 저장하지 못했어요'); }
}, 500);
function sizeCanvases() {
  const r = clamp(scale * (devicePixelRatio || 1), 0.5, 2);
  if (Math.abs(r - inkR) < 0.01) return;
  inkR = r;
  [inkC, liveC, laserC].forEach(c => { c.width = Math.round(W * r); c.height = Math.round(H * r); });
  renderInk();
}
function renderInk() {
  if (!inkR) return;
  ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, inkC.width, inkC.height);
  if (editing) return;
  ictx.setTransform(inkR, 0, 0, inkR, 0, 0);
  strokesOf(surf()).forEach(s => drawStroke(ictx, s));
}
function drawStroke(c, s) {
  const p = s.p;
  if (!p || !p.length) return;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = c.fillStyle = s.c;
  if (s.t === 'hl') {
    c.globalAlpha = 0.36; c.lineWidth = s.w; c.beginPath(); c.moveTo(p[0][0], p[0][1]);
    if (p.length === 1) c.lineTo(p[0][0] + 0.1, p[0][1]);
    for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    if (p.length > 1) c.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    c.stroke();
  } else {
    const wf = q => s.w * (0.35 + 1.3 * (q[2] == null ? 0.5 : q[2]));
    if (p.length === 1) { c.beginPath(); c.arc(p[0][0], p[0][1], wf(p[0]) / 2, 0, 6.283); c.fill(); }
    else {
      const mid = i => [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2];
      let a = p[0];
      for (let i = 1; i < p.length; i++) {
        c.lineWidth = wf(p[i]); c.beginPath(); c.moveTo(a[0], a[1]);
        if (i < p.length - 1) { const m = mid(i); c.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]); a = m; }
        else c.lineTo(p[i][0], p[i][1]);
        c.stroke();
      }
    }
  }
  c.restore();
}
function clearLive() { lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, liveC.width, liveC.height); }
function inkPush(change) { inkUndo.push(change); if (inkUndo.length > 200) inkUndo.shift(); inkRedo.length = 0; }
function inkApply(change, idx) { for (const id in change) ink[id] = change[id][idx].slice(); renderInk(); saveInk(); }
function inkUndoAct() { const c = inkUndo.pop(); if (!c) return toast('되돌릴 필기가 없어요'); inkApply(c, 0); inkRedo.push(c); }
function inkRedoAct() { const c = inkRedo.pop(); if (!c) return toast('다시 할 필기가 없어요'); inkApply(c, 1); inkUndo.push(c); }
function clearSurface() {
  const id = surf(), before = strokesOf(id);
  if (!before.length) return toast('이 장에는 지울 필기가 없어요');
  ink[id] = []; inkPush({ [id]: [before, []] }); renderInk(); saveInk(); toast('이 장의 필기를 지웠어요 · 되돌리기 가능');
}
async function clearAllInk() {
  const ids = Object.keys(ink).filter(k => ink[k] && ink[k].length);
  if (!ids.length) return toast('지울 필기가 없어요');
  const ok = await ask('모든 슬라이드와 칠판의 필기를 지울까요?', '지운 뒤에도 되돌리기(Ctrl+Z)로 복구할 수 있어요.', '전체 지우기', true);
  if (!ok) return;
  const change = {};
  ids.forEach(id => { change[id] = [ink[id], []]; ink[id] = []; });
  inkPush(change); renderInk(); saveInk(); toast('모든 필기를 지웠어요 · 되돌리기 가능');
}

let drawing = null, pdown = false, erBefore = null, lastEr = null;
const pres = e => (e.pointerType === 'pen' ? clamp(e.pressure || 0.5, 0.05, 1) : 0.5);
function drawLive() { clearLive(); if (!drawing) return; lctx.setTransform(inkR, 0, 0, inkR, 0, 0); drawStroke(lctx, drawing); }
function drawEraserRing(p) {
  clearLive(); lctx.setTransform(inkR, 0, 0, inkR, 0, 0);
  const R = ERASERS[S.eraserSize] / 2, lw = 2 / scale;
  lctx.lineWidth = lw; lctx.strokeStyle = 'rgba(0,0,0,.55)'; lctx.beginPath(); lctx.arc(p.x, p.y, R + lw, 0, 6.283); lctx.stroke();
  lctx.strokeStyle = 'rgba(255,255,255,.95)'; lctx.beginPath(); lctx.arc(p.x, p.y, R, 0, 6.283); lctx.stroke();
  if (S.eraserMode === 'part') { lctx.fillStyle = 'rgba(255,255,255,.18)'; lctx.fill(); }
}
function segDist(q, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((q.x - a[0]) * dx + (q.y - a[1]) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(q.x - (a[0] + t * dx), q.y - (a[1] + t * dy));
}
function densify(P, step) {
  if (P.length < 2) return P;
  const out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
    for (let k = 1; k < n; k++) { const t = k / n; out.push([round1(a[0] + (b[0] - a[0]) * t), round1(a[1] + (b[1] - a[1]) * t), (a[2] + b[2]) / 2]); }
    out.push(b);
  }
  return out;
}
function eraseLine(a, b) {
  const id = surf(), R = ERASERS[S.eraserSize] / 2;
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (R / 2)));
  const pts = []; for (let i = 0; i <= n; i++) pts.push({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n });
  const list = strokesOf(id);
  let changed = false;
  const out = [];
  list.forEach(s => {
    if (S.eraserMode !== 'part') {
      const rr = R + s.w / 2, P = s.p;
      const hit = pts.some(q => P.length === 1 ? Math.hypot(P[0][0] - q.x, P[0][1] - q.y) <= rr : P.some((pt, i) => i > 0 && segDist(q, P[i - 1], pt) <= rr));
      if (hit) changed = true; else out.push(s);
    } else {
      const rr = R + s.w * 0.3;
      const P = densify(s.p, Math.max(2, R / 3));
      const keep = P.map(pt => !pts.some(q => Math.hypot(pt[0] - q.x, pt[1] - q.y) <= rr));
      if (keep.every(Boolean)) { out.push(s); return; }
      changed = true;
      let run = [];
      P.forEach((pt, i) => { if (keep[i]) run.push(pt); else { if (run.length > 1) out.push(Object.assign({}, s, { p: run })); run = []; } });
      if (run.length > 1) out.push(Object.assign({}, s, { p: run }));
    }
  });
  if (changed) { ink[id] = out; renderInk(); }
}

/* 레이저 */
let laserPts = [], laserHead = null, laserLast = 0, laserRaf = 0;
function laserMove(p) {
  const now = performance.now();
  laserPts.push({ x: p.x, y: p.y, t: now }); laserHead = p; laserLast = now;
  if (!laserRaf) laserRaf = requestAnimationFrame(laserFrame);
}
function laserFrame(now) {
  const life = 380;
  laserPts = laserPts.filter(q => now - q.t < life);
  zctx.setTransform(1, 0, 0, 1, 0, 0); zctx.clearRect(0, 0, laserC.width, laserC.height);
  zctx.setTransform(inkR, 0, 0, inkR, 0, 0); zctx.lineCap = 'round'; zctx.lineJoin = 'round';
  for (let i = 1; i < laserPts.length; i++) {
    const a = laserPts[i - 1], b = laserPts[i], k = 1 - (now - b.t) / life;
    zctx.strokeStyle = `rgba(255,40,40,${(k * 0.75).toFixed(3)})`; zctx.lineWidth = 3 + 9 * k;
    zctx.beginPath(); zctx.moveTo(a.x, a.y); zctx.lineTo(b.x, b.y); zctx.stroke();
  }
  const idle = now - laserLast, show = laserHead && tool === 'laser' && idle < 2600;
  if (show) {
    zctx.globalAlpha = idle > 2000 ? 1 - (idle - 2000) / 600 : 1;
    zctx.shadowColor = 'rgba(255,30,30,.9)'; zctx.shadowBlur = 26; zctx.fillStyle = '#ff2a2a';
    zctx.beginPath(); zctx.arc(laserHead.x, laserHead.y, 11, 0, 6.283); zctx.fill();
    zctx.shadowBlur = 0; zctx.fillStyle = 'rgba(255,255,255,.9)';
    zctx.beginPath(); zctx.arc(laserHead.x, laserHead.y, 4, 0, 6.283); zctx.fill(); zctx.globalAlpha = 1;
  }
  if (laserPts.length || show) laserRaf = requestAnimationFrame(laserFrame);
  else { laserRaf = 0; zctx.setTransform(1, 0, 0, 1, 0, 0); zctx.clearRect(0, 0, laserC.width, laserC.height); }
}

input.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (edgeTap(e)) return;
  e.preventDefault();
  try { input.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  pdown = true;
  const p = toStage(e);
  if (tool === 'pen' || tool === 'hl') {
    drawing = { t: tool, c: COLORS[S.color], w: tool === 'hl' ? WIDTHS[S.width] * 3.4 : WIDTHS[S.width], p: [[round1(p.x), round1(p.y), pres(e)]] };
    drawLive();
  } else if (tool === 'eraser') { erBefore = strokesOf(surf()); lastEr = p; eraseLine(p, p); drawEraserRing(p); }
  else if (tool === 'laser') laserMove(p);
});
input.addEventListener('pointermove', e => {
  const p = toStage(e);
  if (tool === 'laser') { if (pdown || e.pointerType === 'mouse') laserMove(p); return; }
  if (tool === 'eraser') { drawEraserRing(p); if (pdown) { eraseLine(lastEr, p); lastEr = p; } return; }
  if (!drawing || !pdown) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (evs.length ? evs : [e])) {
    const q = toStage(ev), last = drawing.p[drawing.p.length - 1];
    if (Math.hypot(q.x - last[0], q.y - last[1]) < 1.6) continue;
    drawing.p.push([round1(q.x), round1(q.y), pres(ev)]);
  }
  drawLive();
});
function endDraw() {
  if (!pdown) return;
  pdown = false;
  const id = surf();
  if (drawing) {
    const before = strokesOf(id), after = before.concat([drawing]);
    ink[id] = after; inkPush({ [id]: [before, after] });
    drawing = null; clearLive(); renderInk(); saveInk();
  } else if (tool === 'eraser' && erBefore) {
    const after = strokesOf(id);
    if (after !== erBefore) { inkPush({ [id]: [erBefore, after] }); saveInk(); }
    erBefore = null;
  }
}
input.addEventListener('pointerup', endDraw);
input.addEventListener('pointercancel', endDraw);
input.addEventListener('pointerleave', () => { if (tool === 'eraser' && !pdown) clearLive(); });

const TOOL_NAME = { hand: '손', pen: '펜', hl: '형광펜', eraser: '지우개', laser: '레이저' };
function setTool(t) {
  if (editing && t !== 'hand') return;
  tool = t;
  root.classList.remove('hz-tool-hand', 'hz-tool-pen', 'hz-tool-hl', 'hz-tool-eraser', 'hz-tool-laser');
  root.classList.add('hz-tool-' + t);
  root.classList.toggle('hz-drawing', t !== 'hand');
  if (t !== 'eraser') clearLive();
  if (t !== 'laser') laserHead = null;
  updateChrome();
  if (root.classList.contains('hz-full')) toast(TOOL_NAME[t] + (t === 'eraser' ? ' · ' + (S.eraserMode === 'part' ? '부분 지우개' : '획 지우개') : ''), 1000);
}
function toggleEraserMode() {
  S.eraserMode = S.eraserMode === 'part' ? 'stroke' : 'part'; saveSettings();
  toast(S.eraserMode === 'part' ? '부분 지우개: 문지른 부분만 지워요' : '획 지우개: 닿은 선을 통째로 지워요');
  updateChrome();
}
function cycleColor() {
  S.color = (S.color + 1) % COLORS.length; saveSettings();
  if (tool === 'hand' || tool === 'laser' || tool === 'eraser') setTool('pen');
  toast('펜 색: ' + COLOR_NAMES[S.color], 900);
  updateChrome(); renderColorPop();
}

/* ------------------------------------------------------------------ */
/* 칠판                                                                */
/* ------------------------------------------------------------------ */
function setBoard(on) {
  if (editing || on === boardMode) return;
  boardMode = on;
  root.classList.toggle('hz-boarding', on);
  if (on) { finishAll(); clearSpot(); closeZoom(); if (tool === 'hand') setTool('pen'); }
  renderBoardBar(); updateChrome(); renderInk();
}
function boardNav(d) { boardIdx = clamp(boardIdx + d, 0, boards.length - 1); renderBoardBar(); renderInk(); }
function addBoard() { boards.push('b' + Date.now().toString(36)); boardIdx = boards.length - 1; store.set('boards', boards); renderBoardBar(); renderInk(); toast('새 칠판을 추가했어요'); }
function mbtn(ic, label, fn, title) {
  const b = h('button', { class: 'hz-mini-btn', type: 'button', title: title || label || '' });
  b.innerHTML = icon(ic) + (label ? `<span>${label}</span>` : '');
  b.addEventListener('click', e => { e.stopPropagation(); fn(e); });
  return b;
}
function renderBoardBar() {
  boardBar.innerHTML = '';
  boardBar.append(h('span', {}, `칠판 ${boardIdx + 1} / ${boards.length}`),
    mbtn('prev', '', () => boardNav(-1), '이전 칠판'), mbtn('next', '', () => boardNav(1), '다음 칠판'),
    mbtn('plus', '새 칠판', addBoard), mbtn('slides', '슬라이드로', () => setBoard(false)));
}

/* ------------------------------------------------------------------ */
/* 타이머                                                              */
/* ------------------------------------------------------------------ */
const TM = { mode: 'up', run: false, acc: 0, t0: 0, iv: 0, shown: false, warned: false };
const tmNow = () => TM.acc + (TM.run ? Date.now() - TM.t0 : 0);
const fmtMs = ms => { const s = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function tmText() {
  if (TM.mode === 'up') return fmtMs(tmNow());
  const left = S.timerMin * 60000 - tmNow();
  if (left <= 0 && TM.run && !TM.warned) { TM.warned = true; toast('시간이 다 됐어요', 2500); }
  return fmtMs(left);
}
function renderTimer() {
  timerEl.classList.toggle('hz-show', TM.shown);
  timerEl.classList.toggle('hz-timeup', TM.mode === 'down' && S.timerMin * 60000 - tmNow() <= 0);
  const b = $('b', timerEl); if (b) b.textContent = tmText();
  const pc = $('.hz-pclock', presenterCol); if (pc) pc.textContent = tmText();
}
function buildTimer() {
  timerEl.innerHTML = '';
  timerEl.append(h('small', {}, TM.mode === 'up' ? '경과' : '남은 시간'), h('b', {}, tmText()),
    mbtn(TM.run ? 'pause' : 'play', '', tmToggle, TM.run ? '일시정지' : '시작'),
    mbtn('reset', '', tmReset, '초기화'),
    mbtn('swap', '', () => { TM.mode = TM.mode === 'up' ? 'down' : 'up'; tmReset(); }, '경과 ↔ 카운트다운'),
    mbtn('x', '', () => { TM.shown = false; renderTimer(); updateChrome(); }, '닫기'));
  renderTimer();
}
function tmToggle() {
  if (TM.run) { TM.acc = tmNow(); TM.run = false; clearInterval(TM.iv); }
  else { TM.t0 = Date.now(); TM.run = true; TM.iv = setInterval(renderTimer, 250); }
  buildTimer();
}
function tmReset() { TM.acc = 0; TM.t0 = Date.now(); TM.warned = false; buildTimer(); }
function toggleTimer() {
  TM.shown = !TM.shown;
  if (TM.shown && !TM.run && TM.acc === 0) tmToggle(); else buildTimer();
  updateChrome();
}

/* ------------------------------------------------------------------ */
/* 전체 화면                                                           */
/* ------------------------------------------------------------------ */
let realFS = false, revealT = 0, touchRevealT = 0, cursorT = 0, moveT = 0, suppressClick = false;
const fsEl = () => doc.fullscreenElement || doc.webkitFullscreenElement;
async function toggleFull(force) {
  const on = typeof force === 'boolean' ? force : !root.classList.contains('hz-full');
  closePops();
  if (on) {
    root.classList.add('hz-full');
    root.classList.toggle('hz-nopage', !S.pageInFull);
    try {
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (req && !fsEl()) { await req.call(root); realFS = true; }
    } catch (e) { realFS = false; }
    toast('전체 화면 · 화면 가장자리에 마우스를 대면 필통과 메뉴가 나와요', 2400);
  } else {
    root.classList.remove('hz-full', 'hz-reveal', 'hz-nocursor');
    if (fsEl()) { try { await (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc); } catch (e) { /* 무시 */ } }
    realFS = false;
  }
  layout(); updateChrome(); pokeCursor();
}
function onFsChange() {
  if (!fsEl() && realFS) { realFS = false; root.classList.remove('hz-full', 'hz-reveal', 'hz-nocursor'); updateChrome(); }
  setTimeout(layout, 60);
}
doc.addEventListener('fullscreenchange', onFsChange);
doc.addEventListener('webkitfullscreenchange', onFsChange);
function pokeCursor() {
  root.classList.remove('hz-nocursor'); clearTimeout(cursorT);
  if (root.classList.contains('hz-full')) cursorT = setTimeout(() => root.classList.add('hz-nocursor'), 2000);
}
/* 마우스를 움직이면 넘김 화살표가 잠깐 보인다 */
function pokeMove() {
  root.classList.add('hz-moving'); clearTimeout(moveT);
  moveT = setTimeout(() => root.classList.remove('hz-moving'), 2000);
}
const CHROME_SEL = '.hz-case,.hz-case-mini,.hz-menu-btn,.hz-drawer,.hz-pop,.hz-boardbar';
function nearEdge(x, y, d) { return x <= d || y <= d || x >= innerWidth - d || y >= innerHeight - d; }
function reveal(on) {
  if (!on && drawerOpen()) return; // 서랍을 연 동안은 그대로 둔다
  root.classList.toggle('hz-reveal', on);
  if (!on) closePops();
}
window.addEventListener('mousemove', e => {
  pokeCursor(); pokeMove();
  if (!root.classList.contains('hz-full') || pdown) return;
  const over = e.target instanceof Element && e.target.closest(CHROME_SEL);
  if (nearEdge(e.clientX, e.clientY, 16) || (over && root.classList.contains('hz-reveal'))) {
    reveal(true); clearTimeout(revealT); revealT = 0;
  } else if (root.classList.contains('hz-reveal') && !revealT) {
    revealT = setTimeout(() => { revealT = 0; reveal(false); }, 1000);
  }
}, { passive: true });
function edgeTap(e) {
  if (!root.classList.contains('hz-full') || e.pointerType === 'mouse') return false;
  if (!nearEdge(e.clientX, e.clientY, 40)) return false;
  e.preventDefault(); e.stopPropagation();
  suppressClick = true; reveal(true);
  clearTimeout(touchRevealT); touchRevealT = setTimeout(() => reveal(false), 3000);
  return true;
}
window.addEventListener('pointerdown', e => {
  if (!root.classList.contains('hz-full')) return;
  if (e.target instanceof Element && e.target.closest(CHROME_SEL)) {
    if (e.pointerType !== 'mouse') { clearTimeout(touchRevealT); touchRevealT = setTimeout(() => reveal(false), 3000); }
    return;
  }
  if (e.target === input) return; // 필기 입력은 input에서 따로 처리
  edgeTap(e);
}, true);

/* ------------------------------------------------------------------ */
/* 팝오버                                                              */
/* ------------------------------------------------------------------ */
function closePops() { [colorPop, emojiPop].forEach(p => p.classList.remove('hz-show')); }
function placePop(pop, anchor) {
  pop.classList.add('hz-show');
  const a = anchor.getBoundingClientRect(), r = pop.getBoundingClientRect();
  let x, y;
  if (anchor.closest('.hz-case') && S.caseVertical) {
    // 세로 필통: 공간이 넓은 쪽 옆에
    x = a.right + 12 + r.width < innerWidth ? a.right + 12 : a.left - r.width - 12;
    y = a.top + a.height / 2 - r.height / 2;
  } else {
    // 위쪽에 자리가 있으면 위, 없으면 아래
    x = a.left + a.width / 2 - r.width / 2;
    y = a.top - r.height - 12 >= 8 ? a.top - r.height - 12 : a.bottom + 12;
  }
  pop.style.left = clamp(x, 8, innerWidth - r.width - 8) + 'px';
  pop.style.top = clamp(y, 8, innerHeight - r.height - 8) + 'px';
}
function renderColorPop() {
  colorPop.innerHTML = '';
  const row1 = h('div', { class: 'hz-row' });
  COLORS.forEach((c, i) => row1.appendChild(h('button', {
    class: 'hz-sw' + (i === S.color ? ' hz-sel' : ''), type: 'button', title: COLOR_NAMES[i], style: `background:${c}`,
    onclick: () => { S.color = i; saveSettings(); if (tool !== 'pen' && tool !== 'hl') setTool('pen'); renderColorPop(); updateChrome(); }
  })));
  const row2 = h('div', { class: 'hz-row' });
  WIDTHS.forEach((w, i) => { const b = h('button', { class: 'hz-wd' + (i === S.width ? ' hz-sel' : ''), type: 'button', title: ['가늘게', '보통', '굵게'][i], onclick: () => { S.width = i; saveSettings(); renderColorPop(); } }); b.appendChild(h('i', { style: `height:${w / 2 + 1}px` })); row2.appendChild(b); });
  const row3 = h('div', { class: 'hz-row' });
  ERASERS.forEach((w, i) => { const b = h('button', { class: 'hz-wd' + (i === S.eraserSize ? ' hz-sel' : ''), type: 'button', title: ['작게', '보통', '크게'][i], onclick: () => { S.eraserSize = i; saveSettings(); renderColorPop(); } }); b.appendChild(h('i', { style: `height:${6 + i * 6}px;width:${6 + i * 6}px;border-radius:50%` })); row3.appendChild(b); });
  const seg = h('div', { class: 'hz-seg' },
    h('button', { type: 'button', class: S.eraserMode !== 'part' ? 'hz-sel' : '', onclick: () => { S.eraserMode = 'stroke'; saveSettings(); renderColorPop(); } }, '획 지우개'),
    h('button', { type: 'button', class: S.eraserMode === 'part' ? 'hz-sel' : '', onclick: () => { S.eraserMode = 'part'; saveSettings(); renderColorPop(); } }, '부분 지우개'));
  colorPop.append(h('h4', {}, '펜 색'), row1, h('h4', {}, '굵기'), row2, h('h4', {}, '지우개 크기'), row3, h('h4', {}, '지우개 방식'), seg);
}

/* ------------------------------------------------------------------ */
/* 모달                                                                */
/* ------------------------------------------------------------------ */
let modalClose = null;
const modalOpen = () => modalWrap.classList.contains('hz-show');
function openModal(title, body, actions) {
  closeModal(); closePops();
  const m = h('div', { class: 'hz-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  m.append(h('h2', {}, title), ...[].concat(body));
  if (actions) m.append(h('div', { class: 'hz-modal-actions' }, actions));
  modalWrap.innerHTML = ''; modalWrap.appendChild(m); modalWrap.classList.add('hz-show');
  return new Promise(res => { modalClose = v => { modalWrap.classList.remove('hz-show'); modalWrap.innerHTML = ''; modalClose = null; res(v); }; });
}
function closeModal(v) { if (modalClose) modalClose(v); }
modalWrap.addEventListener('pointerdown', e => { if (e.target === modalWrap) closeModal(false); });
function ask(title, msg, okLabel = '확인', danger = false, cancelLabel = '취소') {
  const p = openModal(title, [h('p', {}, msg)], [
    h('button', { class: 'hz-b', type: 'button', onclick: () => closeModal(false) }, cancelLabel),
    h('button', { class: 'hz-b ' + (danger ? 'hz-danger' : 'hz-primary'), type: 'button', onclick: () => closeModal(true) }, okLabel)]);
  setTimeout(() => { const b = $('.hz-modal .hz-primary, .hz-modal .hz-danger', modalWrap); if (b) b.focus(); }, 30);
  return p;
}
function openToc() {
  const ul = h('ul', { class: 'hz-list' });
  slides.forEach((s, i) => {
    const hid = s.hasAttribute('data-hidden');
    ul.appendChild(h('li', { class: (i === cur ? 'hz-cur ' : '') + (hid ? 'hz-hid' : ''), onclick: () => { closeModal(); go(i, { dir: i >= cur ? 1 : -1 }); } },
      h('span', { class: 'hz-n' }, String(i + 1).padStart(2, '0')), h('span', {}, (s.dataset.title || '(제목 없음)') + (hid ? ' · 숨김' : ''))));
  });
  openModal('목차', [ul]);
  setTimeout(() => { const c = $('.hz-cur', ul); if (c) c.scrollIntoView({ block: 'center' }); }, 20);
}
function openHelp() {
  const rows = (list) => h('table', {}, list.map(([k, v]) => h('tr', {}, h('td', { html: k }), h('td', {}, v))));
  const K = s => s.split(' ').map(x => `<kbd>${x}</kbd>`).join(' ');
  openModal('단축키', [
    h('h3', {}, '화면'),
    rows([['메뉴 버튼 (왼쪽 위)', '모든 기능 · 슬라이드 목록 · 설정'], ['필통 손잡이', '끌어서 옮기기 · 두 번 누르면 가로/세로'], ['필통 끝 버튼', '필통 접기 (동그란 버튼을 누르면 펼침)'], ['화면 양옆 화살표', '이전 / 다음 (마우스를 움직이면 보여요)']]),
    h('h3', {}, '발표'),
    rows([[K('→ Space PageDown'), '다음 (단계 → 슬라이드)'], [K('← PageUp'), '이전'], [K('Home End'), '처음 / 끝'], ['숫자 + ' + K('Enter'), '번호로 이동'],
      [K('O'), '목차'], [K('F'), '전체 화면'], [K('B'), '슬라이드 ↔ 칠판'], [K('T'), '타이머'], [K('G'), '축하 효과'], [K('R'), '모션 다시 보기'], [K('?'), '이 도움말']]),
    h('h3', {}, '필기'),
    rows([[K('V') + ' 또는 ' + K('Esc'), '손'], [K('P'), '펜'], [K('H'), '형광펜'], [K('E'), '지우개 (한 번 더: 획 ↔ 부분)'], [K('L'), '레이저'], [K('C'), '펜 색 바꾸기'],
      [K('Ctrl+Z'), '되돌리기'], [K('Ctrl+Shift+Z'), '다시 하기'], [K('X'), '이 장 지우기'], [K('Shift+X'), '전체 지우기']]),
    h('h3', {}, '편집 (Shift+E로 켜고 끄기)'),
    rows([['클릭 / ' + K('Shift') + '+클릭 / 드래그', '선택 / 여러 개 선택'], ['더블클릭 또는 ' + K('Enter'), '글자 고치기'], [K('Ctrl') + '+클릭', '상자 안쪽 요소 선택'],
      [K('← ↑ → ↓'), '1px 이동 (Shift: 10px)'], [K('Tab'), '다음 요소'], [K('Ctrl+C') + ' ' + K('Ctrl+V') + ' ' + K('Ctrl+D'), '복사 / 붙여넣기 / 복제'], [K('Delete'), '삭제'],
      [K('Ctrl+]') + ' ' + K('Ctrl+['), '앞으로 / 뒤로 (Shift: 맨 앞·맨 뒤)'], [K('Alt+↑') + ' ' + K('Alt+↓'), '슬라이드 순서 옮기기'], [K('R'), '이 슬라이드 모션 미리보기'],
      [K('Ctrl+Z') + ' ' + K('Ctrl+Shift+Z'), '편집 되돌리기 / 다시 하기'], [K('Ctrl+S'), '저장'], [K('Esc'), '선택 해제 → 편집 끝']])
  ], [h('button', { class: 'hz-b hz-primary', type: 'button', onclick: () => closeModal() }, '닫기')]);
}
function segRow(label, sub, options, value, onPick) {
  const seg = h('div', { class: 'hz-seg' });
  options.forEach(([v, t]) => seg.appendChild(h('button', { type: 'button', class: v === value ? 'hz-sel' : '', onclick: () => { onPick(v); openSettings(); } }, t)));
  return h('div', { class: 'hz-setting' }, h('div', {}, label, sub ? h('small', {}, sub) : null), seg);
}
function openSettings() {
  const rows = [
    segRow('모션 강도', '끄기: 바로 최종 상태 · 차분: 짧은 페이드만 · 화려: 배경·축하 효과 크게', [['off', '끄기'], ['calm', '차분'], ['default', '기본'], ['rich', '화려']], S.strength,
      v => { S.strength = v; saveSettings(); applyStrength(); go(cur, { force: true, final: true, instant: true }); }),
    segRow('모션 속도', '', [[1.4, '느리게'], [1, '보통'], [0.7, '빠르게']], S.speed, v => { S.speed = v; saveSettings(); }),
    segRow('필통 방향', '손잡이를 두 번 눌러도 바뀌어요', [[false, '가로'], [true, '세로']], !!S.caseVertical, v => { S.caseVertical = v; saveSettings(); applyCase(); }),
    h('div', { class: 'hz-setting' }, h('div', {}, '필통 위치', h('small', {}, '손잡이를 끌어 옮길 수 있어요')),
      h('button', { class: 'hz-b', type: 'button', onclick: () => { S.caseAt = null; S.caseFolded = false; saveSettings(); applyCase(); toast('필통을 처음 위치로 옮겼어요'); } }, '처음 위치로')),
    segRow('넘김 화살표', '마우스를 움직이면 화면 양옆에 나와요', [[true, '보이기'], [false, '숨기기']], S.navArrows !== false, v => { S.navArrows = v; saveSettings(); applyNav(); }),
    segRow('전체 화면 페이지 꼬리표', '', [[true, '보이기'], [false, '숨기기']], S.pageInFull, v => { S.pageInFull = v; saveSettings(); root.classList.toggle('hz-nopage', !v); }),
    segRow('카운트다운 기본 시간', '', [[5, '5분'], [10, '10분'], [15, '15분'], [30, '30분'], [50, '50분']], S.timerMin, v => { S.timerMin = v; saveSettings(); renderTimer(); })
  ];
  if (THEMES.length > 1) rows.splice(1, 0, segRow('테마', '덱 디자인이 제공하는 테마', [[null, '기본']].concat(THEMES.map(t => [t, { dark: '다크', light: '라이트' }[t] || t])), S.theme, v => { S.theme = v; saveSettings(); applyTheme(); }));
  openModal('설정', rows, [
    h('button', { class: 'hz-b', type: 'button', onclick: () => { closeModal(); openHelp(); } }, '단축키 보기'),
    h('span', { style: 'flex:1;align-self:center;color:var(--hz-sub);font-size:12px' }, 'HTMLzip 엔진 v' + VERSION),
    h('button', { class: 'hz-b hz-primary', type: 'button', onclick: () => closeModal() }, '닫기')]);
}
function applyStrength() { ['off', 'calm', 'default', 'rich'].forEach(s => root.classList.toggle('hz-m-' + s, S.strength === s)); }
function applyTheme() { if (S.theme) root.setAttribute('data-theme', S.theme); else if (ORIG_THEME == null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', ORIG_THEME); }
function applyNav() { root.classList.toggle('hz-nonav', S.navArrows === false); }

/* ------------------------------------------------------------------ */
/* 썸네일 패널                                                         */
/* ------------------------------------------------------------------ */
const thumbsList = h('div', { class: 'hz-thumbs-list' });
const thumbsTools = h('div', { class: 'hz-thumbs-tools' });
drSlides.append(thumbsTools, thumbsList);
const thumbsOpen = () => drawerOpen() && drawerTab === 'slides';
function miniOf(slide) {
  const mini = h('div', { class: 'hz-mini' });
  const c = slide.cloneNode(true);
  cleanTree(c); c.querySelectorAll('.notes').forEach(n => n.remove());
  mini.appendChild(c);
  return mini;
}
let dragFrom = -1;
function renderThumbs() {
  if (!thumbsOpen()) return;
  thumbsList.innerHTML = '';
  slides.forEach((s, i) => {
    const t = h('div', { class: 'hz-thumb' + (i === cur ? ' hz-cur' : '') + (s.hasAttribute('data-hidden') ? ' hz-hid' : ''), 'data-i': i, draggable: editing ? 'true' : null });
    t.append(h('div', { class: 'hz-thumb-frame' }, miniOf(s)), h('div', { class: 'hz-thumb-label' }, `${i + 1}. ${s.dataset.title || '(제목 없음)'}`));
    t.addEventListener('click', () => { go(i, { dir: i >= cur ? 1 : -1, instant: editing }); if (!editing) closeDrawer(); });
    if (editing) {
      t.addEventListener('dragstart', e => { dragFrom = i; t.classList.add('hz-dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (err) { /* 무시 */ } });
      t.addEventListener('dragend', () => { dragFrom = -1; $$('.hz-thumb', thumbsList).forEach(x => x.classList.remove('hz-dragging', 'hz-drop-before', 'hz-drop-after')); });
      t.addEventListener('dragover', e => {
        if (dragFrom < 0) return;
        e.preventDefault();
        const r = t.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
        $$('.hz-thumb', thumbsList).forEach(x => x.classList.remove('hz-drop-before', 'hz-drop-after'));
        t.classList.add(before ? 'hz-drop-before' : 'hz-drop-after');
      });
      t.addEventListener('drop', e => {
        e.preventDefault();
        if (dragFrom < 0) return;
        const r = t.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
        moveSlideTo(dragFrom, i, before);
      });
    }
    thumbsList.appendChild(t);
  });
  const c = $('.hz-cur', thumbsList); if (c) c.scrollIntoView({ block: 'nearest' });
}
function syncThumbs() {
  if (!thumbsOpen()) return;
  $$('.hz-thumb', thumbsList).forEach(t => t.classList.toggle('hz-cur', +t.dataset.i === cur));
  const c = $('.hz-cur', thumbsList); if (c) c.scrollIntoView({ block: 'nearest' });
}
const refreshThumbs = debounce(renderThumbs, 350);

/* ------------------------------------------------------------------ */
/* 발표자 보기                                                         */
/* ------------------------------------------------------------------ */
function toggleView() {
  S.view = S.view === 'presenter' ? 'basic' : 'presenter'; saveSettings();
  root.classList.toggle('hz-presenter', S.view === 'presenter');
  layout(); renderPresenter(); updateChrome();
  toast(S.view === 'presenter' ? '발표자 보기: 다음 슬라이드·노트·타이머' : '기본 보기');
}
function renderPresenter() {
  if (S.view !== 'presenter') return;
  presenterCol.innerHTML = '';
  const ni = nextIndex(1), nextSlide = ni !== cur ? slides[ni] : null;
  const box = h('div', { class: 'hz-pnext' });
  if (nextSlide) {
    const mini = miniOf(nextSlide);
    box.appendChild(mini);
    requestAnimationFrame(() => { mini.style.transform = `scale(${box.clientWidth / W})`; });
  } else box.appendChild(h('div', { style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--hz-sub)' }, '마지막 슬라이드'));
  const notes = $(':scope > .notes', slides[cur]);
  presenterCol.append(
    h('div', { class: 'hz-pcard' }, h('h4', {}, '다음 슬라이드' + (nextSlide ? ` · ${ni + 1}. ${nextSlide.dataset.title || ''}` : '')), box),
    h('div', { class: 'hz-pcard', style: 'flex:1;min-height:120px' }, h('h4', {}, '발표자 노트'), h('div', { class: 'hz-pnotes' }, notes ? notes.textContent.trim() : '노트가 없어요.')),
    h('div', { class: 'hz-pcard' }, h('h4', {}, '타이머 (T)'), h('div', { class: 'hz-pclock' }, tmText())));
}

/* ------------------------------------------------------------------ */
/* 툴바 상태                                                           */
/* ------------------------------------------------------------------ */
let checkCount = 0;
const TOOL_ICON = { hand: 'hand', pen: 'pen', hl: 'hl', eraser: 'eraser', laser: 'laser' };
function updateChrome() {
  const v = visible(), vi = Math.max(0, v.indexOf(slides[cur]));
  pageTxt.textContent = boardMode ? `칠판 ${boardIdx + 1} / ${boards.length}` : (editing ? `${cur + 1} / ${slides.length}` : `${vi + 1} / ${v.length}`);
  pageLine.style.width = (boardMode ? 100 : v.length > 1 ? ((vi + 1) / v.length) * 100 : 100) + '%';
  const full = root.classList.contains('hz-full');
  $$('[data-cmd]', ui).forEach(b => {
    const c = b.dataset.cmd;
    const on = c === tool || (c === 'board' && boardMode) || (c === 'view' && S.view === 'presenter') ||
      (c === 'timer' && TM.shown) || (c === 'full' && full) || (c === 'edit' && editing);
    b.classList.toggle('hz-pressed', on);
  });
  $$('[data-cmd="eraser"]', ui).forEach(b => { b.title = '지우개 (E) · ' + (S.eraserMode === 'part' ? '부분 지우개' : '획 지우개') + ' · 한 번 더 누르면 방식 바꾸기'; });
  $$('[data-cmd="full"] .hz-lbl', ui).forEach(l => { l.textContent = full ? '전체 화면 끝' : '전체 화면'; });
  $$('.hz-swatch', ui).forEach(sw => { sw.style.background = COLORS[S.color]; });
  caseMini.innerHTML = icon(TOOL_ICON[tool] || 'pen');
  $$('[data-cmd="check"]', ui).forEach(b => {
    b.classList.toggle('hz-warn', checkCount > 0);
    const l = $('.hz-lbl', b); if (l) l.textContent = checkCount > 0 ? `점검 ${checkCount}` : '점검';
  });
  menuBtn.classList.toggle('hz-has-issue', checkCount > 0);
  menuBtn.title = checkCount > 0 ? `메뉴 · 점검할 문제 ${checkCount}개` : '메뉴 (도구·슬라이드·설정)';
}

/* ------------------------------------------------------------------ */
/* 정리·저장 (편집용 표시와 런타임 상태를 빼고 깨끗한 HTML로)          */
/* ------------------------------------------------------------------ */
function cleanTree(r) {
  $$('[data-hz-runtime]', r).forEach(n => n.remove());
  unwrapIn(r); restoreCounts(r);
  [r, ...$$('*', r)].forEach(el => {
    if (!el.getAttribute) return;
    if (el.classList && el.classList.length) {
      [...el.classList].forEach(c => { if (c.startsWith('hz-') && !(el.tagName === 'TEMPLATE' && c === 'hz-layout')) el.classList.remove(c); });
      if (!el.classList.length) el.removeAttribute('class');
    }
    if (el.hasAttribute('contenteditable')) el.removeAttribute('contenteditable');
    [...el.attributes].forEach(a => { if (a.name.startsWith('data-hz-')) el.removeAttribute(a.name); });
  });
  return r;
}
function cleanDeckHTML() { return cleanTree(deck.cloneNode(true)).innerHTML; }
function serialize() {
  const clone = root.cloneNode(true);
  $$('#hz-ui, #hz-runtime-style', clone).forEach(n => n.remove());
  cleanTree(clone);
  if (ORIG_THEME == null) clone.removeAttribute('data-theme'); else clone.setAttribute('data-theme', ORIG_THEME);
  if (clone.getAttribute('style') === '') clone.removeAttribute('style');
  return '<!DOCTYPE html>\n' + clone.outerHTML + '\n';
}
let fileHandle = null, dirty = false, draftWarned = false;
async function save() {
  if (editingText) stopTextEdit();
  const html = serialize();
  const name = decodeURIComponent(location.pathname.split('/').pop() || '') || 'deck.html';
  if (window.showSaveFilePicker) {
    try {
      if (!fileHandle) fileHandle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'HTML 슬라이드', accept: { 'text/html': ['.html'] } }] });
      const w = await fileHandle.createWritable(); await w.write(html); await w.close();
      savedOk('파일에 저장했어요'); return;
    } catch (e) { if (e && e.name === 'AbortError') return; fileHandle = null; }
  }
  const a = h('a', { href: URL.createObjectURL(new Blob([html], { type: 'text/html' })), download: name });
  doc.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  savedOk(`수정본을 다운로드했어요 (${name})`);
}
function savedOk(msg) { dirty = false; store.del('draft'); toast(msg, 2400); }
const saveDraft = debounce(() => {
  if (!dirty) return;
  if (!store.set('draft', { html: cleanDeckHTML(), at: Date.now() }) && !draftWarned) { draftWarned = true; toast('임시 저장 공간이 부족해요. Ctrl+S로 파일을 저장해 주세요', 3200); }
}, 800);

/* ------------------------------------------------------------------ */
/* 편집: 되돌리기 기반                                                 */
/* ------------------------------------------------------------------ */
let sel = [], innerSel = null, editingText = null, textBefore = null, liveBefore = null;
let clipboard = null, lastClipText = '', pasteHandled = false, previewing = false, previewToken = 0;
const undoStack = [], redoStack = [];
const snap = () => cleanDeckHTML();
function markDirty() { dirty = true; saveDraft(); refreshThumbs(); runCheckSoon(); }
function changed(before) {
  if (before == null) return false;
  if (snap() === before) return false;
  undoStack.push(before); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0;
  markDirty(); return true;
}
function commit(fn) { const before = snap(); fn(); changed(before); renderSelBoxes(); renderProps(); }
function restoreDeck(html) {
  const id = slides[cur] && slides[cur].dataset.id;
  finishAll(); deck.innerHTML = html; scan();
  let n = slides.findIndex(s => s.dataset.id === id);
  if (n < 0) n = clamp(cur, 0, slides.length - 1);
  cur = n; steps = slides[cur] ? stepsOf(slides[cur]) : [];
  slides.forEach(s => s.classList.remove('hz-active'));
  if (editing) { if (slides[cur]) slides[cur].classList.add('hz-active'); selectEls([]); renderThumbs(); updateChrome(); renderInk(); }
  else go(cur, { force: true, final: true, instant: true });
  runCheckSoon();
}
function editUndo() { if (editingText) stopTextEdit(); const p = undoStack.pop(); if (p == null) return toast('되돌릴 편집이 없어요'); redoStack.push(snap()); restoreDeck(p); dirty = true; saveDraft(); }
function editRedo() { const p = redoStack.pop(); if (p == null) return toast('다시 할 편집이 없어요'); undoStack.push(snap()); restoreDeck(p); dirty = true; saveDraft(); }

/* ------------------------------------------------------------------ */
/* 편집: 선택                                                          */
/* ------------------------------------------------------------------ */
const isBox = el => !!el && !!el.parentElement && el.parentElement.classList.contains('slide') && el.parentElement.parentElement === deck &&
  !el.classList.contains('notes') && !el.hasAttribute('data-hz-runtime') && !/^(TEMPLATE|SCRIPT|STYLE)$/.test(el.tagName);
function boxOf(t) { let el = t instanceof Element ? t : t && t.parentElement; while (el && el !== deck) { if (isBox(el)) return el; el = el.parentElement; } return null; }
function boxRect(el) { return el instanceof HTMLElement ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : stageRect(el); }
function union(rs) {
  const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
  return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y };
}
function selectEls(list, inner = null) { sel = list.filter(Boolean); innerSel = inner; renderSelBoxes(); renderProps(); }
function selBox(r, inner) {
  const b = h('div', { class: 'hz-selbox' + (inner ? ' hz-inner' : '') });
  Object.assign(b.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  selLayer.appendChild(b); return b;
}
const HANDLES = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
function renderSelBoxes() {
  selLayer.innerHTML = '';
  if (!editing || previewing) return;
  if (innerSel && innerSel.isConnected) { selBox(stageRect(innerSel), true); }
  sel.forEach(el => {
    if (!el.isConnected) return;
    const b = selBox(boxRect(el), false);
    if (el.style.rotate) b.style.rotate = el.style.rotate;
    if (sel.length === 1 && !innerSel && !editingText) {
      for (const k in HANDLES) {
        const hd = h('div', { class: 'hz-h', 'data-h': k });
        hd.style.left = HANDLES[k][0] + '%'; hd.style.top = HANDLES[k][1] + '%';
        hd.addEventListener('pointerdown', e => startResize(e, el, k));
        b.appendChild(hd);
      }
      const line = h('div', { class: 'hz-rotline', style: 'top:calc(-30px * var(--hz-inv));height:calc(30px * var(--hz-inv))' });
      const rk = h('div', { class: 'hz-h', 'data-h': 'rot', style: 'left:50%;top:calc(-30px * var(--hz-inv))', title: '회전 (Shift: 15°씩)' });
      rk.addEventListener('pointerdown', e => startRotate(e, el));
      b.append(line, rk);
    }
  });
}
function drawGuides(gx, gy) {
  gx.forEach(x => { const g = h('div', { class: 'hz-guide hz-v' }); g.style.left = x + 'px'; selLayer.appendChild(g); });
  gy.forEach(y => { const g = h('div', { class: 'hz-guide hz-hz' }); g.style.top = y + 'px'; selLayer.appendChild(g); });
}
function snapMove(bb, dx, dy, others) {
  const th = 7 / scale, cx = [0, W / 2, W], cy = [0, H / 2, H];
  others.forEach(o => { cx.push(o.x, o.x + o.w / 2, o.x + o.w); cy.push(o.y, o.y + o.h / 2, o.y + o.h); });
  const best = (edges, cands) => {
    let b = null;
    edges.forEach(e => cands.forEach(c => { const d = c - e; if (Math.abs(d) < th && (!b || Math.abs(d) < Math.abs(b.d))) b = { d, at: c }; }));
    return b;
  };
  const bx = best([bb.x + dx, bb.x + bb.w / 2 + dx, bb.x + bb.w + dx], cx);
  const by = best([bb.y + dy, bb.y + bb.h / 2 + dy, bb.y + bb.h + dy], cy);
  return { dx: dx + (bx ? bx.d : 0), dy: dy + (by ? by.d : 0), gx: bx ? [bx.at] : [], gy: by ? [by.at] : [] };
}
function onDrag(move, up) {
  const mv = e => move(e);
  const u = e => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', u); window.removeEventListener('pointercancel', u); up(e); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', u); window.addEventListener('pointercancel', u);
}
function startDrag(e) {
  const items = sel.filter(isBox).map(el => ({ el, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }));
  if (!items.length) return;
  const start = toStage(e), before = snap(), bb0 = union(items);
  const others = boxesOf(slides[cur]).filter(b => !sel.includes(b)).map(boxRect);
  let moved = false;
  onDrag(ev => {
    const p = toStage(ev); let dx = p.x - start.x, dy = p.y - start.y;
    if (!moved && Math.hypot(dx, dy) * scale < 3) return;
    moved = true;
    const s = ev.altKey ? { dx, dy, gx: [], gy: [] } : snapMove(bb0, dx, dy, others);
    items.forEach(it => { it.el.style.left = Math.round(it.x + s.dx) + 'px'; it.el.style.top = Math.round(it.y + s.dy) + 'px'; });
    renderSelBoxes(); drawGuides(s.gx, s.gy);
  }, () => { renderSelBoxes(); if (moved) { changed(before); renderProps(); } });
}
function startResize(e, el, hd) {
  e.stopPropagation(); e.preventDefault();
  const before = snap(), s0 = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }, start = toStage(e);
  const ratio = s0.w / Math.max(1, s0.h), isImg = el.tagName === 'IMG', hadH = !!el.style.height;
  let moved = false;
  onDrag(ev => {
    const p = toStage(ev), dx = p.x - start.x, dy = p.y - start.y;
    moved = true;
    let { x, y, w, h: hh } = s0;
    if (hd.includes('e')) w = s0.w + dx;
    if (hd.includes('w')) { w = s0.w - dx; x = s0.x + dx; }
    if (hd.includes('s')) hh = s0.h + dy;
    if (hd.includes('n')) { hh = s0.h - dy; y = s0.y + dy; }
    w = Math.max(16, w); hh = Math.max(16, hh);
    if (ev.shiftKey || isImg) {
      if (hd === 'n' || hd === 's') w = hh * ratio; else hh = w / ratio;
      if (hd.includes('w')) x = s0.x + s0.w - w;
      if (hd.includes('n')) y = s0.y + s0.h - hh;
      if (hd === 'n' || hd === 's') x = s0.x + (s0.w - w) / 2;
    }
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; el.style.width = Math.round(w) + 'px';
    if ((!isImg && (hadH || hd.includes('n') || hd.includes('s') || ev.shiftKey)) || (isImg && hadH)) el.style.height = Math.round(hh) + 'px';
    renderSelBoxes();
  }, () => { if (moved) { changed(before); renderProps(); } });
}
function startRotate(e, el) {
  e.stopPropagation(); e.preventDefault();
  const before = snap(), r = boxRect(el), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  let moved = false;
  onDrag(ev => {
    const p = toStage(ev);
    let deg = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90;
    if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
    deg = ((deg % 360) + 360) % 360; if (deg > 180) deg -= 360;
    if (Math.abs(deg) < 1.5) deg = 0;
    el.style.rotate = deg ? deg.toFixed(1) + 'deg' : '';
    moved = true; renderSelBoxes();
  }, () => { if (moved) { changed(before); renderProps(); } });
}
function startMarquee(e, additive) {
  const start = toStage(e), base = additive ? sel.slice() : [];
  const m = h('div', { class: 'hz-marquee' });
  let R = null;
  onDrag(ev => {
    const p = toStage(ev);
    R = { x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
    if (R.w * scale < 4 && R.h * scale < 4) return;
    if (!m.isConnected) selLayer.appendChild(m);
    Object.assign(m.style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' });
  }, () => {
    m.remove();
    if (!R || (R.w * scale < 4 && R.h * scale < 4)) { if (!additive) selectEls([]); return; }
    const hits = boxesOf(slides[cur]).filter(b => { const r = boxRect(b); return r.x < R.x + R.w && r.x + r.w > R.x && r.y < R.y + R.h && r.y + r.h > R.y; });
    selectEls([...new Set(base.concat(hits))]);
  });
}
function selectInner(box, t) {
  const el = t instanceof Element ? t : t.parentElement;
  if (!el || el === box) { selectEls([box]); return; }
  let c = el; while (c.parentElement && c.parentElement !== box) c = c.parentElement;
  if (innerSel && innerSel !== el && innerSel.contains(el)) c = el;
  selectEls([box], c);
}
function editPointerDown(e) {
  if (e.button !== 0 || previewing) return;
  if (editingText) { if (editingText.contains(e.target)) return; stopTextEdit(); }
  const slide = slides[cur];
  if (!slide || !slide.contains(e.target)) return;
  const box = boxOf(e.target);
  e.preventDefault();
  if (!box) { startMarquee(e, e.shiftKey); return; }
  if (e.ctrlKey || e.metaKey) { selectInner(box, e.target); return; }
  if (e.shiftKey) { selectEls(sel.includes(box) ? sel.filter(x => x !== box) : sel.concat([box])); return; }
  if (!sel.includes(box) || innerSel) selectEls([box]);
  startDrag(e);
}
function cycleSel(d) {
  const bs = boxesOf(slides[cur]); if (!bs.length) return;
  const i = sel.length ? bs.indexOf(sel[0]) : -1;
  selectEls([bs[(i + d + bs.length) % bs.length]]);
}
let nudgeBefore = null, nudgeT = 0;
function nudge(dx, dy) {
  const els = sel.filter(isBox); if (!els.length) return;
  if (nudgeBefore == null) nudgeBefore = snap();
  els.forEach(el => { el.style.left = (el.offsetLeft + dx) + 'px'; el.style.top = (el.offsetTop + dy) + 'px'; });
  renderSelBoxes();
  clearTimeout(nudgeT);
  nudgeT = setTimeout(() => { changed(nudgeBefore); nudgeBefore = null; renderProps(); }, 600);
}

/* 글자 고치기 */
function startTextEdit(el, e) {
  if (!el || el.matches('img,svg,canvas,video') || (!el.textContent.trim() && el.querySelector('svg,img'))) return;
  stopTextEdit();
  textBefore = snap(); editingText = el;
  el.setAttribute('contenteditable', 'true');
  el.focus({ preventScroll: true });
  const s = getSelection(); s.removeAllRanges();
  let r = null;
  if (e && doc.caretRangeFromPoint) r = doc.caretRangeFromPoint(e.clientX, e.clientY);
  else if (e && doc.caretPositionFromPoint) { const cp = doc.caretPositionFromPoint(e.clientX, e.clientY); if (cp) { r = doc.createRange(); r.setStart(cp.offsetNode, cp.offset); } }
  if (!r || !el.contains(r.startContainer)) { r = doc.createRange(); r.selectNodeContents(el); if (e) r.collapse(false); }
  s.addRange(r);
  renderSelBoxes(); renderProps();
}
function stopTextEdit() {
  if (!editingText) return;
  const el = editingText; editingText = null;
  el.removeAttribute('contenteditable');
  try { getSelection().removeAllRanges(); } catch (err) { /* 무시 */ }
  changed(textBefore); textBefore = null;
  renderSelBoxes(); renderProps();
}

/* ------------------------------------------------------------------ */
/* 편집: 요소 추가·복사·순서·정렬                                      */
/* ------------------------------------------------------------------ */
const SHAPES = {
  text: '<div style="left:560px;top:480px;width:800px;font-size:48px">텍스트를 입력하세요</div>',
  rect: '<div style="left:810px;top:440px;width:300px;height:200px;background:var(--accent, #f26b3a);border-radius:20px"></div>',
  circle: '<div style="left:840px;top:420px;width:240px;height:240px;background:var(--accent, #f26b3a);border-radius:50%"></div>',
  arrow: '<div style="left:760px;top:500px;width:400px;height:80px;color:var(--accent, #f26b3a)"><svg viewBox="0 0 400 80" preserveAspectRatio="none" style="display:block;width:100%;height:100%;overflow:visible"><path d="M8 40H372" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="M334 10L390 40L334 70" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></div>',
  line: '<div style="left:760px;top:530px;width:400px;height:20px;color:var(--fg, #888)"><svg viewBox="0 0 400 20" preserveAspectRatio="none" style="display:block;width:100%;height:100%;overflow:visible"><path d="M4 10H396" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></div>'
};
function fromHTML(html) { const t = doc.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function insertBox(html, editText) {
  const el = fromHTML(html);
  commit(() => slides[cur].appendChild(el));
  selectEls([el]);
  if (editText) startTextEdit(el);
  return el;
}
const fileInput = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
ui.appendChild(fileInput);
function pickImage(cb) { fileInput.value = ''; fileInput.onchange = () => { const f = fileInput.files && fileInput.files[0]; if (f) cb(f); }; fileInput.click(); }
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function readImage(file) {
  const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
  if (/svg|gif/.test(file.type)) return url;
  const img = await loadImg(url);
  if (img.naturalWidth <= 1920 && file.size < 700 * 1024) return url;
  const k = Math.min(1, 1920 / img.naturalWidth);
  const c = doc.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
}
async function insertImageFile(file, at) {
  try {
    const url = await readImage(file), img = await loadImg(url);
    const w = Math.min(800, img.naturalWidth), hh = w * img.naturalHeight / img.naturalWidth;
    const el = h('img', { src: url, alt: (file.name || '이미지').replace(/\.[^.]+$/, '') });
    el.style.cssText = `left:${Math.round((at ? at.x : W / 2) - w / 2)}px;top:${Math.round((at ? at.y : H / 2) - hh / 2)}px;width:${Math.round(w)}px`;
    commit(() => slides[cur].appendChild(el));
    selectEls([el]); toast('이미지를 넣었어요');
  } catch (e) { toast('이미지를 읽지 못했어요'); }
}
function replaceImage(img) { pickImage(async f => { try { const url = await readImage(f); commit(() => { img.src = url; }); } catch (e) { toast('이미지를 읽지 못했어요'); } }); }
const EMOJIS = '✅ ❌ ⭐ 💡 🔥 🎯 📌 📝 📚 🧠 💻 🖥️ 📱 🧪 🔬 🌍 ☀️ 🌧️ ☁️ 💧 🌊 ❄️ 🌱 🚀 🎉 👍 👀 ❓ ❗ 🙌 😀 😮 🤔 😎 🏆 ⏰ 🔑 🧩 📈 💬'.split(' ');
/* 넣을 수 있는 선 아이콘 (24×24, 상자의 글자색을 따름) */
const LINE_ICONS = [
  ['체크', '<path d="M5 12.5l4.5 4.5L19 7.5"/>'],
  ['엑스', '<path d="M6 6l12 12M18 6L6 18"/>'],
  ['별', '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'],
  ['전구', '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'],
  ['과녁', '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'],
  ['위치', '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'],
  ['책', '<path d="M4 5.5C6.5 4 9.5 4 12 5.5v14c-2.5-1.5-5.5-1.5-8 0zM20 5.5C17.5 4 14.5 4 12 5.5v14c2.5-1.5 5.5-1.5 8 0z"/>'],
  ['연필', '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5zM13.5 7l3 3"/>'],
  ['노트북', '<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 19h19"/>'],
  ['휴대폰', '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>'],
  ['코드', '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>'],
  ['반짝', '<path d="M10 3l1.7 4.8L16.5 9.5l-4.8 1.7L10 16l-1.7-4.8L3.5 9.5l4.8-1.7zM18.5 14l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1z"/>'],
  ['지구', '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5z"/>'],
  ['해', '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'],
  ['구름', '<path d="M7.5 18h9.5a3.75 3.75 0 0 0 .4-7.48A5.5 5.5 0 0 0 6.9 9.2 4.4 4.4 0 0 0 7.5 18z"/>'],
  ['물방울', '<path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/>'],
  ['새싹', '<path d="M12 21v-8M12 13c0-4 3-7 8-7 0 5-3 8-8 7zM12 15c0-3-2.5-5.5-7-5.5 0 4 2.5 6 7 5.5z"/>'],
  ['깃발', '<path d="M5 21V4M5 4.5h11l-2 4 2 4H5"/>'],
  ['물음표', '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 16.8v.2"/>'],
  ['주의', '<path d="M12 4L2.8 19.5h18.4zM12 10v4.5M12 17.2v.2"/>'],
  ['시계', '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'],
  ['열쇠', '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>'],
  ['자물쇠', '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5v-3a3.5 3.5 0 0 1 7 0v3"/>'],
  ['그래프', '<path d="M4 20h16M7 20v-6M12 20V8M17 20v-9"/>'],
  ['말풍선', '<path d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4V16h0A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4z"/>'],
  ['하트', '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'],
  ['사람', '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'],
  ['모둠', '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M15.5 14.2a4.8 4.8 0 0 1 5 4.8"/>'],
  ['돋보기', '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'],
  ['사진', '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>'],
  ['트로피', '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9.5 17h5v3.5h-5z"/>'],
  ['화살표', '<path d="M4 12h15M13 6l6 6-6 6"/>']
];
const emojiOff = () => deck.dataset.emoji === 'off';
function openEmoji(anchor) {
  emojiPop.innerHTML = '';
  const ig = h('div', { class: 'hz-emoji-grid' });
  LINE_ICONS.forEach(([name, d]) => {
    const b = h('button', { type: 'button', title: name, 'aria-label': name, onclick: () => {
      closePops();
      insertBox(`<div style="left:870px;top:440px;width:180px;height:180px;color:var(--accent, #3b6cf6)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${name}" style="display:block;width:100%;height:100%;overflow:visible">${d}</svg></div>`);
    } });
    b.innerHTML = `<svg class="hz-i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
    ig.appendChild(b);
  });
  emojiPop.append(h('h4', {}, '선 아이콘 넣기'), ig);
  if (!emojiOff()) {
    const g = h('div', { class: 'hz-emoji-grid' });
    EMOJIS.forEach(em => g.appendChild(h('button', { type: 'button', onclick: () => { closePops(); insertBox(`<div style="left:880px;top:450px;width:180px;font-size:130px;line-height:1.1;text-align:center">${em}</div>`); } }, em)));
    emojiPop.append(h('h4', {}, '이모지 넣기'), g);
  }
  closePops(); placePop(emojiPop, anchor);
}
function openLayoutMenu(anchor) {
  const tpls = $$(':scope > template.hz-layout', deck);
  if (!tpls.length) { toast('이 덱에 등록된 레이아웃이 없어 빈 슬라이드를 넣어요'); addSlide(); return; }
  emojiPop.innerHTML = '';
  const ul = h('ul', { class: 'hz-list' });
  tpls.forEach(t => ul.appendChild(h('li', { onclick: () => { closePops(); addSlide(t.innerHTML); } }, t.dataset.name || '레이아웃')));
  emojiPop.append(h('h4', {}, '레이아웃으로 추가'), ul);
  closePops(); placePop(emojiPop, anchor);
}
function cloneClean(el) { return cleanTree(el.cloneNode(true)).outerHTML; }
function copySel() {
  const els = sel.filter(isBox); if (!els.length) return false;
  clipboard = els.map(cloneClean);
  lastClipText = els.map(el => el.textContent.trim()).join('\n') || '[HTMLzip 요소]';
  toast(`${els.length}개를 복사했어요`);
  return true;
}
function pasteHtmlList(list, offset = 30) {
  const els = [];
  commit(() => list.forEach(html => {
    const el = fromHTML(html); if (!el) return;
    if (el.style) { el.style.left = (num(el.style.left) + offset) + 'px'; el.style.top = (num(el.style.top) + offset) + 'px'; }
    slides[cur].appendChild(el); els.push(el);
  }));
  selectEls(els);
  return els;
}
function pasteSel() { if (!clipboard) return false; const els = pasteHtmlList(clipboard); clipboard = els.map(cloneClean); return true; }
function duplicateSel() { const els = sel.filter(isBox); if (els.length) pasteHtmlList(els.map(cloneClean)); }
function deleteSel() {
  if (innerSel) { const t = innerSel; commit(() => t.remove()); selectEls([]); return; }
  const els = sel.filter(isBox); if (!els.length) return;
  commit(() => els.forEach(el => el.remove())); selectEls([]);
}
function zorder(kind) {
  const els = sel.filter(isBox); if (!els.length) return;
  const s = slides[cur];
  commit(() => {
    const list = (kind === 'front' || kind === 'fwd') ? els.slice().reverse() : els.slice();
    (kind === 'back' ? list.slice().reverse() : list).forEach(el => {
      const bs = boxesOf(s), i = bs.indexOf(el);
      if (kind === 'front') s.appendChild(el);
      else if (kind === 'back') s.insertBefore(el, bs[0]);
      else if (kind === 'fwd' && bs[i + 1]) bs[i + 1].after(el);
      else if (kind === 'bwd' && bs[i - 1]) bs[i - 1].before(el);
    });
  });
}
function alignSel(kind) {
  const els = sel.filter(isBox); if (!els.length) return;
  const rs = els.map(el => Object.assign({ el }, boxRect(el)));
  const bb = els.length === 1 ? { x: 0, y: 0, w: W, h: H } : union(rs);
  commit(() => {
    if (kind === 'dh' || kind === 'dv') {
      if (rs.length < 3) return;
      const k = kind === 'dh' ? ['x', 'w', 'left'] : ['y', 'h', 'top'];
      rs.sort((a, b) => a[k[0]] - b[k[0]]);
      const total = rs.reduce((s, r) => s + r[k[1]], 0), gap = (bb[k[1]] - total) / (rs.length - 1);
      let pos = bb[k[0]];
      rs.forEach(r => { r.el.style[k[2]] = Math.round(pos) + 'px'; pos += r[k[1]] + gap; });
      return;
    }
    rs.forEach(r => {
      let x = r.x, y = r.y;
      if (kind === 'l') x = bb.x; else if (kind === 'c') x = bb.x + bb.w / 2 - r.w / 2; else if (kind === 'r') x = bb.x + bb.w - r.w;
      else if (kind === 't') y = bb.y; else if (kind === 'm') y = bb.y + bb.h / 2 - r.h / 2; else if (kind === 'b') y = bb.y + bb.h - r.h;
      r.el.style.left = Math.round(x) + 'px'; r.el.style.top = Math.round(y) + 'px';
    });
  });
}

/* 슬라이드 관리 */
function addSlide(html) {
  let el;
  commit(() => {
    el = fromHTML(html || '<section class="slide" data-title="새 슬라이드"><h2 style="left:160px;top:140px;width:1600px">새 슬라이드</h2></section>');
    if (!el.matches('section.slide')) { const s = h('section', { class: 'slide', 'data-title': '새 슬라이드' }); s.appendChild(el); el = s; }
    el.dataset.id = newId();
    const s = slides[cur]; if (s) s.after(el); else deck.appendChild(el);
    scan();
  });
  go(slides.indexOf(el), { instant: true }); renderThumbs();
}
function duplicateSlide() {
  const s = slides[cur]; if (!s) return;
  let c;
  commit(() => { c = cleanTree(s.cloneNode(true)); c.dataset.id = newId(); s.after(c); scan(); });
  go(slides.indexOf(c), { instant: true }); renderThumbs(); toast('슬라이드를 복제했어요');
}
function deleteSlide() {
  if (slides.length <= 1) return toast('마지막 남은 슬라이드는 지울 수 없어요');
  const s = slides[cur];
  commit(() => { s.remove(); scan(); cur = clamp(cur, 0, slides.length - 1); });
  go(cur, { force: true, instant: true }); renderThumbs(); toast('슬라이드를 지웠어요 · Ctrl+Z로 되돌리기');
}
function toggleHide() {
  const s = slides[cur]; if (!s) return;
  commit(() => { if (s.hasAttribute('data-hidden')) s.removeAttribute('data-hidden'); else s.setAttribute('data-hidden', ''); });
  renderThumbs(); updateChrome();
  toast(s.hasAttribute('data-hidden') ? '발표할 때 이 슬라이드를 건너뛰어요' : '숨김을 풀었어요');
}
function moveSlideTo(from, to, before) {
  if (from === to || !slides[from] || !slides[to]) return;
  const a = slides[from], b = slides[to];
  commit(() => { if (before) b.before(a); else b.after(a); scan(); cur = slides.indexOf(a); });
  go(slides.indexOf(a), { force: true, instant: true }); renderThumbs();
}
function moveSlide(d) {
  const j = cur + d; if (j < 0 || j >= slides.length) return;
  moveSlideTo(cur, j, d < 0); toast(`슬라이드를 ${d < 0 ? '앞' : '뒤'}으로 옮겼어요`);
}

/* ------------------------------------------------------------------ */
/* 편집: 미리보기                                                      */
/* ------------------------------------------------------------------ */
async function previewSlide() {
  if (!editing) return;
  stopTextEdit(); stopPreview();
  const s = slides[cur], tk = ++previewToken;
  previewing = true; forceMotion = true; root.classList.add('hz-previewing'); selLayer.innerHTML = '';
  cleanupSlide(s); setInitial(s); armInteractions(s); startAmbient(s);
  let end = playAuto(s);
  for (const v of stepsOf(s)) { await wait(end + 450); if (tk !== previewToken) return; end = doStep(s, v); }
  await wait(end + 1100);
  if (tk === previewToken) stopPreview();
}
function stopPreview() {
  if (!previewing) return;
  previewToken++; previewing = false;
  finishAll(); forceMotion = false;
  cleanupSlide(slides[cur]); fxLayer.innerHTML = ''; clearSpot();
  root.classList.remove('hz-previewing'); renderSelBoxes();
}
function previewEl(el, kind) {
  stopPreview();
  forceMotion = true;
  cleanEl(el);
  let end = 0;
  if (kind === 'anim' && el.dataset.anim) {
    if (el.dataset.anim === 'stagger') [...el.children].forEach(c => c.classList.add('hz-pre')); else el.classList.add('hz-pre');
    end = enter(el);
  } else if (kind === 'emphasis' && el.dataset.emphasis) end = emphasize(el);
  else if (kind === 'exit' && el.dataset.exit) end = exitEl(el);
  forceMotion = false;
  setTimeout(() => { if (!el.isConnected || previewing) return; cleanEl(el); fxLayer.innerHTML = ''; clearSpot(); renderSelBoxes(); }, end + 900);
}

/* ------------------------------------------------------------------ */
/* 편집: 도구 막대·속성 패널                                           */
/* ------------------------------------------------------------------ */
Object.assign(SHORT, { 'e-dup': 'Ctrl+D', 'e-del': 'Delete', 'e-undo': 'Ctrl+Z', 'e-redo': 'Ctrl+Shift+Z', 'e-preview': 'R', 'e-save': 'Ctrl+S', 'e-done': 'Esc', 'e-front': 'Ctrl+Shift+]', 'e-back': 'Ctrl+Shift+[' });
function buildEditBar() {
  editBar.innerHTML = '';
  editBar.append(btn('e-text', '텍스트', 'text'), btn('e-rect', '사각형', 'rect'), btn('e-circle', '원', 'circle'), btn('e-arrow', '화살표', 'arrow'),
    btn('e-line', '선', 'line'), btn('e-image', '이미지', 'image'), btn('e-emoji', emojiOff() ? '아이콘' : '이모지·아이콘', 'smile'), sep(),
    btn('e-dup', '복제', 'copy'), btn('e-del', '삭제', 'trash'), sep(), btn('e-front', '맨 앞으로', 'front'), btn('e-back', '맨 뒤로', 'back'), sep(),
    btn('e-undo', '되돌리기', 'undo'), btn('e-redo', '다시 하기', 'redo'), sep(), btn('e-preview', '미리보기', 'play'),
    h('span', { class: 'hz-grow' }), btn('e-save', '저장', 'save'), btn('e-done', '편집 끝', 'done'));
  thumbsTools.innerHTML = '';
  thumbsTools.append(mbtn('plus', '새 슬라이드', () => addSlide()), mbtn('layout', '레이아웃', e => openLayoutMenu(e.currentTarget)),
    mbtn('copy', '복제', duplicateSlide), mbtn('trash', '삭제', deleteSlide), mbtn('eyeoff', '숨기기', toggleHide));
}
let propsTab = 'style';
const F = (label, ...ctrls) => h('div', { class: 'hz-f' }, h('label', {}, label), ...ctrls);
const hint = t => h('p', { class: 'hz-hintx' }, t);
function numIn(val, step = 1, ph = '') { return h('input', { type: 'number', value: val, step, placeholder: ph }); }
function selectIn(options, val) {
  const s = h('select');
  options.forEach(([v, t]) => { const o = h('option', { value: v }, t); if (String(v) === String(val)) o.selected = true; s.appendChild(o); });
  return s;
}
function toHex(c) {
  const m = String(c || '').match(/rgba?\(([^)]+)\)/);
  if (!m) return /^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (p.length > 3 && p[3] === 0) return null;
  return '#' + p.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function liveInput(inp, apply) {
  inp.addEventListener('input', () => { if (liveBefore == null) liveBefore = snap(); apply(inp.value); renderSelBoxes(); });
  inp.addEventListener('change', () => { if (liveBefore == null) { liveBefore = snap(); apply(inp.value); } changed(liveBefore); liveBefore = null; renderSelBoxes(); });
}
function renderProps() {
  if (!editing) return;
  propsPanel.innerHTML = '';
  const ts = (innerSel ? [innerSel] : sel).filter(el => el && el.isConnected);
  const tab = ts.length ? propsTab : 'slide';
  const tabs = h('div', { class: 'hz-tabs' });
  [['style', '스타일'], ['motion', '모션'], ['slide', '슬라이드']].forEach(([k, l]) => tabs.appendChild(h('button', {
    type: 'button', class: k === tab ? 'hz-sel' : '',
    onclick: () => { propsTab = k; if (k !== 'slide' && !ts.length) toast('먼저 요소를 클릭해서 선택하세요'); renderProps(); }
  }, l)));
  const body = h('div', { class: 'hz-props-body' });
  if (tab === 'style') buildStyle(body, ts); else if (tab === 'motion') buildMotion(body, ts); else buildSlide(body);
  propsPanel.append(tabs, body);
}
function buildStyle(body, ts) {
  const el = ts[0], cs = getComputedStyle(el), top = !innerSel && ts.every(isBox);
  const each = fn => ts.forEach(fn);
  const tb = (label, on, fn) => h('button', { class: 'hz-mini-btn' + (on ? ' hz-sel' : ''), type: 'button', onclick: fn }, label);
  body.append(h('h5', {}, ts.length > 1 ? `${ts.length}개 선택됨 · 글자` : (innerSel ? '안쪽 요소 · 글자' : '글자')));
  const fs = numIn(Math.round(num(cs.fontSize)));
  liveInput(fs, v => each(t => { t.style.fontSize = v + 'px'; }));
  const fc = h('input', { type: 'color', value: toHex(cs.color) || '#000000' });
  liveInput(fc, v => each(t => { t.style.color = v; }));
  const bold = num(cs.fontWeight) >= 600, italic = cs.fontStyle === 'italic', ta = cs.textAlign;
  body.append(F('크기(px)', fs), F('글자·선 색', fc),
    F('모양', tb('굵게', bold, () => editingText ? doc.execCommand('bold') : commit(() => each(t => { t.style.fontWeight = bold ? '400' : '700'; }))),
      tb('기울임', italic, () => editingText ? doc.execCommand('italic') : commit(() => each(t => { t.style.fontStyle = italic ? 'normal' : 'italic'; })))),
    F('정렬', ...[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([v, l]) => tb(l, ta === v || (v === 'left' && ta === 'start'), () => commit(() => each(t => { t.style.textAlign = v; }))))));
  body.append(h('h5', {}, '상자'));
  const bg = h('input', { type: 'color', value: toHex(cs.backgroundColor) || '#ffffff' });
  liveInput(bg, v => each(t => { t.style.backgroundColor = v; }));
  const bw = numIn(Math.round(num(cs.borderTopWidth))), bc = h('input', { type: 'color', value: toHex(cs.borderTopColor) || '#ffffff' });
  const setB = () => each(t => { const w = num(bw.value); t.style.border = w > 0 ? `${w}px solid ${bc.value}` : 'none'; });
  liveInput(bw, setB); liveInput(bc, setB);
  const br = numIn(Math.round(num(cs.borderTopLeftRadius)));
  liveInput(br, v => each(t => { t.style.borderRadius = v + 'px'; }));
  const op = h('input', { type: 'range', min: 0, max: 100, value: Math.round(num(cs.opacity, 1) * 100) });
  liveInput(op, v => each(t => { t.style.opacity = String(v / 100); }));
  const sh = h('input', { type: 'checkbox' }); sh.checked = !!cs.boxShadow && cs.boxShadow !== 'none';
  sh.addEventListener('change', () => commit(() => each(t => { t.style.boxShadow = sh.checked ? '0 24px 60px rgba(0,0,0,.35)' : 'none'; })));
  body.append(F('배경', bg, tb('없음', !toHex(cs.backgroundColor), () => commit(() => each(t => { t.style.background = 'transparent'; })))),
    F('테두리', bw, bc), F('둥글기(px)', br), F('투명도', op), F('그림자', sh));
  if (el.tagName === 'IMG') {
    const alt = h('input', { type: 'text', value: el.getAttribute('alt') || '' });
    alt.addEventListener('change', () => commit(() => el.setAttribute('alt', alt.value)));
    body.append(h('h5', {}, '이미지'), F('대체 텍스트', alt), F('', tb('이미지 바꾸기', false, () => replaceImage(el))));
  }
  if (top && ts.length === 1) {
    const r = boxRect(el);
    const mk = (lab, val, fn) => { const i = numIn(Math.round(val)); liveInput(i, v => fn(num(v))); return F(lab, i); };
    body.append(h('h5', {}, '위치와 크기 (px)'),
      h('div', { class: 'hz-grid2' }, mk('X', r.x, v => { el.style.left = v + 'px'; }), mk('Y', r.y, v => { el.style.top = v + 'px'; }),
        mk('W', r.w, v => { el.style.width = v + 'px'; }), mk('H', r.h, v => { el.style.height = v + 'px'; })),
      mk('회전(°)', num(el.style.rotate), v => { el.style.rotate = v ? v + 'deg' : ''; }));
  }
  if (top) {
    const ab = (ic, k, t) => mbtn(ic, '', () => alignSel(k), t);
    body.append(h('h5', {}, ts.length > 1 ? '정렬 (선택한 요소끼리)' : '정렬 (슬라이드 기준)'),
      h('div', { class: 'hz-row' }, ab('alL', 'l', '왼쪽 맞춤'), ab('alC', 'c', '가운데 맞춤'), ab('alR', 'r', '오른쪽 맞춤'), ab('alT', 't', '위 맞춤'),
        ab('alM', 'm', '세로 가운데'), ab('alB', 'b', '아래 맞춤'), ts.length > 2 ? ab('disH', 'dh', '가로 간격 같게') : null, ts.length > 2 ? ab('disV', 'dv', '세로 간격 같게') : null),
      h('h5', {}, '순서'),
      h('div', { class: 'hz-row' }, mbtn('front', '맨 앞', () => zorder('front')), mbtn('next', '앞으로', () => zorder('fwd')), mbtn('prev', '뒤로', () => zorder('bwd')), mbtn('back', '맨 뒤', () => zorder('back'))));
  }
  body.append(h('div', { class: 'hz-row', style: 'margin-top:14px' }, top ? mbtn('copy', '복제', duplicateSel) : null, mbtn('trash', '삭제', deleteSel)));
}
function setInteract(el, v) {
  commit(() => {
    if (!v) { delete el.dataset.interact; return; }
    el.dataset.interact = v;
    if (v === 'flip' && !$(':scope > .front', el)) {
      if (!el.style.height) el.style.height = el.offsetHeight + 'px';
      const front = h('div', { class: 'front' });
      while (el.firstChild) front.appendChild(el.firstChild);
      el.append(front, h('div', { class: 'back', style: 'display:flex;align-items:center;justify-content:center;padding:32px;border-radius:inherit;background:var(--accent, #f26b3a);color:#fff;text-align:center' }, '뒷면 내용을 입력하세요'));
    }
    if (v === 'quiz' && !$('[data-option]', el)) {
      const opts = $$('li', el).length ? $$('li', el) : [...el.children];
      opts.forEach((o, i) => { o.setAttribute('data-option', ''); if (i === 0) o.setAttribute('data-correct', ''); });
    }
    if (v === 'hotspot' && !$('[data-spot]', el)) el.appendChild(h('span', { 'data-spot': '', 'data-tip': '설명을 입력하세요', style: 'left:50%;top:50%' }));
  });
}
function buildMotion(body, ts) {
  const el = ts[0];
  const opts = list => [['', '없음']].concat(list.map(n => [n, lbl(n)]));
  const setD = (k, v) => commit(() => ts.forEach(t => { if (v === '' || v == null) delete t.dataset[k]; else t.dataset[k] = v; }));
  const pick = (k, list, kind) => {
    const s = selectIn(opts(list), el.dataset[k] || '');
    s.addEventListener('change', () => { setD(k, s.value); if (s.value && kind) previewEl(el, kind); });
    return s;
  };
  const numD = (k, ph) => {
    const i = h('input', { type: 'number', value: el.dataset[k] == null ? '' : el.dataset[k], placeholder: ph, min: 0, step: (k === 'delay' || k === 'duration') ? 50 : 1 });
    i.addEventListener('change', () => setD(k, i.value));
    return i;
  };
  body.append(h('h5', {}, ts.length > 1 ? `${ts.length}개 선택됨 · 등장` : '등장'),
    F('효과', pick('anim', LIB.anim, 'anim')), F('단계', numD('step', '자동')), F('지연(ms)', numD('delay', '0')), F('시간(ms)', numD('duration', '기본')),
    hint('단계에 번호를 넣으면 "다음"을 누를 때 번호 순서대로 나타나요. 비워 두면 슬라이드에 들어올 때 자동으로 나와요.'),
    h('h5', {}, '강조'), F('효과', pick('emphasis', LIB.emphasis, 'emphasis')), F('단계', numD('emphasisStep', '등장 직후')),
    h('h5', {}, '퇴장'), F('효과', pick('exit', LIB.exit, 'exit')), F('단계', numD('exitStep', '')));
  const it = selectIn(opts(LIB.interact), el.dataset.interact || '');
  it.addEventListener('change', () => setInteract(el, it.value));
  body.append(h('h5', {}, '상호작용'), F('종류', it));
  const t = el.dataset.interact;
  if (t === 'flip') {
    const on = el.classList.contains('hz-flipped');
    body.append(F('편집 면', h('button', { class: 'hz-mini-btn' + (on ? ' hz-sel' : ''), type: 'button', onclick: () => { el.classList.toggle('hz-flipped'); renderProps(); } }, on ? '뒷면 보는 중' : '앞면 보는 중')),
      hint('뒷면 글자를 고치려면 "뒷면 보는 중"으로 바꾼 뒤 더블클릭하세요.'));
  }
  if (t === 'reveal') {
    const i = h('input', { type: 'text', value: el.dataset.coverText || '', placeholder: '클릭해서 확인' });
    i.addEventListener('change', () => commit(() => { if (i.value.trim()) el.dataset.coverText = i.value.trim(); else delete el.dataset.coverText; }));
    body.append(F('가리개 글자', i));
  }
  if (t === 'quiz') body.append(hint('선택지를 Ctrl(⌘)+클릭으로 고른 뒤 "정답"을 체크하세요.'));
  if (t === 'hotspot') body.append(F('', mbtn('plus', '점 추가', () => commit(() => el.appendChild(h('span', { 'data-spot': '', 'data-tip': '설명을 입력하세요', style: `left:${Math.round(rand(30, 70))}%;top:${Math.round(rand(30, 70))}%` }))))),
    hint('점을 Ctrl(⌘)+클릭하면 설명과 위치를 바꿀 수 있어요.'));
  if (innerSel && innerSel.hasAttribute('data-option')) {
    const cb = h('input', { type: 'checkbox' }); cb.checked = innerSel.hasAttribute('data-correct');
    const o = innerSel;
    cb.addEventListener('change', () => commit(() => { if (cb.checked) o.setAttribute('data-correct', ''); else o.removeAttribute('data-correct'); }));
    body.append(F('정답', cb));
  }
  if (innerSel && innerSel.hasAttribute('data-spot')) {
    const o = innerSel;
    const tip = h('input', { type: 'text', value: o.dataset.tip || '' });
    tip.addEventListener('change', () => commit(() => { o.dataset.tip = tip.value; }));
    const px = numIn(Math.round(num(o.style.left, 50))), py = numIn(Math.round(num(o.style.top, 50)));
    liveInput(px, v => { o.style.left = v + '%'; }); liveInput(py, v => { o.style.top = v + '%'; });
    body.append(h('h5', {}, '핫스팟 점'), F('설명', tip), F('가로(%)', px), F('세로(%)', py));
  }
  const am = selectIn(opts(['float', 'sparkle']), el.dataset.ambient || '');
  am.addEventListener('change', () => setD('ambient', am.value));
  const mo = h('input', { type: 'text', value: el.dataset.morph || '', placeholder: '예: logo' });
  mo.addEventListener('change', () => setD('morph', mo.value.trim()));
  body.append(h('h5', {}, '기타'), F('배경 움직임', am), F('모프 이름', mo),
    hint('모프: 옆 슬라이드에 같은 이름의 요소가 있으면 위치·크기·색이 이어서 변해요 (슬라이드 전환을 ‘모프’로).'),
    h('div', { class: 'hz-row', style: 'margin-top:10px' },
      mbtn('play', '이 요소', () => previewEl(el, el.dataset.anim ? 'anim' : el.dataset.emphasis ? 'emphasis' : 'exit')),
      mbtn('play', '슬라이드 전체 (R)', previewSlide)));
}
function buildSlide(body) {
  const s = slides[cur]; if (!s) return;
  const setA = (k, v) => commit(() => { if (v === '' || v == null) delete s.dataset[k]; else s.dataset[k] = v; });
  const title = h('input', { type: 'text', value: s.dataset.title || '' });
  title.addEventListener('change', () => { setA('title', title.value.trim()); renderThumbs(); });
  const tr = selectIn([['', '덱 기본값']].concat(LIB.transition.map(n => [n, lbl(n)])), s.dataset.transition || '');
  tr.addEventListener('change', () => setA('transition', tr.value));
  const am = selectIn([['', '없음']].concat(['drift', 'gradient', 'particles'].map(n => [n, lbl(n)])), s.dataset.ambient || '');
  am.addEventListener('change', () => setA('ambient', am.value));
  const ce = selectIn([['', '없음']].concat(LIB.celebrate.map(n => [n, lbl(n)])), s.dataset.celebrate || '');
  ce.addEventListener('change', () => setA('celebrate', ce.value));
  const bg = h('input', { type: 'color', value: toHex(getComputedStyle(s).backgroundColor) || '#ffffff' });
  liveInput(bg, v => { s.style.background = v; });
  const hid = h('input', { type: 'checkbox' }); hid.checked = s.hasAttribute('data-hidden');
  hid.addEventListener('change', () => { commit(() => { if (hid.checked) s.setAttribute('data-hidden', ''); else s.removeAttribute('data-hidden'); }); renderThumbs(); updateChrome(); });
  const n0 = $(':scope > .notes', s);
  const nt = h('textarea', { placeholder: '발표자 노트 (발표 화면에는 보이지 않아요)' }); nt.value = n0 ? n0.textContent.trim() : '';
  nt.addEventListener('change', () => commit(() => {
    let n = $(':scope > .notes', s); const v = nt.value.trim();
    if (!v) { if (n) n.remove(); return; }
    if (!n) { n = h('aside', { class: 'notes' }); s.appendChild(n); }
    n.textContent = v;
  }));
  const dtr = selectIn(LIB.transition.map(n => [n, lbl(n)]), deck.dataset.transition || 'fade');
  dtr.addEventListener('change', () => { deck.dataset.transition = dtr.value; markDirty(); });
  body.append(h('h5', {}, `이 슬라이드 (${cur + 1} / ${slides.length})`), F('제목', title), F('전환', tr), F('배경 움직임', am), F('축하 효과', ce),
    F('배경', bg,
      mbtn('image', '', () => pickImage(async f => { try { const url = await readImage(f); commit(() => { s.style.background = `center / cover no-repeat url("${url}")`; }); } catch (e) { toast('이미지를 읽지 못했어요'); } }), '배경 이미지'),
      mbtn('reset', '', () => commit(() => { s.style.removeProperty('background'); s.style.removeProperty('background-color'); }), '디자인 기본값으로')),
    F('숨기기', hid), h('h5', {}, '발표자 노트'), nt,
    h('h5', {}, '덱 전체'), F('기본 전환', dtr),
    h('h5', {}, '슬라이드 관리'),
    h('div', { class: 'hz-row' }, mbtn('plus', '새 슬라이드', () => addSlide()), mbtn('layout', '레이아웃', e => openLayoutMenu(e.currentTarget)), mbtn('copy', '복제', duplicateSlide), mbtn('trash', '삭제', deleteSlide)),
    hint('요소를 클릭하면 스타일·모션 탭이 열려요. 왼쪽 썸네일을 끌어서 순서를 바꿀 수 있어요 (Alt+↑/↓).'));
}

/* 편집 모드 켜고 끄기 */
function toggleEdit(on = !editing) {
  if (on === editing) return;
  if (on) {
    finishAll(); clearSpot(); closeZoom(); hideTips(); fxLayer.innerHTML = ''; closePops();
    if (boardMode) setBoard(false);
    if (root.classList.contains('hz-full')) toggleFull(false);
    setTool('hand');
    slides.forEach(cleanupSlide);
    editing = true;
    root.classList.add('hz-editing');
    openDrawer('slides');
    slides.forEach(s => s.classList.remove('hz-active', 'hz-leaving', 'hz-top'));
    if (slides[cur]) slides[cur].classList.add('hz-active');
    buildEditBar(); selectEls([]); renderThumbs(); layout(); renderInk(); updateChrome();
    toast('편집 모드 · 클릭: 선택 · 더블클릭: 글자 고치기 · Esc: 끝내기', 2800);
  } else {
    stopTextEdit(); stopPreview(); selectEls([]);
    editing = false;
    root.classList.remove('hz-editing');
    closeDrawer(true);
    selLayer.innerHTML = ''; propsPanel.innerHTML = '';
    scan(); layout();
    go(cur, { force: true, final: true, instant: true });
    runCheck();
    if (dirty) toast('편집 내용은 브라우저에 임시 저장됐어요 · 파일로 남기려면 Ctrl+S', 3000);
  }
}

/* ------------------------------------------------------------------ */
/* 점검                                                                */
/* ------------------------------------------------------------------ */
let checkIssues = [];
function runCheck() {
  const issues = [], dominant = [];
  // 모션 도중 상태에 흔들리지 않도록, 깨끗한 복제본을 화면 밖에서 잰다
  const meas = h('div', { class: 'hz-mini', style: 'position:fixed;left:-40000px;top:0;visibility:hidden' });
  ui.appendChild(meas);
  slides.forEach((s, i) => {
    meas.innerHTML = '';
    const c = cleanTree(s.cloneNode(true));
    meas.appendChild(c);
    const boxes = boxesOf(s), cboxes = boxesOf(c);
    if (!s.dataset.title) issues.push({ i, msg: '제목(data-title)이 없어요' });
    if (!boxes.length) issues.push({ i, msg: '빈 슬라이드예요' });
    cboxes.forEach((b, k) => {
      const orig = boxes[k] || null;
      if (b.hasAttribute('data-check-ignore')) return;
      const r = boxRect(b);
      if (r.x < -2 || r.y < -2 || r.x + r.w > W + 2 || r.y + r.h > H + 2) issues.push({ i, el: orig, msg: '요소가 무대 밖으로 벗어났어요' });
      if (b instanceof HTMLElement && !/^(IMG|svg)$/i.test(b.tagName) && (b.scrollHeight > b.clientHeight + 3 || b.scrollWidth > b.clientWidth + 3)) issues.push({ i, el: orig, msg: '글자가 상자 밖으로 넘쳐요' });
    });
    $$('img', s).forEach(img => {
      if (!img.hasAttribute('alt')) issues.push({ i, el: img, msg: '이미지에 대체 텍스트(alt)가 없어요' });
      if (img.complete && img.naturalWidth === 0) issues.push({ i, el: img, msg: '이미지가 깨졌어요' });
    });
    const bad = (attr, list) => [s, ...$$(`[${attr}]`, s)].forEach(el => {
      const v = el.getAttribute(attr);
      if (v && !list.includes(v)) issues.push({ i, el: el === s ? null : el, msg: `알 수 없는 모션 이름: ${attr}="${v}"` });
    });
    bad('data-anim', LIB.anim); bad('data-emphasis', LIB.emphasis); bad('data-exit', LIB.exit); bad('data-interact', LIB.interact);
    bad('data-celebrate', LIB.celebrate); bad('data-ambient', LIB.ambient); bad('data-transition', LIB.transition);
    const groups = {};
    motionEls(s).forEach(el => {
      if (!isEntrance(el) || staggerChildAuto(el)) return;
      const key = hasStep(el) ? 's' + stepVal(el.dataset.step) : 'auto';
      (groups[key] = groups[key] || []).push(num(el.dataset.delay));
    });
    for (const k in groups) {
      const d = groups[k];
      const maxc = Math.max(...d.map(v => d.filter(w => Math.abs(w - v) < 150).length));
      if (maxc > 2) issues.push({ i, msg: `한 번에 움직이기 시작하는 요소가 ${maxc}개예요 (2개 이하 권장, data-delay로 나누세요)` });
    }
    const cnt = {};
    // 제목(h1, h2)은 덱 전체에서 같은 효과를 이어 써도 되므로 연속 규칙에서 뺀다 (§4.4)
    motionEls(s).forEach(el => { if (el.dataset.anim && !el.closest('h1, h2')) cnt[el.dataset.anim] = (cnt[el.dataset.anim] || 0) + 1; });
    let dom = null, best = 0; for (const k in cnt) if (cnt[k] > best) { best = cnt[k]; dom = k; }
    dominant.push(dom);
  });
  meas.remove();
  let run = 1;
  for (let i = 1; i < dominant.length; i++) {
    if (dominant[i] && dominant[i] === dominant[i - 1]) { run++; if (run === 4) issues.push({ i, msg: `같은 등장 효과(${dominant[i]})가 4장 연속이에요 (제목 제외)` }); }
    else run = 1;
  }
  issues.sort((a, b) => a.i - b.i);
  checkIssues = issues; checkCount = issues.length;
  updateChrome();
  return issues;
}
const runCheckSoon = debounce(runCheck, 700);
function openCheck() {
  runCheck();
  const body = [];
  if (!checkIssues.length) body.push(h('p', {}, '문제가 없어요.'));
  else {
    const ul = h('ul', { class: 'hz-list' });
    checkIssues.forEach(it => ul.appendChild(h('li', {
      onclick: () => {
        closeModal();
        go(it.i, { dir: it.i >= cur ? 1 : -1, final: true, instant: true });
        if (it.el) setTimeout(() => {
          if (editing && isBox(it.el)) selectEls([it.el]);
          it.el.classList.add('hz-flash'); setTimeout(() => it.el.classList.remove('hz-flash'), 1500);
        }, 120);
      }
    }, h('span', { class: 'hz-n' }, String(it.i + 1).padStart(2, '0')), h('span', {}, it.msg))));
    body.push(h('p', {}, `${checkIssues.length}건을 찾았어요. 누르면 해당 슬라이드로 이동해요.`), ul);
  }
  body.push(h('p', { style: 'font-size:12px;color:var(--hz-sub);margin-top:14px' }, '일부러 무대 밖에 둔 장식처럼 의도한 예외는 요소에 data-check-ignore를 붙이면 점검에서 빠져요.'));
  openModal('점검', body, [h('button', { class: 'hz-b hz-primary', type: 'button', onclick: () => closeModal() }, '닫기')]);
}

/* ------------------------------------------------------------------ */
/* 명령·입력                                                           */
/* ------------------------------------------------------------------ */
const CMD = {
  prev, next,
  hand: () => setTool('hand'), pen: () => setTool('pen'), hl: () => setTool('hl'), laser: () => setTool('laser'),
  eraser: () => (tool === 'eraser' ? toggleEraserMode() : setTool('eraser')),
  color: b => { if (colorPop.classList.contains('hz-show')) return closePops(); closePops(); renderColorPop(); placePop(colorPop, b); },
  undo: () => (editing ? editUndo() : inkUndoAct()), redo: () => (editing ? editRedo() : inkRedoAct()),
  clear: clearSurface, clearAll: clearAllInk, board: () => setBoard(!boardMode), view: toggleView, check: openCheck, edit: () => toggleEdit(),
  timer: toggleTimer, celebrate: () => celebrate('confetti', true), toc: openToc, full: () => toggleFull(), settings: openSettings, help: openHelp,
  menu: () => (drawerOpen() ? closeDrawer() : openDrawer('menu')), closeMenu: () => closeDrawer(),
  fold: () => setCaseFolded(true), unfold: () => setCaseFolded(false),
  'e-text': () => insertBox(SHAPES.text, true), 'e-rect': () => insertBox(SHAPES.rect), 'e-circle': () => insertBox(SHAPES.circle),
  'e-arrow': () => insertBox(SHAPES.arrow), 'e-line': () => insertBox(SHAPES.line), 'e-image': () => pickImage(f => insertImageFile(f)),
  'e-emoji': b => openEmoji(b), 'e-dup': duplicateSel, 'e-del': deleteSel, 'e-front': () => zorder('front'), 'e-back': () => zorder('back'),
  'e-undo': editUndo, 'e-redo': editRedo, 'e-preview': previewSlide, 'e-save': save, 'e-done': () => toggleEdit(false)
};
ui.addEventListener('click', e => {
  const b = e.target instanceof Element && e.target.closest('[data-cmd]');
  if (!b || !ui.contains(b)) return;
  const f = CMD[b.dataset.cmd];
  if (!f) return;
  e.stopPropagation();
  if (b.classList.contains('hz-tile') && !editing) closeDrawer(); // 타일을 고르면 서랍은 닫는다
  f(b);
});
/* 서랍 밖을 누르면 서랍만 닫고, 슬라이드는 넘기지 않는다 */
window.addEventListener('pointerdown', e => {
  if (!drawerOpen() || editing || !(e.target instanceof Element)) return;
  if (e.target.closest('.hz-drawer,.hz-menu-btn,.hz-modal-wrap,.hz-pop,.hz-case,.hz-case-mini,.hz-timer,.hz-boardbar')) return;
  closeDrawer(); suppressClick = true;
  e.stopPropagation(); e.preventDefault();
}, true);
doc.addEventListener('pointerdown', e => {
  if (!(e.target instanceof Element) || e.target.closest('.hz-pop,[data-cmd="color"],[data-cmd="e-emoji"],.hz-thumbs-tools')) return;
  closePops();
}, true);

/* 발표 중 클릭·스와이프 */
let down = null;
deck.addEventListener('pointerdown', e => {
  if (editing) return editPointerDown(e);
  if (tool !== 'hand' || boardMode) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  down = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId, target: e.target, type: e.pointerType };
});
window.addEventListener('pointerup', e => {
  if (suppressClick) { suppressClick = false; down = null; return; }
  if (!down || e.pointerId !== down.id) return;
  const d = down; down = null;
  if (modalOpen()) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y;
  if (d.type !== 'mouse' && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) { if (dx < 0) next(); else prev(); return; }
  if (Math.hypot(dx, dy) < 10 && Date.now() - d.t < 700) {
    if (handleInteract(d.target)) return;
    next();
  }
});
deck.addEventListener('dblclick', e => {
  if (!editing || previewing) return;
  const box = boxOf(e.target); if (!box) return;
  e.preventDefault();
  if (box.tagName === 'IMG') { replaceImage(box); return; }
  startTextEdit(box, e);
});

/* 붙여넣기·복사·끌어다 놓기 */
doc.addEventListener('copy', e => {
  if (!editing || editingText || isTyping(e.target) || !sel.length) return;
  if (!copySel()) return;
  e.preventDefault();
  try { e.clipboardData.setData('text/plain', lastClipText); e.clipboardData.setData('text/html', `<div data-htmlzip-clip="1">${clipboard.join('')}</div>`); } catch (err) { /* 무시 */ }
});
doc.addEventListener('paste', e => {
  if (!editing) return;
  const cd = e.clipboardData;
  const items = cd ? [...cd.items] : [];
  const img = items.find(it => it.kind === 'file' && it.type.startsWith('image/'));
  if (img) { e.preventDefault(); pasteHandled = true; if (editingText) stopTextEdit(); insertImageFile(img.getAsFile()); return; }
  if (editingText) { e.preventDefault(); doc.execCommand('insertText', false, cd ? cd.getData('text/plain') : ''); return; }
  if (isTyping(e.target)) return;
  e.preventDefault(); pasteHandled = true;
  const html = cd ? cd.getData('text/html') : '';
  if (html && html.includes('data-htmlzip-clip')) {
    const t = doc.createElement('template'); t.innerHTML = html;
    const wrap = t.content.querySelector('[data-htmlzip-clip]');
    if (wrap && wrap.children.length) { pasteHtmlList([...wrap.children].map(c => c.outerHTML)); return; }
  }
  const text = cd ? cd.getData('text/plain') : '';
  if (clipboard && (!text || text === lastClipText)) { pasteSel(); return; }
  if (text && text.trim()) {
    const el = h('div', {}, text.trim());
    el.style.cssText = 'left:460px;top:440px;width:1000px;font-size:40px';
    commit(() => slides[cur].appendChild(el)); selectEls([el]);
  }
});
window.addEventListener('dragover', e => { if (editing && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', e => {
  if (!editing || !e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
  if (f) insertImageFile(f, toStage(e));
});

/* 키보드 */
let numBuf = '', numT = 0;
const isTyping = t => t instanceof Element && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
function editKey(e) {
  const k = e.key, c = e.code, mod = e.ctrlKey || e.metaKey;
  if (previewing) { stopPreview(); if (k === 'Escape') { e.preventDefault(); return; } }
  if (k === 'Escape') { e.preventDefault(); if (sel.length || innerSel) selectEls([]); else toggleEdit(false); return; }
  if (mod && c === 'KeyZ') { e.preventDefault(); if (e.shiftKey) editRedo(); else editUndo(); return; }
  if (mod && c === 'KeyY') { e.preventDefault(); editRedo(); return; }
  if (mod && c === 'KeyC') { copySel(); return; }
  if (mod && c === 'KeyV') { pasteHandled = false; setTimeout(() => { if (!pasteHandled) pasteSel(); }, 80); return; }
  if (mod && c === 'KeyD') { e.preventDefault(); duplicateSel(); return; }
  if (mod && (c === 'BracketRight' || c === 'BracketLeft')) { e.preventDefault(); zorder(c === 'BracketRight' ? (e.shiftKey ? 'front' : 'fwd') : (e.shiftKey ? 'back' : 'bwd')); return; }
  if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); moveSlide(k === 'ArrowUp' ? -1 : 1); return; }
  if (mod) return;
  if (k === 'Delete' || k === 'Backspace') { if (sel.length || innerSel) { e.preventDefault(); deleteSel(); } return; }
  if (k === 'Tab') { e.preventDefault(); cycleSel(e.shiftKey ? -1 : 1); return; }
  if (k.startsWith('Arrow')) {
    e.preventDefault();
    const st = e.shiftKey ? 10 : 1;
    if (sel.filter(isBox).length) nudge(k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0);
    else if (k === 'ArrowRight' || k === 'ArrowDown') next(); else prev();
    return;
  }
  if (k === 'PageDown') { e.preventDefault(); next(); return; }
  if (k === 'PageUp') { e.preventDefault(); prev(); return; }
  if (k === 'Enter' && sel.length === 1) { e.preventDefault(); startTextEdit(sel[0]); return; }
  if (c === 'KeyR' && !e.shiftKey) { e.preventDefault(); previewSlide(); return; }
  if (c === 'KeyE' && e.shiftKey) { e.preventDefault(); toggleEdit(false); return; }
  if (k === '?') { e.preventDefault(); openHelp(); }
}
window.addEventListener('keydown', e => {
  const k = e.key, c = e.code, mod = e.ctrlKey || e.metaKey;
  if (mod && c === 'KeyS') { e.preventDefault(); save(); return; }
  if (isTyping(e.target)) {
    if (k === 'Escape') { e.preventDefault(); if (editingText) stopTextEdit(); else e.target.blur(); }
    return;
  }
  if (modalOpen()) { if (k === 'Escape') { e.preventDefault(); closeModal(false); } return; }
  if (k === 'Escape' && (colorPop.classList.contains('hz-show') || emojiPop.classList.contains('hz-show'))) { closePops(); return; }
  if (k === 'Escape' && drawerOpen() && !editing) { e.preventDefault(); closeDrawer(); return; }
  if (editing) { editKey(e); return; }
  if (e.isComposing) return;
  if (mod && c === 'KeyZ') { e.preventDefault(); if (e.shiftKey) inkRedoAct(); else inkUndoAct(); return; }
  if (mod && c === 'KeyY') { e.preventDefault(); inkRedoAct(); return; }
  if (mod || e.altKey) return;
  if (/^[0-9]$/.test(k)) {
    numBuf += k; toast(`${numBuf}번 슬라이드로 가려면 Enter`, 1800);
    clearTimeout(numT); numT = setTimeout(() => { numBuf = ''; }, 2500);
    return;
  }
  let handled = true;
  switch (k) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Spacebar': next(); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': prev(); break;
    case 'Home': { const v = visible(); if (v.length) go(slides.indexOf(v[0]), { dir: -1 }); break; }
    case 'End': { const v = visible(); if (v.length) go(slides.indexOf(v[v.length - 1]), { dir: 1, final: true }); break; }
    case 'Enter': if (numBuf) { goVisible(parseInt(numBuf, 10)); numBuf = ''; } else next(); break;
    case 'Escape':
      if (zoomed) closeZoom();
      else if (root.classList.contains('hz-full') && !realFS) toggleFull(false);
      else setTool('hand');
      break;
    case '?': openHelp(); break;
    default: handled = false;
  }
  if (!handled) {
    handled = true;
    switch (c) {
      case 'KeyV': setTool('hand'); break;
      case 'KeyP': setTool('pen'); break;
      case 'KeyH': setTool('hl'); break;
      case 'KeyE': if (e.shiftKey) toggleEdit(true); else CMD.eraser(); break;
      case 'KeyL': setTool('laser'); break;
      case 'KeyC': cycleColor(); break;
      case 'KeyX': if (e.shiftKey) clearAllInk(); else clearSurface(); break;
      case 'KeyB': setBoard(!boardMode); break;
      case 'KeyT': toggleTimer(); break;
      case 'KeyF': toggleFull(); break;
      case 'KeyO': openToc(); break;
      case 'KeyG': celebrate('confetti', true); break;
      case 'KeyR': replay(); break;
      case 'Slash': if (e.shiftKey) openHelp(); else handled = false; break;
      default: handled = false;
    }
  }
  if (handled) e.preventDefault();
});

/* ------------------------------------------------------------------ */
/* 시작                                                                */
/* ------------------------------------------------------------------ */
scan();
applyStrength(); applyTheme(); applyCase(); applyNav();
root.classList.toggle('hz-presenter', S.view === 'presenter');
setTool('hand'); renderBoardBar(); buildTimer(); renderColorPop(); buildEditBar();
layout();
{
  const hn = parseInt((location.hash || '').slice(1), 10);
  let first = !isNaN(hn) ? clamp(hn - 1, 0, slides.length - 1) : 0;
  if (slides[first] && slides[first].hasAttribute('data-hidden')) { const v = visible(); first = v.length ? slides.indexOf(v[0]) : 0; }
  cur = first;
  if (slides.length) go(first, { force: true, dir: 1, instant: true });
}
window.addEventListener('resize', layout);
window.addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (!isNaN(n) && n - 1 !== cur && slides[n - 1]) go(n - 1); });
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { layout(); runCheckSoon(); });
window.addEventListener('load', runCheckSoon);
runCheckSoon();
{
  const draft = store.get('draft', null);
  if (draft && draft.html && draft.html !== cleanDeckHTML()) {
    setTimeout(async () => {
      const when = draft.at ? new Date(draft.at).toLocaleString('ko-KR') : '이전';
      const ok = await ask('저장하지 않은 편집 내용이 있어요', `${when}에 편집하던 내용이 이 브라우저에 남아 있어요. 복구할까요?`, '복구', false, '버리기');
      if (ok) { restoreDeck(draft.html); dirty = true; toast('편집 내용을 복구했어요 · Ctrl+S로 파일에 저장하세요', 2800); }
      else store.del('draft');
    }, 400);
  }
}

/* 확인·테스트용 공개 API */
window.HTMLzip = {
  version: VERSION, go: (n, o) => go(n, o), next, prev, save, serialize, check: runCheck, setTool, toggleEdit, toggleFull,
  state: () => ({ cur, stepIdx, steps: steps.length, slides: slides.length, editing, tool, boardMode, full: root.classList.contains('hz-full'), dirty, scale })
};
})();
