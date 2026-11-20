(() => {
  'use strict';

  // ---------- Constants ----------
  const STARTER_FAQS = [
    { id: 'FAQ-01', category: 'Labs', question: 'When is CS-LAB-102A open, and can I eat there?', answer: 'CS-LAB-102A is open from 08:00 AM to 06:00 PM, Monday to Friday. Food and drinks are not allowed inside the lab.' },
    { id: 'FAQ-02', category: 'Academics', question: 'What is the attendance requirement?', answer: 'Students need at least 80% attendance in each course. A student below 80% cannot sit the final exam in that course.' },
    { id: 'FAQ-03', category: 'Library', question: 'What are the library timings?', answer: 'The library is open from 08:30 AM to 08:00 PM, Monday to Thursday, and from 08:30 AM to 12:30 PM on Friday. It is closed on weekends.' },
    { id: 'FAQ-04', category: 'Exams', question: 'What if I miss a midterm because I was ill?', answer: 'Apply for a retake to the Course Coordinator within 3 working days of the exam, with a medical certificate.' },
    { id: 'FAQ-05', category: 'Fees', question: 'When is the Spring 2027 fee due?', answer: 'Download the fee challan from the student portal. The last date to pay without a fine is 15-Jan-2027.' },
    { id: 'FAQ-06', category: 'Projects', question: 'How do I submit my FYP proposal?', answer: 'Submit the Final Year Project proposal on SLATE by 30-Nov-2026. Each FYP group has 2 or 3 members.' },
    { id: 'FAQ-07', category: 'Transport', question: 'When do the university buses leave?', answer: 'University buses leave the campus at 01:30 PM and 04:30 PM, Monday to Friday. Bus cards are issued by the Transport Office in Block A.' },
    { id: 'FAQ-08', category: 'Help', question: 'Who do I contact for anything else?', answer: 'Email helpdesk@se.example.edu or visit Room 210, 09:00 AM to 04:00 PM, Monday to Friday.' },
  ];
  const CATEGORIES = ['Labs', 'Academics', 'Library', 'Exams', 'Fees', 'Projects', 'Transport', 'Help'];
  const NOT_FOUND = 'Sorry, I could not find this in the department FAQ. Please email helpdesk@se.example.edu or visit Room 210.';
  const AI_DOWN = 'AI service unavailable. Check your connection or API key and try again.';
  const BAD_LENGTH = 'Message must be 1 to 300 characters.';
  const ADMIN_PIN = '2026';
  const MAX_MSG = 300;
  const TIMEOUT_MS = 30000;
  const KEYS = { faqs: 'askse_faqs', chat: 'askse_chat', stats: 'askse_stats', theme: 'askse_theme', urdu: 'askse_urdu' };
  const CHIPS = ['When is CS-LAB-102A open?', 'What are the library timings?', 'What is the attendance requirement?', 'Spring 2027 fee kab tak jama karwani hai?', 'When do the buses leave?'];

  // ---------- Helpers ----------
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const clone = o => JSON.parse(JSON.stringify(o));
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
  };
  function fmtTime(ts) {
    const d = new Date(ts);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m} ${ap}`;
  }
  const idNum = id => parseInt(String(id).replace(/\D/g, ''), 10) || 0;
  const sortedFaqs = () => [...faqs].sort((a, b) => idNum(a.id) - idNum(b.id));

  // ---------- State ----------
  let faqs = store.get(KEYS.faqs, null);
  if (!Array.isArray(faqs) || faqs.length === 0) { faqs = clone(STARTER_FAQS); store.set(KEYS.faqs, faqs); } // first run: load starter data
  let chat = store.get(KEYS.chat, []);
  if (!Array.isArray(chat)) chat = [];
  let stats = store.get(KEYS.stats, null) || { asked: 0, answered: 0, notFound: 0, cites: {} };
  let pending = null;     // user text currently waiting for an answer
  let errorNote = false;  // show "AI service unavailable" bubble
  let busy = false;
  let adminUnlocked = false;

  // ---------- Theme ----------
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); }
  applyTheme(store.get(KEYS.theme, window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#themeBtn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next); store.set(KEYS.theme, next);
  });

  // ---------- Tabs ----------
  function switchTab(name) {
    $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
    if (name === 'faqs') renderFaqs();
    if (name === 'stats') renderStats();
    if (name === 'about') renderAbout();
    if (name === 'admin') renderAdmin();
    if (name === 'chat') scrollDown();
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) switchTab(b.dataset.tab); });

  // ---------- Dialog ----------
  function confirmDialog({ title, body, confirmLabel }) {
    return new Promise(resolve => {
      const ov = el('div', 'overlay');
      const box = el('div', 'dialog');
      box.setAttribute('role', 'dialog');
      box.append(el('h3', '', title));
      if (body) box.append(el('p', '', body));
      const row = el('div', 'dialog-actions');
      const cancel = el('button', 'ghost', 'Cancel');
      const ok = el('button', 'danger', confirmLabel);
      const close = v => { ov.remove(); resolve(v); };
      cancel.onclick = () => close(false);
      ok.onclick = () => close(true);
      ov.addEventListener('click', e => { if (e.target === ov) close(false); });
      row.append(cancel, ok); box.append(row); ov.append(box); document.body.append(ov);
      cancel.focus();
    });
  }

  // ---------- Chat ----------
  const messagesBox = $('#messages');
  const input = $('#input');
  const counter = $('#counter');
  const inputError = $('#inputError');
  const sendBtn = $('#sendBtn');

  function scrollDown() { requestAnimationFrame(() => { messagesBox.scrollTop = messagesBox.scrollHeight; }); }

  function bubbleRow(role, text, ts) {
    const row = el('div', 'row-msg ' + role);
    row.append(el('div', 'bubble', text));
    if (ts) row.append(el('div', 'stamp', fmtTime(ts)));
    return row;
  }

  function botRow(m) {
    const row = el('div', 'row-msg bot');
    const b = el('div', 'bubble' + (m.found ? '' : ' notfound'));
    b.append(document.createTextNode(m.text));
    if (m.found) (m.faqIds || []).forEach(id => b.append(el('span', 'cite', `[${id}]`)));
    row.append(b);
    const stamp = el('div', 'stamp');
    stamp.append(el('span', '', fmtTime(m.ts)));
    const fb = el('span', 'fb');
    [['up', 'Helpful'], ['down', 'Not helpful']].forEach(([k, label]) => {
      const btn = el('button', m.feedback === k ? 'on' : '', label);
      btn.type = 'button';
      btn.onclick = () => { m.feedback = m.feedback === k ? null : k; store.set(KEYS.chat, chat); renderChat(false); };
      fb.append(btn);
    });
    stamp.append(fb);
    row.append(stamp);
    return row;
  }

  function renderChat(scroll = true) {
    messagesBox.innerHTML = '';
    if (!chat.length && !pending && !errorNote) {
      const empty = el('div', 'empty');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'logo');
      svg.innerHTML = '<use href="#logo"></use>';
      empty.append(svg, el('div', '', 'Ask me anything about labs, exams, fees, transport and more.'));
      messagesBox.append(empty);
    }
    chat.forEach(m => messagesBox.append(m.role === 'user' ? bubbleRow('user', m.text, m.ts) : botRow(m)));
    if (pending) {
      messagesBox.append(bubbleRow('user', pending, null));
      const row = el('div', 'row-msg bot');
      const b = el('div', 'bubble typing'); b.setAttribute('aria-label', 'AskSE is typing');
      b.append(el('i'), el('i'), el('i')); row.append(b); messagesBox.append(row);
    }
    if (errorNote) {
      const row = el('div', 'row-msg bot');
      row.append(el('div', 'bubble error', AI_DOWN));
      messagesBox.append(row);
    }
    if (scroll) scrollDown();
  }

  function updateCounter() {
    const n = input.value.length;
    counter.textContent = `${n}/${MAX_MSG}`;
    counter.classList.toggle('over', n > MAX_MSG);
  }

  function growInput() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }

  input.addEventListener('input', () => { updateCounter(); growInput(); inputError.textContent = ''; });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); }
  });
  $('#composer').addEventListener('submit', e => { e.preventDefault(); send(input.value); });

  function recordStats(found, ids) {
    stats.asked++;
    if (found) { stats.answered++; ids.forEach(id => { stats.cites[id] = (stats.cites[id] || 0) + 1; }); } else stats.notFound++;
    store.set(KEYS.stats, stats);
  }

  async function send(raw) {
    if (busy) return;
    if (raw.trim().length < 1 || raw.length > MAX_MSG) { inputError.textContent = BAD_LENGTH; return; }
    const text = raw.trim();
    inputError.textContent = '';
    busy = true; sendBtn.disabled = true; errorNote = false; pending = text; renderChat();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let data = null;
    try {
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ question: text, faqs: sortedFaqs(), urduScript: $('#urduToggle').checked }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } catch (err) {
      // Failure: keep the typed text in the box, keep earlier chat, show the unavailable notice.
      pending = null; errorNote = true; busy = false; sendBtn.disabled = false;
      renderChat(); clearTimeout(timer); return;
    }
    clearTimeout(timer);

    // Code-level grounding check: found must be true with at least one id, and every id must exist.
    const ids = Array.isArray(data.faq_ids) ? [...new Set(data.faq_ids.map(String))] : [];
    const known = new Set(faqs.map(f => f.id));
    const grounded = data.found === true && typeof data.answer === 'string' && data.answer.trim() !== '' &&
      ids.length > 0 && ids.every(id => known.has(id));

    const now = Date.now();
    chat.push({ role: 'user', text, ts: now });
    chat.push(grounded
      ? { role: 'bot', found: true, text: data.answer.trim(), faqIds: ids, ts: Date.now(), feedback: null }
      : { role: 'bot', found: false, text: NOT_FOUND, faqIds: [], ts: Date.now(), feedback: null });
    store.set(KEYS.chat, chat);
    recordStats(grounded, ids);

    input.value = ''; updateCounter(); growInput();
    pending = null; busy = false; sendBtn.disabled = false; renderChat();
    input.focus();
  }

  // Suggested question chips
  CHIPS.forEach(q => {
    const c = el('button', 'chip', q); c.type = 'button';
    c.onclick = () => { input.value = q; updateCounter(); growInput(); send(q); };
    $('#chips').append(c);
  });

  // Clear chat (asks first; never touches FAQs)
  $('#clearBtn').addEventListener('click', async () => {
    const yes = await confirmDialog({ title: 'Clear all messages?', body: 'FAQs are kept.', confirmLabel: 'Clear' });
    if (!yes) return;
    chat = []; store.set(KEYS.chat, chat); errorNote = false; renderChat();
  });

  // Urdu script switch
  $('#urduToggle').checked = !!store.get(KEYS.urdu, false);
  $('#urduToggle').addEventListener('change', e => store.set(KEYS.urdu, e.target.checked));

  // Voice input
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { $('#micBtn').hidden = true; } else {
    let rec = null, live = false;
    $('#micBtn').addEventListener('click', () => {
      if (live && rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onstart = () => { live = true; $('#micBtn').classList.add('live'); };
      rec.onend = () => { live = false; $('#micBtn').classList.remove('live'); };
      rec.onerror = () => { live = false; $('#micBtn').classList.remove('live'); };
      rec.onresult = e => {
        const t = e.results[0][0].transcript;
        input.value = (input.value ? input.value + ' ' : '') + t; updateCounter(); growInput();
      };
      try { rec.start(); } catch (e) { /* already started */ }
    });
  }

  // ---------- FAQs screen ----------
  function renderFaqs() {
    $('#faqCount').textContent = `${faqs.length} FAQs, in ID order`;
    const list = $('#faqList'); list.innerHTML = '';
    sortedFaqs().forEach(f => {
      const card = el('div', 'faq');
      const top = el('div', 'top');
      top.append(el('span', 'badge', f.id), el('span', 'pill', f.category));
      card.append(top, el('div', 'q', f.question), el('div', 'a', f.answer));
      list.append(card);
    });
  }
  $('#resetBtn').addEventListener('click', async () => {
    const yes = await confirmDialog({ title: 'Reset to starter data?', body: 'This restores the 8 starter FAQs and removes any FAQs you added. Your chat is kept.', confirmLabel: 'Reset' });
    if (!yes) return;
    faqs = clone(STARTER_FAQS); store.set(KEYS.faqs, faqs); renderFaqs();
  });

  // ---------- Admin ----------
  const sel = $('#fCategory');
  sel.append(new Option('Select a category', ''));
  CATEGORIES.forEach(c => sel.append(new Option(c, c)));

  function renderAdmin() {
    $('#pinForm').hidden = adminUnlocked;
    $('#faqForm').hidden = !adminUnlocked;
  }
  $('#pinForm').addEventListener('submit', e => {
    e.preventDefault();
    if ($('#pinInput').value.trim() === ADMIN_PIN) {
      adminUnlocked = true; $('#pinError').textContent = ''; $('#pinInput').value = ''; renderAdmin();
    } else {
      $('#pinError').textContent = 'Incorrect PIN';
    }
  });
  const nextId = () => 'FAQ-' + String(faqs.reduce((mx, f) => Math.max(mx, idNum(f.id)), 0) + 1).padStart(2, '0');

  $('#faqForm').addEventListener('submit', e => {
    e.preventDefault();
    const cat = sel.value, q = $('#fQuestion').value.trim(), a = $('#fAnswer').value.trim();
    $('#eCategory').textContent = cat ? '' : 'Please select a category.';
    $('#eQuestion').textContent = (q.length >= 10 && q.length <= 150) ? '' : 'Question must be 10 to 150 characters.';
    $('#eAnswer').textContent = (a.length >= 10 && a.length <= 400) ? '' : 'Answer must be 10 to 400 characters.';
    $('#faqOk').textContent = '';
    if (!cat || q.length < 10 || q.length > 150 || a.length < 10 || a.length > 400) return;
    const id = nextId();
    faqs.push({ id, category: cat, question: q, answer: a });
    store.set(KEYS.faqs, faqs);
    sel.value = ''; $('#fQuestion').value = ''; $('#fAnswer').value = '';
    $('#faqOk').textContent = `${id} added. The chatbot can use it right away.`;
  });

  // ---------- Stats ----------
  function renderStats() {
    const body = $('#statsBody'); body.innerHTML = '';
    const tiles = el('div', 'tiles');
    [['Questions asked', stats.asked], ['Answered', stats.answered], ['Not found', stats.notFound]].forEach(([label, n]) => {
      const t = el('div', 'tile'); t.append(el('b', '', String(n)), el('span', '', label)); tiles.append(t);
    });
    body.append(tiles);
    const entries = Object.entries(stats.cites).sort((a, b) => b[1] - a[1]);
    const card = el('div', 'card'); card.style.marginTop = '12px';
    card.append(el('h2', '', 'Most-cited FAQ'));
    if (!entries.length) {
      card.append(el('p', 'muted', 'No answers yet. Ask a question in Chat.'));
    } else {
      const top = faqs.find(f => f.id === entries[0][0]);
      card.append(el('p', '', `${entries[0][0]}${top ? ' - ' + top.question : ''} (${entries[0][1]}x)`));
      const bars = el('div', 'bars'); const max = entries[0][1];
      entries.slice(0, 8).forEach(([id, n]) => {
        const row = el('div', 'bar'); const track = el('div', 'track'); const fill = el('div', 'fill');
        fill.style.width = Math.round((n / max) * 100) + '%'; track.append(fill);
        row.append(el('span', '', id), track, el('span', '', String(n))); bars.append(row);
      });
      card.append(bars);
    }
    body.append(card);
  }

  // ---------- About ----------
  async function renderAbout() {
    const T = window.TEAM || {};
    let api = '', model = '';
    try { const r = await fetch('/api/config'); const c = await r.json(); api = c.api; model = c.model; } catch (e) { api = 'Unavailable'; model = 'Unavailable'; }
    const dl = $('#aboutList'); dl.innerHTML = '';
    const add = (k, v, link) => {
      dl.append(el('dt', '', k));
      const dd = el('dd');
      if (link) { const a = el('a', '', v); a.href = v; a.target = '_blank'; a.rel = 'noopener'; dd.append(a); } else dd.textContent = v;
      dl.append(dd);
    };
    add('Entry ID', T.entryId || '-');
    add('Team name', T.teamName || '-');
    add('Members', (T.members || []).join(', ') || '-');
    add('Repository', T.repo || '-', !!T.repo);
    add('LLM API', api);
    add('Model', model);
    add('AI tools used', (T.tools || []).join(', ') || '-');
  }

  // ---------- Init ----------
  updateCounter();
  renderChat();
})();
