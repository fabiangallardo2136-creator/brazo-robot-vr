// Cámaras y pantallas.
//
// Cada pantalla de la escena muestra una "fuente":
//   - virtual: lo que ve una cámara simulada (pinza o ambiente).
//   - stream:  un MediaStream de video (webcam de este equipo hoy; en la
//              versión 2, el video que llegue por WebRTC desde el brazo real).
//   - apagada: pantalla en negro con el texto "Sin señal".
//
// Para conectar una cámara real en el futuro basta con conseguir un
// MediaStream y llamar a camaras.fijarStream(indice, stream, 'Nombre').
import * as THREE from 'three';

const ANCHO_RT = 512;
const ALTO_RT = 384;

function modeloCamara(color = 0x222428) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.02), mat);
  const lente = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.008, 0.012, 16),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.8 }),
  );
  lente.rotation.x = Math.PI / 2;
  lente.position.z = -0.015;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.002, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
  led.position.set(0.01, 0.006, -0.0105);
  g.add(cuerpo, lente, led);
  return g;
}

class Pantalla {
  constructor(titulo, anchoM = 0.44) {
    this.titulo = titulo;
    this.grupo = new THREE.Group();
    const altoM = anchoM * ALTO_RT / ANCHO_RT;

    const marco = new THREE.Mesh(
      new THREE.BoxGeometry(anchoM + 0.025, altoM + 0.025, 0.015),
      new THREE.MeshStandardMaterial({ color: 0x181b20, roughness: 0.6, metalness: 0.2 }),
    );
    marco.position.z = -0.009;
    this.grupo.add(marco);

    this.matPantalla = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.plano = new THREE.Mesh(new THREE.PlaneGeometry(anchoM, altoM), this.matPantalla);
    this.grupo.add(this.plano);

    // Etiqueta sobre la pantalla
    this.canvasEtiqueta = document.createElement('canvas');
    this.canvasEtiqueta.width = 512;
    this.canvasEtiqueta.height = 64;
    this.texEtiqueta = new THREE.CanvasTexture(this.canvasEtiqueta);
    this.texEtiqueta.colorSpace = THREE.SRGBColorSpace;
    const etiqueta = new THREE.Mesh(
      new THREE.PlaneGeometry(anchoM, anchoM / 8),
      new THREE.MeshBasicMaterial({ map: this.texEtiqueta, transparent: true, toneMapped: false }),
    );
    etiqueta.position.y = altoM / 2 + anchoM / 16 + 0.018;
    this.grupo.add(etiqueta);

    // Textura de "sin señal"
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 192;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = '#6b7480';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sin señal', 128, 104);
    this.texSinSenal = new THREE.CanvasTexture(c);
    this.texSinSenal.colorSpace = THREE.SRGBColorSpace;

    this.rt = new THREE.WebGLRenderTarget(ANCHO_RT, ALTO_RT, { samples: 0 });
    this.fuente = { tipo: 'apagada', nombre: 'Apagada' };
  }

