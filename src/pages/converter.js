import JSZip from "jszip";
import * as XLSX from "xlsx";
import ImageTracer from "imagetracerjs";
import template from "./converter.html?raw";
import { decodeInput } from "../lib/image.js";

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
]);

const PRESETS = {
  marketplace: {
    format: "webp",
    maxKb: 1024,
    maxDimension: 2500,
    qualityMin: 40,
    qualityMax: 90,
    hint: "Até 1 MB e 2500 px, padrão aceito pela maioria dos marketplaces.",
  },
  web: {
    format: "webp",
    maxKb: 500,
    maxDimension: 1920,
    qualityMin: 50,
    qualityMax: 85,
    hint: "Equilíbrio entre qualidade e velocidade de carregamento em sites.",
  },
  social: {
    format: "jpeg",
    maxKb: 800,
    maxDimension: 1080,
    qualityMin: 60,
    qualityMax: 90,
    hint: "1080 px em JPEG, compatível com redes sociais.",
  },
  email: {
    format: "jpeg",
    maxKb: 200,
    maxDimension: 800,
    qualityMin: 40,
    qualityMax: 80,
    hint: "Arquivos leves para anexar em e-mails e mensagens.",
  },
  custom: {
    hint: "Ajuste os valores manualmente.",
  },
};

const MIME_TYPES = {
  webp: "image/webp",
  avif: "image/avif",
  jpeg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
};

const SVG_TRACE_MAX_DIMENSION = 1000;
const QUEUE_PREVIEW_LIMIT = 60;

const state = {
  localItems: [],
  sheetItems: [],
  results: [],
  processing: false,
  progress: { done: 0, total: 0 },
};

const SELECTORS = {
  dropzone: "#dropzone",
  pickImages: "#pick-images",
  pickFolder: "#pick-folder",
  pickSheet: "#pick-sheet",
  sheetColumn: "#sheet-column",
  sheetWarning: "#sheet-warning",
  tabFiles: "#tab-files",
  tabSheet: "#tab-sheet",
  panelFiles: "#panel-files",
  panelSheet: "#panel-sheet",
  queueCard: "#queue-card",
  queueGrid: "#queue-grid",
  queueCount: "#queue-count",
  clearQueue: "#clear-queue",
  presets: "#presets",
  presetHint: "#preset-hint",
  format: "#format",
  maxKb: "#max-kb",
  maxDimension: "#max-dimension",
  qualityMin: "#quality-min",
  qualityMax: "#quality-max",
  settingsError: "#settings-error",
  run: "#run",
  zip: "#zip",
  clear: "#clear",
  progress: "#progress",
  progressFill: "#progress-fill",
  progressLabel: "#progress-label",
  resultsBlock: "#results-block",
  resultsBody: "#results-body",
  statOk: "#stat-ok",
  statOriginal: "#stat-original",
  statFinal: "#stat-final",
  statSaved: "#stat-saved",
  dialog: "#preview-dialog",
  previewTitle: "#preview-title",
  previewMeta: "#preview-meta",
  previewBefore: "#preview-before",
  previewAfter: "#preview-after",
  previewBeforeCaption: "#preview-before-caption",
  previewAfterCaption: "#preview-after-caption",
  previewClose: "#preview-close",
};

let ui = {};
// Invalida conversões em andamento quando a tela é fechada.
let sessionId = 0;

let renderedResults = 0;

/* Utilitários */

function outputExtension(format) {
  return format === "jpeg" ? ".jpg" : `.${format}`;
}

function traceToSvgBlob(canvas, quality) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const colors = Math.min(64, Math.max(2, Math.round(2 + quality * 62)));
  const svg = ImageTracer.imagedataToSVG(imageData, {
    numberofcolors: colors,
    viewbox: true,
    pathomit: 8,
  });
  const sized = svg.replace(
    "<svg ",
    `<svg width="${canvas.width}" height="${canvas.height}" `,
  );
  return new Blob([sized], { type: MIME_TYPES.svg });
}

function slugify(name) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "imagem"
  );
}

