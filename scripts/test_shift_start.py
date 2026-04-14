"""
Simulates the POST /api/shift/start hazard analysis logic
by calling the MCP Layer tools directly — same sequence the endpoint uses.

This validates the full pipeline without needing the ML stack.
"""
import sys, os, json, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
MCP = "http://localhost:5100"


def call_tool(name, args):
    data = json.dumps({"name": name, "arguments": args}).encode()
    req = urllib.request.Request(
        f"{MCP}/call-tool", data=data,
        headers={"Content-Type": "application/json"},
    )
    envelope = json.load(urllib.request.urlopen(req, timeout=30))
    return json.loads(envelope["content"][0]["text"])


# ── Simulate shift/start for worker 101 in Chennai ───────────────────────────
CITY = "Chennai"
WORKER_ID = 101
CRAWL_QUERIES = ["Chennai road closures today", "Chennai delivery gig worker hazards"]

print(f"\n=== SIMULATING /api/shift/start  worker={WORKER_ID}  city={CITY} ===\n")

# Step 1: Weather (same as RealTimeMCPClient.get_weather)
weather = call_tool("get_weather", {"city": CITY})
print(f"[1] WEATHER")
print(f"    {weather['condition']}, {weather['temperature_c']}C, wind={weather['wind_speed_kmph']}km/h")
print(f"    Hazard: {weather['hazard_level']}  Alerts: {len(weather.get('alerts',[]))}")

# Step 2: News (same as RealTimeMCPClient.get_news)
news = call_tool("get_news", {"city": CITY})
print(f"\n[2] NEWS")
print(f"    Articles: {len(news.get('articles',[]))}  Threat: {news['overall_threat_level']}")
print(f"    Flags: {news['disruption_flags'][:5]}")
for a in news.get("articles", [])[:2]:
    print(f"    - [{a['severity'].upper()}] {a['title'][:80]}")

# Step 3: Tavily crawl queries
print(f"\n[3] CRAWL (Tavily)")
crawl_results = []
for q in CRAWL_QUERIES:
    c = call_tool("crawl_web", {"query": q, "city": CITY})
    crawl_results.append(c)
    print(f"    Query: '{q[:50]}'")
    print(f"    -> {c['results_count']} results, {c['hazard_count']} hazards, level={c['hazard_level']}")

# Step 4: Analyze localized risk (the premium formula)
print(f"\n[4] RISK ANALYSIS")
risk = call_tool("analyze_localized_risk", {"location": CITY, "sector": "delivery"})
print(f"    Overall : {risk['overall_risk_level']}")
print(f"    R_weather: {risk['r_weather']}")
print(f"    R_market : {risk['r_market']}")
print(f"    Formula  : {risk['formula']}")

# Step 5: Build coverage adjustment (mirrors _compute_overall_hazard logic)
_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
_RANK_INV = {v: k for k, v in _RANK.items()}

all_levels = [
    weather["hazard_level"],
    news["overall_threat_level"],
    risk["crawl_hazard_level"],
]
max_rank = max(_RANK.get(l, 0) for l in all_levels)
overall = _RANK_INV[max_rank]

adj_pct = {"CRITICAL": 40.0, "HIGH": 20.0, "MEDIUM": 10.0, "LOW": 0.0}[overall]
action  = {"CRITICAL": "emergency_protocol", "HIGH": "caution", "MEDIUM": "caution", "LOW": "proceed"}[overall]
multiplier = 1.0 + adj_pct / 100.0

print(f"\n[5] COVERAGE ADJUSTMENT")
print(f"    Overall Hazard  : {overall}")
print(f"    Adjustment      : +{adj_pct:.0f}%")
print(f"    Premium Multi   : {multiplier:.2f}x")
print(f"    Action          : {action}")

# Step 6: Notification (mirrors _build_notification)
if overall == "LOW":
    notif = f"[OK] {CITY}: Conditions are normal. Shift coverage active at standard rates."
else:
    alert_types = []
    for wa in weather.get("alerts", []):
        alert_types.append(wa.get("type", "weather"))
    for flag in news["disruption_flags"][:2]:
        alert_types.append(f"News_{flag.title()}")
    alert_str = ", ".join(dict.fromkeys(alert_types))[:80] or "elevated conditions"
    notif = (
        f"[{overall}] {CITY} HAZARD ALERT\n"
        f"Detected: {alert_str}\n"
        f"Coverage auto-increased by {adj_pct:.0f}%. Action: {action.replace('_',' ').title()}."
    )

print(f"\n[6] NOTIFICATION")
print(f"    {notif}\n")

print("=" * 60)
print("  /api/shift/start simulation: ALL STEPS PASS")
print("=" * 60)
