// WebXR: botón para entrar al visor, controles del Quest con rayo, uso de los
// paneles, agarre de la punta (cinemática inversa), mover objetos con la mano
// y mando directo con palancas y botones.
//
// Al entrar se pide una sesión "immersive-ar" si el visor la permite: así el
// fondo se puede cambiar entre virtual y la sala real (passthrough) desde el
// panel, sin salir del visor. Si no la permite, se entra en "immersive-vr".
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { iniciarArrastre, aplicarArrastre } from './disposicion.js';

/**
 * Configura los botones de entrada: "Entrar en VR" (fondo virtual) y
 * "Entrar con sala real" (passthrough). alCambiarModo(modo, { salaReal })
 * recibe 'mixto' (sesión AR: el fondo se puede alternar dentro), 'vr' o null
 * al salir.
 */
export async function configurarBotonXR(renderer, { boton, botonReal }, app, alCambiarModo) {
  const poner = (texto, habilitado, titulo = '') => {
    boton.textContent = texto;
    boton.disabled = !habilitado;
    boton.title = titulo;
  };
  botonReal.hidden = true;
  if (!window.isSecureContext) return poner('VR requiere HTTPS', false, 'Abre la app por https:// (ver README)');
  if (!('xr' in navigator)) return poner('WebXR no disponible', false, 'Usa el navegador del Quest.');
  const soporta = async (modo) => {
    try {
      return await navigator.xr.isSessionSupported(modo);
    } catch {
      return false;
    }
  };
  const [vr, ar] = await Promise.all([soporta('immersive-vr'), soporta('immersive-ar')]);
  app.xrSoporte = { vr, ar };
  console.info('[brazo] WebXR: immersive-vr', vr, '· immersive-ar', ar);
  if (!vr && !ar) return poner('VR no disponible aquí', false, 'No hay visor conectado o el navegador no permite VR.');

  let sesion = null;
  const listo = () => {
    poner('Entrar en VR', true, ar ? 'Dentro podrás pasar a tu sala real (Escena → Fondo)' : '');
    botonReal.hidden = !ar;
    botonReal.textContent = 'Entrar con sala real';
  };
  listo();

  async function pedir(modo) {
    return navigator.xr.requestSession(modo, { optionalFeatures: ['local-floor', 'bounded-floor'] });
  }

  async function entrar(salaReal) {
    if (sesion) {
      await sesion.end();
      return;
    }
    let modo = ar ? 'mixto' : 'vr';
    try {
      try {
        sesion = await pedir(modo === 'mixto' ? 'immersive-ar' : 'immersive-vr');
      } catch (e) {
        if (modo !== 'mixto' || !vr) throw e;
        console.warn('[brazo] immersive-ar falló, se usa immersive-vr:', e.message);
        modo = 'vr';
        sesion = await pedir('immersive-vr');
      }
      sesion.addEventListener('end', () => {
        sesion = null;
        alCambiarModo(null);
        listo();
      });
      alCambiarModo(modo, { salaReal: salaReal && modo === 'mixto' });
      await renderer.xr.setSession(sesion);
      poner('Salir del visor', true);
      botonReal.hidden = true;
    } catch (e) {
      sesion = null;
      alCambiarModo(null);
      app.informar(`No se pudo entrar: ${e.message}`);
    }
  }
  boton.addEventListener('click', () => entrar(false));
  botonReal.addEventListener('click', () => entrar(true));
}

