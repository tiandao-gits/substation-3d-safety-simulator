# VN 结局与缺失角色美术资源 · 生成清单

> 用途：结局 VN（GOOD / END）与第二/三幕对白头像。代码已经按下列路径接好；文件放入 `public/assets/vn/` 后即可生效。
> **状态（2026-10-31）**：下列 2 张背景与 3 张立绘已生成并转为 WebP；3 张 256×256 头像由对应立绘裁切。转换时已裁掉原图右下角“豆包 AI 生成”水印（背景 1792×936、立绘 655×1536）。原 PNG 保留在 `.asset-backup/vn-png-originals/`，不参与构建。
> 所有图片最终请存为 **WebP**；若手头是 PNG，放到对应路径后告诉我，我可以统一转换。图片不得带文字、水印、logo。
> 统一风格参考（可直接作为生成器的参考图）：
> - 背景：`public/assets/vn/bg/bg-office-morning.webp`（电影感写实、暖色晨光、站区工业纵深）
> - 人物：`public/assets/vn/chars/chen-normal.webp`、`wang-normal.webp`、`zhao-normal.webp`（写实、全身、深色工业室内背景、竖向 655×1536）

---

## 1. 结局背景（必需）

### 1.1 GOOD 结局 · 傍晚施工现场

- 路径：`public/assets/vn/bg/bg-site-dusk.webp`
- 尺寸：1792×970（或 1792×1024，16:9，VN 会 cover 裁切）
- 参考图：`bg-office-morning.webp`（影调/写实度）+ `public/assets/scene.jpg`（站区布局/材料）

```text
Use case: visual-novel ending background
Input images: Image 1 is a style reference for cinematic realism, warm dusk color grading and photographic depth; do not copy its office subject. Image 2 is a reference for the 220kV substation/construction site layout and industrial materials.
Primary request: a cinematic 16:9 background of a Chinese 220kV substation construction area at dusk, after rectification, no people.
Scene/backdrop: concrete firewall walls, outdoor switchgear bays, steel lattice structures, neat stacks of timber and pipes, a fenced foundation pit with proper edge protection in the middle distance, warm orange sunset sky fading to deep blue, distant mountains.
Style/medium: photorealistic cinematic still, natural film grain, realistic concrete/steel/wood textures.
Composition/framing: wide establishing shot, camera slightly elevated, clear negative space in the lower third for dialogue UI, no portraits.
Lighting/mood: warm low-angle sunset light, long shadows, calm and resolved atmosphere.
Text: none.
Constraints: no people, no readable signs or logos, no watermark, no text, no sci-fi or fantasy elements; keep the site recognizably an electrical substation construction yard.
```

### 1.2 END 结局 · 夜间事故复盘会议室

- 路径：`public/assets/vn/bg/bg-meeting-night.webp`
- 尺寸：1792×970（或 1792×1024，16:9）
- 参考图：`bg-office-morning.webp`（影调/写实度）

```text
Use case: visual-novel ending background
Input images: Image 1 is a style reference for cinematic realism, photographic depth, dark interior grade and restrained industrial palette; do not copy its office subject.
Primary request: a cinematic 16:9 background of a substation accident-investigation meeting room at night, no people.
Scene/backdrop: a small conference room, long table with folders and printed records, a large whiteboard with an abstract timeline of blurred unreadable marks and photos, window with reflections of the night substation, steel/glass industrial building.
Style/medium: photorealistic cinematic still, natural film grain, realistic wood/glass/paper textures.
Composition/framing: wide interior establishing shot, camera at eye level, clear negative space in the lower third for dialogue UI, no portraits.
Lighting/mood: dim cool overhead light, a single warm desk lamp, serious and somber atmosphere, long shadows.
Text: none legible.
Constraints: no people, no readable words, no logos, no watermark, no text, no fantasy elements; keep it clearly a work meeting room for an electrical safety investigation.
```

---

## 2. 缺失角色立绘与头像（必需）

