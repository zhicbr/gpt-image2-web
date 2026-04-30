import { useEffect, useMemo, useRef, useState } from "react";
import {
  BACKGROUND_OPTIONS,
  COPY,
  FORMAT_OPTIONS,
  MODERATION_OPTIONS,
  QUALITY_OPTIONS,
  SIZE_OPTIONS,
  THEME_OPTIONS,
} from "./copy";
import { PRESET_PAGE_SIZE, PRESET_SOURCES, loadSourceItems } from "./presetLibrary";

const SUGGESTION_ORDER = ["size", "quality", "background", "moderation"];
const SUGGESTION_LEFT_COLUMN = ["size"];
const SUGGESTION_RIGHT_COLUMN = ["background", "moderation", "quality"];

function readStorage(key, fallback) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function SuggestionChips({ label, options, value, onToggle, labels }) {
  return (
    <div className="suggestion-group">
      <div className="section-label section-label-inline">{label}</div>
      <div className="segmented">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              className={`chip-button${active ? " is-active" : ""}`}
              type="button"
              onClick={() => onToggle(active ? null : option)}
            >
              {labels?.[option] || option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SuggestionSelect({ label, options, value, onChange, onClear, labels }) {
  return (
    <div className="suggestion-row">
      <div className="section-label section-label-inline">{label}</div>
      <div className="suggestion-control">
        <select
          className="suggestion-select"
          value={value || options[0] || ""}
          onChange={(event) => onChange(event.target.value || null)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {labels?.[option] || option}
            </option>
          ))}
        </select>
        {value ? (
          <button className="suggestion-clear" type="button" onClick={onClear} aria-label={`clear-${label}`}>
            {"\u00D7"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function buildSuggestionGroups(t) {
  return [
    {
      key: "size",
      label: t.fields.size,
      options: SIZE_OPTIONS,
      token: (value) => `size=${value}`,
      display: (value) => `${t.fields.size} ${value}`,
    },
    {
      key: "moderation",
      label: t.fields.moderation,
      options: MODERATION_OPTIONS,
      token: (value) => `moderation=${value}`,
      display: (value) => `${t.fields.moderation} ${t.options[value] || value}`,
    },
    {
      key: "quality",
      label: t.fields.quality,
      options: QUALITY_OPTIONS,
      token: (value) => `quality=${value}`,
      display: (value) => `${t.fields.quality} ${t.options[value] || value}`,
    },
    {
      key: "background",
      label: t.fields.background,
      options: BACKGROUND_OPTIONS,
      token: (value) => `background=${value}`,
      display: (value) => `${t.fields.background} ${t.options[value] || value}`,
    },
  ];
}

function makeReferenceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readImageMetrics(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width || 1,
        height: image.naturalHeight || image.height || 1,
      });
    };
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = dataUrl;
  });
}

async function readReferenceFile(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

  const metrics = await readImageMetrics(dataUrl);
  return {
    id: makeReferenceId(),
    name: file.name,
    dataUrl,
    width: metrics.width,
    height: metrics.height,
  };
}

function getReferenceAspect(item) {
  return item?.width && item?.height ? item.width / item.height : 1;
}

function buildReferenceRowSets(items) {
  const count = items.length;
  const rowCount = count <= 1 ? 1 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 8 ? 3 : 4;
  const baseSize = Math.floor(count / rowCount);
  const remainder = count % rowCount;
  const rows = [];
  let cursor = 0;

  for (let index = 0; index < rowCount; index += 1) {
    const rowSize = baseSize + (index < remainder ? 1 : 0);
    rows.push(items.slice(cursor, cursor + rowSize));
    cursor += rowSize;
  }

  return rows.filter((row) => row.length);
}

function layoutReferenceRows(items, bounds, gap = 12) {
  const rows = buildReferenceRowSets(items);
  const safeBounds =
    bounds.width && bounds.height
      ? bounds
      : {
          width: 880,
          height: items.length <= 2 ? 420 : items.length <= 4 ? 480 : 540,
        };

  const measuredRows = rows.map((row) => {
    const aspectSum = row.reduce((sum, item) => sum + getReferenceAspect(item), 0) || row.length;
    const rowHeight = (safeBounds.width - gap * Math.max(0, row.length - 1)) / aspectSum;
    return {
      items: row.map((item) => {
        const aspect = getReferenceAspect(item);
        return {
          ...item,
          layoutWidth: rowHeight * aspect,
          layoutHeight: rowHeight,
        };
      }),
      rowHeight,
    };
  });

  const totalHeight =
    measuredRows.reduce((sum, row) => sum + row.rowHeight, 0) + gap * Math.max(0, measuredRows.length - 1);
  const scale = totalHeight > safeBounds.height ? safeBounds.height / totalHeight : 1;

  return measuredRows.map((row) => ({
    items: row.items.map((item) => ({
      ...item,
      layoutWidth: item.layoutWidth * scale,
      layoutHeight: item.layoutHeight * scale,
    })),
  }));
}

function getContainSize(bounds, image) {
  if (!bounds.width || !bounds.height || !image?.width || !image?.height) {
    return { width: 0, height: 0 };
  }

  const imageAspect = image.width / image.height;
  const boundsAspect = bounds.width / bounds.height;
  if (imageAspect > boundsAspect) {
    return {
      width: bounds.width,
      height: bounds.width / imageAspect,
    };
  }

  return {
    width: bounds.height * imageAspect,
    height: bounds.height,
  };
}

function clampPanelPosition(position, bounds, panelSize) {
  const maxX = Math.max(0, (bounds.width || 0) - panelSize.width - 16);
  const maxY = Math.max(0, (bounds.height || 0) - panelSize.height - 16);
  return {
    x: Math.min(Math.max(0, position.x), maxX),
    y: Math.min(Math.max(0, position.y), maxY),
  };
}

export default function App() {
  const dragRef = useRef(null);
  const floatingDragRef = useRef(null);
  const maskDrawRef = useRef(null);
  const referenceInputRef = useRef(null);
  const referenceCanvasRef = useRef(null);
  const stageBodyRef = useRef(null);
  const settingsButtonRef = useRef(null);
  const settingsPanelRef = useRef(null);
  const detailsButtonRef = useRef(null);
  const detailsPanelRef = useRef(null);
  const editButtonRef = useRef(null);
  const editPanelRef = useRef(null);
  const maskButtonRef = useRef(null);
  const maskPanelRef = useRef(null);
  const maskCanvasRef = useRef(null);

  const [lang, setLang] = useState(readStorage("ff-lang", "zh"));
  const [mode, setMode] = useState(readStorage("ff-mode", "system"));
  const [accent, setAccent] = useState(readStorage("ff-accent", "blue"));
  const [collapsed, setCollapsed] = useState(readStorage("ff-collapsed", "false") === "true");
  const [tab, setTab] = useState("custom");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const [systemDark, setSystemDark] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [form, setForm] = useState({
    prompt: "",
    outputFormat: "png",
  });
  const [suggestions, setSuggestions] = useState({
    size: null,
    quality: null,
    background: null,
    moderation: null,
  });
  const [presetSourceId, setPresetSourceId] = useState(PRESET_SOURCES[0]?.id || "");
  const [presetPage, setPresetPage] = useState(0);
  const [activePresetId, setActivePresetId] = useState(null);
  const [presetDrafts, setPresetDrafts] = useState({});
  const [presetSourceItems, setPresetSourceItems] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [generationMeta, setGenerationMeta] = useState(null);
  const [referenceImages, setReferenceImages] = useState([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState(null);
  const [referencePickerMode, setReferencePickerMode] = useState("add");
  const [referenceCanvasBounds, setReferenceCanvasBounds] = useState({ width: 0, height: 0 });
  const [referenceError, setReferenceError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [maskOpen, setMaskOpen] = useState(false);
  const [maskPrompt, setMaskPrompt] = useState("");
  const [maskBrush, setMaskBrush] = useState(36);
  const [maskDataUrl, setMaskDataUrl] = useState("");
  const [maskPaths, setMaskPaths] = useState([]);
  const [maskStageBounds, setMaskStageBounds] = useState({ width: 0, height: 0 });
  const [editPanelPos, setEditPanelPos] = useState({ x: 0, y: 0 });
  const [maskPanelPos, setMaskPanelPos] = useState({ x: 0, y: 0 });

  const t = COPY[lang];
  const detailsText = lang === "zh"
    ? {
        title: "\u8be6\u7ec6\u4fe1\u606f",
        mode: "\u6a21\u5f0f",
        source: "\u6765\u6e90",
        preset: "\u9884\u8bbe",
        custom: "\u81ea\u5b9a\u4e49",
        format: "\u8f93\u51fa\u683c\u5f0f",
        reference: "\u53c2\u8003\u56fe",
        referenceNone: "\u65e0",
        hints: "\u9644\u52a0\u5efa\u8bae",
        revisedPrompt: "\u4fee\u8ba2\u63d0\u793a\u8bcd",
        emptyHints: "\u65e0",
        close: "\u5173\u95ed",
        info: "\u8be6\u7ec6\u4fe1\u606f",
      }
    : {
        title: "Details",
        mode: "Mode",
        source: "Source",
        preset: "Preset",
        custom: "Custom",
        format: "Output format",
        reference: "Reference",
        referenceNone: "None",
        hints: "Hints",
        revisedPrompt: "Revised prompt",
        emptyHints: "None",
        close: "Close",
        info: "Details",
      };
  const editText = lang === "zh"
    ? {
        placeholder: "\u7ee7\u7eed\u4fee\u6539\u8fd9\u5f20\u56fe",
        send: "\u53d1\u9001",
        open: "\u7ee7\u7eed\u7f16\u8f91",
        limit: "\u6700\u591a\u652f\u63015\u5f20\u53c2\u8003\u56fe",
        count: `${referenceImages.length}/5`,
      }
    : {
        placeholder: "Refine this image",
        send: "Send",
        open: "Edit current image",
        limit: "Up to 5 reference images",
        count: `${referenceImages.length}/5`,
      };
  const maskText = lang === "zh"
    ? {
        open: "\u5c40\u90e8\u4fee\u6539",
        placeholder: "\u63cf\u8ff0\u8981\u4fee\u6539\u7684\u533a\u57df",
        brush: "\u753b\u7b14",
        clear: "\u6e05\u7a7a",
        cancel: "\u53d6\u6d88",
        send: "\u53d1\u9001",
        disabled: "\u4ec5\u652f\u6301\u5355\u5f20\u5f53\u524d\u53ef\u7f16\u8f91\u56fe",
      }
    : {
        open: "Partial edit",
        placeholder: "Describe the area to change",
        brush: "Brush",
        clear: "Clear",
        cancel: "Cancel",
        send: "Send",
        disabled: "Available for one editable image only",
      };
  const suggestionGroups = useMemo(() => buildSuggestionGroups(t), [t]);
  const suggestionGroupMap = useMemo(
    () => Object.fromEntries(suggestionGroups.map((group) => [group.key, group])),
    [suggestionGroups]
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);
    const handleChange = (event) => setSystemDark(event.matches);
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const resolvedMode = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.mode = resolvedMode;
    document.documentElement.dataset.accent = accent;
    writeStorage("ff-lang", lang);
    writeStorage("ff-mode", mode);
    writeStorage("ff-accent", accent);
    writeStorage("ff-collapsed", String(collapsed));
  }, [accent, collapsed, lang, mode, resolvedMode]);

  useEffect(() => {
    let cancelled = false;
    const source = PRESET_SOURCES.find((s) => s.id === presetSourceId);
    if (!source) {
      setPresetSourceItems([]);
      return;
    }
    setPresetSourceItems([]);
    loadSourceItems(source.file)
      .then((items) => {
        if (cancelled) return;
        setPresetSourceItems(items);
      })
      .catch(() => {
        if (cancelled) return;
        setPresetSourceItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [presetSourceId]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [result?.src]);

  useEffect(() => {
    if (!result?.src) {
      setDetailsOpen(false);
      setEditOpen(false);
      setEditPrompt("");
      setMaskOpen(false);
      setMaskPrompt("");
      setMaskDataUrl("");
    }
  }, [result?.src]);

  useEffect(() => {
    const element = stageBodyRef.current?.closest(".stage-card");
    if (!element || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const updateBounds = (target) => {
      const nextWidth = Math.round(target.clientWidth || 0);
      const nextHeight = Math.round(target.clientHeight || 0);
      setMaskStageBounds((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateBounds(element);
    const observer = new ResizeObserver(() => updateBounds(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = referenceCanvasRef.current;
    if (!element || result?.src || !referenceImages.length || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const updateBounds = (target) => {
      const nextWidth = Math.round(target.clientWidth || 0);
      const nextHeight = Math.round(target.clientHeight || 0);
      setReferenceCanvasBounds((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateBounds(element);
    const observer = new ResizeObserver(() => updateBounds(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, [referenceImages.length, result?.src]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!(event.target instanceof Node)) return;

      const clickedSettingsButton = settingsButtonRef.current?.contains(event.target);
      const clickedSettingsPanel = settingsPanelRef.current?.contains(event.target);
      const clickedDetailsButton = detailsButtonRef.current?.contains(event.target);
      const clickedDetailsPanel = detailsPanelRef.current?.contains(event.target);
      const clickedEditButton = editButtonRef.current?.contains(event.target);
      const clickedEditPanel = editPanelRef.current?.contains(event.target);
      const clickedMaskButton = maskButtonRef.current?.contains(event.target);
      const clickedMaskPanel = maskPanelRef.current?.contains(event.target);

      if (showSettings && !clickedSettingsButton && !clickedSettingsPanel) {
        setShowSettings(false);
      }

      if (detailsOpen && !clickedDetailsButton && !clickedDetailsPanel) {
        setDetailsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [detailsOpen, showSettings]);

  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  useEffect(() => {
    function handlePointerMove(event) {
      if (!floatingDragRef.current) return;
      const nextX = floatingDragRef.current.originX + (event.clientX - floatingDragRef.current.startX);
      const nextY = floatingDragRef.current.originY + (event.clientY - floatingDragRef.current.startY);
      const next = clampPanelPosition(
        { x: nextX, y: nextY },
        maskStageBounds,
        floatingDragRef.current.panelSize
      );
      if (floatingDragRef.current.type === "edit") {
        setEditPanelPos(next);
      } else if (floatingDragRef.current.type === "mask") {
        setMaskPanelPos(next);
      }
    }

    function handlePointerUp() {
      floatingDragRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [maskStageBounds]);

  const currentSource = useMemo(() => {
    return PRESET_SOURCES.find((source) => source.id === presetSourceId) || PRESET_SOURCES[0] || null;
  }, [presetSourceId]);

  const presetPageCount = useMemo(() => {
    if (!presetSourceItems.length) return 1;
    return Math.max(1, Math.ceil(presetSourceItems.length / PRESET_PAGE_SIZE));
  }, [presetSourceItems]);

  const pagedPresets = useMemo(() => {
    const start = presetPage * PRESET_PAGE_SIZE;
    return presetSourceItems.slice(start, start + PRESET_PAGE_SIZE);
  }, [presetSourceItems, presetPage]);

  useEffect(() => {
    if (!pagedPresets.length) {
      setActivePresetId(null);
      return;
    }

    if (!pagedPresets.some((preset) => preset.id === activePresetId)) {
      setActivePresetId(pagedPresets[0].id);
    }
  }, [activePresetId, pagedPresets]);

  const activePreset = useMemo(() => {
    if (!activePresetId) return null;
    return presetSourceItems.find((preset) => preset.id === activePresetId) || null;
  }, [activePresetId, presetSourceItems]);

  const activePresetText = activePreset ? presetDrafts[activePreset.id] ?? activePreset.originalText : "";
  const selectedReferenceImage = useMemo(() => {
    return referenceImages.find((item) => item.id === selectedReferenceId) || null;
  }, [referenceImages, selectedReferenceId]);
  const referenceGalleryRows = useMemo(() => {
    return layoutReferenceRows(referenceImages, referenceCanvasBounds);
  }, [referenceCanvasBounds, referenceImages]);
  const currentEditableImage = useMemo(() => {
    if (result?.src) {
      return {
        src: result.src,
        width: result.width,
        height: result.height,
      };
    }
    if (referenceImages.length === 1) {
      return referenceImages[0];
    }
    return null;
  }, [referenceImages, result]);
  const canOpenMask = Boolean(currentEditableImage);
  const maskDisplaySize = useMemo(() => {
    return getContainSize(maskStageBounds, currentEditableImage);
  }, [currentEditableImage, maskStageBounds]);

  useEffect(() => {
    if (!canOpenMask) {
      setMaskOpen(false);
      setMaskPrompt("");
      setMaskPaths([]);
    }
  }, [canOpenMask]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSuggestion(key, value) {
    setSuggestions((current) => ({ ...current, [key]: value }));
  }

  function removeSuggestion(key) {
    updateSuggestion(key, null);
  }

  function updateActivePresetText(value) {
    if (!activePreset) return;
    setPresetDrafts((current) => ({
      ...current,
      [activePreset.id]: value,
    }));
  }

  function restoreActivePreset() {
    if (!activePreset) return;
    setPresetDrafts((current) => ({
      ...current,
      [activePreset.id]: activePreset.originalText,
    }));
  }

  function selectPresetSource(sourceId) {
    if (sourceId === presetSourceId) return;
    setPresetSourceId(sourceId);
    setPresetPage(0);
  }

  function toggleSidebar() {
    setSidebarOpen((prev) => !prev);
    setShowSettings(false);
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function toggleCollapsed() {
    setCollapsed((current) => !current);
  }

  function stepPresetPage(direction) {
    setPresetPage((current) => {
      const next = current + direction;
      return Math.max(0, Math.min(presetPageCount - 1, next));
    });
  }

  const activeSuggestionPills = useMemo(() => {
    return SUGGESTION_ORDER.flatMap((key) => {
      const group = suggestionGroups.find((item) => item.key === key);
      const value = suggestions[key];
      if (!group || !value) return [];
      return [
        {
          key,
          token: group.token(value),
          label: group.display(value),
        },
      ];
    });
  }, [suggestionGroups, suggestions]);

  const detailHintPills = useMemo(() => {
    if (!generationMeta?.suggestions) return [];
    return SUGGESTION_ORDER.flatMap((key) => {
      const group = suggestionGroups.find((item) => item.key === key);
      const value = generationMeta.suggestions[key];
      if (!group || !value) return [];
      return [{ key, label: group.display(value) }];
    });
  }, [generationMeta, suggestionGroups]);

  function buildComposedPrompt() {
    const rawPrompt = form.prompt.trim();
    const tail = activeSuggestionPills.map((pill) => `[${pill.token}]`).join(" ");
    if (!tail) return rawPrompt;
    return rawPrompt ? `${rawPrompt}\n${tail}` : tail;
  }

  function buildDownloadName(mimeType) {
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType?.split("/")[1] || form.outputFormat || "png";
    return `frame-forge.${extension}`;
  }

  function buildGenerationMeta() {
    return {
      mode: tab,
      outputFormat: form.outputFormat,
      suggestions: { ...suggestions },
      presetSourceLabel: tab === "preset" ? currentSource?.label || "" : "",
      presetTitle: tab === "preset" ? activePreset?.titleZh || "" : "",
      hasReferenceImage: referenceImages.length > 0,
      revisedPrompt: null,
    };
  }

  function buildEditGenerationMeta() {
    return {
      mode: "edit",
      outputFormat: form.outputFormat,
      suggestions: {},
      presetSourceLabel: "",
      presetTitle: "",
      hasReferenceImage: true,
      revisedPrompt: null,
    };
  }

  function buildMaskGenerationMeta() {
    return {
      mode: "mask",
      outputFormat: form.outputFormat,
      suggestions: {},
      presetSourceLabel: "",
      presetTitle: "",
      hasReferenceImage: true,
      revisedPrompt: null,
    };
  }

  function openReferencePicker(mode = "add") {
    setReferencePickerMode(mode);
    setReferenceError("");
    referenceInputRef.current?.click();
  }

  function removeSelectedReferenceImage() {
    if (!selectedReferenceId) return;
    setReferenceError("");
    setReferenceImages((current) => {
      const next = current.filter((item) => item.id !== selectedReferenceId);
      const nextSelected = next[0]?.id || null;
      setSelectedReferenceId(nextSelected);
      return next;
    });
    if (referenceInputRef.current) {
      referenceInputRef.current.value = "";
    }
  }

  async function handleReferenceChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    try {
      const items = (await Promise.all(imageFiles.map((file) => readReferenceFile(file)))).filter(
        (item) => item.dataUrl
      );

      if (!items.length) return;

      if (referencePickerMode === "replace" && selectedReferenceId) {
        setReferenceError("");
        const nextItem = items[0];
        setReferenceImages((current) =>
          current.map((item) => (item.id === selectedReferenceId ? { ...nextItem } : item))
        );
        setSelectedReferenceId(nextItem.id);
        return;
      }

      setReferenceImages((current) => {
        const remaining = Math.max(0, 5 - current.length);
        const nextItems = items.slice(0, remaining);
        if (!nextItems.length) {
          setReferenceError(editText.limit);
          return current;
        }
        setReferenceError(items.length > remaining ? editText.limit : "");
        setSelectedReferenceId(nextItems[nextItems.length - 1].id);
        return [...current, ...nextItems];
      });
    } catch {}
  }

  function formatElapsed(seconds) {
    const safe = Math.max(0, seconds || 0);
    const minutes = Math.floor(safe / 60);
    const remain = safe % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
  }

  async function handleGenerate(options = {}) {
    const customPrompt = form.prompt.trim();
    const presetPrompt = activePresetText.trim();
    const editPromptText = cleanPrompt(options.prompt);
    const rawPrompt =
      options.mode === "edit" || options.mode === "mask"
        ? editPromptText
        : tab === "preset"
          ? presetPrompt
          : customPrompt;

    if (!rawPrompt) {
      setStatus("error");
      setResult(null);
      setMessage(t.messages.needPrompt);
      return;
    }

    setIsLoading(true);
    setStatus("loading");
    setResult(null);
    setMessage("");
    setDetailsOpen(false);
    setEditOpen(false);
    setGenerationMeta(null);

    const requestMeta =
      options.mode === "edit"
        ? buildEditGenerationMeta()
        : options.mode === "mask"
          ? buildMaskGenerationMeta()
          : buildGenerationMeta();
    const requestPrompt =
      options.mode === "edit" || options.mode === "mask"
        ? editPromptText
        : tab === "preset"
          ? presetPrompt
          : buildComposedPrompt();
    const requestReferences =
      options.mode === "edit" || options.mode === "mask"
        ? (options.referenceImages || [])
        : referenceImages.map((item) => item.dataUrl);
    const requestMask = options.mode === "mask" ? options.maskImage || "" : "";

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: requestPrompt,
          outputFormat: form.outputFormat,
          referenceImages: requestReferences,
          maskImage: requestMask,
          n: "1",
        }),
      });

      if (!response.ok) {
        let errorMsg = t.messages.failed;
        try {
          const errJson = await response.json();
          errorMsg = errJson.error || errJson.message || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const contentType = response.headers.get("Content-Type") || "";
      if (!contentType.includes("text/event-stream")) {
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        throw new Error(t.messages.failed);
      }

      const images = [];
      const revisedPrompt = await parseImageStream(response, (image) => images.push(image));

      if (!images.length) {
        throw new Error(t.messages.failed);
      }

      const image = images[0];
      const mimeType = image.mimeType || "image/png";
      const src = image.base64 ? `data:${mimeType};base64,${image.base64}` : image.url;
      const metrics = await readImageMetrics(src);

      setResult({
        src,
        mimeType,
        downloadName: buildDownloadName(mimeType),
        width: metrics.width,
        height: metrics.height,
      });
      setGenerationMeta({
        ...requestMeta,
        revisedPrompt,
      });
      setStatus("success");
      setMessage(revisedPrompt ? t.messages.revised : "");
    } catch (error) {
      setStatus("error");
      setResult(null);
      setMessage(error?.message || t.messages.failed);
    } finally {
      setIsLoading(false);
    }
  }

  function cleanPrompt(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function openEditPanel() {
    setDetailsOpen(false);
    setMaskOpen(false);
    setEditPrompt("");
    setEditOpen(true);
    setEditPanelPos({ x: 0, y: 8 });
  }

  function submitEditPrompt() {
    const nextPrompt = cleanPrompt(editPrompt);
    if (!nextPrompt || !result?.src) return;
    setEditPrompt("");
    setEditOpen(false);
    handleGenerate({
      mode: "edit",
      prompt: nextPrompt,
      referenceImages: [result.src],
    });
  }

  function openMaskPanel() {
    if (!canOpenMask) return;
    setDetailsOpen(false);
    setEditOpen(false);
    setMaskPrompt("");
    setMaskPaths([]);
    setMaskDataUrl("");
    setMaskOpen(true);
    setMaskPanelPos({ x: 0, y: 8 });
  }

  function clearMaskDrawing() {
    setMaskPaths([]);
    setMaskDataUrl("");
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function startFloatingDrag(type, event) {
    const panel = type === "edit" ? editPanelRef.current : maskPanelRef.current;
    if (!panel) return;
    floatingDragRef.current = {
      type,
      startX: event.clientX,
      startY: event.clientY,
      originX: type === "edit" ? editPanelPos.x : maskPanelPos.x,
      originY: type === "edit" ? editPanelPos.y : maskPanelPos.y,
      panelSize: {
        width: panel.offsetWidth,
        height: panel.offsetHeight,
      },
    };
  }

  function exportMaskImage() {
    const canvas = maskCanvasRef.current;
    if (!canvas || !currentEditableImage?.width || !currentEditableImage?.height || !maskPaths.length) {
      return "";
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = currentEditableImage.width;
    exportCanvas.height = currentEditableImage.height;
    const context = exportCanvas.getContext("2d");
    if (!context) return "";

    context.fillStyle = "rgba(0,0,0,1)";
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    context.globalCompositeOperation = "destination-out";
    context.strokeStyle = "rgba(0,0,0,1)";
    context.fillStyle = "rgba(0,0,0,1)";
    context.lineCap = "round";
    context.lineJoin = "round";

    const scaleX = exportCanvas.width / Math.max(1, canvas.width);
    const scaleY = exportCanvas.height / Math.max(1, canvas.height);

    for (const path of maskPaths) {
      if (!path.points.length) continue;
      context.lineWidth = path.size * scaleX;
      context.beginPath();
      context.moveTo(path.points[0].x * scaleX, path.points[0].y * scaleY);
      for (let index = 1; index < path.points.length; index += 1) {
        context.lineTo(path.points[index].x * scaleX, path.points[index].y * scaleY);
      }
      if (path.points.length === 1) {
        context.arc(path.points[0].x * scaleX, path.points[0].y * scaleY, (path.size * scaleX) / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.stroke();
      }
    }

    return exportCanvas.toDataURL("image/png");
  }

  function submitMaskPrompt() {
    const nextPrompt = cleanPrompt(maskPrompt);
    if (!nextPrompt || !canOpenMask || !maskPaths.length) return;
    const maskImage = exportMaskImage();
    if (!maskImage) return;
    setMaskDataUrl(maskImage);
    setMaskPrompt("");
    setMaskOpen(false);
    handleGenerate({
      mode: "mask",
      prompt: nextPrompt,
      referenceImages: [currentEditableImage.src || currentEditableImage.dataUrl],
      maskImage,
    });
  }

  async function parseImageStream(response, onImage) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let revisedPrompt = null;

    while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || "";

      for (const frame of frames) {
        const event = parseSseFrame(frame);
        if (!event) continue;

        if (event.type === "response.output_item.done" && event.item?.type === "image_generation_call") {
          if (typeof event.item.result === "string" && event.item.result.length) {
            onImage({
              id: 1,
              mimeType: `image/${form.outputFormat === "jpeg" ? "jpeg" : form.outputFormat}`,
              base64: event.item.result,
            });
            if (event.item.revised_prompt) revisedPrompt = event.item.revised_prompt;
          }
        }
      }

      if (done) break;
    }

    return revisedPrompt;
  }

  function parseSseFrame(frame) {
    const lines = frame.split(/\r?\n/);
    const dataLines = [];
    for (const line of lines) {
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return null;
    const payload = dataLines.join("\n").trim();
    if (!payload || payload === "[DONE]") return null;
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  function handlePromptKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      handleGenerate();
    }
  }

  function handleWheel(event) {
    if (!result?.src) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.18 : -0.18;
    setZoom((current) => {
      const next = Math.max(1, Math.min(6, Number((current + delta).toFixed(2))));
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  }

  function handlePointerDown(event) {
    if (!result?.src || zoom <= 1) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  }

  function handlePointerMove(event) {
    if (!dragRef.current || zoom <= 1) return;
    const nextX = dragRef.current.originX + (event.clientX - dragRef.current.startX);
    const nextY = dragRef.current.originY + (event.clientY - dragRef.current.startY);
    setPan({ x: nextX, y: nextY });
  }

  function stopDrag() {
    dragRef.current = null;
  }

  function getMaskPoint(event) {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    };
  }

  function paintMaskPaths(paths) {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(255, 92, 92, 0.96)";
    context.fillStyle = "rgba(255, 92, 92, 0.96)";
    context.lineCap = "round";
    context.lineJoin = "round";

    for (const path of paths) {
      if (!path.points.length) continue;
      context.lineWidth = path.size;
      context.beginPath();
      context.moveTo(path.points[0].x, path.points[0].y);
      for (let index = 1; index < path.points.length; index += 1) {
        context.lineTo(path.points[index].x, path.points[index].y);
      }
      if (path.points.length === 1) {
        context.beginPath();
        context.arc(path.points[0].x, path.points[0].y, path.size / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.stroke();
      }
    }
  }

  useEffect(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas || !maskOpen || !maskDisplaySize.width || !maskDisplaySize.height) return;
    canvas.width = Math.round(maskDisplaySize.width);
    canvas.height = Math.round(maskDisplaySize.height);
    paintMaskPaths(maskPaths);
  }, [maskDisplaySize.height, maskDisplaySize.width, maskOpen, maskPaths]);

  function handleMaskPointerDown(event) {
    if (!maskOpen) return;
    const point = getMaskPoint(event);
    if (!point) return;
    const nextPath = {
      size: maskBrush,
      points: [point],
    };
    maskDrawRef.current = true;
    setMaskPaths((current) => {
      const next = [...current, nextPath];
      paintMaskPaths(next);
      return next;
    });
  }

  function handleMaskPointerMove(event) {
    if (!maskOpen || !maskDrawRef.current) return;
    const point = getMaskPoint(event);
    if (!point) return;
    setMaskPaths((current) => {
      if (!current.length) return current;
      const next = current.map((path, index) =>
        index === current.length - 1
          ? {
              ...path,
              points: [...path.points, point],
            }
          : path
      );
      paintMaskPaths(next);
      return next;
    });
  }

  function stopMaskDrawing() {
    maskDrawRef.current = null;
  }

  function renderMaskOverlay() {
    if (!maskOpen || !canOpenMask || !maskDisplaySize.width || !maskDisplaySize.height) return null;

    return (
      <div className="mask-stage-overlay">
        <div
          className="mask-canvas-wrap"
          style={{
            width: `${maskDisplaySize.width}px`,
            height: `${maskDisplaySize.height}px`,
          }}
        >
          <canvas
            ref={maskCanvasRef}
            className="mask-canvas"
            onPointerDown={handleMaskPointerDown}
            onPointerMove={handleMaskPointerMove}
            onPointerUp={stopMaskDrawing}
            onPointerLeave={stopMaskDrawing}
            onPointerCancel={stopMaskDrawing}
          />
        </div>
      </div>
    );
  }

  function renderStageBody() {
    if (isLoading) {
      return (
        <div className="loader-stage" aria-hidden="true">
          <div className="loader-surface"></div>
          <div className="loader-shine"></div>
        </div>
      );
    }

    if (status === "error" && !referenceImages.length) {
      return (
        <div className="placeholder placeholder-error">
          <div className="placeholder-icon"></div>
          <div className="error-text">{message || t.stage.error}</div>
        </div>
      );
    }

    if (result?.src) {
      return (
        <div
          className={`image-wrap${zoom > 1 ? " is-draggable" : ""}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
          onPointerLeave={stopDrag}
          onPointerCancel={stopDrag}
          onDoubleClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          {renderMaskOverlay()}
          <img
            className="result-image"
            src={result.src}
            alt="Generated result"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          />
        </div>
      );
    }

    if (referenceImages.length) {
      return (
        <div className="reference-gallery-wrap">
          <div className="reference-gallery-canvas" ref={referenceCanvasRef}>
            {referenceImages.length === 1 ? (
              <div className="reference-single-stage">
                {renderMaskOverlay()}
                <button
                  className={`reference-card reference-card-single${
                    selectedReferenceId === referenceImages[0].id ? " is-selected" : ""
                  }`}
                  type="button"
                  onClick={() => setSelectedReferenceId(referenceImages[0].id)}
                >
                  <span className="reference-card-order">1</span>
                  <img
                    className="reference-card-image"
                    src={referenceImages[0].dataUrl}
                    alt={referenceImages[0].name || "Reference"}
                  />
                </button>
              </div>
            ) : (
              <div className="reference-gallery-flow">
                {referenceGalleryRows.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} className="reference-gallery-row">
                    {row.items.map((item, itemIndex) => {
                      const order = referenceImages.findIndex((entry) => entry.id === item.id) + 1;
                      return (
                      <button
                        key={item.id}
                        className={`reference-card${selectedReferenceId === item.id ? " is-selected" : ""}`}
                        type="button"
                        onClick={() => setSelectedReferenceId(item.id)}
                        style={{
                          width: item.layoutWidth ? `${item.layoutWidth}px` : undefined,
                          height: item.layoutHeight ? `${item.layoutHeight}px` : undefined,
                        }}
                      >
                        <span className="reference-card-order">{order || itemIndex + 1}</span>
                        <img className="reference-card-image" src={item.dataUrl} alt={item.name || "Reference"} />
                      </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="reference-gallery-footer">
            <div className="reference-preview-meta">
              <div className="reference-preview-chip">
                {selectedReferenceImage?.name || (lang === "zh" ? "\u53c2\u8003\u56fe" : "Reference")}
              </div>
              <div className="reference-preview-count">{editText.count}</div>
            </div>
            <div className="reference-preview-actions">
              <button className="reference-action-button" type="button" onClick={() => openReferencePicker("add")}>
                {lang === "zh" ? "\u6dfb\u52a0" : "Add"}
              </button>
              <button
                className="reference-action-button"
                type="button"
                onClick={() => openReferencePicker("replace")}
                disabled={!selectedReferenceImage}
              >
                {lang === "zh" ? "\u66ff\u6362" : "Replace"}
              </button>
              <button
                className="reference-action-button"
                type="button"
                onClick={removeSelectedReferenceImage}
                disabled={!selectedReferenceImage}
              >
                {lang === "zh" ? "\u79fb\u9664" : "Remove"}
              </button>
            </div>
            {referenceError ? <div className="reference-preview-error">{referenceError}</div> : null}
            {status === "error" && message ? <div className="reference-preview-error">{message}</div> : null}
          </div>
        </div>
      );
    }

    return (
      <div className="placeholder placeholder-idle reference-upload">
        <div className="placeholder-frame reference-upload-frame">
          <button className="reference-upload-icon" type="button" onClick={() => openReferencePicker("add")}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 16V8M8.75 11.25 12 8l3.25 3.25M6.5 17.5h11"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="reference-upload-text">{lang === "zh" ? "\u4e0a\u4f20\u53c2\u8003\u56fe" : "Upload reference"}</div>
        </div>
      </div>
    );
  }

  function renderSuggestionControl(key) {
    const group = suggestionGroupMap[key];
    if (!group) return null;

    return group.key === "quality" ? (
      <SuggestionSelect
        key={group.key}
        label={group.label}
        options={group.options}
        value={suggestions[group.key]}
        onChange={(value) => updateSuggestion(group.key, value)}
        onClear={() => updateSuggestion(group.key, null)}
        labels={t.options}
      />
    ) : (
      <SuggestionChips
        key={group.key}
        label={group.label}
        options={group.options}
        value={suggestions[group.key]}
        onToggle={(value) => updateSuggestion(group.key, value)}
        labels={t.options}
      />
    );
  }

  function renderDetailsPanel() {
    if (!detailsOpen || !result?.src || !generationMeta) return null;

    const sourceText =
      generationMeta.mode === "preset"
        ? [generationMeta.presetSourceLabel, generationMeta.presetTitle].filter(Boolean).join(" / ")
        : null;

    return (
      <div className="details-panel" ref={detailsPanelRef}>
        <div className="details-panel-top">
          <div className="details-panel-title">{detailsText.title}</div>
          <button
            className="details-close-button"
            type="button"
            onClick={() => setDetailsOpen(false)}
            aria-label={detailsText.close}
          >
            {"\u00D7"}
          </button>
        </div>

        <div className="details-grid">
          <div className="details-label">{detailsText.mode}</div>
          <div className="details-value">
            {generationMeta.mode === "preset"
              ? detailsText.preset
              : generationMeta.mode === "edit"
                ? editText.open
                : generationMeta.mode === "mask"
                  ? maskText.open
                : detailsText.custom}
          </div>

          {sourceText ? (
            <>
              <div className="details-label">{detailsText.source}</div>
              <div className="details-value">{sourceText}</div>
            </>
          ) : null}

          <div className="details-label">{detailsText.format}</div>
          <div className="details-value details-value-mono">{generationMeta.outputFormat}</div>

          <div className="details-label">{detailsText.reference}</div>
          <div className="details-value">{generationMeta.hasReferenceImage ? "Yes" : detailsText.referenceNone}</div>

          <div className="details-label">{detailsText.hints}</div>
          <div className="details-value">
            {detailHintPills.length ? (
              <div className="details-chip-wrap">
                {detailHintPills.map((item) => (
                  <span key={item.key} className="details-chip">
                    {item.label}
                  </span>
                ))}
              </div>
            ) : (
              detailsText.emptyHints
            )}
          </div>

          {generationMeta.revisedPrompt ? (
            <>
              <div className="details-label">{detailsText.revisedPrompt}</div>
              <div className="details-value details-revised-text">{generationMeta.revisedPrompt}</div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  function renderEditPanel() {
    if (!editOpen || !result?.src) return null;

    return (
      <div className="edit-panel" ref={editPanelRef} style={{ transform: `translate(${editPanelPos.x}px, ${editPanelPos.y}px)` }}>
        <div className="floating-panel-handle" onPointerDown={(event) => startFloatingDrag("edit", event)}>
          <div className="floating-panel-title">{editText.open}</div>
        </div>
        <textarea
          className="edit-panel-input"
          value={editPrompt}
          onChange={(event) => setEditPrompt(event.target.value)}
          placeholder={editText.placeholder}
          spellCheck="false"
        />
        <button className="edit-panel-send" type="button" onClick={submitEditPrompt} disabled={!cleanPrompt(editPrompt)}>
          {editText.send}
        </button>
      </div>
    );
  }

  function renderMaskPanel() {
    if (!maskOpen || !canOpenMask) return null;

    return (
      <div className="mask-panel" ref={maskPanelRef} style={{ transform: `translate(${maskPanelPos.x}px, ${maskPanelPos.y}px)` }}>
        <div className="floating-panel-handle" onPointerDown={(event) => startFloatingDrag("mask", event)}>
          <div className="floating-panel-title">{maskText.open}</div>
        </div>
        <textarea
          className="edit-panel-input"
          value={maskPrompt}
          onChange={(event) => setMaskPrompt(event.target.value)}
          placeholder={maskText.placeholder}
          spellCheck="false"
        />
        <div className="mask-panel-controls">
          <div className="mask-brush-group">
            <span className="mask-brush-label">{maskText.brush}</span>
            <input
              className="mask-brush-slider"
              type="range"
              min="12"
              max="72"
              step="2"
              value={maskBrush}
              onChange={(event) => setMaskBrush(Number(event.target.value))}
            />
          </div>
          <div className="mask-panel-actions">
            <button className="mask-secondary-button" type="button" onClick={clearMaskDrawing}>
              {maskText.clear}
            </button>
            <button className="mask-secondary-button" type="button" onClick={() => setMaskOpen(false)}>
              {maskText.cancel}
            </button>
            <button
              className="edit-panel-send"
              type="button"
              onClick={submitMaskPrompt}
              disabled={!cleanPrompt(maskPrompt) || !maskPaths.length}
            >
              {maskText.send}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderPresetPanel() {
    return (
      <div className="preset-panel">
        <div className="preset-source-bar">
          <div className="preset-source-switch">
            {PRESET_SOURCES.map((source) => (
              <button
                key={source.id}
                className={`preset-source-button${currentSource?.id === source.id ? " is-active" : ""}`}
                type="button"
                onClick={() => selectPresetSource(source.id)}
              >
                {source.label}
              </button>
            ))}
          </div>
          {currentSource?.sourceUrl ? (
            <a
              className="preset-source-link"
              href={currentSource.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={t.preset.sourceLink}
              title={t.preset.sourceLink}
            >
              <svg className="preset-source-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9.5 14.5 14.5 9.5M10 6.5H8.25A3.75 3.75 0 0 0 4.5 10.25v5.5a3.75 3.75 0 0 0 3.75 3.75h5.5a3.75 3.75 0 0 0 3.75-3.75V14M14 4.5h5.5V10"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          ) : null}
        </div>

        <div className="preset-list-card">
          {pagedPresets.map((preset) => (
            <button
              key={preset.id}
              className={`preset-item${activePresetId === preset.id ? " is-active" : ""}`}
              type="button"
              onClick={() => setActivePresetId(preset.id)}
            >
              <span className="preset-item-title">{preset.titleZh}</span>
              <span className="preset-item-mark">{activePresetId === preset.id ? "-" : "+"}</span>
            </button>
          ))}
        </div>

        <div className="preset-pager">
          <button
            className="preset-page-button"
            type="button"
            onClick={() => stepPresetPage(-1)}
            disabled={presetPage <= 0}
            aria-label="previous-page"
          >
            {"<"}
          </button>
          <span className="preset-page-indicator">
            {presetPageCount ? `${presetPage + 1}/${presetPageCount}` : "0/0"}
          </span>
          <button
            className="preset-page-button"
            type="button"
            onClick={() => stepPresetPage(1)}
            disabled={presetPage >= presetPageCount - 1}
            aria-label="next-page"
          >
            {">"}
          </button>
        </div>

        <div className="preset-editor-card">
          <div className="preset-editor-top">
            <div className="preset-editor-title">{activePreset?.titleZh || ""}</div>
            {activePreset ? (
              <button className="preset-restore" type="button" onClick={restoreActivePreset}>
                {t.preset.restore}
              </button>
            ) : null}
          </div>
          <textarea
            className="prompt-input preset-editor-input"
            value={activePresetText}
            onChange={(event) => updateActivePresetText(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            spellCheck="false"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${collapsed ? " is-collapsed" : ""}`}>
      <input
        ref={referenceInputRef}
        className="reference-input"
        type="file"
        accept="image/*"
        multiple={referencePickerMode === "add"}
        onChange={handleReferenceChange}
        tabIndex={-1}
      />
      <div
        className={`sidebar-backdrop${sidebarOpen ? " is-visible" : ""}`}
        onClick={closeSidebar}
      ></div>

      <aside className={`sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="sidebar-top">
          <div className="sidebar-top-spacer"></div>
          <button
            className="icon-button sidebar-toggle-btn"
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "close sidebar" : "open sidebar"}
          >
            {sidebarOpen ? "<" : ">"}
          </button>
          <button
            className="icon-button sidebar-collapse-btn"
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "expand" : "collapse"}
          >
            {collapsed ? ">" : "<"}
          </button>
        </div>

        <div className="sidebar-tabs">
          <button
            className={`tab-button${tab === "custom" ? " is-active" : ""}`}
            type="button"
            onClick={() => setTab("custom")}
          >
            {collapsed && !sidebarOpen ? t.tabs.customMini : t.tabs.custom}
          </button>
          <button
            className={`tab-button${tab === "preset" ? " is-active" : ""}`}
            type="button"
            onClick={() => setTab("preset")}
          >
            {collapsed && !sidebarOpen ? t.tabs.presetMini : t.tabs.preset}
          </button>
        </div>

        <div className="sidebar-body">
          {tab === "custom" ? (
            <div className="panel-stack">
              <div className="prompt-block">
                <div className="section-label">{t.sections.prompt}</div>
                <textarea
                  className="prompt-input custom-prompt-input"
                  value={form.prompt}
                  onChange={(event) => updateField("prompt", event.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  spellCheck="false"
                />
                {activeSuggestionPills.length ? (
                  <div className="prompt-tail">
                    {activeSuggestionPills.map((pill) => (
                      <button key={pill.key} className="tail-pill" type="button" onClick={() => removeSuggestion(pill.key)}>
                        {pill.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="true-param-card">
                <div className="section-label">{t.sections.params}</div>
                <div className="true-param-row">
                  <span className="true-param-label">{t.fields.format}</span>
                  <div className="segmented">
                    {FORMAT_OPTIONS.map((option) => (
                      <button
                        key={option}
                        className={`chip-button${form.outputFormat === option ? " is-active" : ""}`}
                        type="button"
                        onClick={() => updateField("outputFormat", option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="suggestion-card">
                <div className="section-label">{t.sections.suggestions}</div>
                <div className="suggestion-grid">
                  <div className="suggestion-column">
                    {SUGGESTION_LEFT_COLUMN.map((key) => renderSuggestionControl(key))}
                  </div>
                  <div className="suggestion-column">
                    {SUGGESTION_RIGHT_COLUMN.map((key) => renderSuggestionControl(key))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            renderPresetPanel()
          )}
        </div>
      </aside>

      <main className="main-area">
        <div className="main-bar">
          <button
            className="icon-button sidebar-open-btn"
            type="button"
            onClick={toggleSidebar}
            aria-label="Open sidebar"
          >
            {"≡"}
          </button>

          <div className={`status-dot ${status}`}></div>

          <div className="bar-actions">
            <button
              className="icon-button settings-toggle"
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              aria-label="Settings"
              ref={settingsButtonRef}
            >
              &#9881;
            </button>

            <div className={`settings-group${showSettings ? " is-open" : ""}`} ref={settingsPanelRef}>
              <div className="swatch-wrap">
                {THEME_OPTIONS.map((theme) => (
                  <button
                    key={theme}
                    className={`swatch-button ${theme}${accent === theme ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setAccent(theme)}
                    aria-label={theme}
                  ></button>
                ))}
              </div>

              <div className="switch-wrap mode-switch">
                <button
                  className={`toggle-button toggle-button-mode${mode === "system" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setMode("system")}
                >
                  {t.top.system}
                </button>
                <button
                  className={`toggle-button toggle-button-mode${mode === "light" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setMode("light")}
                >
                  {t.top.light}
                </button>
                <button
                  className={`toggle-button toggle-button-mode${mode === "dark" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setMode("dark")}
                >
                  {t.top.dark}
                </button>
              </div>

              <div className="switch-wrap lang-switch">
                <button
                  className={`toggle-button toggle-button-lang${lang === "zh" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setLang("zh")}
                >
                  中
                </button>
                <button
                  className={`toggle-button toggle-button-lang${lang === "en" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setLang("en")}
                >
                  EN
                </button>
              </div>
            </div>

            <button className="primary-button" type="button" onClick={handleGenerate} disabled={isLoading}>
              {isLoading ? t.top.generating : t.top.generate}
            </button>
          </div>
        </div>

        <div className="content-area">
          <div className="stage-card">
            <div className="stage-top">
              <div className="stage-top-meta">
                {isLoading ? (
                  <span className="stage-timer">
                    <span className="stage-timer-dot" aria-hidden="true"></span>
                    {formatElapsed(elapsedSeconds)}
                  </span>
                ) : (
                  <div className="stage-top-spacer"></div>
                )}
              </div>
              <div className="stage-actions">
                {result?.src ? (
                  <button
                    className="icon-button stage-tool-button"
                    type="button"
                    onClick={() => setDetailsOpen((current) => !current)}
                    aria-label={detailsText.info}
                    ref={detailsButtonRef}
                  >
                    <svg className="stage-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 8.25h.01M10.75 11h1.25v4h1.25M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : null}
                {result?.src ? (
                  <button
                    className="icon-button stage-tool-button"
                    type="button"
                    onClick={openEditPanel}
                    aria-label={editText.open}
                    ref={editButtonRef}
                  >
                    <svg className="stage-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="m15.5 5.5 3 3M6.75 17.25l2.75-.5 8.75-8.75a1.5 1.5 0 0 0 0-2.12l-.13-.13a1.5 1.5 0 0 0-2.12 0L7.25 14.5l-.5 2.75Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : null}
                {(result?.src || referenceImages.length) ? (
                  <button
                    className="icon-button stage-tool-button"
                    type="button"
                    onClick={openMaskPanel}
                    aria-label={maskText.open}
                    title={canOpenMask ? maskText.open : maskText.disabled}
                    ref={maskButtonRef}
                    disabled={!canOpenMask}
                  >
                    <svg className="stage-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M6.5 16.5c1.4-3.9 4.6-7.1 8.5-8.5M15.75 4.75l3.5 3.5M7.75 19.25c-1.2 0-2.25-.97-2.25-2.17 0-1.61 1.38-2.83 3.12-2.83.34 0 .67.05.98.14.3-1.86 1.96-3.27 3.96-3.27 2.21 0 4 1.72 4 3.85 0 2.37-2.03 4.28-4.53 4.28H7.75Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : null}
                {result?.src ? (
                  <a className="ghost-button" href={result.src} download={result.downloadName}>
                    {t.top.download}
                  </a>
                ) : null}
              </div>
            </div>

            {renderDetailsPanel()}
            {renderEditPanel()}
            {renderMaskPanel()}
            <div className="stage-body" ref={stageBodyRef}>{renderStageBody()}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
