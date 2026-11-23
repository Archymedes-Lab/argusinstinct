import * as THREE from "three";
import { createKit, readPalette, type Kit, type SceneModel } from "./kit";

/**
 * Hosts one scene in one element. The renderer exists only while the element is near the viewport; colours come from
 * the element's CSS tokens (so a scene in a black band inks itself for that band, and dark mode just works).
 * `progress` is supplied by the page (scroll), `camera` lets a section dolly the view.
 */
export interface Scene extends SceneModel { setProgress?: (p: number) => void }
export interface Stage {
  setProgress: (p: number) => void;
  setDolly: (z: number, y?: number) => void;
  destroy: () => void;
}

const webgl = (() => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
})();
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mountStage(el: HTMLElement, build: (kit: Kit) => Scene, opts: { scale?: number; z?: number; fov?: number; poster?: number } = {}): Stage | null {
  if (!webgl) { el.dataset.fallback = "1"; return null; }
  const dpr = Math.min(devicePixelRatio || 1, 1.75);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(dpr);
  renderer.domElement.setAttribute("aria-hidden", "true");
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 32, 1, 0.1, 60);
  const baseZ = opts.z ?? 7.2;
  let dollyZ = baseZ, dollyY = 0.15, camZ = baseZ, camY = 0.15;
  const pivot = new THREE.Group();
  pivot.scale.setScalar(opts.scale ?? 1);
  scene.add(pivot);

  let model: Scene;
  const make = () => {
    if (model) { pivot.remove(model.group); model.dispose(); }
    model = build(createKit(readPalette(el), dpr));
    pivot.add(model.group);
    pivot.rotation.set(model.tilt[0], 0, 0);
  };
  make();

  const ptr = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  let progress = 0, shown = 0;
  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  };
  addEventListener("pointermove", onMove, { passive: true });

  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the model framed on narrow screens
    camera.position.z = camZ * (camera.aspect < 0.8 ? 1.25 : 1);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  // theme changes repaint the scene in the new tokens
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onTheme = () => make();
  mq.addEventListener("change", onTheme);

  let raf = 0, visible = false, t = opts.poster ?? 0, last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduceMotion) t += dt;
    smooth.x += (ptr.x - smooth.x) * 0.05;
    smooth.y += (ptr.y - smooth.y) * 0.05;
    shown += (1 - shown) * 0.04;
    camZ += (dollyZ - camZ) * 0.08;
    camY += (dollyY - camY) * 0.08;
    camera.position.set(smooth.x * 0.25, camY - smooth.y * 0.15, camZ * (camera.aspect < 0.8 ? 1.25 : 1));
    camera.lookAt(0, 0, 0);
    model.setProgress?.(progress);
    model.update(t, dt, smooth);
    pivot.rotation.x = model.tilt[0] + smooth.y * 0.05;
    pivot.scale.setScalar((opts.scale ?? 1) * (0.92 + 0.08 * shown));
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    if (visible) { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    else cancelAnimationFrame(raf);
  }, { rootMargin: "120px" });
  io.observe(el);
  // one composed frame up front, so a still exists before anything animates
  requestAnimationFrame((n) => { last = n; const v = visible; visible = false; frame(n); visible = v; });

  return {
    setProgress: (v) => { progress = v; },
    setDolly: (z, y) => { dollyZ = z; if (y != null) dollyY = y; },
    destroy: () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      removeEventListener("pointermove", onMove); mq.removeEventListener("change", onTheme);
      model.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
