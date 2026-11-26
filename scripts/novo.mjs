// Creates a new draft text: npm run novo -- conto|cronica pt|en|fr "Título"
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [tipo, lang, ...rest] = process.argv.slice(2);
const titulo = rest.join(' ').trim();
if (!['conto', 'cronica'].includes(tipo) || !['pt', 'en', 'fr'].includes(lang) || !titulo) {
  console.error('Uso: npm run novo -- cronica pt "Título do texto"   (tipo: conto ou cronica; idioma: pt, en ou fr)');
  process.exit(1);
}
const slug = titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const d = new Date();
const date = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'textos', lang, `${date}-${slug}.md`);
if (existsSync(file)) { console.error(`Já existe: ${file}`); process.exit(1); }
const extra = tipo === 'cronica' ? 'lugar: ""\n' : 'epigrafe: ""\nepigrafe_autor: ""\nacento: "#c0392b"\n';
await writeFile(file, `---\ntitulo: "${titulo.replace(/"/g, '\\"')}"\ntipo: ${tipo}\n${extra}resumo: ""\nrascunho: true\n---\n\nEscreva aqui.\n`);
console.log(`criado: textos/${lang}/${path.basename(file)} (rascunho; apague a linha rascunho: true para publicar)`);
