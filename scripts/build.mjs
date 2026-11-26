// Build for "D'um Ponto às Linhas": turns textos/<lang>/*.md and paginas/<lang>/*.md
// into JSON the SPA reads, copies the static app to dist/, writes an Atom feed and,
// when a custom domain is set, a CNAME file. One dependency: marked.
// Fails loudly (exit 1) on a malformed text, so a bad upload never reaches the live
// site: the GitHub Action stops and the previous version stays online.

import { readFile, writeFile, mkdir, readdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const TIPOS = ['conto', 'cronica'];
const DEFAULT_ACCENT = '#c0392b';
const WPM = 200; // literary reading pace

const errors = [];
const warnings = [];

// ---------- front matter (minimal YAML subset) ----------

function parseScalar(raw) {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.startsWith('[') && v.endsWith(']')) return v.slice(1, -1).split(',').map(parseScalar).filter((s) => s !== '');
  return v;
}

export function parseFrontMatter(src, file) {
  const text = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) return { data: {}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end === -1) {
    errors.push(`${file}: o cabeçalho começa com --- mas não fecha com outra linha ---`);
    return { data: {}, body: text };
  }
  const head = text.slice(4, end).split('\n');
  const body = text.slice(text.indexOf('\n', end + 1) + 1);
  const data = {};
  let listKey = null;
  head.forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) { data[listKey].push(parseScalar(item[1])); return; }
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) { errors.push(`${file}: linha ${i + 2} do cabeçalho não entendida: "${line}"`); return; }
    const [, key, value] = kv;
    if (value.trim() === '') { data[key] = []; listKey = key; } else { data[key] = parseScalar(value); listKey = null; }
  });
  return { data, body };
}

// ---------- footnotes ([^id] … [^id]: text) ----------

