// Cinemática inversa por CCD (Cyclic Coordinate Descent), solo posición.
// Recorre las articulaciones desde la muñeca hacia la base y gira cada una lo
// necesario para acercar el efector al objetivo, respetando los límites.
import * as THREE from 'three';

const pj = new THREE.Vector3();
const pe = new THREE.Vector3();
const eje = new THREE.Vector3();
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const cruz = new THREE.Vector3();
const q = new THREE.Quaternion();

/**
 * @param cadena   cadena creada con crearCadena (sin mallas), raíz en el origen.
 * @param config   configuración del brazo (límites).
 * @param inicio   ángulos de partida en grados (normalmente el objetivo actual).
 * @param objetivo punto objetivo en coordenadas de la raíz del brazo.
 * @returns {{angulos: number[], error: number}} error en metros.
 */
export function resolverIK(cadena, config, inicio, objetivo, { iteraciones = 15, tolerancia = 0.001 } = {}) {
  const ang = inicio.slice();
  const art = config.articulaciones;
  const { juntas, efector } = cadena;
  cadena.fijarAngulos(ang);

  for (let it = 0; it < iteraciones; it++) {
    for (let i = juntas.length - 1; i >= 0; i--) {
      const peso = art[i].pesoIK ?? 1;
      if (peso <= 0) continue;
      const junta = juntas[i];
      junta.getWorldPosition(pj);
      efector.getWorldPosition(pe);
      junta.parent.getWorldQuaternion(q);
      eje.copy(junta.userData.eje).applyQuaternion(q);

      // Proyectar ambos vectores sobre el plano perpendicular al eje.
      a.subVectors(pe, pj);
      b.subVectors(objetivo, pj);
      a.addScaledVector(eje, -a.dot(eje));
      b.addScaledVector(eje, -b.dot(eje));
      if (a.lengthSq() < 1e-10 || b.lengthSq() < 1e-10) continue;
      a.normalize();
      b.normalize();
      const delta = Math.atan2(eje.dot(cruz.crossVectors(a, b)), a.dot(b));

      const nuevo = THREE.MathUtils.clamp(ang[i] + THREE.MathUtils.radToDeg(delta) * peso, art[i].min, art[i].max);
      if (nuevo === ang[i]) continue;
      ang[i] = nuevo;
      junta.quaternion.setFromAxisAngle(junta.userData.eje, THREE.MathUtils.degToRad(nuevo));
      junta.updateMatrixWorld(true);
    }
    efector.getWorldPosition(pe);
    if (pe.distanceTo(objetivo) < tolerancia) break;
  }
  efector.getWorldPosition(pe);
  return { angulos: ang, error: pe.distanceTo(objetivo) };
}
