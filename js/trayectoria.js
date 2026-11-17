// Vista de la trayectoria: el camino que recorrerá la punta con el programa
// actual (línea celeste con un punto por cada punto del programa) y el rastro
// que la punta va dejando (línea naranja). Ambos cuelgan de la base del brazo,
// así que siguen al brazo si lo mueves.
import * as THREE from 'three';

const MAX_RASTRO = 900;

export function crearVistaTrayectoria({ brazo, app }) {
  const grupo = new THREE.Group();
  grupo.name = 'trayectoria';
  brazo.raiz.add(grupo);

  const matCamino = new THREE.LineBasicMaterial({ color: 0x3fa9f5, transparent: true, opacity: 0.85 });
  const matPuntos = new THREE.PointsMaterial({ color: 0xffffff, size: 0.012, sizeAttenuation: true });
  let camino = null;
  let marcas = null;

  // Rastro: búfer circular de posiciones de la punta.
  const posRastro = new Float32Array(MAX_RASTRO * 3);
  const geomRastro = new THREE.BufferGeometry();
  geomRastro.setAttribute('position', new THREE.BufferAttribute(posRastro, 3));
  geomRastro.setDrawRange(0, 0);
  const rastro = new THREE.Line(geomRastro, new THREE.LineBasicMaterial({ color: 0xff9a3c }));
  rastro.frustumCulled = false;
  rastro.visible = false;
  grupo.add(rastro);
  let nRastro = 0;
  const ultimo = new THREE.Vector3(Infinity, 0, 0);
  const p = new THREE.Vector3();

  let verCamino = true;
  let verRastro = false;

  function limpiarCamino() {
    for (const o of [camino, marcas]) {
      if (!o) continue;
      grupo.remove(o);
      o.geometry.dispose();
    }
    camino = null;
    marcas = null;
  }

  function reconstruir() {
    limpiarCamino();
    const puntos = app.programa.puntos;
    if (!verCamino || !puntos.length) return;
    const cin = app.cinematica;
    const linea = [];
    const centros = [];
    let previo = null;
    for (const pt of puntos) {
      const fin = cin.fk(pt.angulos).clone();
      centros.push(fin);
      if (previo && pt.tipo !== 'lineal') {
        // Tramo articular: la punta hace una curva; se muestrea.
        const pasos = pt.tiempo ? 2 : 12;
        for (let k = 1; k < pasos; k++) {
          const s = k / pasos;
          linea.push(cin.fk(previo.map((v, j) => v + (pt.angulos[j] - v) * s)).clone());
        }
      }
      linea.push(fin);
      previo = pt.angulos;
    }
    if (linea.length > 1) {
      camino = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linea), matCamino);
      camino.frustumCulled = false;
      grupo.add(camino);
    }
    marcas = new THREE.Points(new THREE.BufferGeometry().setFromPoints(centros), matPuntos);
    marcas.frustumCulled = false;
    grupo.add(marcas);
  }

  app.alCambiar((t) => { if (t === 'programa' || t === 'todo') reconstruir(); });
  reconstruir();

  return {
    get verCamino() { return verCamino; },
    get verRastro() { return verRastro; },
    alternarCamino() {
      verCamino = !verCamino;
      reconstruir();
    },
    alternarRastro() {
      verRastro = !verRastro;
      rastro.visible = verRastro;
      if (!verRastro) this.borrarRastro();
    },
    borrarRastro() {
      nRastro = 0;
      ultimo.set(Infinity, 0, 0);
      geomRastro.setDrawRange(0, 0);
    },
    reconstruir,
    // Cada cuadro: agrega la posición de la punta al rastro si se movió.
    actualizar() {
      if (!verRastro) return;
      brazo.efector.getWorldPosition(p);
      brazo.raiz.worldToLocal(p);
      if (p.distanceToSquared(ultimo) < 0.002 * 0.002) return;
      ultimo.copy(p);
      if (nRastro === MAX_RASTRO) {
        posRastro.copyWithin(0, 3); // descarta el más antiguo
        nRastro--;
      }
      posRastro.set([p.x, p.y, p.z], nRastro * 3);
      nRastro++;
      geomRastro.attributes.position.needsUpdate = true;
      geomRastro.setDrawRange(0, nRastro);
    },
  };
}
