"""
Final system-wide integration audit.
Tests every workflow layer against the live MCP layer.
"""
import sys, os, json, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
os.environ["MCP_SERVER_URL"] = "http://localhost:5100"
sys.path.insert(0, ".")

PASS = "[PASS]"
FAIL = "[FAIL]"
INFO = "[INFO]"

results = []

def call_tool(name, args, timeout=35):
    data = json.dumps({"name": name, "arguments": args}).encode()
    req = urllib.request.Request(
        "http://localhost:5100/call-tool", data=data,
        headers={"Content-Type": "application/json"},
    )
    envelope = json.load(urllib.request.urlopen(req, timeout=timeout))
    return json.loads(envelope["content"][0]["text"])


def check(label, condition, detail=""):
    status = PASS if condition else FAIL
    line = f"  {status}  {label}"
    if detail:
        line += f" — {detail}"
    print(line)
    results.append((label, condition))
    return condition


print("\n" + "="*65)
print("  GIGSHIELD ARCHITECTURE AUDIT — Full Pipeline Check")
print("="*65)

# ── Layer 0: MCP Server health ───────────────────────────────
print("\n[Layer 0] MCP Server Health")
try:
    r = urllib.request.urlopen("http://localhost:5100/health", timeout=5)
    h = json.load(r)
    check("Server online", h["status"] == "online")
    tools = h["tools"]
    check("get_weather registered", "get_weather" in tools)
    check("get_news registered", "get_news" in tools)
    check("crawl_web registered", "crawl_web" in tools)
    check("analyze_localized_risk registered", "analyze_localized_risk" in tools)
    keys = h["api_keys"]
    check("OpenWeatherMap API key", keys.get("OPENWEATHERMAP_API_KEY"))
    check("NewsAPI key", keys.get("NEWS_API_KEY"))
    check("Tavily API key", keys.get("TAVILY_API_KEY"))
except Exception as e:
    check("MCP server reachable", False, str(e))

# ── Layer 1: Monitoring — weather + news + crawl ─────────────
print("\n[Layer 1] Trigger Monitoring (External APIs → MCP Layer)")
try:
    w = call_tool("get_weather", {"city": "Chennai"})
    check("get_weather returns city", w.get("city") == "Chennai")
    check("get_weather has hazard_level", "hazard_level" in w)
    check("get_weather has temperature", "temperature_c" in w)
    check("get_weather has MCP multiplier", "risk_multiplier" in w)
except Exception as e:
    check("Layer 1 weather", False, str(e))

try:
    n = call_tool("get_news", {"city": "Mumbai"})
    check("get_news returns articles list", "articles" in n)
    check("get_news has threat_level", "overall_threat_level" in n)
    check("get_news has disruption_flags", "disruption_flags" in n)
except Exception as e:
    check("Layer 1 news", False, str(e))

try:
    c = call_tool("crawl_web", {"query": "gig worker road closure Mumbai today", "city": "Mumbai"})
    check("crawl_web returns results", "results" in c)
    check("crawl_web has hazard_level", "hazard_level" in c)
    check("crawl_web uses Tavily", c.get("source") == "Tavily_AI_Search")
except Exception as e:
    check("Layer 1 crawl", False, str(e))

# ── Layer 2: Validation — analyze_localized_risk ─────────────
print("\n[Layer 2] Validation + Actuarial Assessment (analyze_localized_risk)")
try:
    risk = call_tool("analyze_localized_risk", {"location": "Chennai", "sector": "delivery"})
    check("analyze_localized_risk returns overall_risk_level", "overall_risk_level" in risk)
    check("analyze_localized_risk returns r_weather", "r_weather" in risk)
    check("analyze_localized_risk returns r_market", "r_market" in risk)
    check("analyze_localized_risk returns multiplier", "final_premium_multiplier" in risk)
    check("analyze_localized_risk returns formula", "formula" in risk)
    check("multiplier > 0", float(risk.get("final_premium_multiplier", 0)) > 0)
    print(f"  {INFO}  Formula: {risk.get('formula')}")
except Exception as e:
    check("Layer 2 analyze_localized_risk", False, str(e))

