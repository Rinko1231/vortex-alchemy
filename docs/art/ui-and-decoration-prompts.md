# UI 与背景装饰美术提示词

下面有两张互相独立的图，分别整段复制使用。第一张是可切片的透明 UI 装饰图集，第二张是 16:9 的游戏背景。所有文字、数字、按钮文案和倒计时都由游戏界面实时渲染，不烘焙进图片。

如果 GPT Image 支持附带参考图，可以把现有的 `sheet_alchemy.png` 一并附上，让 UI 的描边、明暗和配色更接近棋子。提示词本身不依赖作品名，也不依赖参考图才能成立。

## 一、透明 UI 装饰图集

```text
Create one polished production UI decoration sheet for a bright casual 2D match-3 puzzle game, arranged as an exact 6-column by 3-row asset grid on a single 3:2 canvas. Treat the grid as invisible layout guides only. Every cell must be equal in size, with each UI element centered and fully contained inside its own cell. The entire background, the gaps between cells, and every unused cell must be fully transparent with alpha 0. Do not draw grid lines, frames around the whole sheet, captions, letters, numbers, words, labels, logos, watermarks, signatures, checkerboard transparency, scenery, or a backdrop. Do not include baked button text or baked timer digits.

Match a clean, cheerful casual match-3 game style: chunky rounded shapes, bold smooth deep-plum outlines, warm cream surfaces, honey-gold trim, saturated amethyst-violet accents, a small amount of turquoise for highlights, simple two-tone cel shading, and one crisp highlight per element. If a matching game-piece sprite sheet is attached, use it only as a style reference for outline weight, palette brightness, and shading simplicity. The UI should feel tactile and playful without looking like a generic app dashboard, a dark-fantasy RPG menu, a watercolor illustration, a paper mockup, a photorealistic object, or a 3D render.

Row 1, column 1: a rounded rectangular game-panel frame with a warm cream inner plate, deep-plum outline, simple gold trim, and an empty transparent or flat cream center suitable for CSS nine-slice scaling. Row 1, column 2: a horizontal rounded timer plate with a blank center area for live digits. Row 1, column 3: a compact horizontal ribbon banner with a blank center and simple folded ends. Row 1, column 4: a blank primary button with a bright honey-gold face, cream highlight, and no icon or text. Row 1, column 5: a blank secondary button with a plum-violet face, gold rim, and no icon or text. Row 1, column 6: a blank circular icon-button base with a cream face and gold rim.

Row 2, column 1: a simple pause icon made of two bold rounded vertical bars. Row 2, column 2: a simple settings gear icon. Row 2, column 3: a small open book or scroll icon for help. Row 2, column 4: a speaker icon with visible sound waves. Row 2, column 5: a speaker icon with a small diagonal mute slash. Row 2, column 6: a circular score badge with a bold four-point star and a blank center area. Every icon must be centered on its own transparent background, with the same stroke weight and visual size as the others.

Row 3, column 1: a small round grail-count badge with a simple gold chalice symbol and a blank area for a number. Row 3, column 2: a compact chain-reaction badge with a bold gold spiral and a violet spark, leaving space for live text. Row 3, column 3: one reusable decorative corner ornament made of a simple gold curve and a small violet gem, designed to be rotated to all four corners at runtime. Row 3, column 4: a horizontal divider with a slim gold line and a central amethyst diamond. Row 3, column 5: one empty board-cell inset, a rounded square with a deep-plum rim, a slightly darker translucent center, and no symbols, designed to sit beneath a game piece. Row 3, column 6: a very subtle circular 2×2 rotation hint ring with four short corner brackets and a faint center arrow motif, deliberately low-contrast so it can be blurred and shown at low opacity during gameplay.

Draw only the eighteen UI elements described above. Keep every element inside its own cell with a clear transparent gap. Use consistent line weight, lighting, scale, and corner radius across the whole sheet. Buttons and plates must have empty centers for runtime text. The result must look like a coherent, production-ready game UI kit that can be sliced immediately, not a poster, storefront mockup, or interface screenshot. Return a single image with transparency preserved.
```

### UI 图集阵列

| 行 | 第 1 列 | 第 2 列 | 第 3 列 | 第 4 列 | 第 5 列 | 第 6 列 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 主面板框 | 倒计时底板 | 丝带标题条 | 主按钮空底 | 次按钮空底 | 圆形按钮空底 |
| 2 | 暂停图标 | 设置图标 | 帮助图标 | 声音开启 | 声音关闭 | 星形分数徽章 |
| 3 | 圣杯徽章 | 连锁徽章 | 可复用角饰 | 分隔线 | 棋盘空格底 | 弱化旋转提示环 |

## 二、16:9 游戏背景

```text
Create one complete 16:9 background illustration for a bright casual 2D match-3 puzzle game, in a cheerful cartoon alchemy-laboratory setting. This is an opaque background image with no transparency. Match the visual language of a polished casual puzzle game: chunky rounded shapes, bold clean outlines, saturated but controlled colors, simple cel shading, and small crisp highlights. If a matching game-piece sprite sheet is attached, use it only as a style reference for palette, outline weight, and brightness.

Composition: keep the central 60–65 percent of the image calm, dark, and mostly empty so an 8×8 game board and its bright pieces can sit on top without visual competition. The center should read as a broad, softly lit deep-plum stone or wooden worktable with a subtle radial glow, not a detailed scene. Place all decoration around the outer edges: a few chunky glass bottles, a copper alchemical ring, small jars, simple herbs, crescent moon motifs, and a little violet magical smoke. Keep edge decoration lower in contrast and complexity than the game pieces. Do not draw a board grid, pieces, HUD, buttons, panels, text, numbers, title, logo, watermark, or characters. Do not put a large object in the center.

Palette: deep aubergine and plum surfaces, warm cream highlights, honey gold metal, amethyst violet accents, and a few small turquoise sparks. The mood should be cozy, magical, and inviting rather than grim or horror-themed. Use clean cartoon illustration, not photorealism, 3D rendering, watercolor, gouache, paper texture, grunge, intricate engraving, or dark-fantasy painterly art. The outer decorations may be detailed enough to establish the setting, but the central safe area must remain visually quiet and easy to cover with a subtle dark overlay.

Return a single landscape image in exact 16:9 aspect ratio, suitable as a browser-game background at 1920×1080 and readable when cropped slightly on narrower screens.
```

## 使用说明

- UI 图集按 6 列 × 3 行切片，每格约 256×256；主面板、倒计时底板与按钮空底适合做九宫格拉伸。
- 图集里不应该出现任何文字或数字。倒计时、分数、按钮文案、设置标签全部由 DOM 渲染。
- 背景中间不要叠加棋盘格线或静态棋子，棋盘与棋子由游戏实时绘制。
- 背景四周的装饰要能在 1440×900、1920×1080 和手机竖屏裁切下保留主要内容；竖屏时优先保留中间桌面与上方装饰。
- 旋转提示环在游戏内只作为弱提示使用：常态隐藏，悬停、键盘聚焦或按住时以约 25%–35% 不透明度、55%–65% 缩放和 2–3px 模糊出现，移开后淡出。
- 如果 UI 图集生成了白底或棋盘格，应先重新生成或抠图；不要让不透明背景直接进入游戏。

