import { mountBatchTool } from "../lib/batch-tool.js";
import { context2d, createCanvas } from "../lib/image.js";

const RATIOS = {
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:4": [3, 4],
  "3:2": [3, 2],
  "2:3": [2, 3],
  "16:9": [16, 9],
  "9:16": [9, 16],
};

const settingsHtml = `
  <label class="field">
    <span>Proporção</span>
    <select id="cr-ratio">
      <option value="1:1">1:1 (quadrada)</option>
      <option value="4:3">4:3 (horizontal)</option>
      <option value="3:4">3:4 (vertical)</option>
      <option value="3:2">3:2 (horizontal)</option>
      <option value="2:3">2:3 (vertical)</option>
      <option value="16:9">16:9 (widescreen)</option>
      <option value="9:16">9:16 (stories)</option>
      <option value="custom">Personalizada</option>
    </select>
  </label>

  <div class="two-cols" id="cr-custom" hidden>
    <label class="field">
      <span>Largura</span>
      <input id="cr-w" type="number" min="1" max="100" value="5" />
    </label>
    <label class="field">
      <span>Altura</span>
      <input id="cr-h" type="number" min="1" max="100" value="4" />
    </label>
  </div>

  <label class="field">
    <span>Área mantida</span>
    <select id="cr-anchor">
      <option value="center">Centro</option>
      <option value="top">Topo</option>
      <option value="bottom">Base</option>
      <option value="left">Esquerda</option>
      <option value="right">Direita</option>
    </select>
  </label>
  <small class="hint">
    O recorte é automático: a maior área possível na proporção escolhida é
    mantida, e o restante é removido.
  </small>
`;

function readOptions(root) {
  const choice = root.querySelector("#cr-ratio").value;
  let ratio = RATIOS[choice];

  if (choice === "custom") {
    const w = Number.parseFloat(root.querySelector("#cr-w").value);
    const h = Number.parseFloat(root.querySelector("#cr-h").value);
    if (!(w > 0 && h > 0)) {
      throw new Error("Informe largura e altura maiores que zero.");
    }
    ratio = [w, h];
  }

  return {
    ratio: ratio[0] / ratio[1],
    anchor: root.querySelector("#cr-anchor").value,
  };
}

function process({ source, options }) {
  const sw = source.width;
  const sh = source.height;

  let cw = sw;
  let ch = sh;
  if (sw / sh > options.ratio) {
    cw = Math.round(sh * options.ratio);
  } else {
    ch = Math.round(sw / options.ratio);
  }
  cw = Math.max(1, Math.min(sw, cw));
  ch = Math.max(1, Math.min(sh, ch));

  const freeX = sw - cw;
  const freeY = sh - ch;
  const sx =
    options.anchor === "left" ? 0 : options.anchor === "right" ? freeX : freeX / 2;
  const sy =
    options.anchor === "top" ? 0 : options.anchor === "bottom" ? freeY : freeY / 2;

  const canvas = createCanvas(cw, ch);
  context2d(canvas).drawImage(
    source,
    Math.round(sx),
    Math.round(sy),
    cw,
    ch,
    0,
    0,
    cw,
    ch,
  );
  return canvas;
}

function init(root) {
  const ratio = root.querySelector("#cr-ratio");
  const custom = root.querySelector("#cr-custom");
  const sync = () => {
    custom.hidden = ratio.value !== "custom";
  };
  ratio.addEventListener("change", sync);
  sync();
}

export function mount(container) {
  return mountBatchTool(container, {
    settingsHtml,
    actionLabel: "Recortar",
    suffix: "-recortada",
    preview: true,
    readOptions,
    process,
    init,
  });
}