function formatBytes(value) {
  if (!value || Number.isNaN(value)) {
    return "-";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  }
  return `${(value / (1024 * 1024)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
}

function savingPercent(original, final) {
  if (!original || !final) {
    return null;
  }
  return (1 - final / original) * 100;
}

function formatSaving(percent) {
  if (percent === null) {
    return "-";
  }
  const rounded = Math.abs(percent).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  });
  return percent >= 0 ? `-${rounded}%` : `+${rounded}%`;
}

function isImageFileName(name) {
  const dot = name.lastIndexOf(".");
  return dot !== -1 && IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

function extensionLabel(name) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "img" : name.slice(dot + 1, dot + 5);
}

function createIcon(path) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", path);
  svg.appendChild(p);
  return svg;
}

/* Suporte a formatos de saída */

async function canEncode(format) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, MIME_TYPES[format], 0.8),
  );
  return Boolean(blob) && blob.type === MIME_TYPES[format];
}

async function detectFormats() {
  for (const option of ui.format.options) {
    if (option.value !== "svg" && !(await canEncode(option.value))) {
      option.disabled = true;
      option.textContent += " - indisponível neste navegador";
    }
  }
  if (ui.format.selectedOptions[0]?.disabled) {
    const fallback = [...ui.format.options].find((option) => !option.disabled);
    if (fallback) {
      ui.format.value = fallback.value;
    }
  }
}

/* Configurações */

function setActivePreset(name) {
  for (const chip of ui.presets.querySelectorAll(".chip")) {
    chip.classList.toggle("is-active", chip.dataset.preset === name);
  }
  ui.presetHint.textContent = PRESETS[name]?.hint ?? "";
}

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) {
    return;
  }
  if (name !== "custom") {
    const formatOption = [...ui.format.options].find(
      (option) => option.value === preset.format && !option.disabled,
    );
    ui.format.value = formatOption ? preset.format : ui.format.value;
    ui.maxKb.value = preset.maxKb;
    ui.maxDimension.value = preset.maxDimension;
    ui.qualityMin.value = preset.qualityMin;
    ui.qualityMax.value = preset.qualityMax;
  }
  ui.settingsError.textContent = "";
  setActivePreset(name);
}

function getSettings() {
  return {
    maxBytes: Math.round(Number.parseFloat(ui.maxKb.value) * 1024),
    maxDimension: Number.parseInt(ui.maxDimension.value, 10),
    format: ui.format.value,
    qualityMin: Number.parseInt(ui.qualityMin.value, 10),
    qualityMax: Number.parseInt(ui.qualityMax.value, 10),
  };
}

function validateSettings(settings) {
  if (Number.isNaN(settings.maxBytes) || settings.maxBytes <= 0) {
    throw new Error("Informe um tamanho máximo válido em KB.");
  }
  if (Number.isNaN(settings.maxDimension) || settings.maxDimension < 320) {
    throw new Error("O maior lado deve ser de pelo menos 320 px.");
  }
  if (
    Number.isNaN(settings.qualityMin) ||
    Number.isNaN(settings.qualityMax) ||
    settings.qualityMin <= 0 ||
    settings.qualityMax > 100 ||
    settings.qualityMin > settings.qualityMax
  ) {
    throw new Error(
      "Qualidade inválida: use valores de 1 a 100, com mínima menor ou igual à máxima.",
    );
  }
}

/* Estado e limpeza */

function queueItems() {
  return [...state.localItems, ...state.sheetItems];
}

function revokeItemUrl(item) {
  if (item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function clearResultUrls() {
  for (const row of state.results) {
    if (row.outputUrl) {
      URL.revokeObjectURL(row.outputUrl);
    }
    if (row.originalObjectUrl) {
      URL.revokeObjectURL(row.originalObjectUrl);
    }
  }
}

function clearResults() {
  clearResultUrls();
  state.results = [];
}

function clearQueue() {
  state.localItems.forEach(revokeItemUrl);
  state.localItems = [];
  state.sheetItems = [];
  ui.sheetWarning.textContent = "";
  renderQueue();
  render();
}

function clearAll() {
  if (state.processing) {
    return;
  }
  clearResults();
  clearQueue();
}

function removeFromQueue(key) {
  const local = state.localItems.find((item) => item.key === key);
  if (local) {
    revokeItemUrl(local);
  }
  state.localItems = state.localItems.filter((item) => item.key !== key);
  state.sheetItems = state.sheetItems.filter((item) => item.key !== key);
  renderQueue();
  render();
}

/* Renderização */

function renderQueue() {
  const items = queueItems();
  ui.queueCard.hidden = items.length === 0;
  ui.queueCount.textContent = String(items.length);
  ui.queueGrid.replaceChildren();

  for (const item of items.slice(0, QUEUE_PREVIEW_LIMIT)) {
    const card = document.createElement("div");
    card.className = "queue-item";
    card.title = item.name;

    const thumb = document.createElement("div");
    thumb.className = "queue-thumb";
    thumb.textContent = extensionLabel(item.name);

    const img = document.createElement("img");
    img.alt = item.name;
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("load", () => thumb.replaceChildren(img), {
      once: true,
    });
    img.src = item.previewUrl || item.url;

    const name = document.createElement("div");
    name.className = "queue-name";
    name.textContent = item.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "queue-remove";
    remove.setAttribute("aria-label", `Remover ${item.name}`);
    remove.disabled = state.processing;
    remove.appendChild(createIcon("M6 6l12 12M18 6L6 18"));
    remove.addEventListener("click", () => removeFromQueue(item.key));

    card.append(thumb, name, remove);
    ui.queueGrid.appendChild(card);
  }

  if (items.length > QUEUE_PREVIEW_LIMIT) {
    const more = document.createElement("div");
    more.className = "queue-more";
    more.textContent = `+${items.length - QUEUE_PREVIEW_LIMIT}`;
    ui.queueGrid.appendChild(more);
  }
}

function renderStats() {
  const ok = state.results.filter((row) => row.status === "ok");
  const original = ok.reduce((sum, row) => sum + (row.originalBytes ?? 0), 0);
  const final = ok.reduce((sum, row) => sum + (row.outputBytes ?? 0), 0);
  const saved = savingPercent(original, final);

  ui.statOk.textContent = `${ok.length} de ${state.results.length}`;
  ui.statOriginal.textContent = formatBytes(original);
  ui.statFinal.textContent = formatBytes(final);
  ui.statSaved.textContent =
    saved === null
      ? "-"
      : `${Math.max(saved, 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}

function buildResultRow(item) {
  const row = document.createElement("tr");

  const nameTd = document.createElement("td");
  const fileCell = document.createElement("div");
  fileCell.className = "file-cell";
  if (item.outputUrl) {
    const thumb = document.createElement("img");
    thumb.className = "file-thumb";
    thumb.src = item.outputUrl;
    thumb.alt = item.name;
    thumb.title = "Comparar antes e depois";
    thumb.addEventListener("click", () => openPreview(item));
    fileCell.appendChild(thumb);
  }
  const name = document.createElement("span");
  name.className = "file-name";
  name.textContent = item.name;
  name.title = item.name;
  fileCell.appendChild(name);
  nameTd.appendChild(fileCell);

  const statusTd = document.createElement("td");
  const status = document.createElement("span");
  const labels = { ok: "Otimizada", limit: "Acima do limite", error: "Falha" };
  status.className = `status status-${item.status}`;
  status.textContent = labels[item.status];
  statusTd.appendChild(status);
  if (item.error) {
    const details = document.createElement("div");
    details.className = "row-detail";
    details.textContent = item.error;
    statusTd.appendChild(details);
  }

  const originalTd = document.createElement("td");
  originalTd.textContent = formatBytes(item.originalBytes);

  const finalTd = document.createElement("td");
  finalTd.textContent = formatBytes(item.outputBytes);

  const saving = savingPercent(item.originalBytes, item.outputBytes);
  const savingTd = document.createElement("td");
  savingTd.textContent = formatSaving(saving);
  if (saving !== null) {
    savingTd.className = saving >= 0 ? "saving-good" : "saving-bad";
  }

  const dimsTd = document.createElement("td");
  dimsTd.textContent = item.width ? `${item.width} × ${item.height}` : "-";

  const actionTd = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "row-actions";
  if (item.outputUrl) {
    const compare = document.createElement("button");
    compare.type = "button";
    compare.className = "btn btn-ghost btn-sm";
    compare.textContent = "Comparar";
    compare.addEventListener("click", () => openPreview(item));

    const link = document.createElement("a");
    link.className = "btn btn-primary btn-sm";
    link.href = item.outputUrl;
    link.download = item.downloadName;
    link.textContent = "Baixar";

    actions.append(compare, link);
  } else {
    actions.textContent = "-";
  }
  actionTd.appendChild(actions);

  row.append(
    nameTd,
    statusTd,
    originalTd,
    finalTd,
    savingTd,
    dimsTd,
    actionTd,
  );
  return row;
}

function renderResults() {
  if (state.results.length < renderedResults) {
    ui.resultsBody.replaceChildren();
    renderedResults = 0;
  }
  for (let i = renderedResults; i < state.results.length; i += 1) {
    ui.resultsBody.appendChild(buildResultRow(state.results[i]));
  }
  renderedResults = state.results.length;
  ui.resultsBlock.hidden = state.results.length === 0;
  renderStats();
}

function render() {
  const total = queueItems().length;
  const okCount = state.results.filter((row) => row.status === "ok").length;

  ui.run.disabled = state.processing || total === 0;
  ui.run.textContent = state.processing
    ? "Convertendo..."
    : total > 0
      ? `Converter ${total} ${total === 1 ? "imagem" : "imagens"}`
      : "Converter imagens";
  ui.zip.disabled = state.processing || okCount === 0;
  ui.clear.disabled = state.processing;
  ui.clearQueue.disabled = state.processing;

  ui.progress.hidden = !state.processing;
  const { done, total: progressTotal } = state.progress;
  ui.progressFill.style.width = progressTotal
    ? `${(done / progressTotal) * 100}%`
    : "0%";
  ui.progressLabel.textContent = `${done} de ${progressTotal} processadas`;

  renderResults();
}

/* Entrada de arquivos */

function addLocalFiles(fileList, sourceLabel) {
  const known = new Set(state.localItems.map((item) => item.key));

  for (const file of fileList) {
    if (!file.type.startsWith("image/") && !isImageFileName(file.name)) {
      continue;
    }

    const key = `${file.name}:${file.size}:${file.lastModified}:${sourceLabel}`;
    if (known.has(key)) {
      continue;
    }
    known.add(key);
    state.localItems.push({
      kind: "local",
      key,
      name: file.webkitRelativePath || file.name,
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  renderQueue();
  render();
}

function detectSheetColumn(headers, requested) {
  const normalized = headers.map((value) => String(value ?? "").trim());

  if (requested) {
    return (
      normalized.find((value) => value.toLowerCase() === requested.toLowerCase()) ??
      null
    );
  }

  const candidates = ["imagem", "image", "url", "arquivo", "path", "caminho"];
  return (
    normalized.find((value) => candidates.includes(value.toLowerCase())) ?? null
  );
}

async function parseSheet(file, columnName) {
  const accepted = [];
  const warnings = [];

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    return { accepted, warnings: ["A planilha não possui abas."] };
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    defval: "",
  });

  if (!rows.length) {
    return { accepted, warnings: ["A planilha não possui linhas."] };
  }

  const imageColumn = detectSheetColumn(Object.keys(rows[0]), columnName);
  if (!imageColumn) {
    return {
      accepted,
      warnings: [
        columnName
          ? `A coluna "${columnName}" não foi encontrada na planilha.`
          : "Não foi possível detectar a coluna de imagens. Informe o nome da coluna.",
      ],
    };
  }

  rows.forEach((row, idx) => {
    const raw = String(row[imageColumn] ?? "").trim();
    if (!raw) {
      return;
    }

    if (!/^https?:\/\//i.test(raw)) {
      warnings.push(`Linha ${idx + 2}: valor ignorado ("${raw}"). Use URLs HTTP/HTTPS.`);
      return;
    }

    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      warnings.push(`Linha ${idx + 2}: URL inválida ("${raw}").`);
      return;
    }

    accepted.push({
      kind: "url",
      key: `${raw}-${idx}`,
      name: decodeURIComponent(parsed.pathname.split("/").pop() || `url-${idx + 1}`),
      url: raw,
    });
  });

  return { accepted, warnings };
}

/* Conversão */

function toBlob(canvas, format, quality) {
  if (format === "svg") {
    return Promise.resolve(traceToSvgBlob(canvas, quality));
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao gerar a imagem convertida."));
          return;
        }
        resolve(blob);
      },
      MIME_TYPES[format],
      quality,
    );
  });
}

