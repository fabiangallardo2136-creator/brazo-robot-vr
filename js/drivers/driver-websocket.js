// ESQUELETO para la versión 2: driver inalámbrico por WebSocket hacia un ESP32.
// TODAVÍA NO ESTÁ IMPLEMENTADO NI PROBADO.
//
// Es el camino natural para el Quest (no tiene Web Serial). Ojo: si la app se
// abre por HTTPS, el navegador solo permite WebSocket seguro (wss://), y un
// ESP32 normalmente sirve ws:// sin TLS. Alternativas en el README
// (sección "Versión 2: conectar el brazo real").
//
// Plan de implementación:
//   1. conectar(url): new WebSocket(url), esperar 'open', reconectar con
//      espera creciente si se cae.
//   2. enviarAngulos(): si socket.bufferedAmount es bajo, socket.send(trama).
//      Si no, descartar (lo importante es la última pose, no todas).
//   3. 'message': respuestas del ESP32 ("OK", posición medida, errores).
//   4. Parada de emergencia: enviar "STOP" y que el firmware corte los servos
//      si deja de recibir órdenes por más de ~500 ms (watchdog).
import { tramaServos } from './protocolo.js';

export class DriverWebSocket {
  constructor(config, url = 'ws://192.168.4.1:81/') {
    this.config = config;
    this.url = url;
    this.nombre = 'Wi-Fi (WebSocket)';
    this.conectado = false;
    this.alCambiarEstado = null;
    this.socket = null;
  }

  async conectar() {
    throw new Error('El driver Wi-Fi (WebSocket) es un esqueleto para la versión 2: todavía no está implementado.');
  }

  async desconectar() {
    this.socket?.close();
    this.conectado = false;
  }

  enviarAngulos(angulos) {
    if (!this.conectado || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(tramaServos(angulos, this.config));
  }
}
