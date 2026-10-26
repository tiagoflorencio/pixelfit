export const categories = [
  { id: "todos", label: "Todos" },
  { id: "otimizar", label: "Otimizar" },
  { id: "criar", label: "Criar" },
  { id: "editar", label: "Editar" },
  { id: "converter", label: "Converter" },
  { id: "seguranca", label: "Segurança" },
];

// Ferramentas com `load` já têm tela; as demais aparecem como "Em breve".
export const tools = [
  {
    id: "converter",
    title: "Converter e comprimir",
    description:
      "Converta em lote para WebP, AVIF, JPEG, PNG ou SVG e comprima até o tamanho que você precisar.",
    categories: ["otimizar", "converter"],
    color: "#4f46e5",
    icon: "M4 7h13l-3-3M20 17H7l3 3",
    load: () => import("./pages/converter.js"),
  },
  {
    id: "redimensionar",
    title: "Redimensionar imagem",
    description:
      "Defina largura e altura exatas em pixels ou porcentagem, mantendo a proporção se quiser.",
    categories: ["otimizar", "editar"],
    color: "#0ea5e9",
    icon: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
    load: () => import("./pages/resize.js"),
  },
  {
    id: "recortar",
    title: "Recortar imagem",
    description:
      "Recorte com proporção fixa (1:1, 4:3, 16:9), ideal para fotos de produto.",
    categories: ["editar"],
    color: "#14b8a6",
    icon: "M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14",
    load: () => import("./pages/crop.js"),
  },
  {
    id: "quadrado",
    title: "Imagem quadrada",
    description:
      "Complete a imagem com fundo branco ou colorido até ficar 1:1, sem cortar o produto.",
    categories: ["editar", "criar"],
    color: "#f59e0b",
    icon: "M4 4h16v16H4zM9 9h6v6H9z",
    load: () => import("./pages/square.js"),
  },
  {
    id: "marca-dagua",
    title: "Marca d'água",
    description:
      "Aplique texto ou logo sobre as imagens com posição, opacidade e tamanho ajustáveis.",
    categories: ["criar", "seguranca"],
    color: "#2563eb",
    icon: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
    load: () => import("./pages/watermark.js"),
  },
  {
    id: "girar",
    title: "Girar e espelhar",
    description: "Gire a imagem em 90° ou espelhe na horizontal e na vertical.",
    categories: ["editar"],
    color: "#8b5cf6",
    icon: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
    load: () => import("./pages/rotate.js"),
  },
  {
    id: "metadados",
    title: "Remover metadados",
    description:
      "Apague localização GPS, modelo da câmera e outros dados ocultos antes de compartilhar uma foto.",
    categories: ["seguranca"],
    color: "#0f766e",
    icon: "M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5zM9 12l2 2 4-4",
    load: () => import("./pages/metadata.js"),
  },
  {
    id: "remover-fundo",
    title: "Remover fundo",
    description:
      "Apague o fundo com inteligência artificial, direto no navegador e sem enviar nada.",
    categories: ["editar", "criar"],
    color: "#16a34a",
    icon: "M19 20H8.5l-4.2-4.2a1 1 0 0 1 0-1.4l9.1-9.1a1 1 0 0 1 1.4 0l5.2 5.2a1 1 0 0 1 0 1.4L12 20",
    badge: "Novo",
    load: () => import("./pages/remove-bg.js"),
  },
  {
    id: "ajustes",
    title: "Ajustes de imagem",
    description:
      "Controle brilho, contraste e saturação com pré-visualização ao vivo.",
    categories: ["editar"],
    color: "#db2777",
    icon: "M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
    load: () => import("./pages/adjust.js"),
  },
];

export function getTool(id) {
  return tools.find((tool) => tool.id === id);
}
