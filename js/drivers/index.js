import { DriverSimulador } from './driver-simulador.js';
import { DriverWebSerial } from './driver-webserial.js';
import { DriverWebSocket } from './driver-websocket.js';

export const DRIVERS = [
  { id: 'simulador', nombre: 'Simulador', listo: true },
  { id: 'webserial', nombre: 'USB · Web Serial (versión 2)', listo: false },
  { id: 'websocket', nombre: 'Wi-Fi · WebSocket (versión 2)', listo: false },
];

export function crearDriver(id, config) {
  switch (id) {
    case 'simulador': return new DriverSimulador(config);
    case 'webserial': return new DriverWebSerial(config);
    case 'websocket': return new DriverWebSocket(config);
    default: throw new Error(`Driver desconocido: ${id}`);
  }
}
