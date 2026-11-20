// Vice Press cover engine: draws a multi-panel GTA-style poster onto any 2D canvas.
// Fully deterministic — the grain comes from a seeded generator, never Math.random,
// so the same state always exports byte-identical PNGs.

export const LAYOUTS = [
  { id: 'hero3', label: 'Hero + 3' },
  { id: 'grid4', label: 'Grid 4' },
  { id: 'grid9', label: 'Grid 9' },
  { id: 'full', label: 'Full bleed' },
  { id: 'tilt', label: 'Tilted snaps' },
];

// Each grade is a gradient map: shadows -> mids -> highlights, blended over the
// photo at `strength`. `dot` is the swatch colour shown in the editor picker.
export const GRADES = [
  { id: 'sunset', label: 'Sunset', dot: '#ff7a3d', shadow: [38, 12, 54], mid: [255, 110, 60], high: [255, 214, 130], strength: 0.62 },
  { id: 'neon', label: 'Neon', dot: '#ff2e88', shadow: [10, 8, 44], mid: [255, 46, 136], high: [120, 230, 255], strength: 0.66 },
  { id: 'vice', label: 'Vice', dot: '#b14bff', shadow: [24, 6, 58], mid: [178, 60, 255], high: [255, 150, 220], strength: 0.62 },
  { id: 'gold', label: 'Gold', dot: '#ffb02e', shadow: [46, 28, 8], mid: [255, 166, 40], high: [255, 240, 190], strength: 0.58 },
  { id: 'noir', label: 'Noir', dot: '#e8e8e8', shadow: [8, 8, 10], mid: [120, 120, 128], high: [245, 245, 245], strength: 0.7 },
];

export const SIZES = [
  { id: '1080x1080', label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
];

export const SAMPLES = ['boulevard.jpg', 'rooftop.jpg', 'neon.jpg', 'pier.jpg'];

/** Seeded pseudo-random generator (mulberry32): identical grain on every render. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Panel geometry for a layout at W x H.
 * Each panel is a rect plus the photo-slot index it shows and an optional tilt
 * (radians). The title band takes the bottom 18% unless the layout is `full`.
 */
export function layoutPanels(layout, W, H) {
  const g = Math.max(4, Math.round(W * 0.008));
  const band = layout === 'full' ? 0 : Math.round(H * 0.18);
  const areaH = H - band;
  const lastX = (x) => W - g - x; // right edge of the panel starting at x
  switch (layout) {
    case 'hero3': {
      const heroH = Math.round((areaH - 3 * g) * 0.58);
      const rowY = g + heroH + g;
      const rowH = areaH - rowY - g;
      const cellW = Math.round((W - 2 * g - 2 * g) / 3);
      const x1 = g, x2 = g + cellW + g, x3 = g + 2 * (cellW + g);
      return [
        { x: g, y: g, w: W - 2 * g, h: heroH, photo: 0, tilt: 0 },
        { x: x1, y: rowY, w: cellW, h: rowH, photo: 1, tilt: 0 },
        { x: x2, y: rowY, w: cellW, h: rowH, photo: 2, tilt: 0 },
        { x: x3, y: rowY, w: lastX(x3), h: rowH, photo: 3, tilt: 0 },
      ];
    }
    case 'grid4': {
      const cellW = Math.round((W - 2 * g - g) / 2);
      const cellH = Math.round((areaH - 2 * g - g) / 2);
      const x2 = g + cellW + g;
      const y2 = g + cellH + g;
      return [
        { x: g, y: g, w: cellW, h: cellH, photo: 0, tilt: 0 },
        { x: x2, y: g, w: lastX(x2), h: cellH, photo: 1, tilt: 0 },
        { x: g, y: y2, w: cellW, h: areaH - y2 - g, photo: 2, tilt: 0 },
        { x: x2, y: y2, w: lastX(x2), h: areaH - y2 - g, photo: 3, tilt: 0 },
      ];
    }
    case 'grid9': {
      const cellW = Math.round((W - 2 * g - 2 * g) / 3);
      const cellH = Math.round((areaH - 2 * g - 2 * g) / 3);
      const panels = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const x = g + c * (cellW + g);
          const y = g + r * (cellH + g);
          panels.push({
            x, y,
            w: c === 2 ? lastX(x) : cellW,
            h: r === 2 ? areaH - g - y : cellH,
            photo: (r * 3 + c) % 4,
            tilt: 0,
          });
        }
      }
      return panels;
    }
    case 'tilt':
      return [
        { x: Math.round(W * 0.05), y: Math.round(H * 0.03), w: Math.round(W * 0.6), h: Math.round(areaH * 0.68), photo: 0, tilt: -0.05 },
        { x: Math.round(W * 0.66), y: Math.round(H * 0.08), w: Math.round(W * 0.29), h: Math.round(areaH * 0.42), photo: 1, tilt: 0.06 },
        { x: Math.round(W * 0.58), y: Math.round(H * 0.52), w: Math.round(W * 0.37), h: Math.round(areaH * 0.3), photo: 2, tilt: -0.03 },
      ];
    case 'full':
    default:
      return [{ x: 0, y: 0, w: W, h: H, photo: 0, tilt: 0 }];
  }
}

