// Contenido de los paneles de VR:
//   - Panel principal con pestañas: Mover, Programa, Archivos, Objetos,
//     Escena y Controles. Todo lo que se puede hacer en el PC está aquí.
//   - Panel rápido en la muñeca izquierda.
import { COLOR } from './panel-vr.js';
import { TIPOS, almacen } from './programa.js';
import { ENTRADAS_EJE, ENTRADAS_BOTON } from './mandos.js';

const PESTANAS = [
  ['mover', 'Mover'], ['programa', 'Programa'], ['rutinas', 'Rutinas'], ['archivos', 'Archivos'],
  ['objetos', 'Objetos'], ['escena', 'Escena'], ['controles', 'Controles'],
];

export function construirPanelPrincipal(panel, app) {
  const art = app.config.articulaciones;
  const pz = app.config.herramienta.pinza;
  const c = app.controlador;
  const r = app.reproductor;
  const M = 32;
  const W = panel.ancho - 2 * M;
  let pestana = 'mover';
  const en = (id) => () => pestana === id;
  const y0 = 150; // inicio del contenido bajo las pestañas

  // Ayudantes de diseño --------------------------------------------------------
  const boton = (pag, x, y, w, h, texto, accion, extra = {}) => panel.agregar({
    tipo: 'boton', x, y, w, h, texto: typeof texto === 'function' ? texto : () => texto, accion,
    ...extra, visible: extra.visible ? () => pestana === pag && extra.visible() : en(pag),
  });
  const fila = (pag, y, botones, { h = 66, cols = botones.length } = {}) => {
    const g = 14;
    const w = (W - (cols - 1) * g) / cols;
    botones.forEach((b, k) => {
      if (b) boton(pag, M + k * (w + g), y, w, h, b[0], b[1], b[2]);
    });
    return y + h + 12;
  };
  const texto = (pag, x, y, fn, extra = {}) => panel.agregar({
    tipo: 'texto', x, y, texto: typeof fn === 'function' ? fn : () => fn, tam: 26, color: COLOR.tenue,
    ...extra, visible: en(pag),
  });
  const deslizador = (pag, y, def) => panel.agregar({
    tipo: 'deslizador', x: M, y, w: W, h: 54, ...def,
    visible: def.visible ? () => pestana === pag && def.visible() : en(pag),
  });

  // Pestañas ----------------------------------------------------------------
  const anchoP = (W - (PESTANAS.length - 1) * 8) / PESTANAS.length;
  PESTANAS.forEach(([id, nombre], k) => panel.agregar({
    tipo: 'boton', x: M + k * (anchoP + 8), y: 18, w: anchoP, h: 64, tam: 28,
    texto: () => nombre, activo: () => pestana === id,
    accion: () => { pestana = id; },
  }));
  // Estado (todas las pestañas)
  panel.agregar({
    tipo: 'texto', x: M, y: 112, tam: 26, color: COLOR.texto, negrita: true,
    texto: () => {
      const n = app.programa.puntos.length;
      let estado = `${app.programa.nombre} · ${n} punto${n === 1 ? '' : 's'}`;
      if (app.grabandoTrayectoria) estado = `● GRABANDO en tiempo real · ${n} puntos`;
      else if (r.activo && r.programa === app.programa) {
        const fase = { moviendo: 'Hacia', pinza: 'Pinza en', esperando: 'Pausa en' }[r.fase] ?? '';
        estado = `▶ ${fase} P${r.indice + 1}/${n}${app.bucle ? ' · bucle' : ''}`;
      } else if (app.objetivoIK) estado = `Moviendo la punta · error ${(app.errorIK * 1000).toFixed(0)} mm`;
      return estado;
    },
  });
  panel.agregar({
    tipo: 'texto', x: panel.ancho - M, y: 112, tam: 24, alinear: 'right', color: COLOR.tenue,
    texto: () => (app.mandos?.capa2 ? 'Capa 2 activa' : `Velocidad ${Math.round(c.velocidad * 100)} %`),
  });
  // Mensaje al pie (todas las pestañas)
  panel.agregar({
    tipo: 'texto', x: M, y: panel.alto - 30, tam: 24, color: COLOR.tenue,
    texto: () => app.mensaje || 'Gatillo: usar el panel · Grip: mover la punta, objetos, pantallas o el panel',
  });

  // ============================ MOVER =========================================
  {
    let y = y0;
    const articular = () => app.modoMando === 'articular';
    const cartesiano = () => app.modoMando === 'cartesiano';
    const ejes = ['x', 'y', 'z'];
    const rangos = { x: [-500, 500], y: [-150, 600], z: [-500, 500] };
    art.forEach((a, i) => {
      deslizador('mover', y, {
        min: a.min, max: a.max, visible: i < 3 ? articular : undefined,
        etiqueta: () => `${a.id} ${a.nombre}`,
        valor: () => c.objetivo[i], real: () => c.actual[i],
        fijar: (v) => app.moverArticulacion(i, Math.round(v)),
        texto: () => `${c.actual[i].toFixed(0)}°`,
      });
      if (i < 3) {
        const eje = ejes[i];
        deslizador('mover', y, {
          min: rangos[eje][0], max: rangos[eje][1], visible: cartesiano,
          etiqueta: () => `Punta ${eje.toUpperCase()} (mm)`,
          valor: () => app.puntaObjetivoMM()[eje], real: () => app.puntaRealMM()[eje],
          fijar: (v) => app.moverPuntaEje(eje, Math.round(v)),
          texto: () => `${app.puntaRealMM()[eje].toFixed(0)}`,
        });
      }
      y += 60;
    });
    deslizador('mover', y, {
      min: pz.aperturaMin * 1000, max: pz.aperturaMax * 1000,
      etiqueta: () => 'Pinza (mm)',
      valor: () => c.pinzaObjetivo * 1000, real: () => c.pinzaActual * 1000,
      fijar: (v) => app.fijarPinzaMM(Math.round(v)),
      texto: () => `${(c.pinzaActual * 1000).toFixed(0)} mm`,
    });
    y += 60;
    deslizador('mover', y, {
      min: 10, max: 100,
      etiqueta: () => 'Velocidad',
      valor: () => c.velocidad * 100,
      fijar: (v) => { app.fijarVelocidad(Math.round(v) / 100); app.avisar('velocidad'); },
      texto: () => `${Math.round(c.velocidad * 100)} %`,
    });
    y += 72;
    y = fila('mover', y, [
      ['● Grabar punto', () => app.grabarPunto()],
      [() => (r.activo ? '■ Detener' : '▶ Reproducir'), () => app.alternarReproduccion(), { activo: () => r.activo }],
      [() => (app.pinzaAbierta() ? 'Cerrar pinza' : 'Abrir pinza'), () => app.alternarPinza()],
    ]);
    y = fila('mover', y, [
      [() => (articular() ? 'Mando: ángulos' : 'Mando: X Y Z'), () => app.alternarModoMando(), { activo: cartesiano }],
      [() => (app.tipoGrabacion === 'lineal' ? 'Grabar: lineal' : 'Grabar: articular'),
        () => app.alternarTipoGrabacion(), { activo: () => app.tipoGrabacion === 'lineal' }],
      [() => (app.grabandoTrayectoria ? '■ Terminar grabación' : '● Grabar en tiempo real'),
        () => app.alternarTrayectoria(), { activo: () => app.grabandoTrayectoria }],
    ]);
    fila('mover', y, [
      ['Ir a inicio', () => app.irAInicio()],
      ['Borrar último', () => app.borrarUltimo()],
      [() => `↻ Bucle: ${app.bucle ? 'sí' : 'no'}`, () => app.alternarBucle(), { activo: () => app.bucle }],
    ]);
  }

  // ============================ PROGRAMA ======================================
  {
    const POR_PAG = 6;
    let pagina = 0;
    const totalPags = () => Math.max(1, Math.ceil(app.programa.puntos.length / POR_PAG));
    const sel = () => app.programa.puntos[app.puntoSel];
    let y = y0;
    for (let k = 0; k < POR_PAG; k++) {
      const idx = () => pagina * POR_PAG + k;
      boton('programa', M, y, W, 50, () => {
        const i = idx();
        const p = app.programa.puntos[i];
        const tiempo = p.tiempo ? ` · ${p.tiempo.toFixed(2)} s` : '';
        return `P${i + 1} · ${TIPOS[p.tipo]} · vel ${p.velocidad}% · pinza ${Math.round(p.pinza)} mm · pausa ${p.pausa} s${tiempo}`;
      }, () => app.seleccionarPunto(idx()), {
        tam: 26,
        visible: () => idx() < app.programa.puntos.length,
        activo: () => app.puntoSel === idx() || (r.activo && r.programa === app.programa && r.indice === idx()),
      });
      y += 56;
    }
    texto('programa', M, y0 + 30, () => (app.programa.puntos.length ? '' : 'Sin puntos: ve a "Mover" y graba algunos.'));
    y += 4;
    boton('programa', M, y, 200, 56, '◀ Anterior', () => { pagina = Math.max(0, pagina - 1); });
    boton('programa', M + W - 200, y, 200, 56, 'Siguiente ▶', () => { pagina = Math.min(totalPags() - 1, pagina + 1); });
    texto('programa', M + W / 2, y + 28, () => {
      if (pagina > totalPags() - 1) pagina = totalPags() - 1;
      return `Página ${pagina + 1} de ${totalPags()}`;
    }, { alinear: 'center', color: COLOR.texto });
    y += 74;
    texto('programa', M, y, () => (sel() ? `Editando P${app.puntoSel + 1}` : 'Toca un punto de la lista para editarlo'),
      { color: COLOR.texto, negrita: true });
    y += 22;
    const conSel = () => !!sel();
    deslizador('programa', y, {
      min: 5, max: 100, visible: conSel, etiqueta: () => 'Velocidad (%)',
      valor: () => sel()?.velocidad ?? 100,
      fijar: (v) => app.editarPunto(app.puntoSel, 'velocidad', Math.round(v / 5) * 5),
      texto: () => `${sel()?.velocidad ?? 0} %`,
    });
    y += 58;
    deslizador('programa', y, {
      min: 0, max: 5, visible: conSel, etiqueta: () => 'Pausa (s)',
      valor: () => sel()?.pausa ?? 0,
      fijar: (v) => app.editarPunto(app.puntoSel, 'pausa', Math.round(v * 10) / 10),
      texto: () => `${(sel()?.pausa ?? 0).toFixed(1)} s`,
    });
    y += 58;
    deslizador('programa', y, {
      min: pz.aperturaMin * 1000, max: pz.aperturaMax * 1000, visible: conSel, etiqueta: () => 'Pinza (mm)',
      valor: () => sel()?.pinza ?? 0,
      fijar: (v) => app.editarPunto(app.puntoSel, 'pinza', Math.round(v)),
      texto: () => `${Math.round(sel()?.pinza ?? 0)} mm`,
    });
    y += 66;
    y = fila('programa', y, [
      ['Ir al punto', () => app.irAPunto(app.puntoSel), { visible: conSel }],
      ['▶ Desde aquí', () => app.reproducir(app.puntoSel), { visible: conSel }],
      [() => `Tipo: ${TIPOS[sel()?.tipo] ?? '—'}`, () => app.alternarTipoPunto(app.puntoSel), { visible: conSel }],
      ['Reemplazar', () => app.reemplazarPunto(app.puntoSel), { visible: conSel }],
    ], { h: 60 });
    fila('programa', y, [
      ['Insertar después', () => app.insertarPuntoDespues(app.puntoSel), { visible: conSel }],
      ['▲ Subir', () => { app.moverPunto(app.puntoSel, -1); app.seleccionarPunto(app.puntoSel - 1); }, { visible: conSel }],
      ['▼ Bajar', () => { app.moverPunto(app.puntoSel, 1); app.seleccionarPunto(app.puntoSel + 1); }, { visible: conSel }],
      ['Borrar', () => app.borrarPunto(app.puntoSel), { visible: conSel }],
    ], { h: 60 });
  }

  // ============================ ARCHIVOS ======================================
  {
    const POR_PAG = 6;
    let pagina = 0;
    let elegido = null;
    let confirmarBorrar = 0;
    let lista = [];
    const refrescar = () => { lista = almacen.listar(); };
    app.alCambiar((t) => { if (t === 'archivos' || t === 'programa') refrescar(); });
    refrescar();
    let y = y0;
    y = fila('archivos', y, [
      ['Guardar', () => app.guardar()],
      ['Guardar como nuevo', () => app.guardarComoNuevo()],
      ['Programa nuevo', () => app.nuevo()],
    ]);
    texto('archivos', M, y + 14, 'Programas guardados en este visor:');
    y += 34;
    for (let k = 0; k < POR_PAG; k++) {
      const idx = () => pagina * POR_PAG + k;
      boton('archivos', M, y, W, 50, () => lista[idx()] ?? '', () => { elegido = lista[idx()]; confirmarBorrar = 0; }, {
        tam: 26, visible: () => idx() < lista.length, activo: () => elegido === lista[idx()],
      });
      y += 56;
    }
    texto('archivos', M, y0 + 130, () => (lista.length ? '' : '(ninguno todavía)'));
    const totalPags = () => Math.max(1, Math.ceil(lista.length / POR_PAG));
    boton('archivos', M, y, 200, 56, '◀ Anterior', () => { pagina = Math.max(0, pagina - 1); });
    boton('archivos', M + W - 200, y, 200, 56, 'Siguiente ▶', () => { pagina = Math.min(totalPags() - 1, pagina + 1); });
    texto('archivos', M + W / 2, y + 28, () => `Página ${Math.min(pagina, totalPags() - 1) + 1} de ${totalPags()}`,
      { alinear: 'center', color: COLOR.texto });
    y += 74;
    y = fila('archivos', y, [
      [() => (elegido ? `Cargar "${elegido}"` : 'Cargar (elige uno)'), () => elegido && app.cargar(elegido)],
      [() => (confirmarBorrar ? '¿Seguro? Toca otra vez' : 'Borrar elegido'), () => {
        if (!elegido) return;
        if (!confirmarBorrar) { confirmarBorrar = 1; return; }
        app.borrarGuardado(elegido);
        elegido = null;
        confirmarBorrar = 0;
      }, { activo: () => !!confirmarBorrar }],
    ]);
    fila('archivos', y, [
      ['Ejemplo: recoger y dejar', () => app.cargarDesdeURL('ejemplos/recoger-y-dejar.json')],
      ['Ejemplo: limpiar la mesa', () => app.cargarDesdeURL('ejemplos/limpiar-mesa.json')],
    ]);
  }

  // ============================ OBJETOS =======================================
  {
    let y = y0;
    texto('objetos', M, y + 6, 'Agregar al alcance del brazo:');
    y += 26;
    const agregar = (tipo) => () => {
      app.objetos.agregar(tipo);
      app.informar(`Agregado: ${tipo}`);
    };
    y = fila('objetos', y, [
      ['+ Cubo', agregar('cubo')], ['+ Cilindro', agregar('cilindro')], ['+ Pelota', agregar('pelota')],
    ]);
    y = fila('objetos', y, [
      ['+ Bandeja', agregar('bandeja')],
      ['+ 6 manchas', () => { app.objetos.agregarManchas(6); app.informar('Manchas agregadas: límpialas con la punta'); }],
      ['Quitar último', () => app.objetos.quitarUltimo()],
    ]);
    y = fila('objetos', y, [
      ['Quitar todo', () => app.objetos.quitarTodo()],
      ['Reiniciar (3 cubos)', () => app.reiniciarCubos()],
      [() => `Mesa virtual: ${app.mesaVisible?.() ? 'sí' : 'no'}`, () => app.alternarMesa(), { activo: () => app.mesaVisible?.() }],
    ]);
    texto('objetos', M, y + 20, () => {
      const o = app.objetos;
      const m = o.manchas;
      const n = o.lista.filter((x) => !x.def.plana).length;
      return `Objetos: ${n}${m.total ? ` · Manchas limpias: ${m.limpias} de ${m.total}` : ''}${o.sujeto ? ` · En la pinza: ${o.sujeto.def.nombre}` : ''}`;
    }, { color: COLOR.texto, tam: 28, negrita: true });
    const ayuda = [
      'Tomar con la pinza: pon el objeto entre los dedos y cierra la pinza.',
      'Mover con la mano: apunta al objeto y mantén el grip.',
      'Limpiar: pasa la punta de la pinza sobre las manchas, a menos de 4 cm.',
      'Pick and place: graba puntos arriba, abajo (lineal), cierra, sube, lleva, abre.',
      'Cubo y cilindro 36–40 mm, pelota 44 mm: la pinza abre hasta 50 mm.',
    ];
    ayuda.forEach((t, k) => texto('objetos', M, y + 70 + k * 40, t));
  }

  // ============================ ESCENA ========================================
  {
    let y = y0;
    y = fila('escena', y, [
      [() => (app.fondoReal?.() ? 'Fondo: sala real' : 'Fondo: virtual'), () => app.alternarFondo?.(),
        { activo: () => !!app.fondoReal?.() }],
      [() => `Piso virtual: ${app.pisoVisible?.() ? 'sí' : 'no'}`, () => app.alternarPiso(), { activo: () => app.pisoVisible?.() }],
      [() => `Mesa virtual: ${app.mesaVisible?.() ? 'sí' : 'no'}`, () => app.alternarMesa(), { activo: () => app.mesaVisible?.() }],
    ]);
    y = fila('escena', y, [
      [() => `Pantallas: ${app.camaras?.visibles ? 'sí' : 'no'}`, () => app.alternarPantallas?.(), { activo: () => !!app.camaras?.visibles }],
      [() => `Cám. pinza: ${app.nombreFuente?.(0) ?? '—'}`, () => app.ciclarFuente?.(0)],
      [() => `Cám. ambiente: ${app.nombreFuente?.(1) ?? '—'}`, () => app.ciclarFuente?.(1)],
    ]);
    y = fila('escena', y, [
      ['Traer panel aquí', () => app.traerPanel?.()],
      [() => `Panel muñeca: ${app.panelMunecaVisible?.() ? 'sí' : 'no'}`, () => app.alternarPanelMuneca?.(),
        { activo: () => !!app.panelMunecaVisible?.() }],
      ['Ordenar todo', () => app.restablecerPosiciones?.()],
    ]);
    texto('escena', M, y + 20, () => (app.modoXR === 'vr'
      ? 'Este visor no permite ver la sala real desde el navegador (no hay sesión AR).'
      : 'Fondo virtual: todo es virtual. Fondo sala real: ves tu taller (passthrough).'));
    texto('escena', M, y + 56, 'Con la sala real, el piso y la mesa virtuales empiezan ocultos; actívalos si los quieres.');
    texto('escena', M, y + 100, () => `Hardware: ${app.estadoDriver || '—'}`);
    texto('escena', M, y + 136, () => `Última orden: ${app.driver?.ultimaTrama || '—'}`);
    texto('escena', M, y + 190, 'Mover el panel, las pantallas o el brazo: apunta y mantén el grip.');
    texto('escena', M, y + 226, 'Con la palanca adelante/atrás (mientras mantienes el grip) lo alejas o acercas.');
  }

  // ============================ RUTINAS =======================================
  {
    let y = y0;
    texto('rutinas', M, y + 6, 'Movimientos listos (reemplazan el programa; el anterior queda guardado):');
    y += 26;
    y = fila('rutinas', y, [
      ['Saludar', () => app.generarRutina('saludar')],
      ['Batir crema', () => app.generarRutina('batir')],
      ['Dibujar círculo', () => app.generarRutina('circulo')],
    ]);
    y = fila('rutinas', y, [
      ['Recoger y dejar', () => app.cargarDesdeURL('ejemplos/recoger-y-dejar.json')],
      ['Limpiar la mesa', () => app.cargarDesdeURL('ejemplos/limpiar-mesa.json')],
      [() => (r.activo ? '■ Detener' : '▶ Reproducir'), () => app.alternarReproduccion(), { activo: () => r.activo }],
    ]);
    texto('rutinas', M, y + 8, 'Ver el movimiento:');
    y += 26;
    y = fila('rutinas', y, [
      [() => `Trayectoria: ${app.trayectoria?.verCamino ? 'sí' : 'no'}`, () => app.trayectoria.alternarCamino(),
        { activo: () => !!app.trayectoria?.verCamino }],
      [() => `Rastro de la punta: ${app.trayectoria?.verRastro ? 'sí' : 'no'}`, () => app.trayectoria.alternarRastro(),
        { activo: () => !!app.trayectoria?.verRastro }],
      ['Borrar rastro', () => app.trayectoria.borrarRastro()],
    ]);
    texto('rutinas', M, y + 8, () => `Objetos al empezar el programa: ${app.programa.escena
      ? `${app.programa.escena.length} guardados (se reponen al reproducir desde P1)` : 'no guardados'}`);
    y += 26;
    y = fila('rutinas', y, [
      ['Fijar escena actual', () => app.capturarEscena()],
      ['Reponer objetos', () => app.restaurarEscena()],
      ['Quitar escena', () => app.quitarEscena()],
    ]);
    y = fila('rutinas', y, [
      [() => (app.grabandoTrayectoria ? '■ Terminar grabación' : '● Grabar en tiempo real'),
        () => app.alternarTrayectoria(), { activo: () => app.grabandoTrayectoria }],
    ], { cols: 1 });
    texto('rutinas', M, y + 14, 'Grabar en tiempo real: toma la punta con el grip o usa las palancas.');
    texto('rutinas', M, y + 48, 'Cada movimiento queda grabado con su ritmo en un programa nuevo.');
    texto('rutinas', M, y + 82, 'Clic en la palanca derecha = empezar / terminar la grabación.');
  }

  // ============================ CONTROLES =====================================
  {
    const m = () => app.mandos;
    const colW = (W - 20) / 2;
    texto('controles', M, y0 + 6, 'Toca una fila para cambiar lo que hace.');
    let y = y0 + 34;
    texto('controles', M, y + 10, 'Palancas · capa 1', { color: COLOR.texto, negrita: true });
    texto('controles', M + colW + 20, y + 10, 'Botones', { color: COLOR.texto, negrita: true });
    y += 30;
    ENTRADAS_EJE.forEach((e, k) => {
      boton('controles', M, y + k * 58, colW, 50, () => `${e.nombre}: ${m()?.nombreEje(m().mapa.ejes[1][e.id])}`,
        () => m()?.ciclarEje(1, e.id), { tam: 24 });
    });
    ENTRADAS_BOTON.forEach((e, k) => {
      boton('controles', M + colW + 20, y + k * 58, colW, 50, () => `${e.nombre}: ${m()?.nombreBoton(m().mapa.botones[e.id])}`,
        () => m()?.ciclarBoton(e.id), { tam: 24 });
    });
    const y2 = y + 4 * 58 + 20;
    texto('controles', M, y2 + 10, 'Palancas · capa 2', { color: COLOR.texto, negrita: true });
    ENTRADAS_EJE.forEach((e, k) => {
      boton('controles', M, y2 + 30 + k * 58, colW, 50, () => `${e.nombre}: ${m()?.nombreEje(m().mapa.ejes[2][e.id])}`,
        () => m()?.ciclarEje(2, e.id), { tam: 24 });
    });
    boton('controles', M + colW + 20, y + 6 * 58 + 20, colW, 56, 'Restablecer controles', () => m()?.restablecer());
    texto('controles', M + colW + 20, y + 6 * 58 + 110, 'Capa 2: mientras mantienes el botón');
    texto('controles', M + colW + 20, y + 6 * 58 + 145, 'de capa, las palancas usan la capa 2.');
    texto('controles', M + colW + 20, y + 6 * 58 + 190, 'Las palancas mueven el brazo cuando');
    texto('controles', M + colW + 20, y + 6 * 58 + 225, 'no estás moviendo un objeto.');
  }
}

