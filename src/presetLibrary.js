import indexData from "../prompts/index.json";

const dataCache = {};

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

export const PRESET_SOURCES = (Array.isArray(indexData?.sources) ? indexData.sources : [])
  .map((source) => ({
    id: source.id,
    label: SOURCE_LABELS[source.id] || source.id || source.name,
    name: source.name,
    sourceUrl: source.source_url,
    file: source.file,
  }));

export async function loadSourceItems(sourceFile) {
  if (dataCache[sourceFile]) {
    return dataCache[sourceFile];
  }

  const response = await fetch(`/prompts/${sourceFile}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${sourceFile}`);
  }

  const rawData = await response.json();
  const source = PRESET_SOURCES.find((s) => s.file === sourceFile);
  const prompts = Array.isArray(rawData?.prompts) ? rawData.prompts : [];
  const items = prompts
    .map((item, index) => normalizePromptItem(item, index, source?.id || "unknown"))
    .filter(Boolean);

  dataCache[sourceFile] = items;
  return items;
}
