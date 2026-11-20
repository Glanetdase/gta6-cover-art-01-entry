// Vice Press editor: wires the controls to the cover engine, keeps a live preview,
// and exports the cover as PNGs. Photos never leave the machine.
import { LAYOUTS, GRADES, SIZES, SAMPLES, drawCover, exportCover, panelAt, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');

const imageCache = new Map();

/** Loads an image by URL, cached so undo/redo and re-renders never refetch. */
export function loadImage(src) {
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

function blankPhoto() {
  return { img: null, src: '', name: '', zoom: 1, ox: 0, oy: 0 };
}

const state = {
  layout: 'hero3',
  grade: 'sunset',
  title: 'NEON SHORE',
  subtitle: 'one last summer',
  showBadge: true,
  onePhoto: false,
  size: '1080x1350',
  active: 0,
  photos: [blankPhoto(), blankPhoto(), blankPhoto(), blankPhoto()],
};

let undoStack = [];
let redoStack = [];

/** A JSON snapshot of everything undo needs to restore: words, choices, crops. */
function snapshot() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade, title: state.title,
    subtitle: state.subtitle, showBadge: state.showBadge, onePhoto: state.onePhoto,
    size: state.size, active: state.active,
    photos: state.photos.map((p) => ({ src: p.src, name: p.name, zoom: p.zoom, ox: p.ox, oy: p.oy })),
  });
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}

async function restore(json) {
  const s = JSON.parse(json);
  state.layout = s.layout; state.grade = s.grade; state.title = s.title;
  state.subtitle = s.subtitle; state.showBadge = s.showBadge; state.onePhoto = s.onePhoto;
  state.size = s.size; state.active = s.active;
  for (let i = 0; i < 4; i++) {
    const p = s.photos[i];
    state.photos[i] = { img: null, src: p.src, name: p.name, zoom: p.zoom, ox: p.ox, oy: p.oy };
    if (p.src) state.photos[i].img = await loadImage(p.src);
  }
  syncControls();
  redraw();
}

function syncUndoButtons() {
  $('undo').disabled = undoStack.length === 0;
  $('redo').disabled = redoStack.length === 0;
}

/** Preview canvas follows the chosen export size's aspect, capped at 540 px long side. */
function previewSize() {
  const size = SIZES.find((s) => s.id === state.size) ?? SIZES[1];
  const scale = 540 / Math.max(size.w, size.h);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function redraw() {
  const { w, h } = previewSize();
  if (preview.width !== w || preview.height !== h) {
    preview.width = w;
    preview.height = h;
  }
  drawCover(pctx, state, w, h);
  const active = state.photos[state.active];
  $('zoom').value = String(active.zoom || 1);
  $('zoomVal').textContent = `${(active.zoom || 1).toFixed(2)}×`;
  renderSlots();
}

function renderSlots() {
  const box = $('slots');
  box.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot' + (i === state.active ? ' active' : '');
    btn.title = photo.name || `Slot ${i + 1} (empty)`;
    if (photo.img) {
      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.name;
      btn.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.className = 'empty';
      span.textContent = '+';
      btn.appendChild(span);
    }
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = photo.name || `slot ${i + 1}`;
    btn.appendChild(tag);
    btn.addEventListener('click', () => { state.active = i; redraw(); });
    box.appendChild(btn);
  });
}

function buildPickers() {
  const layouts = $('layouts');
  LAYOUTS.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (l.id === state.layout ? ' active' : '');
    b.textContent = l.label;
    b.addEventListener('click', () => { pushHistory(); state.layout = l.id; syncControls(); redraw(); });
    layouts.appendChild(b);
  });
  const grades = $('grades');
  GRADES.forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick swatch' + (g.id === state.grade ? ' active' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = `linear-gradient(135deg, ${g.dot}, #2ee6ff)`;
    b.appendChild(dot);
    b.appendChild(document.createTextNode(g.label));
    b.addEventListener('click', () => { pushHistory(); state.grade = g.id; syncControls(); redraw(); });
    grades.appendChild(b);
  });
  const sizes = $('sizes');
  SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (s.id === state.size ? ' active' : '');
    b.textContent = s.label;
    b.addEventListener('click', () => { pushHistory(); state.size = s.id; syncControls(); redraw(); });
    sizes.appendChild(b);
  });
}

export function syncControls() {
  document.querySelectorAll('#layouts .pick').forEach((b, i) => b.classList.toggle('active', LAYOUTS[i].id === state.layout));
  document.querySelectorAll('#grades .pick').forEach((b, i) => b.classList.toggle('active', GRADES[i].id === state.grade));
  document.querySelectorAll('#sizes .pick').forEach((b, i) => b.classList.toggle('active', SIZES[i].id === state.size));
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('showBadge').checked = state.showBadge;
}

function setStatus(text) {
  $('status').textContent = text;
}

