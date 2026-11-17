// Driver "simulador": no habla con ningún hardware. Solo guarda la última
// orden y cuenta los envíos, para mostrar en pantalla lo que recibiría el
// brazo real.
//
// INTERFAZ QUE DEBE CUMPLIR CUALQUIER DRIVER
//   nombre: string
//   conectado: boolean
//   async conectar(): Promise<void>      (puede pedir permisos al usuario)
//   async desconectar(): Promise<void>
//   enviarAngulos(angulos: number[]): void   ángulos en grados, orden J1..J6
//   alCambiarEstado: function(texto) | null  (lo asigna la app)
import { tramaServos } from './protocolo.js';

export class DriverSimulador {
  constructor(config) {
    this.config = config;
    this.nombre = 'Simulador';
    this.conectado = false;
    this.mensajes = 0;
    this.ultimaTrama = '';
    this.alCambiarEstado = null;
  }

  async conectar() {
    this.conectado = true;
    this.alCambiarEstado?.('Simulador activo (sin hardware)');
  }

  async desconectar() {
    this.conectado = false;
    this.alCambiarEstado?.('Simulador detenido');
  }

  enviarAngulos(angulos) {
    if (!this.conectado) return;
    this.mensajes++;
    // Se arma la misma trama que se mandaría al ESP32, para poder revisarla.
    this.ultimaTrama = tramaServos(angulos, this.config);
  }
}
