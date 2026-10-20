# Vortex Alchemy

一款 8×8 棋盘、以 2×2 旋转和同色同阶合并为核心的限时浏览器游戏。

当前状态：可玩的第一版原型。桌面与手机布局、完整合并规则、连锁加时、圣杯、设置、暂停与结算均已接通。

仓库：<https://github.com/Rinko1231/vortex-alchemy>

## 本地运行

```powershell
npm install
npm run dev
```

本地地址：<http://127.0.0.1:5173/>

生产构建：

```powershell
npm run build
npm run preview
```

## 验证

```powershell
npm test
npm run build
```

本地开发服务器运行时可做浏览器验收：

```powershell
npm run playtest
```

截图和机器可读的验收结果会写入 `artifacts/`。

## 已实现

- 8×8 棋盘、7×7 个可点击旋转中心。
- 左键 / 轻触顺时针旋转，右键 / Shift 逆时针旋转。
- 同色同阶合并、三格原地补子、自动连锁。
- 万能棋子替代一阶棋子，四万能合成圣杯。
- 黑、白、红、黄各一颗四阶宝石合成圣杯。
- 分段加时、连锁倍率、倒计时、暂停与结算。
- 开局时间、各阶加时、连锁倍率与补子权重设置。
- 本地最佳记录、自定义参数提示、桌面与手机布局。
- 低透明度模糊旋转提示，只在悬停、按住或键盘聚焦时出现。
- 棋子按透明轮廓重新居中，修正原图各格留白不一致造成的错位。

## GitHub Pages

仓库已带 `.github/workflows/deploy.yml`。在 GitHub 创建仓库并推送到 `main` 后：

1. 打开仓库的 `Settings` → `Pages`。
2. 将 `Source` 设为 `GitHub Actions`。
3. 等待 `Deploy to GitHub Pages` 工作流完成。

`vite.config.ts` 使用的是相对路径 `base: "./"`，因此部署在仓库子路径下也能正常加载图片与脚本，不需要改成仓库名。

## 文档

- [游戏设计与核心循环](docs/design/vortex-alchemy-game-design.md)
- [棋子与核心符号的美术提示词](docs/art/vortex-alchemy-asset-prompt.md)
- [UI 与背景装饰的美术提示词](docs/art/ui-and-decoration-prompts.md)

## 目录

- `src/game/board.ts`、`engine.ts`、`config.ts` 等规则和状态不依赖 Phaser。
- `src/game/GameScene.ts` 只负责棋盘表现、输入和动画。
- `src/ui` 与 `src/styles.css` 负责 DOM HUD、设置和响应式布局。
- `src/assets/ui` 是从 `sheet_ui.png` 自动裁出的透明 UI 切片。
- `src/assets/sheet_alchemy_centered.png` 是重新居中的运行时棋子图集；运行 `npm run sprites:normalize` 可重建。
- `scripts/slice-ui.ps1` 可重新生成 UI 切片。