async function loadSamples() {
  pushHistory();
  for (let i = 0; i < SAMPLES.length; i++) {
    const src = `samples/${SAMPLES[i]}`;
    const img = await loadImage(src);
    state.photos[i] = { img, src, name: SAMPLES[i].replace('.jpg', ''), zoom: 1, ox: 0, oy: 0 };
  }
  redraw();
  setStatus('Loaded the 4 sample photos.');
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function exportOne(sizeId) {
  return new Promise((resolve) => {
    const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[1];
    const canvas = exportCover(state, size.w, size.h);
    canvas.toBlob((blob) => {
      download(blob, `vice-press-${size.w}x${size.h}.png`);
      setStatus(`Saved vice-press-${size.w}x${size.h}.png`);
      resolve(blob);
    }, 'image/png');
  });
}

async function exportAll() {
  setStatus('Exporting 3 sizes…');
  for (const size of SIZES) {
    await exportOne(size.id);
    await new Promise((r) => setTimeout(r, 350));
  }
  setStatus('Saved all 3 sizes.');
}

// Photo upload into the active slot.
$('upload').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  pushHistory();
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  state.photos[state.active] = { img, src: url, name: file.name.replace(/\.[^.]+$/, ''), zoom: 1, ox: 0, oy: 0 };
  redraw();
  setStatus(`Loaded ${file.name} into slot ${state.active + 1}.`);
  e.target.value = '';
});

$('useSamples').addEventListener('click', loadSamples);
$('onePhotoAll').addEventListener('click', () => {
  pushHistory();
  state.onePhoto = !state.onePhoto;
  $('onePhotoAll').textContent = state.onePhoto ? 'One photo: ON — click to use all 4' : 'One photo, all panels';
  redraw();
  setStatus(state.onePhoto ? 'Every panel now shows slot 1.' : 'Panels use their own photos again.');
});

$('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
$('title').addEventListener('change', pushHistory);
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
$('subtitle').addEventListener('change', pushHistory);
$('showBadge').addEventListener('change', (e) => { pushHistory(); state.showBadge = e.target.checked; redraw(); });
$('zoom').addEventListener('input', (e) => {
  state.photos[state.active].zoom = Number(e.target.value);
  redraw();
});
$('zoom').addEventListener('change', pushHistory);
$('fitPhoto').addEventListener('click', () => {
  pushHistory();
  const p = state.photos[state.active];
  p.zoom = 1; p.ox = 0; p.oy = 0;
  redraw();
});
$('undo').addEventListener('click', async () => {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  await restore(undoStack.pop());
  syncUndoButtons();
});
$('redo').addEventListener('click', async () => {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  await restore(redoStack.pop());
  syncUndoButtons();
});
$('exportOne').addEventListener('click', () => exportOne(state.size));
$('exportAll').addEventListener('click', exportAll);

// Keyboard undo/redo: Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) to redo.
document.addEventListener('keydown', async (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.target.matches('input, textarea')) return;
  if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    await restore(undoStack.pop());
    syncUndoButtons();
  } else if ((e.key.toLowerCase() === 'y') || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
    e.preventDefault();
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    await restore(redoStack.pop());
    syncUndoButtons();
  }
});

// Drag a panel to pan its photo; click a panel to select its slot.
let drag = null;
function canvasPoint(e) {
  const rect = preview.getBoundingClientRect();
  const scaleX = preview.width / rect.width;
  const scaleY = preview.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}
preview.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const panelIndex = panelAt(state, preview.width, preview.height, pt.x, pt.y);
  if (panelIndex < 0) return;
  const panels = layoutPanels(state.layout, preview.width, preview.height);
  const slot = state.onePhoto ? 0 : panels[panelIndex].photo;
  state.active = slot;
  const photo = state.photos[slot];
  drag = { slot, startX: pt.x, startY: pt.y, ox: photo.ox || 0, oy: photo.oy || 0, panel: panels[panelIndex] };
  preview.setPointerCapture(e.pointerId);
  redraw();
});
preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = canvasPoint(e);
  const photo = state.photos[drag.slot];
  const dx = (pt.x - drag.startX) / drag.panel.w;
  const dy = (pt.y - drag.startY) / drag.panel.h;
  photo.ox = Math.max(-1, Math.min(1, drag.ox - dx * 2));
  photo.oy = Math.max(-1, Math.min(1, drag.oy - dy * 2));
  redraw();
});
preview.addEventListener('pointerup', () => {
  if (!drag) return;
  drag = null;
  pushHistory();
});

// Test/screenshot hook: renders the exact export and returns a PNG data URL.
window.__vicePress = {
  state,
  async exportPNG(sizeId) {
    const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[1];
    const canvas = exportCover(state, size.w, size.h);
    return canvas.toDataURL('image/png');
  },
  async applyShot(shotState) {
    pushHistory();
    Object.assign(state, shotState);
    syncControls();
    redraw();
  },
};

buildPickers();
syncUndoButtons();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  await runShot(shot, new URLSearchParams(location.search), { loadImage, loadSamples, state, redraw, setStatus, syncControls });
} else {
  // First paint: wait for the display fonts so the preview is lettered, not fallback.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('80px Anton'), document.fonts.load('32px Pacifico')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fall back to system fonts */ }
  await loadSamples();
  redraw();
}