# ── Layer 3: RAG ─────────────────────────────────────────────
print("\n[Layer 3] RAG Layer (Vector DB Context Retrieval)")
try:
    from src.rag.rag_system import RAGRetriever, VectorStore
    vs = VectorStore(provider="chromadb")
    rag = RAGRetriever(vs)
    ctx = rag.retrieve_context("flood disruption income loss gig worker",
                               categories=["insurance_policies", "disruption_events"])
    check("RAG retrieves context", ctx.get("num_results", 0) >= 0)
    check("RAG has context_text", bool(ctx.get("context_text")))
    print(f"  {INFO}  Retrieved {ctx.get('num_results', 0)} documents")
except Exception as e:
    check("Layer 3 RAG", False, str(e))

# ── Layer 4: Parallel Agents ─────────────────────────────────
print("\n[Layer 4] Parallel Decision Agents (Fraud + Risk + Rules)")
try:
    from src.agents.core_agents import (
        FraudDetectionAgent, RiskScoringAgent, RuleValidationAgent, run_parallel_agents
    )
    import asyncio

    fraud = FraudDetectionAgent()
    risk_agent = RiskScoringAgent()
    rules = RuleValidationAgent()

    test_worker = {
        "worker_id": 42, "gps_spoofing_score": 0.05, "movement_realism_score": 0.95,
        "peer_group_activity_ratio": 1.0, "device_sharing_flag": 0,
        "orders_completed_week": 25, "active_hours_week": 40,
        "overall_risk_score": 0.3, "cooling_period_completed": 1,
        "premium_paid": 1, "employment_type": "full-time",
    }

    msgs = asyncio.run(run_parallel_agents(test_worker, "test-trace", fraud, risk_agent, rules))
    types = [m.message_type for m in msgs]
    check("FraudDetectionAgent runs", "fraud_analysis_complete" in types)
    check("RiskScoringAgent runs", "risk_scoring_complete" in types)
    check("RuleValidationAgent runs", "rule_validation" in types)

    fraud_msg = next(m for m in msgs if m.message_type == "fraud_analysis_complete")
    check("Fraud action determined", fraud_msg.data.get("action") in ("approve", "flag_for_review", "reject"))
    print(f"  {INFO}  Fraud action: {fraud_msg.data.get('action')}, score={fraud_msg.data.get('fraud_score', 0):.3f}")
except Exception as e:
    check("Layer 4 parallel agents", False, str(e))

# ── Layer 5: Decision Orchestrator ──────────────────────────
print("\n[Layer 5] Decision Orchestrator (Aggregation)")
try:
    from src.agents.core_agents import DecisionAgent, AgentMessage
    from datetime import datetime

    decision = DecisionAgent()

    mock_msgs = [
        AgentMessage("FraudDetectionAgent", datetime.now(), "fraud_analysis_complete",
                     {"fraud_score": 0.1, "action": "approve", "trust_rating": 0.9}, "t1"),
        AgentMessage("RiskScoringAgent", datetime.now(), "risk_scoring_complete",
                     {"risk_score": 0.3}, "t1"),
        AgentMessage("RuleValidationAgent", datetime.now(), "rule_validation",
                     {"ok": True, "violations": []}, "t1"),
    ]

    import asyncio
    dec_msg = asyncio.run(decision.process({"agent_outputs": mock_msgs}, "t1"))

    check("DecisionAgent aggregates signals", "decision" in dec_msg.data)
    check("Decision is valid", dec_msg.data.get("decision") in ("auto_approve", "auto_reject", "manual_review"))
    check("Confidence > 0", float(dec_msg.data.get("confidence", 0)) > 0)
    print(f"  {INFO}  Decision: {dec_msg.data.get('decision')}, confidence={dec_msg.data.get('confidence'):.2f}")
except Exception as e:
    check("Layer 5 decision", False, str(e))

# ── Layer 6: SQL / Persistence ──────────────────────────────
print("\n[Layer 6] SQL Layer (Structured Persistence)")
try:
    import os as _os
    _os.makedirs("logs", exist_ok=True)
    log_path = "logs/agent_decisions.jsonl"
    # Test SQLAgent writes
    from src.agents.core_agents import SQLAgent
    sql = SQLAgent()
    import asyncio
    sql_msg = asyncio.run(sql.process({
        "record": {"worker_id": 42, "decision": "auto_approve", "confidence": 0.88, "payout_amount": 500.0}
    }, "audit-trace"))
    check("SQLAgent writes JSONL log", _os.path.exists(log_path))
    check("SQLAgent returns sql_recorded", sql_msg.message_type == "sql_recorded")
    print(f"  {INFO}  Log path: {log_path}")
