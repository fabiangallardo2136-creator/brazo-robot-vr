"""Servidor local para probar la app (solo biblioteca estándar de Python).

Uso:
  python servidor.py                       -> http://localhost:8000 (escritorio)
  python servidor.py --puerto 8443 --cert cert.pem --clave clave.pem
                                           -> https://<IP-del-PC>:8443 (para el Quest)

Envía las cabeceras "no-cache" para que el navegador siempre cargue la última
versión de los archivos mientras desarrollas.
"""
import argparse
import http.server
import socket
import ssl
from functools import partial
from pathlib import Path


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def ip_local():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    p = argparse.ArgumentParser(description="Servidor local del brazo robot VR")
    p.add_argument("--puerto", type=int, default=8000)
    p.add_argument("--cert", help="certificado PEM para HTTPS")
    p.add_argument("--clave", help="clave privada PEM para HTTPS")
    a = p.parse_args()

    raiz = Path(__file__).resolve().parent
    manejador = partial(SinCache, directory=str(raiz))
    servidor = http.server.ThreadingHTTPServer(("0.0.0.0", a.puerto), manejador)
    esquema = "http"
    if a.cert and a.clave:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(a.cert, a.clave)
        servidor.socket = ctx.wrap_socket(servidor.socket, server_side=True)
        esquema = "https"

    print(f"Sirviendo {raiz}")
    print(f"  En este PC:      {esquema}://localhost:{a.puerto}/")
    print(f"  En la red local: {esquema}://{ip_local()}:{a.puerto}/")
    if esquema == "http":
        print("  Ojo: el Quest solo permite VR por HTTPS (o por http://localhost con adb reverse).")
    print("Ctrl+C para detener.")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
