// Small progressive enhancements. Everything core (search, save,
// navigation) already works via plain HTML forms/links - this file
// only adds nice-to-haves on top.

document.addEventListener('DOMContentLoaded', function () {
  // Dark / light mode toggle. Theme is applied instantly on every page
  // load by the inline script in <head> (before paint); this just lets
  // the user flip it and remembers the choice.
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('nl-theme', next);
    });
  }

  // Mobile: collapse the category list under a toggle so the sidebar
  // doesn't dominate the screen on small viewports.
  const sidebar = document.getElementById('sidebar');
  if (sidebar && window.matchMedia('(max-width: 860px)').matches) {
    const toggle = document.createElement('button');
    toggle.className = 'mobile-nav-toggle';
    toggle.type = 'button';
    toggle.textContent = 'Menu';
    sidebar.insertBefore(toggle, sidebar.firstChild.nextSibling);
    sidebar.classList.add('collapsed');

    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('collapsed');
      toggle.textContent = sidebar.classList.contains('collapsed') ? 'Menu' : 'Close';
    });
  }

  // Sidebar scroll position gets wiped on every click because this is
  // a normal server-rendered app - clicking a category or language pill
  // is a full page load, not a SPA route change, so the browser starts
  // the new page scrolled to the top by default. With 21 languages plus
  // a full category list, that meant re-scrolling all the way down
  // after every single click. sessionStorage survives across page
  // loads (unlike a JS variable), so this remembers where you were.
  if (sidebar) {
    const savedScroll = sessionStorage.getItem('nl-sidebar-scroll');
    if (savedScroll) sidebar.scrollTop = parseInt(savedScroll, 10);

    sidebar.addEventListener('click', function () {
      sessionStorage.setItem('nl-sidebar-scroll', sidebar.scrollTop);
    });
  }

  initAiReader();
});

// Multilingual AI Reader on the article page: one tab per language the
// app supports (see utils/languages.js - article.ejs renders one
// data-lang/data-label/data-speech button per entry, so this file never
// hardcodes the language list itself). Clicking a tab fetches
// /reader/:articleId/:lang (generated once and cached server-side in
// Mongo - see aiService.js / ArticleReader model), renders the
// summary/key points/reader content, and wires up a "Listen" button
// using the browser's built-in speechSynthesis - no paid voice API, no
// server involvement for audio.
function initAiReader() {
  const panel = document.getElementById('aiReader');
  if (!panel) return; // not on an article page

  const articleId = panel.dataset.articleId;
  const tabs = panel.querySelectorAll('.lang-tab');
  const body = document.getElementById('readerBody');
  const cache = {};
  // Built from each tab's data attributes (set by article.ejs from the
  // shared language list) instead of a hardcoded object, so adding a
  // language to utils/languages.js is the only place that needs a change.
  const langNames = {};
  const speechLangCodes = {};
  tabs.forEach((tab) => {
    langNames[tab.dataset.lang] = tab.dataset.label;
    speechLangCodes[tab.dataset.lang] = tab.dataset.speech;
  });

  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function renderReader(data, lang) {
    let html = '';
    if (data.summary) {
      html += `<p>${escapeHtml(data.summary)}</p>`;
    }
    if (data.keyPoints && data.keyPoints.length) {
      html += `<div class="ai-panel-heading" style="margin-top:1rem;">KEY POINTS</div><ul>${
        data.keyPoints.map((p) => `<li>${escapeHtml(p)}</li>`).join('')
      }</ul>`;
    }
    if (data.readerContent) {
      html += `<div class="ai-panel-heading" style="margin-top:1rem;">AI READER &mdash; ${langNames[lang]}</div><p>${escapeHtml(data.readerContent)}</p>`;
    }
    html += `<button type="button" class="btn btn-ghost listen-btn" id="listenBtn">🔊 Listen</button>`;
    body.innerHTML = html;

    const listenBtn = document.getElementById('listenBtn');
    listenBtn.addEventListener('click', function () {
      if (!window.speechSynthesis) {
        body.insertAdjacentHTML('beforeend', '<p class="ai-unavailable">Voice reading isn\'t supported in this browser.</p>');
        return;
      }
      stopSpeaking();
      const text = [data.summary, (data.keyPoints || []).join('. '), data.readerContent].filter(Boolean).join('. ');
      const utterance = new SpeechSynthesisUtterance(text);
      const langCode = speechLangCodes[lang] || 'en-US';
      utterance.lang = langCode;

      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find((v) => v.lang === langCode) || voices.find((v) => v.lang && v.lang.startsWith(lang));
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      } else if (lang !== 'en') {
        // Browser has no Telugu/Hindi voice installed - still attempt it
        // (some browsers pick a reasonable fallback), but let the user know.
        body.insertAdjacentHTML('beforeend', `<p class="ai-unavailable">No ${langNames[lang]} voice was found in this browser - playback may sound off or use a different voice.</p>`);
      }
      window.speechSynthesis.speak(utterance);
    });
  }

  async function loadLang(lang) {
    stopSpeaking();
    if (cache[lang]) {
      renderReader(cache[lang], lang);
      return;
    }
    body.innerHTML = '<p class="reader-placeholder">Generating&hellip;</p>';
    try {
      const res = await fetch(`/reader/${articleId}/${lang}`);
      const data = await res.json();
      if (!res.ok) {
        body.innerHTML = `<p class="ai-unavailable">${escapeHtml(data.error || "Couldn't generate the AI reader for this language right now.")}</p>`;
        return;
      }
      cache[lang] = data;
      renderReader(data, lang);
    } catch (err) {
      body.innerHTML = '<p class="ai-unavailable">Couldn\'t reach the server. Please try again in a moment.</p>';
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', function () {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      loadLang(tab.dataset.lang);
    });
  });
}
