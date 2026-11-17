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
  const reproductor = new Reproductor(controlador);
  const cadenaIK = crearCadena(config);
  const oyentes = new Set();

  const app = {
    config,
    controlador,
    reproductor,
    brazoVisual,
    programa: almacen.cargarActual(config) || nuevoPrograma('Programa 1', config),
    bucle: false,
    seleccion: 0,
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

    // --- Movimiento manual -------------------------------------------------
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
      app.informar('Volviendo a la pose de inicio');
    },
    detenerTodo() {
      reproductor.detener();
      controlador.congelar();
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
      const local = brazoVisual.raiz.worldToLocal(puntoMundo.clone());
      const r = resolverIK(cadenaIK, config, controlador.objetivo, local);
      app.errorIK = r.error;
      controlador.fijarObjetivos(r.angulos);
    },
    terminarArrastreEfector() {
      app.objetivoIK = null;
    },

    // --- Programa ----------------------------------------------------------
    guardarCambios() {
      almacen.guardarActual(app.programa);
      app.avisar('programa');
    },
    grabarPunto() {
      app.programa.puntos.push(nuevoPunto(controlador.objetivo));
      app.guardarCambios();
      app.informar(`Punto P${app.programa.puntos.length} grabado`);
    },
    reemplazarPunto(i) {
      const p = app.programa.puntos[i];
      if (!p) return;
      p.angulos = nuevoPunto(controlador.objetivo).angulos;
      app.guardarCambios();
      app.informar(`P${i + 1} reemplazado por la pose actual`);
    },
    borrarPunto(i) {
      reproductor.detener();
      app.programa.puntos.splice(i, 1);
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
      app.guardarCambios();
    },
    irAPunto(i) {
      const p = app.programa.puntos[i];
      if (!p) return;
      reproductor.iniciar({ puntos: [p] }, { bucle: false });
      app.informar(`Yendo a P${i + 1}`);
    },
    reproducir(desde = 0) {
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
  controlador.alEnviar = (angulos) => app.driver?.enviarAngulos(angulos);

  return app;
}
