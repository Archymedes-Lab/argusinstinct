import * as THREE from "three";
import { circle, clamp01, ramp, type Kit, type SceneModel } from "../kit";

/**
 * Servers: a rack of units, each with a status bar. A survey ring passes down the rack once per scroll; each unit it
 * passes reports in (its bar fills). One unit shows a login from a network not seen before: a beacon blinks blue at it.
 * The audit account sits at the side, separate from the rack it reads: read-only, unprivileged.
 */
const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };

export function rack(kit: Kit): SceneModel & { setProgress: (p: number) => void } {
  const { p } = kit;
  const group = new THREE.Group();
  group.add(at(kit.solid(new THREE.BoxGeometry(1.5, 2.5, 0.95), kit.tone(0.5), { hull: 0.012 }), 0, 0, -0.05));
  const units = Array.from({ length: 7 }, (_, i) => {
    const y = 0.95 - i * 0.31;
    const u = at(kit.solid(new THREE.BoxGeometry(1.32, 0.24, 0.9), kit.tone(0.08 + (i % 3) * 0.06), { hull: 0.008 }), 0, y, 0.06);
    group.add(u);
    const barGeo = new THREE.PlaneGeometry(1, 0.035);
    barGeo.translate(0.5, 0, 0);
    const bar = at(new THREE.Mesh(barGeo, kit.flat(i === 4 ? p.accent : p.ink, 0.9)), -0.55, y, 0.515);
    bar.scale.x = 0.001;
    group.add(bar);
    for (let k = 0; k < 3; k++) group.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), kit.flat(p.muted)), 0.42 + k * 0.07, y + 0.05, 0.516));
    return { y, bar };
  });
  const ring = circle(1, kit.line(p.accent), 96);
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1.05, 0.75, 1);
  group.add(ring);
  const beacon = new THREE.Group();
  beacon.add(circle(0.2, kit.line(p.accent), 48), circle(0.32, kit.line(p.accent, 0.5), 48));
  beacon.position.set(0.66, units[4].y, 0.55);
  group.add(beacon);
  // the audit account: a small separate block with a line of sight to the rack, never touching it
  const auditor = at(kit.solid(new THREE.BoxGeometry(0.34, 0.34, 0.34), kit.blue(0.1), { hull: 0.008 }), -1.95, 0.35, 0.6);
  group.add(auditor);
  const sight = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.78, 0.35, 0.6), new THREE.Vector3(-0.68, 0.3, 0.5)]),
    new THREE.LineDashedMaterial({ color: p.accent, dashSize: 0.05, gapSize: 0.05 }));
  sight.computeLineDistances();
  group.add(sight);
  const floor = new THREE.GridHelper(5, 20, p.muted, p.muted);
  (floor.material as THREE.Material).transparent = true;
  (floor.material as THREE.Material).opacity = 0.16;
  floor.position.y = -1.3;
  group.add(floor);

  let progress = 0;
  return {
    group, tilt: [0.16, 0.55],
    setProgress: (v) => { progress = clamp01(v); },
    update(t, _dt, ptr) {
      const ry = 1.15 - ramp(progress, 0.1, 0.8) * 2.4;
      ring.position.y = ry;
      ring.visible = progress > 0.05 && progress < 0.88;
      units.forEach((u, i) => {
        const passed = ry < u.y ? 1 : 0;
        const target = passed * (0.45 + ((i * 37) % 50) / 100);
        u.bar.scale.x += (Math.max(0.001, target) - u.bar.scale.x) * 0.08;
      });
      const seen = ry < units[4].y;
      beacon.visible = seen;
      beacon.quaternion.copy(group.quaternion).invert();
      beacon.scale.setScalar(1 + ((t * 1.2) % 1) * 0.6);
      auditor.rotation.y = t * 0.5;
      auditor.position.y = 0.35 + Math.sin(t * 1.2) * 0.04;
      group.rotation.y = 0.55 + ptr.x * 0.2 + Math.sin(t * 0.12) * 0.06;
    },
    dispose: () => kit.dispose(group),
  };
}
