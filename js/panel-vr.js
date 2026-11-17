// Panel flotante dibujado en un canvas y pegado a un plano 3D. Se usa en VR
// (con los rayos de los controles) y también en escritorio (con el ratón).
import * as THREE from 'three';

export const COLOR = {
  fondo: 'rgba(22, 26, 32, 0.94)',
  borde: '#3fa9f5',
  texto: '#e8ecf1',
  tenue: '#9aa5b1',
  pista: '#39414c',
  relleno: '#e8772e',
  real: '#3fa9f5',
  boton: '#2e3540',
  botonHover: '#3b4553',
  botonActivo: '#e8772e',
};

export class PanelVR {
  constructor({ ancho = 1024, alto = 1040, anchoMetros = 0.6 } = {}) {
    this.ancho = ancho;
    this.alto = alto;
    this.canvas = document.createElement('canvas');
    this.canvas.width = ancho;
    this.canvas.height = alto;
    this.ctx = this.canvas.getContext('2d');
    this.textura = new THREE.CanvasTexture(this.canvas);
    this.textura.colorSpace = THREE.SRGBColorSpace;
    this.textura.anisotropy = 4;
    this.anchoM = anchoMetros;
    this.altoM = anchoMetros * alto / ancho;
    this.malla = new THREE.Mesh(
      new THREE.PlaneGeometry(this.anchoM, this.altoM),
      new THREE.MeshBasicMaterial({ map: this.textura, transparent: true, toneMapped: false }),
    );
    this.malla.name = 'panelVR';
    this.widgets = [];
    this.arrastres = new Map(); // dueño → widget
    this.hovers = new Map();    // dueño → widget
    this.destello = null;
    this._ultimo = 0;
    this._plano = new THREE.Plane();
  }

  agregar(w) {
    this.widgets.push(w);
    return w;
  }

  // Punto en el mundo → uv del panel (aunque esté fuera del borde).
  uvDesdePunto(puntoMundo) {
    const p = this.malla.worldToLocal(puntoMundo.clone());
    return new THREE.Vector2(p.x / this.anchoM + 0.5, p.y / this.altoM + 0.5);
  }

  planoMundo() {
    const n = new THREE.Vector3(0, 0, 1).transformDirection(this.malla.matrixWorld);
    const p = new THREE.Vector3().setFromMatrixPosition(this.malla.matrixWorld);
    return this._plano.setFromNormalAndCoplanarPoint(n, p);
  }

  _px(uv) {
    return { x: uv.x * this.ancho, y: (1 - uv.y) * this.alto };
  }

  _buscar(p) {
    return this.widgets.find((w) => w.tipo !== 'texto' && (!w.visible || w.visible())
      && p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h);
  }

  // Devuelve true si el toque cayó sobre un control.
  presionar(uv, dueno) {
    const p = this._px(uv);
    const w = this._buscar(p);
    if (!w) return false;
    if (w.tipo === 'boton') {
      w.accion();
      this.destello = { w, hasta: performance.now() + 180 };
    } else if (w.tipo === 'deslizador') {
      this.arrastres.set(dueno, w);
      this._fijarDesdeX(w, p.x);
    }
    this._ultimo = 0;
    return true;
  }

  arrastrar(uv, dueno) {
    const w = this.arrastres.get(dueno);
    if (w) this._fijarDesdeX(w, this._px(uv).x);
  }

  soltar(dueno) {
    this.arrastres.delete(dueno);
  }

  arrastrando(dueno) {
    return this.arrastres.has(dueno);
  }

  senalar(uv, dueno) {
    const w = uv ? this._buscar(this._px(uv)) : null;
    if (this.hovers.get(dueno) !== w) {
      this.hovers.set(dueno, w);
      this._ultimo = 0;
    }
  }

  _pista(w) {
    return { x0: w.x + 270, x1: w.x + w.w - 170 };
  }

  _fijarDesdeX(w, x) {
    const { x0, x1 } = this._pista(w);
    const s = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
    w.fijar(w.min + s * (w.max - w.min));
  }