/** 256-entry gradient-map lookup table for one grade: luminance -> [r, g, b]. */
function gradeLut(grade) {
  const lut = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    if (t < 0.5) {
      const k = t / 0.5;
      lut.push(grade.shadow.map((s, j) => s + (grade.mid[j] - s) * k));
    } else {
      const k = (t - 0.5) / 0.5;
      lut.push(grade.mid.map((s, j) => s + (grade.high[j] - s) * k));
    }
  }
  return lut;
}

const gradeCache = new Map();

/**
 * The photo cover-fitted into a w x h bitmap with the grade applied.
 * Cached per photo, grade and size, so panning and zooming reuse it and the
 * drag stays fast. The cache is capped and cleared rather than grown forever.
 */
export function gradedPhoto(photo, gradeId, w, h) {
  const key = `${photo.img.src}|${gradeId}|${w}x${h}`;
  const hit = gradeCache.get(key);
  if (hit) return hit;
  const grade = GRADES.find((g) => g.id === gradeId) ?? GRADES[0];
  const off = document.createElement('canvas');
  off.width = Math.max(2, w);
  off.height = Math.max(2, h);
  const ctx = off.getContext('2d');
  const img = photo.img;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (w - pw) / 2, (h - ph) / 2, pw, ph);
  const lut = gradeLut(grade);
  const data = ctx.getImageData(0, 0, off.width, off.height);
  const px = data.data;
  const s = grade.strength;
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]);
    const g = lut[lum];
    px[i] += (g[0] - px[i]) * s;
    px[i + 1] += (g[1] - px[i + 1]) * s;
    px[i + 2] += (g[2] - px[i + 2]) * s;
  }
  ctx.putImageData(data, 0, 0);
  if (gradeCache.size > 24) gradeCache.clear();
  gradeCache.set(key, off);
  return off;
}

/** Places the origin at a panel's top-left, applying its tilt when there is one. */
function panelTransform(ctx, panel) {
  if (panel.tilt) {
    ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
    ctx.rotate(panel.tilt);
    ctx.translate(-panel.w / 2, -panel.h / 2);
  } else {
    ctx.translate(panel.x, panel.y);
  }
}

