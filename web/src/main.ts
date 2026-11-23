import Lenis from "lenis";
import "./style.css";
import { argus } from "./scenes/lattice";
import { rack } from "./scenes/rack";
import { tree } from "./scenes/tree";
import { vault } from "./scenes/vault";
import { mountStage, reduceMotion, type Stage } from "./stage";

// ── Smooth scroll ───────────────────────────────────────────────────
const lenis = reduceMotion ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
if (lenis) {
  const loop = (t: number) => { lenis.raf(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href")!;
    const target = id.length > 1 ? document.querySelector<HTMLElement>(id) : null;
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -64, duration: 1.4 });
    history.replaceState(null, "", id);
  }));
}

// ── Scroll progress for pinned sections (0 when it starts, 1 when it ends) ──
const progressOf = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  const span = r.height - innerHeight;
  return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : Math.min(1, Math.max(0, 1 - r.top / innerHeight));
};

// ── Scenes ──────────────────────────────────────────────────────────
type Bind = { section: HTMLElement; stage: Stage | null; onProgress?: (p: number, s: Stage) => void };
const binds: Bind[] = [];
const stage = (sel: string, section: string, build: Parameters<typeof mountStage>[1], opts: Parameters<typeof mountStage>[2], onProgress?: Bind["onProgress"]) => {
  const el = document.querySelector<HTMLElement>(sel), sec = document.querySelector<HTMLElement>(section);
  if (!el || !sec) return;
  binds.push({ section: sec, stage: mountStage(el, build, opts), onProgress });
};

stage("#stage-hero", "#hero", argus, { scale: 1.08, z: 7.2, poster: 4.2 }, (p, s) => s.setDolly(7.2 - p * 2.2, 0.15 + p * 0.3));
stage("#stage-tree", "#processes", tree, { scale: 0.95, z: 7.4 });
stage("#stage-vault", "#data", vault, { scale: 0.9, z: 7.6 });
stage("#stage-rack", "#servers", rack, { scale: 0.92, z: 7.4 });

// ── Per-frame scroll work: progress, CSS vars, the hero fade ─────────
const hero = document.querySelector<HTMLElement>("#hero");
const plates = [...document.querySelectorAll<HTMLElement>("[data-parallax]")];
const tick = () => {
  for (const b of binds) {
    const p = progressOf(b.section);
    b.section.style.setProperty("--p", p.toFixed(4));
    if (b.stage) { b.stage.setProgress(p); b.onProgress?.(p, b.stage); }
  }
  if (hero) hero.style.setProperty("--p", progressOf(hero).toFixed(4));
  for (const pl of plates) {
    const r = pl.getBoundingClientRect();
    const v = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1..1 around the centre
    pl.style.setProperty("--v", v.toFixed(4));
  }
  const max = document.documentElement.scrollHeight - innerHeight;
  document.documentElement.style.setProperty("--scroll", (max > 0 ? scrollY / max : 0).toFixed(4));
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

// ── Reveals: elements rise in once, staggered by their index in a group ──
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  (e.target as HTMLElement).classList.add("in");
  io.unobserve(e.target);
}), { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
  [...el.children].forEach((c, i) => (c as HTMLElement).style.setProperty("--i", String(i)));
  io.observe(el);
});

// ── The ledger types itself, line by line, when it comes into view ──
const ledger = document.querySelector<HTMLElement>(".ledger");
if (ledger) {
  const rows = [...ledger.querySelectorAll<HTMLElement>(".ledger__rows li")];
  const lio = new IntersectionObserver(([e]) => {
    if (!e?.isIntersecting) return;
    rows.forEach((r, i) => setTimeout(() => r.classList.add("on"), reduceMotion ? 0 : 420 + i * 520));
    lio.disconnect();
  }, { threshold: 0.4 });
  lio.observe(ledger);
}

// ── Counters ────────────────────────────────────────────────────────
document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
  const to = Number(el.dataset.count);
  const cio = new IntersectionObserver(([e]) => {
    if (!e?.isIntersecting) return;
    cio.disconnect();
    if (reduceMotion) { el.textContent = String(to); return; }
    const t0 = performance.now();
    const step = (n: number) => {
      const k = Math.min(1, (n - t0) / 1400), eased = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(to * eased));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, { threshold: 0.6 });
  cio.observe(el);
});

// ── Copy buttons ────────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((b) => b.addEventListener("click", () => {
  const el = document.querySelector<HTMLElement>(b.dataset.copy!);
  if (!el || !navigator.clipboard) return;
  navigator.clipboard.writeText(el.innerText.trim()).then(() => {
    b.textContent = "Copied";
    setTimeout(() => (b.textContent = "Copy"), 1600);
  }).catch(() => {});
}));

// ── Nav: hairline appears once the page has moved ───────────────────
const nav = document.querySelector<HTMLElement>(".nav");
addEventListener("scroll", () => nav?.classList.toggle("nav--scrolled", scrollY > 8), { passive: true });
