"""
Serveur HTTPS minimal pour le frontend QuoteKeeper.

Lance par run.py en sous-processus.
Arguments : <frontend_dir> <port> <cert_path> <key_path>
"""

import http.server
import ssl
import sys
from pathlib import Path

if __name__ == "__main__":
    frontend_dir, port, cert_path, key_path = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]

    import os
    os.chdir(frontend_dir)

    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *args: None  # Supprime les logs de requetes

    httpd = http.server.HTTPServer(("", port), handler)

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(certfile=cert_path, keyfile=key_path)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

    httpd.serve_forever()
