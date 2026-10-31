# 220kV 变电站安全操作 3D 虚拟培训系统

基于 React + Three.js 的 220kV 变电站安全操作 3D 虚拟培训系统，包含第一/第三人称角色切换、Mixamo 动画、设备巡检、安全规则判定与 HUD 等模块。

## 技术栈

- React 19 + TypeScript
- Three.js
- Vite 8（打包与开发服务器）
- Tailwind CSS 4
- Bun 1.3（依赖安装、运行时、测试与生产静态服务器）

## 环境要求

- [Bun](https://bun.sh) >= 1.3（推荐使用 `bun@1.3.14`，见 `package.json` 的 `packageManager` 字段）
- 不需要单独安装 Node.js，Vite 直接在 Bun 运行时中执行

## 快速开始

```bash
# 安装依赖
bun install

# 启动开发服务器（http://localhost:3000）
bun run dev
```

## 可用命令

| 命令 | 说明 |
| --- | --- |
| `bun run dev` | 启动 Vite 开发服务器（端口 3000） |
| `bun run build` | 构建生产版本到 `dist/` |
| `bun run start` | 用 Bun 静态服务器托管 `dist/`（默认端口 3000） |
| `bun run preview` | 同 `bun run start`，用于预览生产构建 |
| `bun test` | 使用 Bun 内置测试运行器执行测试 |
| `bun run typecheck` | TypeScript 类型检查 |
| `bun run lint` | 同 `bun run typecheck` |
| `bun run clean` | 跨平台清理 `dist/` 等构建产物 |

生产启动示例：

```bash
bun run build
PORT=8080 bun run start
```

Windows PowerShell：

```powershell
$env:PORT = 8080
bun run start
```

也可通过 `HOST` 环境变量指定监听地址（默认 `0.0.0.0`）。

## 离线双击启动（Windows）

`public/启动游戏.bat` 与 `public/serve.mjs` 会随 `bun run build` 一起复制进 `dist/`。把整个 `dist/` 目录交给使用方后，双击 `启动游戏.bat` 即可：

1. 依次探测运行时：`bun` → `%USERPROFILE%\.bun\bin\bun.exe` → `node` → `%ProgramFiles%\nodejs\node.exe`；
2. 由 `serve.mjs` 在 `dist/` 目录内启动本地静态服务，默认端口 3000，被占用时自动顺延（最多到 3010）；
3. 服务就绪后自动打开默认浏览器；关闭命令行窗口即停止服务。

指定端口：`启动游戏.bat 8080`（等价于设置 `PORT=8080`）。设置 `NO_OPEN=1` 可禁止自动打开浏览器。

`serve.mjs` 是 `server.ts` 的零依赖等价实现（同一套 MIME、缓存头与 SPA 回退），可在 Bun 或 Node 18+ 下直接运行，因此交付目录不需要 `node_modules`。批处理本身只保留 ASCII 字符，中文提示由 `serve.mjs` 输出，避免 cmd 以系统 ANSI 代码页解析时出错。

## 构建说明

- Vite 负责打包 React、Tailwind CSS 与 Three.js；Bun 提供包管理、运行时、测试和生产服务器。
- `bun run build` 输出到 `dist/`，静态资源带 content hash，可长期缓存。
- `server.ts` 是一个 Bun 原生静态服务器，提供 SPA 回退（无扩展名路径回退到 `index.html`）、静态资源缓存头、`HEAD` 请求支持与路径穿越防护。
- 代码中未使用路径别名，`vite.config.ts` 的 `@` 别名仍可用于后续开发。

## 目录结构

```
├── public/                 # 运行时静态资源（场景 GLB、角色 FBX、立绘等）与离线启动脚本
├── blend/                  # Blender 源文件与原始模型（不入库、不参与构建）
│   ├── substation_blockout.blend(.1)
│   ├── build_substation.py # Blender 场景生成脚本
│   ├── substation_architecture.md
│   └── assets/             # 原始 FBX/贴图/Poly Haven 素材
├── scripts/clean.ts        # 跨平台清理脚本
├── src/
│   ├── components/         # React 组件
│   ├── game/               # 游戏逻辑、场景构建、角色与音效
│   ├── App.tsx             # 应用主入口
│   └── main.tsx            # React 挂载
├── server.ts               # Bun 生产静态服务器
├── vite.config.ts
└── package.json
```

## 环境变量

参考 `.env.example`。Vite 会自动加载 `.env.local` 等文件；生产静态服务器只读取 `PORT` 与 `HOST`。
