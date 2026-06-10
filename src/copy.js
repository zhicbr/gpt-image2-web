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
      backendResponses: "工具",
      backendImages: "直连",
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
    access: {
      title: "输入访问密钥",
      subtitle: "页面可浏览；生成图片需要访问密钥。",
      placeholder: "访问密钥",
      submit: "确认",
      cancel: "取消",
      clear: "清除密钥",
      change: "更换密钥",
      manage: "访问密钥",
      show: "显示",
      hide: "隐藏",
      saved: "已保存",
      missing: "请先填写访问密钥。",
      invalid: "访问密钥无效或已停用。",
      required: "需要访问密钥才能生成。",
      lockedHint: "未设置密钥",
      unlockedHint: "密钥已就绪",
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
      backendResponses: "Tool",
      backendImages: "Direct",
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
    access: {
      title: "Enter access key",
      subtitle: "You can browse freely. Generation requires an access key.",
      placeholder: "Access key",
      submit: "Continue",
      cancel: "Cancel",
      clear: "Clear key",
      change: "Change key",
      manage: "Access key",
      show: "Show",
      hide: "Hide",
      saved: "Saved",
      missing: "Please enter an access key.",
      invalid: "Invalid or disabled access key.",
      required: "An access key is required to generate.",
      lockedHint: "No key set",
      unlockedHint: "Key ready",
    },
  },
};

export const THEME_OPTIONS = ["blue", "emerald", "amber", "rose"];
export const FORMAT_OPTIONS = ["png", "jpeg", "webp"];
export const SIZE_OPTIONS = ["1024x1024", "1024x1536", "1536x1024", "2048x2048", "2048x1152", "1152x2048"];
export const QUALITY_OPTIONS = ["high", "medium", "low", "auto"];
export const BACKGROUND_OPTIONS = ["auto", "opaque"];
export const MODERATION_OPTIONS = ["low", "auto"];
