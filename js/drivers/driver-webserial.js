// ESQUELETO para la versión 2: driver por USB con Web Serial.
// TODAVÍA NO ESTÁ IMPLEMENTADO NI PROBADO.
//
// Importante: Web Serial funciona en Chrome/Edge de escritorio, pero NO en el
// navegador del Meta Quest. Sirve para probar el brazo real desde el PC (sin
// visor) con la placa conectada por USB.
//
// Plan de implementación:
//   1. conectar(): navigator.serial.requestPort() (requiere un clic del
//      usuario), port.open({ baudRate: 115200 }), obtener un writer con
//      TextEncoderStream.
//   2. enviarAngulos(): escribir tramaServos(angulos, config) + '\n'. Si el
//      envío anterior no terminó, descartar este (no acumular cola).
//   3. Leer las respuestas del firmware ("OK", "ERR ...") y pasarlas a
//      alCambiarEstado.
//   4. desconectar(): liberar writer y cerrar el puerto.
import { tramaServos } from './protocolo.js';

export class DriverWebSerial {
  constructor(config) {
    this.config = config;
    this.nombre = 'USB (Web Serial)';
    this.conectado = false;
    this.alCambiarEstado = null;
    this.puerto = null;
    this.escritor = null;
  }

  static disponible() {
    return 'serial' in navigator;
  }

  async conectar() {
    throw new Error('El driver USB (Web Serial) es un esqueleto para la versión 2: todavía no está implementado.');
  }

  async desconectar() {
    this.conectado = false;
  }

  enviarAngulos(angulos, pinza) {
    if (!this.conectado || !this.escritor) return;
    // TODO v2: this.escritor.write(tramaServos(angulos, this.config, pinza) + '\n');
    void tramaServos;
  }
}
