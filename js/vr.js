// WebXR: botones para entrar en VR o en modo mixto (passthrough), controles
// del Quest con rayo, uso del panel, agarre del efector (cinemática inversa) y
// arrastre de objetos (panel, pantallas, brazo).
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { iniciarArrastre, aplicarArrastre } from './disposicion.js';

/**
 * Configura los botones "Entrar en VR" y "Modo mixto".
 * alCambiarModo(modo) recibe 'vr', 'mixto' o null al salir.
 */
export async function configurarBotonesXR(renderer, { botonVR, botonAR }, app, alCambiarModo) {
  const poner = (boton, texto, habilitado, titulo = '') => {
    boton.textContent = texto;
    boton.disabled = !habilitado;
    boton.title = titulo;
  };
  if (!window.isSecureContext) {
    poner(botonVR, 'VR requiere HTTPS', false, 'Abre la app por https:// (ver README)');
    botonAR.hidden = true;
    return;
  }
  if (!('xr' in navigator)) {
    poner(botonVR, 'WebXR no disponible', false, 'Este navegador no tiene WebXR. Usa el navegador del Quest.');
    botonAR.hidden = true;
    return;
  }
  const soporta = async (modo) => {
    try {
      return await navigator.xr.isSessionSupported(modo);
    } catch {
      return false;
    }
  };
  const [vr, ar] = await Promise.all([soporta('immersive-vr'), soporta('immersive-ar')]);

  const textos = { vr: 'Entrar en VR', mixto: 'Modo mixto (passthrough)' };
  let sesion = null;
  const restablecer = () => {
    if (vr) poner(botonVR, textos.vr, true);
    else poner(botonVR, 'VR no disponible aquí', false, 'No hay visor conectado o el navegador no permite VR.');
    botonAR.hidden = !ar;
    if (ar) poner(botonAR, textos.mixto, true);
  };
  restablecer();

  async function entrar(modo, boton) {
    if (sesion) {
      await sesion.end();
      return;
    }
    try {
      sesion = await navigator.xr.requestSession(modo === 'mixto' ? 'immersive-ar' : 'immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      sesion.addEventListener('end', () => {
        sesion = null;
        alCambiarModo(null);
        restablecer();
      });
      alCambiarModo(modo);
      await renderer.xr.setSession(sesion);
      poner(boton, 'Salir', true);
    } catch (e) {
      sesion = null;
      alCambiarModo(null);
      app.informar(`No se pudo entrar: ${e.message}`);
    }
  }
  botonVR.addEventListener('click', () => entrar('vr', botonVR));
  botonAR.addEventListener('click', () => entrar('mixto', botonAR));
}

