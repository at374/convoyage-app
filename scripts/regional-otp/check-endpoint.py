#!/usr/bin/env python3
"""Probe an OTP GraphQL endpoint before enabling regional routes in the Agenda.

Usage: python3 scripts/regional-otp/check-endpoint.py https://host/otp/routers/default/index/graphql
Does not modify app configuration or mark transport schedules as confirmed.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

if len(sys.argv) != 2:
    raise SystemExit("Usage: check-endpoint.py https://host/path/to/graphql")
url = sys.argv[1]
parts = urllib.parse.urlsplit(url)
if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or parts.fragment:
    raise SystemExit("Endpoint must be a valid HTTPS URL without credentials or fragment")
if os.environ.get("OTP_ALLOW_PRIVATE_HOST") != "1" and parts.hostname in ("localhost", "127.0.0.1", "::1"):
    raise SystemExit("Local endpoints require OTP_ALLOW_PRIVATE_HOST=1")
payload = json.dumps({"query": "query ConvoyageHealth { __typename }"}).encode("utf-8")
req = urllib.request.Request(url, payload, {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "ConvoyageUltra-OTP-Probe/1.0",
}, method="POST")
try:
    with urllib.request.urlopen(req, timeout=15) as response:
        body = response.read(65536)
        result = json.loads(body)
except (urllib.error.URLError, ValueError, TimeoutError) as exc:
    raise SystemExit(f"OTP GraphQL endpoint unavailable: {exc}")
if not isinstance(result, dict) or result.get("errors") or not isinstance(result.get("data"), dict):
    raise SystemExit(f"OTP GraphQL query failed: {str(result)[:400]}")
if not result["data"].get("__typename"):
    raise SystemExit("Endpoint did not return GraphQL __typename")
print("GraphQL endpoint reachable. Routing schema, data coverage and live timetable NOT verified.")
