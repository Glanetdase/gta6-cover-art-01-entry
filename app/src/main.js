// Vice Press — editor: photo slots, drag crop, zoom, undo/redo, export.
// The editor owns the state; the cover engine (cover.js) owns the drawing.

import { drawCover, layoutPanels, LAYOUTS, LAYOUT_LABELS, GRADES, GRADE_LABELS } from './cover.js';
import { shotParams } from './shots.js';

const SAMPLES = ['samples/boulevard.jpg', 'samples/neon.jpg', 'samples/pier.jpg', 'samples/rooftop.jpg'];
const SLOT_NAMES = ['Boulevard', 'Neon', 'Pier', 'Rooftop'];

const EXPORT_SIZES = {
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  square: { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
};

function freshState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    title: 'NEON SHORE',
    subtitle: 'a vice city story',
    badge: true,
    size: 'portrait',
    activeSlot: 0,
    crops: SAMPLES.map(() => ({ x: 0, y: 0, zoom: 1 })),
  };
}

const state = freshState();
let photos = [];
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 40;
let coverMode = false;

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');

function snapshot() {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    size: state.size,
    crops: state.crops,
  });
}

function restore(json) {
  const s = JSON.parse(json);
  state.layout = s.layout;
  state.grade = s.grade;
  state.title = s.title;
  state.subtitle = s.subtitle;
  state.badge = s.badge;
  state.size = s.size;
  state.crops = s.crops;
  syncControls();
}

