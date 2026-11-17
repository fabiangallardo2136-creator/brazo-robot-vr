// Estado central de la aplicación y acciones que comparten la interfaz de
// escritorio y el panel de VR.
import * as THREE from 'three';
import { Controlador } from './controlador.js';
import { Reproductor, nuevoPrograma, nuevoPunto, normalizarPrograma, almacen } from './programa.js';
import { crearCadena } from './brazo.js';
import { resolverIK } from './ik.js';
import { crearDriver } from './drivers/index.js';

export function crearApp(config, brazoVisual) {
  const controlador = new Controlador(config);
  const cadenaIK = crearCadena(config);
  const pFK = new THREE.Vector3();

  // Cinemática directa e inversa en coordenadas de la base del brazo.
  const cinematica = {
    fk(angulos) {
      cadenaIK.fijarAngulos(angulos);
      return cadenaIK.efector.getWorldPosition(pFK);
    },
    ik(semilla, objetivoLocal, opciones) {
      return resolverIK(cadenaIK, config, semilla, objetivoLocal, opciones).angulos;
    },
    // Punta en objetivoLocal con la herramienta apuntando hacia abajo.
    // Supone un brazo como el de config-brazo.js: J2, J3 y J5 giran en ejes
    // paralelos, así que la herramienta queda vertical si J2 + J3 + J5 = 180°.
    vertical(semilla, objetivoLocal) {
      const lim = (i, v) => Math.min(config.articulaciones[i].max, Math.max(config.articulaciones[i].min, v));
      let ang = semilla.slice();
      ang[3] = 0;
      const pesos = [1, 1, 1, 0, 0, 0];
      for (let k = 0; k < 8; k++) {
        ang[4] = lim(4, 180 - ang[1] - ang[2]);
        ang = resolverIK(cadenaIK, config, ang, objetivoLocal, { iteraciones: 25, pesos }).angulos;
      }
      ang[4] = lim(4, 180 - ang[1] - ang[2]);
      const error = cinematica.fk(ang).distanceTo(objetivoLocal);
      return { angulos: ang, error };
    },
  };

  const reproductor = new Reproductor(controlador, config, cinematica);
  const oyentes = new Set();
  const pz = config.herramienta.pinza;

  const app = {
    config,
    controlador,
    reproductor,
    brazoVisual,
    cinematica,
    programa: almacen.cargarActual(config) || nuevoPrograma('Programa 1', config),
    bucle: false,
    seleccion: 0,
    modoMando: 'articular',      // 'articular' | 'cartesiano' (deslizadores del panel VR)
    tipoGrabacion: 'articular',  // tipo de movimiento de los puntos nuevos
    puntoSel: -1,                // punto elegido para editar en el panel VR
    grabandoTrayectoria: false,  // grabación continua de movimientos
    objetivoIK: null,  // THREE.Vector3 (mundo) mientras se arrastra el efector
    errorIK: 0,
    driver: null,
    estadoDriver: '',
    mensaje: '',

    alCambiar(fn) {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
    avisar(tipo = 'todo') {
      for (const fn of oyentes) fn(tipo);
    },
    informar(texto) {
      app.mensaje = texto;
      console.info('[brazo]', texto);
      app.avisar('mensaje');
    },

    // --- Movimiento manual por articulación --------------------------------
    moverArticulacion(i, grados) {
      reproductor.detener();
      controlador.fijarObjetivo(i, grados);
    },
    sumarArticulacion(i, delta) {
      app.moverArticulacion(i, controlador.objetivo[i] + delta);
    },
    seleccionar(i) {
      app.seleccion = Math.max(0, Math.min(config.articulaciones.length - 1, i));
      brazoVisual.resaltarMotor(app.seleccion);
      app.avisar('seleccion');
    },
    fijarVelocidad(fraccion) {
      controlador.velocidad = Math.max(0.1, Math.min(1, fraccion));
    },
    irAInicio() {
      reproductor.detener();
      controlador.fijarObjetivos(config.articulaciones.map((a) => a.inicial ?? 0));
      controlador.fijarPinza(pz.inicial);
      app.informar('Volviendo a la pose de inicio');
    },
    detenerTodo() {
      reproductor.detener();
      controlador.congelar();
    },
    alternarModoMando() {
      app.modoMando = app.modoMando === 'articular' ? 'cartesiano' : 'articular';
      app.avisar('modo');
    },

    // --- Pinza --------------------------------------------------------------
    fijarPinzaMM(mm) {
      reproductor.detener();
      controlador.fijarPinza(mm / 1000);
    },
    alternarPinza() {
      const abierta = controlador.pinzaObjetivo > (pz.aperturaMin + pz.aperturaMax) / 2;
      app.fijarPinzaMM((abierta ? pz.aperturaMin : pz.aperturaMax) * 1000);
      app.informar(abierta ? 'Cerrando pinza' : 'Abriendo pinza');
    },
    sumarPinzaMM(delta) {
      reproductor.detener();
      controlador.fijarPinza(controlador.pinzaObjetivo + delta / 1000);
    },
    pinzaAbierta() {
      return controlador.pinzaObjetivo > (pz.aperturaMin + pz.aperturaMax) / 2;
    },

    // --- Cartesiano: posición de la punta en mm desde la base --------------
    // Posición objetivo de la punta (mm, coordenadas de la base del brazo).
    puntaObjetivoMM() {
      return cinematica.fk(controlador.objetivo).clone().multiplyScalar(1000);
    },
    puntaRealMM() {
      return cinematica.fk(controlador.actual).clone().multiplyScalar(1000);
    },
    moverPuntaLocal(local, iteraciones = 15) {
      const r = resolverIK(cadenaIK, config, controlador.objetivo, local, { iteraciones });
      app.errorIK = r.error;
      controlador.fijarObjetivos(r.angulos);
      return r;
    },
    // eje: 'x' | 'y' | 'z'; mm: nuevo valor
    moverPuntaEje(eje, mm) {
      reproductor.detener();
      const p = app.puntaObjetivoMM().multiplyScalar(0.001);
      p[eje] = mm / 1000;
      app.moverPuntaLocal(p, 40);
    },
    sumarPuntaEje(eje, deltaMM) {
      reproductor.detener();
      const p = app.puntaObjetivoMM().multiplyScalar(0.001);
      p[eje] += deltaMM / 1000;
      app.moverPuntaLocal(p, 40);
    },

    // --- Cinemática inversa (arrastrar el efector) -------------------------
    iniciarArrastreEfector() {
      reproductor.detener();
      app.objetivoIK = new THREE.Vector3();
      brazoVisual.efector.getWorldPosition(app.objetivoIK);
    },
    moverEfectorA(puntoMundo) {
      if (!app.objetivoIK) app.iniciarArrastreEfector();
      app.objetivoIK.copy(puntoMundo);
      brazoVisual.raiz.updateMatrixWorld(true);
      app.moverPuntaLocal(brazoVisual.raiz.worldToLocal(puntoMundo.clone()));
    },
    terminarArrastreEfector() {
      app.objetivoIK = null;
    },

    // --- Programa ----------------------------------------------------------
    guardarCambios() {
      almacen.guardarActual(app.programa);
      app.avisar('programa');
    },
    alternarTipoGrabacion() {
      app.tipoGrabacion = app.tipoGrabacion === 'articular' ? 'lineal' : 'articular';
      app.avisar('modo');
    },
    grabarPunto() {
      if (!app.programa.puntos.length && !app.programa.escena) app.capturarEscena(false);
      app.programa.puntos.push(nuevoPunto(controlador.objetivo, controlador.pinzaObjetivo, app.tipoGrabacion));
      app.guardarCambios();
      app.informar(`Punto P${app.programa.puntos.length} grabado (${app.tipoGrabacion})`);
    },
    reemplazarPunto(i) {
      const p = app.programa.puntos[i];
      if (!p) return;
      const n = nuevoPunto(controlador.objetivo, controlador.pinzaObjetivo);
      p.angulos = n.angulos;
      p.pinza = n.pinza;
      app.guardarCambios();
      app.informar(`P${i + 1} reemplazado por la pose actual`);
    },
    borrarPunto(i) {
      reproductor.detener();
      app.programa.puntos.splice(i, 1);
      if (app.puntoSel >= app.programa.puntos.length) app.puntoSel = app.programa.puntos.length - 1;
      app.guardarCambios();
      app.informar(`P${i + 1} borrado`);
    },
    borrarUltimo() {
      if (!app.programa.puntos.length) return app.informar('No hay puntos que borrar');
      app.borrarPunto(app.programa.puntos.length - 1);
    },
    moverPunto(i, d) {
      const pts = app.programa.puntos;
      const j = i + d;
      if (j < 0 || j >= pts.length) return;
      [pts[i], pts[j]] = [pts[j], pts[i]];
      app.guardarCambios();
    },
    editarPunto(i, campo, valor) {
      const p = app.programa.puntos[i];
      if (!p) return;
      if (campo === 'velocidad') p.velocidad = Math.min(100, Math.max(5, Number(valor) || 100));
      if (campo === 'pausa') p.pausa = Math.min(60, Math.max(0, Number(valor) || 0));
      if (campo === 'pinza') p.pinza = Math.min(pz.aperturaMax * 1000, Math.max(pz.aperturaMin * 1000, Number(valor) || 0));
      if (campo === 'tipo') p.tipo = valor === 'lineal' ? 'lineal' : 'articular';
      app.guardarCambios();
    },
    irAPunto(i) {
      const p = app.programa.puntos[i];
      if (!p) return;
      reproductor.iniciar({ puntos: [p] }, { bucle: false });
      app.informar(`Yendo a P${i + 1}`);
    },
    reproducir(desde = 0) {
      if (app.grabandoTrayectoria) app.alternarTrayectoria();
      if (desde === 0 && app.programa.escena && app.objetos && app.programa.puntos.length) {
        app.objetos.restaurar(app.programa.escena);
      }
      if (!reproductor.iniciar(app.programa, { bucle: app.bucle, desde })) {
        return app.informar('El programa no tiene puntos: graba alguno primero');
      }
      app.informar(`Reproduciendo "${app.programa.nombre}"`);
    },
    alternarReproduccion() {
      if (reproductor.activo) {
        reproductor.detener();
        app.informar('Reproducción detenida');
      } else app.reproducir();
    },
    alternarBucle() {
      app.bucle = !app.bucle;
      reproductor.bucle = app.bucle;
      app.avisar('programa');
    },
    renombrar(nombre) {
      app.programa.nombre = String(nombre).trim().slice(0, 60) || 'Sin nombre';
      app.guardarCambios();
    },

    // --- Selección y edición de puntos (panel VR) ---------------------------
    seleccionarPunto(i) {
      app.puntoSel = i >= 0 && i < app.programa.puntos.length ? i : -1;
      app.avisar('seleccionPunto');
    },
    alternarTipoPunto(i) {
      const p = app.programa.puntos[i];
      if (p) app.editarPunto(i, 'tipo', p.tipo === 'lineal' ? 'articular' : 'lineal');
    },
    insertarPuntoDespues(i) {
      const n = nuevoPunto(controlador.objetivo, controlador.pinzaObjetivo, app.tipoGrabacion);
      app.programa.puntos.splice(i + 1, 0, n);
      app.puntoSel = i + 1;
      app.guardarCambios();
      app.informar(`Punto insertado como P${i + 2}`);
    },

    // --- Grabación en tiempo real ---------------------------------------------
    // Al empezar se crea un programa nuevo ("Grabación N") y se anota la escena.
    // Cada 0,1 s que el brazo se haya movido (con la mano, las palancas o los
    // deslizadores) se guarda un punto con el tiempo transcurrido; al
    // reproducirlo se repite el movimiento con el mismo ritmo.
    alternarTrayectoria() {
      if (app.grabandoTrayectoria) {
        app.grabandoTrayectoria = false;
        // Último punto: donde quedó el brazo.
        app._tomarMuestra();
        if (app.programa.puntos.length) almacen.guardar(app.programa);
        app.informar(`Grabación terminada: ${app.programa.puntos.length} puntos, guardada como "${app.programa.nombre}"`);
        app.avisar('archivos');
      } else {
        reproductor.detener();
        if (app.programa.puntos.length) almacen.guardar(app.programa); // no perder el programa anterior
        const existentes = new Set(almacen.listar());
        let n = 1;
        while (existentes.has(`Grabación ${n}`)) n++;
        app.programa = nuevoPrograma(`Grabación ${n}`, config);
        app.capturarEscena?.(false);
        app.grabandoTrayectoria = true;
        app._tMuestra = 0;
        app._ultimaMuestra = null;
        app._tomarMuestra();
        app.guardarCambios();
        app.informar('● Grabando: mueve el brazo (toma la punta); pulsa otra vez para terminar');
      }
      app.avisar('modo');
    },
    // Guarda un punto si el brazo o la pinza cambiaron desde el anterior.
    _tomarMuestra() {
      const ang = controlador.objetivo;
      const pinza = controlador.pinzaObjetivo;
      const u = app._ultimaMuestra;
      const cambio = !u || u.pinza !== pinza || ang.some((v, i) => Math.abs(v - u.ang[i]) > 0.3);
      if (!cambio) return false;
      const tiempo = u ? app._tMuestra : undefined;
      app.programa.puntos.push(nuevoPunto(ang, pinza, 'articular', tiempo));
      app._ultimaMuestra = { ang: ang.slice(), pinza };
      app._tMuestra = 0;
      return true;
    },
    actualizarGrabacion(dt) {
      if (!app.grabandoTrayectoria) return;
      app._tMuestra += dt;
      if (app._tMuestra < 0.1) return;
      if (app._tomarMuestra()) app.guardarCambios();
      // Quieto: el tiempo sigue corriendo para respetar las pausas (máx. 5 s).
      else app._tMuestra = Math.min(app._tMuestra, 5);
    },

    // --- Escena del programa (objetos al empezar) ---------------------------
    capturarEscena(avisar = true) {
      if (!app.objetos) return;
      app.programa.escena = app.objetos.capturar();
      almacen.guardarActual(app.programa);
      if (avisar) app.informar(`Escena inicial guardada en el programa (${app.programa.escena.length} objetos)`);
    },
    restaurarEscena() {
      if (!app.objetos || !app.programa.escena) return app.informar('Este programa no tiene escena guardada');
      app.objetos.restaurar(app.programa.escena);
      app.informar('Escena del programa restaurada');
    },
    quitarEscena() {
      delete app.programa.escena;
      app.guardarCambios();
      app.informar('El programa ya no restaura objetos');
    },
    // Reemplaza el programa actual (guardando antes el anterior si tenía puntos).
    reemplazarPrograma(datos) {
      reproductor.detener();
      if (app.programa.puntos.length) almacen.guardar(app.programa);
      app.programa = normalizarPrograma(datos, config);
      app.puntoSel = -1;
      app.guardarCambios();
      app.avisar('archivos');
    },

    // --- Archivos ----------------------------------------------------------
    nuevo() {
      reproductor.detener();
      let n = 1;
      const existentes = new Set(almacen.listar());
      while (existentes.has(`Programa ${n}`)) n++;
      app.programa = nuevoPrograma(`Programa ${n}`, config);
      app.guardarCambios();
      app.informar('Programa nuevo');
    },
    guardar() {
      if (almacen.guardar(app.programa)) app.informar(`"${app.programa.nombre}" guardado en este navegador`);
      else app.informar('No se pudo guardar (¿almacenamiento bloqueado?)');
      app.avisar('archivos');
    },
    guardarComoNuevo() {
      let n = 1;
      const existentes = new Set(almacen.listar());
      const base = app.programa.nombre.replace(/ \(\d+\)$/, '');
      while (existentes.has(`${base} (${n})`)) n++;
      app.programa.nombre = `${base} (${n})`;
      app.guardarCambios();
      app.guardar();
    },
    async cargarDesdeURL(url) {
      try {
        const r = await fetch(new URL(url, location.href));
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        app.importar(await r.text());
      } catch (e) {
        app.informar(`No se pudo cargar ${url}: ${e.message}`);
      }
    },
    cargar(nombre) {
      const p = almacen.cargar(nombre, config);
      if (!p) return app.informar(`No encontré "${nombre}"`);
      reproductor.detener();
      app.programa = p;
      app.guardarCambios();
      app.informar(`"${nombre}" cargado (${p.puntos.length} puntos)`);
    },
    borrarGuardado(nombre) {
      almacen.borrar(nombre);
      app.avisar('archivos');
      app.informar(`"${nombre}" borrado del navegador`);
    },
    importar(texto) {
      try {
        const p = normalizarPrograma(JSON.parse(texto), config);
        reproductor.detener();
        app.programa = p;
        app.guardarCambios();
        app.informar(`Importado "${p.nombre}" (${p.puntos.length} puntos)`);
      } catch (e) {
        app.informar(`No se pudo importar: ${e.message}`);
      }
    },

    // --- Driver ------------------------------------------------------------
    async usarDriver(id) {
      try {
        await app.driver?.desconectar();
      } catch { /* nada */ }
      const d = crearDriver(id, config);
      d.alCambiarEstado = (t) => {
        app.estadoDriver = t;
        app.avisar('driver');
      };
      app.driver = d;
      app.driverId = id;
      try {
        await d.conectar();
      } catch (e) {
        app.estadoDriver = e.message;
        app.informar(e.message);
      }
      app.avisar('driver');
    },
  };

  reproductor.alCambiar = () => app.avisar('reproduccion');
  controlador.alEnviar = (angulos, pinza) => app.driver?.enviarAngulos(angulos, pinza);

  return app;
}
