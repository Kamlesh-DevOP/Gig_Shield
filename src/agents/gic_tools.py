"""
LangChain @tool callables for GIC agents (RAG, MCP Layer, persistence).
Bindings are created via factory so each tool closes over RAGRetriever / optional Supabase / trace context.

MCP Integration:
  When MCP_SERVER_URL is set, fetch_live_disruption_signals → MCP Layer's get_weather
  fetch_live_news       → MCP Layer's get_news
  crawl_for_hazards     → MCP Layer's crawl_web (Tavily)
  fetch_mcp_risk_analysis → MCP Layer's analyze_localized_risk (composite)

Fallbacks:
  fetch_live_disruption_signals → Open-Meteo (no key, free) when MCP not set
  All others → graceful error JSON when MCP not set
"""

from __future__ import annotations

import json
import os
from typing import Dict, List

from langchain_core.tools import StructuredTool, tool

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.rag.rag_system import RAGRetriever


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _run_mcp_tool_sync(tool_name: str, arguments: dict) -> dict:
    """
    Call an MCP Layer tool synchronously from inside a LangChain tool.

    LangChain @tool functions are sync; the MCP client is async.
    We spin up a thread-pool executor to avoid blocking the event loop.
    """
    import asyncio
    import concurrent.futures
    from src.integrations.mcp_client import RealTimeMCPClient

    mcp_url = (os.getenv("MCP_SERVER_URL") or "").strip()
    if not mcp_url:
        return {"error": "MCP_SERVER_URL not set", "tool": tool_name}

    client = RealTimeMCPClient(server_url=mcp_url)

    async def _call():
        return await client._call_tool(tool_name, arguments)

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, _call())
                return future.result(timeout=30)
        else:
            return asyncio.run(_call())
    except Exception as exc:
        return {"error": str(exc), "tool": tool_name}


def _open_meteo_weather(city: str) -> str:
    """Free Open-Meteo fallback (no API key required)."""
    try:
        import requests

        r = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": city, "count": 1},
            timeout=8,
        )
        r.raise_for_status()
        geo = r.json().get("results") or []
        if not geo:
            return json.dumps({"city": city, "note": "geocode miss", "rainfall_cm": 0, "temperature_c": None})
        lat, lon = geo[0]["latitude"], geo[0]["longitude"]
        w = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": lat, "longitude": lon, "current": "temperature_2m,precipitation"},
            timeout=8,
        )
        w.raise_for_status()
        cur = w.json().get("current", {})
        rain_mm = float(cur.get("precipitation") or 0)
        temp = cur.get("temperature_2m")
        return json.dumps(
            {
                "city": city,
                "rainfall_cm": round(rain_mm / 10.0, 3),
                "temperature_c": temp,
                "source": "open-meteo-fallback",
            }
        )
    except Exception as exc:
        return json.dumps({"city": city, "error": str(exc), "rainfall_cm": 0, "temperature_c": 22.0, "source": "stub"})


# ─────────────────────────────────────────────────────────────
# Tool factory
# ─────────────────────────────────────────────────────────────

