<div align="center">

<img src="public/favicon.svg" alt="Logo do PixelFit" width="96" height="96" />

# PixelFit

**Ferramentas para imagens que rodam 100% no navegador.**
Converta, comprima, redimensione, recorte, aplique marca d'água, remova o fundo e muito mais, sem enviar nenhum arquivo para servidores.

[![Demo online](https://img.shields.io/badge/🚀_Demo_online-pixelfit.tiagojesus.dev.br-4f46e5?style=for-the-badge)](https://pixelfit.tiagojesus.dev.br)

![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![Privacidade](https://img.shields.io/badge/🔒_Processamento-local-16a34a?style=flat)

</div>

---

## ✨ Ferramentas

| | Ferramenta | O que faz |
|---|---|---|
| 🔄 | **Converter e comprimir** | Conversão em lote para WebP, AVIF, JPEG, PNG e SVG (vetorização), com limite de tamanho em KB, dimensão máxima e predefinições (Marketplace, Web, Redes sociais, E-mail). Aceita arquivos, pastas ou planilha CSV/XLSX com URLs. |
| 📐 | **Redimensionar** | Largura e altura exatas em pixels ou porcentagem, com opção de manter a proporção e de não ampliar. |
| ✂️ | **Recortar** | Recorte automático em proporção fixa (1:1, 4:3, 3:4, 3:2, 2:3, 16:9, 9:16 ou personalizada), com escolha da área mantida. |
| ⬜ | **Imagem quadrada** | Completa a imagem até 1:1 com cor de fundo ou transparência, sem cortar. |
| 💧 | **Marca d'água** | Texto ou logo, em 7 posições ou mosaico, com tamanho e opacidade. |
| 🔃 | **Girar e espelhar** | Rotação de 90°, 180° e 270° e espelhamento horizontal e vertical. |
| 🛡️ | **Remover metadados** | Apaga GPS, modelo da câmera e outros dados EXIF/IPTC/XMP. |
| 🪄 | **Remover fundo** | Remoção de fundo com IA ([`@imgly/background-removal`](https://github.com/imgly/background-removal-js)), com fundo transparente ou cor sólida. |
| 🎨 | **Ajustes de imagem** | Brilho, contraste e saturação com pré-visualização ao vivo. |

### 🧩 Em todas as ferramentas

- 📂 Arraste e solte, seleção de imagens ou de pastas inteiras
- 📱 Fotos de iPhone (HEIC/HEIF) aceitas e convertidas automaticamente
- 🖼️ Miniaturas, comparação antes e depois, download individual e em massa (`.zip`)
- 🔒 Metadados (GPS, dados da câmera) removidos das imagens geradas
- 🌗 Tema claro e escuro automático

---

## 🚀 Como rodar

```bash
git clone https://github.com/tiagoflorencio/pixelfit.git
cd pixelfit
npm install
npm run dev
```

📦 Build de produção: `npm run build` (saída em `dist/`). Para testar o build localmente: `npm run preview`.

---

## 📝 Observações

- 🤖 A primeira remoção de fundo baixa o modelo de IA (cerca de 40 MB) de uma CDN da biblioteca; depois ele fica em cache no navegador. As imagens continuam sendo processadas localmente.
- 🌐 AVIF e WebP dependem do suporte do navegador; formatos indisponíveis ficam desativados no conversor.
- 🖋️ SVG é gerado por vetorização: funciona melhor em logos e ilustrações do que em fotos.
- 🔗 Em planilhas com URLs, o servidor das imagens precisa permitir acesso (CORS).
- 📱 Em arquivos HEIC, a miniatura e a comparação com o original não são exibidas, pois o navegador não renderiza esse formato.

---

## 🗂️ Estrutura

```
index.html             Estrutura base (cabeçalho, rodapé e área das telas)
style.css              Estilos e tema claro/escuro
src/main.js            Roteador por hash (#/ferramenta)
src/tools.js           Catálogo de ferramentas e categorias da tela inicial
src/pages/             Tela inicial e uma tela por ferramenta
src/lib/batch-tool.js  Estrutura comum das ferramentas em lote (fila, pré-visualização, resultado, ZIP)
src/lib/image.js       Decodificação (incluindo HEIC), canvas e codificação
```

➕ Para adicionar uma ferramenta: crie a tela em `src/pages/` usando `mountBatchTool` e registre-a em `src/tools.js` com a propriedade `load`.

---

## 🛠️ Stack

| Uso | Tecnologia |
|---|---|
| Build e dev server | [Vite](https://vitejs.dev) |
| Interface | JavaScript (ES modules), HTML e CSS puros |
| Processamento de imagem | Canvas API |
| Remoção de fundo | [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) |
| Vetorização (SVG) | [ImageTracer](https://github.com/jankovicsandras/imagetracerjs) |
| Fotos de iPhone | [heic2any](https://github.com/alexcorvi/heic2any) |
| Planilhas | [SheetJS](https://sheetjs.com) |
| Arquivos `.zip` | [JSZip](https://stuk.github.io/jszip/) |
| Hospedagem | [Vercel](https://vercel.com) |

---

<div align="center">

Feito  por [Tiago Jesus](https://www.tiagojesus.dev.br)

</div>
