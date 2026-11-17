# Brazo robot VR

Simulador y programador de un brazo robótico de 6 grados de libertad, hecho con
tecnologías de navegador (Three.js + WebXR). Corre en el navegador del
**Meta Quest 2** en realidad virtual y también en cualquier navegador de PC
para probarlo sin visor.

Con la app puedes:

- **Mover** el brazo articulación por articulación, moviendo la punta en X, Y
  y Z (cinemática inversa), o agarrando la punta (esfera naranja) y
  arrastrándola.
- **Abrir y cerrar la pinza** y tomar los cubos de la mesa.
- **Programarlo**: grabar poses como puntos (con la apertura de la pinza y el
  tipo de movimiento: articular o lineal), ordenarlos, editarlos o borrarlos,
  y guardar o cargar programas (en el navegador o como archivo JSON).
- **Verlo junto al brazo real** con fondo de sala real (passthrough), con el
  panel, las pantallas y el brazo virtual movibles a donde te acomode.
- **Manejarlo con los controles del Quest**: palancas y botones asignables.
- **Practicar rutinas** con objetos (cubos, cilindros, pelotas, bandejas y
  manchas para limpiar) y grabar trayectorias.
- **Simularlo**: reproducir el programa en tiempo real respetando los límites
  de cada articulación y su velocidad máxima, con los ángulos a la vista.

Está pensada para que en una **versión 2** se conecte al brazo real: toda
orden pasa por un "driver" intercambiable (hoy el simulador; después USB o
Wi-Fi hacia un ESP32/Arduino).

> **Estado:** la versión de escritorio está probada y la VR básica se probó en
> el Quest 2. El panel con pestañas, el panel de muñeca, los controles
> asignables, el fondo de sala real y los objetos todavía no se han probado en
> el visor.

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
| Mover la punta en X / Y / Z | Botones −10, −1, +1, +10 (mm) o escribir la coordenada |
| Abrir / cerrar la pinza | `G`, botón o deslizador de la pinza |
| Grabar trayectoria | `T` (otra vez para terminar) |
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

Pulsa **Entrar al visor**. Si el Quest lo permite, la app entra en una sesión
de realidad mixta con **fondo virtual** (se ve igual que VR) y desde el panel
(*Escena → Fondo*) pasas a ver **tu sala real** (passthrough; en el Quest 2 en
blanco y negro) sin salir del visor. Si el navegador no permite realidad
mixta, entra en VR normal y el panel lo indica.

- Delante tuyo, a unos 55 cm, está la **mesa** con el **brazo naranja y gris**
  y tres cubos.
- A tu **izquierda** flota el **panel principal**, con pestañas:
  - **Mover**: deslizadores J1–J6 (o X/Y/Z de la punta con *Mando*), pinza y
    velocidad; *Grabar punto*, *Reproducir*, *Abrir/Cerrar pinza*, tipo de
    punto (*articular* o *lineal*), *Grabar trayectoria*, *Ir a inicio*,
    *Borrar último* y *Bucle*.
  - **Programa**: la lista de puntos (6 por página). Al tocar uno se edita su
    velocidad, pausa y pinza, y se puede ir a él, reproducir desde ahí,
    cambiar su tipo, reemplazarlo por la pose actual, insertar uno después,
    subirlo, bajarlo o borrarlo.
  - **Archivos**: guardar, guardar como nuevo, programa nuevo, la lista de
    programas guardados en el visor (cargar o borrar) y los dos ejemplos.
  - **Objetos**: agregar cubos, cilindros, pelotas, bandejas y manchas al
    alcance del brazo, quitarlos y reiniciar la mesa.
  - **Escena**: fondo virtual o sala real, mesa virtual, pantallas, fuente de
    cada cámara, *Traer panel aquí*, panel de muñeca y *Ordenar todo*.
  - **Controles**: qué hace cada palanca y botón del control (ver abajo).
- En el **control izquierdo** va un **panel rápido** (como un reloj): Grabar,
  Reproducir, Pinza, Guardar, Traer panel y Trayectoria. Se apunta con el
  rayo del control derecho.
- A tu **derecha** están las **pantallas** de las cámaras de la pinza y del
  ambiente.
- **Gatillo** sobre un panel: pulsar botones y arrastrar deslizadores.
- **Grip** (o gatillo) cerca de la esfera naranja de la punta, o apuntándola:
  el brazo sigue tu mano (cinemática inversa).
- **Grip** apuntando a un objeto, al panel, a una pantalla o a la base del
  brazo: lo mueves con la mano; la palanca adelante/atrás lo aleja o acerca.
  Los objetos caen al soltarlos; el panel, las pantallas y el brazo quedan
  donde los dejes (guardado).

### Controles del Quest (por defecto)

| Control | Capa 1 | Con Y apretado (capa 2) |
|---|---|---|
| Palanca izquierda ←→ | J1 Base | J6 Giro herramienta |
| Palanca izquierda ↑↓ | J2 Hombro | J5 Flexión muñeca |
| Palanca derecha ←→ | J4 Giro muñeca | — |
| Palanca derecha ↑↓ | J3 Codo | Pinza |

| Botón | Acción |
|---|---|
| A | Abrir / cerrar pinza |
| B | Grabar punto |
| X | Reproducir / detener |
| Y | Capa 2 (mantener) |
| Clic palanca izquierda | Traer el panel frente a ti |
| Clic palanca derecha | Detener |

