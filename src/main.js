import { getTool } from "./tools.js";
import { renderHome } from "./pages/home.js";

const app = document.querySelector("#app");
const BASE_TITLE = "PixelFit";

let cleanup = null;
let navigation = 0;

function pageHeader(tool) {
  const header = document.createElement("section");
  header.className = "page-head";

  const back = document.createElement("a");
  back.className = "back-link";
  back.href = "#/";
  back.textContent = "← Todas as ferramentas";

  const title = document.createElement("h1");
  title.textContent = tool.title;

  const description = document.createElement("p");
  description.textContent = tool.description;

  header.append(back, title, description);
  return header;
}

async function route() {
  const current = (navigation += 1);
  const id = location.hash.replace(/^#\/?/, "");
  const tool = getTool(id);

  cleanup?.();
  cleanup = null;
  window.scrollTo(0, 0);

  if (!tool?.load) {
    document.title = `${BASE_TITLE} | Ferramentas de imagem online`;
    renderHome(app);
    return;
  }

  document.title = `${tool.title} | ${BASE_TITLE}`;
  const body = document.createElement("div");
  body.className = "tool-body";
  app.replaceChildren(pageHeader(tool), body);

  const module = await tool.load();
  if (current !== navigation) {
    return;
  }
  cleanup = module.mount(body);
}

window.addEventListener("hashchange", route);
route();