/** One panel: the photo (panned/zoomed) with a white frame and a black keyline. */
function drawPanel(ctx, panel, photo, gradeId, W) {
  const { w, h } = panel;
  const frame = Math.max(3, Math.round(W * 0.006));
  ctx.save();
  panelTransform(ctx, panel);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.max(6, W * 0.012);
  ctx.shadowOffsetY = Math.max(3, W * 0.004);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-frame, -frame, w + 2 * frame, h + 2 * frame);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  if (!photo || !photo.img) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#3a2b5c');
    grad.addColorStop(1, '#120e1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `${Math.round(h * 0.28)}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${(panel.photo ?? 0) + 1}`, w / 2, h / 2 - h * 0.08);
    ctx.font = `${Math.max(10, Math.round(h * 0.055))}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('ADD A PHOTO', w / 2, h / 2 + h * 0.18);
  } else {
    const graded = gradedPhoto(photo, gradeId, w, h);
    const z = photo.zoom || 1;
    const sw = graded.width / z;
    const sh = graded.height / z;
    const sx = (graded.width - sw) / 2 + (photo.ox || 0) * ((graded.width - sw) / 2);
    const sy = (graded.height - sh) / 2 + (photo.oy || 0) * ((graded.height - sh) / 2);
    ctx.drawImage(graded, sx, sy, sw, sh, 0, 0, w, h);
  }
  ctx.restore();
  ctx.save();
  panelTransform(ctx, panel);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = Math.max(1.5, W * 0.002);
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();
}

/** Halftone dot strip across the top of the title band; dot size varies by column. */
function drawHalftone(ctx, x, y, w, h, W) {
  const step = Math.max(7, W * 0.014);
  for (let i = 0; i * step < w; i++) {
    const cx = x + i * step + step / 2;
    const r = step * (0.16 + 0.2 * Math.abs(Math.sin(i * 0.9)));
    ctx.fillStyle = i % 2 ? 'rgba(46,230,255,0.85)' : 'rgba(255,46,136,0.85)';
    ctx.beginPath();
    ctx.arc(cx, y + h / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

let grainTile = null;

/** A 128x128 noise tile from the seeded generator, reused as a repeat pattern. */
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(128, 128);
  const rnd = seededRandom(20261120);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = ctx.createPattern(tile, 'repeat');
  return grainTile;
}

/** Shrinks the Anton title until it fits the width; returns the size used. */
function fitTitleFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, sans-serif`;
  try { ctx.letterSpacing = '2px'; } catch { /* older canvas has no letterSpacing */ }
  while (ctx.measureText(text).width > maxWidth && size > 12) {
    size -= 2;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

/**
 * Draws the whole cover onto ctx at W x H.
 * state: { layout, grade, title, subtitle, showBadge, onePhoto, photos: [{img, name, zoom, ox, oy}] }
 */
export function drawCover(ctx, state, W, H) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const panels = layoutPanels(state.layout, W, H);
  const band = state.layout === 'full' ? 0 : Math.round(H * 0.18);
  for (const panel of panels) {
    const slot = state.onePhoto ? state.photos[0] : state.photos[panel.photo];
    drawPanel(ctx, panel, slot, state.grade, W);
  }
  // Title band: halftone strip at the top, then subtitle, stars and title each
  // on their own line with room between them, so nothing crowds the next line.
  // With the `full` layout there is no band: the words sit on a bottom scrim.
  const bandY = H - band;
  if (band > 0) {
    ctx.fillStyle = '#100b1a';
    ctx.fillRect(0, bandY, W, band);
    drawHalftone(ctx, 0, bandY, W, Math.round(band * 0.16), W);
  } else {
    const scrim = ctx.createLinearGradient(0, H * 0.62, 0, H);
    scrim.addColorStop(0, 'rgba(16,11,26,0)');
    scrim.addColorStop(1, 'rgba(16,11,26,0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.62, W, H * 0.38);
  }
  const title = (state.title || 'UNTITLED').trim().toUpperCase();
  const titleY = band > 0 ? bandY + band * 0.9 : H - H * 0.055;
  const titleSize = fitTitleFont(ctx, title, W * 0.92, Math.round(H * 0.075));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = Math.max(2, titleSize * 0.07);
  ctx.strokeText(title, W / 2, titleY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, W / 2, titleY);
  // Neon script subtitle, slightly tilted, on its own line above the stars.
  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = Math.round(H * 0.032);
    const subY = band > 0 ? bandY + band * 0.33 : titleY - titleSize * 0.95;
    ctx.save();
    ctx.translate(W / 2, subY);
    ctx.rotate(-0.03);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subSize * 0.55;
    const grad = ctx.createLinearGradient(-W * 0.25, 0, W * 0.25, 0);
    grad.addColorStop(0, '#ff7ad9');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#2ee6ff');
    ctx.fillStyle = grad;
    ctx.fillText(sub, 0, 0);
    ctx.restore();
  }
  // Heat badge: five gold stars on their own line between subtitle and title.
  if (state.showBadge) {
    const starSize = Math.round(H * 0.024);
    const starY = band > 0 ? bandY + band * 0.52 : H - H * 0.19;
    ctx.font = `${starSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb02e';
    ctx.shadowColor = 'rgba(255,176,46,0.8)';
    ctx.shadowBlur = starSize * 0.4;
    ctx.fillText('★ ★ ★ ★ ★', W / 2, starY);
    ctx.shadowBlur = 0;
  }
  // Grain + vignette finish.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/** Renders the cover at full export size and returns the canvas. */
export function exportCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), state, w, h);
  return canvas;
}

/** Which panel (if any) contains the point x, y in a W x H cover. */
export function panelAt(state, W, H, x, y) {
  const panels = layoutPanels(state.layout, W, H);
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}
