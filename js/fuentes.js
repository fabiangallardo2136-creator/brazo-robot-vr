// Elección de la fuente de video de cada pantalla (simulada, webcam o apagada).
// En la versión 2 se agregará aquí la fuente "remota" (WebRTC desde el brazo real).
import { listarWebcams, abrirWebcam } from './camaras.js';

export function agregarFuentes(app, camaras) {
  app.camaras = camaras;
  app.webcams = [];
  app.fuentes = camaras.pantallas.map(() => 'virtual');

  app.opcionesFuente = () => [
    { id: 'virtual', nombre: 'Simulada' },
    ...app.webcams.map((w) => ({ id: `webcam:${w.id}`, nombre: w.nombre })),
    { id: 'apagada', nombre: 'Apagada' },
  ];

  app.nombreFuente = (i) => app.opcionesFuente().find((o) => o.id === app.fuentes[i])?.nombre ?? '—';

  app.buscarWebcams = async () => {
    try {
      app.webcams = await listarWebcams();
      app.informar(app.webcams.length
        ? `${app.webcams.length} webcam(s) encontrada(s)`
        : 'No encontré webcams en este equipo');
    } catch (e) {
      app.informar(`No se pudo acceder a las webcams: ${e.message}`);
    }
    app.avisar('camaras');
  };

  app.fijarFuente = async (i, id) => {
    try {
      if (id === 'virtual') camaras.usarVirtual(i);
      else if (id === 'apagada') camaras.apagar(i);
      else if (id.startsWith('webcam:')) {
        const deviceId = id.slice(7);
        const nombre = app.webcams.find((w) => w.id === deviceId)?.nombre ?? 'Webcam';
        camaras.fijarStream(i, await abrirWebcam(deviceId), nombre, true);
      }
      app.fuentes[i] = id;
    } catch (e) {
      app.informar(`No se pudo abrir la fuente: ${e.message}`);
    }
    app.avisar('camaras');
  };

  app.ciclarFuente = (i) => {
    const ops = app.opcionesFuente();
    const k = ops.findIndex((o) => o.id === app.fuentes[i]);
    app.fijarFuente(i, ops[(k + 1) % ops.length].id);
  };

  app.alternarPantallas = () => {
    camaras.fijarVisibles(!camaras.visibles);
    app.avisar('camaras');
  };
}
