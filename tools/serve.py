"""Serve the website folder for local viewing, with caching turned off so
edits always show on reload. Usage (from Portfolio V9): python3 tools/serve.py [port]"""
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8793
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
http.server.ThreadingHTTPServer(("", port), NoCache).serve_forever()
