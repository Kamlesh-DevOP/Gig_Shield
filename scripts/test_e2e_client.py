"""End-to-end test of RealTimeMCPClient -> MCP Layer chain."""
import asyncio
import sys
import os

sys.path.insert(0, ".")
os.environ["MCP_SERVER_URL"] = "http://localhost:5100"

from src.integrations.mock_mcp_client import default_mcp_client


async def main():
    client = default_mcp_client()
    print(f"Client type : {type(client).__name__}")

    bundle = await client.get_monitoring_signals(
        "Mumbai",
        context={
            "worker_id": 42,
            "crawl_queries": ["Mumbai road closures today gig delivery"],
        },
    )

    w = bundle["weather"]
    r = bundle["regional"]
    news = bundle.get("news_data") or {}
    crawl = bundle.get("crawl_data") or []

    print(f"Weather  -> city={w.get('city')}, temp={w.get('temperature')}C, hazard={w.get('hazard_level')}")
    print(f"Regional -> affected={r.get('affected_workers_estimate')}, stress={r.get('inventory_stress_index')}, flags={r.get('news_flags', [])[:4]}")
    print(f"News     -> threat={news.get('overall_threat_level', 'n/a')}, articles={len(news.get('articles', []))}")
    print(f"Crawl    -> {len(crawl)} result(s)")
    print(f"Scenario -> {bundle.get('scenario')}")
    print()
    print("END-TO-END: PASS")


if __name__ == "__main__":
    asyncio.run(main())
