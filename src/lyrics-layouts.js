// 14 Distinct Lyric Scene Renderers (No word-level karaoke highlighting)

function makeEl(tag, className, text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) {
    el.textContent = text;
    el.dir = "auto";
  }
  return el;
}

function getWindowIndices(lines, activeIdx, before = 1, after = 1) {
  if (!lines || lines.length === 0) return [];
  const center = activeIdx >= 0 ? activeIdx : 0;
  const start = Math.max(0, center - before);
  const end = Math.min(lines.length - 1, center + after);
  const out = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

// Compute inferred line travel progress (0..1) weighted by word length & punctuation pauses
function computeInferredPhraseProgress(line, posMs) {
  if (!line || line.startMs === null) return 0;
  const dur = Math.max(800, (line.endMs || line.startMs + 4000) - line.startMs);
  return Math.max(0, Math.min(1, (posMs - line.startMs) / dur));
}

function buildWeightedWordProgressStops(words) {
  if (!words || words.length === 0) return [0];
  const weights = words.map((w) => {
    const base = Math.max(2, w.text.length);
    const pause = /[,;:.!?…—-]$/.test(w.text) ? 2.5 : 0;
    return base + pause;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return weights.map((w) => {
    const stop = acc / total;
    acc += w;
    return stop;
  });
}

// 1. Connected Zigzag (Flagship)
const connectedZigzag = {
  id: "connected-zigzag",
  name: "Connected Zigzag",
  description: "Spatial left/right word route with a glowing SVG connector and traveling comet.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "medium",

  mount(ctx) {
    ctx.state = { lastKey: null, nodes: [], pathEl: null, trailEl: null, cometEl: null, pathLen: 0 };
  },

  update(ctx) {
    const { contentEl, svgEl, doc, activeIdx, posMs, rect, bands, motionLevel, connectorStrength, staticIndex } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const line = doc.lines[idx];
    if (!line) return;

    const key = `${doc.trackKey}:${idx}:${Math.round(rect.width)}:${rect.isNarrow}`;
    if (ctx.state.lastKey !== key) {
      ctx.state.lastKey = key;
      contentEl.replaceChildren();
      svgEl.replaceChildren();

      const wrap = makeEl("div", "lyrics-zigzag-wrap");
      const prevLine = doc.lines[idx - 1];
      const nextLine = doc.lines[idx + 1];

      if (prevLine) {
        wrap.appendChild(makeEl("div", "lyrics-zigzag-ghost lyrics-zigzag-prev", prevLine.text));
      }

      const routeBox = makeEl("div", "lyrics-zigzag-route");
      const words = line.words && line.words.length > 0 ? line.words : [{ text: line.text }];
      const isShort = rect.isNarrow || words.length <= 2;
      const spread = Math.min(rect.width * 0.28, isShort ? 70 : 170);

      const wordEls = words.map((w, i) => {
        const span = makeEl("span", "lyrics-zigzag-word", w.text);
        const side = i % 2 === 0 ? -1 : 1;
        const jitter = ((i * 37) % 19) - 9;
        const offsetX = words.length === 1 ? 0 : side * (spread * 0.55 + jitter);
        span.style.transform = `translate3d(${offsetX}px, 0, 0)`;
        routeBox.appendChild(span);
        return { span, offsetX };
      });

      wrap.appendChild(routeBox);
      if (nextLine) {
        wrap.appendChild(makeEl("div", "lyrics-zigzag-ghost lyrics-zigzag-next", nextLine.text));
      }
      contentEl.appendChild(wrap);

      // Measure DOM positions after layout and build smooth cubic SVG connector
      const stageRect = svgEl.getBoundingClientRect();
      const centers = wordEls.map(({ span }) => {
        const r = span.getBoundingClientRect();
        return {
          x: r.left - stageRect.left + r.width / 2,
          y: r.top - stageRect.top + r.height / 2
        };
      });

      if (centers.length >= 1) {
        const ns = "http://www.w3.org/2000/svg";
        let d = `M ${centers[0].x.toFixed(1)} ${centers[0].y.toFixed(1)}`;
        for (let i = 1; i < centers.length; i++) {
          const p0 = centers[i - 1];
          const p1 = centers[i];
          const midY = (p0.y + p1.y) / 2;
          d += ` C ${p0.x.toFixed(1)} ${midY.toFixed(1)}, ${p1.x.toFixed(1)} ${midY.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
        }

        const trail = document.createElementNS(ns, "path");
        trail.setAttribute("d", d);
        trail.setAttribute("class", "lyrics-zigzag-trail");

        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", d);
        path.setAttribute("class", "lyrics-zigzag-path");

        const comet = document.createElementNS(ns, "circle");
        comet.setAttribute("r", "5");
        comet.setAttribute("class", "lyrics-zigzag-comet");

        svgEl.appendChild(trail);
        svgEl.appendChild(path);
        if (doc.timing === "line" && !ctx.reducedMotion) {
          svgEl.appendChild(comet);
        }

        ctx.state.pathEl = path;
        ctx.state.trailEl = trail;
        ctx.state.cometEl = comet;
        ctx.state.pathLen = path.getTotalLength ? path.getTotalLength() : 0;
        ctx.state.stops = buildWeightedWordProgressStops(words);
      }
    }

    // Animate comet & subtle audio-reactive connector glow (never recoloring words!)
    const { pathEl, cometEl, pathLen } = ctx.state;
    if (pathEl) {
      const bassGlow = 1.5 + (bands.bass || 0) * 2.2 * connectorStrength;
      pathEl.style.strokeWidth = `${bassGlow.toFixed(2)}px`;
      pathEl.style.opacity = `${Math.min(0.95, 0.45 * connectorStrength + 0.25)}`;
    }
    if (cometEl && pathEl && pathLen > 0 && doc.timing === "line" && !ctx.reducedMotion) {
      const progress = computeInferredPhraseProgress(line, posMs);
      const pt = pathEl.getPointAtLength(progress * pathLen);
      cometEl.setAttribute("cx", pt.x.toFixed(1));
      cometEl.setAttribute("cy", pt.y.toFixed(1));
    }
    if (!ctx.reducedMotion && motionLevel > 0) {
      const drift = Math.sin(performance.now() * 0.0012) * (bands.mids || 0) * 6 * motionLevel;
      contentEl.style.transform = `translate3d(${drift.toFixed(1)}px, 0, 0)`;
    }
  },

  destroy(ctx) {
    ctx.svgEl.replaceChildren();
    ctx.contentEl.style.transform = "";
  }
};

// 2. Constellation
const constellation = {
  id: "constellation",
  name: "Constellation",
  description: "Phrases arranged as connected star nodes across a calm dark field.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "medium",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, svgEl, doc, activeIdx, rect, staticIndex, bands, reducedMotion } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:const:${idx}:${Math.round(rect.width)}`;
    if (ctx.state.lastKey !== key) {
      ctx.state.lastKey = key;
      contentEl.replaceChildren();
      svgEl.replaceChildren();

      const wrap = makeEl("div", "lyrics-constellation-wrap");
      const indices = getWindowIndices(doc.lines, idx, 1, 1);
      const nodes = [];

      indices.forEach((lineIdx, slot) => {
        const line = doc.lines[lineIdx];
        const isCurrent = lineIdx === idx;
        const node = makeEl("div", `lyrics-star-node ${isCurrent ? "is-active" : "is-ghost"}`, line.text);
        const xShift = slot === 0 ? -12 : slot === 2 ? 12 : 0;
        node.style.transform = `translate3d(${xShift}%, 0, 0)`;
        wrap.appendChild(node);
        nodes.push(node);
      });
      contentEl.appendChild(wrap);

      const stageRect = svgEl.getBoundingClientRect();
      const ns = "http://www.w3.org/2000/svg";
      for (let i = 1; i < nodes.length; i++) {
        const r1 = nodes[i - 1].getBoundingClientRect();
        const r2 = nodes[i].getBoundingClientRect();
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", r1.left - stageRect.left + r1.width / 2);
        line.setAttribute("y1", r1.top - stageRect.top + r1.height / 2);
        line.setAttribute("x2", r2.left - stageRect.left + r2.width / 2);
        line.setAttribute("y2", r2.top - stageRect.top + r2.height / 2);
        line.setAttribute("class", "lyrics-constellation-link");
        svgEl.appendChild(line);
      }
    }
    if (!reducedMotion) {
      const pulse = 1 + (bands.bass || 0) * 0.02;
      contentEl.style.transform = `scale(${pulse.toFixed(3)})`;
    }
  },
  destroy(ctx) {
    ctx.svgEl.replaceChildren();
    ctx.contentEl.style.transform = "";
  }
};

// 3. Editorial
const editorial = {
  id: "editorial",
  name: "Editorial",
  description: "Large refined serif typography with asymmetric magazine hierarchy.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "low",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:ed:${idx}`;
    if (ctx.state.lastKey === key) return;
    ctx.state.lastKey = key;

    contentEl.replaceChildren();
    const wrap = makeEl("div", "lyrics-editorial-wrap");
    getWindowIndices(doc.lines, idx, 1, 2).forEach((lineIdx) => {
      const cls = lineIdx === idx ? "lyrics-editorial-line is-active" : "lyrics-editorial-line";
      wrap.appendChild(makeEl("div", cls, doc.lines[lineIdx].text));
    });
    contentEl.appendChild(wrap);
  },
  destroy() {}
};

// 4. Floating Cards
const floatingCards = {
  id: "floating-cards",
  name: "Floating Cards",
  description: "Translucent glass cards in a calm parallax depth stack.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "low",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:cards:${idx}`;
    if (ctx.state.lastKey === key) return;
    ctx.state.lastKey = key;

    contentEl.replaceChildren();
    const wrap = makeEl("div", "lyrics-cards-stack");
    getWindowIndices(doc.lines, idx, 1, 1).forEach((lineIdx) => {
      const isCurrent = lineIdx === idx;
      const card = makeEl("div", `lyrics-glass-card ${isCurrent ? "is-active" : ""}`, doc.lines[lineIdx].text);
      wrap.appendChild(card);
    });
    contentEl.appendChild(wrap);
  },
  destroy() {}
};

// 5. Orbital Type
const orbitalType = {
  id: "orbital-type",
  name: "Orbital Type",
  description: "Whole lines arc gently around the center album art when space permits.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "editorial",
  preferredAnchor: "center",
  motionCost: "medium",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    // Fallback cleanly to Editorial on narrow viewports or when orbital room is tight
    if (!ctx.rect.hasRoomForOrbital) {
      editorial.update(ctx);
      return;
    }
    const { contentEl, doc, activeIdx, staticIndex, rect } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:orb:${idx}:${Math.round(rect.centerArtRadius)}`;
    if (ctx.state.lastKey === key) return;
    ctx.state.lastKey = key;

    contentEl.replaceChildren();
    const wrap = makeEl("div", "lyrics-orbital-wrap");
    const r = Math.max(120, rect.centerArtRadius + 48);

    const prev = doc.lines[idx - 1];
    const curr = doc.lines[idx];
    const next = doc.lines[idx + 1];

    if (prev) {
      const el = makeEl("div", "lyrics-orbital-arc lyrics-orbital-top", prev.text);
      el.style.transform = `translate3d(0, -${r * 0.85}px, 0)`;
      wrap.appendChild(el);
    }
    if (curr) {
      const el = makeEl("div", "lyrics-orbital-arc is-active", curr.text);
      el.style.transform = `translate3d(0, ${r * 0.72}px, 0)`;
      wrap.appendChild(el);
    }
    if (next) {
      const el = makeEl("div", "lyrics-orbital-arc lyrics-orbital-bottom", next.text);
      el.style.transform = `translate3d(0, ${r * 1.15}px, 0)`;
      wrap.appendChild(el);
    }
    contentEl.appendChild(wrap);
  },
  destroy() {}
};

// 6. Kinetic Poster
const kineticPoster = {
  id: "kinetic-poster",
  name: "Kinetic Poster",
  description: "Single high-impact phrase with masked scale and tracking entrance.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "medium",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:poster:${idx}`;
    if (ctx.state.lastKey === key) return;
    ctx.state.lastKey = key;

    contentEl.replaceChildren();
    const line = doc.lines[idx];
    if (!line) return;
    const poster = makeEl("div", "lyrics-poster-phrase", line.text);
    contentEl.appendChild(poster);
  },
  destroy() {}
};

// 7. Ribbon Flow
const ribbonFlow = {
  id: "ribbon-flow",
  name: "Ribbon Flow",
  description: "Whole lines glide along calm, sweeping lateral curves.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "medium",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex, bands, reducedMotion, motionLevel } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:rib:${idx}`;
    if (ctx.state.lastKey !== key) {
      ctx.state.lastKey = key;
      contentEl.replaceChildren();
      const wrap = makeEl("div", "lyrics-ribbon-wrap");
      getWindowIndices(doc.lines, idx, 1, 1).forEach((lineIdx, slot) => {
        const isCurrent = lineIdx === idx;
        const el = makeEl("div", `lyrics-ribbon-line ${isCurrent ? "is-active" : ""}`, doc.lines[lineIdx].text);
        el.style.setProperty("--slot-offset", `${(slot - 1) * 28}px`);
        wrap.appendChild(el);
      });
      contentEl.appendChild(wrap);
    }
    if (!reducedMotion && motionLevel > 0) {
      const sway = Math.sin(performance.now() * 0.0011) * (10 + (bands.mids || 0) * 14) * motionLevel;
      contentEl.style.transform = `translate3d(${sway.toFixed(1)}px, 0, 0)`;
    }
  },
  destroy(ctx) { ctx.contentEl.style.transform = ""; }
};

// 8. Typewriter Drift
const typewriterDrift = {
  id: "typewriter-drift",
  name: "Typewriter Drift",
  description: "Gentle whole-line reveal at line start, then crisp and stable.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "low",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:type:${idx}`;
    if (ctx.state.lastKey === key) return;
    ctx.state.lastKey = key;

    contentEl.replaceChildren();
    const wrap = makeEl("div", "lyrics-typewriter-wrap");
    getWindowIndices(doc.lines, idx, 1, 1).forEach((lineIdx) => {
      const isCurrent = lineIdx === idx;
      wrap.appendChild(makeEl("div", `lyrics-typewriter-line ${isCurrent ? "is-active" : ""}`, doc.lines[lineIdx].text));
    });
    contentEl.appendChild(wrap);
  },
  destroy() {}
};

// 9. Subtitles Reimagined (Default reduced-motion & readability fallback)
const subtitlesReimagined = {
  id: "subtitles-reimagined",
  name: "Subtitles Reimagined",
  description: "Minimal cinematic two-line lower-third layout.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "lower-third",
  motionCost: "low",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:sub:${idx}`;
    if (ctx.state.lastKey === key) return;
    ctx.state.lastKey = key;

    contentEl.replaceChildren();
    const wrap = makeEl("div", "lyrics-subtitles-wrap");
    const curr = doc.lines[idx];
    const next = doc.lines[idx + 1];
    if (curr) wrap.appendChild(makeEl("div", "lyrics-subtitle-current", curr.text));
    if (next) wrap.appendChild(makeEl("div", "lyrics-subtitle-next", next.text));
    contentEl.appendChild(wrap);
  },
  destroy() {}
};

// 10. Lyric Wall
const lyricWall = {
  id: "lyric-wall",
  name: "Lyric Wall",
  description: "Responsive typographic grid elevating the active phrase by scale and depth.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "low",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:wall:${idx}`;
    if (ctx.state.lastKey === key) return;
    ctx.state.lastKey = key;

    contentEl.replaceChildren();
    const grid = makeEl("div", "lyrics-wall-grid");
    getWindowIndices(doc.lines, idx, 2, 3).forEach((lineIdx) => {
      const isCurrent = lineIdx === idx;
      grid.appendChild(makeEl("div", `lyrics-wall-cell ${isCurrent ? "is-active" : ""}`, doc.lines[lineIdx].text));
    });
    contentEl.appendChild(grid);
  },
  destroy() {}
};

