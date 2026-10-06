#!/usr/bin/env python3
"""
Smoke test for a running Debo Labs server - the deploy pipeline's final gate (see
.github/workflows/deploy.yml), also handy against `docker compose up`.

Walks the Elastic Beanstalk lab through a real WebSocket terminal exactly like a
browser does (one message per keystroke, with an Origin), then a Linux lab, and
asserts the live request guards refuse a cross-origin request.

Usage: python3 smoke-test.py <hostname, no scheme>
       python3 smoke-test.py localhost:8080   (plain http/ws; the local profile)

Hosted: set LAB_ACCESS_TOKEN (one of the invite tokens) so the gated labs can be tested.
Needs: pip install websockets
"""
import asyncio
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

import websockets


def is_local(host):
    return host.startswith(("localhost", "127.0.0.1"))


def origin_of(host):
    return f"{'http' if is_local(host) else 'https'}://{host}"


def http_json(host, ctx, method, path, body=None, origin=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Lab-Token"] = token
    if origin:
        headers["Origin"] = origin
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{origin_of(host)}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, None


def get_status(host, ctx, path):
    try:
        with urllib.request.urlopen(f"{origin_of(host)}{path}", context=ctx) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


async def check_until(host, ctx, token, step, expected, attempts=8, delay=2.0):
    # A fixed sleep-then-check is flaky over real network latency to a live AWS
    # environment - poll instead of hoping one wait was long enough.
    result = None
    for _ in range(attempts):
        _, result = http_json(host, ctx, "POST", "/lab/check", {"token": token, "stepId": step}, origin_of(host))
        if result["pass"] == expected:
            return result
        await asyncio.sleep(delay)
    return result


class Terminal:
    def __init__(self, ws):
        self.ws = ws
        self.buf = ""

    async def drain(self, wait=0.3):
        try:
            while True:
                self.buf += await asyncio.wait_for(self.ws.recv(), timeout=wait)
        except asyncio.TimeoutError:
            pass

    async def type_line(self, line):
        # One WebSocket message per keystroke, like a real browser terminal.
        for ch in line + "\r":
            await self.ws.send(ch)
            await asyncio.sleep(0.01)


async def main(host):
    ctx = ssl.create_default_context()
    origin = origin_of(host)

    def expect(condition, message):
        if not condition:
            print(f"FAIL: {message}")
            sys.exit(1)
        print(f"ok:   {message}")

    for path in ("/", "/t/aws", "/healthz"):
        expect(get_status(host, ctx, path) == 200, f"GET {path} is 200")
    _, stats = http_json(host, ctx, "GET", "/stats")
    expect("cpuPercent" in stats and "memUsedMb" in stats and "maxSessions" in stats, "/stats returns real fields")

    status, _ = http_json(host, ctx, "POST", "/session", {"track": "aws", "lab": "elastic-beanstalk-cluster-mode"}, "https://evil.example")
    expect(status == 403, "a cross-origin POST /session is refused")

    # Every lab is invite-gated on the hosted app. Any one of the comma-separated tokens works.
    invite = os.environ.get("LAB_ACCESS_TOKEN", "").split(",")[0].strip()
    if not is_local(host):
        status, _ = http_json(host, ctx, "POST", "/session", {"track": "aws", "lab": "elastic-beanstalk-cluster-mode"}, origin)
        expect(status == 401, "the gated lab refuses a session without an invite code")
        status, _ = http_json(host, ctx, "POST", "/session", {"track": "aws", "lab": "elastic-beanstalk-cluster-mode"}, origin, token="wrong-code")
        expect(status == 401, "the gated lab refuses a wrong invite code")
        status, _ = http_json(host, ctx, "POST", "/session", {"track": "linux-fundamentals", "lab": "navigating"}, origin)
        expect(status == 401, "every lab needs an invite code on the hosted app, not just Cluster Mode")
        if not invite:
            sys.exit("LAB_ACCESS_TOKEN is not set: cannot smoke-test the gated lab")

    async def open_terminal(track, lab):
        status, body = http_json(host, ctx, "POST", "/session", {"track": track, "lab": lab}, origin, token=invite or None)
        expect(status == 200 and body.get("token"), f"POST /session mints a seat for {track}/{lab}")
        uri = f"{'ws' if is_local(host) else 'wss'}://{host}/ws?token={body['token']}"
        ws = await websockets.connect(uri, ssl=(None if is_local(host) else ctx), origin=origin)
        term = Terminal(ws)
        await asyncio.sleep(0.8)
        await term.drain()
        return body["token"], term

    # --- the Elastic Beanstalk lab, step by step -------------------------------
    token, term = await open_terminal("aws", "elastic-beanstalk-cluster-mode")
    try:
        r = await check_until(host, ctx, token, "hostname", expected=False, attempts=1)
        expect(r["pass"] is False, "'hostname' fails before it is run")
        await term.type_line("hostname")
        r = await check_until(host, ctx, token, "hostname", expected=True)
        expect(r["pass"] is True, "'hostname' passes after a keystroke-by-keystroke run")

        await term.type_line("cat /etc/os-release")
        await term.type_line("uname -r")
        r = await check_until(host, ctx, token, "container-vs-node", expected=True)
        expect(r["pass"] is True, "'container-vs-node' passes after both commands run")

        await term.type_line("cat /sys/fs/cgroup/memory.max")
        await term.type_line("cat /sys/fs/cgroup/cpu.max")
        r = await check_until(host, ctx, token, "limits", expected=True)
        expect(r["pass"] is True, "'limits' passes after reading both cgroup files")

        r = await check_until(host, ctx, token, "mark", expected=False, attempts=1)
        expect(r["pass"] is False, "'mark' fails before the file is created")
        await term.type_line('echo "Jack" > ~/mark.txt')
        r = await check_until(host, ctx, token, "mark", expected=True)
        expect(r["pass"] is True, "'mark' passes once the real shell creates the file")

        r = await check_until(host, ctx, token, "cleanup", expected=False, attempts=1)
        expect(r["pass"] is False, "'cleanup' does not pass vacuously before yes was ever started")
        await term.type_line("yes > /dev/null &")
        r = await check_until(host, ctx, token, "scale", expected=True)
        expect(r["pass"] is True, "'scale' passes while this session's 'yes' is running")
        r = await check_until(host, ctx, token, "cleanup", expected=False, attempts=2, delay=1.0)
        expect(r["pass"] is False, "'cleanup' fails while the spiked process is still running")
        await term.type_line("kill %1")
        r = await check_until(host, ctx, token, "cleanup", expected=True)
        expect(r["pass"] is True, "'cleanup' passes once the process is killed")
    finally:
        await term.ws.close()

    # --- another track is served by the very same engine ----------------------
    token, term = await open_terminal("linux-fundamentals", "files")
    try:
        await term.type_line("mkdir workspace")
        r = await check_until(host, ctx, token, "mkdir", expected=True)
        expect(r["pass"] is True, "a Linux lab step passes on the same server")
    finally:
        await term.ws.close()

    print("\nAll smoke checks passed.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: smoke-test.py <hostname>")
        sys.exit(2)
    asyncio.run(main(sys.argv[1]))
