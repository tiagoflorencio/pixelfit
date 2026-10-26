import JSZip from "jszip";
import {
  createIcon,
  extensionLabel,
  formatBytes,
  isImageFileName,
  slugify,
} from "./utils.js";
import {
  blobToCanvas,
  decodeInput,
  downscale,
  encodeCanvas,
  extensionForType,
} from "./image.js";

const QUEUE_PREVIEW_LIMIT = 60;
const PREVIEW_DELAY_MS = 150;

/*
 * Estrutura comum das ferramentas em lote: seleção de imagens, fila,
 * pré-visualização opcional, resultado, comparação e ZIP.
 *
 * config:
 *  - settingsHtml: campos específicos da ferramenta
 *  - actionLabel: texto do botão principal (ex.: "Redimensionar")
 *  - suffix: sufixo do nome do arquivo gerado
 *  - preview: habilita pré-visualização da primeira imagem
 *  - forceFormat: fixa o formato de saída e esconde as opções
 *  - init(root, api): liga eventos extras; pode devolver uma função de limpeza
 *  - readOptions(root): lê e valida as opções (lança Error se inválidas)
 *  - process({ source, blob, name, options, preview }): devolve canvas ou Blob
 */
export function mountBatchTool(container, config) {
  const state = {
    items: [],
    results: [],
    processing: false,
    progress: { done: 0, total: 0 },
  };
  let session = 0;
  let renderedResults = 0;
  let previewToken = 0;
  let previewTimer = null;
  let statusText = "";
  const previewCache = { key: null, source: null };

  container.innerHTML = `
    <div class="layout">
      <div class="col-main">
        <section class="card">
          <div class="dropzone" data-ref="dropzone">
            <div class="dropzone-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 16V4" />
                <path d="M7 9l5-5 5 5" />
                <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
            </div>
            <p class="dropzone-title">Arraste suas imagens aqui</p>
            <p class="muted">PNG, JPG, WebP, AVIF, TIFF ou HEIC (iPhone)</p>
            <div class="row center">
              <label class="btn btn-primary">
                Selecionar imagens
                <input data-ref="pickImages" type="file" accept="image/*,.heic,.heif" multiple />
              </label>
              <label class="btn btn-ghost">
                Selecionar pasta
                <input data-ref="pickFolder" type="file" accept="image/*,.heic,.heif" multiple webkitdirectory directory />
              </label>
            </div>
          </div>
        </section>

        <section class="card" data-ref="queueCard" hidden>
          <div class="card-head">
            <h2>Imagens selecionadas <span class="pill" data-ref="queueCount">0</span></h2>
            <button class="link-btn" data-ref="clearQueue" type="button">Remover todas</button>
          </div>
          <div class="queue-grid" data-ref="queueGrid"></div>
        </section>

        <section class="card" data-ref="previewCard" hidden>
          <div class="card-head">
            <h2>Pré-visualização</h2>
            <span class="muted" data-ref="previewName"></span>
          </div>
          <div class="preview-box"><canvas data-ref="previewCanvas"></canvas></div>
        </section>
      </div>

      <aside class="col-side">
        <section class="card settings">
          <h2>Configurações</h2>
          <div class="settings" data-ref="toolSettings">${config.settingsHtml}</div>

          <div class="settings" data-ref="outputSettings">
            <label class="field">
              <span>Formato de saída</span>
              <select data-ref="format">
                <option value="original">Manter o formato original</option>
                <option value="webp">WebP</option>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
              </select>
            </label>
            <label class="field" data-ref="qualityField">
              <span>Qualidade (JPEG e WebP)</span>
              <input data-ref="quality" type="number" min="1" max="100" value="92" />
            </label>
          </div>

          <p class="error-text" data-ref="error" role="alert"></p>

          <small class="hint privacy-hint">
            Privacidade: metadados como GPS e dados da câmera são removidos
            automaticamente das imagens geradas.
          </small>

          <div class="actions">
            <button data-ref="run" class="btn btn-primary btn-lg" type="button">${config.actionLabel}</button>
            <button data-ref="zip" class="btn btn-ghost" type="button" disabled>Baixar tudo (.zip)</button>
            <button data-ref="clear" class="link-btn" type="button">Limpar tudo</button>
          </div>

          <div class="progress" data-ref="progress" hidden>
            <div class="progress-bar"><span data-ref="progressFill"></span></div>
            <small class="muted" data-ref="progressLabel"></small>
          </div>
        </section>
      </aside>
    </div>

    <section class="card" data-ref="resultsBlock" hidden>
      <div class="card-head">
        <h2>Resultado <span class="pill" data-ref="resultsCount">0</span></h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Imagem</th>
              <th>Status</th>
              <th>Original</th>
              <th>Final</th>
              <th>Dimensões</th>
              <th class="right">Ações</th>
            </tr>
          </thead>
          <tbody data-ref="resultsBody"></tbody>
        </table>
      </div>
    </section>

    <dialog data-ref="dialog" class="dialog">
      <div class="dialog-head">
        <div>
          <h3 data-ref="dialogTitle"></h3>
          <p class="muted" data-ref="dialogMeta"></p>
        </div>
        <button class="icon-btn" data-ref="dialogClose" type="button" aria-label="Fechar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div class="compare">
        <figure>
          <div class="compare-img"><img data-ref="dialogBefore" alt="Imagem original" /></div>
          <figcaption data-ref="dialogBeforeCaption"></figcaption>
        </figure>
        <figure>
          <div class="compare-img"><img data-ref="dialogAfter" alt="Imagem processada" /></div>
          <figcaption data-ref="dialogAfterCaption"></figcaption>
        </figure>
      </div>
    </dialog>
  `;

  const ui = {};
  for (const element of container.querySelectorAll("[data-ref]")) {
    ui[element.dataset.ref] = element;
  }

  if (config.forceFormat) {
    ui.outputSettings.hidden = true;
  }
  if (config.defaultQuality) {
    ui.quality.value = String(config.defaultQuality);
  }
  if (config.defaultFormat) {
    ui.format.value = config.defaultFormat;
  }

  /* Fila */

  function revokeItem(item) {
    URL.revokeObjectURL(item.previewUrl);
  }

  function clearResults() {
    for (const row of state.results) {
      URL.revokeObjectURL(row.outputUrl);
      URL.revokeObjectURL(row.originalUrl);
    }
    state.results = [];
  }

  function addFiles(fileList, label) {
    const known = new Set(state.items.map((item) => item.key));
    for (const file of fileList) {
      if (!file.type.startsWith("image/") && !isImageFileName(file.name)) {
        continue;
      }
      const key = `${file.name}:${file.size}:${file.lastModified}:${label}`;
      if (known.has(key)) {
        continue;
      }
      known.add(key);
      state.items.push({
        key,
        name: file.webkitRelativePath || file.name,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    renderQueue();
    render();
    refreshPreview();
  }

  function removeItem(key) {
    const item = state.items.find((entry) => entry.key === key);
    if (item) {
      revokeItem(item);
    }
    state.items = state.items.filter((entry) => entry.key !== key);
    renderQueue();
    render();
    refreshPreview();
  }

  function clearQueue() {
    state.items.forEach(revokeItem);
    state.items = [];
    renderQueue();
    render();
    refreshPreview();
  }

  function clearAll() {
    if (state.processing) {
      return;
    }
    clearResults();
    clearQueue();
  }

  /* Renderização */

  function renderQueue() {
    ui.queueCard.hidden = state.items.length === 0;
    ui.queueCount.textContent = String(state.items.length);
    ui.queueGrid.replaceChildren();

    for (const item of state.items.slice(0, QUEUE_PREVIEW_LIMIT)) {
      const card = document.createElement("div");
      card.className = "queue-item";
      card.title = item.name;

      const thumb = document.createElement("div");
      thumb.className = "queue-thumb";
      thumb.textContent = extensionLabel(item.name);

      const img = document.createElement("img");
      img.alt = item.name;
      img.decoding = "async";
      img.addEventListener("load", () => thumb.replaceChildren(img), {
        once: true,
      });
      img.src = item.previewUrl;

      const name = document.createElement("div");
      name.className = "queue-name";
      name.textContent = item.name;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "queue-remove";
      remove.setAttribute("aria-label", `Remover ${item.name}`);
      remove.disabled = state.processing;
      remove.appendChild(createIcon("M6 6l12 12M18 6L6 18"));
      remove.addEventListener("click", () => removeItem(item.key));

      card.append(thumb, name, remove);
      ui.queueGrid.appendChild(card);
    }

    if (state.items.length > QUEUE_PREVIEW_LIMIT) {
      const more = document.createElement("div");
      more.className = "queue-more";
      more.textContent = `+${state.items.length - QUEUE_PREVIEW_LIMIT}`;
      ui.queueGrid.appendChild(more);
    }
  }

  function buildRow(item) {
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
      thumb.addEventListener("click", () => openDialog(item));
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
    status.className = `status status-${item.status}`;
    status.textContent = item.status === "ok" ? "Concluída" : "Falha";
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
      compare.addEventListener("click", () => openDialog(item));

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

    row.append(nameTd, statusTd, originalTd, finalTd, dimsTd, actionTd);
    return row;
  }

  function renderResults() {
    if (state.results.length < renderedResults) {
      ui.resultsBody.replaceChildren();
      renderedResults = 0;
    }
    for (let i = renderedResults; i < state.results.length; i += 1) {
      ui.resultsBody.appendChild(buildRow(state.results[i]));
    }
    renderedResults = state.results.length;
    ui.resultsBlock.hidden = state.results.length === 0;
    ui.resultsCount.textContent = String(state.results.length);
  }

  function render() {
    const total = state.items.length;
    const okCount = state.results.filter((row) => row.status === "ok").length;

    ui.run.disabled = state.processing || total === 0;
    ui.run.textContent = state.processing
      ? "Processando..."
      : total > 0
        ? `${config.actionLabel} (${total} ${total === 1 ? "imagem" : "imagens"})`
        : config.actionLabel;
    ui.zip.disabled = state.processing || okCount === 0;
    ui.clear.disabled = state.processing;
    ui.clearQueue.disabled = state.processing;

    ui.progress.hidden = !state.processing;
    const { done, total: all } = state.progress;
    ui.progressFill.style.width = all ? `${(done / all) * 100}%` : "0%";
    ui.progressLabel.textContent =
      statusText || `${done} de ${all} processadas`;

    ui.qualityField.hidden = ui.format.value === "png";
    renderResults();
  }

  /* Pré-visualização */

  async function previewSourceFor(item) {
    if (previewCache.key === item.key) {
      return previewCache.source;
    }
    const bitmap = await decodeInput(item.file);
    try {
      previewCache.source = downscale(bitmap);
      previewCache.key = item.key;
    } finally {
      bitmap.close();
    }
    return previewCache.source;
  }

  function refreshPreview() {
    if (!config.preview) {
      return;
    }
    clearTimeout(previewTimer);
    previewTimer = setTimeout(runPreview, PREVIEW_DELAY_MS);
  }

  async function runPreview() {
    const item = state.items[0];
    ui.previewCard.hidden = !item;
    if (!item) {
      return;
    }

    const token = (previewToken += 1);
    try {
      const options = config.readOptions(container);
      const source = await previewSourceFor(item);
      const result = await config.process({
        source,
        blob: item.file,
        name: item.name,
        options,
        preview: true,
      });
      if (token !== previewToken || !(result instanceof HTMLCanvasElement)) {
        return;
      }
      ui.previewCanvas.width = result.width;
      ui.previewCanvas.height = result.height;
      ui.previewCanvas.getContext("2d").drawImage(result, 0, 0);
      ui.previewName.textContent = item.name;
    } catch {
      // Opções incompletas durante a digitação: mantém a última imagem.
    }
  }

  /* Processamento */

  function setStatus(text) {
    statusText = text;
    const { done, total } = state.progress;
    ui.progressLabel.textContent = text || `${done} de ${total} processadas`;
  }

  function uniqueName(base, extension, used) {
    let candidate = `${base}${extension}`;
    let counter = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${counter}${extension}`;
      counter += 1;
    }
    used.add(candidate);
    return candidate;
  }

  async function processItem(item, options, outputFormat, quality) {
    const bitmap = await decodeInput(item.file);
    try {
      const result = await config.process({
        source: bitmap,
        blob: item.file,
        name: item.name,
        options,
        preview: false,
        setStatus,
      });
      const canvas =
        result instanceof Blob ? await blobToCanvas(result) : result;
      const blob = await encodeCanvas(
        canvas,
        outputFormat,
        quality,
        item.file.type,
      );
      return { blob, width: canvas.width, height: canvas.height };
    } finally {
      bitmap.close();
    }
  }

  async function run() {
    let options;
    let quality;
    try {
      options = config.readOptions(container);
      quality = Number.parseInt(ui.quality.value, 10);
      if (!config.forceFormat && !(quality >= 1 && quality <= 100)) {
        throw new Error("A qualidade deve estar entre 1 e 100.");
      }
    } catch (error) {
      ui.error.textContent = error.message;
      return;
    }
    ui.error.textContent = "";

    const outputFormat = config.forceFormat ?? ui.format.value;
    const current = session;
    const queue = [...state.items];
    const usedNames = new Set();

    clearResults();
    state.processing = true;
    state.progress = { done: 0, total: queue.length };
    renderQueue();
    render();

    for (const item of queue) {
      if (current !== session) {
        return;
      }

      const row = {
        name: item.name,
        status: "error",
        originalBytes: item.file.size,
        outputBytes: null,
        width: null,
        height: null,
        outputBlob: null,
        outputUrl: null,
        originalUrl: URL.createObjectURL(item.file),
        downloadName: null,
        format: outputFormat,
        error: null,
      };

      try {
        const output = await processItem(item, options, outputFormat, quality);
        const parsed = item.name.split("/").pop() || item.name;
        const base = slugify(parsed.replace(/\.[^.]+$/u, ""));
        row.downloadName = uniqueName(
          `${base}${config.suffix ?? ""}`,
          extensionForType(output.blob.type),
          usedNames,
        );
        row.outputBlob = output.blob;
        row.outputBytes = output.blob.size;
        row.width = output.width;
        row.height = output.height;
        row.outputUrl = URL.createObjectURL(output.blob);
        row.status = "ok";
      } catch (error) {
        row.error =
          error instanceof Error ? error.message : "Erro desconhecido.";
      }

      if (current !== session) {
        URL.revokeObjectURL(row.originalUrl);
        URL.revokeObjectURL(row.outputUrl);
        return;
      }
      state.results.push(row);
      state.progress.done += 1;
      render();
    }

    state.processing = false;
    statusText = "";
    renderQueue();
    render();
  }

  async function downloadZip() {
    const valid = state.results.filter((row) => row.status === "ok");
    if (!valid.length) {
      return;
    }
    const zip = new JSZip();
    for (const row of valid) {
      zip.file(row.downloadName, row.outputBlob);
    }
    const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `pixelfit-${config.suffix?.replace(/^-/, "") || "imagens"}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function openDialog(row) {
    ui.dialogTitle.textContent = row.name;
    ui.dialogMeta.textContent = `${row.width} × ${row.height} px`;
    ui.dialogBefore.src = row.originalUrl;
    ui.dialogAfter.src = row.outputUrl;
    ui.dialogBeforeCaption.textContent = `Original · ${formatBytes(row.originalBytes)}`;
    ui.dialogAfterCaption.textContent = `Resultado · ${formatBytes(row.outputBytes)}`;
    ui.dialog.showModal();
  }

  /* Eventos */

  ui.pickImages.addEventListener("change", (event) => {
    if (event.target.files?.length) {
      addFiles(event.target.files, "manual");
    }
    event.target.value = "";
  });

  ui.pickFolder.addEventListener("change", (event) => {
    if (event.target.files?.length) {
      addFiles(event.target.files, "folder");
    }
    event.target.value = "";
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
      addFiles(event.dataTransfer.files, "drop");
    }
  });

  ui.toolSettings.addEventListener("input", refreshPreview);
  ui.toolSettings.addEventListener("change", refreshPreview);
  ui.format.addEventListener("change", render);

  ui.run.addEventListener("click", run);
  ui.zip.addEventListener("click", downloadZip);
  ui.clear.addEventListener("click", clearAll);
  ui.clearQueue.addEventListener("click", clearQueue);

  ui.dialogClose.addEventListener("click", () => ui.dialog.close());
  ui.dialog.addEventListener("click", (event) => {
    if (event.target === ui.dialog) {
      ui.dialog.close();
    }
  });

  const releaseUrls = () => {
    clearResults();
    state.items.forEach(revokeItem);
  };
  window.addEventListener("beforeunload", releaseUrls);

  const cleanupTool = config.init?.(container, { refreshPreview });

  render();

  return () => {
    session += 1;
    clearTimeout(previewTimer);
    cleanupTool?.();
    window.removeEventListener("beforeunload", releaseUrls);
    releaseUrls();
  };
}
