import * as THREE from "three";
import { circle, polyline, ramp, type Kit, type SceneModel } from "../kit";

// The Argus instrument from archymedes-site (lib/product-models.ts), unchanged: a machine under a lattice dome with
// one panel honestly missing; a sweep passes, an intruder is flagged, held in a cage, then released on undo.
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };
function bar(kit: Kit, color: THREE.Color, h = 0.05, opacity = 1) {
  const g = new THREE.PlaneGeometry(1, h);
  g.translate(0.5, 0, 0);
  return new THREE.Mesh(g, kit.flat(color, opacity));
}

export function argus(kit: Kit): SceneModel {
  const { p } = kit;
  const group = new THREE.Group();
  const R = 1.5, CUT = -0.55;
  group.add(at(kit.solid(new THREE.CylinderGeometry(1.5, 1.6, 0.1, 48), kit.tone(0.24), { edges: false }), 0, CUT - 0.05, 0));
  // the machine being guarded
  const board = at(kit.solid(box(1.25, 0.07, 0.86), kit.tone(0.16)), 0, CUT + 0.04, 0.05);
  const lid = at(kit.solid(box(1.25, 0.8, 0.045), kit.tone(0.1), { hull: 0.012 }), 0, CUT + 0.44, -0.42);
  lid.rotation.x = -0.22;
  const glow = at(new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.62), kit.flat(p.ink)), 0, 0, 0.026);
  lid.add(glow);
  for (let i = 0; i < 4; i++) {
    const m = at(bar(kit, i === 1 ? p.accent : p.paper, 0.04, 0.9), -0.44, 0.18 - i * 0.11, 0.03);
    m.scale.x = [0.5, 0.74, 0.36, 0.6][i];
    lid.add(m);
  }
  group.add(board, lid, at(kit.solid(box(0.34, 0.07, 0.34), kit.blue(0.1)), -0.3, CUT + 0.11, 0.12));
  for (let i = 0; i < 5; i++) group.add(at(kit.solid(box(0.12, 0.06 + (i % 2) * 0.05, 0.16), kit.tone(0.3)), 0.12 + (i % 3) * 0.19, CUT + 0.1, -0.1 + Math.floor(i / 3) * 0.26));

  // the lattice, with one panel honestly missing
  const ico = new THREE.IcosahedronGeometry(R, 1);
  const ep = new THREE.EdgesGeometry(ico, 1).attributes.position as THREE.BufferAttribute;
  const gapC = new THREE.Vector3(0.62, 0.72, 0.9).normalize().multiplyScalar(R);
  const keep: number[] = [], gap: number[] = [];
  for (let i = 0; i < ep.count; i += 2) {
    const a = new THREE.Vector3().fromBufferAttribute(ep, i), b = new THREE.Vector3().fromBufferAttribute(ep, i + 1);
    if (a.y < CUT - 0.02 || b.y < CUT - 0.02) continue;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    (mid.distanceTo(gapC) < 0.5 ? gap : keep).push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const mk = (arr: number[], mat: THREE.Material) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return new THREE.LineSegments(g, mat);
  };
  const lattice = mk(keep, kit.line(p.ink, 0.62));
  const gapLines = mk(gap, new THREE.LineDashedMaterial({ color: p.accent, dashSize: 0.07, gapSize: 0.06 }));
  gapLines.computeLineDistances();
  const shell = new THREE.Group();
  shell.add(lattice, gapLines);
  // rear panels shaded, so the dome has a back
  const fp = ico.attributes.position as THREE.BufferAttribute;
  const panels: number[] = [];
  for (let i = 0; i < fp.count; i += 3) {
    const v = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(fp, i + k));
    const cz = (v[0].z + v[1].z + v[2].z) / 3, cy = Math.min(v[0].y, v[1].y, v[2].y);
    if (cz < -0.5 && cy > CUT && (i / 3) % 2 === 0) v.forEach((q) => panels.push(q.x, q.y, q.z));
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.Float32BufferAttribute(panels, 3));
  pg.computeVertexNormals();
  shell.add(new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: p.ink, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide })));
  group.add(shell);

  const sweep = circle(1, kit.line(p.accent), 96);
  sweep.rotation.x = Math.PI / 2;
  group.add(sweep);
  const procs = Array.from({ length: 5 }, (_, i) => {
    const g = kit.solid(box(0.1, 0.1, 0.1), kit.tone(0.1 + (i % 2) * 0.2), { hull: 0.007 });
    group.add(g);
    return g;
  });
  // the intruder, the reticle that flags it, and the cage that holds it
  const intruder = kit.solid(new THREE.TetrahedronGeometry(0.16, 0), kit.tone(0.75), { hull: 0.01 });
  const reticle = new THREE.Group();
  reticle.add(circle(0.3, kit.line(p.accent), 48));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    reticle.add(polyline([new THREE.Vector3(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0), new THREE.Vector3(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0)], kit.line(p.accent)));
  }
  const cagePos = new THREE.Vector3(-0.95, CUT + 0.28, 0.72);
  const cage = at(new THREE.LineSegments(new THREE.EdgesGeometry(box(0.42, 0.42, 0.42)), kit.line(p.ink, 0.9)), cagePos.x, cagePos.y, cagePos.z);
  group.add(intruder, reticle, cage);
  const far = new THREE.Vector3(2.3, 1.0, 1.5), wall = far.clone().normalize().multiplyScalar(R + 0.14);
  const q = new THREE.Vector3();

  return {
    group, tilt: [0.16, -0.5],
    update(t, _dt, ptr) {
      const c = t % 13;
      const y = CUT + 0.08 + (0.5 + 0.5 * Math.sin(t * 0.9)) * (R - 0.2 + CUT * -1 - 0.1);
      sweep.position.y = y;
      sweep.scale.setScalar(Math.sqrt(Math.max(0.01, R * R - y * y)));
      shell.rotation.y = t * 0.05 + ptr.x * 0.15;
      (gapLines.material as THREE.LineDashedMaterial).opacity = 1;
      procs.forEach((g, i) => {
        const a = t * (0.5 + i * 0.13) + i * 1.3, r = 0.5 + (i % 3) * 0.22;
        g.position.set(Math.cos(a) * r, CUT + 0.55 + (i % 4) * 0.18 + Math.sin(t + i) * 0.05, Math.sin(a) * r * 0.8);
        g.rotation.set(a, a * 0.7, 0);
      });
      // approach → flagged at the shell → held in the cage → released on undo
      const approach = ramp(c, 0.5, 3), hold = ramp(c, 5, 6.4), release = ramp(c, 10.5, 12.2);
      q.lerpVectors(far, wall, approach);
      if (hold > 0) q.lerpVectors(wall, cagePos, hold);
      if (release > 0) q.lerpVectors(cagePos, far, release);
      intruder.position.copy(q);
      intruder.rotation.set(t * 1.3, t * 0.9, 0);
      intruder.scale.setScalar(hold > 0.9 && release < 0.1 ? 0.8 : 1);
      const flagged = c > 2.9 && c < 10.6;
      reticle.visible = flagged;
      reticle.position.copy(q);
      reticle.quaternion.copy(group.quaternion).invert();
      reticle.rotation.z += 0;
      reticle.scale.setScalar(1 + Math.max(0, 1 - (c - 2.9) * 2) * 1.2 + Math.sin(t * 6) * 0.03);
      (cage.material as THREE.LineBasicMaterial).color.copy(hold > 0.9 && release < 0.1 ? p.accent : p.ink);
    },
    dispose: () => kit.dispose(group),
  };
}
