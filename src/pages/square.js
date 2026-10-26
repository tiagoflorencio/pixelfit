import { mountBatchTool } from "../lib/batch-tool.js";
import { context2d, createCanvas, PREVIEW_MAX_SIDE } from "../lib/image.js";

const MAX_SIDE = 8000;

const settingsHtml = `
  <label class="field">
    <span>Cor do fundo</span>
    <input id="sq-color" type="color" value="#ffffff" />
  </label>
  <label class="check">
    <input id="sq-transparent" type="checkbox" />
    Fundo transparente (PNG ou WebP)
  </label>

  <div class="range-row">
    <span>Margem interna</span>
    <output id="sq-padding-out">0%</output>
    <input id="sq-padding" type="range" min="0" max="30" value="0" />
  </div>

  <label class="field">
    <span>Lado final (px, opcional)</span>
    <input id="sq-size" type="number" min="100" max="${MAX_SIDE}" placeholder="Maior lado da imagem" />
  </label>
  <small class="hint">
    A imagem inteira é mantida e centralizada em um quadrado 1:1, sem cortes.
    Em JPEG, o fundo transparente vira branco.
  </small>
`;

function readOptions(root) {
  const size = Number.parseInt(root.querySelector("#sq-size").value, 10);
  if (root.querySelector("#sq-size").value && !(size >= 100 && size <= MAX_SIDE)) {
    throw new Error(`O lado final deve ficar entre 100 e ${MAX_SIDE} px.`);
  }
  return {
    color: root.querySelector("#sq-color").value,
    transparent: root.querySelector("#sq-transparent").checked,
    padding: Number.parseInt(root.querySelector("#sq-padding").value, 10) / 100,
    size: size > 0 ? size : null,
  };
}

function process({ source, options, preview }) {
  let side = options.size ?? Math.max(source.width, source.height);
  if (preview) {
    side = Math.min(side, PREVIEW_MAX_SIDE);
  }

  const canvas = createCanvas(side, side);
  const ctx = context2d(canvas);
  if (!options.transparent) {
    ctx.fillStyle = options.color;
    ctx.fillRect(0, 0, side, side);
  }

  const inner = side * (1 - options.padding * 2);
  const scale = inner / Math.max(source.width, source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  ctx.drawImage(
    source,
    Math.round((side - width) / 2),
    Math.round((side - height) / 2),
    width,
    height,
  );
  return canvas;
}

function init(root) {
  const padding = root.querySelector("#sq-padding");
  const output = root.querySelector("#sq-padding-out");
  const color = root.querySelector("#sq-color");
  const transparent = root.querySelector("#sq-transparent");

  const sync = () => {
    output.textContent = `${padding.value}%`;
    color.disabled = transparent.checked;
  };
  padding.addEventListener("input", sync);
  transparent.addEventListener("change", sync);
  sync();
}

export function mount(container) {
  return mountBatchTool(container, {
    settingsHtml,
    actionLabel: "Criar imagens quadradas",
    suffix: "-quadrada",
    preview: true,
    readOptions,
    process,
    init,
  });
}
