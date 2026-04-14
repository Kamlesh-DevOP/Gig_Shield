"""
GigShield FastAPI application.

Run from repository root:
  uvicorn app:app --host 0.0.0.0 --port 8000

Or:
  uvicorn src.api.main:app --host 0.0.0.0 --port 8000

Partner mock APIs (weather/news/telecom/...) are mounted at /partner-mock (e.g. /partner-mock/api/weather).
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.api.schemas import (
    ClassicClaimRequest,
    EvaluateWorkerRequest,
    InferencePredictRequest,
    OrchestrateBatchRequest,
    RAGRetrieveRequest,
)
from src.api.shift_schemas import (
    ShiftStartRequest,
    ShiftStartResponse,
    HazardAlert,
    HazardCheckRequest,
    CoverageAdjustment,
    WeatherSummary,
    NewsSummary,
    CrawlSummary,
    DynamicRiskRequest,
    DynamicRiskResponse,
)

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

load_dotenv(_ROOT / ".env")

logger = logging.getLogger(__name__)

# --- Lifespan globals ---
inference_pipeline: Any = None
vector_store: Any = None
classic_orchestrator: Any = None
langgraph_orchestrator: Any = None


def _model_paths(model_dir: str) -> Dict[str, str]:
    base = (model_dir or "models").strip().rstrip("/\\")
    return {
        "income_forecasting": f"{base}/income_forecasting",
        "risk_scoring": f"{base}/risk_scoring",
        "fraud_detection": f"{base}/fraud_detection",
        "disruption_impact": f"{base}/disruption_impact",
        "behavior_analysis": f"{base}/behavior_analysis",
        "premium_prediction": f"{base}/premium_prediction",
    }


def json_safe(obj: Any) -> Any:
    """Make ML outputs JSON-serializable."""
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {str(k): json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_safe(x) for x in obj]
    if isinstance(obj, pd.DataFrame):
        if len(obj) == 1:
            return json_safe(obj.iloc[0].to_dict())
        return json_safe(obj.to_dict(orient="records"))
    if isinstance(obj, pd.Series):
        return json_safe(obj.to_dict())
    if hasattr(obj, "tolist"):
        try:
            return json_safe(obj.tolist())
        except Exception:
            pass
    if hasattr(obj, "item"):
        try:
            return json_safe(obj.item())
        except Exception:
            pass
    return str(obj)


def _workflow_to_dict(r: Any) -> Dict[str, Any]:
    from src.pipeline.orchestrator import WorkflowResult

    if not isinstance(r, WorkflowResult):
        return json_safe(r)
    extras = r.extras or {}
    elig = extras.get("claim_eligibility")
    elig_dict = None
    if elig is not None:
        try:
            elig_dict = {"is_eligible": bool(elig.is_eligible), "reasons": list(getattr(elig, "reasons", []) or [])}
        except Exception:
            elig_dict = str(elig)
    return {
        "trace_id": r.trace_id,
        "worker_id": r.worker_id,
        "decision": r.decision,
        "confidence": r.confidence,
        "payout_amount": r.payout_amount,
        "processing_time_ms": r.processing_time_ms,
        "timestamp": r.timestamp.isoformat() if hasattr(r.timestamp, "isoformat") else str(r.timestamp),
        "claim_eligibility": elig_dict,
        "payout_breakdown": json_safe(extras.get("payout_breakdown")),
        "ml_predictions": json_safe(extras.get("ml_predictions")),
    }


def load_models_sync():
    global inference_pipeline, vector_store, classic_orchestrator, langgraph_orchestrator

    model_dir = os.getenv("GIGSHIELD_MODEL_DIR", "models")
    paths = _model_paths(model_dir)

    print("\n[GigShield API] Background task starting — loading models and orchestrators...")

    try:
        from src.pipeline.training_pipeline import InferencePipeline

        inference_pipeline = InferencePipeline(paths)
        print("[GigShield API] InferencePipeline loaded.")
    except Exception as e:
        logger.warning("InferencePipeline not loaded: %s", e)
        print(f"[GigShield API] Warning: InferencePipeline unavailable: {e}")

    try:
        from src.rag.rag_system import VectorStore, populate_knowledge_base

        vector_store = VectorStore()
        populate_knowledge_base(vector_store)
        print("[GigShield API] Vector store + knowledge bundle ready.")
    except Exception as e:
        logger.warning("Vector store / KB: %s", e)
        print(f"[GigShield API] Warning: RAG vector store limited or offline: {e}")

    try:
        from src.pipeline.orchestrator import GigShieldOrchestrator

        classic_orchestrator = GigShieldOrchestrator(
            inference_pipeline=inference_pipeline,
            vector_store=vector_store,
        )
        print("[GigShield API] Classic GigShieldOrchestrator ready (no Groq/LLM required).")
    except Exception as e:
        logger.warning("Classic orchestrator: %s", e)
        print(f"[GigShield API] Warning: classic orchestrator failed: {e}")

    try:
        from src.agents.gigshield_langgraph import GigShieldLangGraphOrchestrator

        lang_ensure_kb = vector_store is None
        langgraph_orchestrator = GigShieldLangGraphOrchestrator(
            inference_pipeline=inference_pipeline,
            vector_store=vector_store,
            ensure_kb=lang_ensure_kb,
        )
        print("[GigShield API] LangGraph orchestrator ready.")
    except Exception as e:
        logger.warning("LangGraph orchestrator: %s", e)
        print(f"[GigShield API] Warning: LangGraph offline (check GROQ_API_KEY): {e}")

    print("[GigShield API] Background loading complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    
    print("\n[GigShield API] Starting FastAPI server. Models are loading in the background...")
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, load_models_sync)
    yield

    print("[GigShield API] Shutdown.")


def create_app() -> FastAPI:
    application = FastAPI(
        title="GigShield API",
        description="ML inference, RAG, classic multi-agent pipeline, and LangGraph tool agents.",
        version="1.1.0",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv("GIGSHIELD_CORS_ORIGINS", "*").split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Optional: mount local partner mock under /partner-mock
    if os.getenv("GIGSHIELD_MOUNT_PARTNER_MOCK", "true").strip().lower() in ("1", "true", "yes", "on"):
        try:
            from mock_api.mock_api import app as partner_mock_app

            application.mount("/partner-mock", partner_mock_app)
            logger.info("Mounted partner mock at /partner-mock")
        except Exception as e:
            logger.warning("Partner mock not mounted: %s", e)

    @application.get("/", tags=["System"])
    def root():
        return {
            "service": "GigShield API",
            "docs": "/docs",
            "health": "/health",
            "endpoints": {
                "dynamic_risk": "POST /api/risk/dynamic  [MCP Host — live weather+Tavily risk]",
                "shift_start": "POST /api/shift/start",
                "hazard_check": "POST /api/hazard/check",
                "evaluate_worker_langgraph": "POST /api/evaluate_worker",
                "orchestrate_batch": "POST /api/orchestrate",
                "classic_claim": "POST /api/claims/process-classic",
                "ml_predict": "POST /api/inference/predict",
                "rag": "POST /api/rag/retrieve",
                "partner_mock": "GET /partner-mock/api/weather?city=Chennai (if mounted)",
            },
        }

    @application.get("/health", tags=["System"])
    def health_check():
        mcp_url = os.getenv("MCP_SERVER_URL", "")
        return {
            "status": "online",
            "models_loaded": inference_pipeline is not None,
            "classic_orchestrator": classic_orchestrator is not None,
            "langgraph_orchestrator": langgraph_orchestrator is not None,
            "vector_store": vector_store is not None,
            "mcp_server_configured": bool(mcp_url),
            "mcp_server_url": mcp_url or None,
        }

    @application.post("/api/evaluate_worker", tags=["LangGraph"])
    async def evaluate_worker(req: EvaluateWorkerRequest):
        if not langgraph_orchestrator:
            raise HTTPException(
                status_code=503,
                detail="LangGraph orchestrator offline. Set GROQ_API_KEY and restart.",
            )
        try:
            worker_dict = req.worker.model_dump()
            df_input = pd.DataFrame([worker_dict])
            target_city = req.city or req.worker.city
            result = await langgraph_orchestrator.run(
                worker_data=df_input,
                city=target_city,
                context_question=req.context_question,
            )
            out: Dict[str, Any] = {
                "trace_id": result.trace_id,
                "worker_id": result.worker_id,
                "processing_time_ms": result.processing_time_ms,
                "decision": result.final_state.get("decision_code"),
                "confidence": result.final_state.get("confidence"),
                "payout_amount": result.final_state.get("payout_amount"),
                "eligibility_snapshot": result.final_state.get("eligibility_snapshot"),
                "payout_breakdown": json_safe(result.final_state.get("payout_breakdown")),
            }
            if req.include_graph_state:
                out["final_state"] = json_safe(result.final_state)
            return out
        except Exception as e:
            logger.exception("evaluate_worker")
            raise HTTPException(status_code=500, detail=str(e)) from e

    @application.post("/api/orchestrate", tags=["LangGraph"])
    async def orchestrate_batch(req: OrchestrateBatchRequest):
        if not langgraph_orchestrator:
            raise HTTPException(status_code=503, detail="LangGraph orchestrator offline.")
        if not req.workers:
            raise HTTPException(status_code=400, detail="workers list cannot be empty.")
        results: List[Dict[str, Any]] = []
        try:
            for worker in req.workers:
                worker_dict = worker.model_dump()
                df_input = pd.DataFrame([worker_dict])
                target_city = req.city or worker.city
                res = await langgraph_orchestrator.run(
                    worker_data=df_input,
                    city=target_city,
                    context_question=req.context_question,
                )
                item: Dict[str, Any] = {
                    "trace_id": res.trace_id,
                    "worker_id": res.worker_id,
                    "decision": res.final_state.get("decision_code"),
                    "confidence": res.final_state.get("confidence"),
                    "payout_amount": res.final_state.get("payout_amount"),
                    "processing_time_ms": res.processing_time_ms,
                }
                if req.include_graph_state:
                    item["final_state"] = json_safe(res.final_state)
                results.append(item)
            return {"batch_size": len(results), "results": results}
        except Exception as e:
            logger.exception("orchestrate_batch")
            raise HTTPException(status_code=500, detail=str(e)) from e

    @application.post("/api/claims/process-classic", tags=["Classic pipeline"])
    async def process_claim_classic(req: ClassicClaimRequest):
        if not classic_orchestrator:
            raise HTTPException(
                status_code=503,
                detail="Classic orchestrator unavailable (check logs / RAG / models).",
            )
        try:
            worker_dict = req.worker.model_dump()
            df_input = pd.DataFrame([worker_dict])
            target_city = req.city or req.worker.city
            wf = await classic_orchestrator.process_claim(df_input, city=target_city)
            return _workflow_to_dict(wf)
        except Exception as e:
            logger.exception("process_claim_classic")
            raise HTTPException(status_code=500, detail=str(e)) from e

    @application.post("/api/inference/predict", tags=["ML"])
    def inference_predict(req: InferencePredictRequest):
        if not inference_pipeline:
            raise HTTPException(status_code=503, detail="InferencePipeline not loaded (train models or fix GIGSHIELD_MODEL_DIR).")
        try:
            df_input = pd.DataFrame([req.worker.model_dump()])
            raw = inference_pipeline.predict_for_worker(df_input)
            return {"worker_id": req.worker.worker_id, "predictions": json_safe(raw)}
        except Exception as e:
            logger.exception("inference_predict")
            raise HTTPException(status_code=500, detail=str(e)) from e

    @application.post("/api/rag/retrieve", tags=["RAG"])
    def rag_retrieve(req: RAGRetrieveRequest):
        try:
            from src.rag.rag_system import RAGRetriever, VectorStore

            vs = vector_store or VectorStore()
            rag = RAGRetriever(vs)
            ctx = rag.retrieve_context(query=req.query, categories=req.categories)
            results = ctx.get("results") or []
            if req.top_k is not None:
                k = max(1, int(req.top_k))
                results = results[:k]
                ctx["context_text"] = rag._format_context(results)
                ctx["num_results"] = len(results)
            return {
                "query": ctx.get("query"),
                "num_results": ctx.get("num_results"),
                "context_text": ctx.get("context_text"),
                "results": json_safe(results),
            }
        except Exception as e:
            logger.exception("rag_retrieve")
            raise HTTPException(status_code=500, detail=str(e)) from e

    # ───────────────────────────────────────────────────────────────────
    # MCP Real-Time Tracking Endpoints
    # ───────────────────────────────────────────────────────────────────

    @application.post("/api/shift/start", tags=["MCP Real-Time"], response_model=ShiftStartResponse)
    async def shift_start(req: ShiftStartRequest):
        """
        Event-driven trigger: when a gig worker starts a shift.

        1. Pulls live weather, news, and optional web-crawl data via MCP
        2. Runs hazard analysis with a rules engine
        3. Returns hazard alerts + coverage adjustment recommendation
        4. Generates a worker notification message
        """
        from datetime import datetime, timezone
        from src.integrations.mock_mcp_client import default_mcp_client

        try:
            mcp_client = default_mcp_client()
            if mcp_client is None:
                raise HTTPException(
                    status_code=503,
                    detail="No MCP client available. Set MCP_SERVER_URL or enable mock.",
                )

            context = {
                "worker_id": req.worker_id,
                "crawl_queries": req.crawl_queries or [],
            }
            if req.worker:
                context["worker_row"] = req.worker

            # Fetch all real-time signals + MCP risk analysis in parallel
            from backend.services.mcp_client import get_dynamic_risk_profile

            bundle_task = mcp_client.get_monitoring_signals(req.city, context=context)
            work_type = getattr(req, "work_type", None) or "delivery"
            risk_task = get_dynamic_risk_profile(city=req.city, work_type=work_type)

            bundle, mcp_risk_profile = await asyncio.gather(
                bundle_task, risk_task, return_exceptions=False
            )

            weather_raw = bundle.get("weather", {})
            regional = bundle.get("regional", {})
            news_data = bundle.get("news_data") or {}
            crawl_data = bundle.get("crawl_data") or []

            # Build weather summary
            weather_summary = WeatherSummary(
                city=req.city,
                temperature_c=float(weather_raw.get("temperature", 28.0)),
                feels_like_c=float(weather_raw.get("feels_like", weather_raw.get("temperature", 28.0))),
                humidity_percent=int(weather_raw.get("humidity", 70)),
                wind_speed_kmph=float(weather_raw.get("wind_speed_kmph", 0)),
                rainfall_mm=float(weather_raw.get("rainfall_cm", 0)) * 10.0,
                condition=str(weather_raw.get("condition", "Unknown")),
                hazard_level=str(weather_raw.get("hazard_level", "LOW")),
            )

            # Build news summary
            news_articles = news_data.get("articles", []) if isinstance(news_data, dict) else []
            news_summary = NewsSummary(
                total_articles=len(news_articles),
                disruption_flags=news_data.get("disruption_flags", []) if isinstance(news_data, dict) else [],
                overall_threat_level=news_data.get("overall_threat_level", "LOW") if isinstance(news_data, dict) else "LOW",
                top_headlines=[a.get("title", "") for a in news_articles[:3]],
            )

            # Build crawl summary
            crawl_summary = None
            if crawl_data:
                total_hazards = sum(len(c.get("hazards_found", [])) for c in crawl_data if isinstance(c, dict))
                all_keywords = []
                for c in crawl_data:
                    if isinstance(c, dict):
                        for h in c.get("hazards_found", []):
                            all_keywords.append(h.get("keyword", ""))
                max_crawl_level = "LOW"
                for c in crawl_data:
                    if isinstance(c, dict):
                        cl = c.get("hazard_level", "LOW")
                        if _hazard_rank(cl) > _hazard_rank(max_crawl_level):
                            max_crawl_level = cl
                crawl_summary = CrawlSummary(
                    urls_crawled=len(crawl_data),
                    total_hazards_found=total_hazards,
                    hazard_keywords=list(dict.fromkeys(all_keywords)),
                    hazard_level=max_crawl_level,
                )

            # ── Hazard Analysis Rules Engine ──
            alerts: List[HazardAlert] = []

            # Weather-based alerts
            for wa in weather_raw.get("alerts", []):
                if isinstance(wa, dict):
                    alerts.append(HazardAlert(
                        type=wa.get("type", "weather_alert"),
                        severity=wa.get("severity", "medium"),
                        source="OpenWeatherMap",
                        description=wa.get("detail", wa.get("summary", str(wa.get("type", "")))),
                        category="weather",
                    ))

            # Rain thresholds
            rainfall_mm = weather_summary.rainfall_mm
            if rainfall_mm >= 150:
                alerts.append(HazardAlert(
                    type="Extreme_Rain", severity="critical",
                    source="OpenWeatherMap",
                    description=f"Extreme rainfall: {rainfall_mm:.0f}mm. Flooding likely.",
                    category="weather",
                ))
            elif rainfall_mm >= 100:
                alerts.append(HazardAlert(
                    type="Heavy_Rain", severity="high",
                    source="OpenWeatherMap",
                    description=f"Heavy rainfall: {rainfall_mm:.0f}mm. Significant disruption expected.",
                    category="weather",
                ))

            # News-based alerts
            for flag in news_summary.disruption_flags:
                sev = "medium"
                if flag in ("flood", "cyclone", "storm"):
                    sev = "high"
                elif flag in ("strike", "protest", "curfew", "bandh"):
                    sev = "medium"
                alerts.append(HazardAlert(
                    type=f"News_{flag.title()}",
                    severity=sev,
                    source="NewsAPI",
                    description=f"News reports indicate {flag} activity in {req.city}.",
                    category="civil_unrest" if flag in ("strike", "protest", "curfew", "bandh") else "weather",
                ))

            # Crawl-based alerts
            if crawl_summary and crawl_summary.total_hazards_found > 0:
                for kw in crawl_summary.hazard_keywords[:5]:
                    alerts.append(HazardAlert(
                        type=f"Emerging_{kw.replace(' ', '_').title()}",
                        severity="medium",
                        source="WebCrawler",
                        description=f"Emerging condition detected via web crawl: {kw}",
                        category="infrastructure",
                    ))

            # ── Coverage Adjustment Logic (MCP-enhanced) ──
            overall_level = _compute_overall_hazard(weather_summary, news_summary, crawl_summary, alerts)

            # Prefer MCP's computed multiplier over heuristic when available
            mcp_multiplier = float(mcp_risk_profile.get("combined_multiplier", 0.0)) if not mcp_risk_profile.get("fallback_used") else 0.0

            adjustment_pct = 0.0
            recommended_action = "proceed"
            reason_parts: List[str] = []

            if overall_level == "CRITICAL":
                adjustment_pct = 40.0
                recommended_action = "emergency_protocol"
                reason_parts.append("Critical conditions detected")
            elif overall_level == "HIGH":
                adjustment_pct = 20.0
                recommended_action = "caution"
                reason_parts.append("High-risk conditions detected")
            elif overall_level == "MEDIUM":
                adjustment_pct = 10.0
                recommended_action = "caution"
                reason_parts.append("Moderate risk conditions detected")

            if rainfall_mm >= 100:
                reason_parts.append(f"Heavy rainfall ({rainfall_mm:.0f}mm)")
            if news_summary.overall_threat_level in ("HIGH", "CRITICAL"):
                reason_parts.append(f"Active news disruptions: {', '.join(news_summary.disruption_flags[:3])}")

            # Use MCP multiplier when it's more conservative (higher) than heuristic
            heuristic_multiplier = 1.0 + (adjustment_pct / 100.0)
            final_multiplier = max(heuristic_multiplier, mcp_multiplier) if mcp_multiplier > 1.0 else heuristic_multiplier

            if mcp_multiplier > heuristic_multiplier and not mcp_risk_profile.get("fallback_used"):
                reason_parts.append(
                    f"MCP risk analysis: {mcp_risk_profile.get('market_intel', {}).get('formula', f'multiplier={final_multiplier:.2f}')}"
                )

            coverage_adj = CoverageAdjustment(
                base_premium_multiplier=round(final_multiplier, 3),
                adjustment_percent=round((final_multiplier - 1.0) * 100, 1),
                reason="; ".join(reason_parts) if reason_parts else "Normal conditions",
                recommended_action=recommended_action,
            )

            # ── Notification Message ──
            notification = _build_notification(req.city, overall_level, alerts, coverage_adj)

            return ShiftStartResponse(
                worker_id=req.worker_id,
                city=req.city,
                timestamp=datetime.now(timezone.utc).isoformat(),
                overall_hazard_level=overall_level,
                weather=weather_summary,
                news=news_summary,
                crawl=crawl_summary,
                alerts=alerts,
                coverage_adjustment=coverage_adj,
                notification_message=notification,
                mcp_risk_profile=mcp_risk_profile if not mcp_risk_profile.get("fallback") else None,
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.exception("shift_start")
            raise HTTPException(status_code=500, detail=str(e)) from e

    @application.post("/api/hazard/check", tags=["MCP Real-Time"])
    async def hazard_check(req: HazardCheckRequest):
        """
        Quick hazard check for a city — no worker context needed.
        Returns weather + news threat levels.
        """
        from src.integrations.mock_mcp_client import default_mcp_client

        try:
            mcp_client = default_mcp_client()
            if mcp_client is None:
                raise HTTPException(status_code=503, detail="No MCP client available.")

            context = {"crawl_queries": req.crawl_queries or []}
            bundle = await mcp_client.get_monitoring_signals(req.city, context=context)

            weather = bundle.get("weather", {})
            regional = bundle.get("regional", {})
            news_data = bundle.get("news_data")

            return {
                "city": req.city,
                "weather": weather,
                "regional": regional,
                "news_threat_level": (news_data or {}).get("overall_threat_level", "UNKNOWN"),
                "news_flags": regional.get("news_flags", []),
                "overall_stress": regional.get("inventory_stress_index", 0),
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("hazard_check")
            raise HTTPException(status_code=500, detail=str(e)) from e

    # ───────────────────────────────────────────────────────────────────
    # Dynamic Risk Profile (MCP Host pattern)
    # ───────────────────────────────────────────────────────────────────

    @application.post(
        "/api/risk/dynamic",
        tags=["MCP Real-Time"],
        response_model=DynamicRiskResponse,
        summary="Live composite risk profile via MCP Layer",
        description=(
            "Calls the MCP Layer server in parallel (get_weather + analyze_localized_risk) "
            "and returns a combined risk multiplier: P_final = P_base \u00d7 R_weather \u00d7 R_market.\n\n"
            "Requires the MCP Layer server to be running (MCP_SERVER_URL env var). "
            "Falls back to neutral-risk multiplier (1.1) if the server is unreachable."
        ),
    )
    async def dynamic_risk_profile(req: DynamicRiskRequest):
        """
        MCP Host entrypoint — as specified in the architecture proposal.

        Fires get_weather and analyze_localized_risk in parallel via the MCP Layer,
        returns a unified risk multiplier for Flash Insurance premium adjustment.
        """
        try:
            from backend.services.mcp_client import get_dynamic_risk_profile

            profile = await get_dynamic_risk_profile(
                city=req.city,
                work_type=req.work_type,
            )

            weather_data = profile.get("weather_data", {})
            market_intel = profile.get("market_intel", {})
            fallback = bool(weather_data.get("fallback") or market_intel.get("fallback"))

            return DynamicRiskResponse(
                city=req.city,
                work_type=req.work_type,
                worker_id=req.worker_id,
                overall_risk_level=profile.get("overall_risk_level", "MEDIUM"),
                r_weather=float(profile.get("r_weather", 1.0)),
                r_market=float(profile.get("r_market", 1.0)),
                combined_multiplier=float(profile.get("combined_multiplier", 1.1)),
                formula=market_intel.get(
                    "formula",
                    f"P_final = P_base x {profile.get('r_weather', 1.0)} x {profile.get('r_market', 1.0)}",
                ),
                weather_condition=weather_data.get("condition", "unknown"),
                weather_hazard_level=weather_data.get("hazard_level", "LOW"),
                crawl_hazard_level=market_intel.get("crawl_hazard_level", "LOW"),
                tavily_answer=market_intel.get("tavily_answer", ""),
                hazard_context=market_intel.get("hazard_context", ""),
                timestamp=profile.get("timestamp", ""),
                mcp_server_url=profile.get("mcp_server_url", ""),
                fallback_used=fallback,
            )
        except Exception as e:
            logger.exception("dynamic_risk_profile")
            raise HTTPException(status_code=500, detail=str(e)) from e

    return application


# ───────────────────────────────────────────────────────────────────────────
# Helper functions for hazard assessment
# ───────────────────────────────────────────────────────────────────────────

_HAZARD_RANKS = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def _hazard_rank(level: str) -> int:
    return _HAZARD_RANKS.get(level.upper(), 0)


def _compute_overall_hazard(
    weather: "WeatherSummary",
    news: "NewsSummary",
    crawl: "CrawlSummary | None",
    alerts: "List[HazardAlert]",
) -> str:
    levels = [weather.hazard_level, news.overall_threat_level]
    if crawl:
        levels.append(crawl.hazard_level)

    critical_alerts = sum(1 for a in alerts if a.severity == "critical")
    high_alerts = sum(1 for a in alerts if a.severity == "high")

    max_rank = max(_hazard_rank(l) for l in levels)

    if critical_alerts >= 1 or max_rank >= 3:
        return "CRITICAL"
    if high_alerts >= 2 or max_rank >= 2:
        return "HIGH"
    if high_alerts >= 1 or max_rank >= 1:
        return "MEDIUM"
    return "LOW"


def _build_notification(
    city: str,
    hazard_level: str,
    alerts: "List[HazardAlert]",
    coverage: "CoverageAdjustment",
) -> str:
    if hazard_level == "LOW":
        return f"✅ {city}: Conditions are normal. Your shift coverage is active at standard rates. Stay safe!"

    emoji = {"MEDIUM": "⚠️", "HIGH": "🔶", "CRITICAL": "🚨"}.get(hazard_level, "ℹ️")
    alert_types = list(dict.fromkeys(a.type for a in alerts[:3]))
    alert_str = ", ".join(alert_types) if alert_types else "elevated conditions"

    msg = f"{emoji} {city} — {hazard_level} HAZARD ALERT\n"
    msg += f"Detected: {alert_str}\n"
    if coverage.adjustment_percent > 0:
        msg += f"Your coverage has been automatically increased by {coverage.adjustment_percent:.0f}%.\n"
    msg += f"Recommendation: {coverage.recommended_action.replace('_', ' ').title()}.\n"
    msg += "Stay safe and follow local advisories."
    return msg


app = create_app()
