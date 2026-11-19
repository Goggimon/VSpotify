// 5 Signature Connected Lyric Scenes + Section Intelligence (No word-level karaoke highlighting)

function makeEl(tag, className, text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) {
    el.textContent = text;
    el.dir = "auto";
  }
  return el;
}

export const LEGACY_STYLE_FALLBACKS = {
  "kinetic-poster": "editorial",
  "paper-cut": "editorial",
  "split-horizon": "editorial",
  "typewriter-drift": "editorial",
  "orbital-type": "constellation",
  "lyric-wall": "constellation",
  "ribbon-flow": "neon-thread",
  "floating-cards": "neon-thread",
  "tunnel": "neon-thread"
};

export function resolveLyricStyleId(id) {
  return LEGACY_STYLE_FALLBACKS[id] || id || "connected-zigzag";
}

// Detect verse / chorus / instrumental section mood from timing gaps, punctuation & repetition
export function analyzeLyricSection(doc, idx, posMs) {
  if (!doc || !doc.lines || doc.lines.length === 0) return "verse";
  const line = doc.lines[idx];
  const next = doc.lines[idx + 1];

  // Instrumental breathing gap (> 3.6s silence or past end of line)
  if (doc.timing === "line" && line && line.startMs !== null) {
    const lineEnd = line.endMs || line.startMs + 3200;
    const gapToNext = next && next.startMs !== null ? next.startMs - lineEnd : 0;
    if (posMs > lineEnd + 400 && gapToNext > 2800) return "instrumental";
    if (idx === 0 && posMs < line.startMs - 1200) return "instrumental";
  }

  if (!line || !line.text) return "verse";
  const norm = line.text.trim().toLowerCase().replace(/[^\w\s]/g, "");
  let repeats = 0;
  for (let i = 0; i < doc.lines.length; i++) {
    const other = doc.lines[i].text.trim().toLowerCase().replace(/[^\w\s]/g, "");
    if (other && other === norm) repeats++;
  }
  if (repeats >= 2 || /[!?]$/.test(line.text.trim())) return "chorus";
  return "verse";
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

function computeInferredPhraseProgress(line, posMs) {
  if (!line || line.startMs === null) return 0;
  const dur = Math.max(800, (line.endMs || line.startMs + 4000) - line.startMs);
  return Math.max(0, Math.min(1, (posMs - line.startMs) / dur));
}

// Smoothly mark outgoing nodes instead of snapping/deleting immediately
function transitionOutChildren(container, keepAttr, keepVal, reducedMotion) {
  const children = Array.from(container.children);
  children.forEach((child) => {
    if (child.dataset[keepAttr] === String(keepVal)) return;
    if (child.classList.contains("is-outgoing")) return;
    child.classList.remove("is-active");
    child.classList.add("is-outgoing");
    setTimeout(() => child.remove(), reducedMotion ? 80 : 460);
  });
}

// 1. Connected Zigzag (Flagship)
const connectedZigzag = {
  id: "connected-zigzag",
  name: "Connected Zigzag",
  description: "Spatial word route linked by a continuous SVG path and traveling highlight comet.",
  preferredAnchor: "center",

  mount(ctx) {
    ctx.state = { lastIdx: -1, lastWidth: 0, pathEl: null, trailEl: null, cometEl: null, pathLen: 0, lastTailPt: null };
  },

  update(ctx) {
    const { contentEl, svgEl, doc, activeIdx, posMs, rect, bands, motionLevel, connectorStrength, staticIndex, section, reducedMotion } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const line = doc.lines[idx];
    if (!line) return;

    const widthBucket = Math.round(rect.width / 24) * 24;
    if (ctx.state.lastIdx !== idx || ctx.state.lastWidth !== widthBucket) {
      ctx.state.lastIdx = idx;
      ctx.state.lastWidth = widthBucket;

      let stage = contentEl.querySelector(".lyrics-zigzag-stage");
      if (!stage) {
        contentEl.replaceChildren();
        stage = makeEl("div", "lyrics-zigzag-stage");
        contentEl.appendChild(stage);
      }

      // Keep outgoing line briefly to dissolve smoothly
      transitionOutChildren(stage, "lineIdx", idx, reducedMotion);

      const wrap = makeEl("div", "lyrics-zigzag-wrap is-entering");
      wrap.dataset.lineIdx = String(idx);

      const prevLine = doc.lines[idx - 1];
      const nextLine = doc.lines[idx + 1];

      if (prevLine) {
        wrap.appendChild(makeEl("div", "lyrics-zigzag-ghost lyrics-zigzag-prev", prevLine.text));
      }

      const routeBox = makeEl("div", "lyrics-zigzag-route");
      const words = line.words && line.words.length > 0 ? line.words : [{ text: line.text }];
      const isShort = rect.isNarrow || words.length <= 2;
      const chorusBoost = section === "chorus" ? 1.18 : section === "instrumental" ? 0.82 : 1.0;
      const spread = Math.min(rect.width * 0.28, (isShort ? 72 : 168) * chorusBoost);

      const wordEls = words.map((w, i) => {
        const span = makeEl("span", "lyrics-zigzag-word", w.text);
        const side = i % 2 === 0 ? -1 : 1;
        const jitter = ((i * 37) % 19) - 9;
        const offsetX = words.length === 1 ? 0 : side * (spread * 0.55 + jitter);
        span.style.transform = `translate3d(${offsetX.toFixed(1)}px, 0, 0)`;
        routeBox.appendChild(span);
        return span;
      });

      wrap.appendChild(routeBox);
      if (nextLine) {
        wrap.appendChild(makeEl("div", "lyrics-zigzag-ghost lyrics-zigzag-next", nextLine.text));
      }
      stage.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.remove("is-entering"));

      // Measure DOM positions & bridge smoothly from previous line's tail point
      const stageRect = svgEl.getBoundingClientRect();
      const centers = wordEls.map((span) => {
        const r = span.getBoundingClientRect();
        return {
          x: r.left - stageRect.left + r.width / 2,
          y: r.top - stageRect.top + r.height / 2
        };
      });

      if (centers.length >= 1) {
        const ns = "http://www.w3.org/2000/svg";
        svgEl.replaceChildren();

        let d = "";
        if (ctx.state.lastTailPt && !reducedMotion) {
          const t0 = ctx.state.lastTailPt;
          const p0 = centers[0];
          const my = (t0.y + p0.y) / 2;
          d += `M ${t0.x.toFixed(1)} ${t0.y.toFixed(1)} C ${t0.x.toFixed(1)} ${my.toFixed(1)}, ${p0.x.toFixed(1)} ${my.toFixed(1)}, ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}`;
        } else {
          d += `M ${centers[0].x.toFixed(1)} ${centers[0].y.toFixed(1)}`;
        }

        for (let i = 1; i < centers.length; i++) {
          const p0 = centers[i - 1];
          const p1 = centers[i];
          const midY = (p0.y + p1.y) / 2;
          d += ` C ${p0.x.toFixed(1)} ${midY.toFixed(1)}, ${p1.x.toFixed(1)} ${midY.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
        }

        ctx.state.lastTailPt = centers[centers.length - 1];

        const trail = document.createElementNS(ns, "path");
        trail.setAttribute("d", d);
        trail.setAttribute("class", "lyrics-zigzag-trail");

        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", d);
        path.setAttribute("class", "lyrics-zigzag-path");

        const comet = document.createElementNS(ns, "circle");
        comet.setAttribute("r", section === "chorus" ? "5.5" : "4.5");
        comet.setAttribute("class", "lyrics-zigzag-comet");

        svgEl.appendChild(trail);
        svgEl.appendChild(path);
        if (doc.timing === "line" && !reducedMotion) {
          svgEl.appendChild(comet);
        }

        ctx.state.pathEl = path;
        ctx.state.trailEl = trail;
        ctx.state.cometEl = comet;
        ctx.state.pathLen = path.getTotalLength ? path.getTotalLength() : 0;
      }
    }

    const { pathEl, cometEl, pathLen } = ctx.state;
    if (pathEl) {
      const bassGlow = 1.5 + (bands.bass || 0) * 2.1 * connectorStrength;
      pathEl.style.strokeWidth = `${bassGlow.toFixed(2)}px`;
      pathEl.style.opacity = `${Math.min(0.95, 0.45 * connectorStrength + 0.25)}`;
    }
    if (cometEl && pathEl && pathLen > 0 && doc.timing === "line" && !reducedMotion) {
      const progress = computeInferredPhraseProgress(line, posMs);
      const pt = pathEl.getPointAtLength(progress * pathLen);
      cometEl.setAttribute("cx", pt.x.toFixed(1));
      cometEl.setAttribute("cy", pt.y.toFixed(1));
    }
    if (!reducedMotion && motionLevel > 0) {
      const drift = Math.sin(performance.now() * 0.001) * (bands.mids || 0) * 5 * motionLevel;
      contentEl.style.transform = `translate3d(${drift.toFixed(1)}px, 0, 0)`;
    }
  },

  destroy(ctx) {
    ctx.svgEl.replaceChildren();
    ctx.contentEl.style.transform = "";
  }
};

// 2. Cinema Captions (Clean, emotional, readable default)
const cinemaCaptions = {
  id: "subtitles-reimagined",
  name: "Cinema Captions",
  description: "Clean, emotional two-line captions with calm cross-dissolves.",
  preferredAnchor: "lower-third",

  mount(ctx) { ctx.state = { lastIdx: -1 }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex, reducedMotion } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    if (ctx.state.lastIdx === idx) return;
    ctx.state.lastIdx = idx;

    let wrap = contentEl.querySelector(".lyrics-subtitles-wrap");
    if (!wrap) {
      contentEl.replaceChildren();
      wrap = makeEl("div", "lyrics-subtitles-wrap");
      contentEl.appendChild(wrap);
    }

    transitionOutChildren(wrap, "lineIdx", idx, reducedMotion);

    const slot = makeEl("div", "lyrics-subtitle-slot is-entering");
    slot.dataset.lineIdx = String(idx);
    const curr = doc.lines[idx];
    const next = doc.lines[idx + 1];
    if (curr) slot.appendChild(makeEl("div", "lyrics-subtitle-current", curr.text));
    if (next) slot.appendChild(makeEl("div", "lyrics-subtitle-next", next.text));
    wrap.appendChild(slot);
    requestAnimationFrame(() => slot.classList.remove("is-entering"));
  },
  destroy() {}
};

// 3. Editorial (Large asymmetric serif typography; evolves for choruses)
const editorial = {
  id: "editorial",
  name: "Editorial",
  description: "Large refined typography with evolving asymmetric magazine hierarchy.",
  preferredAnchor: "center",

  mount(ctx) { ctx.state = { lastIdx: -1 }; },
  update(ctx) {
    const { contentEl, doc, activeIdx, staticIndex, section, reducedMotion } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    if (ctx.state.lastIdx === idx) return;
    ctx.state.lastIdx = idx;

    let wrap = contentEl.querySelector(".lyrics-editorial-wrap");
    if (!wrap) {
      contentEl.replaceChildren();
      wrap = makeEl("div", "lyrics-editorial-wrap");
      contentEl.appendChild(wrap);
    }

    const indices = getWindowIndices(doc.lines, idx, 1, 2);
    const keepSet = new Set(indices.map(String));

    Array.from(wrap.children).forEach((el) => {
      if (!keepSet.has(el.dataset.lineIdx)) {
        el.classList.add("is-outgoing");
        setTimeout(() => el.remove(), reducedMotion ? 60 : 420);
      }
    });

    indices.forEach((lineIdx, pos) => {
      let el = wrap.querySelector(`[data-line-idx="${lineIdx}"]`);
      if (!el) {
        el = makeEl("div", "lyrics-editorial-line is-entering", doc.lines[lineIdx].text);
        el.dataset.lineIdx = String(lineIdx);
        wrap.appendChild(el);
        requestAnimationFrame(() => el.classList.remove("is-entering"));
      }
      el.classList.toggle("is-active", lineIdx === idx);
      el.classList.toggle("is-chorus", section === "chorus" && lineIdx === idx);
      el.style.marginLeft = section === "chorus" ? `${(pos % 2) * 18}px` : "0px";
    });
  },
  destroy() {}
};

// 4. Constellation (Persistent connected star-node field)
const constellation = {
  id: "constellation",
  name: "Constellation",
  description: "Phrases form a persistent connected star structure across a calm dark field.",
  preferredAnchor: "center",

  mount(ctx) { ctx.state = { lastIdx: -1, lastWidth: 0 }; },
  update(ctx) {
    const { contentEl, svgEl, doc, activeIdx, rect, staticIndex, bands, reducedMotion, motionLevel } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const widthBucket = Math.round(rect.width / 24) * 24;

    if (ctx.state.lastIdx !== idx || ctx.state.lastWidth !== widthBucket) {
      ctx.state.lastIdx = idx;
      ctx.state.lastWidth = widthBucket;

      let wrap = contentEl.querySelector(".lyrics-constellation-wrap");
      if (!wrap) {
        contentEl.replaceChildren();
        wrap = makeEl("div", "lyrics-constellation-wrap");
        contentEl.appendChild(wrap);
      }

      const indices = getWindowIndices(doc.lines, idx, 1, 1);
      const keepSet = new Set(indices.map(String));

      Array.from(wrap.children).forEach((el) => {
        if (!keepSet.has(el.dataset.lineIdx)) {
          el.classList.add("is-outgoing");
          setTimeout(() => el.remove(), reducedMotion ? 60 : 420);
        }
      });

      const nodes = [];
      indices.forEach((lineIdx, slot) => {
        let node = wrap.querySelector(`[data-line-idx="${lineIdx}"]`);
        if (!node) {
          node = makeEl("div", "lyrics-star-node is-entering", doc.lines[lineIdx].text);
          node.dataset.lineIdx = String(lineIdx);
          wrap.appendChild(node);
          requestAnimationFrame(() => node.classList.remove("is-entering"));
        }
        const isCurrent = lineIdx === idx;
        node.classList.toggle("is-active", isCurrent);
        node.classList.toggle("is-ghost", !isCurrent);
        const xShift = slot === 0 ? -10 : slot === 2 ? 10 : 0;
        node.style.transform = `translate3d(${xShift}%, 0, 0)`;
        nodes.push(node);
      });

      svgEl.replaceChildren();
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
    if (!reducedMotion && motionLevel > 0) {
      const pulse = 1 + (bands.bass || 0) * 0.018 * motionLevel;
      contentEl.style.transform = `scale(${pulse.toFixed(3)})`;
    }
  },
  destroy(ctx) {
    ctx.svgEl.replaceChildren();
    ctx.contentEl.style.transform = "";
  }
};

// 5. Neon Thread (Simpler continuous line-level connected scene)
const neonThread = {
  id: "neon-thread",
  name: "Neon Thread",
  description: "Whole lines linked along a continuous glowing light thread.",
  preferredAnchor: "center",

  mount(ctx) { ctx.state = { lastIdx: -1, lastWidth: 0, pathEl: null }; },
  update(ctx) {
    const { contentEl, svgEl, doc, activeIdx, staticIndex, rect, bands, connectorStrength, reducedMotion } = ctx;
    const idx = doc.timing === "line" ? (activeIdx >= 0 ? activeIdx : 0) : staticIndex;
    const widthBucket = Math.round(rect.width / 24) * 24;

    if (ctx.state.lastIdx !== idx || ctx.state.lastWidth !== widthBucket) {
      ctx.state.lastIdx = idx;
      ctx.state.lastWidth = widthBucket;

      let wrap = contentEl.querySelector(".lyrics-thread-wrap");
      if (!wrap) {
        contentEl.replaceChildren();
        wrap = makeEl("div", "lyrics-thread-wrap");
        contentEl.appendChild(wrap);
      }

      const indices = getWindowIndices(doc.lines, idx, 1, 1);
      const keepSet = new Set(indices.map(String));

      Array.from(wrap.children).forEach((el) => {
        if (!keepSet.has(el.dataset.lineIdx)) {
          el.classList.add("is-outgoing");
          setTimeout(() => el.remove(), reducedMotion ? 60 : 420);
        }
      });

      const els = [];
      indices.forEach((lineIdx, slot) => {
        let el = wrap.querySelector(`[data-line-idx="${lineIdx}"]`);
        if (!el) {
          el = makeEl("div", "lyrics-thread-line is-entering", doc.lines[lineIdx].text);
          el.dataset.lineIdx = String(lineIdx);
          wrap.appendChild(el);
          requestAnimationFrame(() => el.classList.remove("is-entering"));
        }
        el.classList.toggle("is-active", lineIdx === idx);
        el.style.alignSelf = slot % 2 === 0 ? "flex-start" : "flex-end";
        els.push(el);
      });

      svgEl.replaceChildren();
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
  cinemaCaptions,
  editorial,
  constellation,
  neonThread
];

export const LYRIC_STYLE_MAP = new Map(LYRIC_STYLES.map((s) => [s.id, s]));
