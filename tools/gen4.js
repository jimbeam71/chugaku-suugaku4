// レベル4の問題データ生成: node gen4.js -> src/data.js
// 手書き10問（src/handmade.js）＋ 計算で作る問題。誤答は「よくあるまちがい」から作り、理由も一緒に付ける。
const fs = require('fs'), path = require('path');

let seed = 20261019;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const MINUS = '−';
const lab = v => (v < 0 ? MINUS + (-v) : String(v));
const T = v => String(v);
const fr = (n, d) => '\\dfrac{' + n + '}{' + d + '}';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function lcmBrute(a, b) { for (let x = Math.max(a, b); ; x++) if (x % a === 0 && x % b === 0) return x; }
const key = v => (v == null ? 'null:' + Math.random() : Array.isArray(v) ? v.map(x => x.toFixed(9)).join(',') : v.toFixed(9));

/* 問題を組み立てる。truth={v,tex}, cands=[{v,tex,why}]（先のものほど優先） */
function build(o) {
  const unit = o.unit || '';
  const wrap = (tex, raw) => (raw ? tex : '$' + tex + '$' + unit);
  const seen = [o.truth.tex], seenV = [key(o.truth.v)], wrongs = [];
  for (const c of o.cands) {
    if (wrongs.length >= 3) break;
    if (seen.includes(c.tex)) continue;
    if (!c.same && seenV.includes(key(c.v))) continue;
    seen.push(c.tex); seenV.push(key(c.v)); wrongs.push(c);
  }
  if (wrongs.length < 3) throw new Error(o.id + ': 誤答の候補が足りない');
  const all = shuffle([{ t: wrap(o.truth.tex, o.truth.raw), v: o.truth.v, ok: true }].concat(wrongs.map(c => (c.same ? { t: wrap(c.tex, c.raw), v: c.v, why: c.why, same: true } : { t: wrap(c.tex, c.raw), v: c.v, why: c.why }))));
  const ans = all.findIndex(x => x.ok);
  all.forEach(x => delete x.ok);
  const q = { id: o.id, expr: o.expr, p: o.p, ch: all, ans, steps: o.steps, point: o.point };
  if (o.fig) q.fig = o.fig;
  if (o.figAfter) q.figAfter = o.figAfter;
  return q;
}

/* ---------- 共通の小物 ---------- */
const LT = a => a.join(',\\ ');                                  // 数のならび（TeX）
const dfmt = x => String(+x.toFixed(8));                         // 小数の表示
const divisors = n => { const r = []; for (let i = 1; i <= n; i++) if (n % i === 0) r.push(i); return r; };
const reduceF = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
const frT = (n, d) => (d === 1 ? String(n) : fr(n, d));           // 分母1なら整数で表示
const Fv = (n, d) => { const [a, b] = reduceF(n, d); return { v: n / d, tex: frT(a, b) }; };
const C = (n, d, why, same) => { const o = { v: n / d, tex: (n * d < 0 ? '-' : '') + frT(Math.abs(n), Math.abs(d)), why }; if (same) o.same = true; return o; };
const mixT = (w, n, d) => String(w) + fr(n, d);
function fracOfDec(x) { const s = Math.round(x * 10000); const g = gcd(s, 10000); return [s / g, 10000 / g]; }
const RAWQ = (id, p, truth, wrongs, steps, point, extra) => build(Object.assign({
  id, expr: '1', p, raw: true, truth: { v: 1, tex: truth, raw: true },
  cands: wrongs.map(([t, why]) => ({ v: null, raw: true, tex: t, why })), steps, point
}, extra || {}));
const lcmOf = (a, b) => a / gcd(a, b) * b;

/* ---------- 共通の小物（レベル4） ---------- */
const fp = n => (n < 0 ? '(' + n + ')' : String(n));       // かっこつきで表示
const sgnWord = s => (s < 0 ? 'マイナス' : 'プラス');
const cnt = a => a.filter(x => x < 0).length;


/* ---------- 文字式の道具 ---------- */
const D = s => (String(s).includes('$') || /[ぁ-んァ-ヶ一-龥]/.test(String(s)) ? s : '$' + s + '$');
// RQ: 4択（式が選択肢）。texはそのまま渡すと $…$ で包む
const RQ = (id, p, t, ws, steps, point) => RAWQ(id, p, D(t), ws.map(([w, why]) => [D(w), why]), steps, point);
// 1次式 a x + b を TeX に
const xt = (a, v) => (a === 1 ? v : a === -1 ? '-' + v : a + v);
const lin = (a, b, v) => { v = v || 'x'; if (a === 0) return String(b); let s = xt(a, v); if (b > 0) s += '+' + b; else if (b < 0) s += '-' + (-b); return s; };
const sgn = n => (n < 0 ? '-' + (-n) : '+' + n);
const num = n => String(n);
// 数値問題（答えがひとつの数）
const NQ = (id, p, t, ws, steps, point, unit) => build({ id, expr: String(t), p, truth: { v: t, tex: dfmt(t) }, cands: ws.map(([v, why]) => ({ v, tex: dfmt(v), why })), steps, point, unit });