function commit() {
  undoStack.push(snapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  render();
  updateHistoryButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  render();
  updateHistoryButtons();
}

function updateHistoryButtons() {
  $('undoBtn').disabled = undoStack.length === 0;
  $('redoBtn').disabled = redoStack.length === 0;
}

function sizeOf() {
  return EXPORT_SIZES[state.size] || EXPORT_SIZES.portrait;
}

function render() {
  const { w, h } = sizeOf();
  if (coverMode) {
    // Full-window cover: the canvas is the viewport, so the shot is the art.
    preview.width = window.innerWidth;
    preview.height = window.innerHeight;
    preview.style.width = '100vw';
    preview.style.height = '100vh';
  } else {
    const maxW = 620;
    const maxH = 620;
    const scale = Math.min(maxW / w, maxH / h);
    preview.width = Math.round(w * scale);
    preview.height = Math.round(h * scale);
  }
  drawCover(pctx, preview.width, preview.height, {
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    photos,
    crops: state.crops,
  });
  const active = $('activeSlot');
  if (active) active.textContent = SLOT_NAMES[state.activeSlot];
}

function syncControls() {
  document.querySelectorAll('#layoutGroup button').forEach((b) => {
    b.classList.toggle('on', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#gradeGroup button').forEach((b) => {
    b.classList.toggle('on', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('#sizeGroup button').forEach((b) => {
    b.classList.toggle('on', b.dataset.size === state.size);
  });
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('badgeToggle').checked = state.badge;
  const crop = state.crops[state.activeSlot];
  $('zoomRange').value = String(Math.round(crop.zoom * 100));
  $('zoomVal').textContent = `${Math.round(crop.zoom * 100)}%`;
  document.querySelectorAll('#photoGroup button').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.slot) === state.activeSlot);
  });
}

function renderOffscreen(sizeName) {
  const { w, h } = EXPORT_SIZES[sizeName];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  drawCover(c.getContext('2d'), w, h, {
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    photos,
    crops: state.crops,
  });
  return c;
}

function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function exportPNG(sizeName) {
  const canvas = renderOffscreen(sizeName);
  const blob = await canvasBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vice-press-${sizeName}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob;
}

// Hit-test the preview: which panel (and slot) is under the pointer.
function panelAt(clientX, clientY) {
  const rect = preview.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * preview.width;
  const y = ((clientY - rect.top) / rect.height) * preview.height;
  const panels = layoutPanels(state.layout, preview.width, preview.height);
  for (const p of panels) {
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return p;
  }
  return null;
}

function buildControls() {
  const layoutGroup = $('layoutGroup');
  for (const key of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.layout = key;
    b.textContent = LAYOUT_LABELS[key];
    b.addEventListener('click', () => {
      if (state.layout === key) return;
      commit();
      state.layout = key;
      syncControls();
      render();
    });
    layoutGroup.appendChild(b);
  }

  const gradeGroup = $('gradeGroup');
  for (const key of GRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.grade = key;
    b.textContent = GRADE_LABELS[key];
    b.addEventListener('click', () => {
      if (state.grade === key) return;
      commit();
      state.grade = key;
      syncControls();
      render();
    });
    gradeGroup.appendChild(b);
  }

  const photoGroup = $('photoGroup');
  SAMPLES.forEach((src, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.slot = String(i);
    const img = document.createElement('img');
    img.src = src;
    img.alt = SLOT_NAMES[i];
    b.appendChild(img);
    const span = document.createElement('span');
    span.textContent = SLOT_NAMES[i];
    b.appendChild(span);
    b.addEventListener('click', () => {
      state.activeSlot = i;
      syncControls();
      render();
    });
    photoGroup.appendChild(b);
  });

  const sizeGroup = $('sizeGroup');
  for (const key of Object.keys(EXPORT_SIZES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.size = key;
    b.textContent = EXPORT_SIZES[key].label;
    b.addEventListener('click', () => {
      if (state.size === key) return;
      commit();
      state.size = key;
      syncControls();
      render();
    });
    sizeGroup.appendChild(b);
  }

  $('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value;
    render();
  });
  $('titleInput').addEventListener('change', () => commit());
  $('subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    render();
  });
  $('subtitleInput').addEventListener('change', () => commit());
  $('badgeToggle').addEventListener('change', (e) => {
    commit();
    state.badge = e.target.checked;
    render();
  });
  $('zoomRange').addEventListener('input', (e) => {
    state.crops[state.activeSlot].zoom = Number(e.target.value) / 100;
    $('zoomVal').textContent = `${e.target.value}%`;
    render();
  });
  $('zoomRange').addEventListener('change', () => commit());
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('exportBtn').addEventListener('click', () => exportPNG(state.size));

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault();
      redo();
    }
  });

  let drag = null;
  preview.addEventListener('pointerdown', (e) => {
    const p = panelAt(e.clientX, e.clientY);
    if (!p) return;
    commit();
    state.activeSlot = p.slot;
    syncControls();
    drag = { slot: p.slot, lastX: e.clientX, lastY: e.clientY };
    preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = preview.getBoundingClientRect();
    const dx = ((e.clientX - drag.lastX) / rect.width) * 2;
    const dy = ((e.clientY - drag.lastY) / rect.height) * 2;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    const crop = state.crops[drag.slot];
    crop.x = Math.min(1, Math.max(-1, crop.x + dx));
    crop.y = Math.min(1, Math.max(-1, crop.y + dy));
    render();
  });
  preview.addEventListener('pointerup', () => {
    drag = null;
  });
}

function loadPhotos() {
  return Promise.all(
    SAMPLES.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        }),
    ),
  );
}

async function boot() {
  buildControls();
  photos = (await loadPhotos()).filter(Boolean);
  const params = shotParams();
  if (params.mode === 'cover') {
    coverMode = true;
    document.body.classList.add('cover-mode');
  }
  if (params.layout && LAYOUTS.includes(params.layout)) state.layout = params.layout;
  if (params.grade && GRADES.includes(params.grade)) state.grade = params.grade;
  if (params.title) state.title = params.title;
  if (params.subtitle !== undefined) state.subtitle = params.subtitle;
  if (params.badge === 'off') state.badge = false;
  if (params.badge === 'on') state.badge = true;
  if (params.size && EXPORT_SIZES[params.size]) state.size = params.size;
  syncControls();
  updateHistoryButtons();
  await document.fonts.ready;
  render();

  window.__vicePress = {
    state,
    exportPNG,
    renderOffscreen,
    applyShot: (next) => {
      commit();
      if (next.layout) state.layout = next.layout;
      if (next.grade) state.grade = next.grade;
      if (next.title) state.title = next.title;
      if (next.subtitle !== undefined) state.subtitle = next.subtitle;
      if (next.badge === false || next.badge === true) state.badge = next.badge;
      if (next.size) state.size = next.size;
      syncControls();
      render();
    },
  };
  window.__vicePressReady = true;
}

boot();
