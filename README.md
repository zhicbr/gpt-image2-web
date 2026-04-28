# gpt-image2-web

A minimal local web app for generating images with `gpt-image-2`.

## Why this app exists

This repo is intentionally small:

- It borrows the **API shape** from [`gpt_image_2_skill`](../gpt_image_2_skill/README.md), which directly uses OpenAI image generation endpoints.
- It avoids the heavier architecture of [`ima2-gen`](../ima2-gen/README.md), which is designed around OAuth and a built-in image tool instead of your own API key.
- It does **not** depend on a frontend framework or extra npm packages, so you can run it with stock Node.

## Features

- Text-to-image generation with `gpt-image-2`
- Controls for size, quality, output format, count, background, and moderation
- Local server endpoint that keeps `OPENAI_API_KEY` off the client
- Single-file static frontend with a styled review gallery

## Run

1. Set your environment variables.

```powershell
$env:OPENAI_API_KEY="sk-..."
$env:PORT="3000"
```

2. Start the server.

```powershell
cd D:\dev\workspace\workspace-26\image-g\gpt-image2-web
node server.mjs
```

3. Open `http://localhost:3000`.

## API

`POST /api/generate`

```json
{
  "prompt": "Editorial perfume campaign with exact text \"NOCTURNE / 03\"",
  "size": "1024x1536",
  "quality": "high",
  "outputFormat": "png",
  "n": "1",
  "background": "auto",
  "moderation": "low"
}
```

`GET /api/health`

Returns server readiness, whether `OPENAI_API_KEY` is present, and the configured base URL.
