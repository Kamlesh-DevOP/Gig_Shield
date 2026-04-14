"""Quick integration test for MCP Layer tools — run from repo root."""
import urllib.request
import json
import sys
import os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.stdout.reconfigure(encoding="utf-8")


MCP_URL = "http://localhost:5100"


def call_tool(name, args):
    data = json.dumps({"name": name, "arguments": args}).encode()
    req = urllib.request.Request(
        f"{MCP_URL}/call-tool",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    r = urllib.request.urlopen(req, timeout=30)
    envelope = json.load(r)
    return json.loads(envelope["content"][0]["text"])


def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print("=" * 60)


# ── 1. Health check ──────────────────────────────────────────
section("HEALTH CHECK")
r = urllib.request.urlopen(f"{MCP_URL}/health", timeout=5)
health = json.load(r)
print(f"  Status : {health['status']}")
print(f"  Tools  : {', '.join(health['tools'])}")
keys = health["api_keys"]
for k, v in keys.items():
    status = "✓ configured" if v else "✗ MISSING"
    print(f"  {k}: {status}")

all_keys_ok = all(keys.values())
if not all_keys_ok:
    print("\n  ⚠ Some API keys are missing — tests may use fallbacks.")

# ── 2. Weather ───────────────────────────────────────────────
section("GET_WEATHER — Chennai")
w = call_tool("get_weather", {"city": "Chennai"})
if w.get("error"):
    print(f"  ERROR: {w['error']}")
else:
    print(f"  City       : {w.get('city')}")
    print(f"  Temperature: {w.get('temperature_c')}°C (feels {w.get('feels_like_c')}°C)")
    print(f"  Condition  : {w.get('condition')}")
    print(f"  Humidity   : {w.get('humidity_percent')}%")
    print(f"  Wind       : {w.get('wind_speed_kmph')} km/h")
    print(f"  Rainfall   : {w.get('rainfall_1h_mm')} mm/1h")
    print(f"  Hazard     : {w.get('hazard_level')}")
    print(f"  Multiplier : {w.get('risk_multiplier')}")
    alerts = w.get("alerts", [])
    if alerts:
        for a in alerts:
            print(f"  ⚠ Alert    : [{a['severity'].upper()}] {a['type']} — {a['detail']}")
    else:
        print("  ✓ No active weather alerts")

# ── 3. News ──────────────────────────────────────────────────
section("GET_NEWS — Chennai disruption news")
n = call_tool("get_news", {"city": "Chennai"})
if n.get("error"):
    print(f"  ERROR: {n['error']}")
else:
    print(f"  Total results   : {n.get('total_results', 0)}")
    print(f"  Articles parsed : {len(n.get('articles', []))}")
    print(f"  Threat level    : {n.get('overall_threat_level')}")
    flags = n.get("disruption_flags", [])
    print(f"  Disruption flags: {flags[:8] if flags else 'none'}")
    for art in n.get("articles", [])[:3]:
        print(f"  • [{art['severity'].upper()}] {art['title'][:80]}")

# ── 4. Tavily crawl ──────────────────────────────────────────
section("CRAWL_WEB — gig worker hazards Chennai")
c = call_tool("crawl_web", {"query": "gig worker hazards delivery Chennai today", "city": "Chennai"})
if c.get("error"):
    print(f"  ERROR: {c['error']}")
else:
    print(f"  Results  : {c.get('results_count', 0)}")
    print(f"  Hazards  : {c.get('hazard_count', 0)}")
    print(f"  Level    : {c.get('hazard_level')}")
    answer = c.get("tavily_answer", "")
    if answer:
        print(f"  AI Answer: {answer[:200]}")
    for h in c.get("hazards_found", [])[:4]:
        print(f"  ⚡ [{h['category']}] {h['keyword']}: {h['context'][:100]}")

# ── 5. Analyze localized risk (composite) ────────────────────
section("ANALYZE_LOCALIZED_RISK — delivery / Chennai")
risk = call_tool("analyze_localized_risk", {"location": "Chennai", "sector": "delivery"})
if risk.get("error"):
    print(f"  ERROR: {risk['error']}")
else:
    print(f"  Location      : {risk.get('location')}")
    print(f"  Sector        : {risk.get('sector')}")
    print(f"  Overall Risk  : {risk.get('overall_risk_level')}")
    print(f"  R_weather     : {risk.get('r_weather')}")
    print(f"  R_market      : {risk.get('r_market')}")
    print(f"  Premium Multi : {risk.get('final_premium_multiplier')}")
    print(f"  Formula       : {risk.get('formula')}")
    ctx = risk.get("hazard_context", "")
    if ctx and ctx != "No specific hazards detected.":
        print(f"  Hazard Context:\n{ctx[:400]}")

print("\n" + "=" * 60)
print("  ✅ MCP Layer integration test complete")
print("=" * 60 + "\n")
