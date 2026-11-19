// Adaptive Placement Engine: computes safe non-overlapping lyric rectangles around HUD, drawer, and center art

function rectIntersectionArea(a, b) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.right) - Math.max(a.x, b.left));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.bottom) - Math.max(a.y, b.top));
  return xOverlap * yOverlap;
}

function isVisibleRect(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) < 0.05) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4 && r.right > 0 && r.left < window.innerWidth;
}

export class LyricsPlacementEngine {
  constructor() {
    this.cachedRect = null;
  }

  getOccupiedRects({ hudMode, isIdle, centerArtActive, artScale = 1.0 }) {
    const occupied = [];
    const pad = 14;

    if (!isIdle) {
      const topBar = document.getElementById("top-bar");
      if (isVisibleRect(topBar)) {
        const r = topBar.getBoundingClientRect();
        occupied.push({ id: "top-bar", left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad });
      }

      if (hudMode !== "hidden") {
        const hud = document.getElementById("hud-container");
        if (isVisibleRect(hud)) {
          const r = hud.getBoundingClientRect();
          occupied.push({ id: "hud", left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad });
        }
      }
    }

    const drawer = document.getElementById("custom-drawer");
    if (drawer && !drawer.classList.contains("hidden") && isVisibleRect(drawer)) {
      const r = drawer.getBoundingClientRect();
      occupied.push({ id: "drawer", left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad });
    }

    const dock = document.getElementById("idle-corner-dock");
    if (dock && dock.classList.contains("visible") && isVisibleRect(dock)) {
      const r = dock.getBoundingClientRect();
      occupied.push({ id: "corner-dock", left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad });
    }

    // Reserve central art circle when centered HUD or center-art visualizer is active
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let centerArtRadius = 0;
    if (centerArtActive || (!isIdle && hudMode === "centered")) {
      centerArtRadius = Math.min(vw, vh) * 0.19 * artScale;
      const cx = vw / 2;
      const cy = vh / 2;
      occupied.push({
        id: "center-art",
        left: cx - centerArtRadius,
        top: cy - centerArtRadius,
        right: cx + centerArtRadius,
        bottom: cy + centerArtRadius
      });
    }

    return { occupied, centerArtRadius };
  }

  getSafeZones({ hudMode = "cinema", isIdle = false, centerArtActive = false, artScale = 1.0, densityWidth = 1.0 } = {}) {
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;
    const isNarrow = vw < 760;

    const { occupied, centerArtRadius } = this.getOccupiedRects({ hudMode, isIdle, centerArtActive, artScale });
    const drawerRect = occupied.find((o) => o.id === "drawer");
    const usableRight = drawerRect ? Math.min(vw - 24, drawerRect.left - 16) : vw - 24;
    const usableLeft = 24;
    const usableW = Math.max(260, usableRight - usableLeft);
    const maxColW = Math.min(usableW, (isNarrow ? usableW : 760) * densityWidth);

    const topSafe = occupied.find((o) => o.id === "top-bar")?.bottom ?? 28;
    const hudRect = occupied.find((o) => o.id === "hud");
    const bottomSafe = hudRect && hudRect.top > vh * 0.5 ? hudRect.top - 12 : vh - 32;

    const centerX = usableLeft + (usableW - maxColW) / 2;
    const midH = Math.max(180, bottomSafe - topSafe);

    const candidates = [
      {
        anchor: "center",
        x: centerX,
        y: topSafe + Math.max(0, (midH - Math.min(380, midH)) / 2),
        width: maxColW,
        height: Math.min(380, midH)
      },
      {
        anchor: "upper-center",
        x: centerX,
        y: topSafe + 8,
        width: maxColW,
        height: Math.max(140, Math.min(240, vh * 0.34))
      },
      {
        anchor: "lower-third",
        x: centerX,
        y: Math.max(topSafe + 20, bottomSafe - 150),
        width: maxColW,
        height: 140
      },
      {
        anchor: "lower-center",
        x: centerX,
        y: Math.max(topSafe + 20, bottomSafe - 220),
        width: maxColW,
        height: 200
      },
      {
        anchor: "left-center",
        x: usableLeft,
        y: topSafe + Math.max(0, (midH - 280) / 2),
        width: Math.min(420, usableW * 0.44),
        height: Math.min(320, midH)
      },
      {
        anchor: "right-center",
        x: Math.max(usableLeft, usableRight - Math.min(420, usableW * 0.44)),
        y: topSafe + Math.max(0, (midH - 280) / 2),
        width: Math.min(420, usableW * 0.44),
        height: Math.min(320, midH)
      }
    ];

    const hasRoomForOrbital = !isNarrow && vw >= 900 && vh >= 620 && !drawerRect;

    return {
      vw,
      vh,
      isNarrow,
      occupied,
      centerArtRadius,
      hasRoomForOrbital,
      candidates
    };
  }

  getPreferredLyricsRect({ stylePreferred = "center", placementMode = "adaptive", hudMode, isIdle, centerArtActive, artScale, densityWidth }) {
    const zones = this.getSafeZones({ hudMode, isIdle, centerArtActive, artScale, densityWidth });
    const targetAnchor = placementMode && placementMode !== "adaptive"
      ? (placementMode === "upper" ? "upper-center"
        : placementMode === "lower" ? "lower-third"
        : placementMode === "left" ? "left-center"
        : placementMode === "right" ? "right-center"
        : "center")
      : (zones.isNarrow ? "center" : stylePreferred);

    let best = zones.candidates[0];
    let bestScore = -Infinity;

    for (const cand of zones.candidates) {
      let overlap = 0;
      for (const occ of zones.occupied) {
        overlap += rectIntersectionArea(cand, occ);
      }

      const area = cand.width * cand.height;
      const anchorBonus = cand.anchor === targetAnchor ? 120000 : 0;
      const centerBonus = cand.anchor === "center" ? 20000 : 0;
      const score = area * 0.35 + anchorBonus + centerBonus - overlap * 4.5;

      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    return {
      ...best,
      vw: zones.vw,
      vh: zones.vh,
      isNarrow: zones.isNarrow,
      hasRoomForOrbital: zones.hasRoomForOrbital,
      centerArtRadius: zones.centerArtRadius
    };
  }
}
