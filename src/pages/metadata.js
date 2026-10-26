import { mountBatchTool } from "../lib/batch-tool.js";
import { context2d, createCanvas } from "../lib/image.js";

const settingsHtml = `
  <div class="notice-box">
    <strong>O que é removido</strong>
    <p>
      Localização GPS, modelo do celular ou da câmera, data e hora da foto,
      software de edição e demais metadados EXIF/IPTC/XMP. Os pixels da imagem
      não são alterados.
    </p>
  </div>
`;

function process({ source }) {
  const canvas = createCanvas(source.width, source.height);
  context2d(canvas).drawImage(source, 0, 0);
  return canvas;
}

export function mount(container) {
  return mountBatchTool(container, {
    settingsHtml,
    actionLabel: "Remover metadados",
    suffix: "-limpa",
    defaultQuality: 95,
    readOptions: () => ({}),
    process,
  });
}