export function configurarVR({ renderer, escena, app, panel, brazo, disposicion }) {
  const fabrica = new XRControllerModelFactory();
  const raycaster = new THREE.Raycaster();
  const rot = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const empuje = new THREE.Matrix4();

  const geomRayo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const matRayo = new THREE.LineBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.8 });
  const matRayoMover = new THREE.LineBasicMaterial({ color: 0xffc04d, transparent: true, opacity: 0.9 });
  const geomPunta = new THREE.SphereGeometry(0.006, 12, 8);
  const matPunta = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const manos = [0, 1].map((i) => {
    const c = renderer.xr.getController(i);
    escena.add(c);
    const grip = renderer.xr.getControllerGrip(i);
    grip.add(fabrica.createControllerModel(grip));
    escena.add(grip);
    const rayo = new THREE.Line(geomRayo, matRayo);
    rayo.scale.z = 2;
    c.add(rayo);
    const punta = new THREE.Mesh(geomPunta, matPunta);
    punta.visible = false;
    escena.add(punta);

    const m = { c, rayo, punta, fuente: null, id: `vr${i}`, enPanel: false, agarre: null, moviendo: null };
    c.addEventListener('connected', (e) => {
      m.fuente = e.data;
      rayo.visible = e.data.targetRayMode === 'tracked-pointer';
    });
    c.addEventListener('disconnected', () => {
      soltar(m, 'gatillo');
      soltar(m, 'grip');
      m.fuente = null;
    });
    c.addEventListener('selectstart', () => presionar(m, 'gatillo'));
    c.addEventListener('selectend', () => soltar(m, 'gatillo'));
    c.addEventListener('squeezestart', () => presionar(m, 'grip'));
    c.addEventListener('squeezeend', () => soltar(m, 'grip'));
    return m;
  });

  function apuntar(m) {
    rot.identity().extractRotation(m.c.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(m.c.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rot);
  }

  function vibrar(m, fuerza = 0.4, ms = 30) {
    const act = m.fuente?.gamepad?.hapticActuators?.[0];
    try {
      act?.pulse?.(fuerza, ms);
    } catch { /* nada */ }
  }

  function tocaEfector(m) {
    const posAsa = brazo.efector.getWorldPosition(tmp);
    const posMano = m.c.getWorldPosition(tmp2);
    return posMano.distanceTo(posAsa) < 0.12 || raycaster.intersectObject(brazo.zonaAgarre).length > 0;
  }

  function presionar(m, boton) {
    apuntar(m);
    if (boton === 'gatillo' && panel.malla.visible) {
      const hit = raycaster.intersectObject(panel.malla)[0];
      if (hit) {
        if (panel.presionar(hit.uv, m.id)) vibrar(m, 0.3, 20);
        m.enPanel = true;
        return;
      }
    }
    // ¿Agarra la punta del brazo? Cerca de la mano o apuntándola con el rayo.
    if (tocaEfector(m)) {
      const posAsa = brazo.efector.getWorldPosition(tmp);
      m.agarre = { boton, offset: m.c.worldToLocal(posAsa.clone()) };
      app.iniciarArrastreEfector();
      vibrar(m, 0.6, 40);
      return;
    }
    // Con el grip: mover panel, pantallas o el brazo completo.
    if (boton === 'grip') {
      const hit = disposicion.buscar(raycaster);
      if (hit) {
        m.moviendo = { o: hit.o, relativa: iniciarArrastre(m.c.matrixWorld, hit.o.obj) };
        m.rayo.material = matRayoMover;
        vibrar(m, 0.5, 30);
      }
    }
  }

  function soltar(m, boton) {
    if (boton === 'gatillo' && m.enPanel) {
      panel.soltar(m.id);
      m.enPanel = false;
    }
    if (m.agarre?.boton === boton) {
      m.agarre = null;
      if (!manos.some((o) => o.agarre)) app.terminarArrastreEfector();
    }
    if (boton === 'grip' && m.moviendo) {
      m.moviendo = null;
      m.rayo.material = matRayo;
      disposicion.guardar();
    }
  }

  const plano = new THREE.Vector3();

  // Se llama en cada cuadro.
  function actualizar(dt) {
    if (!renderer.xr.isPresenting) return false;
    let algunoApunta = false;
    for (const m of manos) {
      if (!m.fuente) continue;
      apuntar(m);
      let distancia = 2;

      if (m.moviendo) {
        // La palanca (adelante/atrás) acerca o aleja el objeto.
        const ejeY = m.fuente.gamepad?.axes?.[3] ?? 0;
        if (Math.abs(ejeY) > 0.15) {
          empuje.makeTranslation(0, 0, ejeY * dt * 0.8);
          m.moviendo.relativa.premultiply(empuje);
        }
        aplicarArrastre(m.c.matrixWorld, m.moviendo.relativa, m.moviendo.o.obj, m.moviendo.o.soloGiroY);
        distancia = m.c.getWorldPosition(tmp2).distanceTo(m.moviendo.o.obj.position);
      } else if (panel.malla.visible) {
        if (panel.arrastrando(m.id)) {
          // Mientras se arrastra un deslizador se usa el plano infinito del panel.
          if (raycaster.ray.intersectPlane(panel.planoMundo(), plano)) {
            panel.arrastrar(panel.uvDesdePunto(plano), m.id);
          }
        }
        const hit = raycaster.intersectObject(panel.malla)[0];
        panel.senalar(hit ? hit.uv : null, m.id);
        if (hit) distancia = hit.distance;
      }

      const hitAsa = raycaster.intersectObject(brazo.zonaAgarre)[0];
      if (hitAsa && hitAsa.distance < distancia) {
        distancia = hitAsa.distance;
        algunoApunta = true;
      }
      if (m.c.getWorldPosition(tmp2).distanceTo(brazo.efector.getWorldPosition(tmp)) < 0.12) algunoApunta = true;
      if (!m.moviendo && distancia >= 2) {
        const hit = disposicion.buscar(raycaster);
        if (hit) distancia = hit.distancia;
      }

      m.rayo.scale.z = distancia;
      m.punta.visible = distancia < 2;
      m.punta.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, distancia);

      if (m.agarre) {
        app.moverEfectorA(m.c.localToWorld(m.agarre.offset.clone()));
      }
    }
    return algunoApunta || manos.some((m) => m.agarre);
  }

  return { actualizar, manos };
}
