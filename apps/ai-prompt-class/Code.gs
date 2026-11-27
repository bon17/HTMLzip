/**
 * AI 프롬프트 특강(중2) · 학생 제출·모아 보기·투표 서버 (구글 앱스 스크립트 웹 앱)
 *
 * 페이지
 *   ?            학생 페이지 (student.html)
 *   ?p=board     결과판 (board.html). &k=교사키 를 붙이면 교사 조작 단추가 보여요. &m=2 를 붙이면 그 미션을 열어요.
 *
 * 저장
 *   스프레드시트: 시트 'm{미션}_{반}' 에 제출 기록(추가만 함), 'votes' 에 투표 기록(추가만 함)
 *   드라이브 폴더: 그림 원본(링크가 있는 사람 보기)
 *   스크립트 속성: 지금 미션, 입장 코드, 교사 키, 대결 상태, 숨긴 작품
 *
 * 처음 한 번: 편집기에서 setup 을 실행하고 권한을 허용해요. 자세한 순서는 README.md.
 */

var CLASSES = 5;          // 1~5반
var MAX_NUM = 40;         // 번호 최대
var MISSIONS = 6;
var IMAGE_MISSIONS = { 1: true };
var MAX_TEXT = 6000;      // 글 결과 최대 글자 수
var SUB_COLS = 7;         // ts, num, kind, type, text, thumb, fileId

/* ---------------- 페이지 ---------------- */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var page = p.p === 'board' ? 'board' : 'student';
  return HtmlService.createHtmlOutputFromFile(page)
    .setTitle(page === 'board' ? '결과판 · AI 프롬프트 특강' : 'AI 프롬프트 특강')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------------- 처음 설정과 관리 (편집기에서 실행) ---------------- */

/** 처음 한 번 실행: 시트·폴더·교사 키·입장 코드를 만들고 로그에 알려 줘요. */
function setup() {
  var P = props_();
  ss_();
  folder_();
  if (!P.getProperty('teacherKey')) P.setProperty('teacherKey', randKey_(12));
  if (!P.getProperty('code')) P.setProperty('code', newCode_());
  if (!P.getProperty('mission')) P.setProperty('mission', '0');
  clearCache_();
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  Logger.log('입장 코드: ' + P.getProperty('code'));
  Logger.log('교사 키: ' + P.getProperty('teacherKey'));
  Logger.log('결과판(교사용): ' + (url ? url + '?p=board&k=' + P.getProperty('teacherKey') : '배포한 뒤 웹 앱 주소 + ?p=board&k=' + P.getProperty('teacherKey')));
  Logger.log('결과 시트: ' + ss_().getUrl());
}

/** 수업이 끝나면 실행: 제출·투표·그림을 모두 지우고 새 입장 코드를 만들어요. (되돌릴 수 없어요) */
function resetAll() {
  var P = props_();
  var ss = ss_();
  ss.getSheets().forEach(function (sh) {
    if (sh.getName() === 'votes' || /^m\d+_\d+$/.test(sh.getName())) {
      if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
    }
  });
  var it = folder_().getFiles();
  while (it.hasNext()) it.next().setTrashed(true);
  P.setProperty('code', newCode_());
  P.setProperty('mission', '0');
  P.setProperty('final', '0');
  P.deleteProperty('finalists');
  P.deleteProperty('hidden');
  clearCache_();
  Logger.log('모두 지웠어요. 새 입장 코드: ' + P.getProperty('code'));
}

/* ---------------- 학생용 API ---------------- */

/** 지금 상태 (학생·결과판이 몇 초마다 물어봐요) */
function getState() {
  var st = state_();
  return { mission: st.mission, final: st.final, rev: st.rev };
}

/** 입장: 코드·반·번호 확인 */
function join(code, cls, num) {
  cls = +cls; num = +num;
  if (String(code).replace(/\D/g, '') !== state_().code) return { ok: false, msg: '입장 코드가 달라요. 화면의 숫자 4개를 다시 확인해 주세요.' };
  if (!validStudent_(cls, num)) return { ok: false, msg: '반과 번호를 확인해 주세요.' };
  return { ok: true, state: getState() };
}