/* ---------- 座標グラフの図（SVG） ---------- */
const GR = 6, GS = 22, GC = 150;
const gx = x => GC + GS * x, gy = y => GC - GS * y;
function graph(o) {
  o = o || {};
  const st = (s) => ' style="' + s + '"';
  let s = '<svg viewBox="0 0 300 300" role="img" aria-label="座標平面"' + st('width:100%;max-width:340px;height:auto;display:block;margin:8px auto') + '>';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<line x1="' + gx(i) + '" y1="' + gy(-GR) + '" x2="' + gx(i) + '" y2="' + gy(GR) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
    s += '<line x1="' + gx(-GR) + '" y1="' + gy(i) + '" x2="' + gx(GR) + '" y2="' + gy(i) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
  }
  s += '<line x1="' + gx(-GR - .4) + '" y1="' + GC + '" x2="' + gx(GR + .4) + '" y2="' + GC + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  s += '<line x1="' + GC + '" y1="' + gy(-GR - .4) + '" x2="' + GC + '" y2="' + gy(GR + .4) + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  const tx = 'font:700 10px sans-serif;fill:var(--muted);text-anchor:middle';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<text x="' + gx(i) + '" y="' + (GC + 13) + '"' + st(tx) + '>' + i + '</text>';
    s += '<text x="' + (GC - 9) + '" y="' + (gy(i) + 3.5) + '"' + st(tx) + '>' + i + '</text>';
  }
  s += '<text x="' + (GC - 8) + '" y="' + (GC + 13) + '"' + st(tx) + '>O</text>';
  s += '<text x="' + gx(GR + .4) + '" y="' + (GC + 24) + '"' + st('font:700 12px sans-serif;fill:var(--fg);text-anchor:end') + '>x</text>';
  s += '<text x="' + (GC + 10) + '" y="' + (gy(GR + .4) + 8) + '"' + st('font:700 12px sans-serif;fill:var(--fg)') + '>y</text>';
  (o.lines || []).forEach(a => {                       // y = a x
    const xm = Math.min(GR, GR / Math.abs(a));
    s += '<line x1="' + gx(-xm) + '" y1="' + gy(-a * xm) + '" x2="' + gx(xm) + '" y2="' + gy(a * xm) + '"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
  });
  (o.hyper || []).forEach(a => {                       // y = a / x
    [1, -1].forEach(sg => {
      let pts = [];
      for (let x = Math.abs(a) / GR; x <= GR + 1e-9; x += 0.05) pts.push(gx(sg * x).toFixed(1) + ',' + gy(a / (sg * x)).toFixed(1));
      s += '<polyline points="' + pts.join(' ') + '" fill="none"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
    });
  });
  (o.pts || []).forEach(p => {
    s += '<circle cx="' + gx(p.x) + '" cy="' + gy(p.y) + '" r="4.5"' + st('fill:var(--pos);stroke:var(--card);stroke-width:1.5') + '/>';
    if (p.l) s += '<text x="' + (gx(p.x) + 7) + '" y="' + (gy(p.y) - 6) + '"' + st('font:700 13px sans-serif;fill:var(--pos)') + '>' + p.l + '</text>';
  });
  return { type: 'svg', html: s + '</svg>' };
}
const ct = (x, y) => '(' + x + ',' + y + ')';
const rdc = (n, d) => { const g = gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return [n, d]; };
const slope = (n, d) => { [n, d] = rdc(n, d); return d === 1 ? (n === 1 ? '' : n === -1 ? '-' : String(n)) + 'x' : (n < 0 ? '-' : '') + '\\dfrac{' + Math.abs(n) + '}{' + d + '}x'; };
const yEq = (n, d) => 'y=' + slope(n, d);
const hyEq = a => 'y=' + (a < 0 ? '-' : '') + '\\dfrac{' + Math.abs(a) + '}{x}';
const QN = ['第1象限', '第2象限', '第3象限', '第4象限'];

/* ================= パートA: 座標と関数 ================= */
function genZahyo() {
  const out = [];
  const pts = [[3, 2], [-2, 4], [-4, -3], [1, -3], [0, 3], [5, -2]];
  pts.forEach(([x, y], i) => {
    const cands = [[y, x, '$x$ 座標（横）が先、$y$ 座標（縦）があと。逆に読んでいるよ。'], [-x, y, '$x$ 座標の符号が、ぎゃくだよ。原点から、' + (x > 0 ? '右' : '左') + 'へ ' + Math.abs(x) + '。'], [x, -y, '$y$ 座標の符号が、ぎゃくだよ。原点から、' + (y > 0 ? '上' : '下') + 'へ ' + Math.abs(y) + '。'], [-y, -x, '$x$ と $y$ を入れかえて、符号まで変えているよ。']]
      .filter(([a, b]) => !(a === x && b === y));
    const seen = new Set([ct(x, y)]); const ws = [];
    cands.forEach(([a, b, why]) => { const t = ct(a, b); if (!seen.has(t)) { seen.add(t); ws.push(['$' + t.replace('-', '-') + '$', why]); } });
    const o = RAWQ('zh-' + (i + 1), '点Pの座標は？', '$' + ct(x, y) + '$', ws.slice(0, 3),
      ['原点から、横に ' + x + '、縦に ' + y + '。', '座標は、$(x\\text{座標},\\ y\\text{座標})$ の順。', '答えは $' + ct(x, y) + '$。'], '座標は、（横, 縦）の順。');
    o.fig = graph({ pts: [{ x, y, l: 'P' }] });
    out.push(o);
  });
  const sets = [[['A', -3, 2], ['B', 2, 3], ['C', -2, -3], ['D', 3, -2]], [['A', 4, 1], ['B', -1, 4], ['C', 1, -4], ['D', -4, -1]]];
  const asks = [[0, 'A'], [3, 'D']];
  [[sets[0], 0], [sets[1], 2]].forEach(([set, k], i) => {
    const [l, x, y] = set[k];
    const ws = set.filter((_, j) => j !== k).map(([ll, xx, yy]) => ['$\\text{点' + ll + '}$', '点' + ll + ' は ' + ct(xx, yy) + '。' + ct(x, y) + ' ではない。']);
    const o = RAWQ('zh-' + (7 + i), '$' + ct(x, y) + '$ の点は、どれ？', '$\\text{点' + l + '}$', ws,
      ['$x=' + x + '$：原点から、' + (x > 0 ? '右' : '左') + 'へ ' + Math.abs(x) + '。', '$y=' + y + '$：そこから、' + (y > 0 ? '上' : '下') + 'へ ' + Math.abs(y) + '。', 'その位置の点は、点' + l + '。'], '座標の点は、横→縦の順にたどる。');
    o.fig = graph({ pts: set.map(([ll, xx, yy]) => ({ x: xx, y: yy, l: ll })) });
    out.push(o);
  });
  return out;
}
function genShogen() {
  const out = [];
  const it = [[3, -2, 3], [-1, -5, 2], [-4, 2, 1], [2, 6, 0], [5, 0, 4], [-3, 0, 4]];
  it.forEach(([x, y, q], i) => {
    const onAxis = x === 0 || y === 0;
    const truth = onAxis ? 'どの象限でもない（軸の上）' : QN[q === 0 ? 0 : q === 1 ? 1 : q === 2 ? 2 : 3];
    const quad = onAxis ? null : (x > 0 && y > 0 ? 0 : x < 0 && y > 0 ? 1 : x < 0 && y < 0 ? 2 : 3);
    const t = onAxis ? truth : QN[quad];
    const wrongs = [];
    QN.forEach((n, k) => { if (k !== quad) wrongs.push([n, onAxis ? '点が軸の上にあるときは、どの象限にもふくまれない。' : ((x > 0 ? '$x$ は＋' : '$x$ は−') + '、' + (y > 0 ? '$y$ は＋' : '$y$ は−') + '。' + n + ' は、$x$ と $y$ の符号が合わない。')]); });
    const ws = onAxis ? [[QN[0], '軸の上の点は、どの象限にも入らない。'], [QN[1], '軸の上の点は、どの象限にも入らない。'], [QN[3], '軸の上の点は、どの象限にも入らない。']] : (wrongs.slice(0, 2).concat([['どの象限でもない（軸の上）', '$x$ も $y$ も0ではない。軸の上の点ではない。']]));
    out.push(RAWQ('sg-' + (i + 1), '点 $' + ct(x, y) + '$ は、どこにある？', t, ws,
      onAxis ? ['$' + (y === 0 ? 'y=0' : 'x=0') + '$ なので、' + (y === 0 ? '$x$ 軸' : '$y$ 軸') + 'の上。', '軸の上の点は、どの象限にも入らない。'] : ['$x$ は' + (x > 0 ? '＋' : '−') + '、$y$ は' + (y > 0 ? '＋' : '−') + '。', t + '。'],
      '象限：右上が第1、左上が第2、左下が第3、右下が第4（反時計まわり）。'));
  });
  return out;
}
function genKansu() {
  const out = [];
  out.push(RQ('kn-1', '次のうち、$y$ が $x$ の関数であるものは？', '1こ80円のあめを $x$ こ買ったときの代金 $y$ 円', [['$x$ 歳の人の身長 $y$ cm', '$x$ の値を決めても、$y$ はひとつに決まらない。（同じ年れいでも身長はいろいろ）'], ['自然数 $x$ の約数 $y$', '$x$ の値を決めても、$y$ がひとつに決まらない。（$x=6$ なら、1、2、3、6）'], ['絶対値が $x$ の数 $y$', '$x=3$ のとき、$y$ は 3 と $-3$ の2つ。ひとつに決まらない。']], ['$x$ を決めると、代金 $y=80x$ が、ひとつに決まる。', 'だから、$y$ は $x$ の関数。'], '関数：$x$ を決めると、$y$ がただひとつに決まる関係。'));
  out.push(RQ('kn-2', '次のうち、$y$ が $x$ の関数であるものは？', '1辺 $x$ cm の正方形の、まわりの長さ $y$ cm', [['身長が $x$ cm の人の体重 $y$ kg', '$x$ を決めても、$y$ はひとつに決まらない。'], ['$x$ の倍数 $y$', '$x=2$ なら、$y$ は 2、4、6、…。ひとつに決まらない。'], ['$x$ 以下の整数 $y$', '$x=3$ なら、$y$ は 3、2、1、…。ひとつに決まらない。']], ['$x$ を決めると、$y=4x$ がひとつに決まる。'], '関数：$x$ を決めると、$y$ がただひとつに決まる関係。'));
  out.push(RQ('kn-3', '次のうち、$y$ が $x$ の関数であるものは？', '時速 $x$ km で2時間進んだ道のり $y$ km', [['2乗が $x$ になる数 $y$', '$x=9$ のとき、$y$ は 3 と $-3$ の2つ。'], ['$x$ 番めに生まれた子の好きな数 $y$', '$x$ を決めても、$y$ は人によって変わる。'], ['$x$ より大きい素数 $y$', '$y$ は、たくさんある。ひとつに決まらない。']], ['$y=2x$。$x$ を決めると、$y$ がひとつに決まる。'], '関数：$x$ を決めると、$y$ がただひとつに決まる関係。'));
  const rg = [['-2\\leqq x<5', '−2以上5未満', ['-2<x\\leqq5', '−2より大きく5以下'], ['-2\\leqq x\\leqq5', '−2以上5以下'], ['-2<x<5', '−2より大きく5未満']], ['x>3', '3より大きい', ['x\\geqq3', '3以上'], ['x<3', '3未満'], ['x\\leqq3', '3以下']], ['x\\leqq-1', '−1以下', ['x<-1', '−1未満'], ['x\\geqq-1', '−1以上'], ['x>-1', '−1より大きい']]];
  rg.forEach(([t, w, a, b, c], i) => {
    out.push(RQ('kn-' + (i + 4), '$x$ の変域が「' + w + '」のとき、正しい式は？', t,
      [a, b, c].map(([tx, wd]) => [tx, 'これは「' + wd + '」を表す。「' + w + '」とはちがう。']),
      ['「以上・以下」は、その数をふくむ。$\\leqq$、$\\geqq$。', '「未満・より大きい」は、その数をふくまない。$<$、$>$。', '答えは $' + t + '$。'], '以上・以下は ≦ ≧（ふくむ）。未満・より大きいは ＜ ＞（ふくまない）。'));
  });
  return out;
}

