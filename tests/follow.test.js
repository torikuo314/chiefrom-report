/**
 * 測試 index.html 裡的回流訊息純函式（<follow-core> 區塊）。
 *   node tests/follow.test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\/ <follow-core>[^\n]*\n([\s\S]*?)\/\/ <\/follow-core>/);
assert(m, '找不到 <follow-core> 區塊');
const F = new Function(m[1] + '; return { padBox, containRect, tileRects, mergeBoxes, hairCropRect, fwSlots, FW_LAYOUT };')();
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ✓ ' + name); };
const near = (a, b) => Math.abs(a - b) < 1e-6;

t('臉部框放大後不會超出照片', () => {
  const b = F.padBox({ originX: 5, originY: 5, width: 100, height: 100 }, 120, 120, 0.35);
  assert(b.x >= 0 && b.y >= 0 && b.x + b.w <= 120 && b.y + b.h <= 120);
  // 上方多留 1.2 倍給頭髮：y 300−84、下緣 300+200+70
  assert.deepStrictEqual(F.padBox({ originX: 400, originY: 300, width: 200, height: 200 }, 1600, 1200, 0.35), { x: 330, y: 216, w: 340, h: 354 });
});
t('版面：手機直式 1080×1920，上下兩個框一樣大、不重疊、留給 logo 的空間', () => {
  const [a, b] = F.fwSlots(), L = F.FW_LAYOUT;
  assert.deepStrictEqual([L.W, L.H], [1080, 1920]);
  assert(near(a.w, b.w) && near(a.h, b.h) && a.y + a.h < b.y - L.label + 1 && b.y + b.h <= L.H - L.bottom + 1e-6);
});
t('照片完整放進框裡不裁切、置中', () => {
  const r = F.containRect(1200, 1600, 40, 40, 1000, 878); // 3:4 直式照
  assert(near(r.w / r.h, 1200 / 1600) && near(r.h, 878) && r.w <= 1000 && near(r.x, 40 + (1000 - r.w) / 2));
  const l = F.containRect(1600, 1200, 40, 40, 1000, 878); // 橫式照：寬度剛好，上下留白
  assert(near(l.w, 1000) && l.h < 878);
});
t('分區偵測：正方形小區塊互相重疊、蓋滿整張照片', () => {
  for (const [W, H] of [[537, 1200], [1200, 1600], [1600, 1200], [200, 300]]) {
    const ts = F.tileRects(W, H);
    assert(ts.every(x => x.x >= 0 && x.y >= 0 && x.x + x.w <= W && x.y + x.h <= H) && ts.length <= 40);
    for (let y = 0; y < H; y += 37) for (let x = 0; x < W; x += 37) assert(ts.some(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h), `${W}x${H} 沒蓋到 ${x},${y}`);
  }
});
t('同一張臉在不同區塊被偵測到，合併成一個框', () => {
  const r = F.mergeBoxes([{ x: 100, y: 100, w: 50, h: 50 }, { x: 105, y: 98, w: 52, h: 55 }, { x: 400, y: 400, w: 40, h: 40 }]);
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r[0], { x: 100, y: 98, w: 57, h: 55 });
});
// 做一個假的頭髮遮罩：W×H 照片，頭髮在 (x0..x1, y0..y1)
const mask = (W, H, x0, y0, x1, y1) => {
  const rows = new Array(H).fill(0), cols = new Array(W).fill(0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { rows[y]++; cols[x]++; }
  return { rows, cols };
};
t('頭髮裁切：頭髮完整在範圍裡、四周有留白、不超出照片', () => {
  const W = 1108, H = 1477, { rows, cols } = mask(W, H, 185, 380, 950, 1240);
  const r = F.hairCropRect(rows, cols, W, H, W, H, 1000 / 700);
  assert(r.x <= 185 - 50 && r.y <= 380 - 50 && r.x + r.w >= 950 + 50 && r.y + r.h >= 1240 + 50, JSON.stringify(r));
  assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H);
  assert(r.h < H * 0.85, '應該有裁掉上下不需要的地方');
});
t('頭髮裁切：照片夠寬時擴成框的比例', () => {
  const W = 2000, H = 1500, { rows, cols } = mask(W, H, 800, 400, 1200, 900); // 頭髮約佔 7%
  const r = F.hairCropRect(rows, cols, W, H, W, H, 1.5);
  assert(Math.abs(r.w / r.h - 1.5) < 0.01);
});
t('頭髮裁切：遮罩比照片小也會換算；找不到頭髮或頭髮太小就不裁', () => {
  const { rows, cols } = mask(256, 256, 64, 64, 191, 191);
  const r = F.hairCropRect(rows, cols, 256, 256, 1024, 1024, 1);
  assert(r.x <= 256 && r.x + r.w >= 768);
  const z = mask(100, 100, 0, 0, -1, -1);
  assert.strictEqual(F.hairCropRect(z.rows, z.cols, 100, 100, 100, 100, 1), null);
  const tiny = mask(100, 100, 50, 50, 54, 54);
  assert.strictEqual(F.hairCropRect(tiny.rows, tiny.cols, 100, 100, 100, 100, 1), null);
});
console.log(`\n全部通過（${pass} 項）`);
