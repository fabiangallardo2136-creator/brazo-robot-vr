// Panel HTML lateral para escritorio y atajos de teclado.
import { almacen, TIPOS } from './programa.js';
import { exportarJSON } from './programa.js';
import { DRIVERS } from './drivers/index.js';

const h = (etiqueta, attrs = {}, ...hijos) => {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c != null) el.append(c);
  return el;
};

export function crearUIEscritorio(raiz, app, { alMostrarPanel3D }) {
  const art = app.config.articulaciones;
  const c = app.controlador;
  const r = app.reproductor;

  // ---------------------------------------------------------- Articulaciones
  const filas = art.map((a, i) => {
    const rango = h('input', {
      type: 'range', min: a.min, max: a.max, step: 1, value: c.objetivo[i],
      'aria-label': `${a.id} ${a.nombre}`,
      oninput: (e) => app.moverArticulacion(i, Number(e.target.value)),
      onfocus: () => app.seleccionar(i),
    });
    const numero = h('input', {
      type: 'number', min: a.min, max: a.max, step: 1, value: c.objetivo[i], class: 'num',
      onchange: (e) => app.moverArticulacion(i, Number(e.target.value)),
    });
    const real = h('span', { class: 'real' }, '0°');
    const fila = h('div', { class: 'articulacion', onclick: () => app.seleccionar(i) },
      h('div', { class: 'cabecera' },
        h('span', { class: 'id' }, a.id), h('span', { class: 'nombre' }, a.nombre),
        h('span', { class: 'limites' }, `${a.min}° … ${a.max}°`)),
      h('div', { class: 'control' }, rango, numero, real));
    return { fila, rango, numero, real };
  });

  const velocidad = h('input', {
    type: 'range', min: 10, max: 100, step: 5, value: Math.round(c.velocidad * 100),
    oninput: (e) => {
      app.fijarVelocidad(Number(e.target.value) / 100);
      velTexto.textContent = `${e.target.value} %`;
    },
  });
  const velTexto = h('span', { class: 'real' }, `${Math.round(c.velocidad * 100)} %`);
  app.alCambiar((t) => {
    if (t === 'velocidad') {
      velocidad.value = Math.round(c.velocidad * 100);
      velTexto.textContent = `${velocidad.value} %`;
    }
  });
  const posEfector = h('div', { class: 'dato' }, '');

  // Pinza
  const pz = app.config.herramienta.pinza;
  const pinzaRango = h('input', {
    type: 'range', min: pz.aperturaMin * 1000, max: pz.aperturaMax * 1000, step: 1, value: c.pinzaObjetivo * 1000,
    'aria-label': 'Apertura de la pinza',
    oninput: (e) => app.fijarPinzaMM(Number(e.target.value)),
  });
  const pinzaReal = h('span', { class: 'real' }, '');
  const botonPinza = h('button', { onclick: () => app.alternarPinza() }, 'Cerrar pinza (G)');

  // Mando cartesiano: posición de la punta en mm desde la base
  const ejesCart = ['x', 'y', 'z'].map((eje) => {
    const numero = h('input', {
      type: 'number', step: 5, class: 'num', 'aria-label': `Punta ${eje.toUpperCase()} en mm`,
      onchange: (e) => app.moverPuntaEje(eje, Number(e.target.value)),
    });
    const fila = h('div', { class: 'control' },
      h('span', { class: 'id' }, eje.toUpperCase()),
      h('button', { title: '−10 mm', onclick: () => app.sumarPuntaEje(eje, -10) }, '−10'),
      h('button', { title: '−1 mm', onclick: () => app.sumarPuntaEje(eje, -1) }, '−1'),
      numero,
      h('button', { title: '+1 mm', onclick: () => app.sumarPuntaEje(eje, 1) }, '+1'),
      h('button', { title: '+10 mm', onclick: () => app.sumarPuntaEje(eje, 10) }, '+10'));
    return { eje, numero, fila };
  });

  const secArticulaciones = h('section', {},
    h('h2', {}, 'Articulaciones'),
    ...filas.map((f) => f.fila),
    h('div', { class: 'articulacion' },
      h('div', { class: 'cabecera' }, h('span', { class: 'nombre' }, 'Velocidad (% de la máxima)')),
      h('div', { class: 'control' }, velocidad, velTexto)),
    h('div', { class: 'articulacion' },
      h('div', { class: 'cabecera' }, h('span', { class: 'id' }, 'Pinza'), h('span', { class: 'nombre' }, 'apertura en mm'),
        h('span', { class: 'limites' }, `${pz.aperturaMin * 1000} … ${pz.aperturaMax * 1000} mm`)),
      h('div', { class: 'control' }, pinzaRango, pinzaReal),
      h('div', { class: 'botones' }, botonPinza)),
    h('div', { class: 'subtitulo' }, 'Mover la punta en línea recta (cinemática inversa, mm desde la base)'),
    ...ejesCart.map((e) => e.fila),
    posEfector,
    h('div', { class: 'botones' },
      h('button', { onclick: () => app.irAInicio() }, 'Ir a inicio (H)'),
      h('button', { onclick: () => app.detenerTodo(), class: 'peligro' }, 'Detener (Esc)')),
  );

  // ---------------------------------------------------------------- Programa
  const nombre = h('input', {
    type: 'text', class: 'nombre-programa', value: app.programa.nombre, maxlength: 60,
    'aria-label': 'Nombre del programa',
    onchange: (e) => app.renombrar(e.target.value),
  });
  const lista = h('ol', { class: 'puntos' });
  const botonPlay = h('button', { class: 'primario', onclick: () => app.alternarReproduccion() }, '▶ Reproducir');
  const bucle = h('input', { type: 'checkbox', onchange: () => app.alternarBucle() });
  const verCamino = h('input', { type: 'checkbox', checked: true, onchange: () => app.trayectoria.alternarCamino() });
  const verRastro = h('input', { type: 'checkbox', onchange: () => app.trayectoria.alternarRastro() });
  const botonTrayectoria = h('button', { onclick: () => app.alternarTrayectoria() }, '● Grabar en tiempo real (T)');
  const tipoGrab = h('select', {
    'aria-label': 'Tipo de movimiento de los puntos nuevos',
    onchange: (e) => { if (e.target.value !== app.tipoGrabacion) app.alternarTipoGrabacion(); },
  }, ...Object.entries(TIPOS).map(([id, n]) => h('option', { value: id }, n)));

  function dibujarLista() {
    nombre.value = app.programa.nombre;
    lista.replaceChildren();
    if (!app.programa.puntos.length) {
      lista.append(h('li', { class: 'vacio' }, 'Sin puntos. Mueve el brazo y pulsa "Grabar punto".'));
    }
    app.programa.puntos.forEach((p, i) => {
      lista.append(h('li', { 'data-i': i },
        h('div', { class: 'p-cab' },
          h('strong', {}, `P${i + 1}`),
          h('span', { class: 'angulos' }, p.angulos.map((v) => Math.round(v)).join(' · ')
            + (p.tiempo ? ` · ${p.tiempo.toFixed(2)} s` : ''))),
        h('div', { class: 'p-ctl' },
          h('select', {
            class: 'chico', title: 'Tipo de movimiento hacia este punto',
            onchange: (e) => app.editarPunto(i, 'tipo', e.target.value),
          }, ...Object.entries(TIPOS).map(([id, n]) => h('option', { value: id, selected: p.tipo === id }, n))),
          h('label', {}, 'pinza ', h('input', {
            type: 'number', min: pz.aperturaMin * 1000, max: pz.aperturaMax * 1000, step: 1, value: p.pinza, class: 'num-chico',
            onchange: (e) => app.editarPunto(i, 'pinza', e.target.value),
          }), 'mm'),
          h('label', {}, 'vel ', h('input', {
            type: 'number', min: 5, max: 100, step: 5, value: p.velocidad, class: 'num-chico',
            onchange: (e) => app.editarPunto(i, 'velocidad', e.target.value),
          }), '%'),
          h('label', {}, 'pausa ', h('input', {
            type: 'number', min: 0, max: 60, step: 0.1, value: p.pausa, class: 'num-chico',
            onchange: (e) => app.editarPunto(i, 'pausa', e.target.value),
          }), 's'),
          h('span', { class: 'acciones' },
            h('button', { title: 'Ir a este punto', onclick: () => app.irAPunto(i) }, 'Ir'),
            h('button', { title: 'Reproducir desde aquí', onclick: () => app.reproducir(i) }, '▶'),
            h('button', { title: 'Reemplazar por la pose actual', onclick: () => app.reemplazarPunto(i) }, '⟳'),
            h('button', { title: 'Subir', onclick: () => app.moverPunto(i, -1), disabled: i === 0 }, '↑'),
            h('button', {
              title: 'Bajar', onclick: () => app.moverPunto(i, 1), disabled: i === app.programa.puntos.length - 1,
            }, '↓'),
            h('button', { title: 'Borrar', class: 'peligro', onclick: () => app.borrarPunto(i) }, '✕'))),
      ));
    });
    marcarActivo();
  }

  function marcarActivo() {
    const activo = r.activo && r.programa === app.programa ? r.indice : -1;
    for (const li of lista.children) li.classList.toggle('activo', Number(li.dataset.i) === activo);
    botonPlay.textContent = r.activo ? '■ Detener (Espacio)' : '▶ Reproducir (Espacio)';
    botonPlay.classList.toggle('peligro', r.activo);
    bucle.checked = app.bucle;
  }

  const secPrograma = h('section', {},
    h('h2', {}, 'Programa'),
    nombre,
    h('div', { class: 'botones' },
      h('button', { class: 'primario', onclick: () => app.grabarPunto() }, '● Grabar punto (R)'),
      botonPlay),
    h('div', { class: 'botones' }, botonTrayectoria),
    h('div', { class: 'subtitulo' }, 'Rutinas listas (reemplazan el programa; el anterior queda guardado)'),
    h('div', { class: 'botones' },
      h('button', { onclick: () => app.generarRutina('saludar') }, 'Saludar'),
      h('button', { onclick: () => app.generarRutina('batir') }, 'Batir crema'),
      h('button', { onclick: () => app.generarRutina('circulo') }, 'Dibujar círculo')),
    h('div', { class: 'botones' },
      h('label', { class: 'check' }, verCamino, ' Ver trayectoria'),
      h('label', { class: 'check' }, verRastro, ' Rastro de la punta')),
    h('div', { class: 'botones' },
      h('button', { onclick: () => app.capturarEscena(), title: 'Guarda la posición de los objetos en el programa' }, 'Fijar escena'),
      h('button', { onclick: () => app.restaurarEscena() }, 'Reponer objetos')),
    h('div', { class: 'botones' },
      h('span', { class: 'etiqueta-fuente' }, 'Grabar puntos como'), tipoGrab),
    h('label', { class: 'check' }, bucle, ' Repetir en bucle'),
    lista,
  );

  // ---------------------------------------------------------------- Archivos
  const selector = h('select', { 'aria-label': 'Programas guardados' });
  function dibujarArchivos() {
    const nombres = almacen.listar();
    selector.replaceChildren(...(nombres.length
      ? nombres.map((n) => h('option', { value: n }, n))
      : [h('option', { value: '' }, '(ninguno guardado)')]));
    if (nombres.includes(app.programa.nombre)) selector.value = app.programa.nombre;
  }
  const archivo = h('input', {
    type: 'file', accept: '.json,application/json', hidden: true,
    onchange: async (e) => {
      const f = e.target.files?.[0];
      if (f) app.importar(await f.text());
      e.target.value = '';
    },
  });
  const secArchivos = h('section', {},
    h('h2', {}, 'Archivos'),
    h('div', { class: 'botones' },
      h('button', { onclick: () => app.guardar() }, 'Guardar en el navegador'),
      h('button', { onclick: () => app.nuevo() }, 'Nuevo')),
    h('div', { class: 'botones' }, selector,
      h('button', { onclick: () => selector.value && app.cargar(selector.value) }, 'Cargar'),
      h('button', {
        class: 'peligro',
        onclick: () => selector.value && confirm(`¿Borrar "${selector.value}" de este navegador?`) && app.borrarGuardado(selector.value),
      }, 'Borrar')),
    h('div', { class: 'botones' },
      h('button', { onclick: () => exportarJSON(app.programa) }, 'Exportar JSON'),
      h('button', { onclick: () => archivo.click() }, 'Importar JSON'), archivo),
  );

  // ---------------------------------------------------------------- Hardware
  const selDriver = h('select', {
    'aria-label': 'Driver',
    onchange: (e) => app.usarDriver(e.target.value),
  }, ...DRIVERS.map((d) => h('option', { value: d.id }, d.nombre)));
  const estadoDriver = h('div', { class: 'dato' });
  const trama = h('code', { class: 'trama' });
  const verPanel = h('input', { type: 'checkbox', checked: true, onchange: (e) => alMostrarPanel3D(e.target.checked) });
  const secHardware = h('section', {},
    h('h2', {}, 'Hardware'),
    selDriver, estadoDriver,
    h('div', { class: 'dato' }, 'Última orden al brazo:'), trama,
    h('label', { class: 'check' }, verPanel, ' Mostrar el panel VR también en escritorio'),
  );

  // ---------------------------------------------------------------- Cámaras
  const selFuentes = app.camaras.pantallas.map((p, i) => h('select', {
    'aria-label': `Fuente de ${p.titulo}`,
    onchange: (e) => app.fijarFuente(i, e.target.value),
  }));
  const verPantallas = h('input', { type: 'checkbox', checked: true, onchange: () => app.alternarPantallas() });
  const verEntorno = h('input', { type: 'checkbox', checked: true, onchange: () => app.alternarEntorno() });
  const estadoObjetos = h('div', { class: 'dato' });
  function dibujarCamaras() {
    const ops = app.opcionesFuente();
    selFuentes.forEach((s, i) => {
      s.replaceChildren(...ops.map((o) => h('option', { value: o.id }, o.nombre)));
      s.value = app.fuentes[i];
    });
    verPantallas.checked = app.camaras.visibles;
  }
  const secCamaras = h('section', {},
    h('h2', {}, 'Cámaras y escena'),
    ...app.camaras.pantallas.map((p, i) => h('div', { class: 'botones' },
      h('span', { class: 'etiqueta-fuente' }, p.titulo), selFuentes[i])),
    h('div', { class: 'botones' },
      h('button', { onclick: () => app.buscarWebcams() }, 'Buscar webcams de este equipo')),
    h('label', { class: 'check' }, verPantallas, ' Mostrar las pantallas en la escena'),
    h('label', { class: 'check' }, verEntorno, ' Mostrar piso y mesa virtual'),
    h('div', { class: 'subtitulo' }, 'Objetos para manipular'),
    h('div', { class: 'botones' },
      ...['cubo', 'cilindro', 'pelota', 'bandeja'].map((t) => h('button', { onclick: () => app.objetos.agregar(t) }, `+ ${t}`)),
      h('button', { onclick: () => app.objetos.agregarManchas(6) }, '+ manchas')),
    estadoObjetos,
    h('div', { class: 'botones' },
      h('button', { onclick: () => app.objetos.quitarTodo() }, 'Quitar todo'),
      h('button', { onclick: () => app.reiniciarCubos() }, 'Reiniciar (3 cubos)'),
      h('button', { onclick: () => app.restablecerPosiciones() }, 'Ordenar panel y pantallas')),
    h('div', { class: 'dato' }, 'Simulada = lo que vería una cámara en esa posición. La transmisión desde el brazo real queda para la versión 2.'),
  );
  dibujarCamaras();
  app.alCambiar((t) => {
    if (t === 'camaras') dibujarCamaras();
    if (t === 'entorno') verEntorno.checked = app.entornoVisible();
    if (t === 'modo') {
      tipoGrab.value = app.tipoGrabacion;
      botonTrayectoria.textContent = app.grabandoTrayectoria ? '■ Terminar grabación (T)' : '● Grabar en tiempo real (T)';
      botonTrayectoria.classList.toggle('peligro', app.grabandoTrayectoria);
    }
  });

  raiz.append(secArticulaciones, secPrograma, secCamaras, secArchivos, secHardware);

  // ---------------------------------------------------------------- Eventos
  const mensaje = document.getElementById('mensaje');
  app.alCambiar((t) => {
    if (t === 'programa' || t === 'todo') {
      dibujarLista();
      dibujarArchivos();
    }
    if (t === 'archivos') dibujarArchivos();
    if (t === 'reproduccion') marcarActivo();
    if (t === 'mensaje') {
      mensaje.textContent = app.mensaje;
      mensaje.classList.remove('visible');
      void mensaje.offsetWidth;
      mensaje.classList.add('visible');
    }
    if (t === 'seleccion') filas.forEach((f, i) => f.fila.classList.toggle('seleccionada', i === app.seleccion));
    if (t === 'driver') {
      estadoDriver.textContent = app.estadoDriver;
      if (app.driverId) selDriver.value = app.driverId;
    }
  });
  dibujarLista();
  dibujarArchivos();

  // ---------------------------------------------------------------- Teclado
  addEventListener('keydown', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type !== 'range' && t.type !== 'checkbox') return;
    if (t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
    const paso = e.shiftKey ? 10 : 2;
    if (e.key >= '1' && e.key <= String(art.length)) app.seleccionar(Number(e.key) - 1);
    else if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && t.type !== 'range') app.sumarArticulacion(app.seleccion, paso);
    else if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && t.type !== 'range') app.sumarArticulacion(app.seleccion, -paso);
    else if (e.key === 'r' || e.key === 'R') app.grabarPunto();
    else if (e.key === 'g' || e.key === 'G') app.alternarPinza();
    else if (e.key === 't' || e.key === 'T') app.alternarTrayectoria();
    else if (e.key === ' ') app.alternarReproduccion();
    else if (e.key === 'h' || e.key === 'H') app.irAInicio();
    else if (e.key === 'Escape') app.detenerTodo();
    else return;
    e.preventDefault();
  });

  // ---------------------------------------------------------------- Cuadro a cuadro
  let ultimo = 0;
  return {
    actualizar(ahora, posMundoEfector, posLocalEfector) {
      if (ahora - ultimo < 80) return;
      ultimo = ahora;
      filas.forEach((f, i) => {
        if (document.activeElement !== f.rango) f.rango.value = c.objetivo[i];
        if (document.activeElement !== f.numero) f.numero.value = Math.round(c.objetivo[i]);
        const enMov = Math.abs(c.actual[i] - c.objetivo[i]) > 0.5;
        f.real.textContent = `${c.actual[i].toFixed(1)}°`;
        f.real.classList.toggle('moviendo', enMov);
      });
      pinzaReal.textContent = `${(c.pinzaActual * 1000).toFixed(0)} mm`;
      const ob = app.objetos;
      estadoObjetos.textContent = `Objetos: ${ob.lista.filter((x) => !x.def.plana).length}`
        + (ob.manchas.total ? ` · manchas limpias ${ob.manchas.limpias} de ${ob.manchas.total}` : '')
        + (ob.sujeto ? ` · en la pinza: ${ob.sujeto.def.nombre}` : '');
      if (document.activeElement !== pinzaRango) pinzaRango.value = c.pinzaObjetivo * 1000;
      botonPinza.textContent = app.pinzaAbierta() ? 'Cerrar pinza (G)' : 'Abrir pinza (G)';
      const obj = app.puntaObjetivoMM();
      ejesCart.forEach((e) => {
        if (document.activeElement !== e.numero) e.numero.value = Math.round(obj[e.eje]);
      });
      const p = posLocalEfector;
      posEfector.textContent = `Efector (desde la base): X ${(p.x * 1000).toFixed(0)} · Y ${(p.y * 1000).toFixed(0)} · Z ${(p.z * 1000).toFixed(0)} mm`
        + (app.objetivoIK ? ` · error IK ${(app.errorIK * 1000).toFixed(1)} mm` : '');
      trama.textContent = app.driver?.ultimaTrama || '—';
      if (app.driver?.mensajes !== undefined) {
        estadoDriver.textContent = `${app.estadoDriver} · ${app.driver.mensajes} órdenes enviadas`;
      }
    },
  };
}
