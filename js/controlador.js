// Controlador de articulaciones y pinza: guarda el valor objetivo de cada eje
// y hace avanzar el valor "real" hacia él sin pasar la velocidad máxima, igual
// que lo haría un servo. Envía los valores reales al driver a una tasa fija.
export class Controlador {
  constructor(config) {
    this.art = config.articulaciones;
    this.cfgPinza = config.herramienta.pinza;
    this.objetivo = this.art.map((a) => this.limitar(a, a.inicial ?? 0));
    this.actual = this.objetivo.slice();
    this.pinzaObjetivo = this.cfgPinza.inicial;
    this.pinzaActual = this.pinzaObjetivo;
    this.velocidad = 1;          // fracción de velMax (0,1–1)
    this.periodoEnvio = 1 / 25;  // 25 envíos por segundo como máximo
    this.alEnviar = null;        // función(angulos, aperturaPinza) que pone la app
    this._t = 0;
    this._ultimoEnviado = '';
  }

  limitar(a, v) {
    return Math.min(a.max, Math.max(a.min, Number(v) || 0));
  }

  fijarObjetivo(i, v) {
    this.objetivo[i] = this.limitar(this.art[i], v);
  }

  fijarObjetivos(angulos) {
    angulos.forEach((v, i) => this.fijarObjetivo(i, v));
  }

  // Apertura de la pinza en metros.
  fijarPinza(m) {
    const p = this.cfgPinza;
    this.pinzaObjetivo = Math.min(p.aperturaMax, Math.max(p.aperturaMin, Number(m) || 0));
  }

  pinzaLlego(tol = 0.0005) {
    return Math.abs(this.pinzaActual - this.pinzaObjetivo) <= tol;
  }

  // Deja el objetivo donde está el brazo (para detener en seco).
  congelar() {
    this.objetivo = this.actual.slice();
    this.pinzaObjetivo = this.pinzaActual;
  }

  velocidadDe(i) {
    return this.art[i].velMax * this.velocidad;
  }

  enMovimiento(tol = 0.05) {
    return this.actual.some((v, i) => Math.abs(v - this.objetivo[i]) > tol);
  }

  llego(angulos, tol = 0.3) {
    return this.actual.every((v, i) => Math.abs(v - angulos[i]) <= tol);
  }

  actualizar(dt) {
    for (let i = 0; i < this.actual.length; i++) {
      const d = this.objetivo[i] - this.actual[i];
      const paso = this.velocidadDe(i) * dt;
      this.actual[i] += Math.max(-paso, Math.min(paso, d));
    }
    const dp = this.pinzaObjetivo - this.pinzaActual;
    const pasoP = this.cfgPinza.velocidad * this.velocidad * dt;
    this.pinzaActual += Math.max(-pasoP, Math.min(pasoP, dp));

    this._t += dt;
    if (this.alEnviar && this._t >= this.periodoEnvio) {
      this._t = 0;
      const angulos = this.actual.map((v) => Math.round(v * 10) / 10);
      const pinza = Math.round(this.pinzaActual * 10000) / 10000;
      const clave = `${angulos.join(',')}|${pinza}`;
      if (clave !== this._ultimoEnviado) {
        this._ultimoEnviado = clave;
        this.alEnviar(angulos, pinza);
      }
    }
  }
}
