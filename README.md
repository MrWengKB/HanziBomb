包含欢乐伙伴2.0一年级所有的识读字。可选年级、课次、速度。

文件结构：
- `index.html` 页面
- `style.css` 样式
- `hanzilist.csv` 字库，四栏：年级,课次,汉字,拼音（与 HanziMatch 相同）。加新年级或新课次只需往这个文件里加行。
- `js/hanzilist.js` 读取字库
- `js/game.js` 游戏逻辑

注意：页面要通过网址打开（GitHub Pages，或在文件夹里运行 `python3 -m http.server` 后访问 http://localhost:8000）。直接双击 index.html 打开时，浏览器不允许读取 hanzilist.csv。
