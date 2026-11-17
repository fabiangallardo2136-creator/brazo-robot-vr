// Ratón en escritorio: usar el panel 3D y arrastrar la esfera del efector.
// Se registra en fase de captura para adelantarse a OrbitControls.
import * as THREE from 'three';

export function configurarPunteroEscritorio({ renderer, camara, app, panel, brazo, orbita }) {
  const el = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plano = new THREE.Plane();
  const punto = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let modo = null; // 'panel' | 'efector'
  let hoverAsa = false;

  function rayoDesde(e) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camara);
  }

  el.addEventListener('pointerdown', (e) => {
    if (renderer.xr.isPresenting || e.button !== 0) return;
    rayoDesde(e);
    if (panel.malla.visible) {
      const hit = raycaster.intersectObject(panel.malla)[0];
      if (hit) {
        panel.presionar(hit.uv, 'raton');
        modo = 'panel';
      }
    }
    if (!modo && raycaster.intersectObject(brazo.zonaAgarre).length) {
      const pos = brazo.efector.getWorldPosition(new THREE.Vector3());
      camara.getWorldDirection(normal);
      plano.setFromNormalAndCoplanarPoint(normal, pos);
      app.iniciarArrastreEfector();
      modo = 'efector';
    }
    if (modo) {
      orbita.enabled = false;
      el.setPointerCapture(e.pointerId);
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, { capture: true });

  el.addEventListener('pointermove', (e) => {
    if (renderer.xr.isPresenting) return;
    rayoDesde(e);
    if (modo === 'panel') {
      if (raycaster.ray.intersectPlane(panel.planoMundo(), punto)) panel.arrastrar(panel.uvDesdePunto(punto), 'raton');
    } else if (modo === 'efector') {
      if (raycaster.ray.intersectPlane(plano, punto)) app.moverEfectorA(punto);
    } else {
      const hitPanel = panel.malla.visible ? raycaster.intersectObject(panel.malla)[0] : null;
      panel.senalar(hitPanel ? hitPanel.uv : null, 'raton');
      hoverAsa = raycaster.intersectObject(brazo.zonaAgarre).length > 0;
      el.style.cursor = hoverAsa ? 'grab' : hitPanel ? 'pointer' : '';
    }
  });

  const terminar = (e) => {
    if (!modo) return;
    if (modo === 'panel') panel.soltar('raton');
    if (modo === 'efector') app.terminarArrastreEfector();
    modo = null;
    orbita.enabled = true;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };
  el.addEventListener('pointerup', terminar);
  el.addEventListener('pointercancel', terminar);

  return {
    resaltado: () => hoverAsa || modo === 'efector',
  };
}
