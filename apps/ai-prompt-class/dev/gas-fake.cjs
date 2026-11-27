// 앱스 스크립트 서비스(시트·속성·캐시·드라이브)를 흉내 내서 Code.gs 를 Node 에서 그대로 돌려요. 확인용.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeContext() {
  const props = {};
  const cache = {};
  class Sheet {
    constructor(name) { this.name = name; this.rows = []; }
    getName() { return this.name; }
    appendRow(a) { this.rows.push(a.slice()); }
    getLastRow() { return this.rows.length; }
    deleteRows(s, n) { this.rows.splice(s - 1, n); }
    clear() { this.rows = []; this.formulas = {}; }
    setColumnWidth() {}
    getRange(r, c, nr, nc) {
      const self = this; nr = nr || 1; nc = nc || 1;
      const fmt = { setFontSize() { return fmt; }, setFontWeight() { return fmt; }, setBackground() { return fmt; }, setWrap() { return fmt; } };
      return {
        ...fmt,
        setValues(v) { for (let i = 0; i < v.length; i++) { while (self.rows.length < r - 1 + i + 1) self.rows.push([]); for (let j = 0; j < v[i].length; j++) self.rows[r - 1 + i][c - 1 + j] = v[i][j]; } return this; },
        setFormula(f) { (self.formulas = self.formulas || {})[r + ',' + c] = f; return this; },
        getValues() {
          if (r < 1 || nr < 1 || r - 1 + nr > self.rows.length) throw new Error(`범위 밖: ${self.name} ${r},${nr} (줄 ${self.rows.length})`);
          return self.rows.slice(r - 1, r - 1 + nr).map(row => { const o = []; for (let i = 0; i < nc; i++) o.push(row[c - 1 + i] === undefined ? '' : row[c - 1 + i]); return o; });
        }
      };
    }
  }
  const ss = { sheets: {}, getSheetByName(n) { return this.sheets[n] || null; }, insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }, setActiveSheet() {}, moveActiveSheet() {}, deleteSheet(sh) { delete this.sheets[sh.getName()]; }, getSheets() { return Object.values(this.sheets); }, getId() { return 'ss1'; }, getUrl() { return 'https://docs.google.com/spreadsheets/d/ss1'; } };
  const files = [];
  const folder = {
    getId() { return 'folder1'; },
    createFile(blob) { const f = { id: 'file' + (files.length + 1), blob, trashed: false, getId() { return this.id; }, setSharing() {}, setTrashed(v) { this.trashed = v; } }; files.push(f); return f; },
    getFiles() { let i = 0; const live = files.filter(f => !f.trashed); return { hasNext: () => i < live.length, next: () => live[i++] }; }
  };
  const ctx = {
    console,
    SpreadsheetApp: { create: () => ss, openById: () => ss, getActiveSpreadsheet: () => ctx.__bound || null },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, getProperties: () => Object.assign({}, props), deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (cache[k] && cache[k].exp > Date.now() ? cache[k].v : null), put: (k, v, s) => { if (String(v).length > 100000) throw new Error('캐시 값이 너무 커요'); cache[k] = { v: String(v), exp: Date.now() + s * 1000 }; }, remove: k => { delete cache[k]; }, removeAll: ks => ks.forEach(k => delete cache[k]) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    DriveApp: { createFolder: () => folder, getFolderById: () => folder, Access: { ANYONE_WITH_LINK: 'A' }, Permission: { VIEW: 'V' } },
    Utilities: { base64Decode: s => Buffer.from(s, 'base64'), newBlob: (b, t, n) => ({ bytes: b, type: t, name: n }) },
    Logger: { log: (...a) => ctx.__log.push(a.join(' ')) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }) },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 1 } },
    __log: [], __ss: ss, __files: files, __props: props
  };
  // 속성 값은 9KB를 넘으면 안 돼요 (실제 제한)
  const sp = ctx.PropertiesService.getScriptProperties();
  const set = sp.setProperty;
  ctx.PropertiesService.getScriptProperties = () => Object.assign({}, sp, { setProperty: (k, v) => { if (String(v).length > 9000) throw new Error('속성 값이 9KB를 넘어요: ' + k); set(k, v); } });
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  return ctx;
}

// google.script.run 처럼: Date 같은 값이 섞이면 실제로는 실패하므로 여기서도 막아요
function callServer(ctx, fn, args) {
  if (typeof ctx[fn] !== 'function' || /_$/.test(fn)) throw new Error('없는 함수: ' + fn);
  const out = ctx[fn].apply(null, args);
  (function check(v, p) {
    if (v instanceof Date || Object.prototype.toString.call(v) === '[object Date]') throw new Error(`${fn}: 돌려주는 값에 Date가 있어요 (${p})`);
    if (v && typeof v === 'object') for (const k in v) check(v[k], p + '.' + k);
  })(out, fn);
  return out === undefined ? null : JSON.parse(JSON.stringify(out));
}

module.exports = { makeContext, callServer };
