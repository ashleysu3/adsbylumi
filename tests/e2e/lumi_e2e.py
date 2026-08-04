"""Shared helpers for LUMI end-to-end tests.

Restores the injected Lovable/Supabase session into a Playwright context so the
tests run as the signed-in preview user, and provides a thin wrapper for calling
edge functions with that same session token.
"""

import json
import os
import urllib.request
from pathlib import Path

BASE_URL = "http://localhost:8080"
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


def _read_env_file() -> dict:
    env: dict[str, str] = {}
    dotenv = Path(__file__).resolve().parents[2] / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = _read_env_file()
SUPABASE_URL = os.environ.get("SUPABASE_URL") or ENV.get("VITE_SUPABASE_URL", "")
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY") or ENV.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")


def auth_status() -> str:
    return os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "unknown")


def access_token() -> str | None:
    return os.environ.get("LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN")


async def restore_session(context, page) -> bool:
    """Restore the injected Supabase session. Returns False when unavailable."""
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE_URL
        await context.add_cookies(cookies)

    await page.goto(BASE_URL, wait_until="domcontentloaded")

    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )
        return True
    return False


def call_function(name: str, payload: dict) -> dict:
    """POST to a Supabase edge function using the injected session token."""
    token = access_token()
    if not token:
        raise RuntimeError(
            "No LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN. Sign in to the Lovable preview and retry."
        )
    req = urllib.request.Request(
        f"{SUPABASE_URL}/functions/v1/{name}",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "apikey": ANON_KEY,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read().decode())


def collect_console(page, sink: list):
    page.on("console", lambda m: sink.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: sink.append(f"[pageerror] {e}"))
