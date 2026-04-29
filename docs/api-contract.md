# 前后端契约

本文档只描述当前代码已经实现的前后端边界。

## 接口

### `GET /api/health`

返回服务状态：

```json
{
  "ok": true,
  "model": "gpt-5.4",
  "hasApiKey": true,
  "openaiBaseUrl": "https://.../openai",
  "responsesUrl": "https://.../openai/responses"
}
```

### `POST /api/generate`

请求体：

```json
{
  "prompt": "string",
  "size": "1024x1024",
  "quality": "high",
  "outputFormat": "png",
  "n": "1",
  "background": "auto",
  "moderation": "low"
}
```

当前允许值来自后端校验：

- `size`: `1024x1024` | `1024x1536` | `1536x1024` | `2048x2048` | `2048x1152` | `1152x2048`
- `quality`: `low` | `medium` | `high` | `auto`
- `outputFormat`: `png` | `jpeg` | `webp`
- `background`: `auto` | `opaque`
- `moderation`: `low` | `auto`
- `n`: 当前只允许 `1`

成功响应：

```json
{
  "created": 0,
  "images": [
    {
      "id": 1,
      "mimeType": "image/png",
      "base64": "..."
    }
  ]
}
```

可选字段：

- `revisedPrompt`
- 未来如后端改动，可兼容 `url`，但当前主链路返回的是 `base64`

失败响应：

```json
{
  "error": "message",
  "details": {}
}
```

## 当前后端实现说明

- 前端只负责提交 JSON 到 `/api/generate`
- 后端再调用上游 `/responses`
- 当前上游调用固定带 `image_generation` tool
- 当前真实作为 tool 参数传递的只有 `output_format`
- `size`、`quality`、`background`、`moderation` 目前是作为提示词约束写入上游请求
- `n` 目前虽然保留字段，但后端仍限制为 `1`

## 前端改造约束

在后端未修改前，前端必须保持这些字段名不变：

- `prompt`
- `size`
- `quality`
- `outputFormat`
- `n`
- `background`
- `moderation`

在后端未修改前，前端不要自行扩展新的请求字段。

