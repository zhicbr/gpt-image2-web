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

export default function App() {
  const dragRef = useRef(null);
  const settingsButtonRef = useRef(null);
  const settingsPanelRef = useRef(null);
  const detailsButtonRef = useRef(null);
  const detailsPanelRef = useRef(null);

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
    }
  }, [result?.src]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!(event.target instanceof Node)) return;

      const clickedSettingsButton = settingsButtonRef.current?.contains(event.target);
      const clickedSettingsPanel = settingsPanelRef.current?.contains(event.target);
      const clickedDetailsButton = detailsButtonRef.current?.contains(event.target);
      const clickedDetailsPanel = detailsPanelRef.current?.contains(event.target);

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
      hasReferenceImage: false,
      revisedPrompt: null,
    };
  }

  function formatElapsed(seconds) {
    const safe = Math.max(0, seconds || 0);
    const minutes = Math.floor(safe / 60);
    const remain = safe % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
  }

  async function handleGenerate() {
    const customPrompt = form.prompt.trim();
    const presetPrompt = activePresetText.trim();
    const rawPrompt = tab === "preset" ? presetPrompt : customPrompt;

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
    setGenerationMeta(null);

    const requestMeta = buildGenerationMeta();

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: tab === "preset" ? presetPrompt : buildComposedPrompt(),
          outputFormat: form.outputFormat,
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

      setResult({
        src,
        mimeType,
        downloadName: buildDownloadName(mimeType),
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

  function renderStageBody() {
    if (isLoading) {
      return (
        <div className="loader-stage" aria-hidden="true">
          <div className="loader-surface"></div>
          <div className="loader-shine"></div>
        </div>
      );
    }

    if (status === "error") {
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

    return (
      <div className="placeholder placeholder-idle">
        <div className="placeholder-frame"></div>
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
          <div className="details-value">{generationMeta.mode === "preset" ? detailsText.preset : detailsText.custom}</div>

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
                  <a className="ghost-button" href={result.src} download={result.downloadName}>
                    {t.top.download}
                  </a>
                ) : null}
              </div>
            </div>

            {renderDetailsPanel()}
            <div className="stage-body">{renderStageBody()}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
