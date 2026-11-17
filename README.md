# Brazo robot VR

Simulador y programador de un brazo robótico de 6 grados de libertad, hecho con
tecnologías de navegador (Three.js + WebXR). Corre en el navegador del
**Meta Quest 2** en realidad virtual y también en cualquier navegador de PC
para probarlo sin visor.

Con la app puedes:

- **Mover** el brazo articulación por articulación (deslizadores) o agarrando
  la punta (esfera naranja) y arrastrándola: la cinemática inversa calcula
  los ángulos.
- **Programarlo**: grabar poses como puntos, ordenarlos, editarlos o borrarlos,
  y guardar o cargar programas (en el navegador o como archivo JSON).
- **Simularlo**: reproducir el programa en tiempo real respetando los límites
  de cada articulación y su velocidad máxima, con los ángulos a la vista.

Está pensada para que en una **versión 2** se conecte al brazo real: toda
orden pasa por un "driver" intercambiable (hoy el simulador; después USB o
Wi-Fi hacia un ESP32/Arduino).

> **Estado:** la versión de escritorio está probada (deslizadores, arrastre de
> la punta, grabar, reproducir, guardar, importar). **La parte de VR no se ha
> probado todavía en un Quest.**

## Probar en el PC

No hay nada que compilar. Solo hace falta servir la carpeta por HTTP (abrir
`index.html` con doble clic no funciona porque los módulos de JavaScript
necesitan un servidor). Con Python, que ya está instalado:

```bash
python servidor.py
```

y abre <http://localhost:8000/> en Chrome o Edge. Hace falta internet: Three.js
se descarga de un CDN (versión fija r169).

Controles en escritorio:

| Acción | Cómo |
|---|---|
| Girar / acercar la cámara | Arrastrar con el botón izquierdo / rueda. Botón derecho desplaza |
| Mover una articulación | Deslizadores del panel derecho, o teclas `1`–`6` para elegir y `←` `→` (o `A` `D`) para mover; con `Shift` el paso es de 10° |
| Mover la punta (IK) | Arrastrar la esfera naranja de la pinza |
| Grabar punto | `R` o "Grabar punto" |
| Reproducir / detener | `Espacio` |
| Ir a la pose de inicio | `H` |
| Detener en seco | `Esc` |

El panel flotante que se usa en VR también aparece en la escena de escritorio y
se puede usar con el ratón (se oculta en "Hardware → Mostrar el panel VR").

## Probar en el Meta Quest 2

WebXR solo funciona en un **contexto seguro**: una página `https://` o
`http://localhost`. Hay tres formas; la primera es la más simple.

### Opción A: GitHub Pages (recomendada)

1. Crea un repositorio en GitHub (por ejemplo `brazo-robot-vr`) y sube esta
   carpeta:

   ```bash
   git remote add origin https://github.com/<tu-usuario>/brazo-robot-vr.git
   ```

   ```bash
   git push -u origin main
   ```

2. En GitHub: **Settings → Pages → Build and deployment → Deploy from a
   branch**, rama `main`, carpeta `/ (root)`. Guarda y espera uno o dos minutos.
3. En el Quest abre el **navegador** (Meta Quest Browser) y entra a
   `https://<tu-usuario>.github.io/brazo-robot-vr/`.
4. Pulsa **Entrar en VR** (arriba a la derecha) y acepta el permiso.

Para cargar el programa de ejemplo de una vez:
`https://<tu-usuario>.github.io/brazo-robot-vr/?programa=ejemplos/recoger-y-dejar.json`

Cada `git push` actualiza la página. Si el Quest muestra la versión anterior,
recarga la página.

### Opción B: por cable USB con `adb reverse`

Sirve para iterar rápido sin publicar. Requiere el **modo desarrollador** del
Quest y `adb` (viene con Meta Quest Developer Hub o con las *platform-tools*
de Android; no está instalado en este PC).

```bash
python servidor.py
```

```bash
adb reverse tcp:8000 tcp:8000
```

Luego, en el navegador del Quest, abre `http://localhost:8000/`. Como es
`localhost`, cuenta como contexto seguro y la VR funciona sin certificado.

### Opción C: Wi-Fi local con certificado propio

