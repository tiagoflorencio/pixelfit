import { mountBatchTool } from "../lib/batch-tool.js";
import { context2d, createCanvas, decodeInput } from "../lib/image.js";

const settingsHtml = `
  <label class="field">
    <span>Tipo de marca d'água</span>
    <select id="wm-type">
      <option value="text">Texto</option>
      <option value="logo">Logo (imagem)</option>
    </select>
  </label>

  <div class="settings" id="wm-text-group">
    <label class="field">
      <span>Texto</span>
      <input id="wm-text" type="text" maxlength="80" value="© Minha Marca" />
    </label>
    <label class="field">
      <span>Cor do texto</span>
      <input id="wm-color" type="color" value="#ffffff" />
    </label>
  </div>

  <div class="settings" id="wm-logo-group" hidden>
    <label class="field">
      <span>Arquivo do logo (PNG com fundo transparente é o ideal)</span>
      <input id="wm-logo" type="file" accept="image/*" />
    </label>
    <small class="hint" id="wm-logo-status"></small>
  </div>

  <label class="field">
    <span>Posição</span>
    <select id="wm-position">
      <option value="bottom-right">Inferior direita</option>
      <option value="bottom-center">Inferior central</option>
      <option value="bottom-left">Inferior esquerda</option>
      <option value="center">Centro</option>
      <option value="top-right">Superior direita</option>
      <option value="top-center">Superior central</option>
      <option value="top-left">Superior esquerda</option>
      <option value="tile">Repetir em mosaico</option>
    </select>
  </label>

  <div class="range-row">
    <span>Tamanho</span>
    <output id="wm-size-out">25%</output>
    <input id="wm-size" type="range" min="5" max="80" value="25" />
  </div>

  <div class="range-row">
    <span>Opacidade</span>
    <output id="wm-opacity-out">60%</output>
    <input id="wm-opacity" type="range" min="5" max="100" value="60" />
  </div>
`;

const MEASURE_FONT_PX = 100;

function fontFor(px) {
  return `700 ${px}px system-ui, "Segoe UI", Arial, sans-serif`;
}

function buildMark(options, logo, imageWidth) {
  const targetWidth = imageWidth * (options.size / 100);

  if (options.type === "logo") {
    const scale = targetWidth / logo.width;
    return {
      width: targetWidth,
      height: logo.height * scale,
      paint: (ctx, x, y, w, h) => ctx.drawImage(logo, x, y, w, h),
    };
  }

  const probe = context2d(createCanvas(1, 1));
  probe.font = fontFor(MEASURE_FONT_PX);
  const measured = probe.measureText(options.text).width || 1;
  const fontPx = (MEASURE_FONT_PX * targetWidth) / measured;
  return {
    width: targetWidth,
    height: fontPx * 1.2,
    paint: (ctx, x, y) => {
      ctx.font = fontFor(fontPx);
      ctx.fillStyle = options.color;
      ctx.textBaseline = "top";
      ctx.fillText(options.text, x, y + fontPx * 0.1);
    },
  };
}

function drawTiled(ctx, mark, width, height) {
  const stepX = mark.width * 1.8;
  const stepY = mark.height * 3;
  const diagonal = Math.hypot(width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-30 * Math.PI) / 180);
  let row = 0;
  for (let y = -diagonal / 2; y < diagonal / 2; y += stepY) {
    const offset = row % 2 ? stepX / 2 : 0;
    for (let x = -diagonal / 2 - offset; x < diagonal / 2; x += stepX) {
      mark.paint(ctx, x, y, mark.width, mark.height);
    }
    row += 1;
  }
  ctx.restore();
}

function drawPositioned(ctx, mark, position, width, height) {
  const margin = width * 0.03;
  const [vertical, horizontal] = position === "center" ? ["center", "center"] : position.split("-");

  const x =
    horizontal === "left"
      ? margin
      : horizontal === "right"
        ? width - mark.width - margin
        : (width - mark.width) / 2;
  const y =
    vertical === "top"
      ? margin
      : vertical === "bottom"
        ? height - mark.height - margin
        : (height - mark.height) / 2;

  mark.paint(ctx, x, y, mark.width, mark.height);
}

export function mount(container) {
  let logo = null;

  const readOptions = (root) => {
    const type = root.querySelector("#wm-type").value;
    const text = root.querySelector("#wm-text").value.trim();

    if (type === "text" && !text) {
      throw new Error("Digite o texto da marca d'água.");
    }
    if (type === "logo" && !logo) {
      throw new Error("Selecione o arquivo do logo.");
    }

    return {
      type,
      text,
      color: root.querySelector("#wm-color").value,
      position: root.querySelector("#wm-position").value,
      size: Number.parseInt(root.querySelector("#wm-size").value, 10),
      opacity: Number.parseInt(root.querySelector("#wm-opacity").value, 10) / 100,
    };
  };

  const process = ({ source, options }) => {
    const canvas = createCanvas(source.width, source.height);
    const ctx = context2d(canvas);
    ctx.drawImage(source, 0, 0);

    const mark = buildMark(options, logo, source.width);
    ctx.globalAlpha = options.opacity;
    if (options.position === "tile") {
      drawTiled(ctx, mark, canvas.width, canvas.height);
    } else {
      drawPositioned(ctx, mark, options.position, canvas.width, canvas.height);
    }
    ctx.globalAlpha = 1;
    return canvas;
  };

  const init = (root, api) => {
    const type = root.querySelector("#wm-type");
    const textGroup = root.querySelector("#wm-text-group");
    const logoGroup = root.querySelector("#wm-logo-group");
    const logoInput = root.querySelector("#wm-logo");
    const logoStatus = root.querySelector("#wm-logo-status");
    const size = root.querySelector("#wm-size");
    const opacity = root.querySelector("#wm-opacity");

    const sync = () => {
      textGroup.hidden = type.value !== "text";
      logoGroup.hidden = type.value !== "logo";
      root.querySelector("#wm-size-out").textContent = `${size.value}%`;
      root.querySelector("#wm-opacity-out").textContent = `${opacity.value}%`;
    };

    type.addEventListener("change", sync);
    size.addEventListener("input", sync);
    opacity.addEventListener("input", sync);

    logoInput.addEventListener("change", async () => {
      const file = logoInput.files?.[0];
      if (!file) {
        return;
      }
      try {
        logo?.close();
        logo = await decodeInput(file);
        logoStatus.textContent = `Logo carregado: ${file.name} (${logo.width} × ${logo.height})`;
      } catch (error) {
        logo = null;
        logoStatus.textContent = error.message;
      }
      api.refreshPreview();
    });

    sync();
    return () => logo?.close();
  };

  return mountBatchTool(container, {
    settingsHtml,
    actionLabel: "Aplicar marca d'água",
    suffix: "-marca",
    preview: true,
    readOptions,
    process,
    init,
  });
}
