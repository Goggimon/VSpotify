// Full 8-Role Album Palette System (calculated once on album-art change, never per frame)

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function rgbToHex(r, g, b) {
  return `#${clampByte(r).toString(16).padStart(2, "0")}${clampByte(g).toString(16).padStart(2, "0")}${clampByte(b).toString(16).padStart(2, "0")}`;
}

export function hexToRgb(hex) {
  const clean = (hex || "#e4e4e7").replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0
  };
}

function luminance(c) {
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
}

function saturation(c) {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  return max === 0 ? 0 : (max - min) / max;
}

function colorDist(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function scaleRgb(c, factor) {
  return { r: clampByte(c.r * factor), g: clampByte(c.g * factor), b: clampByte(c.b * factor) };
}

function mixRgb(a, b, t) {
  return {
    r: clampByte(a.r + (b.r - a.r) * t),
    g: clampByte(a.g + (b.g - a.g) * t),
    b: clampByte(a.b + (b.b - a.b) * t)
  };
}

// Keep text palette-derived while guaranteeing crisp legibility against background
function deriveReadableInk(seed, bg, minContrastLumDiff = 138) {
  const bgLum = luminance(bg);
  let ink = { ...seed };
  if (bgLum < 128) {
    // Brighten along the album's own hue toward a soft luminous tint
    for (let step = 0; step < 8 && luminance(ink) - bgLum < minContrastLumDiff; step++) {
      ink = mixRgb(ink, { r: 248, g: 246, b: 242 }, 0.24);
    }
  } else {
    for (let step = 0; step < 8 && bgLum - luminance(ink) < minContrastLumDiff; step++) {
      ink = mixRgb(ink, { r: 16, g: 14, b: 14 }, 0.26);
    }
  }
  return ink;
}

export function extractAlbumPalette(img) {
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 48;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, 48, 48);
  const data = x.getImageData(0, 0, 48, 48).data;

  // Fine quantization (step 16) preserves close shades from monochromatic/blue/warm albums
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.round(r / 16) * 16},${Math.round(g / 16) * 16},${Math.round(b / 16) * 16}`;
    const entry = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
    entry.r += r;
    entry.g += g;
    entry.b += b;
    entry.count++;
    buckets.set(key, entry);
  }

  const swatches = Array.from(buckets.values())
    .map((e) => {
      const col = { r: e.r / e.count, g: e.g / e.count, b: e.b / e.count, count: e.count };
      return { ...col, lum: luminance(col), sat: saturation(col) };
    })
    .sort((a, b) => b.count - a.count);

  if (swatches.length === 0) return buildManualPalette("#e4e4e7", "#08080a");

  const dominant = swatches[0];
  const bgScale = dominant.lum > 140 ? 0.28 : dominant.lum > 80 ? 0.44 : dominant.lum < 28 ? 1.15 : 0.64;
  const bgRgb = scaleRgb(dominant, bgScale);
  const bgShadeRgb = scaleRgb(bgRgb, 0.62);
  const shadowRgb = scaleRgb(bgRgb, 0.35);

  // Pick close tonal shades for visualPrimary / visualSecondary (do not force clashing hues)
  const vividSwatches = swatches
    .filter((s) => s.count >= 6)
    .sort((a, b) => (b.sat * 1.4 + Math.min(1, b.count / 120) * 0.6) - (a.sat * 1.4 + Math.min(1, a.count / 120) * 0.6));

  let vis1 = vividSwatches[0] || mixRgb(dominant, { r: 235, g: 235, b: 240 }, 0.35);
  if (colorDist(vis1, bgRgb) < 95) {
    vis1 = deriveReadableInk(vis1, bgRgb, 110);
  }

  // Visual secondary: a close related shade in the album family
  let vis2 = swatches.find((s) => s !== vis1 && colorDist(s, vis1) >= 36 && colorDist(s, bgRgb) >= 75)
    || mixRgb(vis1, bgRgb, 0.32);

  // Highlight: brightest vivid peak in the palette, used sparingly for comets & beat peaks
  let hi = vividSwatches.find((s) => s.lum > 135 && colorDist(s, vis1) >= 30)
    || mixRgb(vis1, { r: 255, g: 252, b: 245 }, 0.48);

  const lyricPrimaryRgb = deriveReadableInk(vis1, bgRgb, 145);
  const lyricSecondaryRgb = mixRgb(lyricPrimaryRgb, bgRgb, 0.38);

  return {
    background: rgbToHex(bgRgb.r, bgRgb.g, bgRgb.b),
    backgroundShade: rgbToHex(bgShadeRgb.r, bgShadeRgb.g, bgShadeRgb.b),
    lyricPrimary: rgbToHex(lyricPrimaryRgb.r, lyricPrimaryRgb.g, lyricPrimaryRgb.b),
    lyricSecondary: rgbToHex(lyricSecondaryRgb.r, lyricSecondaryRgb.g, lyricSecondaryRgb.b),
    visualPrimary: rgbToHex(vis1.r, vis1.g, vis1.b),
    visualSecondary: rgbToHex(vis2.r, vis2.g, vis2.b),
    highlight: rgbToHex(hi.r, hi.g, hi.b),
    shadow: rgbToHex(shadowRgb.r, shadowRgb.g, shadowRgb.b)
  };
}

export function buildManualPalette(accentHex = "#e4e4e7", bgHex = "#08080a") {
  const acc = hexToRgb(accentHex);
  const bg = hexToRgb(bgHex);
  const bgShade = scaleRgb(bg, 0.65);
  const shadow = scaleRgb(bg, 0.35);
  const vis2 = mixRgb(acc, bg, 0.34);
  const hi = mixRgb(acc, { r: 255, g: 252, b: 245 }, 0.45);
  const lyr1 = deriveReadableInk(acc, bg, 145);
  const lyr2 = mixRgb(lyr1, bg, 0.38);

  return {
    background: rgbToHex(bg.r, bg.g, bg.b),
    backgroundShade: rgbToHex(bgShade.r, bgShade.g, bgShade.b),
    lyricPrimary: rgbToHex(lyr1.r, lyr1.g, lyr1.b),
    lyricSecondary: rgbToHex(lyr2.r, lyr2.g, lyr2.b),
    visualPrimary: rgbToHex(acc.r, acc.g, acc.b),
    visualSecondary: rgbToHex(vis2.r, vis2.g, vis2.b),
    highlight: rgbToHex(hi.r, hi.g, hi.b),
    shadow: rgbToHex(shadow.r, shadow.g, shadow.b)
  };
}

export function applyPaletteToDocument(roles) {
  const root = document.documentElement.style;
  const setVar = (name, hex) => {
    root.setProperty(name, hex);
    const { r, g, b } = hexToRgb(hex);
    root.setProperty(`${name}-rgb`, `${r}, ${g}, ${b}`);
  };

  setVar("--bg-primary", roles.background);
  setVar("--bg-shade", roles.backgroundShade);
  setVar("--lyric-primary", roles.lyricPrimary);
  setVar("--lyric-secondary", roles.lyricSecondary);
  setVar("--visual-primary", roles.visualPrimary);
  setVar("--visual-secondary", roles.visualSecondary);
  setVar("--highlight", roles.highlight);
  setVar("--palette-shadow", roles.shadow);
  setVar("--accent", roles.visualPrimary);
}
