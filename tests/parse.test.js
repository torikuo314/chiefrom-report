/**
 * 測試 index.html 裡的神美解析（<shenmei-parse> 區塊），只用 tests/fake-shenmei.js 產生的假資料。
 *   node tests/parse.test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const { generate } = require('./fake-shenmei');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\/ <shenmei-parse>[^\n]*\n([\s\S]*?)\/\/ <\/shenmei-parse>/);
assert(m, '找不到 <shenmei-parse> 區塊');
const { summarizeShenmei, smPhone } = new Function(m[1] + '; return { summarizeShenmei, smPhone };')();

const TODAY = '2026-11-19';
const storeMap = { '頭沐｜示範旗艦館': '本館', '頭沐｜散步二號館': '散步二館' };
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ✓ ' + name); };

t('手機正規化：數字少 0、.0、連字號、空白、無效', () => {
  assert.strictEqual(smPhone(912345678), '0912345678');
  assert.strictEqual(smPhone('912345678.0'), '0912345678');
  assert.strictEqual(smPhone('0912-345 678'), '0912345678');
  assert.strictEqual(smPhone(''), '');
  assert.strictEqual(smPhone(null), '');
  assert.strictEqual(smPhone('12345'), null);
  assert.strictEqual(smPhone('09123456789'), null);
});

const { rows, truth } = generate({ today: TODAY, n: 60, seed: 7 });
const { customers, stats } = summarizeShenmei(rows, storeMap, TODAY);
const byPhone = Object.fromEntries(customers.map(c => [c.phone, c]));

t('夥伴店排除、未對應店家列出、無效手機計數', () => {
  assert(stats.partnerRows > 0);
  assert.deepStrictEqual(stats.unmappedStores, ['頭沐｜台南測試館']);
  assert.strictEqual(stats.invalidPhones, 1);
  truth.filter(x => x.partner || x.unmapped || !x.valid).forEach(x => assert(!byPhone[x.phone], '不應出現：' + x.store));
});

t('每位有效客人都有摘要，且最後染髮日、最後服務日、最後養護師、品項正確', () => {
  const ok = truth.filter(x => x.valid && !x.partner && !x.unmapped);
  assert.strictEqual(customers.length, ok.length);
  ok.forEach(x => {
    const c = byPhone[x.phone];
    assert(c, '缺少客人');
    assert.strictEqual(c.lastDye, addDays(TODAY, -x.lastDyeAgo));
    assert.strictEqual(c.lastService, addDays(TODAY, -x.lastServiceAgo));
    assert.strictEqual(c.lastStylist, x.lastStylist);
    assert.strictEqual(c.lastItem, x.lastItem);
    assert.strictEqual(c.store, storeMap[x.store]);
    assert.strictEqual(c.name, x.name);
  });
});

t('儲值判斷：任一筆訂單消費方式含儲值金', () => {
  truth.filter(x => byPhone[x.phone]).forEach(x => assert.strictEqual(byPhone[x.phone].stored, x.stored));
  assert(customers.some(c => c.stored) && customers.some(c => !c.stored));
});

t('今年染髮次數＝今年不同日期數', () => {
  customers.forEach(c => assert(c.dyeCount >= 0 && c.dyeCount <= 3));
});

t('只買商品不算服務；染後回來做其他服務會讓最後服務日較晚', () => {
  const back = truth.filter(x => byPhone[x.phone] && x.lastServiceAgo < x.lastDyeAgo);
  assert(back.length > 0);
  back.forEach(x => assert(byPhone[x.phone].lastService > byPhone[x.phone].lastDye));
});

t('缺少必要欄位時報錯', () => {
  assert.throws(() => summarizeShenmei([['項次', '訂單號碼', '手機']], storeMap, TODAY), /缺少欄位/);
  assert.throws(() => summarizeShenmei([['a', 'b']], storeMap, TODAY), /表頭/);
});

console.log(`\n全部通過（${pass} 項）`);