/** 내가 올린 것과 내 투표 */
function myStatus(cls, num, mission) {
  cls = +cls; num = +num; mission = +mission;
  if (!validStudent_(cls, num) || !validMission_(mission)) return {};
  var rows = readRows_(mission, cls, 0).rows;
  var out = { before: null, after: null, vote: null, finalVote: null };
  rows.forEach(function (r) { if (r.num === num) out[r.kind] = { type: r.type, text: r.text, thumb: r.thumb, fileId: r.fileId, ts: r.ts }; });
  var v = latestVotes_();
  out.vote = v[mission + '|' + cls + '|' + num] || null;
  out.finalVote = v['F|' + cls + '|' + num] || null;
  return out;
}

/**
 * 결과 올리기
 * p = { cls, num, mission, kind: 'before'|'after', text?, thumb?(dataURL), image?(base64 JPEG) }
 */
function submit(p) {
  var cls = +p.cls, num = +p.num, mission = +p.mission;
  if (!validStudent_(cls, num) || !validMission_(mission)) return { ok: false, msg: '반·번호·미션을 확인해 주세요.' };
  if (p.kind !== 'before' && p.kind !== 'after') return { ok: false, msg: '잘못된 요청이에요.' };
  var isImg = !!IMAGE_MISSIONS[mission];
  var text = '', thumb = '', fileId = '';
  if (isImg) {
    if (!p.image || !p.thumb) return { ok: false, msg: '사진을 골라 주세요.' };
    if (String(p.thumb).length > 45000) return { ok: false, msg: '사진이 너무 커요. 다시 골라 주세요.' };
    var blob = Utilities.newBlob(Utilities.base64Decode(p.image), 'image/jpeg', 'm' + mission + '_' + cls + '-' + num + '_' + p.kind + '_' + Date.now() + '.jpg');
    var file = folder_().createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    fileId = file.getId();
    thumb = String(p.thumb);
  } else {
    text = String(p.text || '').replace(/\r\n/g, '\n').trim();
    if (!text) return { ok: false, msg: '제미나이 답을 붙여 넣어 주세요.' };
    if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT) + '…';
  }
  sheet_(mission, cls).appendRow([new Date(), num, p.kind, isImg ? 'img' : 'text', text, thumb, fileId]);
  return { ok: true };
}

/**
 * 새 결과 받아 오기 (추가된 줄만)
 * cursors = { '3': 12 }  반별로 지금까지 읽은 줄 수
 */
function feed(mission, cursors) {
  mission = +mission;
  if (!validMission_(mission)) return { classes: {}, counts: {}, hidden: [] };
  var out = { classes: {}, counts: countsFor_(mission), hidden: hidden_() };
  Object.keys(cursors || {}).forEach(function (c) {
    var cls = +c;
    if (cls >= 1 && cls <= CLASSES) out.classes[c] = readRows_(mission, cls, +cursors[c] || 0);
  });
  return out;
}

/** 우리 반 친구 작품에 한 표 (다시 누르면 바꿀 수 있어요) */
function vote(cls, num, mission, target) {
  cls = +cls; num = +num; mission = +mission; target = +target;
  if (!validStudent_(cls, num) || !validMission_(mission) || !validStudent_(cls, target)) return { ok: false, msg: '잘못된 투표예요.' };
  if (target === num) return { ok: false, msg: '내 작품에는 투표할 수 없어요.' };
  votes_().appendRow([new Date(), String(mission), cls, num, String(target)]);
  invalidateVotes_();
  return { ok: true, counts: countsFor_(mission) };
}

/** 반 대표 대결: 후보 5작품과 지금 표 */
function getFinal() {
  var st = state_();
  if (!st.final) return { open: false };
  var list = st.finalists.map(function (k) {
    var a = k.split('-'), m = +a[0], c = +a[1], n = +a[2];
    var after = null, before = null;
    readRows_(m, c, 0).rows.forEach(function (r) { if (r.num === n) { if (r.kind === 'after') after = r; else before = r; } });
    return { key: k, mission: m, cls: c, num: n, after: after, before: before };
  });
  return { open: true, list: list, counts: finalCounts_() };
}

