export const PREVIEW_MAX_SIDE = 900;

const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function extensionForType(type) {
  return EXTENSIONS[type] ?? ".png";
}

function isHeic(blob) {
  return (
    /^image\/hei[cf]/i.test(blob.type) || /\.hei[cf]$/i.test(blob.name ?? "")
  );
}

// Fotos de iPhone (HEIC/HEIF) não são decodificadas pelos navegadores.
async function convertHeic(blob) {
  try {
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({
      blob,
      toType: "image/jpeg",
      quality: 0.95,
    });
    return Array.isArray(result) ? result[0] : result;
  } catch {
    throw new Error("Não foi possível ler este arquivo HEIC.");
  }
}

export async function decodeInput(blob) {
  const source = isHeic(blob) ? await convertHeic(blob) : blob;
  try {
    return await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Formato de imagem não suportado ou arquivo corrompido.");
  }
}

export function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function context2d(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Falha ao inicializar o canvas.");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

export function downscale(source, maxSide = PREVIEW_MAX_SIDE) {
  const ratio = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = createCanvas(source.width * ratio, source.height * ratio);
  context2d(canvas).drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function blobToCanvas(blob) {
  const bitmap = await decodeInput(blob);
  try {
    const canvas = createCanvas(bitmap.width, bitmap.height);
    context2d(canvas).drawImage(bitmap, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

function resolveMime(format, inputType) {
  const requested = format === "original" ? inputType : `image/${format}`;
  return ["image/jpeg", "image/png", "image/webp"].includes(requested)
    ? requested
    : "image/png";
}

// O canvas descarta metadados (EXIF/GPS) ao codificar a imagem.
export async function encodeCanvas(canvas, format, quality, inputType) {
  const mime = resolveMime(format, inputType);
  let target = canvas;

  if (mime === "image/jpeg") {
    target = createCanvas(canvas.width, canvas.height);
    const ctx = context2d(target);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(canvas, 0, 0);
  }

  return new Promise((resolve, reject) => {
    target.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Falha ao gerar a imagem de saída.")),
      mime,
      quality / 100,
    );
  });
}
