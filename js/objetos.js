// Objetos para manipular: cubos, cilindros, pelotas, bandejas y manchas.
//
// - La pinza toma un objeto "tomable" cuando se cierra a su ancho con el
//   objeto entre los dedos, y lo suelta al abrirse.
// - En VR también se pueden mover con la mano (grip).
// - Física mínima: al soltarlos caen en vertical hasta apoyarse en la mesa
//   virtual, en el plano donde está parado el brazo, sobre otro objeto o en
//   el piso.
// - Las manchas se "limpian" al pasar la punta de la pinza sobre ellas.
import * as THREE from 'three';

const COLORES = [0x3fa9f5, 0x6cc070, 0xf2c14e, 0xe0605a, 0xa57be0, 0x4fd1c5];

function material(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });
}

export const CATALOGO = {
  cubo: {
    nombre: 'Cubo', ancho: 0.04, alto: 0.04, radio: 0.02, tomable: true,
    crear: (color) => new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), material(color)),
  },
  cilindro: {
    nombre: 'Cilindro', ancho: 0.036, alto: 0.07, radio: 0.018, tomable: true,
    crear: (color) => new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 24), material(color)),
  },
  pelota: {
    nombre: 'Pelota', ancho: 0.044, alto: 0.044, radio: 0.022, tomable: true,
    crear: (color) => new THREE.Mesh(new THREE.SphereGeometry(0.022, 24, 16), material(color, { roughness: 0.3 })),
  },
  bandeja: {
    nombre: 'Bandeja', ancho: 0.16, alto: 0.025, radio: 0.08, tomable: false, apoyo: 0.006,
    crear: () => {
      const g = new THREE.Group();
      const m = material(0x5b6370, { metalness: 0.3 });
      const fondo = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.12), m);
      fondo.position.y = -0.0095;
      g.add(fondo);
      for (const [w, d, x, z] of [[0.16, 0.006, 0, 0.057], [0.16, 0.006, 0, -0.057], [0.006, 0.12, 0.077, 0], [0.006, 0.12, -0.077, 0]]) {
        const borde = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), m);
        borde.position.set(x, 0, z);
        g.add(borde);
      }
      return g;
    },
  },
  mancha: {
    nombre: 'Mancha', ancho: 0.05, alto: 0.002, radio: 0.025, tomable: false, plana: true,
    crear: () => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(0.022 + Math.random() * 0.01, 20),
        new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 1, transparent: true, opacity: 0.85 }),
      );
      m.rotation.x = -Math.PI / 2;
      return m;
    },
  },
};

