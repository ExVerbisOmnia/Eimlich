// D'um Ponto às Linhas: a single-page app with hash routing, so it runs on GitHub
// Pages with no server rewrites. Routes: #/pt (home), #/pt/cronicas, #/pt/contos,
// #/pt/arquivo, #/pt/sobre (any page by slug), #/pt/t/<slug>. Texts arrive
// pre-rendered from the build as JSON; no Markdown parser runs in the browser.
(function () {
  'use strict';

  var UI = {
    pt: { nome: 'Português', cronicas: 'Crônicas', contos: 'Contos', arquivo: 'Arquivo', sobre: 'Sobre',
      anteriores: 'Anteriores', anterior: 'Anterior', proximo: 'Próximo', min: 'min de leitura', conto: 'conto', cronica: 'crônica',
      vazio: 'Ainda não há textos em português.', vazioSecao: 'Ainda não há textos nesta seção.', tambem: 'Também em',
      naoTraduzida: 'Esta página ainda não foi traduzida.', naoEncontrado: 'Não encontrei este endereço.', voltar: 'Voltar ao início',
      erro: 'Não consegui carregar os textos agora. Tente recarregar a página.', claro: 'Tema claro', escuro: 'Tema escuro',
      licenca: 'Textos sob', pular: 'Pular para o texto', secoes: 'Seções', idioma: 'Idioma', exemplo: 'exemplo', outros: 'Em outras línguas',
      meses: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] },
    en: { nome: 'English', cronicas: 'Chronicles', contos: 'Stories', arquivo: 'Archive', sobre: 'About',
      anteriores: 'Earlier', anterior: 'Previous', proximo: 'Next', min: 'min read', conto: 'story', cronica: 'chronicle',
      vazio: 'No texts in English yet.', vazioSecao: 'No texts in this section yet.', tambem: 'Also in',
      naoTraduzida: 'This page has not been translated yet.', naoEncontrado: 'Nothing at this address.', voltar: 'Back to the start',
      erro: 'Could not load the texts right now. Try reloading the page.', claro: 'Light theme', escuro: 'Dark theme',
      licenca: 'Texts under', pular: 'Skip to the text', secoes: 'Sections', idioma: 'Language', exemplo: 'example', outros: 'In other languages',
      meses: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
    fr: { nome: 'Français', cronicas: 'Chroniques', contos: 'Nouvelles', arquivo: 'Archives', sobre: 'À propos',
      anteriores: 'Précédemment', anterior: 'Précédent', proximo: 'Suivant', min: 'min de lecture', conto: 'nouvelle', cronica: 'chronique',
      vazio: 'Pas encore de textes en français.', vazioSecao: 'Pas encore de textes dans cette section.', tambem: 'Aussi en',
      naoTraduzida: 'Cette page n’a pas encore été traduite.', naoEncontrado: 'Rien à cette adresse.', voltar: 'Retour à l’accueil',
      erro: 'Impossible de charger les textes pour le moment. Rechargez la page.', claro: 'Thème clair', escuro: 'Thème sombre',
      licenca: 'Textes sous licence', pular: 'Aller au texte', secoes: 'Sections', idioma: 'Langue', exemplo: 'exemple', outros: 'Dans d’autres langues',
      meses: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] }
  };
  var SECOES = ['cronicas', 'contos', 'arquivo', 'sobre'];

  var root = document.documentElement;
  var main = document.getElementById('conteudo');
  var nav = document.getElementById('nav');
  var idiomas = document.getElementById('idiomas');
  var temaBtn = document.getElementById('tema');
  var cache = { index: null, docs: {} };
  var seq = 0;
  var firstRender = true;
  var defaultAccent = getComputedStyle(root).getPropertyValue('--acento').trim() || '#c0392b';
  var lang = null;

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function enc(s) { return encodeURIComponent(s); }
  function t(k) { return (UI[lang] || UI.pt)[k]; }
  function mesAno(iso) {
    var m = /^(\d{4})-(\d{2})/.exec(iso || '');
    return m ? t('meses')[+m[2] - 1] + ' ' + m[1] : esc(iso);
  }
  function readStore(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function writeStore(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } }
  function getJSON(url) {
    // no-cache = revalidate, so a freshly published text shows up without a hard reload
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) { var e = new Error(r.status); e.status = r.status; throw e; }
      return r.json();
    });
  }
  function loadIndex() {
    if (cache.index) return Promise.resolve(cache.index);
    return getJSON('data/index.json').then(function (ix) { cache.index = ix; return ix; });
  }
  function loadDoc(l, kind, slug) {
    var key = l + '/' + kind + '/' + slug;
    if (cache.docs[key]) return Promise.resolve(cache.docs[key]);
    return getJSON('data/' + l + '/' + kind + '/' + enc(slug) + '.json').then(function (d) { cache.docs[key] = d; return d; });
  }
  function textsOf(ix, l) { return ix.textos.filter(function (x) { return x.lang === l; }); }
  function setAccent(c) { root.style.setProperty('--acento', /^#[0-9a-f]{6}$/i.test(c || '') ? c : defaultAccent); }

  // ---------- chrome: nav, language switch, theme ----------
  function chrome(ix, section, alternates) {
    root.lang = lang;
    nav.setAttribute('aria-label', t('secoes'));
    idiomas.setAttribute('aria-label', t('idioma'));
    document.getElementById('pular').textContent = t('pular');
    document.getElementById('licenca').innerHTML = '© ' + esc(ix.site.author) + ' · ' + esc(t('licenca'))
      + ' <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" rel="license" hreflang="' + lang + '">CC BY-NC-ND 4.0</a>';
    document.getElementById('marca').setAttribute('href', '#/' + lang);
    nav.innerHTML = SECOES.map(function (s) {
      return '<a href="#/' + lang + '/' + s + '"' + (s === section ? ' aria-current="page"' : '') + '>' + esc(t(s)) + '</a>';
    }).join('');
    idiomas.innerHTML = ix.site.languages.map(function (l) {
      // a text jumps to its translation when there is one; otherwise to the same section
      var href = (alternates && alternates[l]) || ('#/' + l + (section ? '/' + section : ''));
      return '<a href="' + href + '" lang="' + l + '" hreflang="' + l + '"' + (l === lang ? ' aria-current="true"' : '') +
        ' title="' + esc(UI[l].nome) + '">' + l.toUpperCase() + '</a>';
    }).join('');
    syncThemeLabel();
  }
  function syncThemeLabel() {
    var claro = root.getAttribute('data-theme') === 'claro';
    temaBtn.textContent = claro ? t('escuro') : t('claro');
  }
  temaBtn.addEventListener('click', function () {
    var claro = root.getAttribute('data-theme') !== 'claro';
    root.setAttribute('data-theme', claro ? 'claro' : 'escuro');
    writeStore('tema', claro ? 'claro' : 'escuro');
    syncThemeLabel();
  });

  function show(token, html, title, focusSel) {
    if (token !== seq) return; // a newer navigation already happened
    main.innerHTML = html;
    var site = cache.index ? cache.index.site.title : document.title;
    document.title = title ? title + ' · ' + site : site;
    if (!firstRender) {
      window.scrollTo(0, 0);
      var f = main.querySelector(focusSel || 'h1') || main;
      if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '-1');
      f.focus({ preventScroll: true });
    }
    firstRender = false;
  }

  // ---------- pieces ----------
  function exemplo(x) { return x.exemplo ? '<span class="exemplo">' + esc(t('exemplo')) + '</span>' : ''; }
  function metaLine(x) {
    var when = (x.lugar ? esc(x.lugar) + ', ' : '') + mesAno(x.date);
    if (x.tipo === 'conto') when += ' · ' + x.minutos + ' ' + esc(t('min'));
    return '<p class="data-lugar"><time datetime="' + esc(x.date) + '">' + when + '</time></p>';
  }
  function epigrafe(x) {
    if (!x.epigrafe) return '';
    return '<blockquote class="epigrafe"><p>' + esc(x.epigrafe) + '</p>'
      + (x.epigrafeAutor ? '<cite>' + esc(x.epigrafeAutor) + '</cite>' : '') + '</blockquote>';
  }
  function textHTML(x, headingTag, linkTitle) {
    var title = esc(x.titulo);
    if (linkTitle) title = '<a href="#/' + x.lang + '/t/' + enc(x.slug) + '">' + title + '</a>';
    var other = (x.traducoes || []).filter(function (o) { return UI[o.lang]; });
    return '<article class="texto ' + esc(x.tipo) + ' entra" lang="' + esc(x.lang) + '">'
      + '<header><' + headingTag + (headingTag === 'h2' ? ' class="titulo"' : '') + '>' + title + exemplo(x) + '</' + headingTag + '>'
      + epigrafe(x) + metaLine(x) + '<span class="fio" aria-hidden="true"></span></header>'
      + '<div class="corpo">' + x.html + '</div>'
      + (other.length ? '<p class="traducoes">' + esc(t('tambem')) + ': ' + other.map(function (o) {
          return '<a href="#/' + o.lang + '/t/' + enc(o.slug) + '" lang="' + o.lang + '" hreflang="' + o.lang + '">' + esc(UI[o.lang].nome) + '</a>';
        }).join(' · ') + '</p>' : '')
      + '</article>';
  }
  function itemHTML(x, withType) {
    return '<li><a class="tit" href="#/' + x.lang + '/t/' + enc(x.slug) + '">' + esc(x.titulo) + '</a>'
      + '<time datetime="' + esc(x.date) + '">' + (x.lugar ? esc(x.lugar) + ', ' : '') + mesAno(x.date)
      + (withType ? ' · ' + esc(t(x.tipo)) : '') + '</time>'
      + (x.resumo || x.exemplo ? '<p class="resumo">' + esc(x.resumo) + exemplo(x) + '</p>' : '')
      + '</li>';
  }
  function otherLangs() {
    var ix = cache.index;
    var others = ix.site.languages.filter(function (l) { return l !== lang && textsOf(ix, l).length; });
    if (!others.length) return '';
    return '<p class="voltar">' + esc(t('outros')) + ': ' + others.map(function (l) {
      return '<a href="#/' + l + '" lang="' + l + '">' + esc(UI[l].nome) + '</a>';
    }).join(' · ') + '</p>';
  }
  function vazio(msg) { return '<p class="vazio">' + esc(msg) + '</p>' + otherLangs(); }

  // ---------- views ----------
  var views = {
    home: function (tk, ix) {
      var list = textsOf(ix, lang);
      chrome(ix, null);
      if (!list.length) { setAccent(); return show(tk, '<h1 class="secao-titulo">' + esc(ix.site.title) + '</h1>' + vazio(t('vazio'))); }
      // the newest text in full, as in the design; the rest as a list below it
      return loadDoc(lang, 't', list[0].slug).then(function (x) {
        if (tk !== seq) return;
        setAccent(x.acento);
        var rest = list.slice(1);
        show(tk, '<h1 class="sr">' + esc(ix.site.title) + '</h1>' + textHTML(x, 'h2', true)
          + (rest.length ? '<section class="anteriores entra"><h2 class="secao-titulo">' + esc(t('anteriores')) + '</h2><ol class="lista">'
            + rest.map(function (r) { return itemHTML(r, true); }).join('') + '</ol></section>' : ''), null);
      });
    },
    secao: function (tk, ix, tipo, section) {
      chrome(ix, section);
      setAccent();
      var list = textsOf(ix, lang).filter(function (x) { return x.tipo === tipo; });
      show(tk, '<h1 class="secao-titulo">' + esc(t(section)) + '</h1>'
        + (list.length ? '<ol class="lista entra">' + list.map(function (x) { return itemHTML(x, false); }).join('') + '</ol>' : vazio(t('vazioSecao'))), t(section));
    },
    arquivo: function (tk, ix) {
      chrome(ix, 'arquivo');
      setAccent();
      var list = textsOf(ix, lang), years = [], by = {};
      list.forEach(function (x) { var y = x.date.slice(0, 4); if (!by[y]) { by[y] = []; years.push(y); } by[y].push(x); });
      show(tk, '<h1 class="secao-titulo">' + esc(t('arquivo')) + '</h1>'
        + (list.length ? '<div class="anos entra">' + years.map(function (y) {
            return '<section><h2>' + y + '</h2><ol class="lista">' + by[y].map(function (x) { return itemHTML(x, true); }).join('') + '</ol></section>';
          }).join('') + '</div>' : vazio(t('vazio'))), t('arquivo'));
    },
    texto: function (tk, ix, slug) {
      // check the index first, so an unknown address never hits the network as a 404
      var meta = textsOf(ix, lang).filter(function (x) { return x.slug === slug; })[0];
      if (!meta) return views.missing(tk, ix);
      var alternates = {};
      (meta.traducoes || []).forEach(function (o) { alternates[o.lang] = '#/' + o.lang + '/t/' + enc(o.slug); });
      chrome(ix, meta.tipo === 'conto' ? 'contos' : 'cronicas', alternates);
      return loadDoc(lang, 't', slug).then(function (x) {
        if (tk !== seq) return;
        setAccent(x.acento);
        var pn = '';
        if (x.anterior || x.proximo) {
          pn = '<nav class="prevnext" aria-label="' + esc(t('anterior') + ' / ' + t('proximo')) + '">'
            + (x.anterior ? '<a href="#/' + lang + '/t/' + enc(x.anterior.slug) + '" rel="prev"><span class="rotulo">← ' + esc(t('anterior')) + '</span><span class="tit">' + esc(x.anterior.titulo) + '</span></a>' : '')
            + (x.proximo ? '<a class="seg" href="#/' + lang + '/t/' + enc(x.proximo.slug) + '" rel="next"><span class="rotulo">' + esc(t('proximo')) + ' →</span><span class="tit">' + esc(x.proximo.titulo) + '</span></a>' : '')
            + '</nav>';
        }
        show(tk, textHTML(x, 'h1', false) + pn, x.titulo);
      });
    },
    pagina: function (tk, ix, slug) {
      var has = function (l) { return ix.paginas.some(function (p) { return p.lang === l && p.slug === slug; }); };
      // a page not yet translated falls back to the default language, with a note
      var from = has(lang) ? lang : (has(ix.site.defaultLang) ? ix.site.defaultLang : null);
      if (!from) return views.missing(tk, ix);
      chrome(ix, slug);
      setAccent();
      return loadDoc(from, 'p', slug).then(function (p) {
        show(tk, '<article class="texto pagina entra" lang="' + from + '"><header><h1>' + esc(p.titulo) + exemplo(p) + '</h1></header>'
          + (from !== lang ? '<p class="vazio" lang="' + lang + '">' + esc(t('naoTraduzida')) + '</p>' : '')
          + '<div class="corpo">' + p.html + '</div></article>', p.titulo);
      });
    },
    missing: function (tk, ix) {
      if (ix) chrome(ix, null);
      setAccent();
      show(tk, '<h1 class="secao-titulo">' + esc(t('naoEncontrado')) + '</h1><p class="voltar"><a href="#/' + lang + '">' + esc(t('voltar')) + '</a></p>', t('naoEncontrado'));
    },
    failed: function (tk) {
      show(tk, '<p class="aviso">' + esc(t('erro')) + '</p>');
    }
  };

  function preferredLang(ix) {
    var langs = ix.site.languages;
    var saved = readStore('idioma');
    if (saved && langs.indexOf(saved) !== -1) return saved; // the reader's own choice wins
    // the browser's language only if something is written in it; otherwise the default
    var wanted = (navigator.languages || [navigator.language || '']).map(function (l) { return String(l).slice(0, 2).toLowerCase(); });
    for (var i = 0; i < wanted.length; i++) if (langs.indexOf(wanted[i]) !== -1 && textsOf(ix, wanted[i]).length) return wanted[i];
    return ix.site.defaultLang;
  }

  function route() {
    var hash = location.hash || '#/';
    if (hash.indexOf('#/') !== 0) return; // in-page anchors are handled by the click handler
    var tk = ++seq;
    loadIndex().then(function (ix) {
      var langs = ix.site.languages;
      var parts = hash.slice(2).split('/').map(decodeURIComponent); // may throw URIError
      if (langs.indexOf(parts[0]) === -1) {
        lang = lang || preferredLang(ix);
        if (!parts[0]) { location.replace('#/' + lang); return; }
        return views.missing(tk, ix);
      }
      lang = parts[0];
      writeStore('idioma', lang);
      var a = parts[1], b = parts[2];
      if (!a) return views.home(tk, ix);
      if (a === 'cronicas' && !b) return views.secao(tk, ix, 'cronica', 'cronicas');
      if (a === 'contos' && !b) return views.secao(tk, ix, 'conto', 'contos');
      if (a === 'arquivo' && !b) return views.arquivo(tk, ix);
      if (a === 't' && b && !parts[3]) return views.texto(tk, ix, b);
      if (/^[a-z0-9-]+$/.test(a) && !b) return views.pagina(tk, ix, a);
      return views.missing(tk, ix);
    }).catch(function (e) {
      lang = lang || 'pt';
      if (e instanceof URIError || (e && e.status === 404)) return views.missing(tk, cache.index);
      views.failed(tk);
    });
  }

  // Footnotes and the skip link use plain #id anchors; with hash routing they would be
  // read as routes, so scroll to them here instead.
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!el) return;
    var href = el.getAttribute('href');
    if (href.indexOf('#/') === 0 || href === '#') return;
    var target = document.getElementById(decodeURIComponent(href.slice(1)));
    if (!target) return;
    ev.preventDefault();
    target.scrollIntoView({ behavior: root.classList.contains('dance') ? 'smooth' : 'auto', block: 'center' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.classList.add('alvo');
    setTimeout(function () { target.classList.remove('alvo'); }, 1800);
  });

  window.addEventListener('hashchange', route);
  route();
})();
