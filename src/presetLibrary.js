import indexData from "../prompts/index.json";
import apiPromptsData from "../prompts/awesome-gpt-image-2-api-prompts.json";
import youmindData from "../prompts/awesome-gpt-image-2-new.json";
import evolinkData from "../prompts/awesome-gpt-image-2-prompts.json";
import cangheData from "../prompts/awesome-gpt-image-2.json";
import skillData from "../prompts/gpt-image-2-skill.json";

const FILE_MAP = {
  "awesome-gpt-image-2-api-prompts.json": apiPromptsData,
  "awesome-gpt-image-2-new.json": youmindData,
  "awesome-gpt-image-2-prompts.json": evolinkData,
  "awesome-gpt-image-2.json": cangheData,
  "gpt-image-2-skill.json": skillData,
};

const SOURCE_LABELS = {
  "api-prompts": "API",
  youmind: "YouMind",
  evolink: "EvoLink",
  canghe: "Canghe",
  skill: "Skill",
};

export const PRESET_PAGE_SIZE = 10;

function normalizePromptItem(item, index, sourceId) {
  const originalText = (item.prompt || item.prompt_template || "").trim();
  if (!originalText) return null;

  return {
    id: item.id || `${sourceId}-${index}`,
    titleZh: (item.title_zh || item.title || `Preset ${index + 1}`).trim(),
    originalText,
  };
}

function normalizeSource(source) {
  const rawData = FILE_MAP[source.file];
  const prompts = Array.isArray(rawData?.prompts) ? rawData.prompts : [];
  const items = prompts
    .map((item, index) => normalizePromptItem(item, index, source.id))
    .filter(Boolean);

  return {
    id: source.id,
    label: SOURCE_LABELS[source.id] || source.id || source.name,
    name: source.name,
    sourceUrl: source.source_url,
    items,
  };
}

export const PRESET_SOURCES = (Array.isArray(indexData?.sources) ? indexData.sources : [])
  .map(normalizeSource)
  .filter((source) => source.items.length > 0);