function voteFinal(cls, num, key) {
  cls = +cls; num = +num;
  var st = state_();
  if (!st.final || st.finalists.indexOf(key) < 0 || !validStudent_(cls, num)) return { ok: false, msg: '지금은 투표할 수 없어요.' };
  var a = key.split('-');
  if (+a[1] === cls && +a[2] === num) return { ok: false, msg: '내 작품에는 투표할 수 없어요.' };
  votes_().appendRow([new Date(), 'F', cls, num, key]);
  invalidateVotes_();
  return { ok: true, counts: finalCounts_() };
}

/* ---------------- 교사용 API (교사 키 필요) ---------------- */

function teacherInfo(key) {
  if (!isTeacher_(key)) return { ok: false };
  return { ok: true, code: state_().code, sheetUrl: ss_().getUrl() };
}

/**
 * action: 'mission'(arg: 0~6) · 'newCode' · 'final'(arg: true/false) · 'hide'(arg: 'm-c-n', 다시 하면 보이기)
 */
function teacher(key, action, arg) {
  if (!isTeacher_(key)) return { ok: false, msg: '교사 키가 맞지 않아요.' };
  var P = props_();
  if (action === 'mission') {
    var m = +arg;
    if (!(m >= 0 && m <= MISSIONS)) return { ok: false };
    P.setProperty('mission', String(m));
  } else if (action === 'newCode') {
    P.setProperty('code', newCode_());
  } else if (action === 'final') {
    if (arg) { P.setProperty('finalists', JSON.stringify(pickFinalists_())); P.setProperty('final', '1'); }
    else P.setProperty('final', '0');
  } else if (action === 'hide') {
    var h = hidden_(), i = h.indexOf(String(arg));
    if (i < 0) h.push(String(arg)); else h.splice(i, 1);
    P.setProperty('hidden', JSON.stringify(h));
    invalidateVotes_();
  } else return { ok: false };
  bumpRev_();
  clearCache_();
  return { ok: true, state: getState(), code: state_().code };
}

/* ---------------- 내부 ---------------- */

function props_() { return PropertiesService.getScriptProperties(); }

function ss_() {
  var P = props_(), id = P.getProperty('ssId'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('AI 프롬프트 특강 결과'); P.setProperty('ssId', ss.getId()); }
  return ss;
}

function folder_() {
  var P = props_(), id = P.getProperty('folderId'), f = null;
  if (id) { try { f = DriveApp.getFolderById(id); } catch (e) { f = null; } }
  if (!f) { f = DriveApp.createFolder('AI 프롬프트 특강 그림'); P.setProperty('folderId', f.getId()); }
  return f;
}

function sheet_(mission, cls) {
  var ss = ss_(), name = 'm' + mission + '_' + cls, sh = ss.getSheetByName(name);
  if (!sh) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      sh = ss.getSheetByName(name);
      if (!sh) { sh = ss.insertSheet(name); sh.appendRow(['시각', '번호', '단계', '종류', '글', '작은 그림', '그림 파일']); }
    } finally { lock.releaseLock(); }
  }
  return sh;
}

function votes_() {
  var ss = ss_(), sh = ss.getSheetByName('votes');
  if (!sh) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      sh = ss.getSheetByName('votes');
      if (!sh) { sh = ss.insertSheet('votes'); sh.appendRow(['시각', '미션', '반', '번호', '뽑은 작품']); }
    } finally { lock.releaseLock(); }
  }
  return sh;
}

/** 시트에서 cursor 다음 줄부터 읽어요 */
function readRows_(mission, cls, cursor) {
  var sh = ss_().getSheetByName('m' + mission + '_' + cls);  // 읽을 때는 시트를 만들지 않아요
  if (!sh) return { rows: [], cursor: cursor };
  var n = Math.max(0, sh.getLastRow() - 1), rows = [];
  if (n > cursor) {
    sh.getRange(cursor + 2, 1, n - cursor, SUB_COLS).getValues().forEach(function (v) {
      rows.push({ ts: v[0] instanceof Date ? v[0].getTime() : +new Date(v[0]), num: +v[1], kind: String(v[2]), type: String(v[3]), text: String(v[4] || ''), thumb: String(v[5] || ''), fileId: String(v[6] || '') });
    });
  }
  return { rows: rows, cursor: Math.max(n, cursor) };
}

