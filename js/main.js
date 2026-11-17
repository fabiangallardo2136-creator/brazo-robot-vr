// Punto de entrada: arma la escena, el brazo, la app y el bucle de cuadros.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BRAZO } from './config-brazo.js';
import { crearEscena } from './escena.js';
import { crearBrazoVisual } from './brazo.js';
import { crearApp } from './app.js';
import { PanelVR } from './panel-vr.js';
import { construirPanelPrincipal, construirPanelMuneca } from './paneles.js';
import { configurarBotonXR, configurarVR } from './vr.js';
import { configurarPunteroEscritorio } from './puntero-escritorio.js';
import { crearUIEscritorio } from './ui-escritorio.js';
import { crearCamaras } from './camaras.js';
import { agregarFuentes } from './fuentes.js';
import { crearObjetos } from './objetos.js';
import { crearDisposicion } from './disposicion.js';
import { crearMandos } from './mandos.js';

const contenedor = document.getElementById('escena');
// alpha: true para que el fondo "sala real" (passthrough) deje ver el taller.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(contenedor.clientWidth, contenedor.clientHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
contenedor.append(renderer.domElement);

const { escena, camara, objetivoCamara, entorno, mesa, modoMixto } = crearEscena(BRAZO);

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

// Objetos para manipular (empieza con 3 cubos en la mesa)
const objetos = crearObjetos({ escena, brazo, mesa });
objetos.reiniciar();
app.objetos = objetos;
app.reiniciarCubos = () => {
  objetos.reiniciar();
  app.informar('Mesa reiniciada con 3 cubos');
};
app.entornoVisible = () => entorno.visible;
app.alternarEntorno = () => {
  entorno.visible = !entorno.visible;
  app.avisar('entorno');
};

// Fondo: virtual o sala real (solo dentro de una sesión AR del visor).
let fondoReal = false;
app.fondoReal = () => (app.modoXR === 'mixto' ? fondoReal : app.modoXR === 'vr' ? undefined : false);
app.alternarFondo = () => {
  if (app.modoXR !== 'mixto') {
    app.informar(app.modoXR === 'vr'
      ? 'Este visor no permite ver la sala real desde el navegador'
      : 'El fondo de sala real se activa dentro del visor');
    return;
  }
  fondoReal = !fondoReal;
  modoMixto(fondoReal);
  entorno.visible = !fondoReal;
  app.avisar('entorno');
  app.informar(fondoReal ? 'Fondo: tu sala real' : 'Fondo: virtual');
};

// Marcador del objetivo de la cinemática inversa
const marcador = new THREE.Mesh(
  new THREE.SphereGeometry(0.012, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0x3fa9f5, wireframe: true }),
);
marcador.visible = false;
escena.add(marcador);

// Mando directo con palancas y botones (se configura en la pestaña Controles)
const mandos = crearMandos(app, { alTraerPanel: () => app.traerPanel() });
app.mandos = mandos;

// Panel principal (a la izquierda del brazo, girado hacia el usuario)
const panel = new PanelVR({ ancho: 1024, alto: 990, anchoMetros: 0.62 });
construirPanelPrincipal(panel, app);
const [bx, by, bz] = BRAZO.ubicacion.posicion;
panel.malla.position.set(bx - 0.62, by + 0.5, bz + 0.12);
panel.malla.rotation.y = 0.55;
escena.add(panel.malla);

// Panel rápido de muñeca (se pega al control izquierdo al conectarse)
const panelMuneca = new PanelVR({ ancho: 512, alto: 300, anchoMetros: 0.17 });
construirPanelMuneca(panelMuneca, app);
panelMuneca.malla.position.set(0, 0.06, 0.05);
panelMuneca.malla.rotation.x = -Math.PI / 3;
app.panelMunecaVisible = () => panelMuneca.malla.visible;
app.alternarPanelMuneca = () => {
  panelMuneca.malla.visible = !panelMuneca.malla.visible;
};

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