export function extractFootnotes(md, file) {
  const defs = new Map();
  const kept = [];
  let fence = null;
  let current = null;
  for (const line of md.split('\n')) {
    const f = /^\s*(```+|~~~+)/.exec(line);
    if (f) { fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0]; current = null; kept.push(line); continue; }
    if (fence) { kept.push(line); continue; }
    const def = /^\[\^([^\]\s]+)\]:\s?(.*)$/.exec(line);
    if (def) {
      current = def[1];
      if (defs.has(current)) errors.push(`${file}: nota [^${current}] definida duas vezes`);
      defs.set(current, [def[2]]);
      continue;
    }
    if (current && /^( {2,}|\t)\S/.test(line)) { defs.get(current).push(line.trim()); continue; }
    current = null;
    kept.push(line);
  }
  const order = [];
  const seen = new Map();
  fence = null;
  const body = kept.map((line) => {
    const f = /^\s*(```+|~~~+)/.exec(line);
    if (f) { fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0]; return line; }
    if (fence) return line;
    // leave inline code spans (`…`) untouched, so `[^nome]` can be shown literally
    return line.split(/(`+[^`]*`+)/).map((part, i) => (i % 2 ? part : part.replace(/\[\^([^\]\s]+)\]/g, (m, id) => {
      if (!defs.has(id)) { errors.push(`${file}: a nota [^${id}] é citada no texto mas não tem definição`); return m; }
      if (!seen.has(id)) { order.push(id); seen.set(id, 0); }
      const n = order.indexOf(id) + 1;
      const k = seen.get(id) + 1;
      seen.set(id, k);
      const refId = k === 1 ? `fnref-${n}` : `fnref-${n}-${k}`;
      return `<sup class="fnref"><a href="#fn-${n}" id="${refId}" aria-label="${n}">${n}</a></sup>`;
    }))).join('');
  }).join('\n');
  for (const id of defs.keys()) if (!seen.has(id)) warnings.push(`${file}: a nota [^${id}] foi definida mas nunca citada`);
  return { body, notes: order.map((id) => defs.get(id).join(' ')) };
}

// ---------- markdown → html ----------

const marked = new Marked({ gfm: true, breaks: false });

function slugify(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function addHeadingIds(html) {
  const used = new Set();
  return html.replace(/<h([234])>([\s\S]*?)<\/h\1>/g, (m, level, inner) => {
    let id = 's-' + (slugify(inner) || 'secao');
    let k = 2;
    while (used.has(id)) id = `${id.replace(/-\d+$/, '')}-${k++}`;
    used.add(id);
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
}

function render(md, file) {
  const { body, notes } = extractFootnotes(md, file);
  let html = addHeadingIds(marked.parse(body));
  if (notes.length) {
    html += '\n<section class="notas"><hr><ol>'
      + notes.map((t, i) => `<li id="fn-${i + 1}">${marked.parseInline(t)} <a href="#fnref-${i + 1}" class="fnback" aria-label="↩ ${i + 1}">↩</a></li>`).join('')
      + '</ol></section>';
  }
  return html;
}

const words = (md) => md.replace(/```[\s\S]*?```/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

// ---------- collections ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (d) => DATE_RE.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const str = (v) => (v === undefined || v === null || Array.isArray(v) ? '' : String(v).trim());

async function mdFiles(dir) {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
}

async function loadTexts(langs) {
  const all = [];
  for (const dir of existsSync(path.join(ROOT, 'textos')) ? await readdir(path.join(ROOT, 'textos')) : []) {
    if (dir.startsWith('.')) continue;
    if (!langs.includes(dir)) { errors.push(`textos/${dir}/: idioma não previsto; use uma destas pastas: ${langs.join(', ')}`); continue; }
  }
  for (const lang of langs) {
    for (const name of await mdFiles(path.join(ROOT, 'textos', lang))) {
      const file = `textos/${lang}/${name}`;
      const { data, body } = parseFrontMatter(await readFile(path.join(ROOT, 'textos', lang, name), 'utf8'), file);
      if (data.rascunho === true) { warnings.push(`${file}: rascunho, não publicado`); continue; }
      const fromName = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/.exec(name);
      const slug = slugify(str(data.slug) || (fromName ? fromName[2] : name.replace(/\.md$/, '')));
      const date = str(data.data) || (fromName ? fromName[1] : '');
      const titulo = str(data.titulo);
      let tipo = str(data.tipo).toLowerCase().replace('crônica', 'cronica');
      let acento = str(data.acento) || DEFAULT_ACCENT;

      if (!titulo) errors.push(`${file}: falta o título (titulo:)`);
      if (!validDate(date)) errors.push(`${file}: data ausente ou inválida; use data: AAAA-MM-DD ou nomeie o arquivo AAAA-MM-DD-titulo.md`);
      if (!tipo) { warnings.push(`${file}: sem tipo; tratado como crônica (use tipo: conto ou tipo: cronica)`); tipo = 'cronica'; }
      if (!TIPOS.includes(tipo)) errors.push(`${file}: tipo "${tipo}" não existe; use conto ou cronica`);
      if (!/^#[0-9a-f]{6}$/i.test(acento)) { errors.push(`${file}: acento "${acento}" inválido; use uma cor como #c0392b`); acento = DEFAULT_ACCENT; }
      if (tipo === 'cronica' && !str(data.lugar)) warnings.push(`${file}: crônica sem lugar (lugar: Évora)`);
      if (!slug) errors.push(`${file}: não consegui gerar o endereço (slug) do texto`);

      all.push({
        lang, slug, tipo, date,
        titulo,
        lugar: str(data.lugar),
        epigrafe: str(data.epigrafe),
        epigrafeAutor: str(data.epigrafe_autor),
        resumo: str(data.resumo),
        acento,
        traducao: slugify(str(data.traducao)) || undefined,
        exemplo: data.exemplo === true || undefined,
        minutos: Math.max(1, Math.round(words(body) / WPM)),
        html: render(body, file),
      });
    }
  }
  // per language: unique slugs, unique translation keys; newest first
  for (const lang of langs) {
    const mine = all.filter((t) => t.lang === lang);
    const dup = (k) => [...new Set(mine.map((t) => t[k]).filter((v, i, a) => v && a.indexOf(v) !== i))];
    for (const s of dup('slug')) errors.push(`textos/${lang}/: dois textos com o mesmo endereço "${s}"`);
    for (const s of dup('traducao')) errors.push(`textos/${lang}/: dois textos com a mesma chave de tradução "${s}"`);
  }
  all.sort((a, b) => b.date.localeCompare(a.date) || a.titulo.localeCompare(b.titulo));
  // translations and previous/next (chronological, same language)
  for (const t of all) {
    if (t.traducao) {
      t.traducoes = all.filter((o) => o !== t && o.traducao === t.traducao).map((o) => ({ lang: o.lang, slug: o.slug, titulo: o.titulo }));
    }
    const mine = all.filter((o) => o.lang === t.lang);
    const i = mine.indexOf(t);
    const pick = (o) => (o ? { slug: o.slug, titulo: o.titulo } : undefined);
    t.anterior = pick(mine[i + 1]); // older
    t.proximo = pick(mine[i - 1]); // newer
  }
  return all;
}

async function loadPages(langs) {
  const pages = [];
  for (const lang of langs) {
    for (const name of await mdFiles(path.join(ROOT, 'paginas', lang))) {
      const file = `paginas/${lang}/${name}`;
      const { data, body } = parseFrontMatter(await readFile(path.join(ROOT, 'paginas', lang, name), 'utf8'), file);
      if (data.rascunho === true) continue;
      const titulo = str(data.titulo);
      if (!titulo) errors.push(`${file}: falta o título (titulo:)`);
      pages.push({ lang, slug: slugify(name.replace(/\.md$/, '')), titulo, exemplo: data.exemplo === true || undefined, html: render(body, file) });
    }
  }
  return pages;
}