/* ================= パートB: 比例 ================= */
function genHiShiki() {
  const out = [];
  [[2, 6], [3, -12], [-2, 10], [4, 2], [6, 9], [-4, -8]].forEach(([x0, y0], i) => {
    const [n, d] = rdc(y0, x0);
    const [fn, fd] = rdc(x0, y0);
    const truth = yEq(y0, x0);
    const w = [
      [yEq(x0, y0), '比例定数は、$y\\div x$。$x\\div y$ になっているよ。$' + y0 + '\\div' + fp(x0) + '$。'],
      ['y=x' + (y0 - x0 >= 0 ? '+' : '') + (y0 - x0), '足し算の式になっているよ。比例は、$y=ax$（かけ算）。'],
      [hyEq(x0 * y0), '$xy$ が一定になる式（反比例）になっているよ。比例は、$y\\div x$ が一定。'],
      [yEq(y0, 1), '$y$ の値を、そのまま比例定数にしているよ。比例定数は、$y\\div x$。']
    ].filter(([t]) => t !== truth);
    out.push(RQ('hs-' + (i + 1), '$y$ は $x$ に比例し、$x=' + x0 + '$ のとき $y=' + y0 + '$。$y$ を $x$ の式で表すと？', truth, w,
      ['比例の式は、$y=ax$。$a$ は、$y\\div x$。', '$a=' + y0 + '\\div' + fp(x0) + '=' + (d === 1 ? n : n + '/' + d) + '$。', '答えは $' + truth + '$。'], '比例：$y=ax$（$a$ は比例定数）。$a=y\\div x$。'));
  });
  return out;
}
function genHiAtai() {
  return [
    NQ('ha-1', '$y=3x$ で、$x=-2$ のときの $y$ の値は？', -6, [[6, '符号を落としているよ。$3\\times(-2)$ は、マイナス。'], [1, '足し算になっているよ。比例は、$y=3\\times x$。'], [-5, '引き算になっているよ。$3\\times(-2)$ を計算する。']], ['$y=3\\times(-2)=-6$。'], '$x$ に数を入れて、$a\\times x$ を計算する。'),
    NQ('ha-2', '$y=-2x$ で、$x=4$ のときの $y$ の値は？', -8, [[8, '符号を落としているよ。$-2\\times4$ は、マイナス。'], [2, '足し算になっているよ。$-2\\times4$。'], [-6, '足し算になっているよ。$-2\\times4$ は、かけ算。']], ['$y=-2\\times4=-8$。'], '比例定数が負でも、$a\\times x$ を計算する。'),
    NQ('ha-3', '$y=\\dfrac{1}{2}x$ で、$x=6$ のときの $y$ の値は？', 3, [[12, '$\\dfrac{1}{2}$ ではなく、2をかけているよ。$6\\times\\dfrac{1}{2}=3$。'], [6.5, '足し算になっているよ。$\\dfrac{1}{2}\\times6$。'], [-3, '符号が、まちがっているよ。']], ['$y=\\dfrac{1}{2}\\times6=3$。'], '$\\dfrac{1}{2}x$ は、$x\\div2$ のこと。'),
    NQ('ha-4', '$y=-\\dfrac{2}{3}x$ で、$x=-9$ のときの $y$ の値は？', 6, [[-6, '符号をまちがえているよ。$(-)\\times(-)$ は＋。'], [18, '3でわり忘れているよ。$-9\\times\\left(-\\dfrac{2}{3}\\right)$ は、$9\\div3=3$、$3\\times2=6$。'], [13.5, '$\\dfrac{2}{3}$ と $\\dfrac{3}{2}$ を、まちがえているよ。']], ['$y=-\\dfrac{2}{3}\\times(-9)$。', '符号は＋。$9\\div3\\times2=6$。'], '分数をかけるときは、約分してから計算する。'),
    NQ('ha-5', '$y$ は $x$ に比例し、$x=3$ のとき $y=12$。$x=5$ のときの $y$ は？', 20, [[14, '足し算の考え方になっているよ。比例は、$y=4x$。'], [36, '$3\\times12$ としているよ。まず、比例定数 $12\\div3=4$ を出す。'], [7.2, '比例定数を $\\dfrac{3}{12}$ にしているよ。$a=12\\div3=4$。']], ['比例定数：$a=12\\div3=4$。', '$y=4x$。$x=5$ のとき、$y=20$。'], '先に式（比例定数）を出して、$x$ に入れる。'),
    NQ('ha-6', '$y$ は $x$ に比例し、$x=-2$ のとき $y=6$。$x=4$ のときの $y$ は？', -12, [[12, '符号を落としているよ。比例定数は $6\\div(-2)=-3$。'], [-3, '$-3$ は、比例定数。$y=-3\\times4$。'], [10, '足し算の考え方になっているよ。比例は、$y=-3x$。']], ['比例定数：$a=6\\div(-2)=-3$。', '$y=-3x$。$x=4$ のとき、$y=-12$。'], '先に式（比例定数）を出して、$x$ に入れる。')
  ];
}
function genHiGraph() {
  const out = [];
  [[2, 3], [3, 2], [-2, 1], [-3, 2]].forEach(([a, x0], i) => {
    const y0 = a * x0;
    const truth = '$' + ct(x0, y0) + '$';
    const ws = [['$' + ct(y0, x0) + '$', '$x$ と $y$ が、逆になっているよ。$x=' + y0 + '$ なら、$y=' + a * y0 + '$。'], ['$' + ct(x0, a + x0) + '$', '足し算になっているよ。$x=' + x0 + '$ のとき、$y=' + a + '\\times' + fp(x0) + '=' + y0 + '$。'], ['$' + ct(0, a) + '$', '$x=0$ のとき、$y=0$。グラフは、原点を通る。']];
    out.push(RAWQ('hg-' + (i + 1), '$y=' + (a === 1 ? '' : a) + 'x$ のグラフが通る点は？', truth, ws, ['$x=' + x0 + '$ を入れる。$y=' + a + '\\times' + fp(x0) + '=' + y0 + '$。', '点 $' + ct(x0, y0) + '$ を通る。'], '$x$ を入れて、$y$ を出す。その $(x,y)$ が、グラフ上の点。'));
  });
  out.push(RQ('hg-5', '$y=-3x$ のグラフは？', '原点を通る、右下がりの直線', [['原点を通る、右上がりの直線', '比例定数が負（$-3$）のときは、右下がり。'], ['原点を通らない、右下がりの直線', '比例のグラフは、いつも原点を通る。'], ['原点を通らない2つの曲線', '曲線（双曲線）は、反比例のグラフ。']], ['$y=ax$ のグラフは、原点を通る直線。', '$a<0$ なので、右下がり。'], '比例のグラフ：原点を通る直線。$a>0$ は右上がり、$a<0$ は右下がり。'));
  out.push(RQ('hg-6', '$y=2x$ と $y=\\dfrac{1}{2}x$ のグラフで、$y$ 軸に近い（急な）のは？', '$y=2x$', [['$y=\\dfrac{1}{2}x$', '$x=2$ で、$y=2x$ は 4、$y=\\dfrac{1}{2}x$ は 1。$y=2x$ の方が急。'], ['どちらも同じ', 'ちがう。比例定数が大きい方が、急になる。'], ['比べられない', '比べられる。$x=2$ のとき、$y$ が大きい方が急。']], ['$x=2$ のとき、$y=2x$ は 4、$y=\\dfrac{1}{2}x$ は 1。', '$y=2x$ の方が、急。'], '比例定数の絶対値が大きいほど、グラフは急になる。'));
  return out;
}
function genHiYomu() {
  const out = [];
  [[2, 6], [3, -6], [-2, -4], [4, 2], [2, -8], [-4, 6]].forEach(([x0, y0], i) => {
    const truth = yEq(y0, x0);
    const w = [
      [yEq(x0, y0), '傾きが逆になっているよ。$a=y\\div x=' + y0 + '\\div' + fp(x0) + '$。'],
      ['y=x' + (y0 - x0 >= 0 ? '+' : '') + (y0 - x0), '足し算の式になっているよ。比例のグラフは、原点を通る直線。$y=ax$。'],
      [yEq(y0, 1), '$y$ 座標を、そのまま $a$ にしているよ。$a=y\\div x$。'],
      [yEq(-y0, x0), '符号が逆になっているよ。グラフが右' + (y0 / x0 > 0 ? '上' : '下') + 'がりかを見る。'],
      [hyEq(x0 * y0), '反比例の式になっているよ。グラフは直線なので、比例。']
    ].filter(([t]) => t !== truth);
    const o = RQ('hy-' + (i + 1), 'グラフは、原点と点Pを通る直線。$y$ を $x$ の式で表すと？', truth, w,
      ['点Pは $' + ct(x0, y0) + '$。$x=' + x0 + '$、$y=' + y0 + '$。', '$a=y\\div x=' + y0 + '\\div' + fp(x0) + '$。', '答えは $' + truth + '$。'], '原点以外の1点を読み取って、$a=y\\div x$ を出す。');
    o.fig = graph({ lines: [y0 / x0], pts: [{ x: x0, y: y0, l: 'P' }] });
    out.push(o);
  });
  return out;
}
function genHiRiyo() {
  return [
    NQ('hr-1', '針金2mの重さが30g。同じ針金7mの重さは何g？', 105, [[35, '足し算の考え方になっているよ。比例は、1mの重さ $30\\div2=15$ g をかける。'], [210, '$7\\times30$ としているよ。1mの重さは $30\\div2=15$ g。'], [60, '$2\\times30$ としているよ。1mの重さ15gに、7mをかける。']], ['1mの重さ：$30\\div2=15$（g）。', '7mでは、$15\\times7=105$（g）。'], '1あたりの量（比例定数）を出して、かける。', 'g'),
    NQ('hr-2', '水そうに、毎分3Lずつ水を入れる。12分後の水の量は何L？', 36, [[15, '足し算になっているよ。毎分3Lを12分、かけ算。'], [4, 'わり算になっているよ。水の量は、$3\\times12$。'], [9, '引き算になっているよ。毎分3Lを12分、かけ算。']], ['$y=3x$。$x=12$ を入れる。', '$y=3\\times12=36$（L）。'], '「毎分○L」は、比例定数。'),
    NQ('hr-3', '1まい8円のコピー。代金が200円のとき、何まいコピーした？', 25, [[192, '引き算になっているよ。まい数は、$200\\div8$。'], [1600, 'かけ算になっているよ。まい数は、代金÷1まいのねだん。'], [0.04, '$8\\div200$ にしているよ。まい数 ＝ 代金÷8。']], ['$y=8x$。$y=200$ のとき、$8x=200$。', '$x=200\\div8=25$（まい）。'], '$y$ から $x$ を求めるときは、$y\\div a$。'),
    NQ('hr-4', '$y$ は $x$ に比例し、$x=4$ のとき $y=-12$。$y=9$ のときの $x$ は？', -3, [[-27, '$-3\\times9$ としているよ。$y=-3x$ に、$y=9$ を入れて、$x=9\\div(-3)$。'], [3, '符号を落としているよ。$9\\div(-3)$ は、マイナス。'], [13, '足し算の考え方になっているよ。比例の式 $y=-3x$ を使う。']], ['比例定数：$a=-12\\div4=-3$。', '$y=-3x$。$9=-3x$ より、$x=9\\div(-3)=-3$。'], '比例の式を作って、$y$ の値を入れる。'),
    NQ('hr-5', 'ガソリン1Lで12km走る車。5L使うと、何km走れる？', 60, [[17, '足し算になっているよ。1Lで12kmなので、5Lでは12×5。'], [2.4, 'わり算になっているよ。道のり ＝ 12 × 使った量。'], [7, '引き算になっているよ。道のり ＝ 12 × 使った量。']], ['$y=12x$。$x=5$ を入れる。', '$y=12\\times5=60$（km）。'], '「1あたり」の量が、比例定数。', 'km'),
    NQ('hr-6', 'リボン3mの代金が240円。同じリボン8mの代金は何円？', 640, [[245, '足し算の考え方になっているよ。1mの値段 $240\\div3=80$ 円をかける。'], [90, '$3\\times8$ ではなく、1mの値段 80円に8mをかける。'], [80, '80は、1mの値段。8mでは、$80\\times8$。']], ['1mの値段：$240\\div3=80$（円）。', '8mでは、$80\\times8=640$（円）。'], '1あたりの量（比例定数）を出して、かける。', '円')
  ];
}

