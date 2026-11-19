/**
 * 產生「假的」神美訂單列表（只供開發測試，內容全部隨機虛構）。
 *
 *   node tests/fake-shenmei.js            → 印出摘要
 *   node tests/fake-shenmei.js out.xlsx   → 另存假的 xlsx（需要 npm 套件 xlsx；*.xlsx 已被 .gitignore 排除）
 *
 * 涵蓋：3 家店（含尚未對應的台南、夥伴店）、一筆訂單多列、手機被 Excel 讀成數字少了 0、
 * 無效手機、空白手機、儲值金客人、染髮後又回來做其他服務、只買商品。
 */
'use strict';

const HEADER = ['項次', '訂單號碼', '訂單時間', '建立時間', '店家', '會員', '手機', '備註', '定價', '實收', '發票', '統編', '分類', '品項', '數量', '總價', '折扣',
  '工作人員', '職位', '指定', '業績', '提成', '項目協助', '消費方式', '支付方式', '手續費'];

const STORES = ['頭沐｜示範旗艦館', '頭沐｜散步二號館', '頭沐｜台南測試館', '頭沐｜夥伴店A'];
const STAFF = { '頭沐｜示範旗艦館': ['七七', 'Jessica', 'Tori'], '頭沐｜散步二號館': ['虹汶', '小雨'], '頭沐｜台南測試館': ['阿南'], '頭沐｜夥伴店A': ['夥伴'] };
const SURNAMES = ['王', '李', '張', '陳', '林', '黃', '吳', '劉', '蔡', '楊'];
const GIVEN = ['小美', '雅婷', '淑芬', '怡君', '佩珊', '美玲', '欣怡', '心怡', '惠如', '麗華'];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function fmtDate(d) { return d.toISOString().slice(0, 10).replace(/-/g, '/'); }

/**
 * @param {object} o  today: 'yyyy-mm-dd'（以這天為基準產生過去一年的訂單）, n: 客人數, seed
 * @returns {{rows: any[][], truth: object[]}} rows 第一列是表頭；truth 是每位假客人的「正確答案」供測試比對
 */
function generate(o = {}) {
  const today = o.today || '2026-11-19', n = o.n || 60, rand = rng(o.seed || 42);
  const base = new Date(today + 'T12:00:00Z');
  const pick = a => a[Math.floor(rand() * a.length)];
  const rows = [HEADER];
  const truth = [];
  let orderNo = 1000, item = 1;
  const addOrder = (c, daysAgo, lines, payBy) => {
    const d = new Date(base.getTime() - daysAgo * 86400000);
    const t = fmtDate(d) + ' ' + String(10 + Math.floor(rand() * 8)).padStart(2, '0') + ':' + String(Math.floor(rand() * 60)).padStart(2, '0');
    orderNo++;
    lines.forEach((ln, i) => {
      const r = new Array(HEADER.length).fill('');
      r[0] = item++;
      r[12] = ln.cat; r[13] = ln.item; r[14] = 1; r[15] = 1800; r[17] = ln.staff || ''; r[18] = '養護師';
      if (i === 0) { // 訂單層級欄位只在第一列
        r[1] = 'SO' + orderNo; r[2] = t; r[3] = t; r[4] = c.store; r[5] = c.name; r[6] = c.phoneCell; r[23] = payBy; r[24] = payBy === '儲值金' ? '儲值金' : '現金';
      }
      rows.push(r);
    });
  };
  for (let k = 0; k < n; k++) {
    const store = k % 10 === 9 ? STORES[3] : k % 7 === 6 ? STORES[2] : STORES[k % 2];
    const phone = '09' + String(10000000 + Math.floor(rand() * 89999999));
    // 約三分之一的手機被 Excel 讀成數字（少了開頭 0）
    let phoneCell = k % 3 === 0 ? Number(phone) : phone;
    if (k % 3 === 1) phoneCell = phone.slice(0, 4) + '-' + phone.slice(4);
    let valid = true;
    if (k === 5) { phoneCell = '12345'; valid = false; }       // 無效手機
    if (k === 8) { phoneCell = ''; valid = false; }            // 空白手機
    const c = { store, name: pick(SURNAMES) + pick(GIVEN), phone, phoneCell };
    const stylists = STAFF[store];
    const stored = k % 4 === 0;
    // 染髮次數與時間
    const visits = 1 + Math.floor(rand() * 3);
    let lastDyeAgo = [20, 60, 95, 120, 150, 200, 260, 300][k % 8] + Math.floor(rand() * 5);
    const dyeDays = [];
    for (let v = 0; v < visits; v++) dyeDays.push(lastDyeAgo + v * 40);
    let lastStylist = null, lastItem = null;
    dyeDays.slice().reverse().forEach((ago, idx) => {
      const st = pick(stylists), it = pick(['草本染髮－全頭', '草本染髮－補染']);
      const lines = [{ cat: '草本染髮', item: it, staff: st }];
      if (rand() < 0.4) lines.push({ cat: '頭皮養護', item: '頭皮淨化', staff: pick(stylists) });
      if (rand() < 0.3) lines.push({ cat: '商品', item: '洗髮精', staff: '' });
      addOrder(c, ago, lines, stored && idx === 0 ? '儲值金' : '現金');
      if (ago === lastDyeAgo) { lastStylist = st; lastItem = it; }
    });
    // 染髮後回來做其他服務（不應進沉睡名單）
    let lastServiceAgo = lastDyeAgo;
    if (k % 11 === 3) { lastServiceAgo = Math.max(1, lastDyeAgo - 30); addOrder(c, lastServiceAgo, [{ cat: '頭皮養護', item: '頭皮養護', staff: pick(stylists) }], '現金'); }
    // 染髮後只回來買商品（仍算沉睡）
    if (k % 13 === 4) addOrder(c, Math.max(1, lastDyeAgo - 10), [{ cat: '商品', item: '護髮油', staff: '' }], '現金');
    truth.push({ phone, valid, store, name: c.name, stored, lastDyeAgo, lastServiceAgo, lastStylist, lastItem, partner: store === STORES[3], unmapped: store === STORES[2] });
  }
  return { rows, truth };
}

module.exports = { generate, HEADER };

if (require.main === module) {
  const { rows, truth } = generate();
  const out = process.argv[2];
  if (out) {
    const XLSX = require('xlsx');
    const ws = XLSX.utils.aoa_to_sheet(rows), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '訂單列表');
    XLSX.writeFile(wb, out);
    console.log('已產生假資料：' + out + '（' + (rows.length - 1) + ' 列、' + truth.length + ' 位假客人）');
  } else {
    console.log((rows.length - 1) + ' 列、' + truth.length + ' 位假客人');
  }
}
