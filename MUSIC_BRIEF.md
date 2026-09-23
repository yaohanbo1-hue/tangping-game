# MiniMax Music 3 音乐生成单

本游戏已接好三段可选循环配乐。把生成文件放进 `audio/` 并使用下列文件名，游戏会在玩家第一次点击或按键后播放；缺少音轨不会影响游戏或战斗音效。

| 文件名 | 用途 | 建议时长 |
|---|---|---:|
| `audio/menu-loop.mp3` | 主菜单：神秘、安静，暗示梦境有隐情 | 55–75 秒 |
| `audio/game-loop.mp3` | 普通防守：持续紧张但不压过战斗音效 | 65–85 秒 |
| `audio/boss-loop.mp3` | 终局首领：威胁感、悬疑感与压迫感 | 55–75 秒 |

## 通用要求

- 使用 **MiniMax Music 3** 生成纯音乐；无人声、无歌词、无旁白、无可辨识语言。
- 每段从开头到结尾都能自然循环：不要渐弱到静音，不要结尾鼓点、终止和弦或明显收尾；开头和结尾的氛围、速度、调性要衔接。
- 让音乐保持克制，为游戏音效和剧情对白留出空间；避免尖锐高频、突然巨响和持续密集鼓组。
- 建议先导出 WAV 母带（44.1 kHz、立体声），试听循环点后再转成 MP3（约 192 kbps）。最终文件名必须和表格一致。
- 生成后把 `audio/` 文件夹和游戏 HTML 一起分发。将来若要把音乐内嵌进单文件版，需要另做数据 URI 构建；目前音轨是外置文件。

## 主菜单提示词：`menu-loop.mp3`

> Instrumental cinematic ambient loop for a mysterious dream-defense game's main menu. Quiet, intimate, uncanny and emotionally restrained, with a sense that the player has been here before. A fragile three-note felt-piano motif returns like a clock stopped at 03:07; distant glass harmonics, soft reversed breath-like textures, subtle tape flutter and a very low warm synth drone. Slow, spacious, delicate dynamics, no strong beat. Keep the center and high frequencies sparse so dialogue stays clear. Seamless loop, stable atmosphere from the first second to the last, no fade-out, no final chord, no transition, no vocals, no speech, no lyrics, no jump scare.

## 战斗提示词：`game-loop.mp3`

> Instrumental dark-ambient tension loop for a surreal tower-defense battle inside a dream. Steady and focused rather than frantic: muted low percussion like a distant heartbeat, restrained ticking pulses, soft analog synth bass, bowed metallic textures and occasional fragments of the same delicate three-note felt-piano motif. Build a quiet sense of pressure without a large climax; leave clear space for frequent game sound effects and spoken story scenes. Seamless loop with consistent pulse and tonal center, no fade-out, no ending hit, no vocals, no speech, no lyrics, no harsh high frequencies.

## 终局首领提示词：`boss-loop.mp3`

> Instrumental cinematic boss loop for the final nightmare in a dream-defense game. Ominous, suspenseful and weighty, with low restrained brass-like synth, bowed metal, distant frame drums and a subtly distorted echo of the three-note 03:07 piano motif. Create pressure and scale through layered harmony and pulse, not constant loudness; leave room for dialogue, impacts and battle effects. Keep the energy high but controlled, and make the ending reconnect naturally to the opening for repeated looping. No victory ending, no final crash, no fade-out, no vocals, no speech, no lyrics, no sudden jump scare.

三首 MP3 已放入 `audio/` 并接入游戏。若后续重新生成，保留表格中的文件名即可替换曲目。
