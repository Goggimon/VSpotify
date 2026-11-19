// Provider-neutral lyric acquisition, LRC/TXT/JSON parsing, fuzzy validation, and caching
import { DEMO_SYNTH_LRC } from "./lyrics-fixtures.js";

const CACHE_KEY = "vspotify_lyrics_cache_v1";
const IMPORTS_KEY = "vspotify_lyrics_imports_v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 40;

const wordSegmenter =
  typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: "word" })
    : null;

export function segmentWords(text) {
  if (!text) return [];
  if (wordSegmenter) {
    const tokens = [];
    for (const seg of wordSegmenter.segment(text)) {
      if (seg.isWordLike || /[^\s]/.test(seg.segment)) {
        const trimmed = seg.segment.trim();
        if (trimmed) tokens.push({ text: trimmed, startMs: null, endMs: null });
      }
    }
    return tokens;
  }
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({ text: w, startMs: null, endMs: null }));
}

function normalizeStr(str) {
  return (str || "")
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isReasonableMatch(query, candidate) {
  const qTitle = normalizeStr(query.title);
  const cTitle = normalizeStr(candidate.trackName || candidate.title);
  const qArtist = normalizeStr((query.artists || "").split(",")[0]);
  const cArtist = normalizeStr((candidate.artistName || candidate.artists || "").split(",")[0]);

  if (!qTitle || !cTitle) return false;
  const titleMatch = cTitle.includes(qTitle) || qTitle.includes(cTitle);
  const artistMatch = !qArtist || !cArtist || cArtist.includes(qArtist) || qArtist.includes(cArtist);

  if (!titleMatch || !artistMatch) return false;

  if (query.durationMs && candidate.duration) {
    const diffSec = Math.abs(query.durationMs / 1000 - candidate.duration);
    if (diffSec > 10) return false;
  }
  return true;
}

export function parseLRC(raw, trackKey, source = "lrclib") {
  if (!raw || typeof raw !== "string") return null;
  const rawLines = raw.split(/\r?\n/);
  let offsetMs = 0;
  let language = undefined;
  const entries = [];

  const timeTagRe = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const metaTagRe = /^\[([a-zA-Z]+):(.*)\]$/;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const times = [];
    let match;
    timeTagRe.lastIndex = 0;
    while ((match = timeTagRe.exec(trimmed)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const fracStr = match[3] || "0";
      const ms = fracStr.length === 3
        ? parseInt(fracStr, 10)
        : fracStr.length === 2
          ? parseInt(fracStr, 10) * 10
          : parseInt(fracStr, 10) * 100;
      times.push(min * 60000 + sec * 1000 + ms);
    }

    if (times.length === 0) {
      const meta = trimmed.match(metaTagRe);
      if (meta) {
        const tag = meta[1].toLowerCase();
        const val = meta[2].trim();
        if (tag === "offset") offsetMs = parseInt(val, 10) || 0;
        if (tag === "la" || tag === "lang") language = val;
      }
      continue;
    }

    const text = trimmed.replace(timeTagRe, "").trim();
    if (!text) continue; // skip instrumental blank markers cleanly

    for (const t of times) {
      entries.push({
        startMs: Math.max(0, t + offsetMs),
        text
      });
    }
  }

  if (entries.length === 0) return null;
  entries.sort((a, b) => a.startMs - b.startMs);

  const lines = entries.map((entry, idx) => {
    const nextStart = entries[idx + 1]?.startMs ?? entry.startMs + 4500;
    const endMs = Math.max(entry.startMs + 800, Math.min(nextStart, entry.startMs + 12000));
    return {
      id: `${trackKey}-l-${idx}`,
      text: entry.text,
      startMs: entry.startMs,
      endMs,
      words: segmentWords(entry.text)
    };
  });

  return {
    trackKey,
    source,
    timing: "line",
    language,
    lines
  };
}

export function parsePlainLyrics(raw, trackKey, source = "lrclib") {
  if (!raw || typeof raw !== "string") return null;
  const textLines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (textLines.length === 0) return null;

  return {
    trackKey,
    source,
    timing: "static",
    lines: textLines.map((text, idx) => ({
      id: `${trackKey}-s-${idx}`,
      text,
      startMs: null,
      endMs: null,
      words: segmentWords(text)
    }))
  };
}

export function parseImportedFile(filename, content, trackKey) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "lrc") {
    return parseLRC(content, trackKey, "imported") || parsePlainLyrics(content, trackKey, "imported");
  }
  if (ext === "json") {
    const parsed = JSON.parse(content);
    const rawLines = Array.isArray(parsed) ? parsed : parsed.lines;
    if (!Array.isArray(rawLines) || rawLines.length === 0) return null;
    const hasTiming = rawLines.some((l) => typeof l.startMs === "number");
    return {
      trackKey,
      source: "imported",
      timing: hasTiming ? "line" : "static",
      language: parsed.language,
      lines: rawLines
        .filter((l) => l && typeof l.text === "string" && l.text.trim())
        .map((l, idx) => ({
          id: l.id || `${trackKey}-imp-${idx}`,
          text: l.text.trim(),
          startMs: typeof l.startMs === "number" ? l.startMs : null,
          endMs: typeof l.endMs === "number" ? l.endMs : null,
          words: Array.isArray(l.words) && l.words.length > 0 ? l.words : segmentWords(l.text.trim())
        }))
    };
  }
  return parsePlainLyrics(content, trackKey, "imported");
}

