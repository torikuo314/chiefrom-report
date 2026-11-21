/**
 * 測試 index.html 裡的月結解析（<settle-parse> 區塊），只用 tests/fake-shenmei.js 產生的假資料。
 *   node tests/settle.test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const { generateSettle, HEADER } = require('./fake-shenmei');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const block = n => { const m = html.match(new RegExp('// <' + n + '>[^\\n]*\\n([\\s\\S]*?)// </' + n + '>')); assert(m, '找不到 <' + n + '> 區塊'); return m[1]; };
const { extractOrderLines } = new Function(block('shenmei-parse') + block('settle-parse') + '; return { extractOrderLines };')();
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ✓ ' + name); };

const g = generateSettle({ month: '2026-11' });
const out = extractOrderLines(g.rows);

t('每一列都變成一筆明細，月份正確', () => {
  assert.strictEqual(out.lines.length, g.rows.length - 1);
  assert.deepStrictEqual(out.months, [{ month: '2026-11', rows: g.rows.length - 1 }]);
});
t('訂單層級欄位往下補：同一張訂單的每一列都有店家、實收、付款方式', () => {
  const ls = out.lines.filter(l => l.orderNo === g.orders.assistNotDeducted && l.store === '頭沐｜散步二號館');
  assert.strictEqual(ls.length, 3);
  assert(ls.every(l => l.store === '頭沐｜散步二號館' && l.paid === 3431 && l.payment === '信用卡：3431' && l.date === '2026-11-02'));
  assert.deepStrictEqual(ls.map(l => l.lineNo), [1, 2, 3]);
  assert.deepStrictEqual(ls.map(l => [l.staff, l.role, l.amount]), [['宜琳', '設計師', 2904], ['宜琳', '設計師', 527], ['咪咪', '助理', 500]]);
});
t('不讀客人姓名；手機只留在瀏覽器（正規化成 10 碼）', () => {
  assert(out.lines.every(l => !('name' in l) && !Object.values(l).some(v => String(v).startsWith('假客人'))));
  assert.strictEqual(out.lines.find(l => l.orderNo === g.orders.normal && l.store === '頭沐｜示範旗艦館').phone, '0911000001');
});
t('不同店的訂單號碼可以重複，各自獨立', () => {
  const nos = out.lines.filter(l => l.lineNo === 1).map(l => l.store + '#' + l.orderNo);
  assert.strictEqual(new Set(nos).size, nos.length);
});
t('缺少必要欄位時說明缺哪些', () => {
  const rows = [HEADER.filter(h => h !== '業績' && h !== '支付方式')];
  assert.throws(() => extractOrderLines([HEADER.filter(h => h !== '支付方式')]), /支付方式/);
  assert.throws(() => extractOrderLines(rows), /找不到/);
});
t('Excel 日期序號、空白列都能處理', () => {
  const rows = [HEADER, new Array(HEADER.length).fill('')];
  const r = new Array(HEADER.length).fill('');
  r[1] = '26111500000001'; r[2] = 46341.5; r[4] = '頭沐｜示範旗艦館'; r[9] = 500; r[17] = '七七'; r[18] = '設計師'; r[20] = 500; r[23] = '現場付款：500'; r[24] = '現金：500';
  rows.push(r);
  const o = extractOrderLines(rows);
  assert.strictEqual(o.lines.length, 1);
  assert.match(o.lines[0].date, /^\d{4}-\d{2}-\d{2}$/);
});
t('兩個檔案期間重疊：同一張訂單只算一次', () => {
  const both = g.rows.concat(g.rows.slice(0, 4)); // 第二個檔案（含表頭）重複前面 3 列
  const o = extractOrderLines(both);
  assert.strictEqual(o.lines.length, g.rows.length - 1);
  assert.strictEqual(o.duplicates, 3); // 重複的 3 列是 3 張不同的訂單
});
console.log(`\n全部通過（${pass} 項）`);
