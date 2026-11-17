// Mando directo del brazo con los controles del Quest: palancas (análogos) y
// botones A, B, X, Y y el clic de cada palanca. Las asignaciones se cambian
// desde la pestaña "Controles" del panel VR y quedan guardadas.
//
// Hay dos "capas" para las palancas: la normal y la que se usa mientras se
// mantiene apretado el botón asignado a "Capa 2" (por defecto, Y).
import { leerLocal, escribirLocal } from './programa.js';

const CLAVE = 'brazoVR.mandos';

export const OPCIONES_EJE = [
  { id: 'nada', nombre: '—' },
  { id: 'J1', nombre: 'J1 Base' },
  { id: 'J2', nombre: 'J2 Hombro' },
  { id: 'J3', nombre: 'J3 Codo' },
  { id: 'J4', nombre: 'J4 Giro muñeca' },
  { id: 'J5', nombre: 'J5 Flexión muñeca' },
  { id: 'J6', nombre: 'J6 Giro herram.' },
  { id: 'X', nombre: 'Punta X' },
  { id: 'Y', nombre: 'Punta Y (altura)' },
  { id: 'Z', nombre: 'Punta Z' },
  { id: 'pinza', nombre: 'Pinza' },
];

export const OPCIONES_BOTON = [
  { id: 'nada', nombre: '—' },
  { id: 'pinza', nombre: 'Abrir/cerrar pinza' },
  { id: 'grabar', nombre: 'Grabar punto' },
  { id: 'reproducir', nombre: 'Reproducir/detener' },
  { id: 'trayectoria', nombre: 'Grabar trayectoria' },
  { id: 'detener', nombre: 'Detener' },
  { id: 'inicio', nombre: 'Ir a inicio' },
  { id: 'guardar', nombre: 'Guardar programa' },
  { id: 'traerPanel', nombre: 'Traer panel' },
  { id: 'capa', nombre: 'Capa 2 (mantener)' },
];

export const ENTRADAS_EJE = [
  { id: 'izq.x', nombre: 'Palanca izq. ←→' },
  { id: 'izq.y', nombre: 'Palanca izq. ↑↓' },
  { id: 'der.x', nombre: 'Palanca der. ←→' },
  { id: 'der.y', nombre: 'Palanca der. ↑↓' },
];

export const ENTRADAS_BOTON = [
  { id: 'A', nombre: 'Botón A' },
  { id: 'B', nombre: 'Botón B' },
  { id: 'X', nombre: 'Botón X' },
  { id: 'Y', nombre: 'Botón Y' },
  { id: 'izq.clic', nombre: 'Clic palanca izq.' },
  { id: 'der.clic', nombre: 'Clic palanca der.' },
];

export const MAPA_INICIAL = {
  ejes: {
    1: { 'izq.x': 'J1', 'izq.y': 'J2', 'der.x': 'J4', 'der.y': 'J3' },
    2: { 'izq.x': 'J6', 'izq.y': 'J5', 'der.x': 'nada', 'der.y': 'pinza' },
  },
  botones: {
    A: 'pinza', B: 'grabar', X: 'reproducir', Y: 'capa', 'izq.clic': 'traerPanel', 'der.clic': 'detener',
  },
};

const copia = (o) => JSON.parse(JSON.stringify(o));

