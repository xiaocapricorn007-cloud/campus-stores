"""Campus Stores desk server.

Serves the static app and a small JSON API that issues and verifies
HS256 JSON Web Tokens. Standard library only:

    python server.py            # http://127.0.0.1:8000
    python server.py 9000       # another port

There is one sample account for the person working the desk:
username Deskstaff (not case-sensitive), password Deskstaff123.
Club members such as Isha or Kabir borrow equipment; they never sign in.
These are sample credentials for a fictional exercise, not a pattern for
real accounts.

Set CAMPUS_JWT_SECRET to keep tokens valid across restarts; otherwise a
random secret is generated each time the server starts.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SECRET = os.environ.get("CAMPUS_JWT_SECRET", "").encode() or secrets.token_bytes(32)
TOKEN_TTL = 8 * 60 * 60  # one desk shift
PBKDF2_ROUNDS = 200_000
MAX_FAILURES = 5  # per client address, per window
FAILURE_WINDOW = 60  # seconds

# (username, display name, password). Only desk staff sign in.
ACCOUNTS = [("deskstaff", "Desk staff", "Deskstaff123")]


def _hash(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)


def _seed_users() -> dict:
    users = {}
    for username, name, password in ACCOUNTS:
        salt = secrets.token_bytes(16)
        users[username] = {"name": name, "salt": salt, "hash": _hash(password, salt)}
    return users


USERS = _seed_users()
_DUMMY_SALT = secrets.token_bytes(16)
_failures: dict[str, list[float]] = {}


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue_token(username: str) -> tuple[str, int]:
    now = int(time.time())
    exp = now + TOKEN_TTL
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": username, "name": USERS[username]["name"], "iat": now, "exp": exp}
    signing_input = (
        _b64url(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + _b64url(json.dumps(payload, separators=(",", ":")).encode())
    )
    signature = hmac.new(SECRET, signing_input.encode(), hashlib.sha256).digest()
    return signing_input + "." + _b64url(signature), exp


def verify_token(token: str) -> dict | None:
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
        header = json.loads(_b64url_decode(header_b64))
        if header.get("alg") != "HS256":  # refuse "none" and algorithm swaps
            return None
        expected = hmac.new(
            SECRET, f"{header_b64}.{payload_b64}".encode(), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(expected, _b64url_decode(sig_b64)):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if not isinstance(payload.get("exp"), int) or payload["exp"] <= time.time():
            return None
        if payload.get("sub") not in USERS:
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def check_password(username: str, password: str) -> bool:
    user = USERS.get(username)
    # Hash even for unknown users so response time doesn't reveal which names exist.
    digest = _hash(password, user["salt"] if user else _DUMMY_SALT)
    return bool(user) and hmac.compare_digest(digest, user["hash"])


def _too_many_failures(client: str) -> bool:
    cutoff = time.time() - FAILURE_WINDOW
    recent = [t for t in _failures.get(client, []) if t > cutoff]
    _failures[client] = recent
    return len(recent) >= MAX_FAILURES


class DeskHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, status: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/me":
            auth = self.headers.get("Authorization", "")
            claims = verify_token(auth[7:]) if auth.startswith("Bearer ") else None
            if not claims:
                return self._json(HTTPStatus.UNAUTHORIZED, {"error": "Not signed in."})
            return self._json(
                HTTPStatus.OK,
                {"user": {"username": claims["sub"], "name": claims["name"]}, "exp": claims["exp"]},
            )
        if path.startswith("/api/"):
            return self._json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
        # Serve only the app itself, never the server source or dotfiles.
        if path.endswith(".py") or "/." in path:
            return self.send_error(HTTPStatus.NOT_FOUND)
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/login":
            return self._json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
        client = self.client_address[0]
        if _too_many_failures(client):
            return self._json(
                HTTPStatus.TOO_MANY_REQUESTS,
                {"error": "Too many attempts. Wait a minute and try again."},
            )
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 4096:
                raise ValueError
            body = json.loads(self.rfile.read(length) or b"{}")
            username = str(body.get("username", "")).strip().lower()
            password = str(body.get("password", ""))
        except (ValueError, json.JSONDecodeError, AttributeError):
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "Send a username and password."})
        if not check_password(username, password):
            _failures.setdefault(client, []).append(time.time())
            return self._json(HTTPStatus.UNAUTHORIZED, {"error": "Wrong username or password."})
        _failures.pop(client, None)
        token, exp = issue_token(username)
        return self._json(
            HTTPStatus.OK,
            {
                "token": token,
                "expiresAt": exp,
                "user": {"username": username, "name": USERS[username]["name"]},
            },
        )

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), DeskHandler)
    print(f"Campus Stores desk running at http://localhost:{port}  (Ctrl+C to stop)")
    print("Sign in as Deskstaff / Deskstaff123")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
