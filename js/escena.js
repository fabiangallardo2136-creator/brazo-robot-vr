// Escena: luces, piso, mesa, cubos y cámara de escritorio. Liviana para el
// Quest 2 (sin sombras dinámicas). El "entorno" (piso, mesa y cubos) se puede
// ocultar, por ejemplo en modo mixto para ver la sala real.
import * as THREE from 'three';

const COLOR_FONDO = 0x1d2127;

export function crearEscena(config) {
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(COLOR_FONDO);
  escena.fog = new THREE.Fog(COLOR_FONDO, 6, 14);

  escena.add(new THREE.HemisphereLight(0xdfe8ff, 0x30302a, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(1.5, 3, 2);
  escena.add(sol);

  const entorno = new THREE.Group();
  entorno.name = 'entorno';
  escena.add(entorno);

  // Piso con grilla de 1 m
  const piso = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.95 }),
  );
  piso.rotation.x = -Math.PI / 2;
  entorno.add(piso);
  const grilla = new THREE.GridHelper(12, 12, 0x4a5260, 0x3a414c);
  grilla.position.y = 0.002;
  entorno.add(grilla);

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
  grillaMesa.position.set(0, by + 0.001, 0);
  mesa.add(grillaMesa);
  mesa.position.set(bx, 0, bz);
  entorno.add(mesa);

  // Cubos de 4 cm que la pinza puede tomar
  const colores = [0x3fa9f5, 0x6cc070, 0xf2c14e];
  const cubos = [[-0.2, 0.12], [0.2, 0.12], [0.0, 0.2]].map(([dx, dz], i) => {
    const cubo = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.04),
      new THREE.MeshStandardMaterial({ color: colores[i], roughness: 0.5 }),
    );
    cubo.position.set(bx + dx, by + 0.02, bz + dz);
    cubo.name = `cubo${i + 1}`;
    entorno.add(cubo);
    return cubo;
  });

  const camara = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 50);
  camara.position.set(bx, 1.45, bz + 1.55);

  // Modo mixto (passthrough): fondo transparente y sin niebla.
  function modoMixto(activo) {
    escena.background = activo ? null : new THREE.Color(COLOR_FONDO);
    escena.fog = activo ? null : new THREE.Fog(COLOR_FONDO, 6, 14);
  }

  return {
    escena,
    camara,
    entorno,
    cubos,
    mesa: {
      get visible() { return entorno.visible; },
      centro: new THREE.Vector3(bx, by, bz),
      ancho: 1.0,
      fondo: 0.6,
      altura: by,
    },
    modoMixto,
    objetivoCamara: new THREE.Vector3(bx, by + 0.3, bz),
  };
}
