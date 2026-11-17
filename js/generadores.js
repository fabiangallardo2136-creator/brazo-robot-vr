// Rutinas generadas: programas de movimiento armados con fórmulas, para
// probar el brazo y como punto de partida para editarlos.
//
// Las que usan la herramienta vertical (batir) suponen un brazo como el de
// config-brazo.js (J2, J3 y J5 en ejes paralelos). Si cambias la forma del
// brazo, revisa los centros y radios de abajo.
import * as THREE from 'three';

const INICIO = (app) => app.config.articulaciones.map((a) => a.inicial ?? 0);
const redondear = (a) => a.map((v) => Math.round(v * 10) / 10);
const punto = (angulos, extra = {}) => ({ angulos: redondear(angulos), pinza: 50, tipo: 'articular', velocidad: 100, pausa: 0, ...extra });

export const RUTINAS = {
  saludar: {
    nombre: 'Saludar',
    descripcion: 'Levanta el brazo y mueve la muñeca de lado a lado, 4 veces.',
    crear(app) {
      const arriba = [0, -5, 40, 90, 0, 0];
      const pts = [punto(INICIO(app)), punto(arriba, { velocidad: 80 })];
      for (let k = 0; k < 4; k++) {
        pts.push(punto([0, -5, 40, 90, 35, 0], { tiempo: 0.35 }));
        pts.push(punto([0, -5, 40, 90, -35, 0], { tiempo: 0.35 }));
      }
      pts.push(punto(arriba, { tiempo: 0.25, pausa: 0.3 }));
      pts.push(punto(INICIO(app), { velocidad: 80 }));
      return { puntos: pts, errorMax: 0 };
    },
  },

  batir: {
    nombre: 'Batir crema',
    descripcion: 'Baja la herramienta vertical y da 4 vueltas de 3,5 cm de radio, como batiendo en un bol.',
    crear(app) {
      const cin = app.cinematica;
      const centro = new THREE.Vector3(0.1, 0.03, 0.25); // punta a 3 cm sobre la mesa, lejos de los cubos
      const radio = 0.035;
      const vueltas = 4;
      const porVuelta = 16;
      let errorMax = 0;
      let semilla = INICIO(app);
      const vertical = (p) => {
        const r = cin.vertical(semilla, p);
        errorMax = Math.max(errorMax, r.error);
        semilla = r.angulos;
        return r.angulos;
      };
      const pts = [punto(INICIO(app))];
      const sobre = centro.clone().add(new THREE.Vector3(radio, 0.1, 0));
      pts.push(punto(vertical(sobre)));
      pts.push(punto(vertical(centro.clone().add(new THREE.Vector3(radio, 0, 0))), { tipo: 'lineal', velocidad: 40 }));
      for (let k = 1; k <= vueltas * porVuelta; k++) {
        const a = (k / porVuelta) * Math.PI * 2;
        const p = centro.clone().add(new THREE.Vector3(Math.cos(a) * radio, 0, Math.sin(a) * radio));
        pts.push(punto(vertical(p), { tiempo: 0.07 }));
      }
      pts.push(punto(vertical(sobre), { tipo: 'lineal', velocidad: 50 }));
      pts.push(punto(INICIO(app), { pausa: 0.5 }));
      return { puntos: pts, errorMax };
    },
  },

  circulo: {
    nombre: 'Dibujar círculo',
    descripcion: 'La punta dibuja un círculo vertical de 14 cm frente al brazo.',
    crear(app) {
      const cin = app.cinematica;
      const centro = new THREE.Vector3(0, 0.22, 0.22);
      const radio = 0.07;
      const n = 32;
      let errorMax = 0;
      let semilla = INICIO(app);
      const ir = (p) => {
        semilla = cin.ik(semilla, p, { iteraciones: 40 });
        errorMax = Math.max(errorMax, cin.fk(semilla).distanceTo(p));
        return semilla;
      };
      const pts = [punto(INICIO(app))];
      pts.push(punto(ir(centro.clone().add(new THREE.Vector3(radio, 0, 0)))));
      for (let k = 1; k <= n; k++) {
        const a = (k / n) * Math.PI * 2;
        pts.push(punto(ir(centro.clone().add(new THREE.Vector3(Math.cos(a) * radio, Math.sin(a) * radio, 0))), { tiempo: 0.12 }));
      }
      pts.push(punto(INICIO(app), { pausa: 0.5 }));
      return { puntos: pts, errorMax };
    },
  },
};

// Crea la rutina y la deja como programa actual.
export function generarRutina(app, id) {
  const r = RUTINAS[id];
  if (!r) return;
  const { puntos, errorMax } = r.crear(app);
  app.reemplazarPrograma({ nombre: `${r.nombre} (generado)`, puntos });
  const aviso = errorMax > 0.005 ? ` · ojo: error de hasta ${(errorMax * 1000).toFixed(0)} mm` : '';
  app.informar(`Rutina "${r.nombre}" creada: ${puntos.length} puntos${aviso}. Pulsa Reproducir.`);
}
