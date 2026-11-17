包含欢乐伙伴2.0一至三年级的识读字（共1031字，来自 HanziQuery）。可选年级、课次、速度。

文件结构：
- `index.html` 页面
- `style.css` 样式
- `hanzilist.csv` 字库，五栏：年级,课次,生字,拼音1,拼音2（与 HanziMatch 相同）。多音字题目显示拼音1。加新年级或新课次只需往这个文件里加行。
- `js/hanzilist.js` 读取字库
- `js/game.js` 游戏逻辑

注意：页面要通过网址打开（GitHub Pages，或在文件夹里运行 `python3 -m http.server` 后访问 http://localhost:8000）。直接双击 index.html 打开时，浏览器不允许读取 hanzilist.csv。
