/* 슬라이드 내용 (빌드할 때 JSON으로 바뀌어 HTML 안에 들어가요)
   - 글꼴: 기본은 나눔고딕(본문), FUN = 주아(제목·강조)
   - 그림: images/ 폴더의 파일을 불러와요 (docs/이미지_프롬프트.md 참고) */
const { icoSvg } = require('./icons.js');

const C = {
  ink: '#1C2340', sub: '#5B6280', cream: '#FFF8EE', orange: '#FF7A1A', blue: '#2F7BFF', purple: '#8A5CFF',
  green: '#17B26A', pink: '#FF4D8D', yellow: '#FFC21A', teal: '#12B5B0', red: '#F04438', navy: '#151B3A', white: '#FFFFFF'
};

const ic = (name) => icoSvg(name);
const badge = (name, color, size) => `<span class="ico-badge" style="--c:${color}${size ? ';font-size:' + size : ''}">${icoSvg(name)}</span>`;
const line = (name, color, text) => `<span class="ico-line" style="--c:${color}">${icoSvg(name)}<span>${text}</span></span>`;
const chip = (text, color, dark) => `<span class="chip" style="--c:${color}${dark ? ';--fc:#1C2340' : ''}">${text}</span>`;

let seq = 0, sseq = 0;
const nid = () => 'e' + (++seq).toString(36);

function T(x, y, w, h, html, style, ex) {
  return Object.assign({ id: nid(), type: 'text', x, y, w, h, html,
    style: Object.assign({ fs: 46, fw: 800, color: C.ink, align: 'left', valign: 'top', lh: 1.45 }, style || {}) }, ex || {});
}
const FUN = { font: 'fun', fw: 400 };
const CARD = (x, y, w, h, html, style, ex) => T(x, y, w, h, html, Object.assign({
  bg: '#FFFFFF', border: `4px solid ${C.ink}`, radius: 28, pad: '34px 40px', shadow: `8px 8px 0 ${C.ink}` }, style || {}), ex);
const BAR = (x, y, w, h, html, bg, color, ex, style) => T(x, y, w, h, html, Object.assign({
  bg, color: color || '#FFFFFF', radius: 28, pad: '18px 40px', align: 'center', valign: 'middle', fs: 54,
  border: `4px solid ${C.ink}`, shadow: `8px 8px 0 ${C.ink}`, lh: 1.3 }, FUN, style || {}), ex);
const PILL = (x, y, w, h, text, bg, color, ex, style) => T(x, y, w, h, text, Object.assign({
  bg: bg || C.ink, color: color || '#FFFFFF', radius: 999, align: 'center', valign: 'middle', fs: 34, pad: '0 24px', lh: 1.2 }, FUN, style || {}), ex);
const TITLE = (html, ex, style) => T(120, 72, 1680, 130, html, Object.assign({ fs: 92, lh: 1.15 }, FUN, style || {}), Object.assign({ anim: 'letters' }, ex || {}));
const CIRCLE = (x, y, d, bg, ex) => T(x, y, d, d, '', { bg, radius: '50%' }, ex);
// 그림 칸: file = images/ 안의 파일 이름
const IMGF = (x, y, w, h, file, placeholder, ex, style) => Object.assign({ id: nid(), type: 'image', x, y, w, h, src: 'images/' + file, fit: 'contain', placeholder, style: style || {} }, ex || {});
const FRAME = { radius: 24, border: `4px solid ${C.ink}`, shadow: `8px 8px 0 ${C.ink}`, bg: '#FFFFFF' };
const VIDEO = (x, y, w, h, src, label) => ({ id: nid(), type: 'video', x, y, w, h, src, label, style: { radius: 24 } });
const WID = (type, x, y, w, h, config, ex) => Object.assign({ id: nid(), type, x, y, w, h, config, style: {} }, ex || {});
const S = (bg, elements, notes) => ({ id: 's' + (++sseq), bg, elements, notes: notes || '' });

