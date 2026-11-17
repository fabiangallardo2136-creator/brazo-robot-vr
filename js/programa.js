// Programas: lista de puntos (poses) que se reproducen en orden.
//
// Formato JSON de un programa (el mismo para localStorage y para exportar):
// {
//   "formato": "brazo-robot-vr/programa", "version": 2,
//   "nombre": "Pick and place",
//   "brazo": "Brazo 6 GDL de escritorio (genérico)",
//   "articulaciones": ["J1", "J2", "J3", "J4", "J5", "J6"],
//   "puntos": [
//     { "angulos": [0, 15, 75, 0, 70, 0], "pinza": 40, "tipo": "articular",
//       "velocidad": 100, "pausa": 0.5 }
//   ]
// }
// pinza: apertura en milímetros al llegar al punto.
// tipo: "articular" (cada articulación va directo a su ángulo; la punta hace
//       una curva) o "lineal" (la punta va en línea recta).
// velocidad: % de la velocidad máxima para llegar a ese punto.
// pausa: segundos de espera al llegar.
// tiempo (opcional): segundos exactos para llegar desde el punto anterior.
//       Lo usan las trayectorias grabadas en continuo; el tramo se recorre a
//       velocidad constante para que el movimiento salga fluido.
// Los programas de la versión 1 (sin pinza ni tipo) se siguen pudiendo abrir.

import * as THREE from 'three';

export const FORMATO = 'brazo-robot-vr/programa';
export const TIPOS = { articular: 'Articular', lineal: 'Lineal' };
const CLAVE_PROGRAMAS = 'brazoVR.programas';
const CLAVE_ACTUAL = 'brazoVR.programaActual';