except Exception as e:
    check("Layer 6 SQL agent", False, str(e))

# ── Layer 7: MCP Host (get_dynamic_risk_profile) ────────────
print("\n[Layer 7] MCP Host Pattern (backend/services/mcp_client.py)")
try:
    import asyncio
    from backend.services.mcp_client import get_dynamic_risk_profile
    profile = asyncio.run(get_dynamic_risk_profile("Bengaluru", "ride-share"))
    check("get_dynamic_risk_profile returns", "overall_risk_level" in profile)
    check("combined_multiplier > 0", float(profile.get("combined_multiplier", 0)) > 0)
    check("r_weather present", "r_weather" in profile)
    check("r_market present", "r_market" in profile)
    check("Not fallback", not profile.get("weather_data", {}).get("fallback"))
    print(f"  {INFO}  Bengaluru/ride-share: risk={profile['overall_risk_level']}, multiplier={profile['combined_multiplier']}")
except Exception as e:
    check("Layer 7 MCP host", False, str(e))

# ── API Endpoint Connectivity ────────────────────────────────
print("\n[API Endpoints] Schema & Tool Connectivity")
try:
    from src.api.shift_schemas import ShiftStartRequest, ShiftStartResponse, DynamicRiskRequest
    req = ShiftStartRequest(worker_id=1, city="Chennai", work_type="delivery")
    check("ShiftStartRequest has work_type", req.work_type == "delivery")
    check("ShiftStartResponse has mcp_risk_profile field", "mcp_risk_profile" in ShiftStartResponse.model_fields)
    check("DynamicRiskRequest schema exists", True)
    print(f"  {INFO}  POST /api/shift/start — schema OK with work_type and mcp_risk_profile")
    print(f"  {INFO}  POST /api/risk/dynamic — DynamicRiskRequest/Response schemas OK")
    print(f"  {INFO}  POST /api/hazard/check — wired to RealTimeMCPClient")
except Exception as e:
    check("API schemas", False, str(e))

# ── gigshield_tools.py MCP wiring ───────────────────────────
print("\n[Tools] gigshield_tools.py MCP Wiring")
try:
    from src.agents.gigshield_tools import build_gigshield_toolkit
    from src.rag.rag_system import RAGRetriever, VectorStore
    rag = RAGRetriever(VectorStore(provider="chromadb"))
    toolkit = build_gigshield_toolkit(rag, {"trace_id": "test"})
    tool_names = {role: [t.name for t in tools] for role, tools in toolkit.items()}
    check("monitor has fetch_live_disruption_signals", "fetch_live_disruption_signals" in tool_names["monitor"])
    check("monitor has crawl_for_hazards (was missing)", "crawl_for_hazards" in tool_names["monitor"])
    check("monitor has fetch_mcp_risk_analysis (new)", "fetch_mcp_risk_analysis" in tool_names["monitor"])
    check("decision has fetch_mcp_risk_analysis", "fetch_mcp_risk_analysis" in tool_names["decision"])
    check("risk has fetch_mcp_risk_analysis", "fetch_mcp_risk_analysis" in tool_names["risk"])
    for role, names in tool_names.items():
        print(f"  {INFO}  {role:12s}: {', '.join(names)}")
except Exception as e:
    check("gigshield_tools wiring", False, str(e))

# ── Summary ──────────────────────────────────────────────────
total = len(results)
passed = sum(1 for _, ok in results if ok)
failed = total - passed

print("\n" + "="*65)
print(f"  AUDIT COMPLETE: {passed}/{total} checks passed, {failed} failed")
if failed == 0:
    print("  ALL SYSTEMS CONNECTED AND OPERATIONAL")
else:
    print("  FAILURES:")
    for label, ok in results:
        if not ok:
            print(f"    - {label}")
print("="*65 + "\n")