const ING = [
  { name: '디테일', icon: 'palette', img: 'images/s16-ing-detail.png', color: C.orange, label: '미션 1' },
  { name: '상황', icon: 'globe', img: 'images/s16-ing-situation.png', color: C.blue, label: '미션 2' },
  { name: '역할', icon: 'badge', img: 'images/s16-ing-role.png', color: C.purple, label: '미션 3' },
  { name: '모양', icon: 'layout', img: 'images/s16-ing-shape.png', color: C.green, label: '미션 4' },
  { name: '질문받기', icon: 'chatq', img: 'images/s16-ing-question.png', color: C.pink, label: '미션 5' },
  { name: '내 이야기', icon: 'heart', img: 'images/s16-ing-story.png', color: C.yellow, label: '미션 6' },
  { name: '안전장치', icon: 'shield', img: 'images/s16-ing-safety.png', color: C.teal, label: '보너스', bonus: true }
];
const chips = ING.slice(0, 6).map(i => chip(ic(i.icon) + i.name, i.color, i.color === C.yellow)).join('');

const ROLES = ['축구 해설위원', '아이돌 리더', '래퍼', '유치원 선생님', '게임 속 NPC', '요리 유튜버', '기상 캐스터', '홈쇼핑 쇼호스트', '조선시대 선비', '탐정'];

// 챕터 전환 화면 (모션 그래픽)
const chapter = (cfg) => [WID('chapter', 0, 0, 1920, 1080, cfg)];

function videoSlide(title, src, label, caption) {
  return [
    PILL(120, 56, 160, 66, '영상', C.orange, '#FFFFFF', {}, { fs: 34 }),
    T(310, 56, 1400, 66, title, Object.assign({ fs: 56, color: '#FFFFFF', valign: 'middle' }, FUN)),
    VIDEO(240, 160, 1440, 810, src, label),
    T(240, 992, 1440, 50, caption, { fs: 28, fw: 700, color: 'rgba(255,255,255,.65)', align: 'center' })
  ];
}

// 그림 + 글 카드 (그림이 없으면 발표 화면에서는 아이콘으로 보여요)
function picCard(x, y, w, h, step, anim, file, fb, fbColor, title, body, bg) {
  return [
    CARD(x, y, w, h, `<div class="ct">${title}</div>${body}`, { fs: 44, align: 'center', valign: 'bottom', bg: bg || '#FFFFFF', lh: 1.45, pad: '30px 34px 40px' }, { step, anim }),
    IMGF(x + 40, y + 26, w - 80, Math.round(h * 0.5), file, title + ' 그림', { step, anim, fallback: fb, fallbackColor: fbColor, z: 2 })
  ];
}

const missionRow = (y, step, n, color, title, body) => CARD(120, y, 1100, 210,
  `<div style="display:flex;gap:30px;align-items:center"><div class="num fun" style="background:${color}">${n}</div><div><div class="ct" style="margin:0 0 .2em">${title}</div><div style="font-size:.85em">${body}</div></div></div>`,
  { fs: 42, valign: 'middle', pad: '26px 34px' }, { step, anim: 'left' });

