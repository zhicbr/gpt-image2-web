# Prompts JSON 数据说明

## 目录结构

```
prompts/
├── index.json                              # 汇总索引：版本、来源 ID 映射、分类枚举
├── awesome-gpt-image-2-api-prompts.json    # api-prompts
├── awesome-gpt-image-2-new.json            # youmind
├── awesome-gpt-image-2-prompts.json        # evolink
├── awesome-gpt-image-2.json               # canghe
└── gpt-image-2-skill.json                 # skill
```

## 来源 ID 映射

`source_id` 是跨文件统一的短 ID，用于溯源到具体 GitHub 仓库：

| source_id | 仓库名 | GitHub URL | 许可证 |
|-----------|--------|------------|--------|
| `api-prompts` | Awesome-GPT-Image-2-API-Prompts | https://github.com/Anil-matcha/Awesome-GPT-Store | CC-BY-4.0 |
| `youmind` | awesome-gpt-image-2-new | https://github.com/YouMind-OpenLab/awesome-gpt-image-2 | CC-BY-4.0 |
| `evolink` | awesome-gpt-image-2-prompts | https://github.com/EvoLinkAI/awesome-gpt-image-2-prompts | CC-BY-4.0 |
| `canghe` | awesome-gpt-image-2 | https://github.com/canghe/awesome-gpt-image-2 | MIT |
| `skill` | gpt_image_2_skill | https://github.com/wuyoscar/gpt_image_2_skill | CC-BY-4.0 |

网站展示时通过 `source_id` 查 `index.json` 的 `sources` 数组即可获得仓库名、链接和许可证。

## JSON Schema 说明

每个 JSON 文件顶部的 `_schema_docs` 字段是该文件的 schema 文档，描述每个字段的含义、取值范围和填写规范。AI 填写时请先阅读对应文件的 `_schema_docs`。

### 关键字段

| 字段 | 说明 |
|------|------|
| `id` | UUID v4，跨文件唯一 |
| `title_zh` | 中文标题，5 字以内，概括提示词的核心内容 |
| `prompt` | 纯文本 prompt，与 `prompt_template` 互斥 |
| `prompt_template` | 参数化 JSON/Raycast prompt，与 `prompt` 互斥 |
| `template_params` | Raycast `{argument}` 参数列表，仅 when `is_parameterized=true` |
| `source_id` | 来源仓库短 ID，从 `index.json` 的 `sources[].id` 选取 |
| `category_primary` | 从 `index.json` 的 `categories` 枚举中选取 |
| `source_category` | 原仓库中的原始分类标签，原样保留 |
| `images[].url` | 远程图片 URL |
| `images[].local_path` | 源仓库内相对路径 |
| `attribution.source_id` | 同上，来源仓库短 ID |
| `metadata.is_parameterized` | 是否包含参数化模板语法 |
| `metadata.is_edit` | 是否需要输入参考图片 |

## 填写流程（供 AI 模型参考）

1. 读取源仓库的 README / gallery markdown 文件
2. 提取每条 prompt 的文本、标题、作者、来源链接
3. 判断是否为参数化模板（含 `{argument}` 或 JSON 结构），设置 `prompt` 或 `prompt_template`
4. 为 `source_id` 选一个 `index.json` 中 `sources[].id` 的值：
   - `api-prompts` / `youmind` / `evolink` / `canghe` / `skill`
5. 为 `category_primary` 选一个 `index.json` 中 `categories` 的值
6. 生成 `style_tags` 和 `subject_tags`（自由标签，3-5个）
7. 填写 `attribution` 来源信息，`attribution.source_id` 使用短 ID
8. 补充 `metadata` 的布尔标记
9. 生成唯一 `id`

## 各仓库数据源位置

| 仓库 | source_id | Prompt 数据位置 |
|------|-----------|----------------|
| Awesome-GPT-Image-2-API-Prompts | `api-prompts` | `README.md` 中的 `Prompt:` 代码块 |
| awesome-gpt-image-2-new | `youmind` | README 中 `#### 📝 Prompt` 区块，或 CMS API |
| awesome-gpt-image-2-prompts | `evolink` | `README.md` + `data/ingested_tweets.json` + `gpt_image2_prompts.json` |
| awesome-gpt-image-2 | `canghe` | `docs/gallery-part-1.md` + `docs/gallery-part-2.md` |
| gpt_image_2_skill | `skill` | `skills/gpt-image/references/gallery-*.md` 文件 |

## 许可证

- `api-prompts` / `youmind` / `evolink` / `skill`：CC BY 4.0
- `canghe`：MIT