// ---------- feed ----------

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function atom(site, texts) {
  const base = site.url || './';
  const updated = texts[0] ? `${texts[0].date}T12:00:00Z` : new Date().toISOString();
  const entries = texts.slice(0, 40).map((t) => `  <entry xml:lang="${t.lang}">
    <title>${xml(t.titulo)}</title>
    <link href="${xml(base)}#/${t.lang}/t/${xml(t.slug)}"/>
    <id>${xml(base)}#/${t.lang}/t/${xml(t.slug)}</id>
    <updated>${t.date}T12:00:00Z</updated>
    <category term="${t.tipo}"/>
    ${t.resumo ? `<summary>${xml(t.resumo)}</summary>` : ''}
    <content type="html">${xml(t.html)}</content>
  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${xml(site.defaultLang)}">
  <title>${xml(site.title)}</title>
  <link href="${xml(base)}"/>
  <link rel="self" href="${xml(base)}feed.xml"/>
  <id>${xml(base)}</id>
  <author><name>${xml(site.author)}</name></author>
  <rights>© ${xml(site.author)} · CC BY-NC-ND 4.0 (https://creativecommons.org/licenses/by-nc-nd/4.0/)</rights>
  <updated>${updated}</updated>
${entries}
</feed>
`;
}

// ---------- main ----------

const hashFile = async (p) => createHash('sha1').update(await readFile(p)).digest('hex').slice(0, 10);

async function main() {
  const site = JSON.parse(await readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
  site.languages ||= ['pt'];
  site.defaultLang ||= site.languages[0];
  site.domain = str(site.domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  // Address: custom domain first, then what the Pages action reports, then the config.
  site.url = site.domain ? `https://${site.domain}/` : (str(process.env.SITE_URL) || str(site.url));
  if (site.url && !site.url.endsWith('/')) site.url += '/';
  if (!site.languages.includes(site.defaultLang)) errors.push('site.config.json: defaultLang precisa estar em languages');

  const texts = await loadTexts(site.languages);
  const pages = await loadPages(site.languages);

  for (const w of warnings) console.warn('aviso:', w);
  if (errors.length) {
    for (const e of errors) console.error('erro:', e);
    console.error(`\n${errors.length} erro(s). Nada foi publicado; corrija e envie de novo.`);
    process.exit(1);
  }

  await rm(DIST, { recursive: true, force: true });
  await mkdir(path.join(DIST, 'data'), { recursive: true });
  await cp(path.join(ROOT, 'src'), DIST, { recursive: true });
  if (existsSync(path.join(ROOT, 'media'))) await cp(path.join(ROOT, 'media'), path.join(DIST, 'media'), { recursive: true });

  const meta = ({ html, anterior, proximo, ...rest }) => rest;
  await writeFile(path.join(DIST, 'data', 'index.json'), JSON.stringify({
    site: { title: site.title, author: site.author, languages: site.languages, defaultLang: site.defaultLang, description: site.description || {} },
    textos: texts.map(meta),
    paginas: pages.map(({ lang, slug, titulo }) => ({ lang, slug, titulo })),
    builtAt: new Date().toISOString(),
  }));
  for (const t of texts) {
    await mkdir(path.join(DIST, 'data', t.lang, 't'), { recursive: true });
    await writeFile(path.join(DIST, 'data', t.lang, 't', `${t.slug}.json`), JSON.stringify(t));
  }
  for (const p of pages) {
    await mkdir(path.join(DIST, 'data', p.lang, 'p'), { recursive: true });
    await writeFile(path.join(DIST, 'data', p.lang, 'p', `${p.slug}.json`), JSON.stringify(p));
  }
  await writeFile(path.join(DIST, 'feed.xml'), atom(site, texts));
  await writeFile(path.join(DIST, '.nojekyll'), '');
  if (site.domain) await writeFile(path.join(DIST, 'CNAME'), `${site.domain}\n`);

  const desc = (site.description && site.description[site.defaultLang]) || '';
  const v = { css: await hashFile(path.join(DIST, 'style.css')), js: await hashFile(path.join(DIST, 'app.js')) };
  for (const shell of ['index.html', '404.html']) {
    const p = path.join(DIST, shell);
    const html = (await readFile(p, 'utf8'))
      .replaceAll('{{lang}}', xml(site.defaultLang))
      .replaceAll('{{title}}', xml(site.title))
      .replaceAll('{{description}}', xml(desc))
      .replaceAll('{{author}}', xml(site.author))
      .replaceAll('{{home}}', xml(site.url || './'))
      .replaceAll('{{v.css}}', v.css)
      .replaceAll('{{v.js}}', v.js);
    await writeFile(p, html);
  }

  const count = site.languages.map((l) => `${l}: ${texts.filter((t) => t.lang === l).length}`).join(', ');
  console.log(`ok: textos (${count}), ${pages.length} página(s) → dist/${site.url ? `, ${site.url}` : ''}${site.domain ? ' (CNAME)' : ''}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