// LRCLIB public API provider (no credentials or scraping required)
const lrclibProvider = {
  id: "lrclib",
  async getLyrics({ trackKey, title, artists, album, durationMs, signal }) {
    if (!title) return null;
    const primaryArtist = (artists || "").split(",")[0].trim();
    const params = new URLSearchParams({
      track_name: title,
      artist_name: primaryArtist
    });
    if (album) params.set("album_name", album);
    if (durationMs) params.set("duration", String(Math.round(durationMs / 1000)));

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, { signal });
    if (res.ok) {
      const data = await res.json();
      if (isReasonableMatch({ title, artists, durationMs }, data)) {
        if (data.syncedLyrics) return parseLRC(data.syncedLyrics, trackKey, "lrclib");
        if (data.plainLyrics) return parsePlainLyrics(data.plainLyrics, trackKey, "lrclib");
      }
    } else if (res.status !== 404) {
      throw new Error(`Provider HTTP ${res.status}`);
    }

    // Fallback: LRCLIB search endpoint with strict validation
    const searchParams = new URLSearchParams({ q: `${title} ${primaryArtist}`.trim() });
    const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`, { signal });
    if (!searchRes.ok) return null;
    const list = await searchRes.json();
    if (!Array.isArray(list)) return null;

    const match = list.find(
      (item) => (item.syncedLyrics || item.plainLyrics) && isReasonableMatch({ title, artists, durationMs }, item)
    );
    if (!match) return null;
    if (match.syncedLyrics) return parseLRC(match.syncedLyrics, trackKey, "lrclib");
    if (match.plainLyrics) return parsePlainLyrics(match.plainLyrics, trackKey, "lrclib");
    return null;
  }
};

const localImportProvider = {
  id: "imported",
  async getLyrics({ trackKey }) {
    const imports = JSON.parse(localStorage.getItem(IMPORTS_KEY) || "{}");
    return imports[trackKey] || null;
  }
};

const fixtureProvider = {
  id: "fixture",
  async getLyrics({ trackKey, title }) {
    if (title === "Demo Synth Pulse" || trackKey === "demo:synth") {
      return parseLRC(DEMO_SYNTH_LRC, trackKey, "fixture");
    }
    return null;
  }
};

export class LyricsProviderManager {
  constructor() {
    this.providers = new Map([
      ["lrclib", lrclibProvider],
      ["imported", localImportProvider],
      ["fixture", fixtureProvider]
    ]);
  }

  getOrder(priority = "lrclib-first") {
    if (priority === "imported-only") return ["fixture", "imported"];
    if (priority === "imported-first") return ["fixture", "imported", "lrclib"];
    return ["fixture", "lrclib", "imported"];
  }

  readCache(cacheId) {
    try {
      const store = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      const item = store[cacheId];
      if (!item) return null;
      if (Date.now() - item.cachedAt > CACHE_TTL_MS) {
        delete store[cacheId];
        localStorage.setItem(CACHE_KEY, JSON.stringify(store));
        return null;
      }
      return item.doc;
    } catch {
      return null;
    }
  }

  writeCache(cacheId, doc) {
    try {
      const store = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      store[cacheId] = { cachedAt: Date.now(), doc };
      const keys = Object.keys(store);
      if (keys.length > MAX_CACHE_ENTRIES) {
        keys
          .sort((a, b) => store[a].cachedAt - store[b].cachedAt)
          .slice(0, keys.length - MAX_CACHE_ENTRIES)
          .forEach((k) => delete store[k]);
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(store));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }

  saveImported(trackKey, doc) {
    const imports = JSON.parse(localStorage.getItem(IMPORTS_KEY) || "{}");
    imports[trackKey] = doc;
    localStorage.setItem(IMPORTS_KEY, JSON.stringify(imports));
  }

  clearCache() {
    localStorage.removeItem(CACHE_KEY);
  }

  async fetchLyrics({ trackKey, title, artists, album, durationMs, priority = "lrclib-first", signal, skipCache = false }) {
    const order = this.getOrder(priority);
    const cacheId = `${trackKey}::${priority}`;

    if (!skipCache) {
      const cached = this.readCache(cacheId);
      if (cached) return cached;
    }

    let lastErr = null;
    for (const id of order) {
      const provider = this.providers.get(id);
      if (!provider) continue;
      try {
        const doc = await provider.getLyrics({ trackKey, title, artists, album, durationMs, signal });
        if (doc && Array.isArray(doc.lines) && doc.lines.length > 0) {
          if (id !== "fixture") this.writeCache(cacheId, doc);
          return doc;
        }
      } catch (err) {
        if (err.name === "AbortError") throw err;
        lastErr = err;
      }
    }

    if (lastErr) throw lastErr;
    return null;
  }
}
