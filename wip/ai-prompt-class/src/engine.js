/* AI 프롬프트 특강 · 슬라이드 엔진 (발표 + 편집) */
(function () {
  'use strict';

  // 내보내기용: 아무것도 그리기 전의 원본 HTML
  const PRISTINE = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;

  const W = 1920, H = 1080;
  const INK = '#1C2340';
  const FONT_MAIN = "'Nanum Gothic','NanumGothic','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
  const FONT_FUN = "'Jua','Nanum Gothic','Malgun Gothic',sans-serif";
  const ico = (name, cls) => icoSvg(name, cls);
  const PALETTE = ['#1C2340', '#5B6280', '#9AA0B5', '#FFFFFF', '#FFF8EE', '#151B3A', '#000000',
    '#FF7A1A', '#2F7BFF', '#8A5CFF', '#17B26A', '#FF4D8D', '#FFC21A', '#12B5B0',
    '#F04438', '#FFF1E5', '#EEF4FF', '#F3EEFF', '#EAFBF2', '#FFF0EF', '#FFF7D6'];
  const BG = { cream: '#FFF8EE', white: '#FFFFFF', navy: '#151B3A', orange: '#FF7A1A', blue: '#2F7BFF', purple: '#8A5CFF', green: '#17B26A', pink: '#FF4D8D', yellow: '#FFC21A', teal: '#12B5B0' };
  const BG_NAMES = { cream: '크림', white: '흰색', navy: '남색', orange: '주황', blue: '파랑', purple: '보라', green: '초록', pink: '분홍', yellow: '노랑', teal: '청록' };
  const DARK_BG = { navy: 1, orange: 1, blue: 1, purple: 1, green: 1, pink: 1, teal: 1 };
  const ANIMS = [['', '효과 없음'], ['fade', '페이드'], ['up', '아래에서 위로'], ['zoom', '확대'], ['pop', '튀어나오기'], ['left', '왼쪽에서'], ['right', '오른쪽에서'], ['letters', '글자 하나씩 톡톡'], ['type', '타자기(글자)'], ['swing', '흔들며 등장']];

  /* ---------- 작은 도구들 ---------- */
  const qs = (s, r) => (r || document).querySelector(s);
  function h(tag, attrs) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(x => x != null && n.appendChild(typeof x === 'string' ? document.createTextNode(x) : x));
      else n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  }
  const uid = (p) => (p || 'e') + Math.random().toString(36).slice(2, 9);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isTyping = (t) => !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
  const fmtDate = (ms) => { const d = new Date(ms); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

  /* ---------- 저장소 (IndexedDB, 안 되면 메모리) ---------- */
  const Store = {
    db: null, mem: {},
    open() {
      return new Promise(res => {
        try {
          const r = indexedDB.open('ai-prompt-class', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('kv');
          r.onsuccess = () => { this.db = r.result; res(true); };
          r.onerror = () => res(false);
          r.onblocked = () => res(false);
        } catch (e) { res(false); }
      });
    },
    get(k) {
      if (!this.db) return Promise.resolve(this.mem[k]);
      return new Promise(res => {
        try { const r = this.db.transaction('kv', 'readonly').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); }
        catch (e) { res(undefined); }
      });
    },
    set(k, v) {
      if (!this.db) { this.mem[k] = v; return Promise.resolve(false); }
      return new Promise(res => {
        try { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); tx.onabort = () => res(false); }
        catch (e) { res(false); }
      });
    },
    del(k) {
      if (!this.db) { delete this.mem[k]; return Promise.resolve(true); }
      return new Promise(res => {
        try { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }
        catch (e) { res(false); }
      });
    }
  };

  /* ---------- 상태 ---------- */
  const isPresenter = /[?&]presenter\b/.test(location.search);
  let deck = null, media = {}, baseRev = '';
  let cur = 0, step = 0, mode = 'present';
  let selId = null, editingId = null, editTxt = null, editSnap = null, savedRange = null;
  let undoStack = [], redoStack = [], lastUndoAt = 0, lastUndoKey = '';
  let saveTimer = null, resetting = false;
  let elClipboard = null;
  const live = new Map();
  let presentStage = null, inkCanvas = null, laserEl = null;
  const ink = {};
  let tool = null, penColor = '#F04438', drawing = null, blankMode = null, jumpBuf = '';
  let gridEl = null, helpEl = null;
  let soundOn = true, actx = null;
  let presWin = null;

  // DOM
  let app, presentRoot, stageWrap, progressEl, toolbarEl, counterEl, jumpEl, blankEl, toastBox, overlayRoot, penBox;
  let editorRoot, edProps, edSide, edCanvas, edNotes, edSaveLbl, edStage = null, editNodes = new Map(), selBox = null;
  const modalStack = [];

  const curSlide = () => deck.slides[cur];
  const findEl = (id) => curSlide().elements.find(e => e.id === id);
  const resolveSrc = (src) => (src && src.indexOf('media:') === 0) ? (media[src.slice(6)] || '') : (src || '');
  const saveKey = () => 'save:' + deck.docId;
  function maxStepOf(s) { let m = 0; for (const e of s.elements) m = Math.max(m, (e.step || 0) + (e.steps || 0)); return m; }

  /* ---------- 효과음 (파일 없이 합성) ---------- */
  function sfx(name) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime;
      const tone = (f, s, d, type, v) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + s);
        g.gain.linearRampToValueAtTime(v || 0.12, t + s + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + s + d);
        o.connect(g); g.connect(actx.destination); o.start(t + s); o.stop(t + s + d + 0.05);
      };
      if (name === 'tick') tone(1300, 0, 0.035, 'square', 0.035);
      else if (name === 'pop') tone(700, 0, 0.14, 'triangle', 0.13);
      else if (name === 'unlock') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.28, 'triangle', 0.14));
      else if (name === 'win') [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.45, 'triangle', 0.13));
      else if (name === 'end') [0, 0.35, 0.7, 1.05].forEach(s => tone(880, s, 0.25, 'square', 0.1));
    } catch (e) { /* 소리 실패는 무시 */ }
  }
  function toggleSound() { soundOn = !soundOn; toast(soundOn ? '타이머·뽑기 효과음 켜짐' : '타이머·뽑기 효과음 꺼짐'); updateChrome(); }
  function toggleToolbar() {
    const hid = !presentRoot.classList.contains('tb-hidden');
    presentRoot.classList.toggle('tb-hidden', hid);
    try { localStorage.setItem('ai-class-tb-hidden', hid ? '1' : '0'); } catch (e) { }
    toast(hid ? '툴바와 진행 막대를 숨겼어요 · A 키를 누르면 다시 보여요' : '툴바를 다시 보이게 했어요', 2600);
  }

  /* ---------- 알림 · 모달 ---------- */
  function toast(msg, ms) {
    if (!toastBox) return;
    const t = h('div', { class: 'toast', text: msg });
    toastBox.appendChild(t);
    setTimeout(() => t.remove(), ms || 2200);
  }
  function modal(opts) {
    return new Promise(res => {
      const ov = h('div', { class: 'overlay' });
      const foot = h('div', { class: 'mf' });
      const entry = { ov, res };
      (opts.buttons || [{ label: '확인', value: true, cls: 'primary' }]).forEach(b => {
        foot.appendChild(h('button', {
          class: 'btn ' + (b.cls || ''), text: b.label, onclick: () => {
            if (b.validate && !b.validate()) return;
            const i = modalStack.indexOf(entry); if (i >= 0) modalStack.splice(i, 1);
            ov.remove(); res(b.value);
          }
        }));
      });
      const body = h('div', { class: 'mb' });
      if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
      ov.appendChild(h('div', { class: 'modal' }, h('h3', { text: opts.title || '' }), body, foot));
      overlayRoot.appendChild(ov);
      modalStack.push(entry);
      const first = body.querySelector('input,textarea,select'); if (first) setTimeout(() => first.focus(), 30);
    });
  }
  function closeTopModal() { const m = modalStack.pop(); if (m) { m.ov.remove(); m.res(null); } }
  const confirmBox = (title, body, okLabel, cls) => modal({ title, body, buttons: [{ label: '취소', value: false }, { label: okLabel || '확인', value: true, cls: cls || 'primary' }] });

  /* ---------- 요소 그리기 ---------- */
  function styleInner(inner, e) {
    const s = e.style || {}, st = inner.style;
    st.fontSize = (s.fs || 40) + 'px';
    if (s.fw) st.fontWeight = s.fw;
    st.color = s.color || INK;
    st.textAlign = s.align || 'left';
    st.lineHeight = s.lh || 1.35;
    if (s.ls) st.letterSpacing = s.ls;
    st.fontFamily = s.font === 'fun' ? FONT_FUN : FONT_MAIN;
    inner.classList.toggle('f-fun', s.font === 'fun');
    if (s.bg) st.background = s.bg;
    if (s.border) st.border = s.border;
    if (s.radius != null) st.borderRadius = typeof s.radius === 'number' ? s.radius + 'px' : s.radius;
    if (s.pad) st.padding = s.pad;
    if (s.shadow) st.boxShadow = s.shadow;
    st.justifyContent = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[s.valign || 'top'];
  }

  const Widgets = {
    text: {
      render(e, inner) {
        inner.classList.add('textbox');
        const txt = h('div', { class: 'txt' });
        txt.innerHTML = e.html || '';
        inner.appendChild(txt);
        return { txt };
      }
    },
    image: {
      render(e, inner, opts) {
        inner.classList.add('imgbox');
        const src = resolveSrc(e.src);
        const isFile = e.src && e.src.indexOf('media:') !== 0;
        const ph = () => h('div', { class: 'img-ph', html: `<div class="ph-ic">${ico('image')}</div><div>${esc(e.placeholder || '이미지 자리')}</div><div class="ph-hint">${isFile ? '<b>' + esc(e.src) + '</b> 파일을 넣으면 여기에 보여요' : '편집 모드에서 이 칸을 클릭하고 Ctrl+V로 붙여넣기'}${e.fallback || e.optional ? '<br>(없으면 발표 화면에서는 ' + (e.fallback ? '아이콘으로' : '안') + ' 보여요)' : ''}</div>` });
        // 그림 파일이 없을 때: 편집 모드는 자리표시, 발표 모드는 아이콘(fallback) 또는 숨김(optional)
        const missing = () => {
          inner.innerHTML = '';
          if (opts.mode !== 'edit' && e.fallback) {
            inner.classList.add('img-fb');
            inner.style.justifyContent = 'center';
            inner.style.fontSize = Math.round(Math.min(e.w, e.h) * 0.3) + 'px';
            inner.innerHTML = `<span class="ico-badge" style="--c:${esc(e.fallbackColor || '#2F7BFF')}">${ico(e.fallback)}</span>`;
          } else if (opts.mode !== 'edit' && e.optional) {
            inner.style.visibility = 'hidden';
          } else { inner.classList.add('img-missing'); inner.appendChild(ph()); }
        };
        if (src) {
          const img = h('img', { src, draggable: 'false', alt: '' });
          img.style.objectFit = e.fit || 'contain';
          img.addEventListener('error', missing);
          inner.appendChild(img);
        } else missing();
        return {};
      }
    },
    video: {
      config: true,
      render(e, inner, opts) {
        inner.classList.add('vidbox');
        if (opts.mode === 'thumb') {
          inner.appendChild(h('div', { class: 'vid-ph', html: `<div class="ph-ic">${ico('play')}</div><div>${esc(e.label || e.src || '영상')}</div>` }));
          return {};
        }
        const v = h('video', { src: e.src, controls: true, preload: 'metadata', playsinline: true });
        v.addEventListener('error', () => {
          inner.innerHTML = '';
          inner.appendChild(h('div', { class: 'vid-ph err', html: `<div class="ph-ic">${ico('alert')}</div><div>영상 파일을 찾을 수 없어요</div><div class="ph-hint">이 HTML 파일과 같은 폴더에 <b>${esc(e.src)}</b> 파일이 있어야 해요</div>` }));
        });
        inner.appendChild(v);
        return { video: v };
      }
    },
    chat: {
      config: true,
      render(e, inner) {
        inner.classList.add('chat');
        const c = e.config || {};
        const body = h('div', { class: 'chat-body' });
        const msgs = (c.messages || []).map(m => {
          const row = h('div', { class: 'msg ' + (m.who === 'ai' ? 'ai' : 'me') });
          if (m.who === 'ai') row.appendChild(h('div', { class: 'avatar', html: ico('sparkle') }));
          let html;
          if (m.type === 'doc') html = `<div class="doc-paper"><div class="doc-title">${esc(m.text).replace(/\n/g, '<br>')}</div><i></i><i></i><i></i><i></i><i></i></div><div class="doc-cap">${ico('camera')} 사진</div>`;
          else html = esc(m.text).replace(/\n/g, '<br>');
          const b = h('div', { class: 'bubble' + (m.type === 'doc' ? ' doc' : ''), html });
          row.appendChild(b); body.appendChild(row);
          return { row, b, m, html };
        });
        inner.append(
          h('div', { class: 'chat-head', html: `<span class="chat-dot"></span>${esc(c.title || 'AI 채팅')}` }),
          body,
          h('div', { class: 'chat-input', html: '<span>메시지 입력…</span><b>➤</b>' })
        );
        return {
          update(k, animate) {
            msgs.forEach((x, i) => {
              const vis = i < k, was = !x.row.classList.contains('off');
              x.row.classList.toggle('off', !vis);
              clearTimeout(x.t);
              if (!vis) { x.b.innerHTML = x.html; return; }
              if (!was && animate) {
                x.row.classList.remove('in'); void x.row.offsetWidth; x.row.classList.add('in');
                if (x.m.who === 'ai') { x.b.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; x.t = setTimeout(() => { x.b.innerHTML = x.html; }, 950); }
              } else x.b.innerHTML = x.html;
            });
          }
        };
      }
    },
    autocomplete: {
      config: true,
      render(e, inner) {
        inner.classList.add('ac');
        const c = e.config || {};
        const words = c.words || [];
        const pool = (c.pool && c.pool.length) ? c.pool : ['그리고', '나는', '근데', '너무', '우리', 'ㅋㅋ'];
        const textSpan = h('span', { class: 'ac-text' });
        const field = h('div', { class: 'ac-field' }, textSpan, h('span', { class: 'ac-caret' }));
        const bar = h('div', { class: 'ac-bar' });
        const chips = [0, 1, 2].map(() => bar.appendChild(h('div', { class: 'ac-chip' })));
        const kb = h('div', { class: 'ac-kb' });
        ['ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ', 'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ', 'ㅋㅌㅊㅍㅠㅜㅡ'].forEach(row => {
          const r = h('div', { class: 'ac-row' }); for (const ch of row) r.appendChild(h('span', { text: ch })); kb.appendChild(r);
        });
        inner.append(field, bar, kb);
        let timer = null;
        const sugg = (i) => {
          const w = words[i]; if (w == null) return ['', '', ''];
          let a = pool[(i * 3 + 1) % pool.length], b = pool[(i * 7 + 4) % pool.length];
          if (a === w) a = pool[(i + 2) % pool.length];
          if (b === w || b === a) b = pool[(i + 5) % pool.length];
          return [a, w, b];
        };
        const setState = (n, pick) => {
          textSpan.textContent = words.slice(0, n).join(' ');
          const s = sugg(n);
          chips.forEach((ch, j) => { ch.textContent = s[j]; ch.classList.toggle('pick', !!pick && j === 1); });
        };
        return {
          update(k, animate) {
            clearTimeout(timer);
            if (k <= 0) { setState(0, false); return; }
            if (!animate) { setState(words.length, false); return; }
            let n = 0; setState(0, false);
            const tick = () => {
              if (n >= words.length) return;
              chips[1].classList.add('pick');
              timer = setTimeout(() => { n++; setState(n, false); timer = setTimeout(tick, 240); }, 300);
            };
            timer = setTimeout(tick, 250);
          },
          destroy() { clearTimeout(timer); }
        };
      }
    },
    ingredients: {
      config: true,
      render(e, inner) {
        inner.classList.add('ing');
        const c = e.config || {}, items = c.items || [], unlock = c.unlock || [];
        const tiles = items.map(it => {
          const icon = ICONS[it.icon] ? ico(it.icon) : esc(it.icon || '');
          const t = h('div', { class: 'ing-tile' + (it.bonus ? ' bonus' : ''), html: `<div class="ing-badge"><span class="ing-ic">${icon}</span><span class="ing-lock">${ico('lock')}</span></div><div class="ing-name">${esc(it.name)}</div><div class="ing-label">${esc(it.label || '')}</div><div class="ing-burst"></div>` });
          t.style.setProperty('--c', it.color || '#FF7A1A');
          if (it.img) {
            // 이미지 파일이 있으면 아이콘 대신 그림으로
            const im = h('img', { class: 'ing-img', src: it.img, alt: '', draggable: 'false' });
            im.addEventListener('load', () => t.classList.add('has-img'));
            t.querySelector('.ing-badge').appendChild(im);
          }
          inner.appendChild(t); return t;
        });
        return {
          update(k, animate) {
            items.forEach((it, i) => {
              const idx = unlock.indexOf(i);
              const open = !!it.open || (idx >= 0 && idx < k);
              const was = tiles[i].classList.contains('open');
              tiles[i].classList.toggle('open', open);
              if (open && !was && animate) { tiles[i].classList.remove('unlocking'); void tiles[i].offsetWidth; tiles[i].classList.add('unlocking'); }
            });
          }
        };
      }
    },
    // 챕터 전환: 색 띠가 휩쓸고, 글자가 떨어지고, 도형이 튀어나오는 모션 그래픽
    chapter: {
      config: true,
      render(e, inner, opts) {
        const c = e.config || {};
        inner.classList.add('chapter');
        inner.style.color = '#FFFFFF';
        if (opts.mode !== 'present') inner.classList.add('static');
        inner.style.setProperty('--c1', c.color || '#2F7BFF');
        inner.style.setProperty('--c2', c.accent || '#FFC21A');
        const stripeColors = c.stripes || ['#FFC21A', '#FF4D8D', '#FF7A1A', '#FFFFFF', c.color || '#2F7BFF'];
        const stripes = stripeColors.map((col, i) => `<i style="background:${col};animation-delay:${i * 70}ms"></i>`).join('');
        let li = 0;
        const title = esc(c.title || '').split(' ').map(w => '<span class="wd">' + Array.from(w).map(ch => `<span class="ch-l" style="animation-delay:${900 + (li++) * 55}ms">${ch}</span>`).join('') + '</span>').join(' ');
        const shapes = [
          { k: 'ring', x: 1280, y: 120, s: 150, d: 0, col: '#FFFFFF' }, { k: 'spark', x: 1650, y: 220, s: 110, d: 80, col: c.accent || '#FFC21A' },
          { k: 'dot', x: 1480, y: 840, s: 70, d: 160, col: '#FF4D8D' }, { k: 'spark', x: 980, y: 820, s: 80, d: 240, col: '#FFFFFF' },
          { k: 'ring', x: 120, y: 860, s: 120, d: 320, col: c.accent || '#FFC21A' }, { k: 'dot', x: 760, y: 110, s: 46, d: 400, col: '#FFFFFF' },
          { k: 'squig', x: 1700, y: 600, s: 160, d: 200, col: '#FFFFFF' }, { k: 'spark', x: 300, y: 140, s: 64, d: 460, col: '#FF7A1A' }
        ].map((s, i) => {
          let inside = '';
          if (s.k === 'spark') inside = ico('sparkle');
          else if (s.k === 'squig') inside = '<svg viewBox="0 0 60 20" class="ico" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M3 10c6-9 12-9 18 0s12 9 18 0 12-9 18 0"/></svg>';
          return `<div class="ch-shape ch-${s.k}" style="left:${s.x}px;top:${s.y}px;width:${s.s}px;height:${s.s}px;color:${s.col};--d:${1000 + s.d}ms;--fd:${3.6 + (i % 3) * 0.8}s">${inside}</div>`;
        }).join('');
        const confetti = Array.from({ length: 34 }, (_, i) => {
          const ang = (i / 34) * Math.PI * 2 + (i % 2) * 0.2, dist = 420 + (i * 97) % 380;
          const cols = ['#FFC21A', '#FF4D8D', '#FFFFFF', '#17B26A', '#FF7A1A', '#8A5CFF'];
          return `<i style="--dx:${Math.round(Math.cos(ang) * dist)}px;--dy:${Math.round(Math.sin(ang) * dist * 0.75)}px;--rot:${(i * 47) % 360}deg;background:${cols[i % cols.length]};animation-delay:${1050 + (i % 6) * 25}ms"></i>`;
        }).join('');
        inner.innerHTML = `<div class="ch-burst"></div><div class="ch-num">${esc(c.num || '')}</div><div class="ch-shapes">${shapes}</div>
          <div class="ch-text"><div class="ch-part">${esc(c.part || '')}</div><div class="ch-title">${title}</div><div class="ch-sub">${esc(c.sub || '')}</div></div>
          <div class="ch-confetti">${confetti}</div><div class="ch-stripes">${stripes}</div>`;
        return {};
      }
    },
    qr: {
      config: true,
      render(e, inner) {
        inner.classList.add('qrbox');
        inner.appendChild(h('div', { class: 'qr-ph', html: `<div class="ph-ic">${ico('qr')}</div><div>${esc((e.config && e.config.label) || 'QR 코드')}</div><div class="ph-hint">제출 페이지를 연결하면 여기에 QR이 생겨요</div>` }));
        return {};
      }
    }
  };

  function renderEl(e, opts) {
    const node = h('div', { class: 'el el-' + e.type, 'data-id': e.id });
    node.style.cssText = `left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;z-index:${(e.z || 0) + 10};` +
      (e.rot ? `transform:rotate(${e.rot}deg);` : '') + (e.opacity != null ? `opacity:${e.opacity};` : '');
    const inner = h('div', { class: 'el-in' });
    node.appendChild(inner);
    styleInner(inner, e);
    const Wd = Widgets[e.type] || Widgets.text;
    const widget = Wd.render(e, inner, opts) || {};
    return { e, node, inner, widget, hidden: false, lastK: undefined };
  }

  function makeStage(slide, opts) {
    const stage = h('div', { class: 'stage' });
    const bg = slide.bg || 'cream';
    stage.style.backgroundColor = BG[bg] || bg;
    if (bg === 'cream' || bg === 'white') stage.classList.add('dots');
    const nodes = new Map();
    for (const e of slide.elements) { const r = renderEl(e, opts); stage.appendChild(r.node); nodes.set(e.id, r); }
    return { stage, nodes };
  }

  function fitStage(wrap, stage) {
    const r = wrap.getBoundingClientRect();
    const s = Math.max(0.05, Math.min(r.width / W, r.height / H));
    stage.style.transform = `translate(${(r.width - W * s) / 2}px, ${(r.height - H * s) / 2}px) scale(${s})`;
    stage._scale = s;
    stage.style.setProperty('--inv', String(1 / s));
    return s;
  }

  // 작은 미리보기 (stepVal이 있으면 그 클릭 상태로)
  function makeThumb(slide, width, stepVal) {
    const box = h('div', { class: 'thumb' });
    box.style.width = width + 'px'; box.style.height = Math.round(width * H / W) + 'px';
    const { stage, nodes } = makeStage(slide, { mode: 'thumb' });
    nodes.forEach(r => {
      const e = r.e, s = e.step || 0;
      if (stepVal != null && stepVal < s) { r.node.classList.add('pending'); if (r.widget.update) r.widget.update(0, false); return; }
      if (r.widget.update) r.widget.update(stepVal != null ? clamp(stepVal - s, 0, e.steps || 0) : (e.steps || 0), false);
    });
    stage.style.transform = `scale(${width / W})`;
    box.appendChild(stage);
    return box;
  }

  /* ---------- 등장 효과 ---------- */
  function clearAnim(r) {
    r.inner.className = r.inner.className.replace(/\ba-\w+/g, '').replace(/\s+/g, ' ').trim();
    r.inner.style.animationDelay = '';
    const txt = r.widget.txt;
    if (txt && (txt._tt || txt._letters)) { clearTimeout(txt._tt); txt._tt = null; txt._letters = false; txt.innerHTML = r.e.html || ''; }
  }
  // 글자를 한 자씩 튀어 오르게 (단어는 줄바꿈 때 쪼개지지 않게 묶음)
  function letterize(txt, delay) {
    const nodes = [];
    const walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT);
    let n; while ((n = walker.nextNode())) nodes.push(n);
    let i = 0;
    nodes.forEach(node => {
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const wd = document.createElement('span'); wd.className = 'wd';
        Array.from(part).forEach(ch => {
          const s = document.createElement('span'); s.className = 'ltr'; s.textContent = ch;
          s.style.animationDelay = ((delay || 0) + (i++) * 40) + 'ms'; wd.appendChild(s);
        });
        frag.appendChild(wd);
      });
      node.parentNode.replaceChild(frag, node);
    });
    txt._letters = true;
  }
  function playAnim(r, delay) {
    const a = r.e.anim; if (!a) return;
    clearAnim(r);
    if (a === 'type' && r.widget.txt) { typewrite(r.widget.txt, delay); return; }
    if (a === 'letters' && r.widget.txt) { letterize(r.widget.txt, delay); return; }
    void r.inner.offsetWidth;
    r.inner.style.animationDelay = (delay || 0) + 'ms';
    r.inner.classList.add('a-' + (a === 'type' || a === 'letters' ? 'fade' : a));
  }
  function typewrite(txt, delay) {
    const parts = [];
    const walker = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT);
    let n; while ((n = walker.nextNode())) { parts.push([n, n.nodeValue]); n.nodeValue = ''; }
    const total = parts.reduce((a, p) => a + p[1].length, 0);
    const speed = clamp(1600 / Math.max(total, 1), 16, 55);
    let i = 0, j = 0;
    const tick = () => {
      if (i >= parts.length) { txt._tt = null; return; }
      const [node, full] = parts[i];
      j++; node.nodeValue = full.slice(0, j);
      if (j >= full.length) { i++; j = 0; }
      txt._tt = setTimeout(tick, speed);
    };
    clearTimeout(txt._tt); txt._tt = setTimeout(tick, delay || 0);
  }

  /* ---------- 발표 모드 ---------- */
  function applyStep(animate, entry) {
    for (const r of live.values()) {
      const e = r.e, s = e.step || 0, n = e.steps || 0;
      const vis = step >= s;
      if (vis) {
        if (r.hidden || entry) {
          r.node.classList.remove('pending');
          if (animate && r.hidden) playAnim(r, s === step ? (e.delay || 0) : 0);
          else if (entry && s === 0 && e.anim) playAnim(r, e.delay || 0);
          else if (!animate) clearAnim(r);
        }
        r.hidden = false;
      } else {
        r.node.classList.add('pending'); r.hidden = true; clearAnim(r);
      }
      if (r.widget.update) {
        const k = vis ? clamp(step - s, 0, n) : 0;
        if (r.lastK !== k) { r.widget.update(k, !!animate && r.lastK != null && k > r.lastK); r.lastK = k; }
      }
    }
  }

  function renderPresent(animateEntry) {
    live.forEach(r => r.widget.destroy && r.widget.destroy());
    live.clear();
    const { stage, nodes } = makeStage(curSlide(), { mode: 'present' });
    nodes.forEach((r, id) => { r.hidden = true; live.set(id, r); });
    inkCanvas = h('canvas', { class: 'ink', width: W, height: H });
    laserEl = h('div', { class: 'laser' });
    stage.append(inkCanvas, laserEl);
    bindInk(inkCanvas, stage);
    stageWrap.innerHTML = '';
    stageWrap.appendChild(stage);
    presentStage = stage;
    fitStage(stageWrap, stage);
    applyStep(false, !!animateEntry);
    if (animateEntry) stage.classList.add('enter');
    redrawInk();
    updateChrome();
  }

  function visibleIndex(from, dir) {
    let i = from + dir;
    while (i >= 0 && i < deck.slides.length && deck.slides[i].hidden) i += dir;
    return (i >= 0 && i < deck.slides.length) ? i : -1;
  }
  function firstVisible() { const i = visibleIndex(-1, 1); return i < 0 ? 0 : i; }

  function next() {
    if (step < maxStepOf(curSlide())) { step++; applyStep(true, false); updateChrome(); syncPresenter(); return; }
    const i = visibleIndex(cur, 1);
    if (i >= 0) goSlide(i, 0, true); else toast('마지막 슬라이드예요');
  }
  function prev() {
    if (step > 0) { step--; applyStep(false, false); updateChrome(); syncPresenter(); return; }
    const i = visibleIndex(cur, -1);
    if (i >= 0) goSlide(i, 'end', false);
  }
  function goSlide(i, st, animate) {
    cur = clamp(i, 0, deck.slides.length - 1);
    step = st === 'end' ? maxStepOf(curSlide()) : (st || 0);
    if (mode === 'present') renderPresent(!!animate); else renderEditor();
    syncPresenter();
  }

  function buildPresent() {
    presentRoot = h('div', { id: 'present' });
    stageWrap = h('div', { class: 'stage-wrap' });
    progressEl = h('div', { class: 'progress' });
    jumpEl = h('div', { class: 'jump hidden' });
    blankEl = h('div', { class: 'blank hidden' });
    toolbarEl = buildToolbar();
    presentRoot.append(stageWrap, progressEl, jumpEl, blankEl, toolbarEl, Timer.build());
    stageWrap.addEventListener('click', ev => {
      if (mode !== 'present' || tool) return;
      if (ev.target.closest('video,button,a,input,textarea,select,.no-advance')) return;
      next();
    });
    blankEl.addEventListener('click', () => setBlank(null));
    // 툴바: 마우스가 화면 아래쪽에 올 때만 나타나고, A 키로 완전히 숨길 수 있어요
    let idleT = null, curT = null;
    const hideBar = () => { if (!toolbarEl.matches(':hover')) toolbarEl.classList.add('idle'); };
    const onMove = (ev) => {
      presentRoot.classList.remove('idle-cursor');
      clearTimeout(curT);
      curT = setTimeout(() => { if (!tool) presentRoot.classList.add('idle-cursor'); }, 2200);
      const nearBottom = ev && ev.clientY > window.innerHeight - 150;
      if (nearBottom || toolbarEl.matches(':hover')) {
        toolbarEl.classList.remove('idle');
        clearTimeout(idleT); idleT = setTimeout(hideBar, 2200);
      } else if (!toolbarEl.classList.contains('idle')) {
        clearTimeout(idleT); idleT = setTimeout(hideBar, 700);
      }
    };
    presentRoot.addEventListener('mousemove', onMove);
    toolbarEl.classList.add('idle');
    try { if (localStorage.getItem('ai-class-tb-hidden') === '1') presentRoot.classList.add('tb-hidden'); } catch (e) { }
    return presentRoot;
  }

  function buildToolbar() {
    const tb = h('div', { class: 'toolbar' });
    const B = (icon, title, fn, key) => {
      const b = h('button', { class: 'tb', title, html: ICONS[icon] ? ico(icon) : icon, onclick: ev => { ev.stopPropagation(); fn(); } });
      if (key) b.dataset.k = key;
      return b;
    };
    const sep = () => h('span', { class: 'tb-sep' });
    counterEl = h('button', { class: 'tb counter', title: '전체 슬라이드 보기 (G)', onclick: ev => { ev.stopPropagation(); toggleGrid(); } });
    penBox = h('span', { class: 'pen-box hidden', style: { display: 'flex', alignItems: 'center' } });
    ['#F04438', '#2F7BFF', '#1C2340', '#17B26A'].forEach(c => {
      const sw = h('span', { class: 'pen-sw', title: '펜 색', style: { background: c }, onclick: ev => { ev.stopPropagation(); penColor = c; setTool('pen'); } });
      sw.dataset.c = c; penBox.appendChild(sw);
    });
    tb.append(
      B('left', '이전 (←)', prev), counterEl, B('right', '다음 (→, Space)', next), sep(),
      B('expand', '전체화면 (F)', toggleFullscreen, 'fs'), B('timer', '타이머 (T)', () => Timer.toggle(), 'timer'), B('dice', '랜덤 뽑기 (R)', () => Picker.open(), 'picker'), sep(),
      B('pencil', '펜 (P)', () => setTool(tool === 'pen' ? null : 'pen'), 'pen'), penBox,
      B('highlighter', '형광펜 (H)', () => setTool(tool === 'hl' ? null : 'hl'), 'hl'),
      B('laser', '레이저 포인터 (L)', () => setTool(tool === 'laser' ? null : 'laser'), 'laser'),
      B('eraser', '판서 지우기 (X)', clearInk), sep(),
      B('screenoff', '화면 가리기 (B / W)', () => setBlank('black')), B('layout', '전체 슬라이드 (G)', toggleGrid),
      B('monitor', '발표자 화면 열기 (S)', openPresenter), B('sound', '타이머·뽑기 효과음 켜기/끄기 (M)', toggleSound, 'snd'), sep(),
      B(ico('pencil') + '<span class="lbl">편집</span>', '편집 모드 (E)', enterEdit), B('question', '도움말 (?)', toggleHelp),
      B('eyeoff', '툴바 숨기기 (A) · 다시 보려면 A 키', () => toggleToolbar())
    );
    tb.addEventListener('click', ev => ev.stopPropagation());
    return tb;
  }

  function updateChrome() {
    if (!deck || !counterEl) return;
    const N = deck.slides.length;
    counterEl.textContent = `${cur + 1} / ${N}`;
    progressEl.style.width = (N > 1 ? (cur / (N - 1)) * 100 : 100) + '%';
    toolbarEl.querySelectorAll('[data-k]').forEach(b => {
      const k = b.dataset.k;
      b.classList.toggle('on', (k === tool) || (k === 'timer' && Timer.visible) || (k === 'fs' && !!document.fullscreenElement));
      if (k === 'snd') b.innerHTML = ico(soundOn ? 'sound' : 'mute');
    });
    penBox.classList.toggle('hidden', tool !== 'pen');
    penBox.querySelectorAll('.pen-sw').forEach(s => s.classList.toggle('on', s.dataset.c === penColor));
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) (document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen() : Promise.reject()).catch(() => toast('전체화면을 열 수 없어요'));
    else document.exitFullscreen();
  }

  function setBlank(kind) {
    blankMode = kind;
    blankEl.className = 'blank ' + (kind ? kind : 'hidden');
  }

  /* ---------- 판서 · 레이저 ---------- */
  function setTool(t) {
    tool = t;
    presentRoot.classList.toggle('tool-on', !!t);
    presentRoot.dataset.tool = t || '';
    if (laserEl) laserEl.classList.remove('show');
    updateChrome();
  }
  function bindInk(canvas, stage) {
    const toStage = ev => { const r = stage.getBoundingClientRect(); const s = r.width / W; return [(ev.clientX - r.left) / s, (ev.clientY - r.top) / s]; };
    canvas.addEventListener('pointerdown', ev => {
      if (tool !== 'pen' && tool !== 'hl') return;
      ev.preventDefault(); ev.stopPropagation();
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { }
      const sid = curSlide().id;
      drawing = { t: tool, c: tool === 'hl' ? '#FFE500' : penColor, w: tool === 'hl' ? 38 : 7, p: [toStage(ev)] };
      (ink[sid] = ink[sid] || []).push(drawing);
      redrawInk();
    });
    canvas.addEventListener('pointermove', ev => {
      const p = toStage(ev);
      if (tool === 'laser') { laserEl.style.left = p[0] + 'px'; laserEl.style.top = p[1] + 'px'; laserEl.classList.add('show'); }
      if (!drawing) return;
      drawing.p.push(p); redrawInk();
    });
    const end = () => { drawing = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => laserEl && laserEl.classList.remove('show'));
    canvas.addEventListener('click', ev => ev.stopPropagation());
  }
  function redrawInk() {
    if (!inkCanvas || !deck) return;
    const ctx = inkCanvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    (ink[curSlide().id] || []).forEach(s => {
      ctx.save();
      ctx.globalAlpha = s.t === 'hl' ? 0.38 : 1;
      ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      s.p.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]));
      if (s.p.length === 1) ctx.lineTo(s.p[0][0] + 0.1, s.p[0][1]);
      ctx.stroke(); ctx.restore();
    });
  }
  function clearInk() { delete ink[curSlide().id]; redrawInk(); }

  /* ---------- 전체 보기 · 도움말 ---------- */
  function toggleGrid() {
    if (gridEl) { gridEl.remove(); gridEl = null; return; }
    gridEl = h('div', { class: 'overlay', onclick: ev => { if (ev.target === gridEl || ev.target.classList.contains('grid')) toggleGrid(); } });
    const g = h('div', { class: 'grid' });
    deck.slides.forEach((s, i) => {
      g.appendChild(h('div', {
        class: 'grid-item' + (i === cur ? ' cur' : '') + (s.hidden ? ' is-hidden' : ''),
        onclick: () => { toggleGrid(); if (mode === 'present') goSlide(i, 0, true); else { cur = i; renderEditor(); } }
      }, makeThumb(s, 280), h('div', { class: 'grid-num', text: (i + 1) + (s.hidden ? ' · 숨김' : '') })));
    });
    gridEl.appendChild(g);
    (mode === 'present' ? presentRoot : overlayRoot).appendChild(gridEl);
  }

  function toggleHelp() {
    if (helpEl) { helpEl.remove(); helpEl = null; return; }
    const row = (k, d) => `<tr><td>${k}</td><td>${d}</td></tr>`;
    helpEl = h('div', { class: 'overlay', onclick: ev => { if (ev.target === helpEl) toggleHelp(); } },
      h('div', {
        class: 'help', html: `<h2>사용법</h2>
        <div class="cols"><div><h3>발표할 때</h3><div class="muted" style="margin-bottom:6px">툴바는 마우스를 화면 아래쪽으로 가져가면 나타나요.</div><table>
        ${row('<kbd>→</kbd><kbd>Space</kbd><kbd>PageDown</kbd> 또는 클릭', '다음')}
        ${row('<kbd>←</kbd><kbd>PageUp</kbd><kbd>Backspace</kbd>', '이전')}
        ${row('숫자 + <kbd>Enter</kbd>', '그 번호 슬라이드로 바로 이동')}
        ${row('<kbd>Home</kbd> / <kbd>End</kbd>', '처음 / 마지막')}
        ${row('<kbd>F</kbd>', '전체화면')}
        ${row('<kbd>G</kbd>', '전체 슬라이드 한눈에 보기')}
        ${row('<kbd>B</kbd> / <kbd>W</kbd>', '화면 가리기 (검정 / 흰색)')}
        ${row('<kbd>T</kbd>', '타이머 (시간 숫자를 클릭하면 직접 입력)')}
        ${row('<kbd>R</kbd>', '랜덤 뽑기')}
        ${row('<kbd>P</kbd> / <kbd>H</kbd> / <kbd>L</kbd>', '펜 / 형광펜 / 레이저 포인터')}
        ${row('<kbd>X</kbd>', '판서 지우기')}
        ${row('<kbd>S</kbd>', '발표자 화면 (모니터 2개일 때)')}
        ${row('<kbd>A</kbd>', '툴바·진행 막대 완전히 숨기기 / 다시 보이기')}
        ${row('<kbd>M</kbd>', '타이머·뽑기 효과음 켜기/끄기')}
        ${row('<kbd>F5</kbd> / <kbd>Shift</kbd>+<kbd>F5</kbd>', '처음부터 / 지금 슬라이드부터 발표')}
        ${row('<kbd>E</kbd>', '편집 모드')}
        ${row('<kbd>Esc</kbd>', '도구·창 닫기')}
        </table></div><div><h3>편집할 때</h3><table>
        ${row('클릭 · 드래그', '선택 · 옮기기 (가운데에 맞추면 분홍 선)')}
        ${row('모서리 끌기', '크기 조절 (<kbd>Shift</kbd>: 비율 유지)')}
        ${row('더블클릭 / <kbd>Enter</kbd>', '글자 고치기 (위젯은 내용 편집)')}
        ${row('<kbd>Ctrl</kbd>+<kbd>V</kbd>', '이미지·글 붙여넣기 (이미지 칸을 선택하면 교체)')}
        ${row('이미지 파일 끌어다 놓기', '이미지 추가')}
        ${row('<kbd>Delete</kbd>', '삭제')}
        ${row('<kbd>Ctrl</kbd>+<kbd>D</kbd> / <kbd>Ctrl</kbd>+<kbd>C</kbd>·<kbd>V</kbd>', '복제 / 복사·붙여넣기')}
        ${row('<kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd>', '되돌리기 / 다시 하기')}
        ${row('방향키', '1px 이동 (<kbd>Shift</kbd>: 10px)')}
        ${row('<kbd>PageUp</kbd> / <kbd>PageDown</kbd>', '이전 / 다음 슬라이드')}
        ${row('왼쪽 목록 끌기', '슬라이드 순서 바꾸기')}
        ${row('등장 · 효과', '클릭할 때 나타나는 순서와 애니메이션')}
        </table>
        <h3>저장</h3><div>편집 내용은 <b>이 컴퓨터 브라우저에 자동 저장</b>돼요.<br>다른 컴퓨터로 옮길 때는 <b>HTML로 내보내기</b>를 누르고, 내보낸 파일을 <b>영상 파일 2개와 같은 폴더</b>에 두세요.</div>
        </div></div>`
      }));
    (mode === 'present' ? presentRoot : overlayRoot).appendChild(helpEl);
  }

  /* ---------- 타이머 ---------- */
  const Timer = {
    el: null, disp: null, playBtn: null, dur: 300, remain: 300000, running: false, endAt: 0, done: false, visible: false, big: false, iv: null,
    build() {
      const el = h('div', { class: 'timer hidden' });
      const head = h('div', { class: 'timer-head' }, h('span', { html: ico('timer') + ' 타이머' }),
        h('span', {}, h('button', { class: 'tlink', text: '크게/작게', onclick: () => this.toggleBig() }), h('button', { class: 'tlink', text: '✕', title: '닫기 (T)', onclick: () => this.hide() })));
      this.disp = h('div', { class: 'timer-disp', title: '클릭해서 시간 직접 입력', onclick: () => this.editTime() });
      const r1 = h('div', { class: 'timer-row' });
      [1, 3, 5, 10].forEach(m => r1.appendChild(h('button', { text: m + '분', onclick: () => this.set(m * 60) })));
      this.playBtn = h('button', { class: 'primary', onclick: () => (this.running ? this.pause() : this.start()) });
      const r2 = h('div', { class: 'timer-row' },
        h('button', { text: '−30초', onclick: () => this.add(-30) }), this.playBtn,
        h('button', { text: '+30초', onclick: () => this.add(30) }), h('button', { text: '↺ 처음으로', onclick: () => this.reset() }));
      el.append(head, this.disp, r1, r2);
      head.addEventListener('pointerdown', ev => {
        if (ev.target.closest('button') || this.big) return;
        const r = el.getBoundingClientRect(), ox = ev.clientX - r.left, oy = ev.clientY - r.top;
        const mm = m => { el.style.left = (m.clientX - ox) + 'px'; el.style.top = (m.clientY - oy) + 'px'; el.style.right = 'auto'; };
        const mu = () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu); };
        window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu);
      });
      el.addEventListener('click', ev => ev.stopPropagation());
      this.el = el; this.paint();
      return el;
    },
    toggle() { this.visible ? this.hide() : this.show(); },
    show() { this.visible = true; this.el.classList.remove('hidden'); this.paint(); updateChrome(); },
    hide() { this.visible = false; this.el.classList.add('hidden'); updateChrome(); },
    toggleBig() { this.big = !this.big; this.el.classList.toggle('big', this.big); },
    set(sec) { this.dur = Math.max(1, sec); this.remain = this.dur * 1000; this.running = false; this.done = false; this.stopLoop(); this.paint(); syncPresenter(); },
    start() {
      if (this.remain <= 0) this.remain = this.dur * 1000;
      this.endAt = Date.now() + this.remain; this.running = true; this.done = false;
      this.stopLoop(); this.iv = setInterval(() => this.tick(), 200);
      this.paint(); syncPresenter();
    },
    pause() { this.remain = Math.max(0, this.endAt - Date.now()); this.running = false; this.stopLoop(); this.paint(); syncPresenter(); },
    reset() { this.running = false; this.done = false; this.remain = this.dur * 1000; this.stopLoop(); this.paint(); syncPresenter(); },
    add(sec) {
      if (this.running) this.endAt += sec * 1000; else this.remain = Math.max(0, this.remain + sec * 1000);
      if (this.done && sec > 0 && !this.running) this.done = false;
      this.paint(); syncPresenter();
    },
    stopLoop() { clearInterval(this.iv); this.iv = null; },
    tick() {
      if (!this.running) return;
      this.remain = this.endAt - Date.now();
      if (this.remain <= 0) { this.remain = 0; this.running = false; this.done = true; this.stopLoop(); sfx('end'); syncPresenter(); }
      this.paint();
    },
    fmt(ms) { const t = Math.ceil(Math.max(0, ms) / 1000); return Math.floor(t / 60) + ':' + pad2(t % 60); },
    paint() {
      if (!this.disp || this.disp.querySelector('input')) return;
      this.disp.textContent = this.done ? '끝!' : this.fmt(this.remain);
      this.el.classList.toggle('warn', this.running && this.remain <= 10000);
      this.el.classList.toggle('done', this.done);
      this.playBtn.textContent = this.running ? '⏸ 멈춤' : '▶ 시작';
    },
    editTime() {
      if (this.disp.querySelector('input')) return;
      const inp = h('input', { type: 'text', value: this.fmt(this.dur * 1000) });
      this.disp.textContent = ''; this.disp.appendChild(inp); inp.focus(); inp.select();
      const done = (ok) => {
        if (!inp.isConnected) return;
        const v = inp.value.trim(); inp.remove();
        if (ok && v) {
          let sec = 0;
          if (v.indexOf(':') >= 0) { const [m, s] = v.split(':'); sec = (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0); }
          else sec = Math.round(parseFloat(v) * 60) || 0;
          if (sec > 0) { this.set(sec); return; }
        }
        this.paint();
      };
      inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
    },
    state() { return { remain: this.remain, running: this.running, done: this.done, endAt: this.endAt }; },
    cmd(c) { if (c === 'toggle') { this.show(); this.running ? this.pause() : this.start(); } else if (c === 'reset') this.reset(); }
  };

  /* ---------- 랜덤 뽑기 ---------- */
  const Picker = {
    el: null, disp: null, ta: null, histBox: null, removeChk: null, hist: [], spinning: false,
    isOpen() { return !!this.el; },
    items() { return this.ta.value.split('\n').map(s => s.trim()).filter(Boolean); },
    open() {
      if (this.el) return;
      const st = deck.settings || (deck.settings = {});
      const presets = st.pickerPresets || {};
      this.disp = h('div', { class: 'pk-disp', text: '?' });
      this.histBox = h('div', { class: 'pk-hist' });
      this.ta = h('textarea', { spellcheck: 'false' });
      this.ta.value = st.pickerList || '1반\n2반\n3반\n4반\n5반';
      this.ta.addEventListener('input', () => { st.pickerList = this.ta.value; scheduleSave(); });
      this.removeChk = h('input', { type: 'checkbox' });
      const pre = h('div', { class: 'pk-presets' });
      Object.keys(presets).forEach(name => pre.appendChild(h('button', { text: name, onclick: () => { this.ta.value = presets[name]; st.pickerList = this.ta.value; scheduleSave(); } })));
      const box = h('div', { class: 'picker' },
        h('div', { class: 'pk-main' }, h('div', { class: 'pk-title', html: ico('dice') + ' 랜덤 뽑기' }), this.disp,
          h('button', { class: 'pk-btn', text: '뽑기!', onclick: () => this.spin() }), this.histBox),
        h('div', { class: 'pk-side' }, h('button', { class: 'pk-close', text: '✕ 닫기 (Esc)', onclick: () => this.close() }),
          h('b', { text: '뽑을 목록 (한 줄에 하나)' }), pre, this.ta,
          h('label', {}, this.removeChk, ' 뽑힌 건 목록에서 빼기'),
          h('div', { class: 'muted', style: { fontSize: '13px' }, text: 'Space나 Enter를 눌러도 뽑혀요.' })));
      this.el = h('div', { class: 'overlay', onclick: ev => { if (ev.target === this.el) this.close(); } }, box);
      presentRoot.appendChild(this.el);
      this.renderHist();
      updateChrome();
    },
    close() { if (this.el) { this.el.remove(); this.el = null; } updateChrome(); },
    renderHist() { this.histBox.innerHTML = ''; this.hist.slice(0, 12).forEach(x => this.histBox.appendChild(h('span', { text: x }))); },
    spin() {
      const items = this.items();
      if (!items.length) { toast('목록이 비어 있어요'); return; }
      if (this.spinning) return;
      this.spinning = true;
      this.disp.classList.remove('win');
      const final = items[Math.floor(Math.random() * items.length)];
      const t0 = Date.now(), total = 2300;
      let delay = 50, last = '';
      const tick = () => {
        if (!this.el) { this.spinning = false; return; }
        if (Date.now() - t0 >= total) {
          this.disp.textContent = final; void this.disp.offsetWidth; this.disp.classList.add('win'); sfx('win');
          this.hist.unshift(final); this.renderHist();
          if (this.removeChk.checked) {
            const arr = this.ta.value.split('\n'); const i = arr.findIndex(s => s.trim() === final);
            if (i >= 0) { arr.splice(i, 1); this.ta.value = arr.join('\n'); deck.settings.pickerList = this.ta.value; scheduleSave(); }
          }
          this.spinning = false; return;
        }
        let pick = items[Math.floor(Math.random() * items.length)];
        if (items.length > 1) while (pick === last) pick = items[Math.floor(Math.random() * items.length)];
        last = pick; this.disp.textContent = pick; sfx('tick');
        delay *= 1.1; setTimeout(tick, delay);
      };
      tick();
    }
  };

  /* ---------- 발표자 화면 연결 ---------- */
  function openPresenter() {
    const url = location.href.split('#')[0].split('?')[0] + '?presenter';
    const w = window.open(url, 'ai-presenter', 'width=1400,height=860');
    if (!w) toast('팝업이 막혔어요. 주소창 오른쪽에서 팝업을 허용해 주세요.', 3500);
    else presWin = w;
  }
  function sendPresInit() { if (presWin && !presWin.closed) presWin.postMessage({ type: 'pres-init', deck, media, cur, step, timer: Timer.state() }, '*'); }
  function syncPresenter() { if (presWin && !presWin.closed) presWin.postMessage({ type: 'pres-state', cur, step, timer: Timer.state() }, '*'); }
  let presInitT = null;
  const sendPresInitSoon = () => { clearTimeout(presInitT); presInitT = setTimeout(sendPresInit, 800); };
  window.addEventListener('message', ev => {
    const d = ev.data || {};
    if (isPresenter) return;
    if (d.type === 'pres-hello') { presWin = ev.source; sendPresInit(); }
    else if (d.type === 'pres-nav') {
      if (mode !== 'present') return;
      if (d.dir === 'next') next(); else if (d.dir === 'prev') prev(); else if (d.dir === 'goto') goSlide(d.index, 0, true);
    } else if (d.type === 'pres-timer') Timer.cmd(d.cmd);
  });

  const Presenter = {
    st: { cur: 0, step: 0, timer: null }, t0: Date.now(),
    boot() {
      document.title = '발표자 화면 · AI 프롬프트 특강';
      document.body.classList.add('presenter');
      app = qs('#app');
      this.clock = h('span', { class: 'pv-big' }); this.elapsed = h('span', { class: 'pv-big' });
      this.tmr = h('span', { class: 'pv-big' }); this.cnt = h('span', { class: 'pv-big' });
      const top = h('div', { class: 'pv-top' },
        h('span', { class: 'pv-l', text: '지금' }), this.clock,
        h('span', { class: 'pv-l', text: '경과' }), this.elapsed,
        h('button', { class: 'pv-btn', text: '↺', title: '경과 시간 다시 재기', onclick: () => { this.t0 = Date.now(); this.tickClock(); } }),
        h('span', { class: 'grow' }),
        h('span', { class: 'pv-l', text: '타이머' }), this.tmr,
        h('button', { class: 'pv-btn', text: '⏯', title: '타이머 시작/멈춤 (T)', onclick: () => this.send({ type: 'pres-timer', cmd: 'toggle' }) }),
        h('span', { class: 'pv-l', text: '슬라이드' }), this.cnt,
        h('button', { class: 'pv-btn', text: '◀ 이전', onclick: () => this.nav('prev') }),
        h('button', { class: 'pv-btn primary', text: '다음 ▶', onclick: () => this.nav('next') }));
      this.curBox = h('div', { class: 'pv-stagebox' });
      this.nextBox = h('div', { class: 'pv-stagebox' });
      this.nextLbl = h('div', { class: 'pv-label' });
      this.notes = h('div', { class: 'pv-notes' });
      const body = h('div', { class: 'pv-body' },
        h('div', { class: 'pv-col' }, h('div', { class: 'pv-label', text: '지금 화면' }), this.curBox),
        h('div', { class: 'pv-right' },
          h('div', { class: 'pv-col' }, this.nextLbl, this.nextBox),
          h('div', { class: 'pv-col' }, h('div', { class: 'pv-label', text: '발표자 노트' }), this.notes)));
      app.appendChild(h('div', { class: 'pv' }, top, body));
      setInterval(() => this.tickClock(), 500); this.tickClock();
      window.addEventListener('message', ev => {
        const d = ev.data || {};
        if (d.type === 'pres-init') { deck = d.deck; media = d.media || {}; Object.assign(this.st, d); this.render(); }
        else if (d.type === 'pres-state') { Object.assign(this.st, d); this.render(); }
      });
      window.addEventListener('resize', () => this.render());
      window.addEventListener('keydown', ev => this.key(ev));
      if (!window.opener) { this.curBox.innerHTML = '<div class="pv-msg">발표 화면에서 <b>S</b> 키(또는 🖥️ 버튼)를 눌러 열어 주세요.</div>'; return; }
      this.send({ type: 'pres-hello' });
    },
    send(msg) { try { window.opener && window.opener.postMessage(msg, '*'); } catch (e) { } },
    nav(dir, index) { this.send({ type: 'pres-nav', dir, index }); },
    key(ev) {
      const k = ev.key;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].indexOf(k) >= 0) { ev.preventDefault(); this.nav('next'); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].indexOf(k) >= 0) { ev.preventDefault(); this.nav('prev'); }
      else if (k === 't' || k === 'T') this.send({ type: 'pres-timer', cmd: 'toggle' });
    },
    tickClock() {
      const d = new Date();
      this.clock.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      const e = Math.floor((Date.now() - this.t0) / 1000);
      this.elapsed.textContent = Math.floor(e / 60) + ':' + pad2(e % 60);
      const t = this.st.timer;
      if (!t) this.tmr.textContent = '—';
      else this.tmr.textContent = t.done ? '끝!' : Timer.fmt(t.running ? t.endAt - Date.now() : t.remain);
    },
    render() {
      if (!deck) return;
      const s = deck.slides[this.st.cur]; if (!s) return;
      const fitW = box => { const r = box.getBoundingClientRect(); return Math.max(120, Math.floor(Math.min(r.width, r.height * W / H))); };
      this.curBox.innerHTML = ''; this.curBox.appendChild(makeThumb(s, fitW(this.curBox), this.st.step));
      let ns = null, nstep = 0, lbl = '마지막 슬라이드예요';
      if (this.st.step < maxStepOf(s)) { ns = s; nstep = this.st.step + 1; lbl = '다음 클릭 (' + nstep + '/' + maxStepOf(s) + ')'; }
      else { let i = this.st.cur + 1; while (i < deck.slides.length && deck.slides[i].hidden) i++; if (i < deck.slides.length) { ns = deck.slides[i]; lbl = '다음 슬라이드 · ' + (i + 1) + '번'; } }
      this.nextLbl.textContent = lbl;
      this.nextBox.innerHTML = ''; if (ns) this.nextBox.appendChild(makeThumb(ns, fitW(this.nextBox), nstep));
      this.notes.textContent = s.notes || '(노트 없음)';
      this.cnt.textContent = (this.st.cur + 1) + ' / ' + deck.slides.length;
      this.tickClock();
    }
  };

  /* ---------- 편집 모드 ---------- */
  function enterEdit() {
    if (mode === 'edit') return;
    mode = 'edit';
    setTool(null); setBlank(null); Picker.close();
    if (gridEl) toggleGrid(); if (helpEl) toggleHelp();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    presentRoot.classList.add('hidden');
    editorRoot.classList.remove('hidden');
    document.body.classList.add('mode-edit');
    selId = null;
    renderEditor();
  }
  function exitEdit(fromStart) {
    stopTextEdit(); closePalette();
    mode = 'present'; selId = null;
    if (gridEl) toggleGrid(); if (helpEl) toggleHelp();
    editorRoot.classList.add('hidden');
    presentRoot.classList.remove('hidden');
    document.body.classList.remove('mode-edit');
    if (fromStart) cur = firstVisible();
    step = 0;
    renderPresent(true);
    sendPresInit();
  }

  function buildEditor() {
    editorRoot = h('div', { id: 'editor', class: 'hidden' });
    const T = (label, title, fn, cls) => h('button', { class: 'tb ' + (cls || ''), title, html: label, onclick: fn, onmousedown: ev => ev.preventDefault() });
    const sep = () => h('span', { class: 'ed-sep' });
    edSaveLbl = h('span', { class: 'ed-save', text: '✓ 자동 저장됨' });
    const imgInput = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });
    imgInput.addEventListener('change', async () => { const f = imgInput.files[0]; imgInput.value = ''; if (f) addOrReplaceImage(await fileToDataURL(f)); });
    const top = h('div', { class: 'ed-top' },
      T(ico('play') + ' 발표', '이 슬라이드부터 발표 (Shift+F5)', () => exitEdit(false), 'accent'),
      T(ico('undo'), '되돌리기 (Ctrl+Z)', undo), T(ico('redo'), '다시 하기 (Ctrl+Y)', redo), sep(),
      T(ico('plus') + ' 슬라이드', '새 슬라이드 추가', addSlide), T(ico('copy') + ' 복제', '이 슬라이드 복제', dupSlide),
      T(ico('eyeoff') + ' 숨기기', '발표할 때 건너뛰기 (다시 누르면 보이기)', toggleHidden), T(ico('trash') + ' 삭제', '이 슬라이드 삭제', delSlide), sep(),
      T(ico('type') + ' 텍스트', '텍스트 상자 추가', () => addText()), T(ico('square') + ' 카드', '테두리 있는 카드 추가', addBox),
      T(ico('image') + ' 이미지', '이미지 파일 추가 (Ctrl+V로 붙여넣어도 돼요)', () => imgInput.click()), T(ico('video') + ' 영상', '영상 추가', addVideo), sep(),
      T(ico('layout'), '전체 슬라이드 보기', toggleGrid),
      h('span', { class: 'grow' }), edSaveLbl,
      T(ico('download') + ' HTML로 내보내기', '다른 컴퓨터로 옮길 때 (영상과 같은 폴더에 두세요)', exportHTML),
      T(ico('reset') + ' 처음 상태로', '편집한 내용을 모두 지우고 처음으로', resetAll),
      T(ico('question'), '도움말', toggleHelp), imgInput);
    edProps = h('div', { class: 'ed-props' });
    edSide = h('div', { class: 'ed-side' });
    edCanvas = h('div', { class: 'ed-canvas' });
    edNotes = h('textarea', { placeholder: '발표자 노트 (발표자 화면에만 보여요)' });
    edNotes.addEventListener('input', () => { curSlide().notes = edNotes.value; scheduleSave(); sendPresInitSoon(); });
    const center = h('div', { class: 'ed-center' }, edCanvas, h('div', { class: 'ed-bottom' }, h('div', { class: 'ed-notes-lbl', text: '노트' }), edNotes));
    editorRoot.append(top, edProps, h('div', { class: 'ed-main' }, edSide, center));
    edCanvas.addEventListener('dragover', ev => { if (ev.dataTransfer && Array.from(ev.dataTransfer.types || []).indexOf('Files') >= 0) ev.preventDefault(); });
    edCanvas.addEventListener('drop', async ev => {
      const f = ev.dataTransfer && Array.from(ev.dataTransfer.files || []).find(x => /^image\//.test(x.type));
      if (!f) return;
      ev.preventDefault();
      const target = ev.target.closest && ev.target.closest('.el-image');
      if (target) select(target.dataset.id);
      else select(null);
      addOrReplaceImage(await fileToDataURL(f), stagePoint(ev));
    });
    edCanvas.addEventListener('pointerdown', ev => { if (ev.target === edCanvas) { stopTextEdit(); select(null); } });
    return editorRoot;
  }

  function renderEditor() {
    if (mode !== 'edit') return;
    renderSideList();
    renderEditStage();
    renderProps();
    edNotes.value = curSlide().notes || '';
  }

  function renderSideList() {
    edSide.innerHTML = '';
    let dragFrom = -1;
    deck.slides.forEach((s, i) => {
      const item = h('div', { class: 'side-item' + (i === cur ? ' active' : '') + (s.hidden ? ' is-hidden' : ''), draggable: 'true' },
        h('div', { class: 'side-num', text: String(i + 1) }), makeThumb(s, 186));
      if (s.hidden) item.appendChild(h('div', { class: 'side-hid', text: '숨김' }));
      item.addEventListener('click', () => { stopTextEdit(); selId = null; cur = i; step = 0; renderEditor(); });
      item.addEventListener('dragstart', ev => { dragFrom = i; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', 'slide'); } catch (e) { } });
      item.addEventListener('dragover', ev => {
        if (dragFrom < 0) return;
        ev.preventDefault();
        const r = item.getBoundingClientRect(), after = ev.clientY > r.top + r.height / 2;
        item.classList.toggle('drop-after', after); item.classList.toggle('drop-before', !after);
      });
      item.addEventListener('dragleave', () => item.classList.remove('drop-after', 'drop-before'));
      item.addEventListener('drop', ev => {
        ev.preventDefault();
        const after = item.classList.contains('drop-after');
        item.classList.remove('drop-after', 'drop-before');
        if (dragFrom < 0) return;
        let to = i + (after ? 1 : 0);
        if (dragFrom < to) to--;
        moveSlide(dragFrom, to); dragFrom = -1;
      });
      item.addEventListener('dragend', () => { dragFrom = -1; edSide.querySelectorAll('.side-item').forEach(x => x.classList.remove('drop-after', 'drop-before')); });
      edSide.appendChild(item);
    });
    const act = edSide.children[cur]; if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest' });
  }
  let thumbT = null;
  function refreshThumbSoon() {
    clearTimeout(thumbT);
    thumbT = setTimeout(() => {
      if (mode !== 'edit') return;
      const item = edSide.children[cur]; if (!item) return;
      const old = item.querySelector('.thumb'); if (old) old.replaceWith(makeThumb(curSlide(), 186));
    }, 350);
  }

  function renderEditStage() {
    const { stage, nodes } = makeStage(curSlide(), { mode: 'edit' });
    editNodes = nodes;
    nodes.forEach(r => {
      if (r.widget.update) r.widget.update(r.e.steps || 0, false);
      if (r.e.step) r.node.appendChild(h('div', { class: 'step-badge', text: String(r.e.step) }));
      if (r.e.type === 'text' && !(r.e.html || '').replace(/<[^>]*>/g, '').trim()) r.node.classList.add('empty');
    });
    selBox = h('div', { class: 'sel-box hidden' });
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(d => selBox.appendChild(h('div', { class: 'h', 'data-h': d })));
    stage.appendChild(selBox);
    edCanvas.innerHTML = '';
    edCanvas.appendChild(stage);
    edStage = stage;
    fitStage(edCanvas, stage);
    stage.addEventListener('pointerdown', onStagePointerDown);
    stage.addEventListener('dblclick', onStageDbl);
    if (selId && !nodes.get(selId)) selId = null;
    updateSelBox();
  }

  function updateSelBox() {
    if (!selBox) return;
    const e = selId && findEl(selId);
    if (!e) { selBox.classList.add('hidden'); return; }
    selBox.classList.remove('hidden');
    Object.assign(selBox.style, { left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px' });
  }
  function positionNode(e) {
    const r = editNodes.get(e.id); if (!r) return;
    Object.assign(r.node.style, { left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px' });
  }
  function select(id) {
    if (editingId && id !== editingId) stopTextEdit();
    selId = id || null;
    updateSelBox();
    renderProps();
  }
  function stagePoint(ev) {
    const r = edStage.getBoundingClientRect(), s = r.width / W;
    return [(ev.clientX - r.left) / s, (ev.clientY - r.top) / s];
  }

  function onStagePointerDown(ev) {
    if (ev.button !== 0) return;
    const handle = ev.target.closest('.h');
    if (handle && selId) { startResize(ev, handle.dataset.h); return; }
    const node = ev.target.closest('.el');
    if (editingId) { if (node && node.dataset.id === editingId) return; stopTextEdit(); }
    closePalette();
    if (!node) { select(null); return; }
    if (node.dataset.id !== selId) select(node.dataset.id);
    startMove(ev);
  }

  function showGuides(gx, gy) {
    edStage.querySelectorAll('.guide').forEach(g => g.remove());
    if (gx != null) { const g = h('div', { class: 'guide gv' }); g.style.left = gx + 'px'; edStage.appendChild(g); }
    if (gy != null) { const g = h('div', { class: 'guide gh' }); g.style.top = gy + 'px'; edStage.appendChild(g); }
  }
  function startMove(ev) {
    const e = findEl(selId); if (!e) return;
    ev.preventDefault();
    const s = edStage._scale, sx = ev.clientX, sy = ev.clientY, ox = e.x, oy = e.y;
    let moved = false;
    const mm = m => {
      const dx = (m.clientX - sx) / s, dy = (m.clientY - sy) / s;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) { pushUndo(); moved = true; }
      let nx = Math.round(ox + dx), ny = Math.round(oy + dy), gx = null, gy = null;
      if (Math.abs(nx + e.w / 2 - W / 2) < 14) { nx = Math.round(W / 2 - e.w / 2); gx = W / 2; }
      if (Math.abs(ny + e.h / 2 - H / 2) < 14) { ny = Math.round(H / 2 - e.h / 2); gy = H / 2; }
      e.x = nx; e.y = ny; positionNode(e); updateSelBox(); showGuides(gx, gy);
    };
    const mu = () => {
      window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu);
      showGuides(null, null);
      if (moved) changed();
    };
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu);
  }
  function startResize(ev, dir) {
    ev.preventDefault(); ev.stopPropagation();
    const e = findEl(selId); if (!e) return;
    pushUndo();
    const s = edStage._scale, sx = ev.clientX, sy = ev.clientY, o = { x: e.x, y: e.y, w: e.w, h: e.h }, ratio = o.w / o.h;
    const mm = m => {
      const dx = (m.clientX - sx) / s, dy = (m.clientY - sy) / s;
      let { x, y, w, h: hh } = o;
      if (dir.indexOf('e') >= 0) w = o.w + dx;
      if (dir.indexOf('w') >= 0) { w = o.w - dx; x = o.x + dx; }
      if (dir.indexOf('s') >= 0) hh = o.h + dy;
      if (dir.indexOf('n') >= 0) { hh = o.h - dy; y = o.y + dy; }
      if (m.shiftKey && dir.length === 2) {
        if (w / hh > ratio) w = hh * ratio; else hh = w / ratio;
        if (dir.indexOf('w') >= 0) x = o.x + o.w - w;
        if (dir.indexOf('n') >= 0) y = o.y + o.h - hh;
      }
      if (w < 30) { if (dir.indexOf('w') >= 0) x -= 30 - w; w = 30; }
      if (hh < 30) { if (dir.indexOf('n') >= 0) y -= 30 - hh; hh = 30; }
      e.x = Math.round(x); e.y = Math.round(y); e.w = Math.round(w); e.h = Math.round(hh);
      positionNode(e); updateSelBox();
    };
    const mu = () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu); changed(); };
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu);
  }

  function onStageDbl(ev) {
    const node = ev.target.closest('.el'); if (!node) return;
    const e = findEl(node.dataset.id); if (!e) return;
    if (e.type === 'text') startTextEdit(e);
    else if (Widgets[e.type] && Widgets[e.type].config) openConfig(e);
    else if (e.type === 'image') qs('#editor input[type=file]').click();
  }

  /* 글자 편집 */
  function startTextEdit(e) {
    const r = editNodes.get(e.id); if (!r || !r.widget.txt) return;
    if (editingId === e.id) return;
    select(e.id);
    editingId = e.id; editTxt = r.widget.txt; editSnap = snapshot();
    r.node.classList.remove('empty');
    editTxt.contentEditable = 'true';
    r.node.classList.add('editing');
    editTxt.focus();
    const range = document.createRange(); range.selectNodeContents(editTxt); range.collapse(false);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    savedRange = range.cloneRange();
    editTxt.addEventListener('blur', onEditBlur);
    renderProps();
  }
  function onEditBlur() { setTimeout(() => { if (editingId && document.activeElement !== editTxt && !paletteEl) stopTextEdit(); }, 0); }
  function stopTextEdit() {
    if (!editingId) return;
    const e = findEl(editingId), txt = editTxt;
    editingId = null; editTxt = null;
    if (txt) { txt.contentEditable = 'false'; txt.removeEventListener('blur', onEditBlur); if (txt.parentNode && txt.parentNode.parentNode) txt.parentNode.parentNode.classList.remove('editing'); }
    if (e && txt) {
      let html = txt.innerHTML.replace(/(<br\s*\/?>\s*)+$/i, '').trim();
      if (html !== (e.html || '')) { pushUndo(editSnap); e.html = html; changed(); }
      if (!html.replace(/<[^>]*>/g, '').trim()) txt.parentNode.parentNode.classList.add('empty');
    }
    editSnap = null; savedRange = null;
    renderProps();
  }
  document.addEventListener('selectionchange', () => {
    if (!editTxt) return;
    const s = window.getSelection();
    if (s.rangeCount && editTxt.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
  });
  function execCmd(cmd, val) {
    if (!editTxt) return;
    editTxt.focus();
    if (savedRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
    try { document.execCommand('styleWithCSS', false, true); } catch (e) { }
    document.execCommand(cmd, false, val == null ? null : val);
  }

  /* 속성 툴바 */
  function pbtn(label, title, fn, on, cls) {
    return h('button', { class: 'pbtn' + (on ? ' on' : '') + (cls ? ' ' + cls : ''), title: title || '', html: label, onmousedown: ev => ev.preventDefault(), onclick: fn });
  }
  const psep = () => h('span', { class: 'psep' });
  function renderProps() {
    if (!edProps) return;
    edProps.innerHTML = '';
    const e = selId && findEl(selId);
    if (!e) {
      const s = curSlide();
      edProps.appendChild(h('span', { class: 'plabel', text: '슬라이드 배경' }));
      Object.keys(BG).forEach(k => edProps.appendChild(h('button', {
        class: 'bg-sw' + ((s.bg || 'cream') === k ? ' on' : ''), title: BG_NAMES[k], style: { background: BG[k] },
        onclick: () => { pushUndo(); s.bg = k; changed(); renderEditStage(); renderProps(); }
      })));
      edProps.append(psep(), h('span', { class: 'phint', text: '요소를 클릭하면 편집 도구가 나와요 · 더블클릭: 글자 고치기 · Ctrl+V: 이미지 붙여넣기 · 왼쪽 목록을 끌어서 순서 바꾸기' }));
      return;
    }
    const s = e.style || (e.style = {});
    if (e.type === 'text') {
      const fsIn = h('input', { class: 'pnum', type: 'number', min: 8, max: 600, value: s.fs || 40, title: '글자 크기' });
      fsIn.addEventListener('change', () => setStyle('fs', clamp(parseInt(fsIn.value, 10) || 40, 8, 600)));
      fsIn.addEventListener('keydown', ev => ev.stopPropagation());
      edProps.append(
        pbtn('<span style="font-family:\'Nanum Gothic\'">나눔고딕</span>', '본문용 글꼴', () => setStyle('font', ''), s.font !== 'fun'),
        pbtn('<span style="font-family:Jua">주아</span>', '제목·강조용 글꼴', () => setStyle('font', 'fun'), s.font === 'fun'),
        psep(),
        pbtn('가−', '글자 작게', () => setStyle('fs', Math.max(8, (s.fs || 40) - 4))), fsIn,
        pbtn('가+', '글자 크게', () => setStyle('fs', (s.fs || 40) + 4)),
        pbtn('<b>B</b>', editingId ? '선택한 글자 굵게' : '전체 굵게', () => editingId ? execCmd('bold') : setStyle('fw', (s.fw || 500) >= 700 ? 500 : 800), !editingId && (s.fw || 500) >= 700),
        psep());
      [['left', '⫷ 왼쪽', '왼쪽 정렬'], ['center', '≡ 가운데', '가운데 정렬'], ['right', '오른쪽 ⫸', '오른쪽 정렬']].forEach(a => edProps.appendChild(pbtn(a[1], a[2], () => setStyle('align', a[0]), (s.align || 'left') === a[0])));
      [['top', '위', '위쪽 맞춤'], ['middle', '중간', '세로 가운데'], ['bottom', '아래', '아래쪽 맞춤']].forEach(a => edProps.appendChild(pbtn(a[1], a[2], () => setStyle('valign', a[0]), (s.valign || 'top') === a[0])));
      edProps.append(psep(),
        colorBtn('글자색', s.color || INK, c => editingId ? execCmd('foreColor', c) : setStyle('color', c), false),
        colorBtn('배경', s.bg || '', c => setStyle('bg', c), true),
        pbtn('테두리', '카드 테두리·그림자 켜기/끄기', toggleBorder, !!s.border));
    }
    if (e.type === 'image') {
      edProps.append(
        pbtn('맞춤', '잘리지 않게', () => setProp('fit', 'contain'), (e.fit || 'contain') === 'contain'),
        pbtn('채우기', '칸을 꽉 채우기', () => setProp('fit', 'cover'), e.fit === 'cover'),
        pbtn('이미지 바꾸기', '파일에서 고르기 (또는 Ctrl+V)', () => qs('#editor input[type=file]').click()),
        pbtn('이미지 비우기', '자리만 남기기', () => setProp('src', '')));
    }
    if (Widgets[e.type] && Widgets[e.type].config) edProps.appendChild(pbtn('✎ 내용 편집', '이 위젯 내용 바꾸기', () => openConfig(e)));
    edProps.append(psep(), pbtn('맨 앞으로', '다른 요소 위로', () => zorder(1)), pbtn('맨 뒤로', '다른 요소 아래로', () => zorder(-1)), psep());
    const stepSel = h('select', { class: 'psel', title: '발표할 때 언제 나타날지' });
    for (let i = 0; i <= 20; i++) stepSel.appendChild(h('option', { value: String(i), text: i === 0 ? '처음부터 보임' : `클릭 ${i}번째에 등장` }));
    stepSel.value = String(e.step || 0);
    stepSel.addEventListener('change', () => setProp('step', parseInt(stepSel.value, 10) || 0));
    const animSel = h('select', { class: 'psel', title: '나타날 때 효과' });
    ANIMS.forEach(a => animSel.appendChild(h('option', { value: a[0], text: a[1] })));
    animSel.value = e.anim || '';
    animSel.addEventListener('change', () => setProp('anim', animSel.value));
    edProps.append(h('span', { class: 'plabel', text: '등장' }), stepSel, animSel,
      pbtn('맨 마지막 클릭에', '다른 요소가 다 나온 다음 클릭에 나타나게', () => {
        let m = 0; curSlide().elements.forEach(x => { if (x !== e) m = Math.max(m, (x.step || 0) + (x.steps || 0)); });
        setProp('step', m + 1);
      }),
      psep(), pbtn('복제', 'Ctrl+D', duplicateEl), pbtn('🗑 삭제', 'Delete', deleteEl, false, 'danger'));
  }

  function coalescedUndo(key) {
    const now = Date.now();
    if (key !== lastUndoKey || now - lastUndoAt > 900) pushUndo();
    lastUndoKey = key; lastUndoAt = now;
  }
  function setStyle(k, v) {
    const e = findEl(selId); if (!e) return;
    if (editingId) stopTextEdit();
    coalescedUndo(e.id + ':' + k);
    e.style = e.style || {};
    if (v === '' || v == null) delete e.style[k]; else e.style[k] = v;
    changed(); renderEditStage(); renderProps();
  }
  function setProp(k, v) {
    const e = findEl(selId); if (!e) return;
    pushUndo();
    if (v === '' || v == null || (k === 'step' && !v)) delete e[k]; else e[k] = v;
    changed(); renderEditStage(); renderProps();
  }
  function toggleBorder() {
    const e = findEl(selId); if (!e) return;
    pushUndo();
    const s = e.style = e.style || {};
    if (s.border) { delete s.border; delete s.shadow; }
    else { s.border = `4px solid ${INK}`; s.shadow = `8px 8px 0 ${INK}`; if (s.radius == null) s.radius = 28; if (!s.pad) s.pad = '30px 36px'; if (!s.bg) s.bg = '#FFFFFF'; }
    changed(); renderEditStage(); renderProps();
  }

  let paletteEl = null;
  function closePalette() { if (paletteEl) { paletteEl.remove(); paletteEl = null; } }
  function colorBtn(label, current, onPick, allowNone) {
    const sw = h('span', { class: 'swatch' + (current ? '' : ' none') });
    if (current) sw.style.background = current;
    const b = pbtn('', label, () => {
      if (paletteEl) { closePalette(); return; }
      const r = b.getBoundingClientRect();
      paletteEl = h('div', { class: 'palette', style: { left: r.left + 'px', top: (r.bottom + 6) + 'px' } });
      PALETTE.forEach(c => paletteEl.appendChild(h('div', { class: 'sw', title: c, style: { background: c }, onmousedown: ev => ev.preventDefault(), onclick: () => { closePalette(); onPick(c); } })));
      const custom = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(current) ? current : '#1C2340' });
      custom.addEventListener('change', () => { const v = custom.value; closePalette(); onPick(v); });
      const row = h('div', { class: 'row' }, h('span', { text: '직접 고르기' }), custom);
      if (allowNone) row.appendChild(h('button', { text: '없음', onmousedown: ev => ev.preventDefault(), onclick: () => { closePalette(); onPick(''); } }));
      paletteEl.appendChild(row);
      document.body.appendChild(paletteEl);
    });
    b.append(sw, document.createTextNode(label));
    return b;
  }
  document.addEventListener('pointerdown', ev => {
    if (paletteEl && !paletteEl.contains(ev.target) && !ev.target.closest('.pbtn')) closePalette();
  }, true);

  /* 위젯 내용 편집 */
  async function openConfig(e) {
    const c = e.config = e.config || {};
    if (e.type === 'chat') {
      const title = h('input', { type: 'text', value: c.title || 'AI 채팅' });
      const ta = h('textarea');
      ta.value = (c.messages || []).map(m => (m.who === 'ai' ? 'AI' : '나') + (m.type === 'doc' ? '(사진)' : '') + ': ' + String(m.text).replace(/\n/g, ' / ')).join('\n');
      const body = h('div', {}, h('label', { text: '채팅창 제목' }), title, h('label', { text: '메시지 (한 줄에 하나, 클릭할 때마다 하나씩 나와요)' }), ta,
        h('div', { class: 'hint', html: '<b>나:</b> 내 말풍선 · <b>AI:</b> AI 말풍선 · <b>나(사진):</b> 학습지 사진 모양 · 줄바꿈은 <b> / </b>' }));
      body.style.display = 'flex'; body.style.flexDirection = 'column'; body.style.gap = '8px';
      if (!await modal({ title: '채팅 내용 편집', body, buttons: [{ label: '취소', value: false }, { label: '적용', value: true, cls: 'primary' }] })) return;
      const msgs = [];
      ta.value.split('\n').forEach(line => {
        const m = line.match(/^\s*(나|AI|ai)\s*(\(사진\))?\s*[:：]\s*(.*)$/);
        if (m && m[3].trim()) msgs.push({ who: /ai/i.test(m[1]) ? 'ai' : 'me', type: m[2] ? 'doc' : undefined, text: m[3].trim().replace(/\s*\/\s*/g, '\n') });
      });
      pushUndo(); c.title = title.value; c.messages = msgs.map(m => { if (!m.type) delete m.type; return m; }); e.steps = msgs.length;
    } else if (e.type === 'autocomplete') {
      const words = h('textarea'); words.value = (c.words || []).join(' ');
      const pool = h('input', { type: 'text', value: (c.pool || []).join(' ') });
      const body = h('div', {}, h('label', { text: '만들어질 문장 (단어 사이 띄어쓰기)' }), words, h('label', { text: '옆에 같이 뜰 추천 단어들' }), pool);
      body.style.display = 'flex'; body.style.flexDirection = 'column'; body.style.gap = '8px';
      if (!await modal({ title: '자동완성 내용 편집', body, buttons: [{ label: '취소', value: false }, { label: '적용', value: true, cls: 'primary' }] })) return;
      pushUndo(); c.words = words.value.split(/\s+/).filter(Boolean); c.pool = pool.value.split(/\s+/).filter(Boolean); e.steps = 1;
    } else if (e.type === 'ingredients') {
      const rows = (c.items || []).map((it, i) => {
        const chk = h('input', { type: 'checkbox' }); chk.checked = !!it.open;
        const ord = h('input', { type: 'number', min: 0, max: 9, value: String((c.unlock || []).indexOf(i) + 1) });
        return { chk, ord, row: h('div', { class: 'ing-row' }, h('span', { text: (it.icon || '') + ' ' + it.name, style: { width: '140px', fontWeight: '800' } }), chk, h('span', { text: '처음부터 열림' }), h('span', { text: '· 클릭으로 여는 순서', style: { marginLeft: '10px' } }), ord) };
      });
      const body = h('div', {}, h('div', { class: 'hint', text: '순서에 1, 2…를 넣으면 발표할 때 그 순서대로 클릭하면 열려요. 0은 열지 않음.' }), rows.map(r => r.row));
      body.style.display = 'flex'; body.style.flexDirection = 'column'; body.style.gap = '8px';
      if (!await modal({ title: '재료 상태 편집', body, buttons: [{ label: '취소', value: false }, { label: '적용', value: true, cls: 'primary' }] })) return;
      pushUndo();
      rows.forEach((r, i) => { if (r.chk.checked) c.items[i].open = true; else delete c.items[i].open; });
      c.unlock = rows.map((r, i) => ({ i, o: parseInt(r.ord.value, 10) || 0 })).filter(x => x.o > 0).sort((a, b) => a.o - b.o).map(x => x.i);
      e.steps = c.unlock.length;
    } else if (e.type === 'video') {
      const src = h('input', { type: 'text', value: e.src || '' });
      const label = h('input', { type: 'text', value: e.label || '' });
      const body = h('div', {}, h('label', { text: '영상 파일 이름 (이 HTML과 같은 폴더)' }), src, h('label', { text: '설명' }), label);
      body.style.display = 'flex'; body.style.flexDirection = 'column'; body.style.gap = '8px';
      if (!await modal({ title: '영상 설정', body, buttons: [{ label: '취소', value: false }, { label: '적용', value: true, cls: 'primary' }] })) return;
      pushUndo(); e.src = src.value.trim(); e.label = label.value.trim();
    } else if (e.type === 'chapter') {
      const f = {};
      const mk = (k, label, val) => { f[k] = h('input', { type: 'text', value: val || '' }); return [h('label', { text: label }), f[k]]; };
      const body = h('div', {}, mk('part', '작은 글씨 (예: PART 1, 미션 1)', c.part), mk('title', '큰 제목', c.title), mk('sub', '설명', c.sub), mk('num', '배경 큰 숫자·글자', c.num));
      body.style.display = 'flex'; body.style.flexDirection = 'column'; body.style.gap = '8px';
      if (!await modal({ title: '챕터 화면 편집', body, buttons: [{ label: '취소', value: false }, { label: '적용', value: true, cls: 'primary' }] })) return;
      pushUndo(); ['part', 'title', 'sub', 'num'].forEach(k => { c[k] = f[k].value; });
    } else if (e.type === 'qr') {
      const label = h('input', { type: 'text', value: c.label || '' });
      if (!await modal({ title: 'QR 칸 설정', body: h('div', {}, h('label', { text: '안내 문구' }), label), buttons: [{ label: '취소', value: false }, { label: '적용', value: true, cls: 'primary' }] })) return;
      pushUndo(); c.label = label.value;
    } else return;
    changed(); renderEditStage(); renderProps();
  }

  /* 요소 추가 · 삭제 */
  const isDarkBg = () => !!DARK_BG[curSlide().bg];
  function addEl(e) { pushUndo(); curSlide().elements.push(e); changed(); renderEditStage(); select(e.id); return e; }
  function addText(html) {
    return addEl({ id: uid(), type: 'text', x: 560, y: 440, w: 800, h: 200, html: html == null ? '텍스트를 입력하세요' : html, style: { fs: 48, fw: 700, color: isDarkBg() ? '#FFFFFF' : INK, align: 'left', valign: 'top', lh: 1.45 } });
  }
  function addBox() {
    return addEl({ id: uid(), type: 'text', x: 660, y: 340, w: 600, h: 400, html: '카드 내용', style: { fs: 44, fw: 700, color: INK, align: 'center', valign: 'middle', lh: 1.45, bg: '#FFFFFF', border: `4px solid ${INK}`, radius: 28, shadow: `8px 8px 0 ${INK}`, pad: '30px 36px' } });
  }
  async function addVideo() {
    const src = h('input', { type: 'text', value: '영상1_맥북던짐사건.mp4' });
    const body = h('div', {}, h('label', { text: '영상 파일 이름 (이 HTML과 같은 폴더에 있어야 해요)' }), src);
    if (!await modal({ title: '영상 추가', body, buttons: [{ label: '취소', value: false }, { label: '추가', value: true, cls: 'primary' }] })) return;
    addEl({ id: uid(), type: 'video', x: 240, y: 135, w: 1440, h: 810, src: src.value.trim(), label: src.value.trim(), style: { radius: 24 } });
  }
  function addOrReplaceImage(dataURL, at) {
    if (!dataURL) return;
    const mid = uid('m'); media[mid] = dataURL;
    const e = selId && findEl(selId);
    if (e && e.type === 'image') { pushUndo(); e.src = 'media:' + mid; changed(); renderEditStage(); renderProps(); toast('이미지를 바꿨어요'); return; }
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || 800, hh = img.naturalHeight || 600;
      const k = Math.min(1, 1100 / w, 700 / hh); w = Math.round(w * k); hh = Math.round(hh * k);
      let x = Math.round((W - w) / 2), y = Math.round((H - hh) / 2);
      if (at) { x = Math.round(at[0] - w / 2); y = Math.round(at[1] - hh / 2); }
      addEl({ id: uid(), type: 'image', x, y, w, h: hh, src: 'media:' + mid, fit: 'contain', style: { radius: 16 } });
    };
    img.src = dataURL;
  }
  function fileToDataURL(file) {
    return new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => {
        const url = fr.result;
        const img = new Image();
        img.onload = () => {
          const max = 1920, big = Math.max(img.naturalWidth, img.naturalHeight);
          if (big <= max && file.size < 700 * 1024) { res(url); return; }
          const k = Math.min(1, max / big);
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          let out = '';
          try { out = cv.toDataURL('image/webp', 0.88); } catch (e) { }
          if (!out || out.indexOf('data:image/webp') !== 0) out = cv.toDataURL('image/jpeg', 0.88);
          res(out);
        };
        img.onerror = () => res(url);
        img.src = url;
      };
      fr.onerror = () => res('');
      fr.readAsDataURL(file);
    });
  }
  function duplicateEl() {
    const e = selId && findEl(selId); if (!e) return;
    const c = clone(e); c.id = uid(); c.x += 30; c.y += 30;
    addEl(c);
  }
  function deleteEl() {
    if (!selId) return;
    pushUndo();
    const s = curSlide(); s.elements = s.elements.filter(e => e.id !== selId);
    selId = null; changed(); renderEditStage(); renderProps();
  }
  function zorder(dir) {
    const e = selId && findEl(selId); if (!e) return;
    const zs = curSlide().elements.map(x => x.z || 0);
    pushUndo();
    e.z = dir > 0 ? Math.max.apply(null, zs) + 1 : Math.min.apply(null, zs) - 1;
    changed(); renderEditStage();
  }
  function nudge(key, d) {
    const e = selId && findEl(selId); if (!e) return;
    coalescedUndo(e.id + ':nudge');
    if (key === 'ArrowLeft') e.x -= d; if (key === 'ArrowRight') e.x += d;
    if (key === 'ArrowUp') e.y -= d; if (key === 'ArrowDown') e.y += d;
    positionNode(e); updateSelBox(); changed();
  }

  /* 슬라이드 다루기 */
  function newIds(s) { s.id = uid('s'); s.elements.forEach(e => { e.id = uid(); }); return s; }
  function addSlide() {
    stopTextEdit(); pushUndo();
    const s = {
      id: uid('s'), bg: 'cream', notes: '', elements: [
        { id: uid(), type: 'text', x: 120, y: 80, w: 1680, h: 130, html: '제목을 입력하세요', style: { fs: 84, fw: 400, font: 'fun', color: INK, lh: 1.15 } },
        { id: uid(), type: 'text', x: 120, y: 260, w: 1680, h: 600, html: '내용을 입력하세요', style: { fs: 44, fw: 700, color: INK, lh: 1.55 } }
      ]
    };
    deck.slides.splice(cur + 1, 0, s); cur++; selId = null; changed(); renderEditor();
  }
  function dupSlide() { stopTextEdit(); pushUndo(); const s = newIds(clone(curSlide())); deck.slides.splice(cur + 1, 0, s); cur++; selId = null; changed(); renderEditor(); toast('슬라이드를 복제했어요'); }
  function delSlide() {
    if (deck.slides.length <= 1) { toast('마지막 한 장은 지울 수 없어요'); return; }
    stopTextEdit(); pushUndo();
    deck.slides.splice(cur, 1); cur = clamp(cur, 0, deck.slides.length - 1); selId = null; changed(); renderEditor();
    toast('삭제했어요 · Ctrl+Z로 되돌릴 수 있어요');
  }
  function toggleHidden() {
    pushUndo(); const s = curSlide(); s.hidden = !s.hidden; if (!s.hidden) delete s.hidden;
    changed(); renderSideList(); toast(s.hidden ? '발표할 때 이 슬라이드를 건너뛰어요' : '다시 보이게 했어요');
  }
  function moveSlide(from, to) {
    if (from === to || from < 0) return;
    pushUndo();
    const [s] = deck.slides.splice(from, 1);
    deck.slides.splice(to, 0, s);
    cur = to; selId = null; changed(); renderEditor();
  }

  /* 되돌리기 */
  function snapshot() { return JSON.stringify({ slides: deck.slides, settings: deck.settings }); }
  function pushUndo(snap) { undoStack.push(snap || snapshot()); if (undoStack.length > 200) undoStack.shift(); redoStack.length = 0; }
  function restore(str) {
    const o = JSON.parse(str);
    deck.slides = o.slides; deck.settings = o.settings;
    cur = clamp(cur, 0, deck.slides.length - 1);
    if (selId && !findEl(selId)) selId = null;
    scheduleSave(); sendPresInitSoon();
    if (mode === 'edit') renderEditor(); else renderPresent(false);
  }
  function undo() { stopTextEdit(); if (!undoStack.length) { toast('되돌릴 게 없어요'); return; } redoStack.push(snapshot()); restore(undoStack.pop()); }
  function redo() { stopTextEdit(); if (!redoStack.length) { toast('다시 할 게 없어요'); return; } undoStack.push(snapshot()); restore(redoStack.pop()); }

  function changed() { scheduleSave(); refreshThumbSoon(); sendPresInitSoon(); }

  /* ---------- 저장 · 내보내기 ---------- */
  function setSaveLbl(t) { if (edSaveLbl) edSaveLbl.textContent = t; }
  async function saveNow() {
    if (!deck || resetting) return;
    clearTimeout(saveTimer); saveTimer = null;
    const ok = await Store.set(saveKey(), { baseRev, deck, media, savedAt: Date.now() });
    setSaveLbl(ok ? '✓ 자동 저장됨' : '⚠ 자동 저장 안 됨 · 내보내기를 쓰세요');
  }
  function scheduleSave() { if (resetting) return; setSaveLbl('저장 중…'); clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 600); }
  window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });

  function exportHTML() {
    stopTextEdit();
    const newRev = 'x' + Date.now().toString(36);
    const d = clone(deck); d.rev = newRev;
    const used = {};
    JSON.stringify(d).replace(/media:([A-Za-z0-9]+)/g, (m, id) => { if (media[id]) used[id] = media[id]; return m; });
    const json = JSON.stringify({ deck: d, media: used }).replace(/</g, '\\u003c');
    const html = PRISTINE.replace(/(<script id="deck-data"[^>]*>)[\s\S]*?(<\/script>)/, (m, a, b) => a + json + b);
    const now = new Date();
    const name = `AI프롬프트특강_슬라이드_${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}.html`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
    baseRev = newRev; deck.rev = newRev; saveNow();
    modal({ title: 'HTML로 내보냈어요', body: `<b>${esc(name)}</b> 파일이 다운로드 폴더에 저장됐어요.<br><br>다른 컴퓨터에서 쓰려면 이 파일을 <b>영상 파일 2개(영상1_맥북던짐사건.mp4, 영상2_전과자.mp4)와 같은 폴더</b>에 넣고 열어 주세요.` });
  }
  async function resetAll() {
    if (!await confirmBox('처음 상태로 되돌릴까요?', '이 컴퓨터에 자동 저장된 편집 내용이 모두 지워지고, 이 파일을 처음 열었을 때 모습으로 돌아가요. 되돌릴 수 없어요.', '모두 지우고 되돌리기', 'danger')) return;
    resetting = true; clearTimeout(saveTimer);
    await Store.del(saveKey());
    location.reload();
  }

  /* ---------- 키보드 · 붙여넣기 ---------- */
  function onKey(ev) {
    if (isPresenter) return;
    const k = ev.key;
    if (k === 'F5') {
      ev.preventDefault();
      if (modalStack.length) return;
      if (mode === 'edit') { stopTextEdit(); exitEdit(!ev.shiftKey); }
      else goSlide(ev.shiftKey ? cur : firstVisible(), 0, true);
      return;
    }
    if (modalStack.length) { if (k === 'Escape') closeTopModal(); return; }
    if ((ev.ctrlKey || ev.metaKey) && (k === 's' || k === 'S')) { ev.preventDefault(); saveNow(); toast('저장했어요'); return; }
    if (isTyping(ev.target)) {
      if (k === 'Escape' && editingId) { ev.preventDefault(); stopTextEdit(); }
      return;
    }
    if (helpEl) { if (k === 'Escape' || k === '?' || k === '/') { ev.preventDefault(); toggleHelp(); } return; }
    if (gridEl) { if (k === 'Escape' || k === 'g' || k === 'G') { ev.preventDefault(); toggleGrid(); } return; }
    if (mode === 'edit') { editorKey(ev); return; }
    presentKey(ev);
  }

  function presentKey(ev) {
    const k = ev.key;
    if (Picker.isOpen()) {
      if (k === 'Escape') Picker.close();
      else if (k === ' ' || k === 'Enter') { ev.preventDefault(); Picker.spin(); }
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.target && ev.target.tagName === 'VIDEO' && (k === ' ' || k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown')) return;
    if (/^[0-9]$/.test(k)) { ev.preventDefault(); jumpBuf = (jumpBuf + k).slice(-3); jumpEl.textContent = `슬라이드 ${jumpBuf}번으로 이동 ⏎`; jumpEl.classList.remove('hidden'); return; }
    if (jumpBuf) {
      if (k === 'Enter') { ev.preventDefault(); const n = parseInt(jumpBuf, 10); jumpBuf = ''; jumpEl.classList.add('hidden'); if (n >= 1 && n <= deck.slides.length) goSlide(n - 1, 0, true); else toast(`${n}번 슬라이드는 없어요`); return; }
      if (k === 'Backspace') { ev.preventDefault(); jumpBuf = jumpBuf.slice(0, -1); if (jumpBuf) jumpEl.textContent = `슬라이드 ${jumpBuf}번으로 이동 ⏎`; else jumpEl.classList.add('hidden'); return; }
      if (k === 'Escape') { jumpBuf = ''; jumpEl.classList.add('hidden'); return; }
      jumpBuf = ''; jumpEl.classList.add('hidden');
    }
    if (blankMode && k !== 'b' && k !== 'B' && k !== 'w' && k !== 'W' && k !== '.' && k !== ',') { setBlank(null); if (k === 'Escape') return; }
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': case 'n': case 'N':
        ev.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        ev.preventDefault(); prev(); break;
      case 'Home': ev.preventDefault(); goSlide(firstVisible(), 0, true); break;
      case 'End': { ev.preventDefault(); let i = deck.slides.length - 1; while (i > 0 && deck.slides[i].hidden) i--; goSlide(i, 0, true); break; }
      case 'f': case 'F': toggleFullscreen(); break;
      case 'g': case 'G': toggleGrid(); break;
      case 'b': case 'B': case '.': setBlank(blankMode === 'black' ? null : 'black'); break;
      case 'w': case 'W': case ',': setBlank(blankMode === 'white' ? null : 'white'); break;
      case 't': case 'T': Timer.toggle(); break;
      case 'r': case 'R': Picker.open(); break;
      case 's': case 'S': openPresenter(); break;
      case 'p': case 'P': setTool(tool === 'pen' ? null : 'pen'); break;
      case 'h': case 'H': setTool(tool === 'hl' ? null : 'hl'); break;
      case 'l': case 'L': setTool(tool === 'laser' ? null : 'laser'); break;
      case 'x': case 'X': clearInk(); break;
      case 'm': case 'M': toggleSound(); break;
      case 'e': case 'E': enterEdit(); break;
      case 'a': case 'A': toggleToolbar(); break;
      case '?': case '/': toggleHelp(); break;
      case 'Escape':
        if (tool) setTool(null);
        else if (Timer.big) Timer.toggleBig();
        break;
    }
  }

  function editorKey(ev) {
    const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && (k === 'z' || k === 'Z')) { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if (ctrl && (k === 'y' || k === 'Y')) { ev.preventDefault(); redo(); return; }
    if (ctrl && (k === 'd' || k === 'D')) { ev.preventDefault(); duplicateEl(); return; }
    if (ctrl) return;
    if (k === 'Escape') { if (paletteEl) closePalette(); else if (selId) select(null); return; }
    if ((k === 'Delete' || k === 'Backspace') && selId) { ev.preventDefault(); deleteEl(); return; }
    if (k.indexOf('Arrow') === 0 && selId) { ev.preventDefault(); nudge(k, ev.shiftKey ? 10 : 1); return; }
    if (k === 'Enter' && selId) { const e = findEl(selId); if (e && e.type === 'text') { ev.preventDefault(); startTextEdit(e); } else if (e) onStageDbl({ target: editNodes.get(e.id).node }); return; }
    if (k === 'PageDown') { ev.preventDefault(); if (cur < deck.slides.length - 1) { cur++; selId = null; renderEditor(); } return; }
    if (k === 'PageUp') { ev.preventDefault(); if (cur > 0) { cur--; selId = null; renderEditor(); } return; }
    if (k === '?') toggleHelp();
  }

  document.addEventListener('copy', ev => {
    if (mode !== 'edit' || editingId || isTyping(ev.target) || !selId) return;
    const e = findEl(selId); if (!e) return;
    elClipboard = clone(e);
    ev.clipboardData.setData('text/plain', '[[slide-element:' + e.id + ']]');
    ev.preventDefault(); toast('요소를 복사했어요 · 다른 슬라이드에서 Ctrl+V');
  });
  document.addEventListener('paste', async ev => {
    if (isPresenter || mode !== 'edit') return;
    if (editingId) { ev.preventDefault(); const t = ev.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); return; }
    if (isTyping(ev.target)) return;
    const items = Array.from((ev.clipboardData && ev.clipboardData.items) || []);
    const imgItem = items.find(i => i.kind === 'file' && /^image\//.test(i.type));
    if (imgItem) { ev.preventDefault(); const f = imgItem.getAsFile(); addOrReplaceImage(await fileToDataURL(f)); return; }
    const text = ev.clipboardData.getData('text/plain');
    if (text && text.indexOf('[[slide-element:') === 0 && elClipboard) {
      ev.preventDefault(); const c = clone(elClipboard); c.id = uid();
      if (curSlide().elements.some(x => x.x === c.x && x.y === c.y)) { c.x += 30; c.y += 30; }
      addEl(c); return;
    }
    if (text) { ev.preventDefault(); addText(esc(text).replace(/\n/g, '<br>')); }
  });

  /* ---------- 시작 ---------- */
  async function boot() {
    const emb = JSON.parse(qs('#deck-data').textContent);
    if (isPresenter) { Presenter.boot(); return; }
    app = qs('#app');
    toastBox = h('div', { class: 'toasts' });
    overlayRoot = h('div', { style: { position: 'fixed', inset: '0', zIndex: '200', pointerEvents: 'none' } });
    const ovObs = new MutationObserver(() => { overlayRoot.style.pointerEvents = overlayRoot.children.length ? 'auto' : 'none'; });
    ovObs.observe(overlayRoot, { childList: true });
    document.body.append(toastBox, overlayRoot);

    await Store.open();
    deck = emb.deck; media = emb.media || {};
    const saved = await Store.get('save:' + emb.deck.docId);
    if (saved && saved.deck) {
      if (saved.baseRev === emb.deck.rev) { deck = saved.deck; media = saved.media || {}; }
      else {
        const choice = await modal({
          title: '이 컴퓨터에 저장된 편집본이 있어요',
          body: `<b>${fmtDate(saved.savedAt)}</b>에 자동 저장된 편집본이 있어요.<br>지금 연 파일은 그것과 다른 버전이에요. 어떤 걸로 열까요?<br><br><span class="hint">‘이 파일 내용으로 시작’을 고르면 저장된 편집본은 덮어써져요.</span>`,
          buttons: [{ label: '이 파일 내용으로 시작', value: 'file' }, { label: '저장된 편집본 이어서', value: 'saved', cls: 'primary' }]
        });
        if (choice === 'saved') { deck = saved.deck; media = saved.media || {}; deck.rev = emb.deck.rev; }
      }
    }
    baseRev = emb.deck.rev;
    deck.settings = deck.settings || emb.deck.settings || {};
    if (!deck.settings.pickerPresets && emb.deck.settings) deck.settings.pickerPresets = emb.deck.settings.pickerPresets;

    app.append(buildPresent(), buildEditor());
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', () => {
      if (mode === 'present' && presentStage) fitStage(stageWrap, presentStage);
      else if (mode === 'edit' && edStage) fitStage(edCanvas, edStage);
    });
    document.addEventListener('fullscreenchange', () => { setTimeout(() => { if (mode === 'present' && presentStage) fitStage(stageWrap, presentStage); updateChrome(); }, 60); });
    goSlide(firstVisible(), 0, true);
    if (!Store.db) toast('이 브라우저에서는 자동 저장이 안 돼요. 편집했다면 꼭 HTML로 내보내기를 해 주세요.', 5000);
    else saveNow();
  }

  boot().catch(err => {
    console.error(err);
    document.body.innerHTML = '<pre style="color:#fff;padding:24px;white-space:pre-wrap">슬라이드를 여는 중 문제가 생겼어요.\n\n' + esc(err && err.stack || err) + '</pre>';
  });
})();
