// 사용법: node build.js  →  AI프롬프트특강_슬라이드.html 생성
const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const tpl = read('src/template.html');
const css = read('src/style.css');
const js = read('src/icons.js') + '\n' + read('src/engine.js');
delete require.cache[require.resolve('./src/deck.js')];
const deck = require('./src/deck.js')();

if (/<\/script/i.test(js) || /<\/style/i.test(css)) throw new Error('script/style 닫는 태그가 소스 안에 있어요');

const data = JSON.stringify({ deck, media: {} }).replace(/</g, '\\u003c');
const out = tpl
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js)
  .replace('__DECK__', () => data);

const target = path.join(root, 'AI프롬프트특강_슬라이드.html');
fs.writeFileSync(target, out);
console.log('built', target, (out.length / 1024).toFixed(1) + 'KB', deck.slides.length + ' slides');
