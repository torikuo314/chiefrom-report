/**
 * 測試 index.html 裡的回流訊息純函式（<follow-core> 區塊）。
 *   node tests/follow.test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\/ <follow-core>[^\n]*\n([\s\S]*?)\/\/ <\/follow-core>/);
assert(m, '找不到 <follow-core> 區塊');
const { fillTemplate, padBox, coverRect, FW_TIMES } = new Function(m[1] + '; return { fillTemplate, padBox, coverRect, FW_TIMES };')();
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ✓ ' + name); };

const TPL = '親愛的{客人} 您好😊\n\n我是今天為您服務的養護師{養護師}\n\n🌿 為了讓頭皮與髮色維持良好的狀態，建議您{時間}就差不多要回來了喔！';
t('公版：客人、養護師、時間都換掉，其他文字不變', () => {
  const out = fillTemplate(TPL, { customer: '王小姐', staff: 'Hannah', time: '一個半月後' });
  assert.strictEqual(out, '親愛的王小姐 您好😊\n\n我是今天為您服務的養護師Hannah\n\n🌿 為了讓頭皮與髮色維持良好的狀態，建議您一個半月後就差不多要回來了喔！');
});
t('同一個欄位出現兩次也都會換；沒有欄位的公版原樣輸出', () => {
  assert.strictEqual(fillTemplate('{客人}{客人}', { customer: 'A' }), 'AA');
  assert.strictEqual(fillTemplate('期待下次見😊', {}), '期待下次見😊');
});
t('時間選項：預設一個月後在清單裡', () => assert(FW_TIMES.includes('一個月後') && FW_TIMES.length === 4));
t('臉部框放大後不會超出照片', () => {
  const b = padBox({ originX: 5, originY: 5, width: 100, height: 100 }, 120, 120, 0.35);
  assert(b.x >= 0 && b.y >= 0 && b.x + b.w <= 120 && b.y + b.h <= 120);
  const c = padBox({ originX: 400, originY: 300, width: 200, height: 200 }, 1600, 1200, 0.35);
  assert.deepStrictEqual(c, { x: 330, y: 216, w: 340, h: 354 }); // 上方多留 1.2 倍給頭髮：y 300−84、下緣 300+200+70
});
t('對比圖：直式照片放進框裡等比例填滿、置中裁切', () => {
  const r = coverRect(1200, 1600, 537, 1200); // 3:4 直式照 → 細長框
  assert(Math.abs(r.sw / r.sh - 537 / 1200) < 1e-9);
  assert(Math.abs(r.sx - (1200 - r.sw) / 2) < 1e-9 && r.sy === 0);
});
console.log(`\n全部通過（${pass} 項）`);
