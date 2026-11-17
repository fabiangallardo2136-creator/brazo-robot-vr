// =============================================================================
// Definición del brazo robótico
// -----------------------------------------------------------------------------
// Este es el único archivo que hay que cambiar para que el simulador se parezca
// a tu brazo real. Todo lo demás (dibujo, cinemática, límites, programas y
// drivers) se arma a partir de estos datos.
//
// Convenciones (las de Three.js):
//   - Unidades: metros y grados.
//   - Ejes del mundo: Y hacia arriba, X hacia la derecha, Z hacia el usuario.
//   - Cada articulación es rotacional (un servo o un motor que gira).
//   - "origen": dónde está el eje de la articulación, medido en el sistema de
//     la articulación anterior YA GIRADA (para J1, medido desde el piso de la
//     base). Con todos los ángulos en 0 el brazo queda recto hacia arriba.
//   - "eje": eje local de giro: 'x', 'y', 'z' o un vector [x, y, z].
//     Regla de la mano derecha: con el pulgar en +eje, los dedos indican el
//     sentido positivo. Un giro positivo en 'x' inclina el brazo hacia +Z
//     (hacia el usuario).
//   - "min" / "max": límites mecánicos en grados (el simulador nunca los pasa).
//   - "velMax": velocidad máxima en grados por segundo.
//   - "inicial": pose de reposo (botón "Ir a inicio").
//   - "pesoIK": cuánto participa en la cinemática inversa al arrastrar la
//     punta (0 = no se mueve, 1 = normal). Por defecto la muñeca participa
//     poco para que hombro y codo hagan el trabajo; el giro de muñeca y de
//     herramienta se ajustan a mano con los deslizadores.
//   - "servo": cómo se traduce el ángulo a la orden del hardware (versión 2).
//       canal:   número de servo / salida en la placa (ESP32, PCA9685, etc.).
//       centro:  ángulo del servo (0–180) que corresponde a 0° del simulador.
//       sentido: 1 o -1 si el servo gira al revés.
//
// Este formato equivale a una tabla Denavit-Hartenberg pero es más fácil de
// medir con un pie de metro: basta con medir la distancia entre ejes
// consecutivos y anotar alrededor de qué eje gira cada uno.
// =============================================================================

export const BRAZO = {
  nombre: 'Brazo 6 GDL de escritorio (genérico)',

  // Pedestal fijo donde se apoya J1.
  base: { radio: 0.07, altura: 0.04 },

  articulaciones: [
    {
      id: 'J1', nombre: 'Base', eje: 'y', origen: [0, 0.04, 0],
      min: -170, max: 170, velMax: 90, inicial: 0, pesoIK: 1,
      servo: { canal: 0, centro: 90, sentido: 1 },
    },
    {
      id: 'J2', nombre: 'Hombro', eje: 'x', origen: [0, 0.07, 0],
      min: -95, max: 95, velMax: 60, inicial: 15, pesoIK: 1,
      servo: { canal: 1, centro: 90, sentido: 1 },
    },
    {
      id: 'J3', nombre: 'Codo', eje: 'x', origen: [0, 0.20, 0],
      min: -140, max: 140, velMax: 75, inicial: 75, pesoIK: 1,
      servo: { canal: 2, centro: 90, sentido: 1 },
    },
    {
      id: 'J4', nombre: 'Giro muñeca', eje: 'y', origen: [0, 0.10, 0],
      min: -180, max: 180, velMax: 120, inicial: 0, pesoIK: 0,
      servo: { canal: 3, centro: 90, sentido: 1 },
    },
    {
      id: 'J5', nombre: 'Flexión muñeca', eje: 'x', origen: [0, 0.08, 0],
      min: -115, max: 115, velMax: 120, inicial: 70, pesoIK: 0.5,
      servo: { canal: 4, centro: 90, sentido: 1 },
    },
    {
      id: 'J6', nombre: 'Giro herramienta', eje: 'y', origen: [0, 0.045, 0],
      min: -180, max: 180, velMax: 150, inicial: 0, pesoIK: 0,
      servo: { canal: 5, centro: 90, sentido: 1 },
    },
  ],

  // Punto de trabajo de la herramienta (centro de la pinza), medido desde J6.
  herramienta: {
    origen: [0, 0.07, 0],
    // Pinza de dos dedos paralelos. Apertura = distancia entre dedos (metros).
    pinza: {
      aperturaMin: 0, aperturaMax: 0.05, inicial: 0.05,
      velocidad: 0.05, // m/s
      // Servo de la pinza (versión 2): ángulo con la pinza abierta y cerrada.
      servo: { canal: 6, abierta: 40, cerrada: 120 },
    },
  },

  // Velocidad máxima de la punta en movimientos lineales (m/s).
  velLineal: 0.15,

  // Dónde se apoya la base en la escena (sobre la mesa virtual).
  ubicacion: { posicion: [0, 0.75, -0.55], giroY: 0 },

  // Cámaras. En el simulador son cámaras virtuales; cada pantalla puede
  // mostrar en su lugar una webcam o, en la versión 2, un video transmitido.
  camaras: {
    // Montada en la pinza. posicion: medida desde el punto de trabajo de la
    // herramienta (metros). Mira a lo largo de los dedos.
    pinza: { posicion: [0, -0.045, 0.03], fov: 70 },
    // Fija en el espacio (coordenadas del mundo, metros).
    ambiente: { posicion: [-0.4, 1.3, -1.0], mirarA: [0, 0.9, -0.5], fov: 55 },
  },

  colores: {
    eslabon: 0xe8772e,  // naranjo
    motor: 0x2b2f36,    // gris oscuro
    base: 0x3a3f47,
    pinza: 0x9aa3ad,
    seleccion: 0x3fa9f5,
  },
};