/* ================= パートC: 反比例 ================= */
function genHanShiki() {
  const out = [];
  [[2, 6], [4, 5], [-3, 4], [6, -3], [5, -2], [-2, -8]].forEach(([x0, y0], i) => {
    const a = x0 * y0;
    const truth = hyEq(a);
    const w = [
      [yEq(y0, x0), '比例の式（$y=ax$）になっているよ。反比例は、$xy$ が一定。$a=x\\times y$。'],
      [hyEq(y0), '$y$ の値だけを、そのまま使っているよ。$a=x\\times y=' + fp(x0) + '\\times' + fp(y0) + '$。'],
      [hyEq(x0 + y0), '足し算になっているよ。$a=x\\times y$（かけ算）。'],
      [hyEq(-a), '符号が逆になっているよ。$' + fp(x0) + '\\times' + fp(y0) + '$ の符号を、見なおす。']
    ].filter(([t]) => t !== truth);
    out.push(RQ('hn-' + (i + 1), '$y$ は $x$ に反比例し、$x=' + x0 + '$ のとき $y=' + y0 + '$。$y$ を $x$ の式で表すと？', truth, w,
      ['反比例の式は、$y=\\dfrac{a}{x}$。$a$ は、$x\\times y$。', '$a=' + fp(x0) + '\\times' + fp(y0) + '=' + a + '$。', '答えは $' + truth + '$。'], '反比例：$y=\\dfrac{a}{x}$（$xy=a$）。$a=x\\times y$。'));
  });
  return out;
}
function genHanAtai() {
  return [
    NQ('hv-1', '$y=\\dfrac{12}{x}$ で、$x=3$ のときの $y$ の値は？', 4, [[36, 'かけ算になっているよ。$y=12\\div x$。'], [9, '引き算になっているよ。$12\\div3$ を計算する。'], [0.25, '$x\\div12$ にしているよ。$12\\div x$。']], ['$y=12\\div3=4$。'], '$y=\\dfrac{a}{x}$ は、$a\\div x$。'),
    NQ('hv-2', '$y=-\\dfrac{8}{x}$ で、$x=-2$ のときの $y$ の値は？', 4, [[-4, '符号をまちがえているよ。$(-8)\\div(-2)$ は＋。'], [16, 'かけ算になっているよ。$-8\\div(-2)$ は、わり算。'], [-10, '引き算になっているよ。$-8\\div(-2)$ は、わり算。']], ['$y=-8\\div(-2)=4$。'], '負の数でわるときも、符号のルール。'),
    NQ('hv-3', '$y=\\dfrac{6}{x}$ で、$y=2$ のときの $x$ の値は？', 3, [[12, 'かけ算になっているよ。$xy=6$ なので、$x=6\\div2$。'], [4, '引き算になっているよ。$xy=6$ なので、$x=6\\div y$。'], [8, '足し算になっているよ。$xy=6$ なので、$x=6\\div y$。']], ['$xy=6$ なので、$x=6\\div y$。', '$x=6\\div2=3$。'], '反比例では、$xy=a$。$x=a\\div y$ で求められる。'),
    NQ('hv-4', '$y$ は $x$ に反比例し、$x=4$ のとき $y=3$。$x=6$ のときの $y$ は？', 2, [[4.5, '比例の考え方になっているよ。反比例は、$xy=12$。$y=12\\div6$。'], [9, '$x$ が大きくなると、$y$ は小さくなる（反比例）。'], [5, '足し算の考え方になっているよ。$xy=12$ を使う。']], ['$a=4\\times3=12$。', '$y=12\\div6=2$。'], '反比例：$x$ が増えると、$y$ は減る。$xy$ は一定。'),
    NQ('hv-5', '$y$ は $x$ に反比例し、$x=-3$ のとき $y=4$。$y=-6$ のときの $x$ は？', 2, [[-2, '符号をまちがえているよ。$-12\\div(-6)$ は＋。'], [18, '$-3\\times(-6)$ としているよ。まず $a=-3\\times4=-12$。'], [-72, 'かけ算になっているよ。$x=a\\div y$。']], ['$a=-3\\times4=-12$。', '$xy=-12$ より、$x=-12\\div(-6)=2$。'], '$a=xy$ を出してから、$x=a\\div y$。'),
    NQ('hv-6', '$y$ は $x$ に反比例し、$x=2$ のとき $y=-9$。$x=3$ のときの $y$ は？', -6, [[-13.5, '比例の考え方になっているよ。反比例は、$xy=-18$。$y=-18\\div3$。'], [6, '符号を落としているよ。$-18\\div3$ は、マイナス。'], [-27, '$-9\\times3$ としているよ。$a=2\\times(-9)=-18$ を使う。']], ['$a=2\\times(-9)=-18$。', '$y=-18\\div3=-6$。'], '$a=xy$ を出してから、$y=a\\div x$。')
  ];
}
function genHanGraph() {
  const out = [];
  out.push(RQ('hh-1', '$y=\\dfrac{a}{x}$ のグラフは？', '原点を通らない、なめらかな2つの曲線（双曲線）', [['原点を通る直線', '原点を通る直線は、比例のグラフ。'], ['原点を通る1本の曲線', '反比例のグラフは、原点を通らない。曲線は2つに分かれる。'], ['$y$ 軸に平行な直線', '直線ではなく、曲線。']], ['反比例のグラフは、双曲線。', '$x$ 軸にも $y$ 軸にも、ふれない（交わらない）。'], '反比例のグラフ：双曲線（2つのなめらかな曲線）。'));
  [[6, 2], [12, 4], [-8, 2], [10, 5]].forEach(([a, x0], i) => {
    const y0 = a / x0;
    out.push(RAWQ('hh-' + (i + 2), '$' + hyEq(a) + '$ のグラフが通る点は？', '$' + ct(x0, y0) + '$', [
      ['$' + ct(x0, a * x0) + '$', '$a\\times x$ にしているよ（比例）。反比例は、$a\\div x$。'],
      ['$' + ct(x0, a + x0) + '$', '足し算になっているよ。$y=a\\div x$。'],
      ['$' + ct(x0, a - x0) + '$', '引き算になっているよ。$y=a\\div x$。']
    ], ['$x=' + x0 + '$ を入れる。$y=' + a + '\\div' + x0 + '=' + y0 + '$。', '点 $' + ct(x0, y0) + '$ を通る。'], '$x$ を入れて、$a\\div x$ を計算する。'));
  });
  [[2, 3], [-2, 4]].forEach(([x0, y0], i) => {
    const a = x0 * y0;
    const truth = hyEq(a);
    const o = RQ('hh-' + (6 + i), 'グラフは、点Pを通る反比例のグラフ。式は？', truth, [[yEq(y0, x0), '比例の式になっているよ。グラフは曲線なので、反比例。'], [hyEq(x0 + y0), '足し算になっているよ。$a=x\\times y$。'], [hyEq(y0), '$y$ 座標だけを、そのまま使っているよ。$a=x\\times y$。']].filter(([t]) => t !== truth),
      ['点Pは $' + ct(x0, y0) + '$。', '$a=x\\times y=' + fp(x0) + '\\times' + y0 + '=' + a + '$。', '答えは $' + truth + '$。'], '通る点の $x\\times y$ が、$a$。');
    o.fig = graph({ hyper: [a], pts: [{ x: x0, y: y0, l: 'P' }] });
    out.push(o);
  });
  return out;
}
function genHanHantei() {
  const T = (rows) => RT(rows);
  return [
    RQ('hb-1', '$y$ が $x$ に反比例するのは、どれ？', '面積が24cm²の長方形の、たて $x$ cm、よこ $y$ cm', [['1辺 $x$ cm の正方形の、まわりの長さ $y$ cm', '$y=4x$。比例。'], ['1こ50円のあめ $x$ こ の代金 $y$ 円', '$y=50x$。比例。'], ['たて $x$ cm、よこ $(x+3)$ cm の長方形の面積 $y$ cm²', '$y=x(x+3)$。比例でも反比例でもない。']], ['面積24：$xy=24$。', '$xy$ が一定なので、反比例。'], '$xy$ が一定なら反比例。$y\\div x$ が一定なら比例。'),
    RQ('hb-2', '$y$ が $x$ に反比例するのは、どれ？', '60kmの道のりを、時速 $x$ km で進むときの時間 $y$ 時間', [['時速60kmで、$x$ 時間進んだ道のり $y$ km', '$y=60x$。比例。'], ['$x$ 歳の人の身長 $y$ cm', '$y$ が、$x$ だけで決まらない。関数ですらない。'], ['1辺 $x$ cm の正方形の面積 $y$ cm²', '$y=x^2$。比例でも反比例でもない。']], ['時間 ＝ 道のり÷速さ。$y=\\dfrac{60}{x}$。', '$xy=60$ なので、反比例。'], '時間 ＝ 道のり÷速さ。道のりが一定なら、反比例。'),
    RQ('hb-3', '表を見て、$y$ と $x$ の関係は？' + T([['$x$', '1', '2', '3', '4'], ['$y$', '6', '12', '18', '24']]), '比例（$y=6x$）', [['反比例（$y=\\dfrac{6}{x}$）', '$x$ が増えると、$y$ も増えている。反比例なら、$y$ は減る。'], ['比例でも反比例でもない', '$y\\div x$ が、いつも6で一定。比例。'], ['反比例（$y=\\dfrac{24}{x}$）', '$xy$ が、一定でない。（$1\\times6$、$2\\times12$…）']], ['$y\\div x$ を計算：$6\\div1=6$、$12\\div2=6$、$18\\div3=6$。', 'いつも6。だから、比例。'], '$y\\div x$ が一定なら比例。'),
    RQ('hb-4', '表を見て、$y$ と $x$ の関係は？' + T([['$x$', '1', '2', '3', '4'], ['$y$', '12', '6', '4', '3']]), '反比例（$y=\\dfrac{12}{x}$）', [['比例（$y=12x$）', '$x$ が増えると、$y$ は減っている。比例なら、$y$ も増える。'], ['比例でも反比例でもない', '$xy$ が、いつも12で一定。反比例。'], ['反比例（$y=\\dfrac{6}{x}$）', '$xy$ は6ではなく、12。']], ['$xy$ を計算：$1\\times12=12$、$2\\times6=12$、$3\\times4=12$。', 'いつも12。だから、反比例。'], '$xy$ が一定なら反比例。'),
    RQ('hb-5', '表を見て、$y$ と $x$ の関係は？' + T([['$x$', '1', '2', '3', '4'], ['$y$', '3', '5', '7', '9']]), '比例でも反比例でもない', [['比例（$y=3x$）', '$y\\div x$ が、一定でない。（$3\\div1=3$、$5\\div2=2.5$…）'], ['反比例（$y=\\dfrac{3}{x}$）', '$x$ が増えると $y$ も増えている。反比例ではない。'], ['比例（$y=2x$）', '$x=1$ のとき $y=2$ のはずなのに、実際は3。']], ['$y\\div x$：$3$、$2.5$、…。一定でない。', '$xy$：$3$、$10$、…。一定でない。', '比例でも反比例でもない。（$y=2x+1$）'], '比例か反比例か迷ったら、$y\\div x$ と $xy$ を計算する。'),
    RQ('hb-6', '表を見て、$y$ と $x$ の関係は？' + T([['$x$', '−2', '−1', '1', '2'], ['$y$', '6', '12', '−12', '−6']]), '反比例（$y=-\\dfrac{12}{x}$）', [['比例（$y=-6x$）', '$x=-1$ のとき $y=6$ のはずなのに、実際は12。'], ['反比例（$y=\\dfrac{12}{x}$）', '$xy$ は、$-2\\times6=-12$。符号まで見る。'], ['比例でも反比例でもない', '$xy$ が、いつも $-12$ で一定。反比例。']], ['$xy$：$(-2)\\times6=-12$、$(-1)\\times12=-12$、$1\\times(-12)=-12$。', 'いつも $-12$。反比例。'], '$xy$ が一定なら反比例。符号にも注意。')
  ];
}
function genHanRiyo() {
  return [
    NQ('hu-1', '面積が24cm²の長方形で、たてが6cmのとき、よこは何cm？', 4, [[18, '引き算になっているよ。よこ ＝ 面積 ÷ たて。'], [30, '足し算になっているよ。よこ ＝ 面積 ÷ たて。'], [144, 'かけ算になっているよ。よこ ＝ 面積 ÷ たて。']], ['$xy=24$。$6\\times y=24$。', '$y=24\\div6=4$（cm）。'], '面積が一定のとき、たてとよこは反比例。', 'cm'),
    NQ('hu-2', '60kmの道のりを、時速20kmで進むと、何時間かかる？', 3, [[1200, 'かけ算になっているよ。時間 ＝ 道のり÷速さ。'], [80, '足し算になっているよ。時間 ＝ 道のり÷速さ。'], [40, '引き算になっているよ。時間 ＝ 道のり÷速さ。']], ['時間 ＝ 道のり÷速さ。', '$60\\div20=3$（時間）。'], '道のり一定：速さと時間は反比例。', '時間'),
    NQ('hu-3', '12人で10日かかる仕事を、15人ですると、何日かかる？', 8, [[12.5, '比例の考え方になっているよ。人が増えると、日数は減る。全体の仕事量は $12\\times10=120$。'], [7, '引き算になっているよ。仕事量 $12\\times10=120$ を、15人でわる。'], [18, '$12\\times15\\div10$ にしているよ。仕事量は $12\\times10=120$。']], ['仕事量：$12\\times10=120$（人・日）。', '15人では、$120\\div15=8$（日）。'], '人数と日数は反比例。全体の仕事量 ＝ 人数×日数。', '日'),
    NQ('hu-4', '$y$ は $x$ に反比例し、$x=6$ のとき $y=4$。$x=3$ のときの $y$ は？', 8, [[2, '比例の考え方になっているよ。$x$ が小さくなると、$y$ は大きくなる。$a=24$。'], [7, '引き算の考え方になっているよ。$a=6\\times4=24$。$y=24\\div3$。'], [12, '$6\\times4\\div2$ になっているよ。$a=24$、$y=24\\div3$。']], ['$a=6\\times4=24$。', '$y=24\\div3=8$。'], '$x$ が半分になると、$y$ は2倍になる。'),
    NQ('hu-5', '歯車Aは20こ、毎分12回転。かみ合う歯車Bは30こ。Bは毎分何回転？', 8, [[18, '比例の考え方になっているよ。歯の数が多いほど、回転は少ない。'], [10, '引き算の考え方になっているよ。歯の数 × 回転数 ＝ $20\\times12=240$ が一定。'], [22, '足し算の考え方になっているよ。歯の数 × 回転数 が一定。']], ['歯の数 × 回転数 ＝ $20\\times12=240$（一定）。', 'Bは、$240\\div30=8$（回転）。'], '歯車：歯の数と回転数は、反比例。', '回転'),
    NQ('hu-6', '水そうに、毎分5Lずつ入れると12分でいっぱいになる。毎分4Lずつ入れると、何分でいっぱい？', 15, [[9.6, '比例の考え方になっているよ。毎分の量が減ると、時間は増える。全体は $5\\times12=60$ L。'], [11, '引き算の考え方になっているよ。全体の量 $5\\times12=60$ を、4でわる。'], [48, '$12\\times4$ にしているよ。全体の量 $5\\times12=60$ を、4でわる。']], ['水そうの量：$5\\times12=60$（L）。', '毎分4Lでは、$60\\div4=15$（分）。'], '全体の量が一定のとき、毎分の量と時間は反比例。', '分')
  ];
}

