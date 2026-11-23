import * as THREE from "three";
import { circle, clamp01, polyline, ramp, type Kit, type SceneModel } from "../kit";

/**
 * Processes: a tree of who started what. A shell starts an editor, the editor starts node, node runs npm, npm runs a
 * postinstall script, and the script opens a connection to a host never seen before. The tree grows branch by branch;
 * the last child is flagged with the reticle, and its outbound line is cut and held. `progress` (0..1) is scroll.
 */
const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };

interface Node { id: string; parent: string | null; pos: THREE.Vector3; size: number; shade: number; blue?: boolean }

export function tree(kit: Kit): SceneModel & { setProgress: (p: number) => void } {
  const { p } = kit;
  const group = new THREE.Group();
  const nodes: Node[] = [
    { id: "shell", parent: null, pos: new THREE.Vector3(0, 1.15, 0), size: 0.26, shade: 0.55 },
    { id: "editor", parent: "shell", pos: new THREE.Vector3(-0.85, 0.45, 0.2), size: 0.2, shade: 0.2 },
    { id: "agent", parent: "shell", pos: new THREE.Vector3(0.8, 0.45, -0.15), size: 0.2, shade: 0.2, blue: true },
    { id: "lsp", parent: "editor", pos: new THREE.Vector3(-1.3, -0.25, 0.35), size: 0.14, shade: 0.1 },
    { id: "node", parent: "editor", pos: new THREE.Vector3(-0.45, -0.25, 0.1), size: 0.16, shade: 0.3 },
    { id: "git", parent: "agent", pos: new THREE.Vector3(0.45, -0.25, -0.3), size: 0.14, shade: 0.1 },
    { id: "npm", parent: "agent", pos: new THREE.Vector3(1.2, -0.25, 0.05), size: 0.16, shade: 0.3 },
    { id: "postinstall", parent: "npm", pos: new THREE.Vector3(1.05, -0.95, 0.25), size: 0.15, shade: 0.75 },
    { id: "test", parent: "node", pos: new THREE.Vector3(-0.55, -0.95, 0.0), size: 0.12, shade: 0.15 },
  ];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const order = nodes.map((n) => n.id);

  const meshes = new Map<string, THREE.Group>();
  for (const n of nodes) {
    const geo = n.id === "postinstall" ? new THREE.OctahedronGeometry(n.size, 0) : new THREE.BoxGeometry(n.size, n.size, n.size);
    const g = kit.solid(geo, n.blue ? kit.blue(0.1) : kit.tone(n.shade), { hull: 0.008 });
    at(g, n.pos.x, n.pos.y, n.pos.z);
    g.scale.setScalar(0.001);
    meshes.set(n.id, g);
    group.add(g);
  }
  // edges: drawn from parent to child, grown by scaling a unit line
  const edges = nodes.filter((n) => n.parent).map((n) => {
    const a = byId.get(n.parent!)!.pos, b = n.pos;
    const line = polyline([a.clone(), a.clone()], kit.line(p.ink, 0.55));
    group.add(line);
    return { n, a, b, line };
  });
  // the outbound connection the script tries to open, and the gate that holds it
  const out = new THREE.Vector3(2.2, -1.45, 0.9);
  const outLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([byId.get("postinstall")!.pos, out]),
    new THREE.LineDashedMaterial({ color: p.accent, dashSize: 0.08, gapSize: 0.06, transparent: true }));
  outLine.computeLineDistances();
  group.add(outLine);
  const host = at(kit.solid(new THREE.SphereGeometry(0.1, 16, 12), kit.tone(0.9), { edges: false, hull: 0.008 }), out.x, out.y, out.z);
  group.add(host);
  const gate = new THREE.Group();
  gate.add(circle(0.2, kit.line(p.accent), 48));
  gate.add(polyline([new THREE.Vector3(-0.14, -0.14, 0), new THREE.Vector3(0.14, 0.14, 0)], kit.line(p.accent)));
  const gatePos = byId.get("postinstall")!.pos.clone().lerp(out, 0.5);
  gate.position.copy(gatePos);
  group.add(gate);

  const reticle = new THREE.Group();
  reticle.add(circle(0.26, kit.line(p.accent), 48));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    reticle.add(polyline([new THREE.Vector3(Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0), new THREE.Vector3(Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0)], kit.line(p.accent)));
  }
  group.add(reticle);
  // a floor of the timeline, for depth
  const floor = new THREE.GridHelper(5, 20, p.muted, p.muted);
  (floor.material as THREE.Material).transparent = true;
  (floor.material as THREE.Material).opacity = 0.18;
  floor.position.y = -1.6;
  group.add(floor);

  let progress = 0;
  const tmp = new THREE.Vector3();
  return {
    group, tilt: [0.22, -0.35],
    setProgress: (v) => { progress = clamp01(v); },
    update(t, _dt, ptr) {
      // nodes appear in order over the first 60% of the section
      order.forEach((id, i) => {
        const k = ramp(progress, 0.05 + i * 0.055, 0.12 + i * 0.055);
        const m = meshes.get(id)!;
        m.scale.setScalar(Math.max(0.001, k));
        m.rotation.y = t * 0.4 + i;
        m.position.y = byId.get(id)!.pos.y + Math.sin(t * 1.1 + i) * 0.025;
      });
      edges.forEach(({ n, a, b, line }) => {
        const i = order.indexOf(n.id);
        const k = ramp(progress, 0.03 + i * 0.055, 0.12 + i * 0.055);
        tmp.lerpVectors(a, b, k);
        const pos = line.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(1, tmp.x, tmp.y, tmp.z);
        pos.needsUpdate = true;
      });
      const reach = ramp(progress, 0.58, 0.7), flag = ramp(progress, 0.68, 0.76), hold = ramp(progress, 0.78, 0.9);
      const pi = byId.get("postinstall")!.pos;
      tmp.lerpVectors(pi, out, reach);
      const og = outLine.geometry.attributes.position as THREE.BufferAttribute;
      og.setXYZ(1, tmp.x, tmp.y, tmp.z);
      og.needsUpdate = true;
      outLine.computeLineDistances();
      (outLine.material as THREE.LineDashedMaterial).opacity = 1 - hold * 0.7;
      host.scale.setScalar(Math.max(0.001, reach));
      reticle.visible = flag > 0.01;
      reticle.position.copy(pi);
      reticle.quaternion.copy(group.quaternion).invert();
      reticle.scale.setScalar(1 + (1 - flag) * 1.4 + Math.sin(t * 6) * 0.03);
      gate.visible = hold > 0.01;
      gate.scale.setScalar(Math.max(0.001, hold));
      gate.quaternion.copy(group.quaternion).invert();
      group.rotation.y = -0.35 + ptr.x * 0.2 + Math.sin(t * 0.15) * 0.08;
    },
    dispose: () => kit.dispose(group),
  };
}
