/* Photo curator, local only. Talks to 127.0.0.1 and nothing else. */
'use strict';

const SECTIONS = ['Hero', 'Album', 'Events', 'Credentials', 'Site'];

const state = {
  photos: [],
  events: [],
  staged: [],
  folders: {},
  marked: new Set(),
  filter: 'All',
  assignments: {},
};

const $ = (s) => document.querySelector(s);
const grid = $('#grid');
const stagedEl = $('#staged');
const dlg = $('#assign');
let assignTarget = null;

/* ---------------------------------------------------------------- load */

async function load() {
  const res = await fetch('/api/state');
  if (!res.ok) {
    toast('Could not read the project: ' + res.status);
    return;
  }
  const data = await res.json();
  state.photos = data.photos ?? [];
  state.events = data.events ?? [];
  state.staged = data.staged ?? [];
  state.folders = data.folders ?? {};
  render();
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* --------------------------------------------------------------- render */

function where(p) {
  const bits = p.uses.map((u) => (u.section === 'Events' && u.eventTitle ? `Events: ${u.eventTitle}` : u.section));
  return bits.join(' + ') + (p.uses[0]?.unlisted ? ' (not in the slide list)' : '');
}

function renderFilters() {
  const el = $('#filters');
  const counts = new Map();
  for (const p of state.photos) for (const u of p.uses) counts.set(u.section, (counts.get(u.section) || 0) + 1);
  const opts = ['All', ...SECTIONS.filter((s) => counts.has(s)), ...(state.staged.length ? ['Staged'] : [])];
  el.innerHTML = '';
  for (const s of opts) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = s === 'Staged' ? `Staged (${state.staged.length})` : `${s} (${s === 'All' ? state.photos.length : counts.get(s) || 0})`;
    b.setAttribute('aria-pressed', String(state.filter === s));
    b.addEventListener('click', () => {
      state.filter = s;
      render();
    });
    el.appendChild(b);
  }
}

function visible() {
  if (state.filter === 'Staged') return [];
  return state.photos.filter((p) => state.filter === 'All' || p.uses.some((u) => u.section === state.filter));
}

function render() {
  $('#cTotal').textContent = state.photos.length;
  $('#cMarked').textContent = state.marked.size;
  $('#cStaged').textContent = state.staged.length;
  $('#apply').disabled = state.marked.size === 0 && Object.keys(state.assignments).length === 0;
  renderFilters();

  grid.innerHTML = '';
  for (const p of visible()) {
    const marked = state.marked.has(p.path);
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.marked = String(marked);

    const shot = document.createElement('button');
    shot.className = 'shot';
    shot.type = 'button';
    shot.title = marked ? 'Unmark' : 'Mark for removal';
    const img = document.createElement('img');
    img.src = '/' + p.path.split('/').map(encodeURIComponent).join('/');
    img.alt = p.uses[0]?.alt || p.file;
    img.loading = 'lazy';
    shot.addEventListener('click', () => {
      if (state.marked.has(p.path)) state.marked.delete(p.path);
      else state.marked.add(p.path);
      render();
    });
    shot.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = p.file;
    const wh = document.createElement('div');
    wh.className = 'where';
    wh.textContent = where(p) + ` · ${(p.bytes / 1024).toFixed(0)} KB`;
    meta.append(name, wh);

    const act = document.createElement('div');
    act.className = 'act';
    const assign = document.createElement('button');
    assign.type = 'button';
    assign.textContent = 'assign';
    assign.addEventListener('click', () => openAssign(p));
    act.appendChild(assign);
    meta.appendChild(act);

    card.append(shot, meta);
    grid.appendChild(card);
  }

  stagedEl.innerHTML = '';
  for (const s of state.staged) {
    const card = document.createElement('article');
    card.className = 'card';
    const shot = document.createElement('div');
    shot.className = 'shot';
    const img = document.createElement('img');
    img.src = '/' + s.path.split('/').map(encodeURIComponent).join('/');
    img.alt = s.file;
    shot.appendChild(img);
    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = s.file;
    const wh = document.createElement('div');
    wh.className = 'where';
    const a = state.assignments[s.path];
    wh.textContent = a ? `assigned: ${a.section}${a.event ? ` → ${a.event}` : ''}` : 'not assigned yet';
    const act = document.createElement('div');
    act.className = 'act';
    const assign = document.createElement('button');
    assign.type = 'button';
    assign.textContent = 'assign';
    assign.addEventListener('click', () => openAssign({ path: s.path, file: s.file, uses: [], staged: true }, true));
    act.appendChild(assign);
    meta.append(name, wh, act);
    card.append(shot, meta);
    stagedEl.appendChild(card);
  }

  const ev = $('#aEvent');
  ev.innerHTML = '';
  for (const e of state.events) {
    const o = document.createElement('option');
    o.value = e.id;
    o.textContent = `${e.title} (${e.dateLabel})`;
    ev.appendChild(o);
  }
}