// Trae el panel principal frente a la cabeza.
const pCabeza = new THREE.Vector3();
const dCabeza = new THREE.Vector3();
app.traerPanel = () => {
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camara;
  cam.getWorldPosition(pCabeza);
  cam.getWorldDirection(dCabeza);
  dCabeza.y = 0;
  if (dCabeza.lengthSq() < 1e-6) dCabeza.set(0, 0, -1);
  dCabeza.normalize();
  panel.malla.position.copy(pCabeza).addScaledVector(dCabeza, 0.6);
  panel.malla.position.y = pCabeza.y - 0.15;
  panel.malla.rotation.set(0, Math.atan2(-dCabeza.x, -dCabeza.z), 0);
  panel.malla.visible = true;
  disposicion.guardar();
  app.informar('Panel frente a ti');
};

// Controles de cámara (escritorio)
camara.lookAt(objetivoCamara);
const orbita = new OrbitControls(camara, renderer.domElement);
orbita.target.copy(objetivoCamara);
orbita.enableDamping = true;
orbita.update();
window.depurar = { renderer, escena, camara, orbita, disposicion, objetos, mandos, panel, panelMuneca }; // para la consola

const puntero = configurarPunteroEscritorio({ renderer, camara, app, panel, brazo, orbita });
const vr = configurarVR({
  renderer, escena, app, paneles: [panel, panelMuneca], brazo, disposicion, objetos, mandos, panelMuneca,
});

const ui = crearUIEscritorio(document.getElementById('lateral'), app, {
  alMostrarPanel3D: (v) => {
    panel.malla.visible = v || renderer.xr.isPresenting;
  },
});

// Entrar y salir del visor
let panelEnEscritorio = true;
configurarBotonXR(renderer, document.getElementById('boton-vr'), app, (modo) => {
  if (modo) {
    panelEnEscritorio = panel.malla.visible;
    panel.malla.visible = true;
    document.body.classList.add('en-vr');
    // En sesión AR se empieza con fondo virtual (se ve igual que VR) y el
    // panel permite pasar a la sala real.
    renderer.setClearColor(0x000000, 0);
    fondoReal = false;
    modoMixto(false);
    app.modoXR = modo;
    app.informar(modo === 'mixto'
      ? 'Escena → "Fondo" para ver tu sala real'
      : 'Este visor no permite ver la sala real desde el navegador');
  } else {
    panel.malla.visible = panelEnEscritorio;
    document.body.classList.remove('en-vr');
    if (fondoReal) {
      fondoReal = false;
      modoMixto(false);
      entorno.visible = true;
    }
    app.modoXR = null;
  }
  app.avisar('entorno');
});

app.usarDriver('simulador');
app.seleccionar(0);

// ?programa=ejemplos/recoger-y-dejar.json carga un programa al abrir
const urlPrograma = new URLSearchParams(location.search).get('programa');
if (urlPrograma) app.cargarDesdeURL(urlPrograma);

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
  app.actualizarGrabacion(dt);
  brazo.fijarAngulos(app.controlador.actual);
  objetos.actualizar(dt, app.controlador.pinzaActual);
  brazo.fijarPinza(objetos.aperturaVisible(app.controlador.pinzaActual));
  brazo.resaltarAsa(resaltarVR || puntero.resaltado());

  marcador.visible = !!app.objetivoIK;
  if (app.objetivoIK) marcador.position.copy(app.objetivoIK);

  brazo.efector.getWorldPosition(posMundo);
  posLocal.copy(posMundo);
  brazo.raiz.worldToLocal(posLocal);

  camaras.actualizar();
  panel.actualizar(ahora);
  if (renderer.xr.isPresenting) panelMuneca.actualizar(ahora);
  ui.actualizar(ahora, posMundo, posLocal);
  if (!renderer.xr.isPresenting) orbita.update();
  renderer.render(escena, camara);
});

console.info('[brazo] App lista. Three.js r' + THREE.REVISION);