  // Redibuja como máximo cada 100 ms (o de inmediato tras un toque).
  actualizar(ahora = performance.now()) {
    if (ahora - this._ultimo < 100) return;
    this._ultimo = ahora;
    this.dibujar();
    this.textura.needsUpdate = true;
  }

  dibujar() {
    const { ctx, ancho, alto } = this;
    ctx.clearRect(0, 0, ancho, alto);
    redondeado(ctx, 4, 4, ancho - 8, alto - 8, 28);
    ctx.fillStyle = COLOR.fondo;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLOR.borde;
    ctx.stroke();

    const hovers = new Set(this.hovers.values());
    for (const w of this.widgets) {
      if (w.visible && !w.visible()) continue;
      if (w.tipo === 'texto') this._texto(w);
      else if (w.tipo === 'boton') this._boton(w, hovers.has(w));
      else if (w.tipo === 'deslizador') this._deslizador(w, hovers.has(w));
    }
  }

  _texto(w) {
    const { ctx } = this;
    ctx.font = `${w.negrita ? 'bold ' : ''}${w.tam ?? 30}px system-ui, sans-serif`;
    ctx.fillStyle = w.color ?? COLOR.texto;
    ctx.textAlign = w.alinear ?? 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(w.texto(), w.x, w.y);
  }

  _boton(w, hover) {
    const { ctx } = this;
    const brillo = this.destello && this.destello.w === w && performance.now() < this.destello.hasta;
    const activo = w.activo?.() || brillo;
    redondeado(ctx, w.x, w.y, w.w, w.h, 16);
    ctx.fillStyle = activo ? COLOR.botonActivo : hover ? COLOR.botonHover : COLOR.boton;
    ctx.fill();
    if (hover) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLOR.borde;
      ctx.stroke();
    }
    // El texto se achica si no cabe en el botón.
    const texto = w.texto();
    let tam = w.tam ?? 32;
    ctx.font = `bold ${tam}px system-ui, sans-serif`;
    while (tam > 16 && ctx.measureText(texto).width > w.w - 16) {
      tam -= 2;
      ctx.font = `bold ${tam}px system-ui, sans-serif`;
    }
    ctx.fillStyle = COLOR.texto;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, w.x + w.w / 2, w.y + w.h / 2 + 1);
  }

  _deslizador(w, hover) {
    const { ctx } = this;
    const cy = w.y + w.h / 2;
    if (hover || this.arrastres.size && [...this.arrastres.values()].includes(w)) {
      redondeado(ctx, w.x - 8, w.y, w.w + 16, w.h, 12);
      ctx.fillStyle = 'rgba(63,169,245,0.12)';
      ctx.fill();
    }
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillStyle = COLOR.texto;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(w.etiqueta(), w.x + 6, cy);

    const { x0, x1 } = this._pista(w);
    const aX = (v) => x0 + (Math.min(w.max, Math.max(w.min, v)) - w.min) / (w.max - w.min) * (x1 - x0);
    redondeado(ctx, x0, cy - 7, x1 - x0, 14, 7);
    ctx.fillStyle = COLOR.pista;
    ctx.fill();
    // cero
    if (w.min < 0 && w.max > 0) {
      ctx.fillStyle = COLOR.tenue;
      ctx.fillRect(aX(0) - 1, cy - 14, 2, 28);
    }
    const v = w.valor();
    const desde = w.min < 0 && w.max > 0 ? aX(0) : x0;
    ctx.fillStyle = COLOR.relleno;
    ctx.fillRect(Math.min(desde, aX(v)), cy - 7, Math.abs(aX(v) - desde), 14);
    // posición real (si difiere del objetivo)
    if (w.real) {
      ctx.fillStyle = COLOR.real;
      ctx.beginPath();
      ctx.moveTo(aX(w.real()), cy + 10);
      ctx.lineTo(aX(w.real()) - 10, cy + 26);
      ctx.lineTo(aX(w.real()) + 10, cy + 26);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(aX(v), cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.texto;
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(w.texto(), w.x + w.w, cy);
  }
}

function redondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