/* -------------------------------------------------------------- assign */

function openAssign(p, isStaged) {
  assignTarget = { p, isStaged };
  $('#assignTitle').textContent = p.file;
  const cur = state.assignments[p.path] || {};
  $('#aSection').value = cur.section || p.uses[0]?.section || 'Album';
  $('#aEvent').value = cur.event || p.uses[0]?.event || state.events[0]?.id || '';
  $('#aCaption').value = cur.caption || p.uses[0]?.caption || '';
  $('#aAlt').value = cur.alt || p.uses[0]?.alt || '';
  syncEventVisibility();
  dlg.showModal();
}

function syncEventVisibility() {
  $('#aEventWrap').hidden = $('#aSection').value !== 'Events';
}

dlg.addEventListener('close', async () => {
  if (dlg.returnValue !== 'save' || !assignTarget) return;
  const { p, isStaged } = assignTarget;
  const section = $('#aSection').value;
  const rec = {
    section,
    event: section === 'Events' ? $('#aEvent').value : null,
    caption: $('#aCaption').value.trim(),
    alt: $('#aAlt').value.trim(),
  };
  if (section === 'Do not use') {
    state.marked.add(p.path);
    delete state.assignments[p.path];
  } else {
    state.assignments[p.path] = rec;
    state.marked.delete(p.path);
  }
  render();
  if (!isStaged) return;
});

$('#aSection').addEventListener('change', syncEventVisibility);

/* --------------------------------------------------------------- files */

async function stageFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  const payload = { files: [] };
  for (const f of files) {
    const data = await new Promise((ok) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.readAsDataURL(f);
    });
    payload.files.push({ name: f.name, data });
  }
  const res = await fetch('/api/stage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const out = await res.json();
  toast(`${out.written.length} staged into assets/photo_intake/`);
  load();
}

$('#picker').addEventListener('change', (e) => {
  stageFiles(e.target.files);
  e.target.value = '';
});

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  document.body.classList.add('dragging');
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) document.body.classList.remove('dragging');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  if (e.dataTransfer?.files?.length) stageFiles(e.dataTransfer.files);
});

/* -------------------------------------------------------------- actions */

$('#unmark').addEventListener('click', () => {
  state.marked.clear();
  render();
});

$('#download').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(buildSelection(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'photo_selection.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

function buildSelection() {
  return {
    generated: new Date().toISOString(),
    marked: [...state.marked],
    assignments: state.assignments,
    events: state.events,
  };
}

$('#apply').addEventListener('click', async () => {
  const marked = state.marked.size;
  const assigned = Object.keys(state.assignments).length;
  if (!confirm(`Move ${marked} photo(s) to assets/removed/ and write the export?\n\nNothing is deleted, so this is reversible.`)) return;
  const res = await fetch('/api/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSelection()),
  });
  const out = await res.json();
  if (out.ok) {
    toast(`${out.moved.length} moved to a removed folder · export written to ${out.export}`);
    state.marked.clear();
    load();
  } else {
    toast('That did not work: ' + (out.error || 'unknown'));
  }
});

load();