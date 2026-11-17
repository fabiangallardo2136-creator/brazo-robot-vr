// Programas: lista de puntos (poses) que se reproducen en orden.
//
// Formato JSON de un programa (el mismo para localStorage y para exportar):
// {
//   "formato": "brazo-robot-vr/programa", "version": 1,
//   "nombre": "Pick and place",
//   "brazo": "Brazo 6 GDL de escritorio (genérico)",
//   "articulaciones": ["J1", "J2", "J3", "J4", "J5", "J6"],
//   "puntos": [
//     { "angulos": [0, 15, 75, 0, 70, 0], "velocidad": 100, "pausa": 0.5 }
//   ]
// }
// velocidad: % de la velocidad máxima de cada articulación para llegar a ese punto.
// pausa: segundos de espera al llegar.

export const FORMATO = 'brazo-robot-vr/programa';
const CLAVE_PROGRAMAS = 'brazoVR.programas';
const CLAVE_ACTUAL = 'brazoVR.programaActual';

const limitarNum = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function nuevoPrograma(nombre, config) {
  return {
    formato: FORMATO, version: 1, nombre,
    brazo: config.nombre,
    articulaciones: config.articulaciones.map((a) => a.id),
    puntos: [],
  };
}

export function nuevoPunto(angulos) {
  return { angulos: angulos.map((v) => Math.round(v * 10) / 10), velocidad: 100, pausa: 0 };
}

// Valida y limpia un programa leído de un archivo o de localStorage.
export function normalizarPrograma(datos, config) {
  if (!datos || typeof datos !== 'object' || !Array.isArray(datos.puntos)) {
    throw new Error('El archivo no parece un programa: falta la lista "puntos".');
  }
  const art = config.articulaciones;
  const puntos = datos.puntos.map((p, i) => {
    const ang = Array.isArray(p) ? p : p?.angulos;
    if (!Array.isArray(ang) || ang.length !== art.length || ang.some((v) => !Number.isFinite(Number(v)))) {
      throw new Error(`El punto ${i + 1} no tiene ${art.length} ángulos numéricos.`);
    }
    return {
      angulos: ang.map((v, j) => limitarNum(v, art[j].min, art[j].max, 0)),
      velocidad: limitarNum(p.velocidad, 5, 100, 100),
      pausa: limitarNum(p.pausa, 0, 60, 0),
    };
  });
  const prog = nuevoPrograma(String(datos.nombre || 'Programa importado').slice(0, 60), config);
  prog.puntos = puntos;
  return prog;
}

// ---------------------------------------------------------------------------
// Almacenamiento en el navegador (localStorage). Cada navegador (escritorio,
// Quest) tiene el suyo: para pasar programas entre equipos, exportar/importar.
// ---------------------------------------------------------------------------
function leer(clave, def) {
  try {
    const t = localStorage.getItem(clave);
    return t ? JSON.parse(t) : def;
  } catch {
    return def;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export const almacen = {
  listar() {
    return Object.keys(leer(CLAVE_PROGRAMAS, {})).sort((a, b) => a.localeCompare(b, 'es'));
  },
  guardar(programa) {
    const todos = leer(CLAVE_PROGRAMAS, {});
    todos[programa.nombre] = programa;
    return escribir(CLAVE_PROGRAMAS, todos);
  },
  cargar(nombre, config) {
    const p = leer(CLAVE_PROGRAMAS, {})[nombre];
    return p ? normalizarPrograma(p, config) : null;
  },
  borrar(nombre) {
    const todos = leer(CLAVE_PROGRAMAS, {});
    delete todos[nombre];
    return escribir(CLAVE_PROGRAMAS, todos);
  },
  guardarActual(programa) {
    return escribir(CLAVE_ACTUAL, programa);
  },
  cargarActual(config) {
    try {
      const p = leer(CLAVE_ACTUAL, null);
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
// Reproductor: lleva el objetivo del controlador de punto en punto con una
// interpolación suave en espacio articular. La duración de cada tramo se
// calcula para que ninguna articulación pase su velocidad máxima (la curva
// suave tiene un pico de 1,5 veces la velocidad media, por eso el factor 1,5).
// ---------------------------------------------------------------------------
export class Reproductor {
  constructor(controlador) {
    this.c = controlador;
    this.activo = false;
    this.indice = -1;
    this.fase = 'detenido'; // 'moviendo' | 'esperando' | 'detenido'
    this.alCambiar = null;
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
    this.desde = this.c.actual.slice();
    this.hacia = p.angulos.map((v, j) => this.c.limitar(this.c.art[j], v));
    const fraccion = (p.velocidad ?? 100) / 100;
    let dur = 0;
    this.hacia.forEach((v, j) => {
      const vel = this.c.velocidadDe(j) * fraccion;
      dur = Math.max(dur, Math.abs(v - this.desde[j]) / vel);
    });
    this.duracion = Math.max(0.05, dur * 1.5);
    this.t = 0;
    this.fase = 'moviendo';
    this.alCambiar?.();
  }

  actualizar(dt) {
    if (!this.activo) return;
    if (this.fase === 'moviendo') {
      this.t += dt;
      const s = Math.min(1, this.t / this.duracion);
      const e = s * s * (3 - 2 * s);
      this.c.fijarObjetivos(this.desde.map((v, j) => v + (this.hacia[j] - v) * e));
      if (s >= 1 && this.c.llego(this.hacia)) {
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
