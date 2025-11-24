import http.server
import socketserver
import os
import json
import urllib.parse

PORT = 8002
EXTERNAL_MODELS_DIR = r"D:\developer\foresighted\three.js-master\three.js-master\examples\models\gltf"
CONFIG_FILE = "model_config.json"

web_dir = os.path.join(os.path.dirname(__file__))
os.chdir(web_dir)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # API: List Models
        if self.path == '/api/models':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            models = []
            if os.path.exists(EXTERNAL_MODELS_DIR):
                try:
                    for f in os.listdir(EXTERNAL_MODELS_DIR):
                        if f.lower().endswith(('.glb', '.gltf')):
                            models.append(f)
                except Exception as e:
                    print(f"Error listing models: {e}")
            
            self.wfile.write(json.dumps(models).encode())
            return

        # API: Get Config
        if self.path == '/api/config':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            config = {}
            if os.path.exists(CONFIG_FILE):
                try:
                    with open(CONFIG_FILE, 'r') as f:
                        config = json.load(f)
                except:
                    pass
            self.wfile.write(json.dumps(config).encode())
            return

        # Serve External Models
        if self.path.startswith('/external_models/'):
            filename = urllib.parse.unquote(self.path.replace('/external_models/', ''))
            file_path = os.path.join(EXTERNAL_MODELS_DIR, filename)
            
            if os.path.exists(file_path) and os.path.isfile(file_path):
                self.send_response(200)
                # Guess mime type
                if filename.endswith('.glb'):
                    self.send_header('Content-type', 'model/gltf-binary')
                else:
                    self.send_header('Content-type', 'application/json')
                self.send_header('Content-Length', os.path.getsize(file_path))
                self.end_headers()
                
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
                return
            else:
                self.send_error(404, "Model not found")
                return

        # Default Static Files
        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/config':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                config = json.loads(post_data.decode('utf-8'))
                with open(CONFIG_FILE, 'w') as f:
                    json.dump(config, f, indent=4)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode())
            except Exception as e:
                self.send_error(500, str(e))
            return

Handler = CustomHandler
Handler.extensions_map.update({
    ".js": "application/javascript",
})

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving ARPG at http://localhost:{PORT}")
    print(f"External Models Dir: {EXTERNAL_MODELS_DIR}")
    httpd.serve_forever()
