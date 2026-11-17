// Cubos que la pinza puede tomar y soltar. Física mínima: al soltarlos caen
// en línea recta hasta la mesa (si están sobre ella) o hasta el piso.
import * as THREE from 'three';

const LADO = 0.04;

export function crearManipulacion({ contenedor, brazo, cubos, mesa }) {
  const iniciales = cubos.map((c) => ({ pos: c.position.clone(), quat: c.quaternion.clone() }));
  const centroAgarre = new THREE.Vector3(0, -0.015, 0); // un poco detrás de la punta
  const pAgarre = new THREE.Vector3();
  const pCubo = new THREE.Vector3();
  let sujeto = null;
  const cayendo = new Map(); // cubo → velocidad vertical
  let aperturaAnterior = Infinity;

  function alturaApoyo(cubo) {
    cubo.getWorldPosition(pCubo);
    const sobreMesa = mesa.visible
      && Math.abs(pCubo.x - mesa.centro.x) < mesa.ancho / 2
      && Math.abs(pCubo.z - mesa.centro.z) < mesa.fondo / 2;
    return (sobreMesa ? mesa.altura : 0) + LADO / 2;
  }

  return {
    get sujeto() {
      return sujeto;
    },
    // Apertura visible de la pinza: no puede cerrarse más que el cubo que sujeta.
    aperturaVisible(apertura) {
      return sujeto ? Math.max(apertura, LADO) : apertura;
    },
    actualizar(dt, apertura) {
      if (!sujeto && apertura < aperturaAnterior && apertura <= LADO + 0.002 && apertura > LADO - 0.01) {
        // Cerrando justo al ancho de un cubo: ¿hay alguno entre los dedos?
        brazo.efector.localToWorld(pAgarre.copy(centroAgarre));
        const cubo = cubos.find((c) => contenedor.visible && c.getWorldPosition(pCubo).distanceTo(pAgarre) < 0.022);
        if (cubo) {
          cayendo.delete(cubo);
          brazo.efector.attach(cubo);
          sujeto = cubo;
        }
      } else if (sujeto && apertura > LADO + 0.004) {
        contenedor.attach(sujeto);
        cayendo.set(sujeto, 0);
        sujeto = null;
      }
      aperturaAnterior = apertura;

      for (const [cubo, v] of cayendo) {
        const piso = alturaApoyo(cubo);
        const nv = v - 9.8 * dt;
        cubo.position.y += nv * dt;
        if (cubo.position.y <= piso) {
          cubo.position.y = piso;
          // Queda apoyado derecho, conservando solo el giro horizontal.
          const e = new THREE.Euler().setFromQuaternion(cubo.quaternion, 'YXZ');
          cubo.rotation.set(0, e.y, 0);
          cayendo.delete(cubo);
        } else cayendo.set(cubo, nv);
      }
    },
    reiniciar() {
      if (sujeto) contenedor.attach(sujeto);
      sujeto = null;
      cayendo.clear();
      cubos.forEach((c, i) => {
        c.position.copy(iniciales[i].pos);
        c.quaternion.copy(iniciales[i].quat);
      });
    },
  };
}