def build_gic_toolkit(
    rag: RAGRetriever,
    trace_id_holder: Dict[str, str],
) -> Dict[str, List[StructuredTool]]:
    """
    Returns tool lists keyed by agent role for create_tool_calling_agent.
    trace_id_holder: mutable dict e.g. {'trace_id': '...'} updated by graph before agent runs.

    MCP-connected tools (when MCP_SERVER_URL is set):
      fetch_live_disruption_signals → get_weather (OpenWeatherMap)
      fetch_live_news               → get_news (NewsAPI)
      crawl_for_hazards             → crawl_web (Tavily AI)
      fetch_mcp_risk_analysis       → analyze_localized_risk (composite formula)

    RAG tools (always available):
      retrieve_disruption_knowledge
      retrieve_policy_knowledge
      retrieve_fraud_playbooks

    Persistence tools (when Supabase configured):
      record_structured_observation
      persist_underwriter_decision_stub
    """

    # ── MCP: Weather ─────────────────────────────────────────
    @tool
    def fetch_live_disruption_signals(city: str) -> str:
        """
        Fetch live weather signals for a city from the MCP Layer (OpenWeatherMap).
        Returns temperature, rainfall, wind, humidity, condition, hazard_level, and alerts.
        Use this FIRST before asserting any weather-based trigger conditions.
        Falls back to Open-Meteo free API if MCP server is not configured.
        """
        mcp_url = (os.getenv("MCP_SERVER_URL") or "").strip()
        if mcp_url:
            result = _run_mcp_tool_sync("get_weather", {"city": city})
            if not result.get("error"):
                return json.dumps(result, default=str)
        # Fallback to Open-Meteo (no key required)
        return _open_meteo_weather(city)

    # ── MCP: News ────────────────────────────────────────────
    @tool
    def fetch_live_news(city: str, query: str = "") -> str:
        """
        Fetch live news for a city focused on disruption events (floods, strikes, protests, road closures).
        Returns articles with disruption flags and overall threat level (LOW/MEDIUM/HIGH/CRITICAL).
        Use to identify active disruptions in a region before assessing risk.
        Requires MCP_SERVER_URL to be set.
        """
        mcp_url = (os.getenv("MCP_SERVER_URL") or "").strip()
        if not mcp_url:
            return json.dumps({"city": city, "note": "MCP_SERVER_URL not set; no live news available", "articles": []})
        args: Dict[str, str] = {"city": city}
        if query:
            args["query"] = query
        result = _run_mcp_tool_sync("get_news", args)
        return json.dumps(result, default=str)

    # ── MCP: Tavily Crawl ────────────────────────────────────
    @tool
    def crawl_for_hazards(query: str, city: str = "") -> str:
        """
        Search the web for emerging hazard conditions using Tavily AI web search.
        Discovers disruptions that may not yet appear in mainstream news:
        road closures, local protests, power outages, strikes, accidents.
        Returns hazards_found with keyword, context snippet, and category.
        Requires MCP_SERVER_URL and TAVILY_API_KEY to be set.
        """
        mcp_url = (os.getenv("MCP_SERVER_URL") or "").strip()
        if not mcp_url:
            return json.dumps({"query": query, "note": "MCP_SERVER_URL not set; crawling unavailable"})
        args: Dict[str, str] = {"query": query}
        if city:
            args["city"] = city
        result = _run_mcp_tool_sync("crawl_web", args)
        return json.dumps(result, default=str)

    # ── MCP: Composite Risk Analysis ─────────────────────────
    @tool
    def fetch_mcp_risk_analysis(location: str, sector: str) -> str:
        """
        Perform a comprehensive real-time risk analysis for a gig-work sector in a location.

        Combines live weather (OpenWeatherMap) with Tavily autonomous web crawl to compute:
          P_final = P_base × R_weather × R_market

        R_weather: 1.0 (normal) | 1.2 (medium alerts) | 1.4 (high) | 1.8 (critical/storm)
        R_market:  1.0 (no hazards) | 1.15 (1-2) | 1.35 (3-4) | 1.6 (5+ hazards found)

        Returns the final_premium_multiplier, overall_risk_level, formula, and hazard_context.
        Use this for underwriting decisions and premium adjustment recommendations.
        """
        mcp_url = (os.getenv("MCP_SERVER_URL") or "").strip()
        if not mcp_url:
            return json.dumps({
                "location": location,
                "sector": sector,
                "note": "MCP_SERVER_URL not set; risk analysis unavailable",
                "final_premium_multiplier": 1.1,
                "overall_risk_level": "MEDIUM",
            })
        result = _run_mcp_tool_sync("analyze_localized_risk", {"location": location, "sector": sector})
        return json.dumps(result, default=str)

    # ── RAG: Disruption knowledge ────────────────────────────
    @tool
    def retrieve_disruption_knowledge(query: str) -> str:
        """Retrieve GIC parametric disruption rules and historical disruption context from the vector store."""
        ctx = rag.retrieve_context(query, categories=["disruption_events", "regional_data"])
        return ctx.get("context_text") or ""

    # ── RAG: Policy knowledge ────────────────────────────────
    @tool
    def retrieve_policy_knowledge(query: str) -> str:
        """Retrieve insurance policies, 75% threshold, cooling period, and slab rules from the vector store."""
        ctx = rag.retrieve_context(query, categories=["insurance_policies", "historical_claims"])
        return ctx.get("context_text") or ""

    # ── RAG: Fraud playbooks ─────────────────────────────────
    @tool
    def retrieve_fraud_playbooks(query: str) -> str:
        """Retrieve fraud patterns, GPS spoofing, peer validation, and coordinated fraud guidance."""
        ctx = rag.retrieve_context(query, categories=["fraud_cases"])
        return ctx.get("context_text") or ""

    # ── Persistence: Agent event log ─────────────────────────
    @tool
    def record_structured_observation(
        agent_name: str,
        event_type: str,
        observation_json: str,
    ) -> str:
        """Persist a structured agent observation to Supabase gic_agent_events (no secrets in payload)."""
        tid = trace_id_holder.get("trace_id", "")
        if not tid:
            return "skipped: no trace_id"
        try:
            from src.persistence import supabase_client

            if supabase_client.is_configured():
                payload = json.loads(observation_json) if observation_json else {}
                supabase_client.log_agent_event(tid, agent_name, event_type, payload)
                return "recorded"
        except Exception as exc:
            return f"record_failed:{exc}"
        return "supabase_not_configured"

    # ── Persistence: Decision stub ───────────────────────────
    @tool
    def persist_underwriter_decision_stub(
        decision: str,
        confidence_0_to_1: float,
        rationale: str,
    ) -> str:
        """Reserved for human approval workflows; logs intent only when DB configured."""
        tid = trace_id_holder.get("trace_id", "")
        if not tid:
            return "skipped: no trace_id"
        try:
            from src.persistence import supabase_client

            if supabase_client.is_configured():
                supabase_client.log_agent_event(
                    tid,
                    "DecisionAgent",
                    "intent",
                    {"decision": decision, "confidence": confidence_0_to_1, "rationale": rationale},
                )
                return "recorded"
        except Exception as exc:
            return f"record_failed:{exc}"
        return "supabase_not_configured"

    # ── Tool routing per agent ───────────────────────────────
    # Layer 1 — MonitorAgent: live signals + RAG disruption knowledge + Tavily crawl
    monitor_tools = [
        fetch_live_disruption_signals,  # MCP → OpenWeatherMap
        fetch_live_news,                # MCP → NewsAPI
        crawl_for_hazards,             # MCP → Tavily (was missing from monitor!)
        fetch_mcp_risk_analysis,        # MCP → composite risk (new)
        retrieve_disruption_knowledge,  # RAG
    ]

    # Layer 2 — ValidationAgent: cross-check monitor findings
    validation_tools = [
        retrieve_disruption_knowledge,
        retrieve_policy_knowledge,
        fetch_live_news,
        crawl_for_hazards,
        fetch_mcp_risk_analysis,        # validate premium impact
        record_structured_observation,
    ]

    # Layer 3 — ContextAgent: RAG enrichment
    context_tools = [
        retrieve_policy_knowledge,
        retrieve_disruption_knowledge,
        retrieve_fraud_playbooks,
    ]

    # Layer 4 (parallel) — FraudDetectionAgent
    fraud_tools = [
        retrieve_fraud_playbooks,
        retrieve_policy_knowledge,
        record_structured_observation,
    ]

    # Layer 4 (parallel) — RiskScoringAgent
    risk_tools = [
        retrieve_policy_knowledge,
        fetch_mcp_risk_analysis,        # live risk profile for underwriting
        record_structured_observation,
    ]

    # Layer 4 (parallel) — RuleValidationAgent
    rules_tools = [
        retrieve_policy_knowledge,
        record_structured_observation,
    ]

    # Layer 5 — DecisionAgent: synthesis of all signals
    decision_tools = [
        retrieve_policy_knowledge,
        retrieve_fraud_playbooks,
        fetch_mcp_risk_analysis,        # final premium multiplier for decision
        persist_underwriter_decision_stub,
    ]

    return {
        "monitor": monitor_tools,
        "validation": validation_tools,
        "context": context_tools,
        "fraud": fraud_tools,
        "risk": risk_tools,
        "rules": rules_tools,
        "decision": decision_tools,
    }
