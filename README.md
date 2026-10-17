# 中学数学 レベル4（座標・比例・反比例）

公開URL: https://chugaku-suugaku4.senta1111.workers.dev/

- 配信するのは `public/index.html` の1枚だけ（KaTeXの式表示も中に入っている）。
- 内容: 座標と関数 / 比例 / 反比例。全13ステップ・81問。座標平面の図は SVG を自動で描いている。
- 問題を直す・足すとき: `tools/gen4.js` を直す。
  1. `cd tools`
  2. `node gen4.js`（`src/data.js` を作る）
  3. `node check.js`（ALL OK が出ること）
  4. `node build.js --repo`（`tools/public/index.html` を作る）→ `public/index.html` に置きかえる