export function crearObjetos({ escena, brazo, mesa }) {
  const grupo = new THREE.Group();
  grupo.name = 'objetos';
  escena.add(grupo);

  const lista = []; // { malla, tipo, def, estado, vy, limpieza }
  const centroAgarre = new THREE.Vector3(0, -0.015, 0); // un poco detrás de la punta
  const pAgarre = new THREE.Vector3();
  const pTmp = new THREE.Vector3();
  const pBase = new THREE.Vector3();
  let sujeto = null;
  let aperturaAnterior = Infinity;
  let nColor = 0;
  const manchas = { total: 0, limpias: 0 };

  // Altura de apoyo bajo el punto (x, z) para un objeto cuya base está en yBase.
  function superficie(x, z, obj, yBase = Infinity) {
    let y = 0;
    if (mesa.visible && Math.abs(x - mesa.centro.x) < mesa.ancho / 2 && Math.abs(z - mesa.centro.z) < mesa.fondo / 2) {
      y = mesa.altura;
    }
    // El plano donde está parado el brazo (sirve en modo mixto, sobre una mesa real).
    brazo.raiz.getWorldPosition(pBase);
    if (Math.hypot(x - pBase.x, z - pBase.z) < 0.5) y = Math.max(y, pBase.y);
    if (obj?.def.plana) return y;
    for (const o of lista) {
      if (o === obj || o.estado !== 'reposo' || o.def.plana) continue;
      const p = o.malla.position;
      const r = o.def.radio + (obj ? obj.def.radio : 0) * 0.6;
      if (Math.abs(x - p.x) < r && Math.abs(z - p.z) < r) {
        const tope = o.def.apoyo !== undefined ? p.y - o.def.alto / 2 + o.def.apoyo : p.y + o.def.alto / 2;
        if (tope <= yBase + 0.005) y = Math.max(y, tope);
      }
    }
    return y;
  }

  // Lugar al alcance del brazo, delante de él.
  function lugarLibre(def) {
    for (let intento = 0; intento < 30; intento++) {
      const ang = THREE.MathUtils.degToRad(-75 + Math.random() * 150);
      const r = 0.16 + Math.random() * 0.12;
      const p = brazo.raiz.localToWorld(new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r));
      const ocupado = lista.some((o) => !o.def.plana && o.malla.position.distanceTo(p) < o.def.radio + def.radio + 0.02
        && Math.abs(o.malla.position.y - p.y) < 0.2);
      if (!ocupado || intento === 29) return p;
    }
    return brazo.raiz.localToWorld(new THREE.Vector3(0, 0, 0.2));
  }

  function agregar(tipo, posicion) {
    const def = CATALOGO[tipo];
    if (!def) throw new Error(`Objeto desconocido: ${tipo}`);
    const malla = def.crear(COLORES[nColor++ % COLORES.length]);
    malla.name = tipo;
    const p = posicion ? posicion.clone() : lugarLibre(def);
    const o = { malla, tipo, def, estado: 'cayendo', vy: 0 };
    lista.push(o);
    grupo.add(malla);
    if (def.plana) {
      malla.position.set(p.x, superficie(p.x, p.z, o) + 0.0015, p.z);
      o.estado = 'reposo';
      manchas.total++;
    } else {
      malla.position.set(p.x, (posicion ? p.y : superficie(p.x, p.z, o) + def.alto / 2 + 0.06), p.z);
      malla.rotation.y = Math.random() * Math.PI;
    }
    return o;
  }

  function quitar(o) {
    if (o === sujeto) sujeto = null;
    o.malla.removeFromParent();
    lista.splice(lista.indexOf(o), 1);
    if (o.def.plana) {
      manchas.total--;
      if (o.limpia) manchas.limpias--;
    }
  }

  const api = {
    grupo,
    lista,
    manchas,
    get sujeto() {
      return sujeto;
    },
    agregar,
    agregarManchas(n = 6) {
      for (let i = 0; i < n; i++) agregar('mancha');
    },
    quitarUltimo() {
      const o = [...lista].reverse().find((x) => x !== sujeto);
      if (o) quitar(o);
      return o;
    },
    quitarTodo() {
      if (sujeto) grupo.attach(sujeto.malla);
      sujeto = null;
      [...lista].forEach(quitar);
      manchas.total = 0;
      manchas.limpias = 0;
    },
    // Tres cubos en la mesa, como al abrir la app.
    reiniciar() {
      api.quitarTodo();
      const [bx, by, bz] = [mesa.centro.x, mesa.altura, mesa.centro.z];
      [[-0.2, 0.12], [0.2, 0.12], [0.0, 0.2]].forEach(([dx, dz]) => {
        const o = agregar('cubo', new THREE.Vector3(bx + dx, by + 0.02, bz + dz));
        o.estado = 'reposo';
        o.malla.rotation.y = 0;
      });
    },
    // Apertura visible de la pinza: no puede cerrarse más que el objeto que sujeta.
    aperturaVisible(apertura) {
      return sujeto ? Math.max(apertura, sujeto.def.ancho) : apertura;
    },
    // Para mover objetos con la mano en VR.
    buscar(raycaster) {
      const hit = raycaster.intersectObjects(lista.filter((o) => o !== sujeto).map((o) => o.malla), true)[0];
      if (!hit) return null;
      const o = lista.find((x) => x.malla === hit.object || x.malla.getObjectById(hit.object.id));
      return o ? { o, distancia: hit.distance } : null;
    },
    tomarConMano(o) {
      o.estado = 'mano';
    },
    soltarDeMano(o) {
      o.estado = o.def.plana ? 'reposo' : 'cayendo';
      o.vy = 0;
      if (o.def.plana) o.malla.position.y = superficie(o.malla.position.x, o.malla.position.z, o) + 0.0015;
    },

    actualizar(dt, apertura) {
      brazo.efector.localToWorld(pAgarre.copy(centroAgarre));

      // Tomar con la pinza: se está cerrando y pasa por el ancho de un objeto.
      if (!sujeto && apertura < aperturaAnterior) {
        const o = lista.find((x) => x.def.tomable && x.estado !== 'mano'
          && apertura <= x.def.ancho + 0.002 && aperturaAnterior > x.def.ancho - 0.006
          && x.malla.getWorldPosition(pTmp).distanceTo(pAgarre) < 0.025);
        if (o) {
          brazo.efector.attach(o.malla);
          o.estado = 'sujeto';
          sujeto = o;
        }
      } else if (sujeto && apertura > sujeto.def.ancho + 0.004) {
        grupo.attach(sujeto.malla);
        sujeto.estado = 'cayendo';
        sujeto.vy = 0;
        sujeto = null;
      }
      aperturaAnterior = apertura;

      for (const o of lista) {
        if (o.estado === 'cayendo') {
          const p = o.malla.position;
          const piso = superficie(p.x, p.z, o, p.y - o.def.alto / 2) + o.def.alto / 2;
          o.vy -= 9.8 * dt;
          p.y += o.vy * dt;
          if (p.y <= piso) {
            p.y = piso;
            const e = new THREE.Euler().setFromQuaternion(o.malla.quaternion, 'YXZ');
            if (o.tipo !== 'pelota') o.malla.rotation.set(0, e.y, 0);
            o.estado = 'reposo';
          }
        } else if (o.def.plana && !o.limpia) {
          // Limpieza: la punta pasa sobre la mancha, a menos de 4 cm de altura.
          const p = o.malla.position;
          const dy = pAgarre.y - p.y;
          if (Math.hypot(pAgarre.x - p.x, pAgarre.z - p.z) < 0.03 && dy > -0.02 && dy < 0.05) {
            o.limpia = true;
            manchas.limpias++;
          }
        } else if (o.limpia && o.malla.material.opacity > 0) {
          o.malla.material.opacity = Math.max(0, o.malla.material.opacity - dt * 3);
          if (o.malla.material.opacity === 0) o.malla.visible = false;
        }
      }
    },
  };
  return api;
}
