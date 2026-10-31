# 音频资源说明

## BGM（本地文件，按幕切换）

目录：`public/assets/audio/bgm/`。映射表在 `src/config/audio.ts`，播放逻辑在
`src/game/sound.ts`，切幕由 `src/App.tsx` 根据剧情阶段触发。

| 场景 | 曲目 | 文件 |
| --- | --- | --- |
| 标题 / 序幕 / 结局 VN | Hitman | `Hitman(chosic.com).mp3` |
| 第一幕 · 正常巡检 | Push (Long Version) | `Push-Long-Version(chosic.com).mp3` |
| 第二幕 · 主变检修 | Powerful Trap | `Powerful-Trap-(chosic.com).mp3` |
| 第三幕 · 施工现场 | Chase | `alexander-nakarada-chase(chosic.com).mp3` |

- 四首均为循环播放，音量在 `BGM_TRACKS` 中逐曲设置（0.16–0.22）。
- 结局结算黑屏（`ending-stub`）停止 BGM；标题页同样静音，进入序幕后再起播。
- `M` 键或设置页“声场”静音会暂停 BGM，恢复时从当前幕重新起播。
- 浏览器自动播放限制：首次播放被拒绝时，会在下一次点击/按键后自动重试。
- 署名：chosic.com / Alexander Nakarada；设置页底部通过 `BGM_CREDIT` 显示。

### 更换曲目

1. 把 mp3 放进 `public/assets/audio/bgm/`（文件名建议保持 ASCII）。
2. 修改 `src/config/audio.ts` 中对应 `BgmKey` 的 `src`、`label`、`artist`、`volume`。
3. 运行 `bun test`（会校验文件存在且三幕曲目互不相同）并刷新页面。

## 其他音效

环境变压器嗡鸣、脚步、UI 提示均为 Web Audio 程序化合成，位于
`src/game/sound.ts`，不依赖采样文件。目前没有 SFX 采样与语音文件目录。

## 许可提醒

chosic.com 曲目按其页面标注的许可使用；若替换为 CC-BY 素材，请同步更新
`BGM_CREDIT` 与上表署名。
