// WebGL Shader Renderer for Legacy FX: lazy-loaded only when selected, cleaned up on switch

const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// #4: Fractal Tunnel — Layered architectural SDF rings, depth fog, and iridescent palette mixing
const FRACTAL_TUNNEL_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_res;
uniform float u_time;
uniform float u_bass;
uniform float u_mids;
uniform float u_treble;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform float u_steps;

void main() {
  vec2 p = (v_uv - 0.5) * vec2(u_res.x / max(1.0, u_res.y), 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);

  // Beat-driven camera travel & subtle torsion
  float speed = u_time * 1.35;
  float depth = 0.72 / max(r, 0.04);
  float z = depth + speed;
  float twist = a + sin(z * 0.35 + u_time * 0.45) * (0.35 + u_mids * 0.55);

  // Geometric faceted ribs scaled by quality steps
  float facets = floor(4.0 + u_steps * 0.35);
  float poly = cos(floor(0.5 + twist * facets / 6.2831853) * (6.2831853 / facets) - twist);
  float rib = abs(sin(z * 2.6 + poly * 1.4));
  float lattice = abs(cos(twist * facets + sin(z * 1.2) * 0.5));

  float structure = smoothstep(0.22, 0.94, rib * 0.72 + lattice * 0.28);
  float glowLine = exp(-abs(rib - 0.5) * (7.0 - u_bass * 2.5));

  vec3 baseCol = mix(u_c1, u_c2, 0.5 + 0.5 * sin(z * 0.55 + twist * 0.5));
  vec3 col = baseCol * (structure * 0.55 + glowLine * (0.75 + u_bass * 0.85 + u_treble * 0.4));

  // Depth fog & center aperture vignette
  float fog = smoothstep(0.03, 0.38, r) * smoothstep(1.38, 0.14, r);
  col *= fog;
  float alpha = clamp(max(col.r, max(col.g, col.b)) * 1.4, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

// #5: Kaleidoscope — Multi-fold polar symmetry with optional album-art texture refraction
const KALEIDOSCOPE_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_res;
uniform float u_time;
uniform float u_bass;
uniform float u_mids;
uniform float u_treble;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform float u_steps;
uniform sampler2D u_tex;
uniform float u_hasTex;

void main() {
  vec2 p = (v_uv - 0.5) * vec2(u_res.x / max(1.0, u_res.y), 1.0);
  float slices = max(6.0, floor(u_steps * 0.75));
  float r = length(p) * (1.0 - u_bass * 0.12);
  float a = atan(p.y, p.x) + u_time * 0.18 + sin(r * 3.0 - u_time * 0.5) * (0.18 + u_mids * 0.25);

  float sector = 6.2831853 / slices;
  a = mod(a, sector);
  a = abs(a - sector * 0.5);

  vec2 kp = vec2(cos(a), sin(a)) * r;

  // Stained-glass interference petals
  float w1 = sin(kp.x * 11.0 + u_time * 0.9) * cos(kp.y * 11.0 - u_time * 0.7);
  float w2 = cos((kp.x + kp.y) * 7.5 - u_time * 0.6);
  float petal = smoothstep(-0.15, 0.85, w1 * 0.65 + w2 * 0.35 + u_mids * 0.35);
  float edge = exp(-abs(w1) * 4.5);

  vec3 col = mix(u_c1, u_c2, petal) + (u_c2 * 0.45 * edge);
  if (u_hasTex > 0.5) {
    vec2 tuv = fract(kp * 0.85 + vec2(0.5 + sin(u_time * 0.15) * 0.08));
    vec3 texCol = texture2D(u_tex, tuv).rgb;
    col = mix(col, texCol * (1.0 + edge * 0.5), 0.52);
  }

  col *= (0.48 + u_bass * 0.65 + u_treble * 0.32) * smoothstep(1.15, 0.04, r);
  float alpha = clamp(max(col.r, max(col.g, col.b)) * 1.35, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

// #7: Plasma Reactor — Domain-warped organic plasma field with glowing energy veins
const PLASMA_REACTOR_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_res;
uniform float u_time;
uniform float u_bass;
uniform float u_mids;
uniform float u_treble;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform float u_steps;

void main() {
  vec2 p = (v_uv - 0.5) * vec2(u_res.x / max(1.0, u_res.y), 1.0) * 2.8;
  float r = length(p);
  float v = 0.0;
  float iter = max(3.0, min(7.0, floor(u_steps * 0.5)));

  for (float i = 1.0; i <= 7.0; i += 1.0) {
    if (i > iter) break;
    float shift = u_time * (0.42 + i * 0.06);
    p += vec2(
      sin(p.y * (1.1 + i * 0.35) + shift),
      cos(p.x * (1.1 + i * 0.35) - shift * 0.85)
    ) * (0.34 + u_mids * 0.24);
    v += sin(p.x * 1.2 + p.y * 1.2 + u_time * 0.7);
  }

  float vein = 1.0 - smoothstep(0.0, 0.68, abs(sin(v * 0.68)));
  float core = exp(-r * (1.15 - u_bass * 0.35)) * (0.45 + u_bass * 0.65);

  vec3 col = mix(u_c1 * 0.28, u_c2, vein) * (0.58 + u_bass * 0.75 + u_treble * 0.35);
  col += mix(u_c1, vec3(1.0), 0.35) * core * 0.55;
  float alpha = clamp(max(col.r, max(col.g, col.b)) * 1.35 + 0.12, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

const SHADER_SOURCES = {
  "fractal-tunnel": FRACTAL_TUNNEL_FRAG,
  "kaleidoscope": KALEIDOSCOPE_FRAG,
  "plasma-reactor": PLASMA_REACTOR_FRAG
};

function hexToRgbNorm(hex) {
  const clean = (hex || "#e4e4e7").replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) || 228;
  const g = parseInt(clean.slice(2, 4), 16) || 228;
  const b = parseInt(clean.slice(4, 6), 16) || 231;
  return [r / 255, g / 255, b / 255];
}

export class WebGLVisualizerHost {
  constructor(onError = null) {
    this.onError = onError;
    this.canvas = null;
    this.gl = null;
    this.programs = new Map();
    this.quadBuf = null;
    this.tex = null;
    this.hasTex = false;
    this.time = 0;
    this.onContextLost = (e) => {
      e.preventDefault();
      this.destroy();
      this.onError?.("webgl-lost");
    };
  }

  init(parentCanvas, mode) {
    if (!this.canvas) {
      const c = document.createElement("canvas");
      c.id = "viz-webgl-canvas";
      c.addEventListener("webglcontextlost", this.onContextLost);
      parentCanvas.insertAdjacentElement("afterend", c);
      this.canvas = c;

      const gl = c.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: "high-performance" });
      if (!gl) {
        this.destroy();
        return false;
      }
      this.gl = gl;
      gl.clearColor(0, 0, 0, 0);

      this.quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    }

    if (mode) {
      // Release other cached programs when switching WebGL visualizers
      for (const [k, p] of this.programs.entries()) {
        if (k !== mode) {
          this.gl.deleteProgram(p.prog);
          this.programs.delete(k);
        }
      }
      if (!this.programs.has(mode)) {
        return this.compileProgram(mode, SHADER_SOURCES[mode]);
      }
    }
    return Boolean(this.gl);
  }

  compileProgram(name, fragSrc) {
    const gl = this.gl;
    if (!gl || !fragSrc) return false;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VERT_SRC);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      gl.deleteShader(vs);
      return false;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return false;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return false;
    }

    this.programs.set(name, {
      prog,
      aPos: gl.getAttribLocation(prog, "a_pos"),
      uRes: gl.getUniformLocation(prog, "u_res"),
      uTime: gl.getUniformLocation(prog, "u_time"),
      uBass: gl.getUniformLocation(prog, "u_bass"),
      uMids: gl.getUniformLocation(prog, "u_mids"),
      uTreble: gl.getUniformLocation(prog, "u_treble"),
      uC1: gl.getUniformLocation(prog, "u_c1"),
      uC2: gl.getUniformLocation(prog, "u_c2"),
      uSteps: gl.getUniformLocation(prog, "u_steps"),
      uTex: gl.getUniformLocation(prog, "u_tex"),
      uHasTex: gl.getUniformLocation(prog, "u_hasTex")
    });
    return true;
  }

  setAlbumTexture(img) {
    const gl = this.gl;
    if (!gl || !img || !img.complete || img.naturalWidth === 0) return;
    try {
      if (!this.tex) this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      this.hasTex = true;
    } catch {
      this.hasTex = false;
    }
  }

  resize(w, h, dpr) {
    if (!this.canvas || !this.gl) return;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(mode, sample, palette, qualityCfg, speed = 1.0) {
    const gl = this.gl;
    if (!gl || gl.isContextLost()) return false;
    const info = this.programs.get(mode);
    if (!info) return false;

    this.time += (0.014 + (sample.bands.energy || 0) * 0.025) * speed;
    const c1 = hexToRgbNorm(palette[0]);
    const c2 = hexToRgbNorm(palette[1] || palette[0]);

    gl.useProgram(info.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(info.aPos);
    gl.vertexAttribPointer(info.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(info.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(info.uTime, this.time);
    gl.uniform1f(info.uBass, sample.bands.bass || 0);
    gl.uniform1f(info.uMids, sample.bands.mids || 0);
    gl.uniform1f(info.uTreble, sample.bands.treble || 0);
    gl.uniform3f(info.uC1, c1[0], c1[1], c1[2]);
    gl.uniform3f(info.uC2, c2[0], c2[1], c2[2]);
    gl.uniform1f(info.uSteps, qualityCfg.shaderSteps);

    if (info.uHasTex !== null) {
      gl.uniform1f(info.uHasTex, this.hasTex ? 1.0 : 0.0);
      if (this.hasTex && this.tex) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.uniform1i(info.uTex, 0);
      }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  destroy() {
    if (this.canvas) {
      this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    }
    if (this.gl) {
      this.programs.forEach((p) => this.gl.deleteProgram(p.prog));
      this.programs.clear();
      if (this.quadBuf) this.gl.deleteBuffer(this.quadBuf);
      if (this.tex) this.gl.deleteTexture(this.tex);
      this.gl.getExtension("WEBGL_lose_context")?.loseContext();
      this.quadBuf = null;
      this.tex = null;
      this.hasTex = false;
      this.gl = null;
    }
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
  }
}
