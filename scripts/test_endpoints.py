"""
End-to-end test for POST /api/shift/start using the live RealTimeMCPClient.
Bypasses HTTP and calls the route handler directly via FastAPI's test client.
"""
import sys
import os

sys.path.insert(0, ".")
os.environ["MCP_SERVER_URL"] = "http://localhost:5100"
os.environ["PYTHONIOENCODING"] = "utf-8"

from fastapi.testclient import TestClient
from app import app  # app.py re-exports src.api.main:app

client = TestClient(app)

# ── Test 1: shift/start — Chennai delivery worker ────────────────────────────
print("\n=== TEST: POST /api/shift/start ===")
payload = {
    "worker_id": 101,
    "city": "Chennai",
    "crawl_queries": ["Chennai road closures today", "Chennai gig delivery hazards"],
}
resp = client.post("/api/shift/start", json=payload)
print(f"Status : {resp.status_code}")

if resp.status_code == 200:
    data = resp.json()
    print(f"City        : {data['city']}")
    print(f"Hazard Level: {data['overall_hazard_level']}")
    w = data["weather"]
    print(f"Weather     : {w['condition']}, {w['temperature_c']}C, rain={w['rainfall_mm']}mm")
    n = data["news"]
    print(f"News        : threat={n['overall_threat_level']}, flags={n['disruption_flags'][:4]}")
    crawl = data.get("crawl")
    if crawl:
        print(f"Crawl       : {crawl['total_hazards_found']} hazards, level={crawl['hazard_level']}")
    adj = data["coverage_adjustment"]
    print(f"Coverage Adj: +{adj['adjustment_percent']}%, action={adj['recommended_action']}")
    print(f"Multiplier  : {adj['base_premium_multiplier']}")
    print(f"Alerts      : {len(data['alerts'])} alert(s)")
    for a in data["alerts"][:3]:
        print(f"  [{a['severity'].upper()}] {a['type']}: {a['description'][:80]}")
    print(f"\nNotification:\n{data['notification_message']}")
    print("\nSHIFT/START: PASS")
else:
    print(f"ERROR: {resp.text[:500]}")

# ── Test 2: /api/risk/dynamic ─────────────────────────────────────────────────
print("\n=== TEST: POST /api/risk/dynamic ===")
payload2 = {"city": "Mumbai", "work_type": "ride-share", "worker_id": 202}
resp2 = client.post("/api/risk/dynamic", json=payload2)
print(f"Status: {resp2.status_code}")
if resp2.status_code == 200:
    d = resp2.json()
    print(f"City       : {d['city']} / {d['work_type']}")
    print(f"Risk Level : {d['overall_risk_level']}")
    print(f"R_weather  : {d['r_weather']}")
    print(f"R_market   : {d['r_market']}")
    print(f"Multiplier : {d['combined_multiplier']}")
    print(f"Formula    : {d['formula']}")
    print(f"Fallback   : {d['fallback_used']}")
    print("\nRISK/DYNAMIC: PASS")
else:
    print(f"ERROR: {resp2.text[:500]}")

# ── Test 3: /api/hazard/check ─────────────────────────────────────────────────
print("\n=== TEST: POST /api/hazard/check ===")
resp3 = client.post("/api/hazard/check", json={"city": "Delhi"})
print(f"Status: {resp3.status_code}")
if resp3.status_code == 200:
    d = resp3.json()
    print(f"City         : {d['city']}")
    print(f"News Threat  : {d['news_threat_level']}")
    print(f"Overall Stress: {d['overall_stress']}")
    print(f"Flags        : {d['news_flags'][:6]}")
    print("\nHAZARD/CHECK: PASS")
else:
    print(f"ERROR: {resp3.text[:500]}")

print("\n=== ALL ENDPOINT TESTS COMPLETE ===\n")
