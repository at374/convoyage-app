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
# Validate the exact nested selection and input types used by the browser.
# GraphQL validates the query before execution; an empty itinerary list is
# acceptable here, but schema errors must block activation.
from datetime import datetime
from zoneinfo import ZoneInfo

local_now = datetime.now(ZoneInfo("Europe/Paris"))
route_query = """query RegionalRoute($from: Location!, $to: Location!, $date: Date!, $time: Time!) {
  planConnection(origin: $from, destination: $to, dateTime: {date: $date, time: $time},
    first: 12, modes: {transportModes: [{mode: WALK},{mode: TRANSIT}]}) {
    edges { node {
      startTime endTime duration walkDistance numberOfTransfers
      legs { mode startTime endTime distance
        from { name } to { name } route { shortName longName } }
    }}
  }
}"""
route_payload = json.dumps({"query": route_query, "variables": {
    "from": {"coordinates": {"latitude": 45.899, "longitude": 6.129}},
    "to": {"coordinates": {"latitude": 45.675, "longitude": 6.393}},
    "date": local_now.strftime("%Y-%m-%d"),
    "time": local_now.strftime("%H:%M"),
}}).encode("utf-8")
route_req = urllib.request.Request(url, route_payload, {
    "Content-Type": "application/json", "Accept": "application/json",
    "User-Agent": "ConvoyageUltra-OTP-Probe/1.0",
}, method="POST")
try:
    with opener.open(route_req, timeout=25) as response:
        route_result = json.loads(response.read(262144))
except (urllib.error.URLError, ValueError, TimeoutError) as exc:
    raise SystemExit(f"OTP sample route request failed: {exc}")
if not isinstance(route_result, dict) or route_result.get("errors"):
    raise SystemExit("OTP sample route query incompatible: " + str(route_result.get("errors"))[:600])
connection = (route_result.get("data") or {}).get("planConnection")
if not isinstance(connection, dict) or not isinstance(connection.get("edges"), list):
    raise SystemExit("OTP sample route returned an unexpected response structure")
print("GraphQL routing query accepted; sample route response structure valid.")
print(f"Annecy-Albertville sample returned {len(connection['edges'])} candidate itinerary edges.")
print("Coverage, feasibility and realtime schedules remain UNCONFIRMED.")