export function crearMandos(app, { alTraerPanel } = {}) {
  const guardado = leerLocal(CLAVE, null);
  let mapa = copia(MAPA_INICIAL);
  if (guardado?.ejes && guardado?.botones) {
    for (const capa of [1, 2]) Object.assign(mapa.ejes[capa], guardado.ejes[capa] ?? {});
    Object.assign(mapa.botones, guardado.botones);
  }
  const anterior = {}; // estado previo de cada botón, para detectar el flanco
  let capa2 = false;
  let jogando = false;

  function ejecutar(accion) {
    switch (accion) {
      case 'pinza': app.alternarPinza(); break;
      case 'grabar': app.grabarPunto(); break;
      case 'reproducir': app.alternarReproduccion(); break;
      case 'trayectoria': app.alternarTrayectoria(); break;
      case 'detener': app.detenerTodo(); app.informar('Detenido'); break;
      case 'inicio': app.irAInicio(); break;
      case 'guardar': app.guardar(); break;
      case 'traerPanel': alTraerPanel?.(); break;
      default: break;
    }
  }

  function mover(accion, valor, dt) {
    if (accion === 'nada' || Math.abs(valor) < 0.2) return false;
    // Respuesta suave: más fino cerca del centro.
    const v = Math.sign(valor) * ((Math.abs(valor) - 0.2) / 0.8) ** 2;
    const c = app.controlador;
    if (accion.startsWith('J')) {
      const i = Number(accion.slice(1)) - 1;
      app.sumarArticulacion(i, v * c.velocidadDe(i) * dt);
    } else if (accion === 'pinza') {
      app.sumarPinzaMM(v * app.config.herramienta.pinza.velocidad * 1000 * c.velocidad * dt);
    } else {
      const eje = { X: 'x', Y: 'y', Z: 'z' }[accion];
      app.sumarPuntaEje(eje, v * (app.config.velLineal ?? 0.15) * 1000 * c.velocidad * dt);
    }
    return true;
  }

  const api = {
    get mapa() {
      return mapa;
    },
    get capa2() {
      return capa2;
    },
    guardar() {
      escribirLocal(CLAVE, mapa);
      app.avisar('mandos');
    },
    restablecer() {
      mapa = copia(MAPA_INICIAL);
      api.guardar();
      app.informar('Controles por defecto');
    },
    // Avanza a la siguiente opción para una entrada (eje de una capa o botón).
    ciclarEje(capa, entrada) {
      const k = OPCIONES_EJE.findIndex((o) => o.id === mapa.ejes[capa][entrada]);
      mapa.ejes[capa][entrada] = OPCIONES_EJE[(k + 1) % OPCIONES_EJE.length].id;
      api.guardar();
    },
    ciclarBoton(entrada) {
      const k = OPCIONES_BOTON.findIndex((o) => o.id === mapa.botones[entrada]);
      mapa.botones[entrada] = OPCIONES_BOTON[(k + 1) % OPCIONES_BOTON.length].id;
      api.guardar();
    },
    nombreEje: (id) => OPCIONES_EJE.find((o) => o.id === id)?.nombre ?? id,
    nombreBoton: (id) => OPCIONES_BOTON.find((o) => o.id === id)?.nombre ?? id,

    /**
     * Lee los controles y aplica el mapa.
     * @param fuentes  [{ mano: 'left'|'right', gamepad, ocupada }] ocupada = la
     *                 palanca se está usando para otra cosa (mover un objeto)
     */
    actualizar(fuentes, dt) {
      const estado = {};
      const ejes = {};
      for (const f of fuentes) {
        const gp = f.gamepad;
        if (!gp) continue;
        const lado = f.mano === 'left' ? 'izq' : 'der';
        // xr-standard: 3 = clic palanca, 4 = A/X, 5 = B/Y; ejes 2 y 3 = palanca.
        const b = (i) => !!gp.buttons?.[i]?.pressed;
        estado[`${lado}.clic`] = b(3);
        estado[lado === 'der' ? 'A' : 'X'] = b(4);
        estado[lado === 'der' ? 'B' : 'Y'] = b(5);
        if (!f.ocupada) {
          ejes[`${lado}.x`] = gp.axes?.[2] ?? 0;
          ejes[`${lado}.y`] = -(gp.axes?.[3] ?? 0); // hacia adelante = positivo
        }
      }
      capa2 = Object.entries(mapa.botones).some(([e, acc]) => acc === 'capa' && estado[e]);
      for (const [entrada, presionado] of Object.entries(estado)) {
        if (presionado && !anterior[entrada]) {
          const acc = mapa.botones[entrada];
          if (acc && acc !== 'capa') ejecutar(acc);
        }
        anterior[entrada] = presionado;
      }
      const capa = capa2 ? 2 : 1;
      let algo = false;
      for (const [entrada, valor] of Object.entries(ejes)) {
        algo = mover(mapa.ejes[capa][entrada] ?? 'nada', valor, dt) || algo;
      }
      if (algo !== jogando) {
        jogando = algo;
        app.avisar('mando');
      }
    },
  };
  return api;
}
