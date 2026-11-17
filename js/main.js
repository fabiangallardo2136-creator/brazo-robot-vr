// Punto de entrada: arma la escena, el brazo, la app y el bucle de cuadros.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BRAZO } from './config-brazo.js';
import { crearEscena } from './escena.js';
import { crearBrazoVisual } from './brazo.js';
import { crearApp } from './app.js';
import { PanelVR, construirPanelPrincipal } from './panel-vr.js';
import { configurarBotonVR, configurarVR } from './vr.js';
import { configurarPunteroEscritorio } from './puntero-escritorio.js';
import { crearUIEscritorio } from './ui-escritorio.js';

const contenedor = document.getElementById('escena');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(contenedor.clientWidth, contenedor.clientHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
contenedor.append(renderer.domElement);

const { escena, camara, objetivoCamara } = crearEscena(BRAZO);

// Brazo sobre la mesa
const brazo = crearBrazoVisual(BRAZO);
brazo.raiz.position.fromArray(BRAZO.ubicacion.posicion);
brazo.raiz.rotation.y = THREE.MathUtils.degToRad(BRAZO.ubicacion.giroY ?? 0);
escena.add(brazo.raiz);

const app = crearApp(BRAZO, brazo);
window.app = app; // útil para depurar desde la consola

// Marcador del objetivo de la cinemática inversa
const marcador = new THREE.Mesh(
  new THREE.SphereGeometry(0.012, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0x3fa9f5, wireframe: true }),
);
marcador.visible = false;
escena.add(marcador);

// Panel flotante (a la izquierda del brazo, girado hacia el usuario)
const panel = new PanelVR();
construirPanelPrincipal(panel, app);
const [bx, by, bz] = BRAZO.ubicacion.posicion;
panel.malla.position.set(bx - 0.62, by + 0.48, bz + 0.12);
panel.malla.rotation.y = 0.55;
escena.add(panel.malla);

// Controles de cámara (escritorio)
camara.lookAt(objetivoCamara);
const orbita = new OrbitControls(camara, renderer.domElement);
orbita.target.copy(objetivoCamara);
orbita.enableDamping = true;
orbita.update();

const puntero = configurarPunteroEscritorio({ renderer, camara, app, panel, brazo, orbita });
const vr = configurarVR({ renderer, escena, app, panel, brazo });
configurarBotonVR(renderer, document.getElementById('boton-vr'), app);

const ui = crearUIEscritorio(document.getElementById('lateral'), app, {
  alMostrarPanel3D: (v) => {
    panel.malla.visible = v || renderer.xr.isPresenting;
  },
});
let panelEnEscritorio = true;
renderer.xr.addEventListener('sessionstart', () => {
  panelEnEscritorio = panel.malla.visible;
  panel.malla.visible = true;
  document.body.classList.add('en-vr');
});
renderer.xr.addEventListener('sessionend', () => {
  panel.malla.visible = panelEnEscritorio;
  document.body.classList.remove('en-vr');
});

app.usarDriver('simulador');
app.seleccionar(0);

// ?programa=ejemplos/recoger-y-dejar.json carga un programa al abrir
// (práctico en el Quest, donde importar archivos es incómodo).
const urlPrograma = new URLSearchParams(location.search).get('programa');
if (urlPrograma) {
  fetch(new URL(urlPrograma, location.href))
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((t) => app.importar(t))
    .catch((e) => app.informar(`No se pudo cargar ${urlPrograma}: ${e.message}`));
}

// Ajuste de tamaño
const redimensionar = () => {
  const w = contenedor.clientWidth;
  const hh = contenedor.clientHeight;
  camara.aspect = w / hh;
  camara.updateProjectionMatrix();
  renderer.setSize(w, hh);
};
addEventListener('resize', redimensionar);
new ResizeObserver(redimensionar).observe(contenedor);

// Bucle principal
const reloj = new THREE.Clock();
const posMundo = new THREE.Vector3();
const posLocal = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(reloj.getDelta(), 0.05);
  const ahora = performance.now();

  const resaltarVR = vr.actualizar();
  app.reproductor.actualizar(dt);
  app.controlador.actualizar(dt);
  brazo.fijarAngulos(app.controlador.actual);
  brazo.resaltarAsa(resaltarVR || puntero.resaltado());

  marcador.visible = !!app.objetivoIK;
  if (app.objetivoIK) marcador.position.copy(app.objetivoIK);

  brazo.efector.getWorldPosition(posMundo);
  posLocal.copy(posMundo);
  brazo.raiz.worldToLocal(posLocal);

  panel.actualizar(ahora);
  ui.actualizar(ahora, posMundo, posLocal);
  if (!renderer.xr.isPresenting) orbita.update();
  renderer.render(escena, camara);
});

console.info('[brazo] App lista. Three.js r' + THREE.REVISION);
