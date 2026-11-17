// Objetos que se pueden mover en VR (panel, pantallas, brazo) y su posición
// guardada en el navegador, para que queden donde los dejaste.
import * as THREE from 'three';
import { leerLocal, escribirLocal } from './programa.js';

const CLAVE = 'brazoVR.disposicion';

export function crearDisposicion() {
  const objetos = new Map(); // nombre → { obj, zona, soloGiroY, inicial }

  const disp = {
    objetos,
    /**
     * @param nombre    clave para guardar
     * @param obj       Object3D hijo directo de la escena
     * @param zona      Object3D (o lista) donde se apunta para agarrarlo
     * @param soloGiroY true para que quede siempre derecho (el brazo)
     */
    registrar(nombre, obj, zona, { soloGiroY = false } = {}) {
      objetos.set(nombre, {
        obj, zona: Array.isArray(zona) ? zona : [zona], soloGiroY,
        inicial: { p: obj.position.clone(), q: obj.quaternion.clone() },
      });
    },
    // Aplica lo guardado en localStorage.
    cargar() {
      const datos = leerLocal(CLAVE, {});
      for (const [nombre, o] of objetos) {
        const d = datos[nombre];
        if (!d || !Array.isArray(d.p) || !Array.isArray(d.q)) continue;
        if (d.p.concat(d.q).some((v) => !Number.isFinite(v))) continue;
        o.obj.position.fromArray(d.p);
        o.obj.quaternion.fromArray(d.q);
      }
    },
    guardar() {
      const datos = {};
      for (const [nombre, o] of objetos) {
        datos[nombre] = { p: o.obj.position.toArray(), q: o.obj.quaternion.toArray() };
      }
      escribirLocal(CLAVE, datos);
    },
    restablecer() {
      for (const o of objetos.values()) {
        o.obj.position.copy(o.inicial.p);
        o.obj.quaternion.copy(o.inicial.q);
      }
      escribirLocal(CLAVE, {});
    },
    // Busca qué objeto toca el rayo. Devuelve { nombre, o, distancia } o null.
    buscar(raycaster) {
      let mejor = null;
      for (const [nombre, o] of objetos) {
        if (!o.obj.visible) continue;
        const hit = raycaster.intersectObjects(o.zona, true)[0];
        if (hit && (!mejor || hit.distance < mejor.distancia)) mejor = { nombre, o, distancia: hit.distance };
      }
      return mejor;
    },
  };
  return disp;
}

// Ayudante para arrastrar: mantiene la pose relativa al control.
const mInv = new THREE.Matrix4();
const m = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const esc = new THREE.Vector3();
const euler = new THREE.Euler();

export function iniciarArrastre(controlMatrixWorld, obj) {
  obj.updateMatrixWorld(true);
  mInv.copy(controlMatrixWorld).invert();
  return new THREE.Matrix4().multiplyMatrices(mInv, obj.matrixWorld);
}

export function aplicarArrastre(controlMatrixWorld, relativa, obj, soloGiroY) {
  m.multiplyMatrices(controlMatrixWorld, relativa);
  m.decompose(pos, quat, esc);
  obj.position.copy(pos);
  if (soloGiroY) {
    euler.setFromQuaternion(quat, 'YXZ');
    obj.rotation.set(0, euler.y, 0);
  } else {
    obj.quaternion.copy(quat);
  }
}
