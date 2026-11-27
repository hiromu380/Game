import * as THREE from 'three';

/**
 * 静的に焼き込んだ人物の可動支点を測る。
 * 非インデックス面の重複頂点を一度だけ除き、輪郭の実頂点はすべて残す。
 * 姿勢を変えた際の接地位置は、Box3のprecise測定と同じになる。
 */
export function createBoundsReader(root: THREE.Object3D): (out: THREE.Box3) => void {
  const pieces: { mesh: THREE.Mesh; vertices: THREE.Vector3[] }[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    const seen = new Set<string>();
    const vertices: THREE.Vector3[] = [];
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
      const key = `${vertex.x},${vertex.y},${vertex.z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      vertices.push(vertex);
    }
    pieces.push({ mesh: object, vertices });
  });
  const world = new THREE.Vector3();
  return (out) => {
    root.updateMatrixWorld(true);
    out.makeEmpty();
    for (const { mesh, vertices } of pieces) {
      for (const vertex of vertices) {
        out.expandByPoint(world.copy(vertex).applyMatrix4(mesh.matrixWorld));
      }
    }
  };
}