// Panel rápido que va en la muñeca izquierda.
export function construirPanelMuneca(panel, app) {
  const r = app.reproductor;
  const M = 20;
  const W = panel.ancho - 2 * M;
  const w = (W - 14) / 2;
  panel.agregar({
    tipo: 'texto', x: M, y: 34, tam: 26, negrita: true,
    texto: () => (app.grabandoTrayectoria ? '● Grabando…' : r.activo ? `▶ P${r.indice + 1}` : `${app.programa.puntos.length} puntos`),
  });
  panel.agregar({
    tipo: 'texto', x: panel.ancho - M, y: 34, tam: 22, alinear: 'right', color: COLOR.tenue,
    texto: () => `Pinza ${(app.controlador.pinzaActual * 1000).toFixed(0)} mm`,
  });
  const botones = [
    ['● Grabar', () => app.grabarPunto()],
    [() => (r.activo ? '■ Detener' : '▶ Reproducir'), () => app.alternarReproduccion(), () => r.activo],
    [() => (app.pinzaAbierta() ? 'Cerrar pinza' : 'Abrir pinza'), () => app.alternarPinza()],
    ['Guardar', () => app.guardar()],
    ['Traer panel', () => app.traerPanel?.()],
    [() => (app.grabandoTrayectoria ? '■ Terminar' : '● Grabar mov.'), () => app.alternarTrayectoria(), () => app.grabandoTrayectoria],
  ];
  botones.forEach(([t, accion, activo], k) => panel.agregar({
    tipo: 'boton', x: M + (k % 2) * (w + 14), y: 64 + Math.floor(k / 2) * 76, w, h: 64, tam: 28,
    texto: typeof t === 'function' ? t : () => t, accion, activo,
  }));
}
