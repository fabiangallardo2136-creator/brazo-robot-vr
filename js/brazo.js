// Construye la cadena cinemática (y opcionalmente las mallas) a partir de la
// configuración. La misma función sirve para el brazo visible y para la copia
// invisible que usa la cinemática inversa.
import * as THREE from 'three';

const EJES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const Y = new THREE.Vector3(0, 1, 0);

export function vectorEje(eje) {
  const v = Array.isArray(eje) ? eje : EJES[eje];
  if (!v) throw new Error(`Eje desconocido: ${eje}`);
  return new THREE.Vector3(...v).normalize();
}

// Cadena sin mallas: raíz → (marco fijo → junta que gira) × N → efector.
export function crearCadena(config) {
  const raiz = new THREE.Group();
  raiz.name = 'raizBrazo';
  const juntas = [];
  let padre = raiz;
  config.articulaciones.forEach((a, i) => {
    const marco = new THREE.Group();
    marco.position.fromArray(a.origen);
    padre.add(marco);
    const junta = new THREE.Group();
    junta.name = a.id;
    junta.userData = { eje: vectorEje(a.eje), indice: i };
    marco.add(junta);
    juntas.push(junta);
    padre = junta;
  });
  const efector = new THREE.Group();
  efector.name = 'efector';
  efector.position.fromArray(config.herramienta.origen);
  padre.add(efector);

  function fijarAngulos(grados) {
    juntas.forEach((j, i) => {
      j.quaternion.setFromAxisAngle(j.userData.eje, THREE.MathUtils.degToRad(grados[i] ?? 0));
    });
    raiz.updateMatrixWorld(true);
  }

  return { raiz, juntas, efector, fijarAngulos };
}

// Cilindro que une el origen local con el punto p.
function eslabon(p, radio, material) {
  const largo = p.length();
  if (largo < 1e-4) return null;
  const malla = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, largo, 20), material);
  malla.position.copy(p).multiplyScalar(0.5);
  malla.quaternion.setFromUnitVectors(Y, p.clone().normalize());
  return malla;
}

// Brazo visible: cadena + mallas + asa del efector para agarrarlo.
export function crearBrazoVisual(config) {
  const cadena = crearCadena(config);
  const c = config.colores;
  const matEslabon = new THREE.MeshStandardMaterial({ color: c.eslabon, roughness: 0.45, metalness: 0.1 });
  const matBase = new THREE.MeshStandardMaterial({ color: c.base, roughness: 0.6, metalness: 0.3 });
  const matPinza = new THREE.MeshStandardMaterial({ color: c.pinza, roughness: 0.35, metalness: 0.6 });

  // Pedestal
  const b = config.base;
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(b.radio, b.radio * 1.15, b.altura, 32), matBase);
  pedestal.position.y = b.altura / 2;
  cadena.raiz.add(pedestal);

  // Motores y eslabones
  const motores = [];
  cadena.juntas.forEach((junta, i) => {
    const eje = junta.userData.eje;
    const matMotor = new THREE.MeshStandardMaterial({ color: c.motor, roughness: 0.5, metalness: 0.4 });
    const radio = i < 3 ? 0.032 : 0.024;
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, radio * 2.1, 24), matMotor);
    motor.quaternion.setFromUnitVectors(Y, eje);
    junta.add(motor);
    motores.push(motor);

    const siguiente = config.articulaciones[i + 1]?.origen ?? config.herramienta.origen;
    const p = new THREE.Vector3().fromArray(siguiente);
    // Para la herramienta, el eslabón llega hasta la base de la pinza.
    if (i === cadena.juntas.length - 1) p.multiplyScalar(0.45);
    const e = eslabon(p, i < 3 ? 0.022 : 0.016, matEslabon);
    if (e) junta.add(e);
  });

  // Pinza simple en el último eslabón
  const ultima = cadena.juntas[cadena.juntas.length - 1];
  const largoH = new THREE.Vector3().fromArray(config.herramienta.origen).length();
  const soporte = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.025), matPinza);
  soporte.position.set(0, largoH * 0.45, 0);
  ultima.add(soporte);
  for (const lado of [-1, 1]) {
    const dedo = new THREE.Mesh(new THREE.BoxGeometry(0.008, largoH * 0.55, 0.02), matPinza);
    dedo.position.set(lado * 0.022, largoH * 0.45 + largoH * 0.275, 0);
    ultima.add(dedo);
  }

  // Asa del efector: esfera visible y zona de agarre invisible más grande.
  const matAsa = new THREE.MeshStandardMaterial({
    color: 0xffb347, emissive: 0x552200, transparent: true, opacity: 0.55, roughness: 0.3,
  });
  const asa = new THREE.Mesh(new THREE.SphereGeometry(0.018, 24, 16), matAsa);
  cadena.efector.add(asa);
  const zonaAgarre = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  cadena.efector.add(zonaAgarre);

  function resaltarMotor(indice) {
    motores.forEach((m, i) => {
      m.material.emissive.setHex(i === indice ? c.seleccion : 0x000000);
      m.material.emissiveIntensity = i === indice ? 0.6 : 0;
    });
  }

  function resaltarAsa(activo) {
    matAsa.opacity = activo ? 0.9 : 0.55;
    matAsa.emissive.setHex(activo ? 0xaa5500 : 0x552200);
  }

  return { ...cadena, asa, zonaAgarre, resaltarMotor, resaltarAsa };
}