// 11. Split Horizon
const splitHorizon = {
  id: "split-horizon",
  name: "Split Horizon",
  description: "Past lines float above a quiet horizon plane; active line crosses through.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "low",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:hor:${idx}`;
    if (ctx.state.lastKey === key) return;
    ctx.state.lastKey = key;

    contentEl.replaceChildren();
    const wrap = makeEl("div", "lyrics-horizon-wrap");
    if (doc.lines[idx - 1]) wrap.appendChild(makeEl("div", "lyrics-horizon-above", doc.lines[idx - 1].text));
    wrap.appendChild(makeEl("div", "lyrics-horizon-divider"));
    if (doc.lines[idx]) wrap.appendChild(makeEl("div", "lyrics-horizon-current", doc.lines[idx].text));
    if (doc.lines[idx + 1]) wrap.appendChild(makeEl("div", "lyrics-horizon-below", doc.lines[idx + 1].text));
    contentEl.appendChild(wrap);
  },
  destroy() {}
};

// 12. Paper Cut
const paperCut = {
  id: "paper-cut",
  name: "Paper Cut",
  description: "Layered typographic planes with soft offset shadows and palette tones.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "low",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:paper:${idx}`;
    if (ctx.state.lastKey === key) return;
    ctx.state.lastKey = key;

    contentEl.replaceChildren();
    const wrap = makeEl("div", "lyrics-papercut-wrap");
    getWindowIndices(doc.lines, idx, 1, 1).forEach((lineIdx) => {
      const isCurrent = lineIdx === idx;
      wrap.appendChild(makeEl("div", `lyrics-papercut-plane ${isCurrent ? "is-active" : ""}`, doc.lines[lineIdx].text));
    });
    contentEl.appendChild(wrap);
  },
  destroy() {}
};

