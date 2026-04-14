"""
GigShield MCP Server — Real-Time Tracking Layer.

Exposes four tools via the Model Context Protocol (FastMCP):
  1. get_weather            — live weather from OpenWeatherMap
  2. get_news               — live news from NewsAPI
  3. crawl_web              — autonomous web search & crawling via Tavily
  4. analyze_localized_risk — composite sector risk (weather × market multiplier)

NOTE: The primary HTTP entrypoint is mcp-layer/server.py (port 5100).
This module retains the FastMCP SSE interface for MCP Inspector / Claude Desktop.

Run standalone (MCP inspect mode):
  mcp dev mcp_server/server.py

Or via the HTTP launcher:
  python scripts/start_mcp_server.py
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(_ROOT, ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [MCP] %(levelname)s %(message)s")
logger = logging.getLogger("mcp_server")

mcp = FastMCP(
    "GigShield Real-Time Tracking",
    description="Weather, News, and Web-Crawling tools for gig-worker insurance risk assessment.",
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
HAZARD_KEYWORDS = [
    "flood", "flooding", "waterlogging", "waterlogged",
    "strike", "protest", "rally", "bandh", "hartaal",
    "cyclone", "storm", "hurricane", "typhoon",
    "road closure", "road closed", "road block", "barricade",
    "accident", "pile-up", "collision",
    "power outage", "power cut", "blackout",
    "curfew", "section 144", "lockdown",
    "landslide", "mudslide", "earthquake",
    "fire", "blaze", "inferno",
    "heat wave", "heatwave", "extreme heat",
]

DISRUPTION_NEWS_KEYWORDS = [
    "flood", "strike", "protest", "cyclone", "curfew",
    "road closure", "accident", "power outage", "storm",
    "rally", "bandh", "waterlogging", "disruption",
    "shutdown", "blocked", "suspended",
]

# City coordinates for OpenWeatherMap (Indian cities commonly used in GigShield)
CITY_COORDS: Dict[str, Dict[str, float]] = {
    "chennai": {"lat": 13.0827, "lon": 80.2707},
    "mumbai": {"lat": 19.0760, "lon": 72.8777},
    "bengaluru": {"lat": 12.9716, "lon": 77.5946},
    "bangalore": {"lat": 12.9716, "lon": 77.5946},
    "hyderabad": {"lat": 17.3850, "lon": 78.4867},
    "delhi": {"lat": 28.7041, "lon": 77.1025},
    "new delhi": {"lat": 28.7041, "lon": 77.1025},
    "kolkata": {"lat": 22.5726, "lon": 88.3639},
    "pune": {"lat": 18.5204, "lon": 73.8567},
    "ahmedabad": {"lat": 23.0225, "lon": 72.5714},
    "jaipur": {"lat": 26.9124, "lon": 75.7873},
    "lucknow": {"lat": 26.8467, "lon": 80.9462},
}


# ═══════════════════════════════════════════════════════════════════════════
# TOOL 1 — WEATHER (OpenWeatherMap)
# ═══════════════════════════════════════════════════════════════════════════

@mcp.tool()
def get_weather(city: str) -> str:
    """
    Fetch current weather data for a city using OpenWeatherMap API.

    Returns temperature, humidity, rainfall, wind speed, weather conditions,
    and hazard-level alerts relevant to gig-worker safety.

    Args:
        city: Name of the city (e.g. "Mumbai", "Chennai", "Delhi")
    """
    api_key = os.getenv("OPENWEATHERMAP_API_KEY", "").strip()
    if not api_key:
        return json.dumps({
            "error": "OPENWEATHERMAP_API_KEY not set in .env",
            "city": city,
            "fallback": True,
            "temperature_c": 28.0,
            "rainfall_mm": 0.0,
            "humidity_percent": 70,
            "wind_speed_kmph": 10.0,
            "condition": "Unknown",
            "alerts": [],
        })

    city_lower = city.strip().lower()
    coords = CITY_COORDS.get(city_lower)

    try:
        # Use city name query (works for any city worldwide)
        params: Dict[str, Any] = {
            "appid": api_key,
            "units": "metric",
        }
        if coords:
            params["lat"] = coords["lat"]
            params["lon"] = coords["lon"]
        else:
            params["q"] = city

        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        # Extract core weather data
        main = data.get("main", {})
        wind = data.get("wind", {})
        weather_list = data.get("weather", [{}])
        rain = data.get("rain", {})
        clouds = data.get("clouds", {})

        temperature = float(main.get("temp", 0))
        feels_like = float(main.get("feels_like", 0))
        humidity = int(main.get("humidity", 0))
        pressure = int(main.get("pressure", 0))
        wind_speed_ms = float(wind.get("speed", 0))
        wind_speed_kmph = round(wind_speed_ms * 3.6, 1)
        rainfall_1h = float(rain.get("1h", 0))
        rainfall_3h = float(rain.get("3h", 0))
        condition = weather_list[0].get("description", "unknown") if weather_list else "unknown"
        condition_main = weather_list[0].get("main", "Unknown") if weather_list else "Unknown"

        # Derive hazard alerts
        alerts: List[Dict[str, str]] = []

        if rainfall_1h >= 15 or rainfall_3h >= 40:
            alerts.append({
                "type": "Heavy_Rain",
                "severity": "critical" if rainfall_1h >= 30 else "high",
                "detail": f"Rainfall: {rainfall_1h}mm/1h, {rainfall_3h}mm/3h",
                "source": "OpenWeatherMap",
            })
        elif rainfall_1h >= 5:
            alerts.append({
                "type": "Moderate_Rain",
                "severity": "medium",
                "detail": f"Rainfall: {rainfall_1h}mm/1h",
                "source": "OpenWeatherMap",
            })

        if temperature >= 42:
            alerts.append({
                "type": "Extreme_Heat",
                "severity": "high",
                "detail": f"Temperature: {temperature}°C, Feels like: {feels_like}°C",
                "source": "OpenWeatherMap",
            })

        if temperature <= 5:
            alerts.append({
                "type": "Extreme_Cold",
                "severity": "medium",
                "detail": f"Temperature: {temperature}°C",
                "source": "OpenWeatherMap",
            })

        if wind_speed_kmph >= 60:
            alerts.append({
                "type": "High_Wind",
                "severity": "high" if wind_speed_kmph >= 90 else "medium",
                "detail": f"Wind speed: {wind_speed_kmph} km/h",
                "source": "OpenWeatherMap",
            })

        # Check for storm/thunderstorm conditions
        if condition_main.lower() in ("thunderstorm", "squall", "tornado"):
            alerts.append({
                "type": "Storm",
                "severity": "critical",
                "detail": f"Condition: {condition}",
                "source": "OpenWeatherMap",
            })

        result = {
            "city": city,
            "temperature_c": temperature,
            "feels_like_c": feels_like,
            "humidity_percent": humidity,
            "pressure_hpa": pressure,
            "wind_speed_kmph": wind_speed_kmph,
            "rainfall_1h_mm": rainfall_1h,
            "rainfall_3h_mm": rainfall_3h,
            "cloud_cover_percent": clouds.get("all", 0),
            "condition": condition,
            "condition_main": condition_main,
            "alerts": alerts,
            "hazard_level": (
                "CRITICAL" if any(a["severity"] == "critical" for a in alerts)
                else "HIGH" if any(a["severity"] == "high" for a in alerts)
                else "MEDIUM" if any(a["severity"] == "medium" for a in alerts)
                else "LOW"
            ),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "source": "OpenWeatherMap",
        }
        logger.info("Weather fetched for %s: %s, %s°C, hazard=%s", city, condition, temperature, result["hazard_level"])
        return json.dumps(result)

    except requests.exceptions.HTTPError as e:
        logger.error("OpenWeatherMap HTTP error for %s: %s", city, e)
        return json.dumps({"error": f"Weather API error: {e}", "city": city, "fallback": True})
    except Exception as e:
        logger.error("Weather fetch failed for %s: %s", city, e)
        return json.dumps({"error": str(e), "city": city, "fallback": True})


# ═══════════════════════════════════════════════════════════════════════════
# TOOL 2 — NEWS (NewsAPI)
# ═══════════════════════════════════════════════════════════════════════════

@mcp.tool()
def get_news(city: str, query: Optional[str] = None) -> str:
    """
    Fetch recent news articles for a city, focused on disruption events
    that could affect gig workers (floods, strikes, protests, road closures, etc.).

    Args:
        city: Name of the city (e.g. "Mumbai", "Chennai")
        query: Optional additional search query (e.g. "flood", "strike")
    """
    api_key = os.getenv("NEWS_API_KEY", "").strip()
    if not api_key:
        return json.dumps({
            "error": "NEWS_API_KEY not set in .env",
            "city": city,
            "fallback": True,
            "articles": [],
            "disruption_flags": [],
        })

    # Build search query focused on disruption events
    search_terms = [city]
    if query:
        search_terms.append(query)
    else:
        search_terms.append("(flood OR strike OR protest OR cyclone OR accident OR disruption OR road closure)")

    search_query = " AND ".join(search_terms)

    try:
        resp = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": search_query,
                "apiKey": api_key,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": 10,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        articles_raw = data.get("articles", [])
        articles: List[Dict[str, Any]] = []
        disruption_flags: List[str] = []

        for art in articles_raw:
            title = art.get("title") or ""
            description = art.get("description") or ""
            combined_text = f"{title} {description}".lower()

            # Detect disruption types
            flags_found: List[str] = []
            for kw in DISRUPTION_NEWS_KEYWORDS:
                if kw in combined_text:
                    flags_found.append(kw)

            severity = "low"
            if len(flags_found) >= 3:
                severity = "critical"
            elif len(flags_found) >= 2:
                severity = "high"
            elif len(flags_found) >= 1:
                severity = "medium"

            articles.append({
                "title": title,
                "source": (art.get("source") or {}).get("name", "Unknown"),
                "published_at": art.get("publishedAt", ""),
                "url": art.get("url", ""),
                "description": (description[:300] + "...") if len(description) > 300 else description,
                "disruption_flags": flags_found,
                "severity": severity,
            })
            disruption_flags.extend(flags_found)

        # Deduplicate flags
        unique_flags = list(dict.fromkeys(disruption_flags))

        # Determine overall news threat level
        critical_count = sum(1 for a in articles if a["severity"] == "critical")
        high_count = sum(1 for a in articles if a["severity"] == "high")

        overall_threat = "LOW"
        if critical_count >= 2:
            overall_threat = "CRITICAL"
        elif critical_count >= 1 or high_count >= 3:
            overall_threat = "HIGH"
        elif high_count >= 1:
            overall_threat = "MEDIUM"

        result = {
            "city": city,
            "query": search_query,
            "total_results": data.get("totalResults", 0),
            "articles": articles,
            "disruption_flags": unique_flags,
            "overall_threat_level": overall_threat,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "source": "NewsAPI",
        }
        logger.info(
            "News fetched for %s: %d articles, flags=%s, threat=%s",
            city, len(articles), unique_flags[:5], overall_threat,
        )
        return json.dumps(result)

    except requests.exceptions.HTTPError as e:
        logger.error("NewsAPI HTTP error for %s: %s", city, e)
        return json.dumps({"error": f"News API error: {e}", "city": city, "fallback": True, "articles": []})
    except Exception as e:
        logger.error("News fetch failed for %s: %s", city, e)
        return json.dumps({"error": str(e), "city": city, "fallback": True, "articles": []})


# ═══════════════════════════════════════════════════════════════════════════
# TOOL 3 — WEB SEARCH & CRAWLING (Tavily)
# ═══════════════════════════════════════════════════════════════════════════

@mcp.tool()
def crawl_web(query: str, city: Optional[str] = None) -> str:
    """
    Search the web for emerging hazard conditions using Tavily AI search.
    Identifies disruptions (road closures, local protests, power outages, etc.)
    that may not yet be covered by mainstream news APIs.

    Unlike a simple URL crawl, Tavily returns AI-curated, relevant results
    from across the web — ideal for discovering emerging conditions.

    Args:
        query: Search query (e.g. "Mumbai road closures today", "Chennai flooding")
        city: Optional city name for context-aware hazard detection
    """
    api_key = os.getenv("TAVILY_API_KEY", "").strip()
    if not api_key:
        return json.dumps({
            "error": "TAVILY_API_KEY not set in .env",
            "query": query,
            "city": city,
            "fallback": True,
            "hazards_found": [],
        })

    # Append city to query for better locality
    search_query = f"{query} {city}" if city and city.lower() not in query.lower() else query

    try:
        resp = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": search_query,
                "search_depth": "advanced",
                "include_answer": True,
                "include_raw_content": False,
                "max_results": 8,
                "topic": "news",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        # Extract results
        tavily_answer = data.get("answer", "")
        raw_results = data.get("results", [])

        # Process results and scan for hazard keywords
        processed_results: List[Dict[str, Any]] = []
        hazards_found: List[Dict[str, Any]] = []
        seen_hazards: set = set()

        for item in raw_results:
            title = item.get("title", "")
            content = item.get("content", "")
            url = item.get("url", "")
            score = item.get("score", 0)
            combined_text = f"{title} {content}".lower()

            # Scan for hazard keywords
            item_hazards: List[str] = []
            for keyword in HAZARD_KEYWORDS:
                if keyword in combined_text and keyword not in seen_hazards:
                    seen_hazards.add(keyword)
                    item_hazards.append(keyword)
                    # Extract context snippet around the keyword
                    idx = combined_text.find(keyword)
                    start = max(0, idx - 80)
                    end = min(len(combined_text), idx + len(keyword) + 80)
                    context_snippet = combined_text[start:end].strip()

                    hazards_found.append({
                        "keyword": keyword,
                        "context": context_snippet,
                        "category": _categorize_hazard(keyword),
                        "source_url": url,
                        "source_title": title,
                    })

            processed_results.append({
                "title": title,
                "url": url,
                "content_preview": (content[:300] + "...") if len(content) > 300 else content,
                "relevance_score": score,
                "hazard_keywords": item_hazards,
            })

        # Determine overall hazard level
        if len(hazards_found) >= 5:
            hazard_level = "CRITICAL"
        elif len(hazards_found) >= 3:
            hazard_level = "HIGH"
        elif len(hazards_found) >= 1:
            hazard_level = "MEDIUM"
        else:
            hazard_level = "LOW"

        result = {
            "query": search_query,
            "city": city,
            "tavily_answer": tavily_answer,
            "results_count": len(processed_results),
            "results": processed_results,
            "hazards_found": hazards_found,
            "hazard_count": len(hazards_found),
            "hazard_level": hazard_level,
            "crawled_at": datetime.now(timezone.utc).isoformat(),
            "source": "Tavily_AI_Search",
        }
        logger.info(
            "Tavily search '%s': %d results, %d hazards, level=%s",
            search_query, len(processed_results), len(hazards_found), hazard_level,
        )
        return json.dumps(result)

    except requests.exceptions.HTTPError as e:
        logger.error("Tavily HTTP error for '%s': %s", search_query, e)
        return json.dumps({"error": f"Tavily API error: {e}", "query": search_query})
    except Exception as e:
        logger.error("Tavily search failed for '%s': %s", search_query, e)
        return json.dumps({"error": str(e), "query": search_query})


def _categorize_hazard(keyword: str) -> str:
    """Map a hazard keyword to a broad category."""
    categories = {
        "weather": ["flood", "flooding", "waterlogging", "waterlogged", "cyclone", "storm",
                     "hurricane", "typhoon", "heat wave", "heatwave", "extreme heat",
                     "landslide", "mudslide", "earthquake"],
        "civil_unrest": ["strike", "protest", "rally", "bandh", "hartaal", "curfew",
                         "section 144", "lockdown"],
        "infrastructure": ["road closure", "road closed", "road block", "barricade",
                           "power outage", "power cut", "blackout"],
        "accident": ["accident", "pile-up", "collision", "fire", "blaze", "inferno"],
    }
    for cat, keywords in categories.items():
        if keyword in keywords:
            return cat
    return "other"


# ═══════════════════════════════════════════════════════════════════════════
# TOOL 4 — COMPOSITE RISK ANALYSIS (Weather + Tavily)
# ═══════════════════════════════════════════════════════════════════════════

@mcp.tool()
def analyze_localized_risk(location: str, sector: str) -> str:
    """
    Perform an autonomous composite risk analysis for a gig-work sector.

    Combines live weather data (OpenWeatherMap) with Tavily web crawl results
    to compute a final premium multiplier:
        P_final = P_base × R_weather × R_market

    Args:
        location: City name (e.g. "Chennai", "Mumbai")
        sector:   Gig sector (e.g. "delivery", "ride-share", "courier")
    """
    import json as _json

    # Crawl for sector-specific hazards
    query = (
        f"current gig worker hazards {sector} in {location} "
        "protests strikes road closures accidents disruptions today"
    )
    crawl_raw = json.loads(crawl_web(query=query, city=location))
    weather_raw = json.loads(get_weather(city=location))

    # R_weather
    r_weather = 1.0
    if not weather_raw.get("fallback"):
        alerts = weather_raw.get("alerts", [])
        if any(a.get("severity") == "critical" for a in alerts):
            r_weather = 1.8
        elif any(a.get("severity") == "high" for a in alerts):
            r_weather = 1.4
        elif any(a.get("severity") == "medium" for a in alerts):
            r_weather = 1.2

    # R_market from Tavily hazard count
    hazard_count = crawl_raw.get("hazard_count", 0)
    if hazard_count >= 5:
        r_market = 1.6
    elif hazard_count >= 3:
        r_market = 1.35
    elif hazard_count >= 1:
        r_market = 1.15
    else:
        r_market = 1.0

    _RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    _RANK_INV = {v: k for k, v in _RANK.items()}
    max_rank = max(
        _RANK.get(weather_raw.get("hazard_level", "LOW"), 0),
        _RANK.get(crawl_raw.get("hazard_level", "LOW"), 0),
    )
    overall_risk = _RANK_INV.get(max_rank, "LOW")
    final_multiplier = round(r_weather * r_market, 3)

    hazard_summaries = [
        f"- [{h['category'].upper()}] {h['keyword']}: {h['context'][:120]}"
        for h in crawl_raw.get("hazards_found", [])[:5]
    ]

    result = {
        "location": location,
        "sector": sector,
        "overall_risk_level": overall_risk,
        "r_weather": r_weather,
        "r_market": r_market,
        "final_premium_multiplier": final_multiplier,
        "weather_condition": weather_raw.get("condition", "unknown"),
        "weather_hazard_level": weather_raw.get("hazard_level", "LOW"),
        "crawl_hazard_level": crawl_raw.get("hazard_level", "LOW"),
        "tavily_answer": crawl_raw.get("tavily_answer", ""),
        "hazard_context": "\n".join(hazard_summaries) if hazard_summaries else "No specific hazards detected.",
        "formula": f"P_final = P_base x {r_weather} (weather) x {r_market} (market) = P_base x {final_multiplier}",
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "source": "GigShield_MCP_Server",
    }
    logger.info(
        "Risk analysis %s/%s: overall=%s, multiplier=%.3f",
        location, sector, overall_risk, final_multiplier,
    )
    return json.dumps(result)


# ═══════════════════════════════════════════════════════════════════════════
# Server entry point
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    logger.info("Starting GigShield MCP Server (FastMCP/SSE mode)...")
    logger.info("Tools registered: get_weather, get_news, crawl_web, analyze_localized_risk")
    logger.info("Tip: For HTTP /call-tool interface, run: python scripts/start_mcp_server.py")
    mcp.run(transport="sse")
