export const COPY = {
  zh: {
    tabs: {
      custom: "自定义",
      customMini: "自",
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
      failed: "生成失败。",
      revised: "模型调整了提示词。",
    },
    preset: {
      restore: "还原",
      sourceLink: "来源仓库",
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
      failed: "Generation failed.",
      revised: "Prompt revised by model.",
    },
    preset: {
      restore: "Reset",
      sourceLink: "Source repo",
    },
  },
};

export const THEME_OPTIONS = ["blue", "emerald", "amber", "rose"];
export const FORMAT_OPTIONS = ["png", "jpeg", "webp"];
export const SIZE_OPTIONS = ["1024x1024", "1024x1536", "1536x1024", "2048x2048", "2048x1152", "1152x2048"];
export const QUALITY_OPTIONS = ["high", "medium", "low", "auto"];
export const BACKGROUND_OPTIONS = ["auto", "opaque"];
export const MODERATION_OPTIONS = ["low", "auto"];
