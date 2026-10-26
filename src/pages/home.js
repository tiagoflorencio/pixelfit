import { categories, tools } from "../tools.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function createIcon(path) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", path);
  svg.appendChild(p);
  return svg;
}

function createCard(tool) {
  const ready = Boolean(tool.load);
  const card = document.createElement(ready ? "a" : "div");
  card.className = ready ? "tool-card" : "tool-card is-soon";
  if (ready) {
    card.href = `#/${tool.id}`;
  } else {
    card.setAttribute("aria-disabled", "true");
  }

  const icon = document.createElement("div");
  icon.className = "tool-icon";
  icon.style.background = tool.color;
  icon.appendChild(createIcon(tool.icon));

  const title = document.createElement("h3");
  title.textContent = tool.title;

  const description = document.createElement("p");
  description.textContent = tool.description;

  card.append(icon, title, description);

  const badgeText = ready ? tool.badge : "Em breve";
  if (badgeText) {
    const badge = document.createElement("span");
    badge.className = ready ? "tool-badge" : "tool-badge tool-badge-soon";
    badge.textContent = badgeText;
    card.appendChild(badge);
  }
  return card;
}

export function renderHome(root) {
  root.innerHTML = `
    <section class="intro intro-center">
      <h1>Todas as ferramentas de imagem em um só lugar</h1>
      <p>
        Converta, comprima e edite imagens direto no navegador. Rápido, gratuito
        e sem enviar seus arquivos para nenhum servidor.
      </p>
    </section>
    <div class="filters" role="group" aria-label="Categorias"></div>
    <section class="tool-grid"></section>
  `;

  const filters = root.querySelector(".filters");
  const grid = root.querySelector(".tool-grid");
  let active = "todos";

  function renderGrid() {
    const visible = tools.filter(
      (tool) => active === "todos" || tool.categories.includes(active),
    );
    grid.replaceChildren(...visible.map(createCard));
  }

  for (const category of categories) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter";
    button.textContent = category.label;
    button.classList.toggle("is-active", category.id === active);
    button.addEventListener("click", () => {
      active = category.id;
      for (const other of filters.children) {
        other.classList.toggle("is-active", other === button);
      }
      renderGrid();
    });
    filters.appendChild(button);
  }

  renderGrid();
}