  dibujarEtiqueta() {
    const ctx = this.canvasEtiqueta.getContext('2d');
    ctx.clearRect(0, 0, 512, 64);
    ctx.fillStyle = 'rgba(20,23,28,0.9)';
    ctx.fillRect(0, 0, 512, 64);
    const enVivo = this.fuente.tipo !== 'apagada';
    ctx.fillStyle = enVivo ? '#ff4040' : '#555';
    ctx.beginPath();
    ctx.arc(28, 32, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8ecf1';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.titulo, 50, 33);
    ctx.fillStyle = '#9aa5b1';
    ctx.font = '24px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(this.fuente.nombre, 500, 33);
    ctx.textAlign = 'left';
    this.texEtiqueta.needsUpdate = true;
  }

  liberarStream() {
    if (this.fuente.tipo === 'stream') {
      if (this.fuente.propio) this.fuente.stream.getTracks().forEach((t) => t.stop());
      this.fuente.video.srcObject = null;
      this.fuente.textura.dispose();
    }
  }

  fijarVirtual(camara, nombre) {
    this.liberarStream();
    this.fuente = { tipo: 'virtual', camara, nombre };
    this.matPantalla.map = this.rt.texture;
    this.matPantalla.needsUpdate = true;
    this.dibujarEtiqueta();
  }

  fijarStream(stream, nombre, propio = false) {
    this.liberarStream();
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;
    video.play().catch(() => { /* se reintenta al interactuar */ });
    const textura = new THREE.VideoTexture(video);
    textura.colorSpace = THREE.SRGBColorSpace;
    this.fuente = { tipo: 'stream', stream, video, textura, nombre, propio };
    this.matPantalla.map = textura;
    this.matPantalla.needsUpdate = true;
    this.dibujarEtiqueta();
  }

  apagar() {
    this.liberarStream();
    this.fuente = { tipo: 'apagada', nombre: 'Apagada' };
    this.matPantalla.map = this.texSinSenal;
    this.matPantalla.needsUpdate = true;
    this.dibujarEtiqueta();
  }
}

export function crearCamaras({ renderer, escena, brazo, config }) {
  const cfg = config.camaras;
  const [bx, by, bz] = config.ubicacion.posicion;

  // Cámara de la pinza: mira a lo largo de +Y del efector (los dedos).
  const camPinza = new THREE.PerspectiveCamera(cfg.pinza.fov, ANCHO_RT / ALTO_RT, 0.005, 20);
  camPinza.position.fromArray(cfg.pinza.posicion);
  camPinza.rotation.x = Math.PI / 2;
  brazo.efector.add(camPinza);
  const modeloPinza = modeloCamara();
  modeloPinza.position.copy(camPinza.position).add(new THREE.Vector3(0, -0.021, 0));
  modeloPinza.rotation.x = Math.PI / 2;
  brazo.efector.add(modeloPinza);

  // Cámara de ambiente, fija en un trípode.
  const camAmbiente = new THREE.PerspectiveCamera(cfg.ambiente.fov, ANCHO_RT / ALTO_RT, 0.02, 30);
  camAmbiente.position.fromArray(cfg.ambiente.posicion);
  camAmbiente.lookAt(new THREE.Vector3().fromArray(cfg.ambiente.mirarA));
  escena.add(camAmbiente);
  const modeloAmb = modeloCamara();
  modeloAmb.scale.setScalar(1.6);
  modeloAmb.position.copy(camAmbiente.position);
  modeloAmb.quaternion.copy(camAmbiente.quaternion);
  escena.add(modeloAmb);
  const tripode = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.012, camAmbiente.position.y, 10),
    new THREE.MeshStandardMaterial({ color: 0x333840, roughness: 0.6, metalness: 0.5 }),
  );
  tripode.position.set(camAmbiente.position.x, camAmbiente.position.y / 2 - 0.02, camAmbiente.position.z);
  escena.add(tripode);

  // Pantallas a la derecha del brazo, una sobre otra, giradas hacia el usuario.
  const pantallas = [new Pantalla('Cámara pinza'), new Pantalla('Cámara ambiente')];
  const virtuales = [camPinza, camAmbiente];
  const grupo = new THREE.Group();
  grupo.position.set(bx + 0.66, by + 0.42, bz + 0.12);
  grupo.rotation.y = -0.55;
  pantallas[0].grupo.position.y = 0.23;
  pantallas[1].grupo.position.y = -0.22;
  pantallas.forEach((p) => grupo.add(p.grupo));
  escena.add(grupo);
  pantallas.forEach((p, i) => p.fijarVirtual(virtuales[i], 'Simulada'));

  let turno = 0;
  const fondo = new THREE.Color();

  return {
    pantallas,
    grupo,
    get visibles() {
      return grupo.visible;
    },
    fijarVisibles(v) {
      grupo.visible = v;
    },
    usarVirtual(i) {
      pantallas[i].fijarVirtual(virtuales[i], 'Simulada');
    },
    fijarStream(i, stream, nombre, propio = false) {
      pantallas[i].fijarStream(stream, nombre, propio);
    },
    apagar(i) {
      pantallas[i].apagar();
    },
    // Renderiza una cámara virtual por cuadro (alternando) para no cargar al Quest.
    actualizar() {
      if (!grupo.visible) return;
      const activas = pantallas.filter((p) => p.fuente.tipo === 'virtual');
      if (!activas.length) return;
      const p = activas[turno++ % activas.length];
      const xr = renderer.xr.enabled;
      const anterior = renderer.getRenderTarget();
      renderer.getClearColor(fondo);
      // Ocultar pantallas, modelos de cámara y asa para que no tapen la vista.
      grupo.visible = false;
      const ocultos = [modeloPinza, modeloAmb, brazo.asa].filter((o) => o.visible);
      ocultos.forEach((o) => { o.visible = false; });
      renderer.xr.enabled = false;
      renderer.setRenderTarget(p.rt);
      renderer.render(escena, p.fuente.camara);
      renderer.setRenderTarget(anterior);
      renderer.xr.enabled = xr;
      grupo.visible = true;
      ocultos.forEach((o) => { o.visible = true; });
    },
  };
}

// Lista las webcams del equipo. Pide permiso una vez para obtener los nombres.
export async function listarWebcams() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  let dispositivos = await navigator.mediaDevices.enumerateDevices();
  if (dispositivos.some((d) => d.kind === 'videoinput' && !d.label)) {
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    s.getTracks().forEach((t) => t.stop());
    dispositivos = await navigator.mediaDevices.enumerateDevices();
  }
  return dispositivos
    .filter((d) => d.kind === 'videoinput')
    .map((d, i) => ({ id: d.deviceId, nombre: d.label || `Webcam ${i + 1}` }));
}

export async function abrirWebcam(deviceId) {
  return navigator.mediaDevices.getUserMedia({
    video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
}
