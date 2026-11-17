// WebXR: botón para entrar, controles del Quest con rayo, uso del panel y
// agarre del efector (cinemática inversa).
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export async function configurarBotonVR(renderer, boton, app) {
  const poner = (texto, habilitado, titulo = '') => {
    boton.textContent = texto;
    boton.disabled = !habilitado;
    boton.title = titulo;
  };
  if (!window.isSecureContext) {
    return poner('VR requiere HTTPS', false, 'Abre la app por https:// (ver README)');
  }
  if (!('xr' in navigator)) {
    return poner('WebXR no disponible', false, 'Este navegador no tiene WebXR. Usa el navegador del Quest.');
  }
  let soportado = false;
  try {
    soportado = await navigator.xr.isSessionSupported('immersive-vr');
  } catch { /* nada */ }
  if (!soportado) return poner('VR no disponible aquí', false, 'No hay visor conectado o el navegador no permite VR inmersiva.');

  let sesion = null;
  poner('Entrar en VR', true);
  boton.addEventListener('click', async () => {
    if (sesion) {
      await sesion.end();
      return;
    }
    try {
      sesion = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      sesion.addEventListener('end', () => {
        sesion = null;
        poner('Entrar en VR', true);
      });
      await renderer.xr.setSession(sesion);
      poner('Salir de VR', true);
    } catch (e) {
      sesion = null;
      app.informar(`No se pudo entrar en VR: ${e.message}`);
    }
  });
}

export function configurarVR({ renderer, escena, app, panel, brazo }) {
  const fabrica = new XRControllerModelFactory();
  const raycaster = new THREE.Raycaster();
  const rot = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  const geomRayo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const matRayo = new THREE.LineBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.8 });
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

    const m = { c, rayo, punta, fuente: null, id: `vr${i}`, enPanel: false, agarre: null };
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
    // ¿Agarra el efector? Cerca de la mano o apuntándolo con el rayo.
    const posAsa = brazo.efector.getWorldPosition(tmp);
    const posMano = m.c.getWorldPosition(tmp2);
    const cerca = posMano.distanceTo(posAsa) < 0.12;
    const apunta = raycaster.intersectObject(brazo.zonaAgarre).length > 0;
    if (cerca || apunta) {
      m.agarre = { boton, offset: m.c.worldToLocal(posAsa.clone()) };
      app.iniciarArrastreEfector();
      vibrar(m, 0.6, 40);
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
  }

  const plano = new THREE.Vector3();

  // Se llama en cada cuadro.
  function actualizar() {
    if (!renderer.xr.isPresenting) return false;
    let algunoApunta = false;
    for (const m of manos) {
      if (!m.fuente) continue;
      apuntar(m);
      let distancia = 2;

      if (panel.malla.visible) {
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