> 立绘：竖向全身，深色工业/办公室内背景，人物居中，头顶留少量空间，脚底留少量空间；建议 655×1536（与现有立绘一致）或 1024×1536。
> 头像：同一角色、同服装、同发型的方形头肩照，256×256；可以用生成好的立绘裁切头部，或单独生成。
> 陆川不出立绘（设定如此），不生成。

### 2.1 周敏（运维值班负责人）

> 已生成立绘的胸前绣字为“周明”，与角色名“周敏”不一致；如需严格一致，需重新生成或局部修图。

- 立绘：`public/assets/vn/chars/zhou-normal.webp`
- 头像：`public/assets/vn/avatars/zhou.webp`
- 参考图：`chen-normal.webp`、`zhao-normal.webp`（写实人物风格）+ 现有 `bg-office-morning.webp`（工业办公背景）

```text
Use case: visual-novel character portrait
Input images: Image 1 and Image 2 are style references for photorealistic Chinese industrial professionals, cinematic lighting, dark interior backdrop and full-body framing; do not copy the people in them. Image 3 is a reference for the industrial office atmosphere.
Primary request: full-body portrait of a Chinese woman in her early 30s, Zhou Min, operations duty supervisor at a 220kV substation.
Subject: calm, composed expression; shoulder-length black hair tied back; navy-blue utility jacket with subtle reflective piping, white shirt, dark trousers, safety shoes; no hard hat (held under one arm is optional); hands relaxed.
Style/medium: photorealistic cinematic character still, realistic skin/fabric texture, natural film grain, consistent with the reference portraits.
Composition/framing: vertical full-body, centered, head near the top with small headroom, feet visible, dark industrial interior background with soft depth separation, clear silhouette.
Lighting/mood: soft cool key light with a warm rim, professional and serious.
Text: none.
Constraints: no text, no logo, no watermark, no extra people, no exaggerated pose; realistic Chinese features, age-appropriate.
```

头像（可用立绘裁头，或单独）：

```text
Use case: visual-novel avatar
Input images: Image 1 is the identity and costume reference (the generated Zhou Min portrait). Keep her face, hair, navy-blue uniform and lighting exactly.
Primary request: square head-and-shoulders avatar of Zhou Min, looking at the camera with a calm, professional expression.
Style/medium: photorealistic cinematic portrait, same grade as the reference, realistic skin texture.
Composition/framing: centered square 1:1, head and shoulders, generous headroom, simple dark industrial background.
Constraints: no text, no watermark, no extra people; do not change her identity or outfit.
```

### 2.2 马国强（检修班组长）

- 立绘：`public/assets/vn/chars/ma-normal.webp`
- 头像：`public/assets/vn/avatars/ma.webp`
- 参考图：`chen-normal.webp`、`wang-normal.webp`（人物写实风格）+ `scene.jpg`（站区背景）

```text
Use case: visual-novel character portrait
Input images: Image 1 and Image 2 are style references for photorealistic Chinese industrial professionals, cinematic lighting, dark interior backdrop and full-body framing; do not copy the people in them. Image 3 is a reference for the substation environment.
Primary request: full-body portrait of a Chinese man in his early 50s, Ma Guoqiang, maintenance team leader at a 220kV substation.
Subject: weathered, dependable expression; short graying hair; gray-blue maintenance work jacket over a dark shirt, cargo trousers, work gloves tucked in one pocket, yellow hard hat; solid build, standing with hands relaxed.
Style/medium: photorealistic cinematic character still, realistic skin/fabric texture, natural film grain, consistent with the reference portraits.
Composition/framing: vertical full-body, centered, head near the top with small headroom, feet visible, dark industrial interior background with soft depth separation.
Lighting/mood: warm side key light with cool fill, grounded and experienced.
Text: none.
Constraints: no text, no logo, no watermark, no extra people; realistic Chinese features, age-appropriate.
```

头像：

