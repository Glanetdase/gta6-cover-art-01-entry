// Vice Press — cover engine: layouts, gradient-map grades, lettering, halftone, grain.
// Everything is drawn on canvas with the app's own files only; no network, no library.
// The grain and every random choice come from a seeded PRNG, so the same state
// always renders the same pixels.

export const SEED = 20261120;

export const LAYOUTS = ['hero3', 'grid4', 'grid9', 'fullbleed', 'tilted'];

export const LAYOUT_LABELS = {
  hero3: 'Hero + 3',
  grid4: 'Grid 4',
  grid9: 'Grid 9',
  fullbleed: 'Full bleed',
  tilted: 'Tilted snaps',
};

export const GRADES = ['sunset', 'neon', 'vice', 'gold', 'noir'];

export const GRADE_LABELS = {
  sunset: 'Sunset',
  neon: 'Neon',
  vice: 'Vice',
  gold: 'Gold',
  noir: 'Noir',
};

// Gradient-map ramps: [stop, red, green, blue]. Luminance in, colour out.
const RAMPS = {
  sunset: [
    [0, 18, 8, 34],
    [0.32, 118, 26, 80],
    [0.62, 232, 92, 52],
    [0.85, 255, 178, 92],
    [1, 255, 242, 205],
  ],
  neon: [
    [0, 8, 6, 30],
    [0.32, 42, 22, 122],
    [0.62, 150, 42, 222],
    [0.85, 62, 232, 255],
    [1, 224, 255, 242],
  ],
  vice: [
    [0, 26, 6, 42],
    [0.32, 122, 22, 112],
    [0.62, 232, 42, 132],
    [0.85, 255, 122, 192],
    [1, 255, 222, 236],
  ],
  gold: [
    [0, 28, 19, 9],
    [0.32, 92, 62, 22],
    [0.62, 192, 132, 42],
    [0.85, 255, 202, 92],
    [1, 255, 245, 202],
  ],
  noir: [
    [0, 5, 5, 9],
    [0.32, 46, 46, 56],
    [0.62, 122, 122, 132],
    [0.85, 202, 202, 212],
    [1, 246, 246, 250],
  ],
};

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lutCache = new Map();

function rampLUT(grade) {
  if (lutCache.has(grade)) return lutCache.get(grade);
  const stops = RAMPS[grade] || RAMPS.sunset;
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        a = stops[s];
        b = stops[s + 1];
        break;
      }
    }
    const f = Math.min(1, Math.max(0, (t - a[0]) / Math.max(1e-6, b[0] - a[0])));
    lut[i * 3] = Math.round(a[1] + (b[1] - a[1]) * f);
    lut[i * 3 + 1] = Math.round(a[2] + (b[2] - a[2]) * f);
    lut[i * 3 + 2] = Math.round(a[3] + (b[3] - a[3]) * f);
  }
  lutCache.set(grade, lut);
  return lut;
}

// Paint one photo into a panel, gradient-mapped. crop = {x, y, zoom} with
// x, y in [-1, 1] (pan as a fraction of the source) and zoom >= 1.
export function paintPhoto(ctx, img, px, py, pw, ph, grade, crop) {
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(pw));
  off.height = Math.max(2, Math.round(ph));
  const octx = off.getContext('2d');
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = Math.max(1, crop && crop.zoom ? crop.zoom : 1);
  const base = Math.max(pw / iw, ph / ih) * zoom;
  const sw = pw / base;
  const sh = ph / base;
  const cx = iw / 2 + (crop && crop.x ? crop.x : 0) * (iw - sw) / 2;
  const cy = ih / 2 + (crop && crop.y ? crop.y : 0) * (ih - sh) / 2;
  const sx = Math.min(Math.max(0, cx - sw / 2), Math.max(0, iw - sw));
  const sy = Math.min(Math.max(0, cy - sh / 2), Math.max(0, ih - sh));
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, off.width, off.height);
  const data = octx.getImageData(0, 0, off.width, off.height);
  const lut = rampLUT(grade);
  const pxd = data.data;
  for (let i = 0; i < pxd.length; i += 4) {
    const lum = Math.round(0.2126 * pxd[i] + 0.7152 * pxd[i + 1] + 0.0722 * pxd[i + 2]);
    pxd[i] = lut[lum * 3];
    pxd[i + 1] = lut[lum * 3 + 1];
    pxd[i + 2] = lut[lum * 3 + 2];
  }
  octx.putImageData(data, 0, 0);
  ctx.drawImage(off, px, py, pw, ph);
}

