const form = document.getElementById("generator-form");
const promptInput = document.getElementById("prompt");
const submitButton = document.getElementById("submit-button");
const statusText = document.getElementById("status-text");
const emptyState = document.getElementById("empty-state");
const gallery = document.getElementById("gallery");
const template = document.getElementById("image-card-template");
const exampleChips = document.querySelectorAll(".example-chip");

function setStatus(text, state = "") {
  statusText.textContent = text;
  statusText.className = `status-text${state ? ` ${state}` : ""}`;
}

function formDataToPayload() {
  const data = new FormData(form);
  return {
    prompt: String(data.get("prompt") || "").trim(),
    size: String(data.get("size") || "1024x1024"),
    quality: String(data.get("quality") || "high"),
    outputFormat: String(data.get("outputFormat") || "png"),
    n: String(data.get("n") || "1"),
    background: String(data.get("background") || "auto"),
    moderation: String(data.get("moderation") || "low"),
  };
}

function clearGallery() {
  gallery.innerHTML = "";
  gallery.hidden = true;
  emptyState.hidden = false;
}

function renderImages(images) {
  gallery.innerHTML = "";
  images.forEach((item, index) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".image-card");
    const image = fragment.querySelector("img");
    const imageIndex = fragment.querySelector(".image-index");
    const downloadLink = fragment.querySelector(".download-link");
    const revisedPrompt = fragment.querySelector(".revised-prompt");

    const src = item.base64
      ? `data:${item.mimeType || "image/png"};base64,${item.base64}`
      : item.url;

    image.src = src;
    imageIndex.textContent = `Frame ${index + 1}`;
    downloadLink.href = src;
    downloadLink.download = `frame-forge-${index + 1}`;

    if (item.revisedPrompt) {
      revisedPrompt.hidden = false;
      revisedPrompt.textContent = item.revisedPrompt;
    }

    card.style.animationDelay = `${index * 70}ms`;
    gallery.appendChild(fragment);
  });

  emptyState.hidden = true;
  gallery.hidden = false;
}

async function handleSubmit(event) {
  event.preventDefault();
  const payload = formDataToPayload();
  if (!payload.prompt) {
    setStatus("Prompt is required.", "error");
    promptInput.focus();
    return;
  }

  submitButton.disabled = true;
  setStatus("Generating with gpt-image-2...", "");

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || "Image generation failed.");
    }

    const images = Array.isArray(json.images) ? json.images : [];
    if (!images.length) {
      throw new Error("The API returned no images.");
    }

    renderImages(images);
    setStatus(`Generated ${images.length} image${images.length > 1 ? "s" : ""}.`, "success");
  } catch (error) {
    clearGallery();
    setStatus(error.message || "Image generation failed.", "error");
  } finally {
    submitButton.disabled = false;
  }
}

for (const chip of exampleChips) {
  chip.addEventListener("click", () => {
    promptInput.value = chip.dataset.prompt || "";
    promptInput.focus();
    promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
    setStatus("Example prompt loaded.", "");
  });
}

form.addEventListener("submit", handleSubmit);
