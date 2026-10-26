import { mountBatchTool } from "../lib/batch-tool.js";
import { context2d, createCanvas } from "../lib/image.js";

const sliders = [
  { id: "brightness", label: "Brilho" },
  { id: "contrast", label: "Contraste" },
  { id: "saturation", label: "Saturação" },
];

const settingsHtml = `
  ${sliders
    .map(
      ({ id, label }) => `
    <div class="range-row">
      <span>${label}</span>
      <output id="aj-${id}-out">0</output>
      <input id="aj-${id}" type="range" min="-100" max="100" value="0" />
    </div>`,
    )
    .join("")}
  <button id="aj-reset" class="link-btn" type="button">Restaurar valores</button>
`;

function readOptions(root) {
  const read = (id) => Number.parseInt(root.querySelector(`#aj-${id}`).value, 10);
  return {
    brightness: read("brightness"),
    contrast: read("contrast"),
    saturation: read("saturation"),
  };
}

function process({ source, options }) {
  const canvas = createCanvas(source.width, source.height);
  const ctx = context2d(canvas);
  ctx.drawImage(source, 0, 0);

  const { brightness, contrast, saturation } = options;
  if (!brightness && !contrast && !saturation) {
    return canvas;
  }

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const offset = brightness * 2.55;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const satFactor = 1 + saturation / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] + offset;
    let g = data[i + 1] + offset;
    let b = data[i + 2] + offset;

    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    b = factor * (b - 128) + 128;

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = gray + (r - gray) * satFactor;
    data[i + 1] = gray + (g - gray) * satFactor;
    data[i + 2] = gray + (b - gray) * satFactor;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function init(root, api) {
  const syncOutputs = () => {
    for (const { id } of sliders) {
      const value = root.querySelector(`#aj-${id}`).value;
      root.querySelector(`#aj-${id}-out`).textContent =
        value > 0 ? `+${value}` : value;
    }
  };

  for (const { id } of sliders) {
    root.querySelector(`#aj-${id}`).addEventListener("input", syncOutputs);
  }
  root.querySelector("#aj-reset").addEventListener("click", () => {
    for (const { id } of sliders) {
      root.querySelector(`#aj-${id}`).value = "0";
    }
    syncOutputs();
    api.refreshPreview();
  });
  syncOutputs();
}

export function mount(container) {
  return mountBatchTool(container, {
    settingsHtml,
    actionLabel: "Aplicar ajustes",
    suffix: "-ajustada",
    preview: true,
    readOptions,
    process,
    init,
  });
}
