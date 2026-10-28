#!/usr/bin/env python3
"""Probe an OTP GraphQL endpoint before enabling regional routes in the Agenda.

Usage: python3 scripts/regional-otp/check-endpoint.py https://host/otp/routers/default/index/graphql
Does not modify app configuration or mark transport schedules as confirmed.
"""
import ipaddress
import json
import os
import socket
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
if os.environ.get("OTP_ALLOW_PRIVATE_HOST") != "1":
    try:
        addresses = {entry[4][0] for entry in socket.getaddrinfo(parts.hostname, None)}
    except socket.gaierror as exc:
        raise SystemExit(f"Cannot resolve endpoint hostname: {exc}")
    if not addresses or any(not ipaddress.ip_address(addr).is_global for addr in addresses):
        raise SystemExit("Endpoint must resolve only to public IP addresses; set OTP_ALLOW_PRIVATE_HOST=1 for local tests")
# Query the actual routing entry point used by regional-routing.js rather
# than accepting any unrelated GraphQL server as a working OTP endpoint.
schema_query = """query ConvoyageSchema {
  __schema { queryType { fields { name args { name } } } }
}"""
payload = json.dumps({"query": schema_query}).encode("utf-8")
req = urllib.request.Request(url, payload, {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "ConvoyageUltra-OTP-Probe/1.0",
}, method="POST")
try:
    # Do not follow redirects: the target could resolve to an internal host.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    with opener.open(req, timeout=15) as response:
        body = response.read(65536)
        result = json.loads(body)
except (urllib.error.URLError, ValueError, TimeoutError) as exc:
    raise SystemExit(f"OTP GraphQL endpoint unavailable: {exc}")
if not isinstance(result, dict) or result.get("errors") or not isinstance(result.get("data"), dict):
    raise SystemExit(f"OTP GraphQL query failed: {str(result)[:400]}")
schema = result["data"].get("__schema") or {}
query_type = schema.get("queryType") or {}
fields = query_type.get("fields") or []
routing = next((f for f in fields if f.get("name") == "planConnection"), None)
if routing is None:
    available = ", ".join(sorted(f.get("name", "") for f in fields))
    raise SystemExit(
        "GraphQL reachable, but planConnection is missing. "
        f"Available root fields: {available[:500]}"
    )
argument_names = {arg.get("name") for arg in routing.get("args", [])}
required = {"origin", "destination", "dateTime", "first", "modes"}
missing = required - argument_names
if missing:
    raise SystemExit(
        "GraphQL planConnection exists, but required arguments are missing: "
        + ", ".join(sorted(missing))
    )
print("GraphQL endpoint reachable; planConnection arguments match the Agenda adapter.")
print("Nested response fields, route execution, data coverage and live timetable NOT verified.")
