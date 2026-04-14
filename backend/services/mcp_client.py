"""
backend/services/mcp_client.py
══════════════════════════════
MCP Host client — the backend calls this to delegate data-fetching
to the MCP Layer server (mcp-layer/server.py).

Conforms to the specification in the user's proposal:
  get_dynamic_risk_profile(city, work_type) → weather + market intel

This file lives at:  backend/services/mcp_client.py

The MCP Layer server must be running at MCP_SERVER_URL (default http://localhost:5100).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import aiohttp

logger = logging.getLogger(__name__)

_DEFAULT_MCP_URL = "http://localhost:5100"
_NEUTRAL_RISK = {
    "status": "mcp_server_unavailable",
    "hazard_level": "MEDIUM",
    "risk_multiplier": 1.1,
    "detail": "MCP server unreachable — applying neutral-risk fallback.",
    "fallback": True,
}


async def _call_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    server_url: str = _DEFAULT_MCP_URL,
    timeout_s: int = 25,
) -> Dict[str, Any]:
    """
    POST /call-tool on the MCP Layer server.

    Returns the parsed JSON result, or a neutral-risk dict on failure.
    The backend must NEVER raise an exception due to MCP being down.
    """
    url = f"{server_url.rstrip('/')}/call-tool"
    payload = {"name": tool_name, "arguments": arguments}

    try:
        timeout = aiohttp.ClientTimeout(total=timeout_s)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload) as resp:
                if resp.status >= 400:
                    text = await resp.text()
                    logger.warning("MCP tool %s returned HTTP %d: %s", tool_name, resp.status, text[:300])
                    return {**_NEUTRAL_RISK, "tool": tool_name, "http_status": resp.status}

                data = await resp.json()
                # Unwrap FastMCP-compatible envelope: { content: [{ text: "..." }] }
                content = data.get("content", [])
                if content and isinstance(content, list):
                    raw_text = content[0].get("text", "")
                    try:
                        return json.loads(raw_text)
                    except (json.JSONDecodeError, TypeError):
                        return {"raw": raw_text}
                return data

    except aiohttp.ClientConnectorError:
        logger.warning("MCP server unreachable at %s — using neutral-risk fallback", server_url)
        return {**_NEUTRAL_RISK, "tool": tool_name}
    except asyncio.TimeoutError:
        logger.warning("MCP tool %s timed out after %ds — using neutral-risk fallback", tool_name, timeout_s)
        return {**_NEUTRAL_RISK, "tool": tool_name, "reason": "timeout"}
    except Exception as e:
        logger.error("Unexpected error calling MCP tool %s: %s", tool_name, e)
        return {**_NEUTRAL_RISK, "tool": tool_name, "error": str(e)}


async def get_dynamic_risk_profile(
    city: str,
    work_type: str,
    server_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    High-level MCP Host call — as specified in the implementation proposal.

    Fires get_realtime_weather and analyze_localized_risk in parallel,
    returns a combined risk profile with timestamp.

    Args:
        city:      The worker's shift city (e.g. "Chennai")
        work_type: Gig sector (e.g. "delivery", "ride-share")
        server_url: Override MCP server URL (defaults to MCP_SERVER_URL env var)

    Returns:
        {
            "weather_data": { ... },       # from get_weather tool
            "market_intel": { ... },       # from analyze_localized_risk tool
            "combined_multiplier": float,  # R_weather × R_market
            "overall_risk_level": str,     # LOW / MEDIUM / HIGH / CRITICAL
            "timestamp": str,              # ISO 8601 UTC
        }
    """
    url = server_url or os.getenv("MCP_SERVER_URL", _DEFAULT_MCP_URL)

    # Parallel tool calls
    weather_task = _call_tool("get_weather", {"city": city}, server_url=url)
    intel_task = _call_tool(
        "analyze_localized_risk",
        {"location": city, "sector": work_type},
        server_url=url,
    )

    weather, market_intel = await asyncio.gather(weather_task, intel_task, return_exceptions=False)

    # Derive combined multiplier
    r_weather = float(weather.get("risk_multiplier", 1.0))
    r_market = float(market_intel.get("r_market", 1.0))
    # If analyze_localized_risk already computed a final_premium_multiplier, use it
    final_multiplier = float(
        market_intel.get("final_premium_multiplier", round(r_weather * r_market, 3))
    )

    # Overall risk: take the worst of the two
    _RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    _RANK_INV = {v: k for k, v in _RANK.items()}
    w_level = weather.get("hazard_level", "LOW")
    m_level = market_intel.get("overall_risk_level", market_intel.get("hazard_level", "LOW"))
    overall_rank = max(_RANK.get(w_level, 0), _RANK.get(m_level, 0))
    overall_risk = _RANK_INV.get(overall_rank, "LOW")

    return {
        "city": city,
        "work_type": work_type,
        "weather_data": weather,
        "market_intel": market_intel,
        "r_weather": r_weather,
        "r_market": r_market,
        "combined_multiplier": final_multiplier,
        "overall_risk_level": overall_risk,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mcp_server_url": url,
    }


async def get_weather(city: str, server_url: Optional[str] = None) -> Dict[str, Any]:
    """Convenience wrapper — fetch only weather."""
    url = server_url or os.getenv("MCP_SERVER_URL", _DEFAULT_MCP_URL)
    return await _call_tool("get_weather", {"city": city}, server_url=url)


async def get_news(city: str, query: Optional[str] = None, server_url: Optional[str] = None) -> Dict[str, Any]:
    """Convenience wrapper — fetch only news."""
    url = server_url or os.getenv("MCP_SERVER_URL", _DEFAULT_MCP_URL)
    args: Dict[str, Any] = {"city": city}
    if query:
        args["query"] = query
    return await _call_tool("get_news", args, server_url=url)


async def crawl_web(query: str, city: Optional[str] = None, server_url: Optional[str] = None) -> Dict[str, Any]:
    """Convenience wrapper — fire a Tavily crawl."""
    url = server_url or os.getenv("MCP_SERVER_URL", _DEFAULT_MCP_URL)
    args: Dict[str, Any] = {"query": query}
    if city:
        args["city"] = city
    return await _call_tool("crawl_web", args, server_url=url)


async def analyze_localized_risk(
    location: str,
    sector: str,
    server_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Convenience wrapper — autonomous sector risk analysis."""
    url = server_url or os.getenv("MCP_SERVER_URL", _DEFAULT_MCP_URL)
    return await _call_tool(
        "analyze_localized_risk",
        {"location": location, "sector": sector},
        server_url=url,
    )
