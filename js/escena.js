// Escena: luces, cielo, piso, mesa y cámara de escritorio. Liviana para el
// Quest 2 (sin sombras dinámicas).
//
// Fondo virtual o sala real: en una sesión de realidad mixta el navegador
// muestra la sala real en todo pixel que no tenga geometría (Three.js deja
// transparente el fondo aunque tenga color). Por eso el fondo virtual es una
// esfera opaca ("cielo") que tapa la sala; al ocultarla se ve la sala real.
// El piso y la mesa se muestran u ocultan por separado.
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

  // Cielo opaco (fondo virtual)
  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(25, 32, 16),
    new THREE.MeshBasicMaterial({ color: COLOR_FONDO, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  cielo.renderOrder = -1;
  cielo.name = 'cielo';
  entorno.add(cielo);

  // Piso con grilla de 1 m
  const piso = new THREE.Group();
  piso.name = 'piso';
  const suelo = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.95 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  piso.add(suelo);
  const grilla = new THREE.GridHelper(12, 12, 0x4a5260, 0x3a414c);
  grilla.position.y = 0.002;
  piso.add(grilla);
  entorno.add(piso);

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

  const camara = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 50);
  camara.position.set(bx, 1.45, bz + 1.55);

  // Sala real (passthrough): sin cielo, sin fondo y sin niebla.
  function modoMixto(activo) {
    cielo.visible = !activo;
    escena.background = activo ? null : new THREE.Color(COLOR_FONDO);
    escena.fog = activo ? null : new THREE.Fog(COLOR_FONDO, 6, 14);
  }

  return {
    escena,
    camara,
    entorno,
    cielo,
    piso,
    mesaGrupo: mesa,
    mesa: {
      get visible() { return mesa.visible; },
      centro: new THREE.Vector3(bx, by, bz),
      ancho: 1.0,
      fondo: 0.6,
      altura: by,
    },
    modoMixto,
    objetivoCamara: new THREE.Vector3(bx, by + 0.3, bz),
  };
}
