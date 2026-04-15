"""
Real-Time MCP Client for GIC.

Connects to the MCP server (mcp_server/server.py) and calls the get_weather,
get_news, and crawl_web tools. Returns data in the same bundle shape that
MonitorAgent already expects — drop-in replacement for MockMCPClient.

Env:
  MCP_SERVER_URL  — Base URL of the MCP server (default: http://localhost:5100)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import aiohttp

logger = logging.getLogger(__name__)


class RealTimeMCPClient:
    """
    Async client that calls the MCP server's tools via HTTP.

    Exposes the same interface as MockMCPClient:
      - get_monitoring_signals(city, context) -> Dict
      - submit_claim_rollout(payload) -> Dict
    """

    def __init__(self, server_url: Optional[str] = None):
        self.server_url = (
            server_url or os.getenv("MCP_SERVER_URL", "http://localhost:5100")
        ).rstrip("/")
        self._timeout = aiohttp.ClientTimeout(total=30)

    async def _call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool on the MCP server via the SSE/HTTP transport."""
        url = f"{self.server_url}/call-tool"
        payload = {
            "name": tool_name,
            "arguments": arguments,
        }
        try:
            async with aiohttp.ClientSession(timeout=self._timeout) as session:
                async with session.post(url, json=payload) as resp:
                    if resp.status >= 400:
                        text = await resp.text()
                        logger.warning("MCP tool %s returned %d: %s", tool_name, resp.status, text[:300])
                        return {"error": f"HTTP {resp.status}", "detail": text[:300]}
                    result = await resp.json()
                    # FastMCP returns {"content": [{"text": "..."}]}
                    content = result.get("content", [])
                    if content and isinstance(content, list):
                        text_block = content[0].get("text", "")
                        try:
                            return json.loads(text_block)
                        except (json.JSONDecodeError, TypeError):
                            return {"raw": text_block}
                    return result
        except aiohttp.ClientError as e:
            logger.warning("MCP server unreachable for %s: %s", tool_name, e)
            return {"error": f"Connection failed: {e}"}
        except Exception as e:
            logger.error("Unexpected error calling MCP tool %s: %s", tool_name, e)
            return {"error": str(e)}

    async def get_weather(self, city: str) -> Dict[str, Any]:
        """Fetch weather data from MCP server."""
        return await self._call_tool("get_weather", {"city": city})

    async def get_news(self, city: str, query: Optional[str] = None) -> Dict[str, Any]:
        """Fetch news data from MCP server."""
        args: Dict[str, Any] = {"city": city}
        if query:
            args["query"] = query
        return await self._call_tool("get_news", args)

    async def crawl_web(self, query: str, city: Optional[str] = None) -> Dict[str, Any]:
        """Search the web for hazards via MCP server's Tavily-powered tool."""
        args: Dict[str, Any] = {"query": query}
        if city:
            args["city"] = city
        return await self._call_tool("crawl_web", args)

    async def get_monitoring_signals(
        self,
        city: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Fetch all real-time signals (weather + news + optional crawl) in parallel.

        Returns data in the same shape as MockMCPClient.get_monitoring_signals()
        so MonitorAgent works without changes.
        """
        ctx = context or {}
        wid = ctx.get("worker_id")
        oid = ctx.get("outlet_id")
        crawl_queries: List[str] = ctx.get("crawl_queries", [])
        # Support legacy crawl_urls field by treating URLs as queries
        crawl_queries = crawl_queries or ctx.get("crawl_urls", [])

        # Fire all tool calls in parallel
        tasks = [
            self.get_weather(city),
            self.get_news(city),
        ]
        # Add Tavily crawl/search tasks if queries provided
        crawl_tasks_count = len(crawl_queries)
        for query in crawl_queries[:3]:  # Max 3 queries to avoid overload
            tasks.append(self.crawl_web(query, city))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Parse results
        weather_raw = results[0] if not isinstance(results[0], Exception) else {}
        news_raw = results[1] if not isinstance(results[1], Exception) else {}
        crawl_results = []
        for i in range(2, 2 + min(crawl_tasks_count, 3)):
            if i < len(results) and not isinstance(results[i], Exception):
                crawl_results.append(results[i])

        # Normalize weather into the shape MonitorAgent expects
        weather = self._normalize_weather(city, weather_raw)

        # Build regional signals from news + crawl data
        regional = self._build_regional_signals(news_raw, crawl_results, city)

        return {
            "weather": weather,
            "regional": regional,
            "platform_pulse": {
                "worker_id": wid,
                "outlet_id": oid,
                "orders_completed_proxy": (ctx.get("worker_row") or {}).get("orders_completed_week"),
                "source": "mcp_realtime",
            },
            "news_data": news_raw if not news_raw.get("error") else None,
            "crawl_data": crawl_results if crawl_results else None,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "scenario": "live",
        }

    def _normalize_weather(self, city: str, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Convert MCP weather tool output to MonitorAgent-expected shape."""
        if raw.get("error") or raw.get("fallback"):
            return {
                "city": city,
                "rainfall_cm": float(raw.get("rainfall_mm", 0)) / 10.0 if raw.get("rainfall_mm") else 0.0,
                "temperature": float(raw.get("temperature_c", 28.0)),
                "alerts": [],
            }

        rainfall_mm = float(raw.get("rainfall_1h_mm", 0)) + float(raw.get("rainfall_3h_mm", 0))
        alerts: List[Dict[str, Any]] = []
        for alert in raw.get("alerts", []):
            alerts.append({
                "type": alert.get("type", "weather_alert"),
                "severity": alert.get("severity", "unknown"),
                "source": alert.get("source", "OpenWeatherMap"),
                "detail": alert.get("detail", ""),
            })

        return {
            "city": raw.get("city", city),
            "rainfall_cm": round(rainfall_mm / 10.0, 3),
            "temperature": float(raw.get("temperature_c", 28.0)),
            "feels_like": float(raw.get("feels_like_c", 28.0)),
            "humidity": int(raw.get("humidity_percent", 70)),
            "wind_speed_kmph": float(raw.get("wind_speed_kmph", 0)),
            "condition": raw.get("condition", "unknown"),
            "alerts": alerts,
            "hazard_level": raw.get("hazard_level", "LOW"),
        }

    def _build_regional_signals(
        self,
        news_raw: Dict[str, Any],
        crawl_results: List[Dict[str, Any]],
        city: str,
    ) -> Dict[str, Any]:
        """Build regional disruption signals from news and crawl data."""
        news_flags: List[str] = []
        affected = 50
        duration_h = 4.0
        stress = 0.2

        # Process news data
        if not news_raw.get("error"):
            flags = news_raw.get("disruption_flags", [])
            news_flags.extend(flags)

            threat = news_raw.get("overall_threat_level", "LOW")
            if threat == "CRITICAL":
                affected += 350
                duration_h += 12.0
                stress = min(0.95, stress + 0.5)
            elif threat == "HIGH":
                affected += 200
                duration_h += 6.0
                stress = min(0.85, stress + 0.3)
            elif threat == "MEDIUM":
                affected += 80
                duration_h += 3.0
                stress = min(0.6, stress + 0.15)

        # Process crawl data
        crawl_flags: List[str] = []
        for crawl in crawl_results:
            if crawl.get("error"):
                continue
            for hazard in crawl.get("hazards_found", []):
                kw = hazard.get("keyword", "")
                cat = hazard.get("category", "other")
                crawl_flags.append(f"crawl:{kw}")
                if cat == "weather":
                    stress = min(0.95, stress + 0.1)
                    affected += 50
                elif cat == "civil_unrest":
                    stress = min(0.9, stress + 0.08)
                    affected += 30
                    duration_h += 2.0
                elif cat == "infrastructure":
                    stress = min(0.85, stress + 0.06)
                    duration_h += 1.5

        all_flags = list(dict.fromkeys(news_flags + crawl_flags))

        return {
            "affected_workers_estimate": int(min(5000, affected)),
            "disruption_duration_hours": float(min(48.0, duration_h)),
            "inventory_stress_index": float(round(stress, 3)),
            "news_flags": all_flags,
            "crawl_hazard_count": sum(len(c.get("hazards_found", [])) for c in crawl_results),
        }

    async def submit_claim_rollout(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Submit claim rollout acknowledgement (passthrough to backend or local log)."""
        return {
            "status": "accepted",
            "ack_id": str(uuid.uuid4()),
            "queue": "mcp_realtime",
        }