// Panel rectangles for a layout inside a w x h cover. Each panel names the
// photo slot it shows, its rotation in degrees and its white border.
export function layoutPanels(layout, w, h) {
  const gap = Math.round(Math.min(w, h) * 0.012);
  const panels = [];
  if (layout === 'hero3') {
    const heroH = Math.round(h * 0.64);
    panels.push({ x: 0, y: 0, w, h: heroH, slot: 0, rot: 0, border: 0 });
    const sw = (w - gap * 2) / 3;
    for (let i = 0; i < 3; i++) {
      panels.push({ x: i * (sw + gap), y: heroH + gap, w: sw, h: h - heroH - gap, slot: 1 + i, rot: 0, border: 0 });
    }
  } else if (layout === 'grid4') {
    const cw = (w - gap) / 2;
    const ch = (h - gap) / 2;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        panels.push({ x: c * (cw + gap), y: r * (ch + gap), w: cw, h: ch, slot: r * 2 + c, rot: 0, border: 0 });
      }
    }
  } else if (layout === 'grid9') {
    const cw = (w - gap * 2) / 3;
    const ch = (h - gap * 2) / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        panels.push({ x: c * (cw + gap), y: r * (ch + gap), w: cw, h: ch, slot: (r * 3 + c) % 4, rot: 0, border: 0 });
      }
    }
  } else if (layout === 'fullbleed') {
    panels.push({ x: 0, y: 0, w, h, slot: 0, rot: 0, border: 0 });
  } else {
    // tilted: four snaps leaning on each other, each with a white frame.
    const bw = Math.round(w * 0.44);
    const bh = Math.round(h * 0.42);
    const frame = Math.round(Math.min(w, h) * 0.014);
    panels.push({ x: Math.round(w * 0.05), y: Math.round(h * 0.05), w: bw, h: bh, slot: 0, rot: -6, border: frame });
    panels.push({ x: Math.round(w * 0.5), y: Math.round(h * 0.08), w: bw, h: bh, slot: 1, rot: 5, border: frame });
    panels.push({ x: Math.round(w * 0.08), y: Math.round(h * 0.5), w: bw, h: bh, slot: 2, rot: 4, border: frame });
    panels.push({ x: Math.round(w * 0.47), y: Math.round(h * 0.48), w: bw, h: bh, slot: 3, rot: -4, border: frame });
  }
  return panels;
}