async function decodeBlob(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      return await decodeInput(blob);
    } catch {
      throw new Error("Formato de imagem não suportado ou arquivo corrompido.");
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Falha ao abrir a imagem."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToCanvas(imageSource, limitDimension, format) {
  const sourceWidth = imageSource.width || imageSource.naturalWidth;
  const sourceHeight = imageSource.height || imageSource.naturalHeight;

  const ratio = Math.min(1, limitDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Falha ao inicializar o canvas.");
  }

  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imageSource, 0, 0, width, height);

  return { canvas, width, height };
}

function qualityValues(min, max, format) {
  if (format === "png") {
    return [100];
  }
  if (format === "svg") {
    return [...new Set([max, Math.round((min + max) / 2), min])];
  }
  const values = [];
  for (let quality = max; quality >= min; quality -= 5) {
    values.push(quality);
  }
  if (values[values.length - 1] !== min) {
    values.push(min);
  }
  return values;
}

async function convertBlobWithRules(inputBlob, settings) {
  const source = await decodeBlob(inputBlob);

  try {
    let smallest = null;
    const qualities = qualityValues(
      settings.qualityMin,
      settings.qualityMax,
      settings.format,
    );

    const isSvg = settings.format === "svg";
    const scaleSteps = isSvg ? 5 : 8;
    const baseDimension = isSvg
      ? Math.min(settings.maxDimension, SVG_TRACE_MAX_DIMENSION)
      : settings.maxDimension;
    for (let scaleStep = 0; scaleStep < scaleSteps; scaleStep += 1) {
      const dimLimit = Math.max(
        320,
        Math.floor(baseDimension * (1 - scaleStep * 0.1)),
      );
      const { canvas, width, height } = drawToCanvas(
        source,
        dimLimit,
        settings.format,
      );

      for (const quality of qualities) {
        const blob = await toBlob(canvas, settings.format, quality / 100);
        // Deixa a interface respirar entre traçados pesados.
        if (isSvg) {
          await new Promise((resolve) => setTimeout(resolve));
        }
        const attempt = { blob, bytes: blob.size, width, height, quality };

        if (blob.size <= settings.maxBytes) {
          return attempt;
        }
        if (!smallest || attempt.bytes < smallest.bytes) {
          smallest = attempt;
        }
      }
    }

    return smallest;
  } finally {
    if (typeof source.close === "function") {
      source.close();
    }
  }
}

