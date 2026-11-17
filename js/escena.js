// Escena: luces, piso, mesa y cámara de escritorio. Liviana para el Quest 2
// (sin sombras dinámicas).
import * as THREE from 'three';

export function crearEscena(config) {
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x1d2127);
  escena.fog = new THREE.Fog(0x1d2127, 6, 14);

  escena.add(new THREE.HemisphereLight(0xdfe8ff, 0x30302a, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(1.5, 3, 2);
  escena.add(sol);

  // Piso con grilla de 1 m y 10 cm
  const piso = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.95 }),
  );
  piso.rotation.x = -Math.PI / 2;
  escena.add(piso);
  const grilla = new THREE.GridHelper(12, 12, 0x4a5260, 0x3a414c);
  grilla.position.y = 0.002;
  escena.add(grilla);

  // Mesa bajo el brazo
  const [bx, by, bz] = config.ubicacion.posicion;
  const mesa = new THREE.Group();
  const matMesa = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 });
  const matPata = new THREE.MeshStandardMaterial({ color: 0x444a52, roughness: 0.6, metalness: 0.4 });
  const tablero = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.6), matMesa);
  tablero.position.set(0, by - 0.015, 0);
  mesa.add(tablero);
  for (const [px, pz] of [[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]]) {
    const pata = new THREE.Mesh(new THREE.BoxGeometry(0.04, by - 0.03, 0.04), matPata);
    pata.position.set(px, (by - 0.03) / 2, pz);
    mesa.add(pata);
  }
  // Cuadrícula de 5 cm sobre la mesa para juzgar distancias
  const grillaMesa = new THREE.GridHelper(0.6, 12, 0xc9a77f, 0xa58660);
  grillaMesa.position.set(0, by + 0.001, 0.0);
  mesa.add(grillaMesa);
  mesa.position.set(bx, 0, bz);
  escena.add(mesa);

  // Un par de cubos sobre la mesa como referencia para programar
  const colores = [0x3fa9f5, 0x6cc070];
  [[-0.2, 0.12], [0.2, 0.12]].forEach(([dx, dz], i) => {
    const cubo = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.04),
      new THREE.MeshStandardMaterial({ color: colores[i], roughness: 0.5 }),
    );
    cubo.position.set(bx + dx, by + 0.02, bz + dz);
    escena.add(cubo);
  });

  const camara = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 50);
  camara.position.set(bx, 1.45, bz + 1.55);

  return { escena, camara, objetivoCamara: new THREE.Vector3(bx, by + 0.3, bz) };
}
