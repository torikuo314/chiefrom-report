/**
 * 測試 index.html 裡的回流訊息純函式（<follow-core> 區塊）。
 *   node tests/follow.test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\/ <follow-core>[^\n]*\n([\s\S]*?)\/\/ <\/follow-core>/);
assert(m, '找不到 <follow-core> 區塊');
const { fillTemplate, padBox, containRect, tileRects, mergeBoxes, FW_LAYOUT, FW_TIMES } = new Function(m[1] + '; return { fillTemplate, padBox, containRect, tileRects, mergeBoxes, FW_LAYOUT, FW_TIMES };')();
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
t('對比圖：手機直式 1080×1920，照片完整放進框裡不裁切、置中', () => {
  assert.deepStrictEqual([FW_LAYOUT.W, FW_LAYOUT.H], [1080, 1920]);
  const r = containRect(1200, 1600, 40, 40, 1000, 878); // 3:4 直式照
  assert(Math.abs(r.w / r.h - 1200 / 1600) < 1e-9 && Math.abs(r.h - 878) < 1e-6 && r.w <= 1000);
  assert(Math.abs(r.x - (40 + (1000 - r.w) / 2)) < 1e-9);
  const l = containRect(1600, 1200, 40, 40, 1000, 878); // 橫式照：寬度剛好，上下留白
  assert(Math.abs(l.w - 1000) < 1e-6 && l.h < 878);
});
t('分區偵測：正方形小區塊互相重疊、蓋滿整張照片', () => {
  for (const [W, H] of [[537, 1200], [1200, 1600], [1600, 1200], [200, 300]]) {
    const ts = tileRects(W, H);
    assert(ts.every(t => t.w === t.h || W < 300 || H < 300));
    assert(ts.every(t => t.x >= 0 && t.y >= 0 && t.x + t.w <= W && t.y + t.h <= H));
    for (let y = 0; y < H; y += 37) for (let x = 0; x < W; x += 37) assert(ts.some(t => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h), `${W}x${H} 沒蓋到 ${x},${y}`);
    assert(ts.length <= 40);
  }
});
t('同一張臉在不同區塊被偵測到，合併成一個框', () => {
  const m = mergeBoxes([{ x: 100, y: 100, w: 50, h: 50 }, { x: 105, y: 98, w: 52, h: 55 }, { x: 400, y: 400, w: 40, h: 40 }]);
  assert.strictEqual(m.length, 2);
  assert.deepStrictEqual(m[0], { x: 100, y: 98, w: 57, h: 55 });
});
console.log(`\n全部通過（${pass} 項）`);
