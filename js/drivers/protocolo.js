// Protocolo propuesto para la versión 2 (hacia un ESP32 o Arduino con servos).
// Es texto simple, una línea por orden, fácil de leer en el monitor serie:
//
//   S,<s1>,<s2>,<s3>,<s4>,<s5>,<s6>\n
//
// donde sN es el ángulo del SERVO del canal N en grados (0–180, un decimal),
// ya convertido con "centro" y "sentido" de config-brazo.js. Ejemplo:
//
//   S,90.0,105.0,165.0,90.0,160.0,90.0
//
// El firmware solo tiene que separar por comas y llamar a servo.write().
// Los límites y la velocidad ya los respeta la app, pero el firmware debería
// volver a limitar por seguridad.

export function anguloServo(grados, articulacion) {
  const s = articulacion.servo ?? { centro: 90, sentido: 1 };
  const v = s.centro + s.sentido * grados;
  return Math.min(180, Math.max(0, v));
}

export function tramaServos(angulos, config) {
  // Ordena por canal para que s1..sN correspondan a los canales 0..N-1.
  const porCanal = config.articulaciones
    .map((a, i) => ({ canal: a.servo?.canal ?? i, valor: anguloServo(angulos[i], a) }))
    .sort((x, y) => x.canal - y.canal)
    .map((x) => x.valor.toFixed(1));
  return `S,${porCanal.join(',')}`;
}
