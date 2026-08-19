from http.server import BaseHTTPRequestHandler, HTTPServer


HOST = "127.0.0.1"
PORT = 6000
PAYLOAD = "hello from local test api"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = PAYLOAD.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), Handler)
    print(f"Serving {PAYLOAD!r} at http://{HOST}:{PORT}/")
    server.serve_forever()
