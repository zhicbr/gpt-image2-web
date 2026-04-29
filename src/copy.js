export const COPY = {
  zh: {
    tabs: {
      custom: "自定义",
      customMini: "写",
      preset: "预设",
      presetMini: "预",
    },
    sections: {
      prompt: "提示词",
      params: "参数",
      suggestions: "建议",
    },
    fields: {
      format: "格式",
      size: "尺寸",
      quality: "质量",
      background: "背景",
      moderation: "审核",
    },
    options: {
      high: "高",
      medium: "中",
      low: "低",
      auto: "自动",
      opaque: "不透明",
    },
    top: {
      system: "系统",
      light: "浅色",
      dark: "深色",
      generate: "生成",
      generating: "生成中",
      download: "下载",
    },
    stage: {
      error: "生成失败",
    },
    messages: {
      needPrompt: "请先输入提示词。",
      presetApplied: "已填入预设。",
      failed: "生成失败。",
      revised: "模型调整了提示词。",
    },
    presets: {
      editorial: {
        label: "杂志感",
        note: "人物 / 光线 / 构图",
        prompt:
          "Editorial portrait of a young designer in a quiet studio, clean composition, soft window light, refined textures, minimal background, sharp details, subtle cinematic tone.",
      },
      product: {
        label: "产品图",
        note: "材质 / 反射 / 质感",
        prompt:
          "Minimal product render of a matte black wireless speaker on a stone pedestal, soft reflections, studio lighting, crisp edges, premium material detail, calm composition.",
      },
      poster: {
        label: "海报",
        note: "氛围 / 主体 / 标题",
        prompt:
          "Minimal poster of a silver train cutting through dense winter fog, centered composition, strong negative space, restrained palette, elegant title placement, cinematic atmosphere.",
      },
      diagram: {
        label: "信息图",
        note: "结构 / 标签 / 层级",
        prompt:
          "Minimal infographic showing the layers of a launch vehicle, precise labeling, clean hierarchy, flat background, technical clarity, publication-ready layout.",
      },
    },
  },
  en: {
    tabs: {
      custom: "Custom",
      customMini: "C",
      preset: "Preset",
      presetMini: "P",
    },
    sections: {
      prompt: "Prompt",
      params: "Params",
      suggestions: "Hints",
    },
    fields: {
      format: "Format",
      size: "Size",
      quality: "Quality",
      background: "BG",
      moderation: "Safe",
    },
    options: {
      high: "High",
      medium: "Mid",
      low: "Low",
      auto: "Auto",
      opaque: "Opaque",
    },
    top: {
      system: "Auto",
      light: "Light",
      dark: "Dark",
      generate: "Generate",
      generating: "Working",
      download: "Download",
    },
    stage: {
      error: "Failed",
    },
    messages: {
      needPrompt: "Enter a prompt first.",
      presetApplied: "Preset loaded.",
      failed: "Generation failed.",
      revised: "Prompt revised by model.",
    },
    presets: {
      editorial: {
        label: "Editorial",
        note: "subject / light / framing",
        prompt:
          "Editorial portrait of a young designer in a quiet studio, clean composition, soft window light, refined textures, minimal background, sharp details, subtle cinematic tone.",
      },
      product: {
        label: "Product",
        note: "surface / reflection / detail",
        prompt:
          "Minimal product render of a matte black wireless speaker on a stone pedestal, soft reflections, studio lighting, crisp edges, premium material detail, calm composition.",
      },
      poster: {
        label: "Poster",
        note: "mood / subject / title",
        prompt:
          "Minimal poster of a silver train cutting through dense winter fog, centered composition, strong negative space, restrained palette, elegant title placement, cinematic atmosphere.",
      },
      diagram: {
        label: "Diagram",
        note: "structure / labels / hierarchy",
        prompt:
          "Minimal infographic showing the layers of a launch vehicle, precise labeling, clean hierarchy, flat background, technical clarity, publication-ready layout.",
      },
    },
  },
};

export const THEME_OPTIONS = ["blue", "emerald", "amber", "rose"];
export const FORMAT_OPTIONS = ["png", "jpeg", "webp"];
export const SIZE_OPTIONS = ["1024x1024", "1024x1536", "1536x1024", "2048x2048", "2048x1152", "1152x2048"];
export const QUALITY_OPTIONS = ["high", "medium", "low", "auto"];
export const BACKGROUND_OPTIONS = ["auto", "opaque"];
export const MODERATION_OPTIONS = ["low", "auto"];