Todo se cambia en la pestaña **Controles** (cada fila pasa a la siguiente
opción al tocarla): las palancas pueden mover cualquier articulación, la punta
en X/Y/Z o la pinza, y los botones cualquier acción. Queda guardado en el
visor.

### Rutinas típicas

- **Pick and place**: punto arriba del objeto (articular), punto abajo
  (lineal, velocidad baja), mismo punto con la pinza cerrada, arriba
  (lineal), sobre el destino, abajo, abrir, arriba. Ejemplo: *Archivos →
  Ejemplo: recoger y dejar*.
- **Limpiar la mesa**: agrega manchas (*Objetos → + 6 manchas*) y recorre la
  mesa con la punta a menos de 4 cm de altura. Ejemplo: *Archivos → Ejemplo:
  limpiar la mesa*, que barre la zona de trabajo en arcos.
- **Grabar un movimiento**: *Grabar trayectoria*, mueve el brazo con la mano,
  las palancas o los deslizadores, y vuelve a pulsar para terminar. Se guarda
  un punto cada 0,2 s con su tiempo, y al reproducir se repite con el mismo
  ritmo (sin pasar las velocidades máximas).

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
- `herramienta.pinza`: apertura mínima y máxima, velocidad y servo de la pinza.
- `velLineal`: velocidad máxima de la punta en movimientos lineales.

La cinemática inversa (CCD, en [`js/ik.js`](js/ik.js)) solo busca la
**posición** de la punta, no su orientación: la orientación de la herramienta
se ajusta a mano con J4–J6.

## Formato de los programas

```json
{
  "formato": "brazo-robot-vr/programa",
  "version": 2,
  "nombre": "Recoger y dejar",
  "brazo": "Brazo 6 GDL de escritorio (genérico)",
  "articulaciones": ["J1", "J2", "J3", "J4", "J5", "J6"],
  "puntos": [
    { "angulos": [0, 15, 75, 0, 70, 0], "pinza": 50, "tipo": "articular", "velocidad": 100, "pausa": 0.5 }
  ]
}
```

- `angulos`: grados, en el orden J1…J6. Al importar se recortan a los límites.
- `pinza`: apertura en mm que la pinza toma **al llegar** al punto.
- `tipo`: `articular` (cada articulación va directo a su ángulo; la punta
  describe una curva, es lo más rápido) o `lineal` (la punta va en línea
  recta, útil para bajar a tomar una pieza).
- `velocidad`: % de la velocidad máxima para llegar a ese punto (5–100).
- `pausa`: segundos de espera al llegar (después de mover la pinza).
- `tiempo` (opcional): segundos para llegar desde el punto anterior; lo usan
  las trayectorias grabadas, que se recorren a velocidad constante.

En cada punto: primero el brazo llega, luego la pinza se ajusta y al final
corre la pausa. La duración de cada tramo se calcula para que ninguna
articulación pase su `velMax` ni la punta su `velLineal`. Los programas de la
versión 1 (sin `pinza` ni `tipo`) se siguen abriendo.

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
js/panel-vr.js           panel flotante (canvas) para VR y ratón: dibujo y toques
js/vr.js                 entrada al visor, rayos, agarre y mover objetos
js/camaras.js            cámaras simuladas, pantallas y webcams
js/fuentes.js            elección de la fuente de cada pantalla
js/objetos.js            objetos (cubos, cilindros, pelotas, bandejas, manchas)
js/mandos.js             palancas y botones del Quest asignables
js/paneles.js            contenido del panel con pestañas y del de muñeca
js/disposicion.js        mover panel, pantallas y brazo; posiciones guardadas
js/puntero-escritorio.js ratón sobre el panel 3D y la punta
js/ui-escritorio.js      panel lateral HTML y teclado
js/drivers/              simulador + esqueletos USB y Wi-Fi (versión 2)
ejemplos/                programas de ejemplo
servidor.py              servidor local (HTTP o HTTPS, sin caché)
```

En la consola del navegador, `window.app` da acceso al estado para depurar.

## Versión 2: conectar el brazo real

La app ya envía los ángulos reales ~25 veces por segundo al driver activo
(`enviarAngulos(angulos, pinza)`). La trama propuesta está en
[`js/drivers/protocolo.js`](js/drivers/protocolo.js):

```
S,90.0,105.0,165.0,90.0,160.0,90.0,40.0
```

(ángulo de cada servo, 0–180°, ordenado por canal; el último es el servo de la
pinza). En "Hardware" se ve la
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

- Sin detección de colisiones (el brazo puede atravesar la mesa y los cubos).
- La IK solo controla la posición de la punta; la orientación de la pinza se
  ajusta con J4–J6.
- Los objetos se toman cuando la pinza se cierra a su ancho con el objeto
  entre los dedos; la "física" es solo una caída vertical al soltarlos (se
  apoyan en la mesa, en el plano del brazo, sobre otro objeto o en el piso).
- En el visor no hay teclado: los programas nuevos se nombran solos
  ("Programa 2", "… (1)"); para renombrarlos, usa el PC.
- Mover objetos solo se puede en VR (en el PC la cámara se mueve con el ratón).
- Necesita internet para descargar Three.js desde el CDN.
