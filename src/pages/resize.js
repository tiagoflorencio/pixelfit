import { mountBatchTool } from "../lib/batch-tool.js";
import { context2d, createCanvas } from "../lib/image.js";

const MAX_SIDE = 16000;

const settingsHtml = `
  <label class="field">
    <span>Redimensionar por</span>
    <select id="rs-mode">
      <option value="px">Pixels</option>
      <option value="percent">Porcentagem</option>
    </select>
  </label>

  <div class="settings" id="rs-px">
    <div class="two-cols">
      <label class="field">
        <span>Largura (px)</span>
        <input id="rs-width" type="number" min="1" max="${MAX_SIDE}" placeholder="Automática" />
      </label>
      <label class="field">
        <span>Altura (px)</span>
        <input id="rs-height" type="number" min="1" max="${MAX_SIDE}" placeholder="Automática" />
      </label>
    </div>
    <label class="check">
      <input id="rs-ratio" type="checkbox" checked />
      Manter a proporção
    </label>
    <small class="hint" id="rs-hint"></small>
  </div>

  <div class="settings" id="rs-percent" hidden>
    <label class="field">
      <span>Escala (%)</span>
      <input id="rs-scale" type="number" min="1" max="500" value="50" />
    </label>
  </div>

  <label class="check">
    <input id="rs-noupscale" type="checkbox" />
    Não ampliar imagens menores que o alvo
  </label>
`;

function readOptions(root) {
  const mode = root.querySelector("#rs-mode").value;
  const noUpscale = root.querySelector("#rs-noupscale").checked;

  if (mode === "percent") {
    const percent = Number.parseFloat(root.querySelector("#rs-scale").value);
    if (!(percent >= 1 && percent <= 500)) {
      throw new Error("Informe uma escala entre 1% e 500%.");
    }
    return { mode, percent, noUpscale };
  }

  const width = Number.parseInt(root.querySelector("#rs-width").value, 10);
  const height = Number.parseInt(root.querySelector("#rs-height").value, 10);
  const keepRatio = root.querySelector("#rs-ratio").checked;
  const hasWidth = width > 0;
  const hasHeight = height > 0;

  if (!hasWidth && !hasHeight) {
    throw new Error("Informe a largura, a altura ou as duas.");
  }
  if (!keepRatio && !(hasWidth && hasHeight)) {
    throw new Error(
      "Sem manter a proporção, informe largura e altura.",
    );
  }
  if (width > MAX_SIDE || height > MAX_SIDE) {
    throw new Error(`O valor máximo é ${MAX_SIDE} px.`);
  }
  return {
    mode,
    width: hasWidth ? width : null,
    height: hasHeight ? height : null,
    keepRatio,
    noUpscale,
  };
}

function targetSize(source, options) {
  const sw = source.width;
  const sh = source.height;
  let scaleX;
  let scaleY;

  if (options.mode === "percent") {
    scaleX = options.percent / 100;
    scaleY = scaleX;
  } else if (options.keepRatio) {
    const byWidth = options.width ? options.width / sw : Infinity;
    const byHeight = options.height ? options.height / sh : Infinity;
    scaleX = Math.min(byWidth, byHeight);
    scaleY = scaleX;
  } else {
    scaleX = options.width / sw;
    scaleY = options.height / sh;
  }

  if (options.noUpscale) {
    scaleX = Math.min(1, scaleX);
    scaleY = Math.min(1, scaleY);
  }

  return {
    width: Math.min(MAX_SIDE, Math.max(1, Math.round(sw * scaleX))),
    height: Math.min(MAX_SIDE, Math.max(1, Math.round(sh * scaleY))),
  };
}

function process({ source, options }) {
  const { width, height } = targetSize(source, options);
  const canvas = createCanvas(width, height);
  context2d(canvas).drawImage(source, 0, 0, width, height);
  return canvas;
}

function init(root) {
  const mode = root.querySelector("#rs-mode");
  const px = root.querySelector("#rs-px");
  const percent = root.querySelector("#rs-percent");
  const ratio = root.querySelector("#rs-ratio");
  const hint = root.querySelector("#rs-hint");

  const sync = () => {
    px.hidden = mode.value !== "px";
    percent.hidden = mode.value !== "percent";
    hint.textContent = ratio.checked
      ? "Preencha apenas um dos lados para calcular o outro automaticamente."
      : "A imagem será esticada para a largura e a altura informadas.";
  };

  mode.addEventListener("change", sync);
  ratio.addEventListener("change", sync);
  sync();
}

export function mount(container) {
  return mountBatchTool(container, {
    settingsHtml,
    actionLabel: "Redimensionar",
    suffix: "-redimensionada",
    readOptions,
    process,
    init,
  });
}
