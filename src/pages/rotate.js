import { mountBatchTool } from "../lib/batch-tool.js";
import { context2d, createCanvas } from "../lib/image.js";

const settingsHtml = `
  <label class="field">
    <span>Girar</span>
    <select id="rt-angle">
      <option value="0">Não girar</option>
      <option value="90">90° para a direita</option>
      <option value="180">180°</option>
      <option value="270">90° para a esquerda</option>
    </select>
  </label>
  <label class="check">
    <input id="rt-flip-h" type="checkbox" />
    Espelhar na horizontal
  </label>
  <label class="check">
    <input id="rt-flip-v" type="checkbox" />
    Espelhar na vertical
  </label>
  <small class="hint">
    O espelhamento é aplicado primeiro, depois a rotação.
  </small>
`;

function readOptions(root) {
  return {
    angle: Number.parseInt(root.querySelector("#rt-angle").value, 10),
    flipH: root.querySelector("#rt-flip-h").checked,
    flipV: root.querySelector("#rt-flip-v").checked,
  };
}

function process({ source, options }) {
  const swap = options.angle === 90 || options.angle === 270;
  const canvas = createCanvas(
    swap ? source.height : source.width,
    swap ? source.width : source.height,
  );
  const ctx = context2d(canvas);

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((options.angle * Math.PI) / 180);
  ctx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

export function mount(container) {
  return mountBatchTool(container, {
    settingsHtml,
    actionLabel: "Aplicar",
    suffix: "-girada",
    preview: true,
    readOptions,
    process,
  });
}
