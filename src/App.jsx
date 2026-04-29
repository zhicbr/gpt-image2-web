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
import { PRESET_PAGE_SIZE, PRESET_SOURCES } from "./presetLibrary";

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

  const [lang, setLang] = useState(readStorage("ff-lang", "zh"));
  const [mode, setMode] = useState(readStorage("ff-mode", "system"));
  const [accent, setAccent] = useState(readStorage("ff-accent", "blue"));
  const [collapsed, setCollapsed] = useState(readStorage("ff-collapsed", "false") === "true");
  const [tab, setTab] = useState("custom");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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

  const t = COPY[lang];
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
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [result?.src]);

  const currentSource = useMemo(() => {
    return PRESET_SOURCES.find((source) => source.id === presetSourceId) || PRESET_SOURCES[0] || null;
  }, [presetSourceId]);

  const presetPageCount = useMemo(() => {
    if (!currentSource) return 1;
    return Math.max(1, Math.ceil(currentSource.items.length / PRESET_PAGE_SIZE));
  }, [currentSource]);

  const pagedPresets = useMemo(() => {
    if (!currentSource) return [];
    const start = presetPage * PRESET_PAGE_SIZE;
    return currentSource.items.slice(start, start + PRESET_PAGE_SIZE);
  }, [currentSource, presetPage]);

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
    if (!currentSource || !activePresetId) return null;
    return currentSource.items.find((preset) => preset.id === activePresetId) || null;
  }, [activePresetId, currentSource]);

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

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: tab === "preset" ? presetPrompt : buildComposedPrompt(),
          outputFormat: form.outputFormat,
          n: "1",
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || t.messages.failed);
      }

      const image = Array.isArray(json.images) ? json.images[0] : null;
      if (!image) {
        throw new Error(t.messages.failed);
      }

      const mimeType = image.mimeType || "image/png";
      const src = image.base64 ? `data:${mimeType};base64,${image.base64}` : image.url;

      setResult({
        src,
        mimeType,
        downloadName: buildDownloadName(mimeType),
      });
      setStatus("success");
      setMessage(image.revisedPrompt ? t.messages.revised : "");
    } catch (error) {
      setStatus("error");
      setResult(null);
      setMessage(error?.message || t.messages.failed);
    } finally {
      setIsLoading(false);
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
              {"\u2197"}
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
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-top-spacer"></div>
          <button
            className="icon-button"
            type="button"
            onClick={() => setCollapsed((current) => !current)}
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
            {collapsed ? t.tabs.customMini : t.tabs.custom}
          </button>
          <button
            className={`tab-button${tab === "preset" ? " is-active" : ""}`}
            type="button"
            onClick={() => setTab("preset")}
          >
            {collapsed ? t.tabs.presetMini : t.tabs.preset}
          </button>
        </div>

        <div className="sidebar-body">
          {tab === "custom" ? (
            <div className="panel-stack">
              <div className="prompt-block">
                <div className="section-label">{t.sections.prompt}</div>
                <textarea
                  className="prompt-input"
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
          <div className={`status-dot ${status}`}></div>

          <div className="bar-actions">
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

            <button className="primary-button" type="button" onClick={handleGenerate} disabled={isLoading}>
              {isLoading ? t.top.generating : t.top.generate}
            </button>
          </div>
        </div>

        <div className="content-area">
          <div className="stage-card">
            <div className="stage-top">
              <div className="stage-top-spacer"></div>
              <div className="stage-actions">
                {result?.src ? (
                  <a className="ghost-button" href={result.src} download={result.downloadName}>
                    {t.top.download}
                  </a>
                ) : null}
              </div>
            </div>

            <div className="stage-body">{renderStageBody()}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
