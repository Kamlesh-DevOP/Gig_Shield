"""
GigShield MCP Layer — HTTP Tool Server (port 5100)
===================================================

Acts as the MCP Server in the Host ↔ MCP Server ↔ External APIs architecture.

Exposes:
  POST /call-tool          — invoke any registered tool by name + arguments
  GET  /tools              — list available tools
  GET  /health             — service health + API key status

Tools:
  get_weather              — OpenWeatherMap live weather
  get_news                 — NewsAPI disruption news
  crawl_web                — Tavily AI web search/crawl
  analyze_localized_risk   — Composite Tavily-powered risk analysis for gig sectors

Run:
  python mcp-layer/server.py
  # or via scripts/start_mcp_server.py
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────
# Bootstrap
# ─────────────────────────────────────────────────────────────
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(_ROOT, ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [MCP-Layer] %(levelname)s  %(message)s",
)
logger = logging.getLogger("mcp_layer")

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────
HAZARD_KEYWORDS: List[str] = [
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

DISRUPTION_NEWS_KEYWORDS: List[str] = [
    "flood", "strike", "protest", "cyclone", "curfew",
    "road closure", "accident", "power outage", "storm",
    "rally", "bandh", "waterlogging", "disruption",
    "shutdown", "blocked", "suspended",
]

CITY_COORDS: Dict[str, Dict[str, float]] = {
    "ahmedabad": {"lat": 23.0225, "lon": 72.5714},
    "bengaluru": {"lat": 12.9716, "lon": 77.5946},
    "bangalore": {"lat": 12.9716, "lon": 77.5946},
    "chandigarh": {"lat": 30.7333, "lon": 76.7794},
    "chennai": {"lat": 13.0827, "lon": 80.2707},
    "coimbatore": {"lat": 11.0168, "lon": 76.9558},
    "delhi": {"lat": 28.7041, "lon": 77.1025},
    "new delhi": {"lat": 28.7041, "lon": 77.1025},
    "hyderabad": {"lat": 17.3850, "lon": 78.4867},
    "kolkata": {"lat": 22.5726, "lon": 88.3639},
    "lucknow": {"lat": 26.8467, "lon": 80.9462},
    "pune": {"lat": 18.5204, "lon": 73.8567},
}

ALLOWED_REGIONS = set(CITY_COORDS.keys())

def _check_region(city: str) -> Optional[str]:
    """Returns an error message if the region is not covered."""
    if city.strip().lower() not in ALLOWED_REGIONS:
        return (
            f"Region '{city}' is currently not covered. "
            "Covered regions are: ahmedabad, bengaluru, chandigarh, chennai, "
            "coimbatore, delhi, hyderabad, kolkata, lucknow, pune."
        )
    return None


NEUTRAL_RISK = {
    "status": "mcp_server_unavailable",
    "hazard_level": "MEDIUM",
    "risk_multiplier": 1.1,
    "detail": "MCP server unreachable — applying neutral-risk fallback (10% premium increase).",
    "fallback": True,
}

# ─────────────────────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="GigShield MCP Layer",
    description="Real-time Weather, News, and Web-Crawl tools for dynamic gig-worker risk assessment.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# Request/response models
# ─────────────────────────────────────────────────────────────
class ToolCallRequest(BaseModel):
    name: str
    arguments: Dict[str, Any] = {}


class ToolCallResponse(BaseModel):
    tool: str
    content: List[Dict[str, Any]]


# ─────────────────────────────────────────────────────────────
# Tool implementations
# ─────────────────────────────────────────────────────────────

def _tool_get_weather(city: str) -> Dict[str, Any]:
    """Fetch live weather from OpenWeatherMap."""
    api_key = os.getenv("OPENWEATHERMAP_API_KEY", "").strip()
    
    err = _check_region(city)
    if err:
        logger.warning(err)
        return {
            "error": err,
            "city": city,
            "fallback": True,
            "temperature_c": 28.0,
            "rainfall_1h_mm": 0.0,
            "humidity_percent": 70,
            "wind_speed_kmph": 10.0,
            "condition": "Unknown",
            "condition_main": "Unknown",
            "hazard_level": "LOW",
            "alerts": [],
        }

    if not api_key:
        logger.warning("OPENWEATHERMAP_API_KEY not set — returning fallback weather")
        return {
            "error": "OPENWEATHERMAP_API_KEY not configured",
            "city": city,
            "fallback": True,
            "temperature_c": 28.0,
            "rainfall_1h_mm": 0.0,
            "humidity_percent": 70,
            "wind_speed_kmph": 10.0,
            "condition": "Unknown",
            "condition_main": "Unknown",
            "hazard_level": "LOW",
            "alerts": [],
        }

    city_lower = city.strip().lower()
    coords = CITY_COORDS.get(city_lower)

    try:
        params: Dict[str, Any] = {"appid": api_key, "units": "metric"}
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

        main = data.get("main", {})
        wind = data.get("wind", {})
        weather_list = data.get("weather", [{}])
        rain = data.get("rain", {})
        clouds = data.get("clouds", {})

        temperature = float(main.get("temp", 0))
        feels_like = float(main.get("feels_like", 0))
        humidity = int(main.get("humidity", 0))
        pressure = int(main.get("pressure", 0))
        wind_speed_kmph = round(float(wind.get("speed", 0)) * 3.6, 1)
        rainfall_1h = float(rain.get("1h", 0))
        rainfall_3h = float(rain.get("3h", 0))
        condition = weather_list[0].get("description", "unknown") if weather_list else "unknown"
        condition_main = weather_list[0].get("main", "Unknown") if weather_list else "Unknown"

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

        if condition_main.lower() in ("thunderstorm", "squall", "tornado"):
            alerts.append({
                "type": "Storm",
                "severity": "critical",
                "detail": f"Condition: {condition}",
                "source": "OpenWeatherMap",
            })

        hazard_level = (
            "CRITICAL" if any(a["severity"] == "critical" for a in alerts)
            else "HIGH" if any(a["severity"] == "high" for a in alerts)
            else "MEDIUM" if any(a["severity"] == "medium" for a in alerts)
            else "LOW"
        )

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
            "hazard_level": hazard_level,
            "risk_multiplier": (
                1.5 if condition_main in ("Rain", "Snow", "Thunderstorm", "Squall", "Tornado")
                else 1.2 if condition_main in ("Drizzle", "Mist", "Fog")
                else 1.0
            ),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "source": "OpenWeatherMap",
        }
        logger.info("Weather OK — %s: %s, %.1f°C, hazard=%s", city, condition, temperature, hazard_level)
        return result

    except requests.exceptions.HTTPError as e:
        logger.error("OpenWeatherMap HTTP error for %s: %s", city, e)
        return {"error": f"Weather API error: {e}", "city": city, "fallback": True,
                "hazard_level": "MEDIUM", "alerts": []}
    except Exception as e:
        logger.error("Weather fetch failed for %s: %s", city, e)
        return {"error": str(e), "city": city, "fallback": True,
                "hazard_level": "MEDIUM", "alerts": []}


def _tool_get_news(city: str, query: Optional[str] = None) -> Dict[str, Any]:
    """Fetch disruption news from NewsAPI."""
    api_key = os.getenv("NEWS_API_KEY", "").strip()

    err = _check_region(city)
    if err:
        logger.warning(err)
        return {
            "error": err,
            "city": city,
            "fallback": True,
            "articles": [],
            "disruption_flags": [],
            "overall_threat_level": "LOW",
        }

    if not api_key:
        logger.warning("NEWS_API_KEY not set — returning empty news")
        return {
            "error": "NEWS_API_KEY not configured",
            "city": city,
            "fallback": True,
            "articles": [],
            "disruption_flags": [],
            "overall_threat_level": "LOW",
        }

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

        unique_flags = list(dict.fromkeys(disruption_flags))
        critical_count = sum(1 for a in articles if a["severity"] == "critical")
        high_count = sum(1 for a in articles if a["severity"] == "high")

        if critical_count >= 2:
            overall_threat = "CRITICAL"
        elif critical_count >= 1 or high_count >= 3:
            overall_threat = "HIGH"
        elif high_count >= 1:
            overall_threat = "MEDIUM"
        else:
            overall_threat = "LOW"

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
        logger.info("News OK — %s: %d articles, threat=%s, flags=%s",
                    city, len(articles), overall_threat, unique_flags[:5])
        return result

    except requests.exceptions.HTTPError as e:
        logger.error("NewsAPI HTTP error for %s: %s", city, e)
        return {"error": f"News API error: {e}", "city": city, "fallback": True,
                "articles": [], "disruption_flags": [], "overall_threat_level": "LOW"}
    except Exception as e:
        logger.error("News fetch failed for %s: %s", city, e)
        return {"error": str(e), "city": city, "fallback": True,
                "articles": [], "disruption_flags": [], "overall_threat_level": "LOW"}


def _categorize_hazard(keyword: str) -> str:
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


def _tool_crawl_web(query: str, city: Optional[str] = None) -> Dict[str, Any]:
    """Search the web via Tavily AI for emerging hazard conditions."""
    api_key = os.getenv("TAVILY_API_KEY", "").strip()

    if city:
        err = _check_region(city)
        if err:
            logger.warning(err)
            return {
                "error": err,
                "query": query,
                "city": city,
                "fallback": True,
                "hazards_found": [],
                "hazard_level": "LOW",
            }

    if not api_key:
        logger.warning("TAVILY_API_KEY not set — returning empty crawl")
        return {
            "error": "TAVILY_API_KEY not configured",
            "query": query,
            "city": city,
            "fallback": True,
            "hazards_found": [],
            "hazard_level": "LOW",
        }

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
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()

        tavily_answer = data.get("answer", "")
        raw_results = data.get("results", [])

        processed_results: List[Dict[str, Any]] = []
        hazards_found: List[Dict[str, Any]] = []
        seen_hazards: set = set()

        for item in raw_results:
            title = item.get("title", "")
            content = item.get("content", "")
            url = item.get("url", "")
            score = item.get("score", 0)
            combined_text = f"{title} {content}".lower()

            item_hazards: List[str] = []
            for keyword in HAZARD_KEYWORDS:
                if keyword in combined_text and keyword not in seen_hazards:
                    seen_hazards.add(keyword)
                    item_hazards.append(keyword)
                    idx = combined_text.find(keyword)
                    start = max(0, idx - 80)
                    end = min(len(combined_text), idx + len(keyword) + 80)
                    hazards_found.append({
                        "keyword": keyword,
                        "context": combined_text[start:end].strip(),
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
        logger.info("Tavily OK — '%s': %d results, %d hazards, level=%s",
                    search_query, len(processed_results), len(hazards_found), hazard_level)
        return result

    except requests.exceptions.HTTPError as e:
        logger.error("Tavily HTTP error for '%s': %s", search_query, e)
        return {"error": f"Tavily API error: {e}", "query": search_query,
                "hazards_found": [], "hazard_level": "LOW"}
    except Exception as e:
        logger.error("Tavily search failed for '%s': %s", search_query, e)
        return {"error": str(e), "query": search_query,
                "hazards_found": [], "hazard_level": "LOW"}


def _tool_analyze_localized_risk(location: str, sector: str) -> Dict[str, Any]:
    """
    Composite autonomous risk analysis for a gig-work sector in a location.

    Uses Tavily to crawl for sector-specific hazards (strikes, protests, road
    closures) and combines with weather data to produce a risk profile with a
    final premium multiplier:

        P_final = P_base × R_weather × R_market
    """
    # 1. Tavily sector-specific crawl
    query = (
        f"current gig worker hazards {sector} in {location} "
        "protests strikes road closures accidents disruptions today"
    )
    crawl = _tool_crawl_web(query, city=location)

    # 2. Live weather
    weather = _tool_get_weather(location)

    # 3. Compute R_weather
    r_weather = weather.get("risk_multiplier", 1.0)
    if not weather.get("fallback"):
        alerts = weather.get("alerts", [])
        if any(a.get("severity") == "critical" for a in alerts):
            r_weather = max(r_weather, 1.8)
        elif any(a.get("severity") == "high" for a in alerts):
            r_weather = max(r_weather, 1.4)

    # 4. Compute R_market from crawl hazards
    hazard_count = crawl.get("hazard_count", 0)
    if hazard_count >= 5:
        r_market = 1.6
    elif hazard_count >= 3:
        r_market = 1.35
    elif hazard_count >= 1:
        r_market = 1.15
    else:
        r_market = 1.0

    # 5. Determine overall risk level
    max_level_rank = max(
        {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}.get(weather.get("hazard_level", "LOW"), 0),
        {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}.get(crawl.get("hazard_level", "LOW"), 0),
    )
    overall_risk = ["LOW", "MEDIUM", "HIGH", "CRITICAL"][max_level_rank]

    # 6. Build final context snippet for LLM / agent consumption
    hazard_summaries: List[str] = []
    for h in crawl.get("hazards_found", [])[:5]:
        hazard_summaries.append(f"- [{h['category'].upper()}] {h['keyword']}: {h['context'][:120]}")

    crawl_context = "\n".join(hazard_summaries) if hazard_summaries else "No specific hazards detected."

    final_multiplier = round(r_weather * r_market, 3)

    return {
        "location": location,
        "sector": sector,
        "overall_risk_level": overall_risk,
        "r_weather": r_weather,
        "r_market": r_market,
        "final_premium_multiplier": final_multiplier,
        "weather_condition": weather.get("condition", "unknown"),
        "weather_hazard_level": weather.get("hazard_level", "LOW"),
        "crawl_hazard_level": crawl.get("hazard_level", "LOW"),
        "tavily_answer": crawl.get("tavily_answer", ""),
        "hazard_context": crawl_context,
        "hazards_found": crawl.get("hazards_found", []),
        "formula": f"P_final = P_base × {r_weather} (weather) × {r_market} (market) = P_base × {final_multiplier}",
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "source": "GigShield_MCP_Layer",
    }


# ─────────────────────────────────────────────────────────────
# Tool registry
# ─────────────────────────────────────────────────────────────
TOOL_REGISTRY: Dict[str, Any] = {
    "get_weather": {
        "fn": lambda args: _tool_get_weather(args["city"]),
        "description": "Fetch live weather from OpenWeatherMap. Required: city (str).",
        "required": ["city"],
    },
    "get_news": {
        "fn": lambda args: _tool_get_news(args["city"], args.get("query")),
        "description": "Fetch disruption news from NewsAPI. Required: city. Optional: query.",
        "required": ["city"],
    },
    "crawl_web": {
        "fn": lambda args: _tool_crawl_web(args["query"], args.get("city")),
        "description": "AI-powered web search via Tavily for emerging hazards. Required: query. Optional: city.",
        "required": ["query"],
    },
    "analyze_localized_risk": {
        "fn": lambda args: _tool_analyze_localized_risk(args["location"], args["sector"]),
        "description": (
            "Composite risk analysis for a gig-work sector in a location. "
            "Returns premium multiplier P_final = P_base × R_weather × R_market. "
            "Required: location (str), sector (str e.g. 'delivery', 'ride-share')."
        ),
        "required": ["location", "sector"],
    },
}


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    """Service health and API key status."""
    return {
        "status": "online",
        "service": "GigShield MCP Layer",
        "version": "2.0.0",
        "tools": list(TOOL_REGISTRY.keys()),
        "api_keys": {
            "OPENWEATHERMAP_API_KEY": bool(os.getenv("OPENWEATHERMAP_API_KEY", "").strip()),
            "NEWS_API_KEY": bool(os.getenv("NEWS_API_KEY", "").strip()),
            "TAVILY_API_KEY": bool(os.getenv("TAVILY_API_KEY", "").strip()),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/tools", tags=["Tools"])
def list_tools():
    """List all registered tools and their descriptions."""
    return {
        "tools": [
            {
                "name": name,
                "description": meta["description"],
                "required_arguments": meta["required"],
            }
            for name, meta in TOOL_REGISTRY.items()
        ]
    }


@app.post("/call-tool", tags=["Tools"])
def call_tool(req: ToolCallRequest):
    """
    Invoke a registered tool by name with the provided arguments.

    Returns FastMCP-compatible envelope:
      { "content": [{ "type": "text", "text": "<JSON string>" }] }
    """
    tool_meta = TOOL_REGISTRY.get(req.name)
    if not tool_meta:
        raise HTTPException(
            status_code=404,
            detail=f"Tool '{req.name}' not found. Available: {list(TOOL_REGISTRY.keys())}",
        )

    # Validate required args
    missing = [k for k in tool_meta["required"] if k not in req.arguments]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required arguments for '{req.name}': {missing}",
        )

    try:
        result = tool_meta["fn"](req.arguments)
    except Exception as e:
        logger.exception("Tool '%s' raised an exception", req.name)
        # Return neutral risk on error — backend must not crash
        result = {**NEUTRAL_RISK, "tool": req.name, "error": str(e)}

    return {
        "tool": req.name,
        "content": [{"type": "text", "text": json.dumps(result)}],
    }


# ─────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("MCP_SERVER_PORT", "5100"))
    logger.info("🚀 GigShield MCP Layer starting on port %d", port)
    logger.info("   Tools: %s", ", ".join(TOOL_REGISTRY.keys()))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False, app_dir=os.path.dirname(__file__))
