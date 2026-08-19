import json
from http.server import BaseHTTPRequestHandler, HTTPServer


HOST = "127.0.0.1"
PORT = 6000
PAYLOAD = [
    {
        "hostname": "demo-arista-sw01",
        "hardwareType": "Arista Switch",
        "role": "switch",
        "managementIp": "10.92.253.188",
        "site": "DCC",
        "findings": [
            {
                "AS015": "From the configuration file, below line MUST exist:\nmanagement console\n   idle-timeout 15"
            }
        ],
        "actualConfig": [
            {
                "AS015": [
                    658,
                    "management console\n   idle-timeout 10"
                ]
            }
        ],
        "complyStatus": False,
    }
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps(PAYLOAD, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), Handler)
    print(f"Serving JSON payload at http://{HOST}:{PORT}/")
    server.serve_forever()