const limitarNum = (v, min, max, def) => {
  const n = Number(v);
  return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function nuevoPrograma(nombre, config) {
  return {
    formato: FORMATO, version: 2, nombre,
    brazo: config.nombre,
    articulaciones: config.articulaciones.map((a) => a.id),
    puntos: [],
  };
}

export function nuevoPunto(angulos, aperturaM, tipo = 'articular', tiempo) {
  const p = {
    angulos: angulos.map((v) => Math.round(v * 10) / 10),
    pinza: Math.round(aperturaM * 10000) / 10,
    tipo,
    velocidad: 100,
    pausa: 0,
  };
  if (tiempo !== undefined) p.tiempo = Math.round(tiempo * 1000) / 1000;
  return p;
}

// Valida y limpia un programa leído de un archivo o de localStorage.
export function normalizarPrograma(datos, config) {
  if (!datos || typeof datos !== 'object' || !Array.isArray(datos.puntos)) {
    throw new Error('El archivo no parece un programa: falta la lista "puntos".');
  }
  const art = config.articulaciones;
  const pz = config.herramienta.pinza;
  const puntos = datos.puntos.map((p, i) => {
    const ang = Array.isArray(p) ? p : p?.angulos;
    if (!Array.isArray(ang) || ang.length !== art.length || ang.some((v) => !Number.isFinite(Number(v)))) {
      throw new Error(`El punto ${i + 1} no tiene ${art.length} ángulos numéricos.`);
    }
    const punto = {
      angulos: ang.map((v, j) => limitarNum(v, art[j].min, art[j].max, 0)),
      pinza: limitarNum(p?.pinza, pz.aperturaMin * 1000, pz.aperturaMax * 1000, pz.inicial * 1000),
      tipo: p?.tipo === 'lineal' ? 'lineal' : 'articular',
      velocidad: limitarNum(p?.velocidad, 5, 100, 100),
      pausa: limitarNum(p?.pausa, 0, 60, 0),
    };
    const t = limitarNum(p?.tiempo, 0.02, 60, undefined);
    if (t !== undefined) punto.tiempo = t;
    return punto;
  });
  const prog = nuevoPrograma(String(datos.nombre || 'Programa importado').slice(0, 60), config);
  prog.puntos = puntos;
  return prog;
}

// ---------------------------------------------------------------------------
// Almacenamiento en el navegador (localStorage). Cada navegador (escritorio,
// Quest) tiene el suyo: para pasar programas entre equipos, exportar/importar.
// ---------------------------------------------------------------------------
export function leerLocal(clave, def) {
  try {
    const t = localStorage.getItem(clave);
    return t ? JSON.parse(t) : def;
  } catch {
    return def;
  }
}

export function escribirLocal(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export const almacen = {
  listar() {
    return Object.keys(leerLocal(CLAVE_PROGRAMAS, {})).sort((a, b) => a.localeCompare(b, 'es'));
  },
  guardar(programa) {
    const todos = leerLocal(CLAVE_PROGRAMAS, {});
    todos[programa.nombre] = programa;
    return escribirLocal(CLAVE_PROGRAMAS, todos);
  },
  cargar(nombre, config) {
    const p = leerLocal(CLAVE_PROGRAMAS, {})[nombre];
    return p ? normalizarPrograma(p, config) : null;
  },
  borrar(nombre) {
    const todos = leerLocal(CLAVE_PROGRAMAS, {});
    delete todos[nombre];
    return escribirLocal(CLAVE_PROGRAMAS, todos);
  },
  guardarActual(programa) {
    return escribirLocal(CLAVE_ACTUAL, programa);
  },
  cargarActual(config) {
    try {
      const p = leerLocal(CLAVE_ACTUAL, null);
      return p ? normalizarPrograma(p, config) : null;
    } catch {
      return null;
    }
  },
};

export function exportarJSON(programa) {
  const texto = JSON.stringify(programa, null, 2);
  const blob = new Blob([texto], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${programa.nombre.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '_') || 'programa'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Reproductor. Para cada punto:
//   1. "moviendo": lleva el brazo al punto. En modo articular interpola los
//      ángulos; en modo lineal interpola la posición de la punta en línea
//      recta y resuelve la cinemática inversa en cada cuadro. La curva es
//      suave (pico de 1,5 veces la velocidad media, por eso el factor 1,5).
//   2. "pinza": ajusta la apertura de la pinza y espera a que llegue.
//   3. "esperando": la pausa del punto.
// ---------------------------------------------------------------------------
export class Reproductor {
  /**
   * @param controlador Controlador
   * @param config configuración del brazo
   * @param cinematica { fk(angulos) → Vector3 local, ik(semilla, Vector3 local) → angulos }
   */
  constructor(controlador, config, cinematica) {
    this.c = controlador;
    this.config = config;
    this.cin = cinematica;
    this.activo = false;
    this.indice = -1;
    this.fase = 'detenido'; // 'moviendo' | 'pinza' | 'esperando' | 'detenido'
    this.alCambiar = null;
    this._p = new THREE.Vector3();
  }

  iniciar(programa, { bucle = false, desde = 0 } = {}) {
    if (!programa.puntos.length) return false;
    this.programa = programa;
    this.bucle = bucle;
    this.activo = true;
    this._tramo(Math.min(desde, programa.puntos.length - 1));
    return true;
  }

  detener() {
    if (!this.activo) return;
    this.activo = false;
    this.fase = 'detenido';
    this.indice = -1;
    this.c.congelar();
    this.alCambiar?.();
  }

  _tramo(i) {
    const p = this.programa.puntos[i];
    this.indice = i;
    this.tipo = p.tipo === 'lineal' ? 'lineal' : 'articular';
    this.desde = this.c.actual.slice();
    this.hacia = p.angulos.map((v, j) => this.c.limitar(this.c.art[j], v));
    const fraccion = (p.velocidad ?? 100) / 100;
    let dur = 0;
    this.hacia.forEach((v, j) => {
      dur = Math.max(dur, Math.abs(v - this.desde[j]) / (this.c.velocidadDe(j) * fraccion));
    });
    if (this.tipo === 'lineal') {
      this.p0 = this.cin.fk(this.desde).clone();
      this.p1 = this.cin.fk(this.hacia).clone();
      const velLin = (this.config.velLineal ?? 0.15) * this.c.velocidad * fraccion;
      dur = Math.max(dur, this.p0.distanceTo(this.p1) / velLin);
    }
    if (p.tiempo) {
      // Trayectoria grabada: tiempo fijo y velocidad constante (sin pasar los límites).
      this.constante = true;
      this.duracion = Math.max(p.tiempo / fraccion, dur);
      if (p.pinza !== undefined) this.c.fijarPinza(p.pinza / 1000);
    } else {
      this.constante = false;
      this.duracion = Math.max(0.05, dur * 1.5);
    }
    this.t = 0;
    this.fase = 'moviendo';
    this.alCambiar?.();
  }

  actualizar(dt) {
    if (!this.activo) return;
    if (this.fase === 'moviendo') {
      this.t += dt;
      const s = Math.min(1, this.t / this.duracion);
      const e = this.constante ? s : s * s * (3 - 2 * s);
      const semilla = this.desde.map((v, j) => v + (this.hacia[j] - v) * e);
      if (this.tipo === 'lineal' && s < 1) {
        this._p.lerpVectors(this.p0, this.p1, e);
        this.c.fijarObjetivos(this.cin.ik(semilla, this._p));
      } else {
        this.c.fijarObjetivos(semilla);
      }
      if (s >= 1 && this.c.llego(this.hacia, this.constante ? 2 : 0.3)) {
        const pz = this.programa.puntos[this.indice].pinza;
        if (pz !== undefined) this.c.fijarPinza(pz / 1000);
        this.fase = 'pinza';
        this.alCambiar?.();
      }
    } else if (this.fase === 'pinza') {
      if (this.constante || this.c.pinzaLlego()) {
        this.fase = 'esperando';
        this.espera = this.programa.puntos[this.indice].pausa ?? 0;
        this.alCambiar?.();
      }
    } else if (this.fase === 'esperando') {
      this.espera -= dt;
      if (this.espera <= 0) {
        const sig = this.indice + 1;
        if (sig < this.programa.puntos.length) this._tramo(sig);
        else if (this.bucle) this._tramo(0);
        else {
          this.activo = false;
          this.fase = 'detenido';
          this.indice = -1;
          this.alCambiar?.();
        }
      }
    }
  }
}