export function configurarVR({ renderer, escena, app, paneles, brazo, disposicion, objetos, mandos, panelMuneca }) {
  const fabrica = new XRControllerModelFactory();
  const raycaster = new THREE.Raycaster();
  const rot = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const empuje = new THREE.Matrix4();
  const mallasPanel = () => paneles.filter((p) => p.malla.visible && p.malla.parent).map((p) => p.malla);

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

    const m = { c, grip, rayo, punta, fuente: null, id: `vr${i}`, panelUsado: null, agarre: null, moviendo: null };
    c.addEventListener('connected', (e) => {
      m.fuente = e.data;
      rayo.visible = e.data.targetRayMode === 'tracked-pointer';
      // El panel rápido va en la mano izquierda.
      if (e.data.handedness === 'left' && panelMuneca) grip.add(panelMuneca.malla);
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

  // ¿Qué panel toca el rayo? (no se apunta al panel que va en la propia mano)
  function panelApuntado(m) {
    const propias = m.grip.children;
    const hit = raycaster.intersectObjects(mallasPanel().filter((x) => !propias.includes(x)))[0];
    if (!hit) return null;
    return { panel: paneles.find((p) => p.malla === hit.object), hit };
  }

  function presionar(m, boton) {
    apuntar(m);
    if (boton === 'gatillo') {
      const ap = panelApuntado(m);
      if (ap) {
        if (ap.panel.presionar(ap.hit.uv, m.id)) vibrar(m, 0.3, 20);
        m.panelUsado = ap.panel;
        return;
      }
    }
    // Candidatos: la punta del brazo, un objeto, o el panel/pantallas/brazo.
    // Gana el más cercano; lo que está al alcance de la mano tiene prioridad.
    const posMano = m.c.getWorldPosition(tmp2).clone();
    const cand = [];
    const dPunta = posMano.distanceTo(brazo.efector.getWorldPosition(tmp));
    if (dPunta < 0.08) cand.push({ tipo: 'punta', d: dPunta * 0.5 });
    const hitAsa = raycaster.intersectObject(brazo.zonaAgarre)[0];
    if (hitAsa) cand.push({ tipo: 'punta', d: hitAsa.distance });
    if (boton === 'grip') {
      const cerca = objetos.cercano(posMano, 0.05);
      if (cerca) cand.push({ tipo: 'objeto', o: cerca.o, d: cerca.d * 0.5 });
      const ho = objetos.buscar(raycaster);
      if (ho) cand.push({ tipo: 'objeto', o: ho.o, d: ho.distancia });
      const hd = disposicion.buscar(raycaster);
      if (hd) cand.push({ tipo: 'disp', o: hd.o, d: hd.distancia + 0.01 });
    }
    cand.sort((x, y) => x.d - y.d);
    const elegido = cand[0];
    if (!elegido) return;
    if (elegido.tipo === 'punta') {
      const posAsa = brazo.efector.getWorldPosition(tmp);
      m.agarre = { boton, offset: m.c.worldToLocal(posAsa.clone()) };
      app.iniciarArrastreEfector();
      vibrar(m, 0.6, 40);
      return;
    }
    if (elegido.tipo === 'objeto') {
      objetos.tomarConMano(elegido.o);
      m.moviendo = { obj: elegido.o.malla, objeto: elegido.o, relativa: iniciarArrastre(m.c.matrixWorld, elegido.o.malla) };
    } else {
      m.moviendo = { obj: elegido.o.obj, soloGiroY: elegido.o.soloGiroY, relativa: iniciarArrastre(m.c.matrixWorld, elegido.o.obj) };
    }
    if (m.moviendo) {
      m.rayo.material = matRayoMover;
      vibrar(m, 0.5, 30);
    }
  }

  function soltar(m, boton) {
    if (boton === 'gatillo' && m.panelUsado) {
      m.panelUsado.soltar(m.id);
      m.panelUsado = null;
    }
    if (m.agarre?.boton === boton) {
      m.agarre = null;
      if (!manos.some((o) => o.agarre)) app.terminarArrastreEfector();
    }
    if (boton === 'grip' && m.moviendo) {
      if (m.moviendo.objeto) objetos.soltarDeMano(m.moviendo.objeto);
      else disposicion.guardar();
      m.moviendo = null;
      m.rayo.material = matRayo;
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
        aplicarArrastre(m.c.matrixWorld, m.moviendo.relativa, m.moviendo.obj, m.moviendo.soloGiroY);
        distancia = m.c.getWorldPosition(tmp2).distanceTo(m.moviendo.obj.getWorldPosition(tmp));
      } else {
        if (m.panelUsado?.arrastrando(m.id)) {
          // Mientras se arrastra un deslizador se usa el plano infinito del panel.
          if (raycaster.ray.intersectPlane(m.panelUsado.planoMundo(), plano)) {
            m.panelUsado.arrastrar(m.panelUsado.uvDesdePunto(plano), m.id);
          }
        }
        const ap = panelApuntado(m);
        for (const p of paneles) p.senalar(ap?.panel === p ? ap.hit.uv : null, m.id);
        if (ap) distancia = ap.hit.distance;
      }

      const hitAsa = raycaster.intersectObject(brazo.zonaAgarre)[0];
      if (hitAsa && hitAsa.distance < distancia) {
        distancia = hitAsa.distance;
        algunoApunta = true;
      }
      if (m.c.getWorldPosition(tmp2).distanceTo(brazo.efector.getWorldPosition(tmp)) < 0.1) algunoApunta = true;
      if (!m.moviendo && distancia >= 2) {
        const h1 = objetos.buscar(raycaster);
        const h2 = disposicion.buscar(raycaster);
        distancia = Math.min(distancia, h1?.distancia ?? 2, h2?.distancia ?? 2);
      }

      m.rayo.scale.z = distancia;
      m.punta.visible = distancia < 2;
      m.punta.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, distancia);

      if (m.agarre) app.moverEfectorA(m.c.localToWorld(m.agarre.offset.clone()));
    }

    // Palancas y botones del mando directo.
    mandos.actualizar(manos.filter((m) => m.fuente).map((m) => ({
      mano: m.fuente.handedness,
      gamepad: m.fuente.gamepad,
      ocupada: !!m.moviendo,
    })), dt);

    return algunoApunta || manos.some((m) => m.agarre);
  }

  return { actualizar, manos };
}
