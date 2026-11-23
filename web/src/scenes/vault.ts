import * as THREE from "three";
import { circle, clamp01, ramp, type Kit, type SceneModel } from "../kit";

/**
 * Data: a disk drawn as stacked platters. A scan plane moves down through it and finds keys left in plain text
 * (small blue tokens) and lifts them out so you can see where they are. Around it, a dashed boundary: particles that
 * drift toward it turn back. Nothing crosses. `progress` (0..1) is scroll.
 */
const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };

export function vault(kit: Kit): SceneModel & { setProgress: (p: number) => void } {
  const { p } = kit;
  const group = new THREE.Group();
  const platters: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const g = kit.solid(new THREE.CylinderGeometry(0.95, 0.95, 0.07, 64), kit.tone(0.12 + (i % 2) * 0.14), { angle: 40, hull: 0.008 });
    at(g, 0, -0.75 + i * 0.32, 0);
    platters.push(g);
    group.add(g);
  }
  group.add(at(kit.solid(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 24), kit.tone(0.6), { hull: 0.006 }), 0, -0.1, 0));

  // keys found in plain text: they sit in the platters, then lift out when the scan passes them
  const keys = Array.from({ length: 4 }, (_, i) => {
    const a = i * 1.7 + 0.4, r = 0.55 + (i % 2) * 0.2, y = -0.75 + (i + 1) * 0.32 - 0.12;
    const g = new THREE.Group();
    g.add(kit.solid(new THREE.BoxGeometry(0.16, 0.05, 0.08), kit.blue(0.05), { hull: 0.006 }));
    g.add(at(kit.solid(new THREE.TorusGeometry(0.05, 0.016, 8, 20), kit.blue(0.05), { edges: false, hull: 0.004 }), -0.11, 0, 0));
    const home = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const lifted = new THREE.Vector3(Math.cos(a) * 1.55, y + 0.25, Math.sin(a) * 1.55);
    g.position.copy(home);
    group.add(g);
    const label = circle(0.13, kit.line(p.accent), 32);
    group.add(label);
    return { g, home, lifted, y, label };
  });

  const scan = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), kit.flat(p.accent, 0.08));
  scan.rotation.x = -Math.PI / 2;
  const scanRing = circle(1.25, kit.line(p.accent), 96);
  scanRing.rotation.x = Math.PI / 2;
  group.add(scan, scanRing);

  // the boundary: nothing leaves the machine
  const boundary = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.05, 1), 1),
    new THREE.LineDashedMaterial({ color: p.ink, dashSize: 0.06, gapSize: 0.08, transparent: true, opacity: 0.35 }));
  boundary.computeLineDistances();
  group.add(boundary);
  const N = 70;
  const pts = new Float32Array(N * 3);
  const seeds = Array.from({ length: N }, () => ({ th: Math.random() * Math.PI * 2, ph: Math.acos(2 * Math.random() - 1), sp: 0.2 + Math.random() * 0.5, off: Math.random() * 10 }));
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  const particles = new THREE.Points(pg, new THREE.PointsMaterial({ color: p.ink, size: 0.03, transparent: true, opacity: 0.7 }));
  group.add(particles);

  let progress = 0;
  return {
    group, tilt: [0.32, -0.4],
    setProgress: (v) => { progress = clamp01(v); },
    update(t, _dt, ptr) {
      const sy = 0.75 - ramp(progress, 0.1, 0.7) * 1.7;
      scan.position.y = sy; scanRing.position.y = sy;
      (scan.material as THREE.MeshBasicMaterial).opacity = 0.08 * (1 - ramp(progress, 0.75, 0.9));
      scanRing.visible = progress > 0.08 && progress < 0.85;
      platters.forEach((g, i) => { g.rotation.y = t * (0.12 + i * 0.03) * (i % 2 ? -1 : 1); });
      keys.forEach((k) => {
        const found = sy < k.y + 0.02 ? 1 : 0;
        const lift = found * ramp(progress, 0.15, 0.95);
        k.g.position.lerpVectors(k.home, k.lifted, Math.min(1, lift * 1.6));
        k.g.rotation.y = t * 0.8;
        k.label.position.copy(k.g.position);
        k.label.quaternion.copy(group.quaternion).invert();
        k.label.visible = lift > 0.05;
        k.label.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
      });
      // particles drift outward and turn back just inside the boundary
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        const r = 1.25 + 0.7 * Math.abs(Math.sin(t * s.sp + s.off));
        const th = s.th + t * 0.08;
        pts[i * 3] = r * Math.sin(s.ph) * Math.cos(th);
        pts[i * 3 + 1] = r * Math.cos(s.ph) * 0.8;
        pts[i * 3 + 2] = r * Math.sin(s.ph) * Math.sin(th);
      }
      pg.attributes.position.needsUpdate = true;
      boundary.rotation.y = t * 0.03;
      group.rotation.y = -0.4 + ptr.x * 0.2;
    },
    dispose: () => kit.dispose(group),
  };
}