// 13. Tunnel
const tunnel = {
  id: "tunnel",
  name: "Tunnel",
  description: "Shallow typographic depth tunnel keeping the active line large in foreground.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "medium",

  mount(ctx) { ctx.state = { lastKey: null }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:tun:${idx}`;
    if (ctx.state.lastKey === key) return;
    ctx.state.lastKey = key;

    contentEl.replaceChildren();
    const wrap = makeEl("div", "lyrics-tunnel-wrap");
    getWindowIndices(doc.lines, idx, 0, 3).forEach((lineIdx, depth) => {
      const el = makeEl("div", `lyrics-tunnel-line ${depth === 0 ? "is-active" : ""}`, doc.lines[lineIdx].text);
      el.style.setProperty("--depth", String(depth));
      wrap.appendChild(el);
    });
    contentEl.appendChild(wrap);
  },
  destroy() {}
};

// 14. Neon Thread
const neonThread = {
  id: "neon-thread",
  name: "Neon Thread",
  description: "Whole lines linked by a single animated light thread.",
  needsTimed: false,
  supportsStatic: true,
  fallbackId: "subtitles-reimagined",
  preferredAnchor: "center",
  motionCost: "medium",

  mount(ctx) { ctx.state = { lastKey: null, pathEl: null }; },
  update(ctx) {
    const { contentEl, svgEl, doc, activeIdx, staticIndex, rect, bands, connectorStrength } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const key = `${doc.trackKey}:thread:${idx}:${Math.round(rect.width)}`;
    if (ctx.state.lastKey !== key) {
      ctx.state.lastKey = key;
      contentEl.replaceChildren();
      svgEl.replaceChildren();

      const wrap = makeEl("div", "lyrics-thread-wrap");
      const els = [];
      getWindowIndices(doc.lines, idx, 1, 1).forEach((lineIdx, slot) => {
        const isCurrent = lineIdx === idx;
        const el = makeEl("div", `lyrics-thread-line ${isCurrent ? "is-active" : ""}`, doc.lines[lineIdx].text);
        el.style.alignSelf = slot % 2 === 0 ? "flex-start" : "flex-end";
        wrap.appendChild(el);
        els.push(el);
      });
      contentEl.appendChild(wrap);

      const stageRect = svgEl.getBoundingClientRect();
      if (els.length >= 2) {
        const pts = els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left - stageRect.left + r.width / 2, y: r.top - stageRect.top + r.height / 2 };
        });
        let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
        for (let i = 1; i < pts.length; i++) {
          const my = (pts[i - 1].y + pts[i].y) / 2;
          d += ` C ${pts[i - 1].x.toFixed(1)} ${my.toFixed(1)}, ${pts[i].x.toFixed(1)} ${my.toFixed(1)}, ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
        }
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("class", "lyrics-zigzag-path");
        svgEl.appendChild(path);
        ctx.state.pathEl = path;
      }
    }
    if (ctx.state.pathEl) {
      ctx.state.pathEl.style.strokeWidth = `${(1.4 + (bands.bass || 0) * 1.8 * connectorStrength).toFixed(2)}px`;
    }
  },
  destroy(ctx) { ctx.svgEl.replaceChildren(); }
};

export const LYRIC_STYLES = [
  connectedZigzag,
  constellation,
  editorial,
  floatingCards,
  orbitalType,
  kineticPoster,
  ribbonFlow,
  typewriterDrift,
  subtitlesReimagined,
  lyricWall,
  splitHorizon,
  paperCut,
  tunnel,
  neonThread
];

export const LYRIC_STYLE_MAP = new Map(LYRIC_STYLES.map((s) => [s.id, s]));