El PC y el Quest en la misma red. Genera un certificado autofirmado (OpenSSL
viene con Git para Windows; cambia la IP por la de tu PC):

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout clave.pem -out cert.pem -days 365 -subj "/CN=brazo-vr" -addext "subjectAltName=IP:192.168.1.50"
```

```bash
python servidor.py --puerto 8443 --cert cert.pem --clave clave.pem
```

En el Quest abre `https://192.168.1.50:8443/`, acepta la advertencia del
certificado ("Avanzado → Continuar") y entra en VR. Windows puede pedir
permiso del firewall para Python la primera vez. *Por confirmar:* que el
navegador del Quest permita WebXR después de aceptar un certificado
autofirmado. Los archivos `.pem` están en `.gitignore`.

## Qué se ve y cómo se usa en VR

- Estás de pie frente a una **mesa de madera** con una cuadrícula de 5 cm, a
  unos 55 cm delante tuyo. Sobre ella está el **brazo naranja y gris** con una
  pinza, un cubo azul y uno verde como referencia.
- A tu **izquierda**, a la altura del pecho y girado hacia ti, flota el
  **panel**: 6 deslizadores (J1 a J6, con el ángulo real a la derecha y un
  triángulo azul que marca dónde va el brazo), uno de velocidad y los botones
  *Grabar punto*, *Reproducir/Detener*, *Borrar último*, *Bucle*,
  *Ir a inicio* y *Guardar*.
- Cada control emite un **rayo** celeste. Apunta al panel y usa el
  **gatillo** para pulsar botones o arrastrar deslizadores.
- Para mover la punta: acerca la mano a la **esfera naranja** de la pinza (o
  apúntala con el rayo) y mantén el **grip** (botón lateral) o el gatillo. El
  brazo sigue a tu mano con su velocidad máxima; aparece una esfera celeste
  de alambre donde está el objetivo. El control vibra al agarrar.
- Flujo típico: mueve el brazo, *Grabar punto*, repite, y *Reproducir*.
  Arriba a la derecha del panel se lee hacia qué punto va.
- A tu **derecha** hay dos **pantallas**: arriba la *Cámara pinza* (lo que ve
  una cámara montada en la pinza, se mueve con el brazo) y abajo la *Cámara
  ambiente* (una cámara en un trípode detrás de la mesa, a la izquierda).
  La tercera fila de botones del panel las oculta (*Pantallas*) y cambia la
  fuente de cada una (*Pinza*, *Amb.*).

## Cámaras

Hoy cada pantalla puede mostrar:

- **Simulada**: lo que vería una cámara en esa posición (se configura en
  `camaras` de `js/config-brazo.js`).
- **Webcam de este equipo**: en el PC, botón "Buscar webcams" en la sección
  Cámaras. Sirve para probar una cámara real en la pantalla virtual. El Quest
  no ofrece webcams al navegador.
- **Apagada**.

Por dentro, cualquier video que llegue como `MediaStream` se puede mostrar con
`app.camaras.fijarStream(indice, stream, 'Nombre')` (ver
[`js/camaras.js`](js/camaras.js)). Así, la transmisión desde el brazo real
solo tiene que entregar un `MediaStream`.

### Transmitir las cámaras reales al Quest (versión 2, por decidir)

| Camino | Cómo | A favor | En contra |
|---|---|---|---|
| **Webcams USB en un PC + WebRTC** | Las cámaras (una mini USB en la pinza y otra en el espacio) van a un PC. Una página "emisora" las captura y las envía por WebRTC a la app del Quest | Buena calidad, baja latencia, funciona con HTTPS (GitHub Pages) | Cable USB por el brazo; necesita un servicio de "señalización" para conectar los dos navegadores (uno público gratuito o uno propio en el PC) |
| **ESP32-CAM / XIAO ESP32-S3 Sense en la pinza** | La cámara Wi-Fi sirve video MJPEG por HTTP | Liviana, inalámbrica, barata | Una página HTTPS no puede mostrar `http://`: hace falta un puente en el PC o servir la app por `adb reverse`; calidad y cuadros por segundo menores |
| **Celular como cámara** | Un celular viejo abre la página emisora y transmite por WebRTC | No hay que comprar nada | Sirve para la cámara del espacio, no para la pinza |

Los programas guardados en el Quest quedan en el almacenamiento de su
navegador, separados de los del PC. Para pasarlos de uno a otro usa
*Exportar JSON* en el PC y súbelo junto a la app (como el ejemplo de
`ejemplos/`), o ábrelo con `?programa=`.

## Adaptarlo a tu brazo real

Todo el brazo se define en [`js/config-brazo.js`](js/config-brazo.js):

