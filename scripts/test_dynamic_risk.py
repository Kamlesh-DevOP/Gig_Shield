"""Test the /api/risk/dynamic endpoint via the MCP Host chain."""
import asyncio
import sys
import os

sys.path.insert(0, ".")
os.environ["MCP_SERVER_URL"] = "http://localhost:5100"

from backend.services.mcp_client import get_dynamic_risk_profile


async def main():
    cities = [("Chennai", "delivery"), ("Mumbai", "ride-share")]

    for city, sector in cities:
        print(f"\n--- {city} / {sector} ---")
        result = await get_dynamic_risk_profile(city=city, work_type=sector)

        print(f"  Overall Risk    : {result['overall_risk_level']}")
        print(f"  R_weather       : {result['r_weather']}")
        print(f"  R_market        : {result['r_market']}")
        print(f"  Combined Multi  : {result['combined_multiplier']}")
        print(f"  Weather Cond    : {result['weather_data'].get('condition', 'n/a')}")
        print(f"  Weather Hazard  : {result['weather_data'].get('hazard_level', 'n/a')}")
        print(f"  Crawl Hazard    : {result['market_intel'].get('crawl_hazard_level', 'n/a')}")
        formula = result["market_intel"].get("formula", "")
        if formula:
            print(f"  Formula         : {formula}")
        ctx = result["market_intel"].get("hazard_context", "")
        if ctx and ctx != "No specific hazards detected.":
            print(f"  Hazard Context  :\n{ctx[:300]}")
        print(f"  Timestamp       : {result['timestamp']}")

    print("\n=== /api/risk/dynamic backend chain: PASS ===")


if __name__ == "__main__":
    asyncio.run(main())