```text
Use case: visual-novel avatar
Input images: Image 1 is the identity and costume reference (the generated Ma Guoqiang portrait). Keep his face, graying hair, gray-blue work jacket and lighting exactly.
Primary request: square head-and-shoulders avatar of Ma Guoqiang, looking at the camera with a steady, experienced expression.
Style/medium: photorealistic cinematic portrait, same grade as the reference.
Composition/framing: centered square 1:1, head and shoulders, dark industrial background.
Constraints: no text, no watermark, no extra people; do not change his identity or outfit.
```

### 2.3 孙德海（施工队长）

- 立绘：`public/assets/vn/chars/sun-normal.webp`
- 头像：`public/assets/vn/avatars/sun.webp`
- 参考图：`wang-normal.webp`、`zhao-normal.webp`（施工人员风格）+ `scene.jpg`

```text
Use case: visual-novel character portrait
Input images: Image 1 and Image 2 are style references for photorealistic Chinese construction professionals, cinematic lighting and full-body framing; do not copy the people in them. Image 3 is a reference for the construction site environment.
Primary request: full-body portrait of a Chinese man in his late 40s, Sun Dehai, construction team leader at the substation extension site.
Subject: direct, slightly impatient expression; short black hair with gray at the temples; orange high-visibility work jacket over a dark sweater, dark work trousers, white hard hat, clipboard in one hand; work boots.
Style/medium: photorealistic cinematic character still, realistic skin/fabric texture, natural film grain, consistent with the reference portraits.
Composition/framing: vertical full-body, centered, head near the top with small headroom, feet visible, dark construction/industrial interior background with soft depth separation.
Lighting/mood: warm key light with cool shadow, site-foreman presence.
Text: none.
Constraints: no text, no logo, no watermark, no extra people; realistic Chinese features, age-appropriate.
```

头像：

```text
Use case: visual-novel avatar
Input images: Image 1 is the identity and costume reference (the generated Sun Dehai portrait). Keep his face, hair, orange jacket, white hard hat and lighting exactly.
Primary request: square head-and-shoulders avatar of Sun Dehai, looking at the camera with a direct, experienced expression.
Style/medium: photorealistic cinematic portrait, same grade as the reference.
Composition/framing: centered square 1:1, head and shoulders, dark construction background.
Constraints: no text, no watermark, no extra people; do not change his identity or outfit.
```

---

## 3. 可选背景（当前代码有路径但未在结局使用）

如果也想补齐资料库/标题背景，可按现有路径生成：

| 路径 | 内容 | 尺寸 |
| --- | --- | --- |
| `public/assets/vn/bg/bg-10kv-room.webp` | 公寓一层 10kV 配电室·午后，柜列、绝缘垫、蓝色门 | 1792×970 |
| `public/assets/vn/bg/bg-overview.webp` | 全站航拍·清晨，标题页备用 | 1792×970 |

---

## 4. 放文件与转换

最简单：直接把生成图保存为对应路径的 `.webp`。如果是 PNG/JPG，先放到任意临时路径，告诉我文件名，我会用 ffmpeg 转 WebP 并放到目标路径。

立绘建议处理（保持与现有 655×1536 一致）：

```bash
# 1024×1536 生成图 → 居中裁成 655×1536 → WebP
ffmpeg -i zhou.png -vf "crop=655:1536:(iw-655)/2:0" -c:v libwebp -quality 88 \
  public/assets/vn/chars/zhou-normal.webp
```

头像从立绘裁头部（按实际头部位置微调 crop 的 y）：

```bash
ffmpeg -i zhou-normal.png -vf "crop=460:460:282:80,scale=256:256" -c:v libwebp -quality 88 \
  public/assets/vn/avatars/zhou.webp
```

背景：

```bash
ffmpeg -i bg-site-dusk.png -vf "scale=1792:-2" -c:v libwebp -quality 86 \
  public/assets/vn/bg/bg-site-dusk.webp
```

放入后重新 `bun run build` 即可；代码会读取这些固定路径，不需要改代码。
