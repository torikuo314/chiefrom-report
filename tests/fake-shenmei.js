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

/**
 * 月結用的假訂單列表（一個月、內容全部虛構），每種情況各放一筆，並附上「正確答案」。
 * 訂單號碼格式跟神美一樣：前 6 碼日期＋8 碼當天流水號（不同店會重複）。
 */
function generateSettle(o = {}) {
  const month = o.month || '2026-11';
  const [Y, M] = month.split('-');
  const S1 = '頭沐｜示範旗艦館', S2 = '頭沐｜散步二號館', SP = '頭沐｜夥伴店A', SX = '頭沐｜台南測試館';
  const rows = [HEADER];
  const seq = {}; let item = 1;
  const no = (store, day) => { const k = store + day; seq[k] = (seq[k] || 0) + 1; return Y.slice(2) + M + String(day).padStart(2, '0') + String(seq[k]).padStart(8, '0'); };
  const skip = (store, day) => { const k = store + day; seq[k] = (seq[k] || 0) + 1; }; // 製造缺號
  const order = (store, day, phone, paid, consume, payment, lines) => {
    const orderNo = no(store, day), t = `${Y}/${M}/${String(day).padStart(2, '0')} 14:${String(10 + (item % 40)).padStart(2, '0')}`;
    lines.forEach((ln, i) => {
      const r = new Array(HEADER.length).fill('');
      r[0] = item++;
      if (i === 0) { r[1] = orderNo; r[2] = t; r[3] = t; r[4] = store; r[5] = '假客人' + (item % 9); r[6] = phone; r[8] = paid; r[9] = paid; r[23] = consume; r[24] = payment; }
      r[12] = ln.cat || '草本染髮'; r[13] = ln.item || '草本染髮－全頭'; r[14] = 1; r[15] = ln.role === '助理' ? '' : (ln.total ?? ln.amount);
      r[17] = ln.staff; r[18] = ln.role || '設計師'; r[20] = ln.amount; r[22] = ln.assist || 0;
      rows.push(r);
    });
    return orderNo;
  };
  const t = {};
  // 1. 一般訂單（現金）
  t.normal = order(S1, 1, '0911000001', 2000, '現場付款：2000', '現金：2000', [{ staff: '七七', amount: 2000 }]);
  // 2. 用了優惠券：業績比實收少 200，不是錯誤
  t.coupon = order(S1, 1, '0911000002', 2380, '現場付款：2180、優惠券：200', '現金：2180', [{ staff: '虹汶', amount: 2180, total: 2380 }]);
  // 3. 助理業績沒從主做扣除（散步）
  t.assistNotDeducted = order(S2, 2, '0911000003', 3431, '現場付款：3431', '信用卡：3431', [
    { staff: '宜琳', item: '草本染髮－全頭', amount: 2904, total: 2904 }, { staff: '宜琳', cat: '頭皮護理', item: '頭皮淨化', amount: 527, total: 527 },
    { staff: '咪咪', role: '助理', amount: 500 }]);
  // 4. 助理業績有正確扣除
  t.assistOk = order(S2, 2, '0911000004', 2380, '現場付款：2380', '現金：2380', [{ staff: '宜琳', amount: 1980, total: 2380, assist: 400 }, { staff: '咪咪', role: '助理', amount: 400 }]);
  // 5. 1,000 打成 10,000
  t.tenTimes = order(S1, 3, '0911000005', 1000, '現場付款：1000', '現金：1000', [{ staff: 'Jessica', cat: '頭皮護理', item: '頭皮淨化', amount: 10000, total: 1000 }]);
  // 6. 儲值金消費（沒有現金）
  t.storedUse = order(S1, 3, '0911000006', 1500, '儲值金：1500', '', [{ staff: '七七', amount: 1500 }]);
  // 7. 商品券兌換商品（800 用商品券，500 付現金）
  t.voucher = order(S1, 4, '0911000007', 1300, '商品券：800、現場付款：500', '現金：500', [
    { staff: '七七', cat: '商品', item: '洗髮精', amount: 800 }, { staff: '七七', cat: '商品', item: '護髮油', amount: 500 }]);
  // 8. 實收 0（全額折扣）
  t.zeroPaid = order(S2, 1, '0911000008', 0, '', '', [{ staff: '宜琳', amount: 0, total: 0 }]);
  // 9. 缺號：旗艦館 8 日的 1 號不見了
  skip(S1, 8);
  t.afterGap = order(S1, 8, '0911000009', 1200, '現場付款：1200', 'Apple Pay：1200', [{ staff: '虹汶', amount: 1200 }]);
  // 10. 夥伴店（排除）
  t.partner = order(SP, 2, '0911000010', 11680, '儲值金：11680', '', [{ staff: '', cat: '經銷商', item: '進貨', amount: 0 }]);
  // 11. 對應不到的店家
  t.unmapped = order(SX, 5, '0911000011', 900, '現場付款：900', '現金：900', [{ staff: '阿南', amount: 900 }]);
  // 12. 不認得的付款方式
  t.unknownPay = order(S2, 5, '0911000012', 300, '現場付款：300', 'LINE Pay：300', [{ staff: '宜琳', cat: '商品', item: '梳子', amount: 300 }]);
  // 13. 同一位客人在兩間店都有來（客數只算一次）；Jessica 兩間店都有業績
  t.crossStore = order(S2, 6, '0911000001', 1800, '現場付款：1800', '現金：1800', [{ staff: 'Jessica', amount: 1800 }]);
  return {
    rows, orders: t,
    storeMap: { [S1]: '旗艦本館', [S2]: '散步二館' },
    // 每日神美現金（店｜日 → 現金）
    cash: { '旗艦本館|01': 4180, '旗艦本館|03': 1000, '旗艦本館|04': 500, '散步二館|02': 2380, '散步二館|06': 1800 },
  };
}

module.exports = { generate, generateSettle, HEADER };

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
