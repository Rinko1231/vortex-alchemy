# 棋子与核心符号美术提示词

## 使用方式

把下面整个代码块一次交给 GPT Image。它已经包含画布比例、6×4 阵列、每个格子的内容、简洁卡通的消除游戏风格、透明背景和禁止项，不需要再拼接通用开头。提示词正文不包含作品名。

要求模型输出一张 3:2 的透明背景图。如果生成结果出现棋盘格、白底或纸张背景，说明透明通道没有保住，应重新生成或先抠图再使用。

## 整段提示词

```text
Create one polished production spritesheet of simple cartoon game pieces for a casual 2D match-3 puzzle game, laid out as an exact 6-column by 4-row asset grid on a single 3:2 canvas. Treat the grid as invisible layout guides only. Every cell must be equal in size, with generous transparent padding around its contents, and each object must be centered and fully contained inside its own cell. The entire background, the gaps between cells, and every unused cell must be fully transparent with alpha 0. Do not draw grid lines, borders, frames, panels, captions, letters, numbers, labels, checkerboard transparency, scenery, or a backdrop. Do not add shadows outside the sprites. Do not include any title, logo, watermark, signature, or written language.

Visual direction: clean, bright, cheerful casual match-3 icon art. Use chunky rounded silhouettes, bold smooth dark outlines, saturated color fills, simple two-tone cel shading, and one small crisp highlight per object. Keep shapes compact and highly readable at 48–64 pixels. Every piece must feel like it belongs to the same cheerful game set, with consistent scale, outline weight, lighting, and visual density. Use controlled glossy highlights, but avoid realistic glass refraction and excessive bevels. Do not use watercolor, gouache, paper texture, sepia ink, grunge, engraving, intricate filigree, dark-fantasy illustration, painterly brushwork, photorealism, 3D rendering, anime art, or concept-art presentation. This must look like finished, ready-to-slice casual puzzle game icons, not a poster or illustration sheet.

Columns 1 through 4 contain four clearly different bright color families in this exact left-to-right order: charcoal black, pearl white, ruby red, and warm golden yellow. Add one simple bold color emblem to every tier of each family: a crescent moon for the black family, a four-point star for the white family, a flame droplet for the red family, and a small sun for the yellow family. Keep each family consistent across all four rows. The black pieces should use deep charcoal glass with bright violet-blue highlights and a light outside outline so they never become unreadable black blobs. The white pieces should use warm pearl white with soft sky-blue shadows and a strong navy or charcoal outline so they stand out on pale surfaces.

Rows 1 through 4 contain the same progression of alchemical vessel shapes in every color column: row 1 is a slim first-tier test tube with a rounded bottom and a simple cork; row 2 is a second-tier beaker with a clear pouring lip; row 3 is a third-tier round-bottom flask with a narrow neck; row 4 is a fourth-tier chunky faceted gemstone. The four tier silhouettes must remain immediately distinguishable in grayscale. All four colors within a row must share the same scale, visual weight, angle, and basic pose, with no one piece looking tiny or oversized.

In column 5, row 1, draw the wildcard: a cheerful bright violet blob of alchemical slime with a simple white spiral vortex in its center, two or three large bubbles, and a small golden sparkle. It must read as a friendly puzzle piece at small size. Rows 2, 3, and 4 of column 5 are completely empty and fully transparent.

In column 6, row 1, draw the Holy Grail: a chunky cartoon gold chalice with four small bright inlaid gems in black, white, red, and yellow, plus a simple violet glow rising from the cup. Row 2 of column 6 is a circular brass rotation dial seen from above, with four bold curved arrows and a bright violet gem at its center, designed as a clickable 2×2 rotation control. Row 3 is a compact radial merge burst made of bright gold and violet star-shaped sparks. Row 4 is an upward chain-reaction flare made of a simple curling gold ribbon and a few violet sparkles. Keep both effects bold, clean, and fully contained inside their cells.

Draw only the sixteen colored vessels, one wildcard, one Holy Grail, one rotation dial, one merge burst, and one chain flare. Preserve a clear transparent gap around every object so no artwork crosses a cell boundary. All pieces must face the viewer at the same angle and fill roughly the same area inside their cells. The result must read as one coherent, production-ready casual puzzle game sprite sheet, not a lineup of detailed props. Return a single image with transparency preserved.
```

## 阵列内容

| 行 | 第 1 列 | 第 2 列 | 第 3 列 | 第 4 列 | 第 5 列 | 第 6 列 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 黑一阶试管 | 白一阶试管 | 红一阶试管 | 黄一阶试管 | 万能紫胶 | 圣杯 |
| 2 | 黑二阶烧杯 | 白二阶烧杯 | 红二阶烧杯 | 黄二阶烧杯 | 透明空位 | 旋转转盘 |
| 3 | 黑三阶圆底烧瓶 | 白三阶圆底烧瓶 | 红三阶圆底烧瓶 | 黄三阶圆底烧瓶 | 透明空位 | 合并火花 |
| 4 | 黑四阶宝石 | 白四阶宝石 | 红四阶宝石 | 黄四阶宝石 | 透明空位 | 连锁光带 |

## 使用与切片

- 目标尺寸：单格约 512×512，整图约 3072×2048；模型输出更小也可以，后续统一缩放。
- 图集只包含棋子与关键符号，不生成 HUD、按钮、背景和文字。
- 当前 `sheet_alchemy.png` 为 1536×1024，但器物在格内并非严格居中；运行 `npm run sprites:normalize` 会按透明轮廓重新排列为 `src/assets/sheet_alchemy_centered.png`，游戏使用后者。
- 导入游戏前先检查四角与格子间隙是否真的透明。
- 按 6 列 × 4 行等分切片；每个切片再以内容包围盒居中，不单独拉伸某个棋子。
- 同一行保持同一视觉重量。烧杯不能比试管大出一倍，四阶宝石也不能缩成小点。
- 第一轮先生成并检查轮廓；确认颜色、阶级和透明度后，再决定是否重绘局部。
- 右下区域的旋转转盘不要作为常驻大图标。游戏内只把它当作悬停、按住或教学提示，建议以 25%–35% 不透明度、55%–65% 缩放和 2–3px 模糊显示。

可选的 UI 与背景装饰提示词见 `docs/art/ui-and-decoration-prompts.md`。

