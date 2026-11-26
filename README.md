# D'um Ponto às Linhas

Crônicas e contos de Eimlich, em português, inglês e francês. O site é estático: os textos são arquivos Markdown e, a cada envio para a branch `main`, uma GitHub Action monta o site e publica no GitHub Pages: primeiro em `https://exverbisomnia.github.io/Eimlich/` e, quando o domínio estiver configurado, em `https://eimlich.com/`. Tudo gratuito, sem servidor e sem serviços de terceiros; até as fontes são servidas pelo próprio site.

## Como publicar um texto

**Pelo navegador (sem instalar nada)**

1. No repositório, abra `textos/pt/` (ou `textos/en/`, `textos/fr/`) e clique em **Add file → Upload files** (ou **Create new file**).
2. Envie um arquivo `.md` com o nome `AAAA-MM-DD-titulo.md`, por exemplo `2027-01-15-a-feira.md`.
3. Clique em **Commit changes**. Em um ou dois minutos o texto está no ar.

**Pelo computador**

```bash
npm install
npm run novo -- cronica pt "A feira"   # cria textos/pt/AAAA-MM-DD-a-feira.md como rascunho
npm run dev                             # monta e abre em http://localhost:4173/
git add textos && git commit -m "Nova crônica" && git push
```

## Formato de um texto

```markdown
---
titulo: "A feira"
tipo: cronica
lugar: Évora
resumo: "Uma frase que aparece na lista."
---

Primeiro parágrafo. Uma nota se chama assim.[^1]

> Uma citação.

[^1]: E se define assim, em qualquer lugar do arquivo.
```

| Campo | Obrigatório | Para que serve |
|---|---|---|
| `titulo` | sim | Título do texto |
| `tipo` | não | `cronica` (padrão) ou `conto`; o conto ganha capitular e minutos de leitura |
| `data` | não | `AAAA-MM-DD`; se faltar, vem do nome do arquivo |
| `lugar` | não | Aparece como "Évora, nov 2026"; recomendado nas crônicas |
| `epigrafe` | não | Frase em itálico sob o título |
| `epigrafe_autor` | não | Autor da epígrafe |
| `acento` | não | Cor do texto, como `#c0392b` (o ponto do topo, o fio e a capitular) |
| `resumo` | não | Linha na lista de textos e no feed |
| `traducao` | não | Mesma palavra-chave nas versões pt, en e fr de um texto, para ligá-las |
| `rascunho` | não | `true` deixa o texto fora do site |
| `slug` | não | Troca o endereço gerado a partir do nome do arquivo |

**Traduções.** Ponha cada versão na pasta da sua língua e dê a todas o mesmo `traducao`, por exemplo `traducao: ira`. O texto passa a mostrar "Também em English · Français", e o seletor de língua no topo leva direto à versão certa.

**Imagens** vão em `media/` e são citadas como `![legenda](media/figura.jpg)`.

**Páginas fixas** (como "Sobre") ficam em `paginas/<língua>/`. Se uma página ainda não tiver tradução, o site mostra a versão em português com um aviso.

Se um texto tiver um erro (título faltando, data inválida, tipo ou cor errados, nota citada sem definição), a publicação para e o site continua na versão anterior. O motivo aparece na aba **Actions** do repositório, em português.

## Antes de abrir ao público

Três arquivos são provisórios e estão marcados como **exemplo** no site:

- `textos/pt/2026-11-26-ira.md`: troque pelo texto real de "Ira" e apague a linha `exemplo: true`.
- `textos/pt/2026-11-20-cronica-de-exemplo.md`: apague quando a primeira crônica entrar.
- `paginas/pt/sobre.md`: escreva o parágrafo de apresentação.

Título, autor, línguas e domínio ficam em `site.config.json`.

## Configuração inicial (uma vez)

**GitHub**

1. O repositório precisa ser **público** (o Pages gratuito só publica repositórios públicos).
2. Em **Settings → Pages → Build and deployment**, escolha **Source: GitHub Actions**.
3. Envie qualquer alteração para `main`, ou rode a Action **Publicar blog** pela aba **Actions**.

**Domínio `eimlich.com`** (depois de comprado)

1. Em `site.config.json`, troque `"domain": ""` por `"domain": "eimlich.com"` e envie. O build passa a usar `https://eimlich.com/` nos links do feed e da página de erro.
2. No painel de DNS de `eimlich.com` (no registrador, ou no Cloudflare se o domínio for para lá):
   - Quatro registros `A` no nome `@` (raiz), um para cada endereço do GitHub Pages: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - Opcional, para IPv6: quatro registros `AAAA` no `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
   - Um `CNAME` no nome `www` apontando para `exverbisomnia.github.io`, para `www.eimlich.com` também funcionar.
   - Se o DNS estiver no Cloudflare, deixe todos como **DNS only** (nuvem cinza).
   - Um domínio raiz não aceita `CNAME` no `@`; por isso os registros `A`. Alguns registradores oferecem `ALIAS` ou `ANAME` para `exverbisomnia.github.io`, que também serve.
3. No GitHub, em **Settings → Pages → Custom domain**, escreva `eimlich.com` e clique em **Save**. Espere o "DNS check successful".
4. Quando o certificado sair (minutos a algumas horas), marque **Enforce HTTPS**.

A nuvem fica cinza porque o GitHub precisa enxergar o próprio servidor para emitir o certificado. Depois que o HTTPS estiver ativo, dá para ligar o proxy do Cloudflare, com SSL em **Full**.

Com publicação por Actions, o GitHub ignora o arquivo `CNAME` do site; o que vale é o passo 3. O build gera o `CNAME` mesmo assim, por garantia.

## Licenças

O repositório tem duas licenças, porque texto e código têm usos diferentes:

- **Textos** (`textos/`, `paginas/`, `media/`): [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/), em nome de Eimlich. Qualquer um pode copiar e compartilhar com crédito, mas não pode usar comercialmente nem publicar versões modificadas ou traduzidas. Texto em `LICENSE-CONTENT`.
- **Código** (o resto): MIT, em nome de Eimlich. Qualquer um pode reaproveitar o blog como modelo. Texto em `LICENSE`.
- **Fonte EB Garamond**: mantém a própria licença, SIL OFL 1.1 (`src/fonts/OFL-EB-Garamond.txt`).

O rodapé do site mostra "© Eimlich · Textos sob CC BY-NC-ND 4.0" na língua de quem lê, e o feed leva a mesma informação.

## Como funciona

```
textos/<língua>/*.md ──┐
paginas/<língua>/*.md ─┼─ scripts/build.mjs ─→ dist/ ─→ GitHub Pages
src/ ──────────────────┘   (Markdown → JSON,          (index.html, app.js, style.css,
                            feed Atom, validação)       data/, feed.xml, fonts/, CNAME)
```

- `src/` é o aplicativo de página única: HTML, CSS e JavaScript puros, sem framework. As rotas usam `#/` (`#/pt`, `#/pt/cronicas`, `#/en/t/ira`), o que funciona no Pages sem configurar servidor.
- O Markdown é convertido no build (biblioteca `marked`), então o navegador só recebe HTML pronto.
- `feed.xml` é um feed Atom, com as três línguas.
- A fonte é EB Garamond (licença SIL OFL), em `src/fonts/`.
- O tema é escuro; "Tema claro", no rodapé, troca para papel e fica salvo no navegador.
- A animação de entrada respeita a preferência do sistema por menos movimento.