/** 투표 기록에서 사람마다 마지막 표만 남겨요: key 'mission|cls|num' → target */
function latestVotes_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('votes');
  if (hit) return JSON.parse(hit);
  var sh = votes_(), n = sh.getLastRow() - 1, out = {};
  if (n > 0) sh.getRange(2, 1, n, 5).getValues().forEach(function (v) { out[String(v[1]) + '|' + (+v[2]) + '|' + (+v[3])] = String(v[4]); });
  try { cache.put('votes', JSON.stringify(out), 3); } catch (e) {}
  return out;
}

function invalidateVotes_() { CacheService.getScriptCache().remove('votes'); }

/** 미션 하나의 표: { 반: { 번호: 표 수 } } (숨긴 작품 제외) */
function countsFor_(mission) {
  var v = latestVotes_(), h = hidden_(), out = {};
  Object.keys(v).forEach(function (k) {
    var a = k.split('|');
    if (a[0] !== String(mission)) return;
    var c = a[1], t = v[k];
    if (h.indexOf(mission + '-' + c + '-' + t) >= 0) return;
    out[c] = out[c] || {};
    out[c][t] = (out[c][t] || 0) + 1;
  });
  return out;
}

function finalCounts_() {
  var v = latestVotes_(), out = {};
  Object.keys(v).forEach(function (k) { if (k.indexOf('F|') === 0) out[v[k]] = (out[v[k]] || 0) + 1; });
  return out;
}

/** 반마다 오늘 표를 가장 많이 받은 작품 하나 (After를 올린 작품만) */
function pickFinalists_() {
  var v = latestVotes_(), h = hidden_(), tally = {};
  Object.keys(v).forEach(function (k) {
    var a = k.split('|');
    if (a[0] === 'F') return;
    var key = a[0] + '-' + a[1] + '-' + v[k];
    if (h.indexOf(key) < 0) tally[key] = (tally[key] || 0) + 1;
  });
  var out = [];
  for (var c = 1; c <= CLASSES; c++) {
    var best = null, bestN = 0;
    Object.keys(tally).forEach(function (key) {
      var a = key.split('-');
      if (+a[1] !== c) return;
      if (tally[key] > bestN || (tally[key] === bestN && best && key < best)) { best = key; bestN = tally[key]; }
    });
    if (best) {
      var a = best.split('-'), hasAfter = false;
      readRows_(+a[0], c, 0).rows.forEach(function (r) { if (r.num === +a[2] && r.kind === 'after') hasAfter = true; });
      if (hasAfter) out.push(best);
    }
  }
  return out;
}

function hidden_() {
  try { return JSON.parse(props_().getProperty('hidden') || '[]'); } catch (e) { return []; }
}

function state_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('state');
  if (hit) return JSON.parse(hit);
  var p = props_().getProperties();
  var st = {
    mission: +(p.mission || 0),
    code: p.code || '',
    final: p.final === '1',
    finalists: p.finalists ? JSON.parse(p.finalists) : [],
    rev: +(p.rev || 0)
  };
  try { cache.put('state', JSON.stringify(st), 4); } catch (e) {}
  return st;
}

function clearCache_() { CacheService.getScriptCache().removeAll(['state', 'votes']); }
function bumpRev_() { var P = props_(); P.setProperty('rev', String(+(P.getProperty('rev') || 0) + 1)); }

function isTeacher_(key) { var k = props_().getProperty('teacherKey'); return !!k && String(key) === k; }
function validStudent_(cls, num) { return cls >= 1 && cls <= CLASSES && num >= 1 && num <= MAX_NUM && Math.floor(cls) === cls && Math.floor(num) === num; }
function validMission_(m) { return m >= 1 && m <= MISSIONS && Math.floor(m) === m; }
function newCode_() { return String(1000 + Math.floor(Math.random() * 9000)); }
function randKey_(n) { var s = '', a = 'abcdefghjkmnpqrstuvwxyz23456789'; for (var i = 0; i < n; i++) s += a.charAt(Math.floor(Math.random() * a.length)); return s; }
