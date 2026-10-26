import { mountBatchTool } from "../lib/batch-tool.js";
import { blobToCanvas, context2d, createCanvas } from "../lib/image.js";

const settingsHtml = `
  <label class="field">
    <span>Novo fundo</span>
    <select id="bg-mode">
      <option value="transparent">Transparente</option>
      <option value="color">Cor sólida</option>
    </select>
  </label>
  <label class="field" id="bg-color-field" hidden>
    <span>Cor do fundo</span>
    <input id="bg-color" type="color" value="#ffffff" />
  </label>
  <div class="notice-box">
    <strong>Antes de começar</strong>
    <p>
      Na primeira vez, o modelo de IA (cerca de 40 MB) é baixado e fica em
      cache no navegador. Suas imagens continuam sendo processadas no seu
      computador e não são enviadas a nenhum servidor.
    </p>
  </div>
`;

function readOptions(root) {
  return {
    mode: root.querySelector("#bg-mode").value,
    color: root.querySelector("#bg-color").value,
  };
}

async function process({ blob, name, options, setStatus }) {
  const { removeBackground } = await import("@imgly/background-removal");

  setStatus(`Preparando o modelo de IA...`);
  const cutout = await removeBackground(blob, {
    model: "isnet_fp16",
    output: { format: "image/png" },
    progress: (key, current, total) => {
      if (key.startsWith("fetch") && total > 0) {
        const percent = Math.round((current / total) * 100);
        setStatus(`Baixando o modelo de IA... ${percent}%`);
      } else {
        setStatus(`Removendo o fundo de ${name}...`);
      }
    },
  });
  setStatus(`Finalizando ${name}...`);

  const subject = await blobToCanvas(cutout);
  if (options.mode === "transparent") {
    return subject;
  }

  const canvas = createCanvas(subject.width, subject.height);
  const ctx = context2d(canvas);
  ctx.fillStyle = options.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(subject, 0, 0);
  return canvas;
}

function init(root) {
  const mode = root.querySelector("#bg-mode");
  const field = root.querySelector("#bg-color-field");
  const sync = () => {
    field.hidden = mode.value !== "color";
  };
  mode.addEventListener("change", sync);
  sync();
}

export function mount(container) {
  return mountBatchTool(container, {
    settingsHtml,
    actionLabel: "Remover fundo",
    suffix: "-sem-fundo",
    defaultFormat: "png",
    readOptions,
    process,
    init,
  });
}
