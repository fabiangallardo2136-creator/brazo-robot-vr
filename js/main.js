// Punto de entrada: arma la escena, el brazo, la app y el bucle de cuadros.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BRAZO } from './config-brazo.js';
import { crearEscena } from './escena.js';
import { crearBrazoVisual } from './brazo.js';
import { crearApp } from './app.js';
import { PanelVR, construirPanelPrincipal } from './panel-vr.js';
import { configurarBotonesXR, configurarVR } from './vr.js';
import { configurarPunteroEscritorio } from './puntero-escritorio.js';
import { crearUIEscritorio } from './ui-escritorio.js';
import { crearCamaras } from './camaras.js';
import { agregarFuentes } from './fuentes.js';
import { crearManipulacion } from './objetos.js';
import { crearDisposicion } from './disposicion.js';

const contenedor = document.getElementById('escena');
// alpha: true para que el modo mixto (passthrough) deje ver la sala real.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(contenedor.clientWidth, contenedor.clientHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
contenedor.append(renderer.domElement);

const { escena, camara, objetivoCamara, entorno, cubos, mesa, modoMixto } = crearEscena(BRAZO);

// Brazo sobre la mesa
const brazo = crearBrazoVisual(BRAZO);
brazo.raiz.position.fromArray(BRAZO.ubicacion.posicion);
brazo.raiz.rotation.y = THREE.MathUtils.degToRad(BRAZO.ubicacion.giroY ?? 0);
escena.add(brazo.raiz);

const app = crearApp(BRAZO, brazo);
window.app = app; // útil para depurar desde la consola

// Cámaras (pinza y ambiente) y sus pantallas
const camaras = crearCamaras({ renderer, escena, brazo, config: BRAZO });
agregarFuentes(app, camaras);

// Cubos que la pinza puede tomar
const manipulacion = crearManipulacion({ contenedor: entorno, brazo, cubos, mesa });
app.reiniciarCubos = () => {
  manipulacion.reiniciar();
  app.informar('Cubos de vuelta en la mesa');
};
app.entornoVisible = () => entorno.visible;
app.alternarEntorno = () => {
  entorno.visible = !entorno.visible;
  app.avisar('entorno');
};

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
panel.malla.position.set(bx - 0.62, by + 0.5, bz + 0.12);
panel.malla.rotation.y = 0.55;
escena.add(panel.malla);

// Objetos que se pueden mover en VR con el grip, y su posición guardada
const disposicion = crearDisposicion();
disposicion.registrar('panel', panel.malla, panel.malla);
camaras.pantallas.forEach((p, i) => disposicion.registrar(`pantalla${i}`, p.grupo, p.grupo));
disposicion.registrar('brazo', brazo.raiz, brazo.zonaBase, { soloGiroY: true });
disposicion.cargar();
app.restablecerPosiciones = () => {
  disposicion.restablecer();
  app.informar('Panel, pantallas y brazo en su lugar original');
};

// Controles de cámara (escritorio)
camara.lookAt(objetivoCamara);
const orbita = new OrbitControls(camara, renderer.domElement);
orbita.target.copy(objetivoCamara);
orbita.enableDamping = true;
orbita.update();
window.depurar = { renderer, escena, camara, orbita, disposicion, manipulacion }; // para la consola

const puntero = configurarPunteroEscritorio({ renderer, camara, app, panel, brazo, orbita });
const vr = configurarVR({ renderer, escena, app, panel, brazo, disposicion });

const ui = crearUIEscritorio(document.getElementById('lateral'), app, {
  alMostrarPanel3D: (v) => {
    panel.malla.visible = v || renderer.xr.isPresenting;
  },
});

// Entrar y salir de VR / modo mixto
let panelEnEscritorio = true;
let entornoAntes = true;
configurarBotonesXR(renderer, {
  botonVR: document.getElementById('boton-vr'),
  botonAR: document.getElementById('boton-ar'),
}, app, (modo) => {
  if (modo) {
    panelEnEscritorio = panel.malla.visible;
    panel.malla.visible = true;
    document.body.classList.add('en-vr');
    if (modo === 'mixto') {
      // Se ve la sala real; la mesa virtual empieza oculta (se activa en el panel).
      entornoAntes = entorno.visible;
      entorno.visible = false;
      modoMixto(true);
      renderer.setClearColor(0x000000, 0);
    }
    app.modoXR = modo;
  } else {
    panel.malla.visible = panelEnEscritorio;
    document.body.classList.remove('en-vr');
    if (app.modoXR === 'mixto') {
      entorno.visible = entornoAntes;
      modoMixto(false);
    }
    app.modoXR = null;
  }
  app.avisar('entorno');
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

  const resaltarVR = vr.actualizar(dt);
  app.reproductor.actualizar(dt);
  app.controlador.actualizar(dt);
  brazo.fijarAngulos(app.controlador.actual);
  manipulacion.actualizar(dt, app.controlador.pinzaActual);
  brazo.fijarPinza(manipulacion.aperturaVisible(app.controlador.pinzaActual));
  brazo.resaltarAsa(resaltarVR || puntero.resaltado());

  marcador.visible = !!app.objetivoIK;
  if (app.objetivoIK) marcador.position.copy(app.objetivoIK);

  brazo.efector.getWorldPosition(posMundo);
  posLocal.copy(posMundo);
  brazo.raiz.worldToLocal(posLocal);

  camaras.actualizar();
  panel.actualizar(ahora);
  ui.actualizar(ahora, posMundo, posLocal);
  if (!renderer.xr.isPresenting) orbita.update();
  renderer.render(escena, camara);
});

console.info('[brazo] App lista. Three.js r' + THREE.REVISION);