function drawHalftone(ctx, x, y, w, h, rng) {
  const step = Math.max(7, Math.round(Math.min(w, h) * 0.018));
  ctx.save();
  for (let row = 0; row * step < h; row++) {
    for (let col = 0; col * step < w; col++) {
      const fade = 1 - row * step / Math.max(1, h);
      const r = Math.max(0.4, step * 0.32 * fade * (0.75 + rng() * 0.5));
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x + col * step + step / 2, y + row * step + step / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawGrain(ctx, w, h, rng) {
  const count = Math.round((w * h) / 1100);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const v = rng();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 1.6, 1 + rng() * 1.6);
  }
  ctx.restore();
}

function fitFont(ctx, text, maxWidth, startPx, family, weight) {
  let px = startPx;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

// Draw the whole cover. state: {layout, grade, title, subtitle, badge,
// photos: [img...], crops: [{x,y,zoom}...]}. Deterministic for fixed state.
export function drawCover(ctx, w, h, state) {
  const rng = mulberry32(SEED);
  const layout = state.layout || 'hero3';
  const grade = state.grade || 'sunset';
  const photos = state.photos || [];
  const crops = state.crops || [];
  const panels = layoutPanels(layout, w, h);

  ctx.save();
  ctx.fillStyle = '#0d0b16';
  ctx.fillRect(0, 0, w, h);

  for (const p of panels) {
    const img = photos[p.slot];
    if (!img) continue;
    ctx.save();
    if (p.rot) {
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.translate(-p.w / 2, -p.h / 2);
    } else {
      ctx.translate(p.x, p.y);
    }
    if (p.border) {
      ctx.fillStyle = '#f5f0e6';
      ctx.fillRect(-p.border, -p.border, p.w + p.border * 2, p.h + p.border * 2);
    }
    // Clip to the photo area, then paint the graded photo inside.
    ctx.beginPath();
    ctx.rect(0, 0, p.w, p.h);
    ctx.clip();
    const sub = ctx;
    const inner = document.createElement('canvas');
    inner.width = Math.max(2, Math.round(p.w));
    inner.height = Math.max(2, Math.round(p.h));
    const ictx = inner.getContext('2d');
    paintPhoto(ictx, img, 0, 0, inner.width, inner.height, grade, crops[p.slot]);
    sub.drawImage(inner, 0, 0);
    ctx.restore();
  }

  // Bottom scrim so the caption stays readable on any photo.
  const bandH = Math.round(h * 0.24);
  const bandY = h - bandH;
  const scrim = ctx.createLinearGradient(0, bandY - bandH * 0.5, 0, h);
  scrim.addColorStop(0, 'rgba(8,6,18,0)');
  scrim.addColorStop(1, 'rgba(8,6,18,0.82)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY - bandH * 0.5, w, bandH * 1.5);

  // Halftone strip above the title.
  const stripH = Math.round(h * 0.045);
  drawHalftone(ctx, Math.round(w * 0.06), bandY - stripH - Math.round(h * 0.012), Math.round(w * 0.5), stripH, rng);

  // Title in Anton, subtitle in Pacifico.
  const pad = Math.round(w * 0.06);
  const title = (state.title || 'NEON SHORE').toUpperCase();
  const titlePx = fitFont(ctx, title, w - pad * 2, Math.round(h * 0.085), 'Anton, sans-serif', 400);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(10,6,20,0.9)';
  ctx.lineWidth = Math.max(2, titlePx * 0.09);
  ctx.fillStyle = '#fff7ea';
  const titleY = h - Math.round(h * 0.085);
  ctx.strokeText(title, pad, titleY);
  ctx.fillText(title, pad, titleY);

  const subtitle = state.subtitle || '';
  if (subtitle) {
    const subPx = fitFont(ctx, subtitle, w - pad * 2, Math.round(h * 0.038), 'Pacifico, cursive', 400);
    ctx.font = `${subPx}px Pacifico, cursive`;
    ctx.fillStyle = '#ffd7ef';
    ctx.strokeStyle = 'rgba(10,6,20,0.75)';
    ctx.lineWidth = Math.max(1, subPx * 0.08);
    const subY = h - Math.round(h * 0.028);
    ctx.strokeText(subtitle, pad, subY);
    ctx.fillText(subtitle, pad, subY);
  }

  // Heat badge: five stars in a pill, top right.
  if (state.badge !== false) {
    const label = '★★★★★';
    const bPx = Math.round(h * 0.026);
    ctx.font = `${bPx}px sans-serif`;
    const tw = ctx.measureText(label).width;
    const bw = tw + bPx * 1.1;
    const bh = bPx * 1.9;
    const bx = w - bw - Math.round(w * 0.04);
    const by = Math.round(h * 0.035);
    ctx.fillStyle = 'rgba(12,8,24,0.72)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.strokeStyle = '#ff4fd8';
    ctx.lineWidth = Math.max(1, bPx * 0.06);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Wordmark, small, bottom right.
  const wmPx = Math.max(11, Math.round(h * 0.016));
  ctx.font = `400 ${wmPx}px Anton, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'right';
  ctx.fillText('VICE PRESS', w - pad, h - Math.round(h * 0.02));
  ctx.textAlign = 'left';

  drawGrain(ctx, w, h, rng);
  ctx.restore();
}
