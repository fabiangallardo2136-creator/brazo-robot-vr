// Controlador de articulaciones: guarda el ángulo objetivo de cada una y hace
// avanzar el ángulo "real" hacia él sin pasar la velocidad máxima, igual que
// lo haría un servo. Envía los ángulos reales al driver a una tasa fija.
export class Controlador {
  constructor(config) {
    this.art = config.articulaciones;
    this.objetivo = this.art.map((a) => this.limitar(a, a.inicial ?? 0));
    this.actual = this.objetivo.slice();
    this.velocidad = 1;          // fracción de velMax (0,1–1)
    this.periodoEnvio = 1 / 25;  // 25 envíos por segundo como máximo
    this.alEnviar = null;        // función(angulos) que pone la app
    this._t = 0;
    this._ultimoEnviado = null;
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

  // Deja el objetivo donde está el brazo (para detener en seco).
  congelar() {
    this.objetivo = this.actual.slice();
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
    this._t += dt;
    if (this.alEnviar && this._t >= this.periodoEnvio) {
      this._t = 0;
      const redondeado = this.actual.map((v) => Math.round(v * 10) / 10);
      const igual = this._ultimoEnviado && redondeado.every((v, i) => v === this._ultimoEnviado[i]);
      if (!igual) {
        this._ultimoEnviado = redondeado;
        this.alEnviar(redondeado);
      }
    }
  }
}
