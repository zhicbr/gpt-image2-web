# gpt-image2-web

本项目是一个本地生图网页原型。

当前实现：

- 前端：静态页面
- 后端：Node.js HTTP 服务
- 上游：通过 `/responses` + `image_generation` tool 调用兼容接口

当前直接功能只保留一项：`生图`。

## 运行

```powershell
cd D:\dev\workspace\workspace-26\image-g\gpt-image2-web
node server.mjs
```

浏览器打开 `http://localhost:3000`。

## 文档

- [docs/README.md](./docs/README.md)
- [docs/ROADMAP.md](./docs/ROADMAP.md)
- [docs/api-contract.md](./docs/api-contract.md)
- [docs/naming.md](./docs/naming.md)

## 当前说明

- 后端契约以 `docs/api-contract.md` 为准
- 命名规范以 `docs/naming.md` 为准
- 后续前端计划改为 `React + Vite`
- 在后端未变更前，前端改造不应修改请求字段名
