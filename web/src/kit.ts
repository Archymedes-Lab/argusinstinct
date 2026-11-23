import * as THREE from "three";

/**
 * Shared look for every three.js scene on the site: solids are shaded as
 * manga screentone (paper where lit, halftone dots in the mid-tones, solid
 * ink in shadow) and drawn with an ink outline, so a 3D instrument reads
 * as one of the printed plates rather than as a product render.
 *
 * Colours come from the CSS custom properties of the element a scene is
 * mounted in, so a scene inside a dark band inks itself for that band.
 */

export type Palette = {
  ink: THREE.Color;
  accent: THREE.Color;
  paper: THREE.Color;
  muted: THREE.Color;
  /** True when the surface is darker than the ink (dark theme or a black band). */
  dark: boolean;
};

export function readPalette(el: Element): Palette {
  const s = getComputedStyle(el);
  const c = (n: string, f: string) => new THREE.Color(s.getPropertyValue(n).trim() || f);
  const ink = c("--ink", "#111214");
  const paper = c("--paper", "#fcfcfa");
  const lum = (k: THREE.Color) => 0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b;
  return { ink, paper, accent: c("--blue", "#3478e5"), muted: c("--muted", "#74777c"), dark: lum(paper) < lum(ink) };
}

export type SceneModel = {
  group: THREE.Group;
  update: (t: number, dt: number, pointer: { x: number; y: number }) => void;
  dispose: () => void;
  /** Resting rotation of the group (x, y). */
  tilt: [number, number];
};

const TONE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const TONE_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uBase;
uniform vec3 uWater;
uniform float uFlip;
uniform float uShade;
uniform float uCell;
uniform float uWaterY;
uniform float uTime;
varying vec3 vN;
varying vec3 vW;

float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 6.2831853, 6.2831853) - 250.0;
  vec2 i = p;
  float c = 1.0;
  for (int n = 0; n < 3; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
  }
  c = 1.17 - pow(c / 3.0, 1.4);
  return pow(abs(c), 8.0);
}

void main() {
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  float lit = dot(n, normalize(vec3(-0.42, 0.78, 0.46))) * 0.5 + 0.5;
  // on a dark surface the ink is the light colour, so it goes on the lit side, and never solid
  float dark = mix(1.0 - lit, lit * 0.6, uFlip);
  // shade always means darker: more ink on paper, less chalk on a dark surface
  dark = clamp(dark * 1.18 + uShade * (1.0 - 2.0 * uFlip) - 0.16, 0.0, 1.0);
  float r = smoothstep(0.3, 0.86, dark) * 0.6;
  vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / uCell;
  float dotMask = (1.0 - smoothstep(r - 0.1, r, length(fract(q) - 0.5))) * step(0.02, r);
  float inkAmt = max(dotMask, smoothstep(0.88, 0.95, dark));
  vec3 col = mix(uBase, uInk, inkAmt);
  if (vW.y < uWaterY) {
    float depth = clamp((uWaterY - vW.y) * 1.6, 0.0, 1.0);
    col = mix(col, uWater, 0.34 + depth * 0.26);
    col += caustic(vW.xz * 0.55, uTime * 0.6) * 0.2 * max(n.y, 0.0);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const HULL_VERT = /* glsl */ `
uniform float uWidth;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * uWidth, 1.0);
}`;

export type Kit = {
  p: Palette;
  /** Screentone solid in paper. `shade` (0..1) pushes the whole surface darker. */
  tone: (shade?: number) => THREE.ShaderMaterial;
  /** Screentone solid in the accent blue. */
  blue: (shade?: number) => THREE.ShaderMaterial;
  line: (color?: THREE.Color, opacity?: number) => THREE.LineBasicMaterial;
  flat: (color: THREE.Color, opacity?: number) => THREE.MeshBasicMaterial;
  /** A mesh with feature edges and a silhouette line. */
  solid: (geo: THREE.BufferGeometry, mat: THREE.Material, opts?: { edges?: boolean; hull?: number; angle?: number }) => THREE.Group;
  /** Every tone material made so far, for per-frame uniforms (time, water level). */
  tones: THREE.ShaderMaterial[];
  hull: THREE.ShaderMaterial;
  /** Screentone cell size in device pixels. */
  cell: number;
  dispose: (root: THREE.Object3D) => void;
};

export function createKit(p: Palette, dpr = 1): Kit {
  const tones: THREE.ShaderMaterial[] = [];
  const make = (base: THREE.Color, shade: number) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: TONE_VERT,
      fragmentShader: TONE_FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        uInk: { value: p.ink }, uBase: { value: base }, uWater: { value: p.accent },
        uFlip: { value: p.dark ? 1 : 0 }, uShade: { value: shade }, uCell: { value: 5 * dpr },
        uWaterY: { value: -1e3 }, uTime: { value: 0 },
      },
    });
    tones.push(m);
    return m;
  };
  const hull = new THREE.ShaderMaterial({
    vertexShader: HULL_VERT,
    fragmentShader: "uniform vec3 uInk; void main(){ gl_FragColor = vec4(uInk, 1.0); }",
    side: THREE.BackSide,
    uniforms: { uInk: { value: p.ink }, uWidth: { value: 0.012 } },
  });
  const line = (color = p.ink, opacity = 1) =>
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

  return {
    p, tones, hull, line, cell: 5 * dpr,
    tone: (shade = 0) => make(p.paper, shade),
    blue: (shade = 0) => make(p.accent, shade),
    flat: (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }),
    solid(geo, mat, opts = {}) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, mat));
      if (opts.edges !== false) g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, opts.angle ?? 28), line()));
      if (opts.hull !== 0) {
        const h = hull.clone();
        h.uniforms.uInk = { value: p.ink };
        h.uniforms.uWidth = { value: opts.hull ?? 0.012 };
        g.add(new THREE.Mesh(geo, h));
      }
      return g;
    },
    dispose(root) {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      hull.dispose();
    },
  };
}

export const ease = (x: number) => x * x * (3 - 2 * x);
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 → 1 between a and b, smoothed. */
export const ramp = (x: number, a: number, b: number) => ease(clamp01((x - a) / (b - a)));

export function circle(r: number, mat: THREE.Material, seg = 96) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
}

export function polyline(points: THREE.Vector3[], mat: THREE.Material, closed = false) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  return closed ? new THREE.LineLoop(g, mat) : new THREE.Line(g, mat);
}