module.exports = function buildDeck() {
  seq = 0; sseq = 0;
  const slides = [
    /* 1 표지 */
    S('cream', [
      CIRCLE(1460, -170, 640, C.orange, { anim: 'zoom' }),
      CIRCLE(1650, 600, 420, C.blue, { anim: 'zoom', delay: 120 }),
      CIRCLE(-170, 800, 420, C.yellow, { anim: 'zoom', delay: 200 }),
      CIRCLE(1300, 640, 130, C.purple, { anim: 'pop', delay: 320 }),
      CIRCLE(1250, 150, 86, C.pink, { anim: 'pop', delay: 400 }),
      IMGF(1080, 230, 780, 660, 's01-hero.png', '표지 그림 (학생과 AI 로봇)', { anim: 'zoom', delay: 450, optional: true, z: 3 }),
      PILL(160, 230, 580, 76, '2026 중학교 2학년 AI 특강', C.ink, '#FFFFFF', { anim: 'up', delay: 100 }, { fs: 36 }),
      T(150, 335, 1100, 340, 'AI 잘 쓰면,<br><span style="color:#FF7A1A">나도 잘 된다!</span>', Object.assign({ fs: 156, lh: 1.08 }, FUN), { anim: 'letters', delay: 250, z: 4 }),
      T(160, 700, 1100, 80, '‘써줘’ 말고, AI에게 제대로 시키는 법', { fs: 56, fw: 800, color: C.sub }, { anim: 'up', delay: 900 }),
      T(160, 815, 1250, 90, chips, { fs: 32 }, { anim: 'up', delay: 1050 }),
      T(160, 960, 1000, 56, '강사 김보은 · 2026. ○○. ○○.', { fs: 30, fw: 700, color: C.sub }, { anim: 'fade', delay: 1200 })
    ], '인사하고 오늘 주제 소개.\n“오늘은 AI를 혼내는 시간이 아니라, AI를 더 잘 부리는 법을 배우는 시간이에요.”\n(날짜는 편집 모드에서 고쳐 주세요)'),

    /* 2 오늘의 질문 */
    S('cream', [
      PILL(120, 90, 270, 68, '오늘의 질문', C.orange, '#FFFFFF', {}, { fs: 34 }),
      T(120, 185, 900, 290, '솔직히…<br>이렇게 해 본 사람?', Object.assign({ fs: 108, lh: 1.15 }, FUN), { anim: 'letters' }),
      WID('chat', 1060, 70, 740, 940, {
        title: 'AI 채팅',
        messages: [
          { who: 'me', type: 'doc', text: '국어 수행평가\n학습지' },
          { who: 'me', text: '써줘' },
          { who: 'ai', text: '물론이죠! 요청하신 내용으로 바로 작성해 드릴게요.' }
        ]
      }, { steps: 3 }),
      T(120, 540, 900, 160, `<span class="ico-line">${badge('hand', C.orange, '.55em')}<span>해 본 사람, 손!</span></span>`, Object.assign({ fs: 92, color: C.orange, valign: 'middle' }, FUN), { step: 4, anim: 'swing' }),
      T(120, 740, 900, 250, '혼내려는 게 아니에요.<br>같은 AI로 <span class="hl">훨씬 좋은 결과</span>를 내는 법을 배워 볼 거예요.', { fs: 46, fw: 800, lh: 1.55 }, { step: 5, anim: 'up' })
    ], '클릭 1~3: 채팅이 하나씩 나와요 (학습지 사진 → “써줘” → AI 답).\n클릭 4: “해 본 사람, 손!” — 실제로 손 들게 하기.\n클릭 5: 혼내는 수업이 아니라는 점을 꼭 말해 주기.'),

    /* 3 PART 1 */
    S('blue', chapter({ part: 'PART 1', title: 'AI는 어떤 친구일까?', sub: 'AI가 말을 만드는 방법을 알면, 왜 틀리는지도 보여요', num: '1', color: C.blue, accent: C.yellow }),
      'PART 1: AI가 말을 만드는 방식부터 알아봐요.\n(화면이 열리는 애니메이션이 끝날 때까지 2초쯤 기다렸다가 말하기)'),

    /* 4 검색 기계가 아니다 */
    S('cream', [
      TITLE('AI는 검색 기계가 아니에요'),
      ...picCard(120, 250, 800, 580, 1, 'left', 's04-search.png', 'search', C.blue, '검색', '이미 있는 정답을 <b style="color:#2F7BFF">찾아</b> 온다'),
      ...picCard(1000, 250, 800, 580, 2, 'right', 's04-create.png', 'pencil', C.orange, '생성형 AI', '그럴듯한 다음 말을 <b style="color:#FF7A1A">만들어</b> 낸다', '#FFF1E5'),
      BAR(120, 885, 1680, 140, 'AI는 정답을 ‘찾는’ 게 아니라, 그럴듯한 말을 ‘만들어요’', C.ink, '#FFFFFF', { step: 3, anim: 'up' })
    ], '검색(찾기)과 생성(만들기)의 차이.\n“포털 검색이랑 AI 채팅은 뭐가 다를까?” 하고 먼저 물어봐도 좋아요.'),

    /* 5 자동완성 체험 */
    S('cream', [
      PILL(120, 70, 250, 66, '30초 체험', C.green, '#FFFFFF', {}, { fs: 34 }),
      T(120, 150, 1680, 120, '추천 단어만 눌러서 문장 만들기', Object.assign({ fs: 84 }, FUN), { anim: 'letters' }),
      CARD(120, 300, 620, 560, '<div class="ct">해 보기</div><ol class="steps"><li>태블릿 메모장 열기</li><li>키보드 위 <b style="color:#17B26A">추천 단어</b>만 계속 누르기</li><li>어떤 문장이 나왔나요?</li></ol>', { fs: 46, lh: 1.5 }),
      WID('autocomplete', 800, 290, 1000, 590, {
        words: ['오늘', '학교에서', '친구랑', '떡볶이를', '먹었는데', '진짜', '맛있어서', '내일', '또', '가고', '싶다'],
        pool: ['그리고', '나는', '근데', '너무', '우리', '집에', 'ㅋㅋ', '좋아', '이제', '완전', '혹시', '많이']
      }, { steps: 1 }),
      BAR(120, 915, 1680, 125, '생성형 AI는 <span style="color:#FFC21A">엄청나게 똑똑한 자동완성</span>이에요', C.ink, '#FFFFFF', { step: 2, anim: 'up' })
    ], '학생들이 30초 동안 태블릿 메모장에서 추천 단어만 눌러 보게 해요.\n클릭 1: 화면 예시 문장이 자동으로 만들어져요.\n몇 명에게 나온 문장을 읽어 보게 하면 웃음 포인트!\n클릭 2: AI도 이렇게 ‘다음에 올 그럴듯한 말’을 이어 붙인다고 정리.'),

    /* 6 그럴듯함 ≠ 사실 */
    S('cream', [
      TITLE('그럴듯하다고 사실은 아니에요'),
      CARD(120, 260, 800, 470, `<div class="ic">${badge('eye', C.sub)}</div><div style="font-size:.7em">AI가 먼저 보는 것</div><div class="fun" style="font-size:1.55em;margin-top:.1em">그럴듯한가?</div>`, { fs: 58, align: 'center', valign: 'middle', lh: 1.35 }, { step: 1, anim: 'left' }),
      CARD(1000, 260, 800, 470, `<div class="ic">${badge('question', C.red)}</div><div style="font-size:.7em">AI가 잘 확인하지 못하는 것</div><div class="fun" style="font-size:1.55em;margin-top:.1em;color:#F04438">진짜 사실인가?</div>`, { fs: 58, align: 'center', valign: 'middle', bg: '#FFF0EF', lh: 1.35 }, { step: 2, anim: 'right' }),
      T(120, 790, 1680, 230, '그래서 <span style="color:#F04438">없는 일도 자신 있게</span> 지어낼 때가 있어요.<br>정말 그런지 영상으로 볼까요?', Object.assign({ fs: 60, align: 'center', valign: 'middle', lh: 1.45 }, FUN), { step: 3, anim: 'up' })
    ], 'AI는 ‘그럴듯함’을 먼저 본다 → 그래서 틀릴 수 있다.\n다음 슬라이드 영상으로 연결해요.'),

    /* 7 영상: 맥북 */
    S('navy', videoSlide('챗GPT의 아무말 대잔치', '영상1_맥북던짐사건.mp4', '맥북 던짐 사건 (1분 15초)', '1분 15초 · 영상을 클릭하면 재생돼요'),
      '영상 1분 15초. 영상 아래 재생 버튼을 눌러요.\n끝나면 “어떤 거짓말이 제일 웃겼어?” 하고 물어보기.'),

    /* 8 할루시네이션 (다시 구성) */
    S('cream', [
      CIRCLE(110, 150, 780, '#FFE3DF', { anim: 'zoom' }),
      IMGF(90, 120, 820, 840, 's08-hallucination.png', '할루시네이션 그림 (자신만만하게 거짓말하는 로봇)', { anim: 'zoom', delay: 150, fallback: 'alert', fallbackColor: C.red }),
      PILL(950, 110, 300, 68, '이름 붙이기', C.red, '#FFFFFF', {}, { fs: 34 }),
      T(950, 195, 860, 120, 'AI의 당당한 거짓말', Object.assign({ fs: 84, lh: 1.15 }, FUN), { anim: 'letters' }),
      T(950, 310, 860, 160, '할루시네이션', Object.assign({ fs: 138, color: C.red, lh: 1.1 }, FUN), { anim: 'pop', delay: 700 }),
      BAR(950, 490, 860, 120, '없는 사실을 진짜처럼 지어내는 것', C.yellow, C.ink, { anim: 'up', delay: 1000 }, { fs: 50 }),
      CARD(950, 635, 860, 395, '<div class="ct">영상 속 AI의 거짓말</div><ul class="clean xlist"><li>세종대왕 맥북 던짐 사건</li><li>조선시대 노래 ‘하입보이’</li><li>신사임당이 23번째 왕?</li></ul>', { fs: 46, lh: 1.45 }, { step: 1, anim: 'up' }),
      T(130, 880, 760, 120, '자신 있게 말해도 틀릴 수 있어요!', Object.assign({ fs: 50, bg: C.ink, color: '#FFFFFF', radius: 24, align: 'center', valign: 'middle', pad: '0 24px' }, FUN), { step: 2, anim: 'swing', rot: -3, z: 5 })
    ], '할루시네이션이라는 이름을 붙여 줘요.\n클릭 1: 영상 속 예시 다시 짚기.\n클릭 2: 자신 있게 말해도 틀릴 수 있다.'),

    /* 9 안 속는 법 */
    S('cream', [
      TITLE('AI의 거짓말에 안 속는 법'),
      ...picCard(120, 245, 520, 560, 1, 'up', 's09-doubt.png', 'search', C.blue, '① 의심하기', '숫자·이름·날짜는<br>한 번 더 의심'),
      ...picCard(700, 245, 520, 560, 2, 'up', 's09-check.png', 'book', C.purple, '② 확인하기', '교과서·믿을 만한<br>사이트와 비교'),
      ...picCard(1280, 245, 520, 560, 3, 'up', 's09-safety.png', 'shield', C.teal, '③ 안전장치 문장', '“확실하지 않으면<br>모른다고 말해 줘”', '#E7FAF9'),
      BAR(120, 850, 1680, 170, `<span class="ico-line">${ic('gift')}<span>보너스 재료 획득! <span style="color:#FFF3B0">안전장치</span></span></span><div style="font-size:.6em;margin-top:.3em">프롬프트 끝에 붙이면 AI가 지어낼 가능성이 줄어요</div>`, C.teal, '#FFFFFF', { step: 4, anim: 'pop' })
    ], '세 가지 방법을 하나씩.\n③ 안전장치 문장은 오늘 미션 내내 쓰는 보너스 재료예요.\n클릭 4: 보너스 재료 획득.'),

    /* 10 PART 2 */
    S('purple', chapter({ part: 'PART 2', title: '프롬프트가 뭘까?', sub: 'AI에게 ‘잘’ 말하는 법', num: '2', color: C.purple, accent: C.yellow, stripes: ['#FFC21A', '#2F7BFF', '#FF4D8D', '#FFFFFF', C.purple] }),
      'PART 2: 프롬프트가 무엇인지, 왜 잘 써야 하는지.\n(애니메이션이 끝날 때까지 2초쯤 기다리기)'),

    /* 11 프롬프트란 */
    S('cream', [
      PILL(120, 70, 340, 66, '프롬프트 (Prompt)', C.purple, '#FFFFFF', {}, { fs: 34 }),
      T(120, 150, 1680, 250, 'AI에게 하는 말·지시·질문,<br>전부 <span style="color:#8A5CFF">프롬프트</span>예요', Object.assign({ fs: 92, lh: 1.15 }, FUN), { anim: 'letters' }),
      T(120, 425, 1680, 110, '<span class="bubble-q">“세종대왕 알려줘”</span><span class="bubble-q">“고양이 그려줘”</span><span class="bubble-q">“이거 써줘”</span>', { fs: 50 }, { step: 1, anim: 'up' }),
      CARD(120, 590, 1680, 410, `<div class="ct ico-line" style="--c:#FFC21A">${ic('bulb')}<span>원래 무슨 뜻일까?</span></div><div>‘prompt’에는 <b style="color:#8A5CFF">‘대사를 일러 주다’</b>라는 뜻이 있어요.<br>연극에서 배우에게 대사를 몰래 알려 주는 사람이 <b style="color:#8A5CFF">프롬프터</b>예요.</div><div class="fun" style="margin-top:.5em;color:#8A5CFF;font-size:1.15em">→ 프롬프트 = AI가 무엇을 말할지 알려 주는 신호!</div>`, { fs: 44, lh: 1.5, pad: '34px 480px 34px 44px' }, { step: 2, anim: 'up' }),
      IMGF(1390, 560, 400, 420, 's11-prompter.png', '프롬프터 그림', { step: 2, anim: 'zoom', delay: 200, fallback: 'chatq', fallbackColor: '#8A5CFF', z: 3 })
    ], '프롬프트 = AI에게 하는 말 전부.\n클릭 1: 우리가 평소에 쓰는 프롬프트 예시.\n클릭 2: 어원은 가볍게.'),

    /* 12 영상: 전과자 */
    S('navy', videoSlide('사람한테 컴퓨터처럼 시켜 보면?', '영상2_전과자.mp4', '전과자 컴퓨터공학과 (33초)', '33초 · 영상을 클릭하면 재생돼요'),
      '영상 33초. 사람을 컴퓨터처럼 말로만 움직여 볶음밥을 먹게 하는 장면.\n“컴퓨터는 말한 것만 한다”를 웃으면서 보기.'),

    /* 13 영상 되짚기 */
    S('cream', [
      TITLE('왜 처음엔 실패했을까?'),
      CARD(120, 235, 800, 580, `<span class="tag bad">${ic('x')} 실패</span><div class="fun" style="font-size:1.45em;margin:.5em 0 .55em;line-height:1.3">“숟가락 집어서<br>볶음밥 퍼서 먹어”</div><div>어떻게 집으라는 건지 몰라서<br>시작부터 막혔어요</div>`, { fs: 44, bg: '#FFF0EF', border: '4px solid #F04438', shadow: '8px 8px 0 #F04438', lh: 1.5 }, { step: 1, anim: 'left' }),
      CARD(1000, 235, 800, 580, `<span class="tag good">${ic('check')} 성공</span><div class="fun" style="font-size:1.15em;margin:.5em 0 .55em;line-height:1.4">“다섯 손가락을 폈다가, 숟가락을 가운데 놓고 접어 봐.”<br>“그리고 볶음밥 쪽으로 숟가락을 가져다 놔.”</div><div>하나하나 자세히 말해 주니까 성공!</div>`, { fs: 44, bg: '#EAFBF2', border: '4px solid #17B26A', shadow: '8px 8px 0 #17B26A', lh: 1.5 }, { step: 2, anim: 'right' }),
      BAR(120, 870, 1680, 140, '컴퓨터는 <span style="color:#FFC21A">내가 말한 만큼만</span> 해요', C.ink, '#FFFFFF', { step: 3, anim: 'up' }, { fs: 62 })
    ], '실패한 말과 성공한 말을 비교해요.\n“무엇이 달랐을까?” 물어보면 → “자세히, 하나하나”가 나오면 성공.'),

    /* 14 AI도 똑같다 (다시 구성) */
    S('cream', [
      TITLE('AI도 똑같아요', { w: 1100 }),
      T(120, 190, 1680, 80, '내가 말해 주지 않은 건 몰라요', Object.assign({ fs: 58, color: C.blue }, FUN), { anim: 'up', delay: 500 }),
      CARD(120, 310, 520, 470, `<div class="ct">AI가 받은 것</div><div style="line-height:1.6">${line('camera', C.blue, '사진 1장')}</div><div class="fun" style="font-size:2.3em;color:#2F7BFF;line-height:1.2;margin-top:.15em">“써줘”</div>`, { fs: 46, align: 'center', valign: 'middle' }, { step: 1, anim: 'left' }),
      IMGF(720, 330, 480, 440, 's14-robot.png', '고민하는 AI 로봇 그림', { step: 2, anim: 'zoom', fallback: 'question', fallbackColor: C.blue }),
      T(690, 300, 240, 86, '몇 학년?', Object.assign({ fs: 44, bg: '#FFFFFF', border: `4px solid ${C.ink}`, radius: 999, align: 'center', valign: 'middle', shadow: `5px 5px 0 ${C.ink}` }, FUN), { step: 2, anim: 'pop', delay: 300, z: 4, rot: -6 }),
      T(990, 300, 270, 86, '무슨 과목?', Object.assign({ fs: 44, bg: '#FFFFFF', border: `4px solid ${C.ink}`, radius: 999, align: 'center', valign: 'middle', shadow: `5px 5px 0 ${C.ink}` }, FUN), { step: 2, anim: 'pop', delay: 500, z: 4, rot: 5 }),
      T(695, 700, 220, 86, '몇 자?', Object.assign({ fs: 44, bg: '#FFFFFF', border: `4px solid ${C.ink}`, radius: 999, align: 'center', valign: 'middle', shadow: `5px 5px 0 ${C.ink}` }, FUN), { step: 2, anim: 'pop', delay: 700, z: 4, rot: 4 }),
      T(975, 700, 280, 86, '내 경험은?', Object.assign({ fs: 44, bg: '#FFFFFF', border: `4px solid ${C.ink}`, radius: 999, align: 'center', valign: 'middle', shadow: `5px 5px 0 ${C.ink}` }, FUN), { step: 2, anim: 'pop', delay: 900, z: 4, rot: -4 }),
      CARD(1280, 310, 520, 470, '<div class="ct" style="color:#F04438">그래서 나온 답</div><ul class="clean xlist"><li>대학생 같은 말투</li><li>지어낸 내 경험</li><li>빠진 과제 조건</li></ul>', { fs: 46, bg: '#FFF0EF', lh: 1.5 }, { step: 3, anim: 'right' }),
      BAR(120, 840, 1680, 180, 'AI가 못해서가 아니라 <span style="color:#FFC21A">내 상황을 몰라서</span> 틀린 거예요<br>상황을 알려 주는 것 = 프롬프트!', C.blue, '#FFFFFF', { step: 4, anim: 'up' }, { fs: 52 })
    ], '“써줘”만 받은 AI의 입장이 되어 보기.\n클릭 2: 로봇 주변으로 AI가 모르는 것들이 하나씩 튀어나와요.\n‘평균적인 답’이 아니라 ‘내 숙제에 안 맞는, 틀린 답’이 나온다는 점을 강조.\n앞 영상의 “숟가락 집어서 먹어”와 같은 상황이라고 연결.'),

    /* 15 같은 AI, 다른 결과 */
    S('cream', [
      TITLE('같은 AI, 다른 결과'),
      T(120, 200, 820, 110, '“고양이 그려줘”', Object.assign({ fs: 58, bg: '#FFFFFF', border: `4px solid ${C.ink}`, radius: 999, align: 'center', valign: 'middle', shadow: `6px 6px 0 ${C.ink}` }, FUN)),
      IMGF(120, 340, 820, 540, 's15-cat-simple.png', '‘고양이 그려줘’ 결과', { fit: 'cover' }, FRAME),
      T(980, 192, 820, 130, [chip('웹툰 그림체', C.orange), chip('교복', C.blue), chip('매점', C.green), chip('마지막 빵', C.pink), chip('깜짝 놀란 표정', C.yellow, true)].join(''), { fs: 34, valign: 'middle', lh: 1.15 }, { step: 1, anim: 'up' }),
      IMGF(980, 340, 820, 540, 's15-cat-detail.png', '재료를 넣은 프롬프트 결과', { step: 1, anim: 'zoom', fit: 'cover' }, FRAME),
      BAR(120, 925, 1680, 110, '차이는 딱 하나, <span style="color:#1C2340">프롬프트</span>!', C.orange, '#FFFFFF', { step: 2, anim: 'pop' }, { fs: 60 })
    ], '왼쪽: “고양이 그려줘” 한 줄로 만든 그림.\n클릭 1: 재료(웹툰 그림체, 교복, 매점, 마지막 빵, 놀란 표정)를 넣은 그림.\n클릭 2: 결론.\n그림은 images 폴더의 s15-cat-simple.png / s15-cat-detail.png 파일이에요.'),

    /* 16 오늘 모을 재료 */
    S('cream', [
      TITLE('오늘 모을 프롬프트 재료'),
      T(120, 200, 1680, 80, '미션을 하나 깰 때마다 재료가 하나씩 열려요', { fs: 48, fw: 800, color: C.sub }),
      WID('ingredients', 120, 320, 1680, 520, {
        items: ING.map(i => Object.assign({}, i, i.bonus ? { open: true } : {})),
        unlock: []
      }, { steps: 0 }),
      BAR(120, 890, 1680, 125, '재료를 많이 넣을수록 <span style="color:#FFC21A">내가 원하는 답</span>에 가까워져요', C.ink, '#FFFFFF', { step: 1, anim: 'up' })
    ], '오늘 모을 재료 6개 + 보너스(안전장치, 이미 획득).\n미션마다 하나씩 열린다고 예고해요.'),

    /* 17 미션 진행 방법 */
    S('cream', [
      TITLE('미션은 이렇게 진행해요', { w: 1100 }),
      missionRow(240, 1, 1, C.sub, '1차 — 한 줄로 시켜 보기', '평소처럼 짧게! 결과를 <b>Before</b>에 올려요'),
      missionRow(490, 2, 2, C.orange, '2차 — 재료 넣어서 다시', '재료를 고르면 프롬프트가 완성 → <b>After</b>에 올려요'),
      missionRow(740, 3, 3, C.blue, '비교 — 뭐가 달라졌지?', '큰 화면에서 Before와 After를 나란히!'),
      WID('qr', 1300, 240, 500, 500, { label: '제출 페이지 QR' }),
      T(1300, 780, 500, 170, '<div style="font-size:.6em">입장 코드</div><div class="fun" style="font-size:1.6em;letter-spacing:.15em">- - - -</div>', { fs: 48, align: 'center', valign: 'middle', bg: '#FFFFFF', border: `4px solid ${C.ink}`, radius: 28, shadow: `8px 8px 0 ${C.ink}` })
    ], '미션 진행 방법 안내.\nQR과 입장 코드는 제출 페이지를 연결하면 자동으로 채워져요 (3단계에서 연결).')
  ];

  return {
    docId: 'ai-prompt-class-g8',
    rev: 'b' + Date.now().toString(36),
    title: 'AI 잘 쓰면, 나도 잘 된다! (중2)',
    settings: {
      pickerList: '1반\n2반\n3반\n4반\n5반',
      pickerPresets: {
        '1~5반': '1반\n2반\n3반\n4반\n5반',
        '번호 1~30': Array.from({ length: 30 }, (_, i) => (i + 1) + '번').join('\n'),
        '미션 3 역할 카드': ROLES.join('\n')
      }
    },
    slides
  };
};
