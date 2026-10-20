# Vortex Alchemy 音效与 BGM 提示词

这份文档给 ludo.ai 使用。音效和 BGM 分开生成：音效走短促的一次性音效模式，BGM 走可循环的音乐模式。

当前状态：六个文件已经放入 `src/assets/audio` 并接入游戏。常规合成 0.24 秒、四阶合成 1 秒、圣杯 2 秒、道具 0.47 秒、UI 点击 0.47 秒，BGM 约 78.7 秒。下面的提示词保留为后续重生成或做变体时的基准。

## 共通风格

整体听感是明亮、温暖、轻松的炼金工坊：玻璃器皿的清脆声、黄铜小件、软木塞、木桌、轻微气泡和细碎魔法闪光。它应该像一款精致的休闲消除游戏，而不是黑暗奇幻、恐怖片或厚重史诗。

不要把文字、歌词、旁白或对白放进音频；不要模仿或复刻任何现有作品的旋律与音色。

如果 ludo.ai 支持统一风格标签，可以在每条提示词前加上：

```text
Warm, bright, cozy casual puzzle-game audio for a magical alchemy workbench: glass, brass, soft wood, gentle bubbles and sparkling chimes. Clean, friendly, tactile, playful but not childish. Not dark fantasy, not horror, no vocals, no recognizable existing melody.
```

## 音效

音效建议导出为 48 kHz、24-bit WAV；单声道即可，方便浏览器播放和后续统一音量。每条都从第一个瞬态开始，不要留大段开头静音，也不要拖出很长的混响尾巴，否则连锁时容易糊成一片。

### 1. 常规合成

建议时长：0.25–0.35 秒  
文件建议名：`merge-normal.wav`

```text
Create a single short one-shot sound effect, about 0.30 seconds, for a casual match-3 alchemy game. A soft glass clink followed by a tiny bubbly pop and a bright ascending two-note chime. Warm, satisfying, tactile and clean, with a crisp transient and a fast decay. No long reverb tail, no music bed, no vocals, no recognizable existing melody. Bright cozy magical laboratory mood, polished cartoon puzzle-game sound design. Start immediately with no leading silence; keep the full tail under 0.35 seconds.
```

### 2. 四阶宝石合成

建议时长：0.5–0.7 秒  
文件建议名：`merge-tier4.wav`

```text
Create a single short one-shot sound effect, about 0.60 seconds, for merging four tier-three pieces into a faceted tier-four gem in a casual alchemy puzzle game. Use a richer crystal chime, a short brass shimmer, a soft low thump and a quick rising sparkle. It should feel more valuable and slightly heavier than a normal merge, but still compact and clean. Crisp attack, controlled decay, no long reverb tail, no vocals, no music bed, no recognizable existing melody. Start immediately and keep the full sound under 0.7 seconds.
```

### 3. 圣杯合成

建议时长：1.2–1.8 秒  
文件建议名：`grail.wav`

```text
Create a single one-shot reward sound effect, about 1.5 seconds, for crafting the Holy Grail in a cozy casual alchemy puzzle game. A warm brass bell, a four-note ascending glass chime, a gentle magical shimmer and a soft airy pad swell, ending with one clean sparkle. Triumphant and heartwarming, but not epic orchestral, not dark, not overly loud. No intelligible vocals, no lyrics, no music bed, no recognizable existing melody. Start immediately with a clear attack and leave a smooth but controlled tail; keep the full sound under 1.8 seconds.
```

### 4. 使用道具

建议时长：0.35–0.5 秒  
文件建议名：`item-use.wav`

```text
Create a single short one-shot sound effect, about 0.40 seconds, for using a magical alchemy item in a casual puzzle game. A small glass stopper pop, a quick airy magical whoosh and a bright sparkle, tactile and helpful rather than explosive. Keep the transient clean and the tail short. No long reverb, no vocals, no music bed, no recognizable existing melody. Start immediately and keep the full sound under 0.5 seconds. If the generator supports subtle variations, make one airy violet sparkle variant for a wildcard item and one warmer golden rising variant for an upgrade item; both must share the same duration and loudness.
```

### 5. UI 按钮

建议时长：0.06–0.12 秒  
文件建议名：`ui-click.wav`

```text
Create a single very short one-shot UI button sound, about 0.08 seconds, for a cozy casual puzzle game. A soft wooden tick with a tiny glass click, quiet, dry, friendly and unobtrusive. No pitched melody, no long tail, no reverb wash, no vocals. It must remain pleasant after many repeated presses and should not sound like a harsh system beep. Start immediately; keep the full sound under 0.12 seconds.
```

## BGM

建议时长：60–90 秒无缝循环  
文件建议名：`bgm-alchemy-loop.wav`（另可导出 OGG 或 MP3）  
建议响度：约 -18 LUFS，给合成音效留出空间。

```text
Create a seamless loopable background music track, about 75 seconds long, 96 BPM, stereo, for a cozy magical-alchemy casual puzzle game. Warm marimba and celesta plucks, a soft synth pad, a light shaker, a gentle bass pulse and occasional tiny glass chimes. The mood is curious, calm and slightly playful, with low-to-medium energy so frequent merge sound effects remain clearly audible. Use a simple harmonic loop with no strong lead melody, no vocals, no dramatic build, no sudden drops and no fade-out at the end: the final bar must connect cleanly back to the first bar. Not dark fantasy, not horror, not epic orchestral, not chiptune, and no recognizable existing melody.
```

## 导出与接入约定

- 每条音效单独导出，不要把多个音效拼成一条长轨。
- 音效峰值控制在约 -6 dBFS，避免削波；BGM 保持约 -18 LUFS。
- 常规合成、四阶合成、圣杯和道具音效要能在快速连锁时叠加，不要使用过长的尾音。
- UI 按钮音效应该明显比其他音效更轻、更短。
- BGM 开头和结尾不要做淡入淡出；游戏会自己控制淡入淡出和音量。
- 文件已经统一放在 `src/assets/audio`，并由 Phaser 接入合成、圣杯、道具、按钮与 BGM 播放。
