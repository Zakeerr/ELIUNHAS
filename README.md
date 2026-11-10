# Portfólio — Eliane Reis

Site de uma página para a manicure e nail designer Eliane Reis.
Versão 2: visual refeito seguindo o `regras.md`.

## Como ver o site

Abra `index.html` no navegador (duplo clique funciona — não precisa de servidor).
As bibliotecas ficam dentro do projeto (`js/vendor/` e `css/vendor/`), então o
site não depende de CDN. Só as fontes vêm do Google Fonts; sem internet o
navegador usa uma fonte parecida.

## Celular

Abaixo de 1100px de largura o site usa a largura real da tela, com o **mesmo
desenho do computador**: mesmas cores, fontes, cartões e efeitos, e o nome em
volta do rosto. O que muda é só o que não cabe:

- **Menu:** a mesma barra lateral (marca, itens numerados, botão de agendar)
  abre como gaveta pelo botão *Menu* do topo.
- **Colunas:** Sobre mim, Resultados e Localização ficam empilhados; as etapas
  do atendimento ficam em uma coluna até 599px e em duas a partir daí.
- **Início:** tudo é proporcional à altura da foto (`--photo` no fim do
  `css/style.css`). Em telas em pé, a altura do Início acompanha a foto, então
  a seção seguinte já aparece embaixo.

Para ver no computador, basta estreitar a janela ou usar o modo dispositivo do
navegador (F12 → ícone de celular/tablet).

Versões anteriores: `_backup-v3-celular-miniatura/` (computador encolhido) e
`_backup-v2-celular-adaptado/` (primeiro layout de celular).

## O que tem em cada aba

- **Início:** o nome "Eliane Reis" em escala de capa de revista, com "Eliane"
  à esquerda e "Reis" à direita do rosto na foto `png1.png` (centralizada), e
  os botões *Agendar horário* e *Ver resultados*.
- **Fundo do site inteiro:** ondas animadas (GradientWaves) em tom lilás, fixas
  atrás de todas as seções; no Contato, a versão escura e intensa das ondas.

## Tecnologias (conforme `regras.md`)

| Categoria                    | Tecnologia            | Onde é usada |
|------------------------------|-----------------------|--------------|
| Estrutura                    | HTML5                 | `index.html` (seções semânticas, `<address>`, `<figure>`, diálogo do visualizador) |
| Estilo e responsividade      | CSS3                  | `css/style.css` (variáveis, `clamp()`, grid, `color-mix`, máscaras) |
| Programação e interações     | JavaScript            | `js/app.js` |
| Animações                    | GSAP 3.13             | entrada da foto, cartões, botões, menu |
| Animações ligadas à rolagem  | GSAP ScrollTrigger    | saída da foto, linha das etapas, retrato, troca de tema da barra, seção ativa |
| Texto animado por linhas     | GSAP SplitText        | todos os títulos e parágrafos de destaque, letreiro do rodapé |
| Transições entre estados     | GSAP Flip             | a foto do trabalho "voa" do carrossel até o visualizador e volta |
| Rolagem suave                | Lenis 1.3             | rolagem da página e dos links do menu |
| Carrosséis e sliders         | Swiper 11             | carrossel de Resultados (arrastar, setas, teclado, barra de progresso) |
| Manipulação de elementos     | jQuery 3.7            | eventos e DOM em `js/app.js` |
| Ícones e logotipos           | SVG                   | sprite no topo do `index.html` (marca em forma de unha + ícones) |
| Plataforma de desenvolvimento| Webflow               | ver observação abaixo |

**Webflow:** é uma plataforma hospedada (editor visual + hospedagem). O código
aqui é HTML/CSS/JS puro, sem dependência de build, então pode ser levado para
um projeto Webflow colando o CSS/JS em *Custom Code* e a marcação em *Embeds*.
A publicação no Webflow em si precisa ser feita na conta de vocês.

## Componentes React Bits

Os sete componentes pedidos foram portados de React para JavaScript puro
(o site não usa React). Ficam em `js/components/`, com o CSS original em
`css/components.css`:

- **RotatingText** — "Agende [alongamento em gel / fibra de vidro / …]" no
  Contato. O original usa a biblioteca Motion; aqui as mesmas animações
  são feitas com GSAP.
- **LineSidebar** — navegação lateral no desktop e na gaveta do celular.
- **GradientWaves** — ondas de "esmalte líquido" (WebGL2): fundo fixo do site
  inteiro (modo claro) e versão escura no Contato.
- **SpecularButton** — todos os botões de ação (brilho de gel na borda, WebGL2).
- **SpotlightCard** — etapas do atendimento, fotos do carrossel e cartão do
  endereço.
- **HoloCard** — a foto de Sobre mim vira um cartão holográfico (padrão
  "rainbow"): inclina com o mouse e, ao clicar/tocar, vira e mostra o verso
  (`assets/cartao-verso.jpg`, um cartão de visita com WhatsApp e Instagram).
- **FoldText** — as letras desdobram como papel no nome gigante do Início, no
  título do Contato e no letreiro do rodapé; perto do cursor elas se dobram
  de leve. Esta versão também preserva o itálico (`<em>`) dos títulos.

### Observação sobre o HoloCard

O HoloCard desenha a foto com WebGL, e o navegador **bloqueia** WebGL de ler
imagens de arquivos locais (site aberto por duplo clique, `file://`). Por isso
a foto da frente fica embutida em `js/holo-assets.js` (data-URI). Para trocar a
foto do cartão, gere o arquivo de novo a partir da nova imagem (720×960, JPEG),
por exemplo com Python + Pillow:

```
python -c "from PIL import Image;import io,base64;im=Image.open('assets/sobre.jpg').convert('RGB').resize((720,960));b=io.BytesIO();im.save(b,'JPEG',quality=82);open('js/holo-assets.js','w').write('window.HOLO_ASSETS={sobre:\"data:image/jpeg;base64,'+base64.b64encode(b.getvalue()).decode()+'\"};')"
```

## Estrutura das pastas

```
MAEPRIME/
├── index.html               → a página (marcação + sprite SVG + dados estruturados)
├── css/
│   ├── vendor/              → CSS do Lenis e do Swiper (cópias locais)
│   ├── components.css       → CSS original dos componentes React Bits
│   └── style.css            → identidade visual: cores, fontes, layout, responsivo
├── js/
│   ├── vendor/              → jQuery, GSAP (+ScrollTrigger, SplitText, Flip), Lenis, Swiper
│   ├── components/          → os 7 componentes React Bits em JS puro
│   ├── holo-assets.js       → foto do HoloCard embutida (ver observação acima)
│   └── app.js               → monta tudo: fundo de ondas, Lenis, GSAP, Swiper, menu, visualizador
├── data/structured-data.json→ cópia dos dados estruturados (JSON-LD) do <head>
├── assets/                  → fotos usadas no site (png1.png é a foto do Início)
├── fotos/                   → fotos originais, sem mexer
├── design/                  → arquivos da tela de edição visual (versão 1)
├── _backup-v1/              → index.html, style.css e app.js da versão 1
├── _backup-v2-celular-adaptado/ → primeiro layout próprio de celular
└── _backup-v3-celular-miniatura/ → versão com o computador encolhido no celular
```

## Para editar

- **Texto:** direto no `index.html`.
- **Cores e fontes:** variáveis no topo de `css/style.css` (`--violet`, `--lilac`…).
- **Serviços que giram no Contato:** atributo `data-rotating` no `index.html`.
- **Ondas do fundo (cor, intensidade):** `initBackground()` em `js/app.js` —
  `opacity` controla o quanto aparecem.
- **Cores das ondas do Contato:** `initContact()` em `js/app.js`.
- **Trocar uma foto de resultado:** substitua `assets/r1.jpg` … `r8.jpg`
  (mesmo nome) e ajuste título/descrição do cartão no `index.html`.

## Pendências

- Número da Rua Cruzeiro do Sul (seção Localização) — não foi informado,
  por isso o endereço aparece sem número.