async function readInputBlob(item) {
  if (item.kind === "local") {
    return item.file;
  }

  let response;
  try {
    response = await fetch(item.url);
  } catch {
    throw new Error("Não foi possível baixar a imagem (URL indisponível ou bloqueada por CORS).");
  }
  if (!response.ok) {
    throw new Error(`A URL respondeu com status ${response.status}.`);
  }
  return response.blob();
}

function uniqueDownloadName(baseName, extension, used) {
  let candidate = `${baseName}${extension}`;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${baseName}-${counter}${extension}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

async function runConversion() {
  let settings;
  try {
    settings = getSettings();
    validateSettings(settings);
  } catch (error) {
    ui.settingsError.textContent = error.message;
    return;
  }
  ui.settingsError.textContent = "";

  const session = sessionId;
  clearResults();
  const queue = queueItems();
  const usedNames = new Set();

  state.processing = true;
  state.progress = { done: 0, total: queue.length };
  renderQueue();
  render();

  for (const item of queue) {
    if (session !== sessionId) {
      return;
    }
    const row = {
      name: item.name,
      status: "error",
      originalBytes: null,
      outputBytes: null,
      width: null,
      height: null,
      outputBlob: null,
      outputUrl: null,
      originalUrl: null,
      originalObjectUrl: null,
      downloadName: null,
      format: settings.format,
      error: null,
    };

    try {
      const inputBlob = await readInputBlob(item);
      row.originalBytes = inputBlob.size;
      row.originalObjectUrl = URL.createObjectURL(inputBlob);
      row.originalUrl = row.originalObjectUrl;

      const converted = await convertBlobWithRules(inputBlob, settings);
      const parsedName = item.name.split("/").pop() || item.name;
      const baseName = slugify(parsedName.replace(/\.[^.]+$/u, ""));

      row.downloadName = uniqueDownloadName(
        baseName,
        outputExtension(settings.format),
        usedNames,
      );
      row.outputBlob = converted.blob;
      row.outputBytes = converted.bytes;
      row.width = converted.width;
      row.height = converted.height;
      row.outputUrl = URL.createObjectURL(converted.blob);

      if (converted.bytes <= settings.maxBytes) {
        row.status = "ok";
      } else {
        row.status = "limit";
        row.error = `Não foi possível chegar a ${formatBytes(settings.maxBytes)}. Reduza a qualidade mínima ou o maior lado.`;
      }
    } catch (error) {
      row.error = error instanceof Error ? error.message : "Erro desconhecido.";
    }

    if (session !== sessionId) {
      URL.revokeObjectURL(row.outputUrl);
      URL.revokeObjectURL(row.originalObjectUrl);
      return;
    }
    state.results.push(row);
    state.progress.done += 1;
    render();
  }

  if (session !== sessionId) {
    return;
  }
  state.processing = false;
  renderQueue();
  render();
}

async function downloadZip() {
  const valid = state.results.filter((item) => item.status === "ok");
  if (!valid.length) {
    return;
  }

  const zip = new JSZip();
  for (const item of valid) {
    zip.file(item.downloadName, item.outputBlob);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "pixelfit-imagens.zip";
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* Comparação antes/depois */

function openPreview(row) {
  ui.previewTitle.textContent = row.name;
  ui.previewMeta.textContent = `${row.format.toUpperCase()} · ${row.width} × ${row.height} px`;
  ui.previewBefore.src = row.originalUrl;
  ui.previewAfter.src = row.outputUrl;
  ui.previewBeforeCaption.textContent = `Original · ${formatBytes(row.originalBytes)}`;
  ui.previewAfterCaption.textContent = `Convertida · ${formatBytes(row.outputBytes)} (${formatSaving(savingPercent(row.originalBytes, row.outputBytes))})`;
  ui.dialog.showModal();
}

/* Eventos */

function selectTab(tab) {
  const files = tab === "files";
  ui.tabFiles.classList.toggle("is-active", files);
  ui.tabSheet.classList.toggle("is-active", !files);
  ui.tabFiles.setAttribute("aria-selected", String(files));
  ui.tabSheet.setAttribute("aria-selected", String(!files));
  ui.panelFiles.hidden = !files;
  ui.panelSheet.hidden = files;
}

function bindEvents() {
  ui.tabFiles.addEventListener("click", () => selectTab("files"));
  ui.tabSheet.addEventListener("click", () => selectTab("sheet"));

  ui.pickImages.addEventListener("change", (event) => {
    if (event.target.files?.length) {
      addLocalFiles(event.target.files, "manual");
    }
    event.target.value = "";
  });

  ui.pickFolder.addEventListener("change", (event) => {
    if (event.target.files?.length) {
      addLocalFiles(event.target.files, "folder");
    }
    event.target.value = "";
  });

  ui.pickSheet.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const parsed = await parseSheet(file, ui.sheetColumn.value.trim());
      state.sheetItems = parsed.accepted;
      const skipped = parsed.warnings.length;
      ui.sheetWarning.textContent = skipped
        ? `${parsed.accepted.length} URL(s) carregada(s). Aviso: ${parsed.warnings[0]}${skipped > 1 ? ` (+${skipped - 1} avisos)` : ""}`
        : "";
    } catch {
      state.sheetItems = [];
      ui.sheetWarning.textContent =
        "Não foi possível ler a planilha. Verifique o arquivo.";
    }
    renderQueue();
    render();
  });

  for (const eventName of ["dragenter", "dragover"]) {
    ui.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      ui.dropzone.classList.add("is-over");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    ui.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      ui.dropzone.classList.remove("is-over");
    });
  }

  ui.dropzone.addEventListener("drop", (event) => {
    if (event.dataTransfer?.files?.length) {
      addLocalFiles(event.dataTransfer.files, "drop");
    }
  });

  ui.presets.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (chip) {
      applyPreset(chip.dataset.preset);
    }
  });

  for (const input of [
    ui.format,
    ui.maxKb,
    ui.maxDimension,
    ui.qualityMin,
    ui.qualityMax,
  ]) {
    input.addEventListener("input", () => setActivePreset("custom"));
  }

  ui.run.addEventListener("click", runConversion);
  ui.zip.addEventListener("click", downloadZip);
  ui.clear.addEventListener("click", clearAll);
  ui.clearQueue.addEventListener("click", clearQueue);

  ui.previewClose.addEventListener("click", () => ui.dialog.close());
  ui.dialog.addEventListener("click", (event) => {
    if (event.target === ui.dialog) {
      ui.dialog.close();
    }
  });
}

function releaseUrls() {
  clearResultUrls();
  state.localItems.forEach(revokeItemUrl);
}

export function mount(container) {
  sessionId += 1;
  container.innerHTML = template;
  ui = Object.fromEntries(
    Object.entries(SELECTORS).map(([key, selector]) => [
      key,
      container.querySelector(selector),
    ]),
  );

  Object.assign(state, {
    localItems: [],
    sheetItems: [],
    results: [],
    processing: false,
    progress: { done: 0, total: 0 },
  });
  renderedResults = 0;

  bindEvents();
  window.addEventListener("beforeunload", releaseUrls);
  applyPreset("marketplace");
  render();

  const current = ui;
  detectFormats().then(() => {
    if (ui === current) {
      applyPreset("marketplace");
    }
  });

  return () => {
    sessionId += 1;
    window.removeEventListener("beforeunload", releaseUrls);
    releaseUrls();
  };
}
