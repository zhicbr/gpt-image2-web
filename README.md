# gpt-image2-web

基于 GPT Image-2 的在线生图前端，支持自定义提示词和预设提示词库。

## 技术栈

- **前端**：React 19 + Vite
- **后端 API**：Cloudflare Pages Functions
- **部署**：Cloudflare Pages（静态资源 + Edge Functions）
- **流式响应**：SSE 透传，前端实时解析

## 实现说明

当前版本的生图链路，**不是直接调用传统的图片生成 API**（如 `/images/generations`），而是走 **`/responses` + `image_generation` tool**：

- 前端请求 `/api/generate`
- Pages Function 转发到上游 `responses` 接口
- 请求体中显式声明 `image_generation` tool，并强制调用
- 上游通过 SSE 返回 `image_generation_call` 结果
- 后端直接透传流式响应，前端通过读取器逐帧解析，避免服务端长时间攒完整数据而超时

这条链路的思路与 Codex 集成式生图方式一致。  
后续可以再扩展为直接支持传统生图 API，但当前项目只实现这一条路径。

## 特性

- 双模式：自定义提示词 / 预设提示词库
- 5 个开源 prompt 仓库，按需动态加载
- 多语言：中文 / 英文
- 主题：4 种配色 + 亮/暗/系统模式
- 移动端适配：侧栏抽屉、设置折叠菜单、触控优化
- 图片结果支持缩放、拖拽、下载

## 本地开发

### 纯前端开发

```bash
npm install
npm run dev          # Vite dev server，http://localhost:5173
```

### 完整环境（含 API）

创建 `.dev.vars`（已加入 `.gitignore`）：

```
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.4
```

```bash
npm run build
npx wrangler pages dev public   # http://localhost:8788
```

## 部署

推送到 GitHub，在 Cloudflare Pages Dashboard 关联仓库：

| 配置项 | 值 |
|--------|-----|
| Build command | `npm run build` |
| Build output directory | `public` |

然后在 Dashboard → Settings → Environment variables 添加：

| 变量名 | 说明 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI API Key（建议作为 Secret） |
| `OPENAI_BASE_URL` | API 基础地址，默认 `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 模型名称，默认 `gpt-5.4` |

## 环境变量

`.env.example`：

```env
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.4
```

## 项目结构

```
.
├── functions/api/         # Cloudflare Pages Functions
│   ├── generate.js        # /api/generate  流式生图
│   └── health.js          # /api/health    健康检查
├── prompts/               # 预设提示词库 JSON
│   ├── index.json         # 仓库索引（静态导入）
│   └── *.json             # 大 JSON 文件（build 时复制到 public/prompts/）
├── public/                # 构建输出 + 静态资源
├── src/
│   ├── App.jsx            # 主应用
│   ├── presetLibrary.js   # 预设库索引 + 动态加载
│   ├── copy.js            # 多语言文案
│   └── styles.css         # 样式（含移动端断点）
├── vite.config.mjs        # Vite 配置（含 prompts 复制插件）
├── server.mjs             # 本地 Node.js 备用服务端
└── _routes.json           # Pages Functions 路由限定
```