/* ---------- 組み立て ---------- */
const RT = rows => '<table class="rtab">' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>';
const I = {
  zh: '<b>座標</b>は、点の位置を、2つの数で表す方法。$(x\\text{座標},\\ y\\text{座標})$ の順に書く。<br>原点Oから、<b>横（右が＋、左が−）</b>に $x$、<b>縦（上が＋、下が−）</b>に $y$。<br><span class="mark">先に横、あとで縦</span>。点 $(3,2)$ は、右へ3、上へ2。',
  sg: '座標平面は、軸で4つの部分に分かれる。それぞれを<b>象限</b>という。<br>右上が<b>第1象限</b>（$+,+$）、左上が<b>第2象限</b>（$-,+$）、左下が<b>第3象限</b>（$-,-$）、右下が<b>第4象限</b>（$+,-$）。<br>軸の上の点は、どの象限にも入らない。',
  kn: '$x$ の値を決めると、$y$ の値が<b>ただひとつ</b>に決まるとき、「$y$ は $x$ の<b>関数</b>である」という。<br><b>変域</b>は、$x$ や $y$ がとれる値の範囲。「以上・以下」は ≦ ≧（その数をふくむ）、「未満・より大きい」は ＜ ＞（ふくまない）。',
  hs: '$y$ が $x$ に<b>比例</b>するとき、$y=ax$ と書ける。$a$ を<b>比例定数</b>という。<br>$x$ が2倍、3倍になると、$y$ も2倍、3倍になる。<br>$a=y\\div x$。1組の $x,y$ がわかれば、式が決まる。',
  ha: '比例の式 $y=ax$ に、$x$ の値を入れて、$y$ を計算する。<br>$y$ や $x$ が与えられたときは、まず<b>比例定数 $a$</b> を出して、式を作る。<br>$a=y\\div x$。',
  hg: '比例 $y=ax$ のグラフは、<b>原点を通る直線</b>。<br>$a>0$ なら<b>右上がり</b>、$a<0$ なら<b>右下がり</b>。$a$ の絶対値が大きいほど、急になる。<br>通る点は、$x$ を入れて、$y$ を出せば見つかる。',
  hy: 'グラフから式を読むには、<b>原点以外の、読みとりやすい点</b>を1つ見つける。<br>その点の $(x,y)$ から、$a=y\\div x$。<br>式は、$y=ax$。',
  hr: '比例の利用では、<b>1あたりの量</b>が、比例定数。<br>「1mの重さ」「毎分の量」「1まいの値段」など。まず、1あたりを出して、かける。<br>求めたいのが $x$ のときは、$y\\div a$。',
  hn: '$y$ が $x$ に<b>反比例</b>するとき、$y=\\dfrac{a}{x}$ と書ける。$a$ は<b>比例定数</b>。<br>$x$ が2倍、3倍になると、$y$ は $\\dfrac{1}{2}$、$\\dfrac{1}{3}$ になる。<br>$xy=a$（かけると一定）。$a=x\\times y$。',
  hv: '反比例の式 $y=\\dfrac{a}{x}$ は、$y=a\\div x$。<br>$xy=a$ なので、$x=a\\div y$ でも求められる。<br>まず $a=x\\times y$ を出して、式を作る。',
  hh: '反比例のグラフは、<b>双曲線</b>（原点を通らない、なめらかな2つの曲線）。$x$ 軸にも $y$ 軸にも、ふれない。<br>通る点は、$x$ を入れて、$a\\div x$ を計算すれば見つかる。<br>グラフ上の点 $(x,y)$ から、$a=x\\times y$。',
  hb: '比例か反比例かは、表で見分けられる。<br>・$y\\div x$ が<b>一定</b> → 比例（$y=ax$）<br>・$xy$ が<b>一定</b> → 反比例（$y=\\dfrac{a}{x}$）<br>どちらでもないこともある。',
  hu: '反比例の利用では、<b>かけた値が一定</b>（全体の量）に注目する。<br>「面積」「道のり」「全体の仕事量」「水そうの量」など。<br>全体の量 ＝ $x\\times y$ を出して、わる。'
};
const ABOUT = {
  zahyo: [
    { p: '<b>座標</b>は、点の位置を、$(x,\\ y)$ の2つの数で表す。' },
    { p: RT([['$(3,2)$', '→', '右へ3、上へ2'], ['$(-2,4)$', '→', '左へ2、上へ4'], ['$(0,-3)$', '→', '横には動かず、下へ3']]) },
    { cap: '先に横（$x$）、あとで縦（$y$）。' }
  ],
  hirei: [
    { p: '<b>比例</b>：$y=ax$。$x$ が2倍になると、$y$ も2倍。グラフは、<b>原点を通る直線</b>。' },
    { p: RT([['$a=y\\div x$', '→', '比例定数'], ['$a>0$', '→', '右上がり'], ['$a<0$', '→', '右下がり']]) },
    { cap: '「1あたりの量」が、比例定数。' }
  ],
  hanpi: [
    { p: '<b>反比例</b>：$y=\\dfrac{a}{x}$。$x$ が2倍になると、$y$ は半分。グラフは、<b>双曲線</b>。' },
    { p: RT([['$a=x\\times y$', '→', 'かけると一定'], ['$y=\\dfrac{a}{x}$', '→', '反比例の式']]) },
    { cap: '「全体の量」が、反比例の $a$。' }
  ]
};
const PARTS = [
  {
    id: 'zahyo', title: '座標と関数', sub: '点・象限・変域', about: ABOUT.zahyo, aboutTitle: 'まず見てみよう：座標', aboutSub: '先に横、あとで縦',
    steps: [
      { id: 'zahyo-1', title: '座標を読む', sub: '先に横、あとで縦', intro: I.zh, qs: genZahyo() },
      { id: 'zahyo-2', title: '象限', sub: '第1〜第4象限', intro: I.sg, qs: genShogen() },
      { id: 'zahyo-3', title: '関数と変域', sub: '＜ ＞ ≦ ≧', intro: I.kn, qs: genKansu() }
    ]
  },
  {
    id: 'hirei', title: '比例', sub: '式・グラフ・利用', about: ABOUT.hirei, aboutTitle: 'まず見てみよう：比例', aboutSub: 'y=ax と、原点を通る直線',
    steps: [
      { id: 'hirei-1', title: '比例の式', sub: '比例定数を出す', intro: I.hs, qs: genHiShiki() },
      { id: 'hirei-2', title: '比例の値を求める', sub: 'x に入れて y を出す', intro: I.ha, qs: genHiAtai() },
      { id: 'hirei-3', title: '比例のグラフ', sub: '原点を通る直線', intro: I.hg, qs: genHiGraph() },
      { id: 'hirei-4', title: 'グラフから式を読む', sub: 'a = y ÷ x', intro: I.hy, qs: genHiYomu() },
      { id: 'hirei-5', title: '比例の利用', sub: '1あたりの量', intro: I.hr, qs: genHiRiyo() }
    ]
  },
  {
    id: 'hanpi', title: '反比例', sub: '式・グラフ・利用', about: ABOUT.hanpi, aboutTitle: 'まず見てみよう：反比例', aboutSub: 'y=a/x と、双曲線',
    steps: [
      { id: 'hanpi-1', title: '反比例の式', sub: 'a = x × y', intro: I.hn, qs: genHanShiki() },
      { id: 'hanpi-2', title: '反比例の値を求める', sub: 'a ÷ x を計算', intro: I.hv, qs: genHanAtai() },
      { id: 'hanpi-3', title: '反比例のグラフ', sub: '双曲線', intro: I.hh, qs: genHanGraph() },
      { id: 'hanpi-4', title: '比例か反比例か', sub: 'y÷x と xy', intro: I.hb, qs: genHanHantei() },
      { id: 'hanpi-5', title: '反比例の利用', sub: '全体の量が一定', intro: I.hu, qs: genHanRiyo() }
    ]
  }
];

/* ふりがな（ルビ）をつける：全部の文字列に */
const ruby = o => typeof o === 'string' ? o.replace(/累乗/g, '<ruby>累乗<rt>るいじょう</rt></ruby>').replace(/解(?=[はがをにのと、。<」）＝ ]|$)/g, '<ruby>解<rt>かい</rt></ruby>')
  : Array.isArray(o) ? o.map(ruby) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (k === 'expr' || k === 'id') ? v : ruby(v)])) : o;
const out = '// 自動生成（node gen4.js）。手で直すときは gen4.js を直す。\nconst PARTS = ' + JSON.stringify(ruby(PARTS)) + ';\nif (typeof module !== \'undefined\') module.exports = PARTS;\n';
fs.writeFileSync(path.join(__dirname, 'src/data.js'), out);
let n = 0; PARTS.forEach(P => P.steps.forEach(s => { n += s.qs.length; }));
console.log('src/data.js を作成：' + n + '問、' + (out.length / 1024).toFixed(0) + 'KB');