- `origen`: distancia entre ejes consecutivos (en metros), medida en el
  sistema de la articulación anterior. Con todo en 0° el brazo queda vertical.
- `eje`: alrededor de qué eje local gira (`'x'`, `'y'`, `'z'` o un vector).
- `min` / `max`: límites mecánicos en grados.
- `velMax`: velocidad máxima en °/s.
- `inicial`: pose de reposo.
- `pesoIK`: cuánto participa cada articulación al arrastrar la punta (por
  defecto los giros de muñeca y herramienta no participan).
- `servo`: canal, ángulo de centro y sentido para traducir a la orden del
  servo (para la versión 2).

La cinemática inversa (CCD, en [`js/ik.js`](js/ik.js)) solo busca la
**posición** de la punta, no su orientación: la orientación de la herramienta
se ajusta a mano con J4–J6.

## Formato de los programas

```json
{
  "formato": "brazo-robot-vr/programa",
  "version": 1,
  "nombre": "Recoger y dejar",
  "brazo": "Brazo 6 GDL de escritorio (genérico)",
  "articulaciones": ["J1", "J2", "J3", "J4", "J5", "J6"],
  "puntos": [
    { "angulos": [0, 15, 75, 0, 70, 0], "velocidad": 100, "pausa": 0.5 }
  ]
}
```

- `angulos`: grados, en el orden J1…J6. Al importar se recortan a los límites.
- `velocidad`: % de la velocidad máxima para llegar a ese punto (5–100).
- `pausa`: segundos de espera al llegar.

Entre puntos se interpola en espacio articular con una curva suave; la
duración de cada tramo se calcula para que ninguna articulación pase su
`velMax`.

## Estructura

```
index.html               página y mapa de importación de Three.js
css/estilos.css          estilos del panel de escritorio
js/config-brazo.js       definición del brazo (lo que hay que editar)
js/brazo.js              cadena cinemática y modelo 3D
js/ik.js                 cinemática inversa CCD
js/controlador.js        ángulos objetivo/real con límite de velocidad
js/programa.js           programas, reproductor, localStorage, JSON
js/app.js                estado y acciones compartidas
js/panel-vr.js           panel flotante (canvas) para VR y ratón
js/vr.js                 botón "Entrar en VR", controles, agarre
js/camaras.js            cámaras simuladas, pantallas y webcams
js/fuentes.js            elección de la fuente de cada pantalla
js/puntero-escritorio.js ratón sobre el panel 3D y la punta
js/ui-escritorio.js      panel lateral HTML y teclado
js/drivers/              simulador + esqueletos USB y Wi-Fi (versión 2)
ejemplos/                programas de ejemplo
servidor.py              servidor local (HTTP o HTTPS, sin caché)
```

En la consola del navegador, `window.app` da acceso al estado para depurar.

## Versión 2: conectar el brazo real

La app ya envía los ángulos reales ~25 veces por segundo al driver activo
(`enviarAngulos(angulos)`). La trama propuesta está en
[`js/drivers/protocolo.js`](js/drivers/protocolo.js):

```
S,90.0,105.0,165.0,90.0,160.0,90.0
```

(ángulo de cada servo, 0–180°, ordenado por canal). En "Hardware" se ve la
última trama que se mandaría. Los drivers USB y Wi-Fi son esqueletos sin
implementar.

Puntos a decidir antes de implementarla:

- **Web Serial (USB)** funciona en Chrome/Edge de PC, pero **no en el
  navegador del Quest**. Sirve para probar el brazo desde el PC.
- **WebSocket (Wi-Fi) hacia un ESP32** es el camino para el Quest, pero una
  página `https://` solo puede abrir `wss://` (con TLS), y un ESP32 normalmente
  sirve `ws://`. Alternativas: servir la app como `http://localhost` con
  `adb reverse` (opción B; *por confirmar* que el Quest permita entonces
  `ws://` hacia la red local), poner TLS en el ESP32, o un pequeño puente en el
  PC que reciba `wss://` y reenvíe por USB al ESP32.
- Seguridad: el firmware debería volver a limitar ángulos y cortar los servos
  si deja de recibir órdenes por más de ~0,5 s.

## Limitaciones conocidas

- Sin detección de colisiones (el brazo puede atravesar la mesa).
- La IK solo controla la posición de la punta.
- Necesita internet para descargar Three.js desde el CDN.
