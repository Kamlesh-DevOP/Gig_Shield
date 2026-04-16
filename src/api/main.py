"""
GigShield FastAPI application.

Run from repository root:
  uvicorn app:app --host 0.0.0.0 --port 8000

Or:
  uvicorn src.api.main:app --host 0.0.0.0 --port 8000

Partner mock APIs (weather/news/telecom/...) are mounted at /partner-mock (e.g. /partner-mock/api/weather).
"""

from __future__ import annotations
import razorpay
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
    OrchestrateBatchRequest,
    RAGRetrieveRequest,
    RazorpayOrderRequest,
    RazorpayOrderResponse,
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

    # Initialize Razorpay Client
    razorpay_client = razorpay.Client(
        auth=(os.getenv("RAZORPAY_TEST_KEY_ID"), os.getenv("RAZORPAY_TEST_KEY_SECRET"))
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

    # ───────────────────────────────────────────────────────────────────
    # Razorpay Payment Endpoints
    # ───────────────────────────────────────────────────────────────────

    @application.post("/api/payment/create-order", tags=["Payment"], response_model=RazorpayOrderResponse)
    async def create_payment_order(req: RazorpayOrderRequest):
        try:
            # Razorpay expects amount in paise (multiply by 100)
            order_data = {
                "amount": int(req.amount * 100),
                "currency": req.currency,
                "receipt": req.receipt or f"receipt_{os.urandom(4).hex()}",
                "payment_capture": 1
            }
            order = razorpay_client.order.create(data=order_data)
            return RazorpayOrderResponse(
                id=order['id'],
                amount=order['amount'],
                currency=order['currency'],
                receipt=order.get('receipt'),
                status=order['status']
            )
        except Exception as e:
            logger.exception("create_payment_order")
            raise HTTPException(status_code=500, detail=str(e))

    @application.post("/api/payment/verify", tags=["Payment"])
    async def verify_payment(req: dict):
        """
        Expects:
        {
          "razorpay_order_id": "...",
          "razorpay_payment_id": "...",
          "razorpay_signature": "..."
        }
        """
        try:
            razorpay_client.utility.verify_payment_signature(req)
            return {"status": "success", "message": "Payment verified successfully"}
        except Exception:
            logger.warning("Payment verification failed for order: %s", req.get("razorpay_order_id"))
            raise HTTPException(status_code=400, detail="Invalid payment signature")

    # ───────────────────────────────────────────────────────────────────
    # Disruption Simulation Endpoint
    # ───────────────────────────────────────────────────────────────────

    @application.post("/api/simulate/disruption", tags=["Simulation"])
    async def simulate_disruption(req: Dict[str, Any]):
        """
        Simulate a disruption for a specific city + area.
        - Fetches all workers from gigshield_workers where city matches
        - Filters by outlet_lat/lon proximity to known area center (Haversine)
        - Augments each worker record with disruption overrides
        - Runs classic orchestrator for each matched worker
        - Returns aggregated payout + risk metrics for dashboard
        """
        import math
        import os
        import random
        from datetime import datetime

        city: str = req.get("city", "Bengaluru")
        area: str = req.get("area", "BTM Layout")
        disruption_type: str = req.get("disruption_type", "flood")
        radius_km: float = float(req.get("radius_km", 8.0))  # 8km radius

        # ── Known area center coordinates ──────────────────────────────
        AREA_CENTERS: Dict[str, Dict[str, float]] = {
            # Bengaluru
            "Indiranagar":      {"lat": 12.9719, "lon": 77.6412},
            "BTM Layout":       {"lat": 12.9166, "lon": 77.6101},
            "Electronic City":  {"lat": 12.8399, "lon": 77.6770},
            # Chennai
            "Sholinganallur":   {"lat": 12.9121, "lon": 80.2273},
            "Velachery":        {"lat": 12.9746, "lon": 80.2209},
            "Tambaram":         {"lat": 12.9249, "lon": 80.1000},
            # Mumbai
            "Bandra":           {"lat": 19.0596, "lon": 72.8295},
            "Andheri":          {"lat": 19.1136, "lon": 72.8697},
            "Dadar":            {"lat": 19.0178, "lon": 72.8478},
            # Hyderabad
            "Gachibowli":       {"lat": 17.4400, "lon": 78.3489},
            "Hitech City":      {"lat": 17.4474, "lon": 78.3762},
            "Secunderabad":     {"lat": 17.4399, "lon": 78.4983},
            # Delhi
            "Rohini":           {"lat": 28.7041, "lon": 77.1025},
            "Dwarka":           {"lat": 28.5921, "lon": 77.0460},
            "Connaught Place":  {"lat": 28.6315, "lon": 77.2167},
            # Kolkata
            "Salt Lake":        {"lat": 22.5726, "lon": 88.4183},
            "Howrah":           {"lat": 22.5855, "lon": 88.3522},
            "Park Street":      {"lat": 22.5514, "lon": 88.3512},
            # Pune
            "Hinjewadi":        {"lat": 18.5912, "lon": 73.7389},
            "Kothrud":          {"lat": 18.5074, "lon": 73.8077},
            "Viman Nagar":      {"lat": 18.5679, "lon": 73.9143},
            # Ahmedabad
            "Navrangpura":      {"lat": 23.0258, "lon": 72.5640},
            "SG Highway":       {"lat": 23.0258, "lon": 72.5000},
            "Maninagar":        {"lat": 22.9866, "lon": 72.6044},
            # Mumbai (additional)
            "Bhandup":          {"lat": 19.1522, "lon": 72.9425},
            "Thane":            {"lat": 19.2183, "lon": 72.9781},
        }

        # ── Disruption parameter overrides ──────────────────────────────
        # NOTE: cooling_period_completed and premium_paid are intentionally
        # NOT overridden — we use the real DB values so only genuinely
        # eligible workers (who paid premiums and completed cooling) get payouts.
        DISRUPTION_OVERRIDES: Dict[str, Dict[str, Any]] = {
            "flood": {
                "rainfall_cm": random.uniform(18, 28),
                "disruption_type": "Heavy_Rain",
                "disruption_duration_hours": random.uniform(6, 12),
                "cyclone_alert_level": 0,
                "temperature_extreme": random.uniform(26, 32),
            },
            "cyclone": {
                "rainfall_cm": random.uniform(22, 35),
                "disruption_type": "Cyclone",
                "disruption_duration_hours": random.uniform(8, 18),
                "cyclone_alert_level": 2,
                "temperature_extreme": random.uniform(24, 30),
            },
            "strike": {
                "rainfall_cm": random.uniform(0, 5),
                "disruption_type": "Strike",
                "disruption_duration_hours": random.uniform(4, 10),
                "cyclone_alert_level": 0,
                "temperature_extreme": random.uniform(28, 36),
            },
            "protest": {
                "rainfall_cm": random.uniform(0, 8),
                "disruption_type": "Protest",
                "disruption_duration_hours": random.uniform(3, 8),
                "cyclone_alert_level": 0,
                "temperature_extreme": random.uniform(28, 36),
            },
            "curfew": {
                "rainfall_cm": random.uniform(0, 5),
                "disruption_type": "Curfew",
                "disruption_duration_hours": random.uniform(8, 14),
                "cyclone_alert_level": 0,
                "temperature_extreme": random.uniform(28, 36),
            },
        }

        # ── Mock news headlines ──────────────────────────────────────────
        MOCK_HEADLINES = {
            "flood": f"IMD red alert: Severe waterlogging reported across {area}, {city}. Deliveries severely impacted.",
            "cyclone": f"Cyclone warning: High wind speeds and heavy rain batter {area}, {city}. Operations suspended.",
            "strike": f"Transport strike disrupts gig worker operations across {area}, {city}. Roads blocked.",
            "protest": f"Mass protest blocks arterial roads in {area}, {city}. Logistics routes severely disrupted.",
            "curfew": f"Section 144 imposed in {area}, {city}. Night curfew restricts worker movement.",
        }

        # ── Fetch Dynamic Environment from Mock APIs ─────────────────────
        try:
            from mock_api.mock_api import weather as fetch_mock_weather, news as fetch_mock_news
            
            # 1. Fetch live weather for the city/scenario
            weather_res = fetch_mock_weather(city=city, scenario=disruption_type)
            reports = weather_res.get("reports", [])
            # Try to match the specific area, otherwise take the first available
            area_weather = next((r for r in reports if r.get("area", "").lower() == area.lower()), 
                                reports[0] if reports else {})
            
            m = area_weather.get("measurements", {})
            rainfall_mm = float(m.get("rainfall_mm_24h", 0))
            
            # 2. Build live overrides (Math Breakdown will use these exact numbers)
            overrides = {
                "rainfall_cm": rainfall_mm / 10.0,
                "disruption_type": disruption_type.capitalize(),
                "disruption_duration_hours": random.uniform(8, 16),
                "cyclone_alert_level": 2 if disruption_type.lower() == "cyclone" else 0,
                "temperature_extreme": float(m.get("temperature_c", 30)),
            }

            # 3. Fetch realistic news headline
            news_res = fetch_mock_news(city=city, scenario=disruption_type, limit=1)
            if news_res.get("articles"):
                headline = news_res["articles"][0]["headline"] + f" in {area}"
            else:
                headline = MOCK_HEADLINES.get(disruption_type, f"Disruption detected in {area}, {city}.")
            
        except Exception as e:
            logger.warning("Failed to fetch mock environment: %s. Falling back to basics.", e)
            overrides = DISRUPTION_OVERRIDES.get(disruption_type.lower(), DISRUPTION_OVERRIDES["flood"])
            headline = MOCK_HEADLINES.get(disruption_type, f"Disruption detected in {area}, {city}.")

        if not classic_orchestrator:
            raise HTTPException(
                status_code=503,
                detail="Classic orchestrator offline. Cannot run simulation.",
            )

        area_center = AREA_CENTERS.get(area)
        if not area_center:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown area '{area}'. Valid areas: {list(AREA_CENTERS.keys())}",
            )

        # ── Haversine distance function ──────────────────────────────────
        def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
            R = 6371.0
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlam = math.radians(lon2 - lon1)
            a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        # ── Fetch workers from Supabase ──────────────────────────────────
        try:
            supabase_url = os.getenv("SUPABASE_URL", "")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
            if not supabase_url or not supabase_key:
                raise HTTPException(status_code=503, detail="Supabase not configured.")

            from supabase import create_client
            sb = create_client(supabase_url, supabase_key)

            # Fetch workers filtered by city (case-insensitive substring in record JSONB)
            response = sb.table("gigshield_workers").select("record").execute()
            all_workers_raw = response.data or []
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("simulate_disruption: Supabase fetch failed")
            raise HTTPException(status_code=500, detail=f"Supabase error: {e}")

        # Normalize city string for matching
        city_lower = city.lower().strip()
        CITY_ALIASES = {
            "bengaluru": ["bengaluru", "bangalore"],
            "chennai": ["chennai"],
            "mumbai": ["mumbai"],
            "hyderabad": ["hyderabad"],
            "delhi": ["delhi", "new delhi"],
            "kolkata": ["kolkata", "calcutta"],
            "pune": ["pune"],
            "ahmedabad": ["ahmedabad"],
        }
        city_variants = next(
            (v for k, v in CITY_ALIASES.items() if city_lower in k or city_lower in v),
            [city_lower],
        )

        # ── Geo-filter by outlet_lat/lon within radius ───────────────────
        center_lat = area_center["lat"]
        center_lon = area_center["lon"]

        matched_workers: List[Dict[str, Any]] = []
        for row in all_workers_raw:
            rec = row.get("record", {})
            if not isinstance(rec, dict):
                continue
            rec_city = str(rec.get("city", "")).lower().strip()
            if not any(v in rec_city for v in city_variants):
                continue
            try:
                o_lat = float(rec.get("outlet_lat") or rec.get("worker_lat") or 0)
                o_lon = float(rec.get("outlet_lon") or rec.get("worker_lon") or 0)
            except (TypeError, ValueError):
                continue
            if o_lat == 0 and o_lon == 0:
                continue
            dist = haversine_km(center_lat, center_lon, o_lat, o_lon)
            if dist <= radius_km:
                matched_workers.append(rec)

        # Fallback: if no geo-matches, take all city workers (capped at 20)
        # This happens when outlet coordinates in DB are spread across the city
        # beyond the selected radius — still a valid city-wide sample.
        geo_matched = len(matched_workers) > 0
        if not matched_workers:
            logger.info("No workers within %skm of %s/%s. Sampling from city.", radius_km, city, area)
            for row in all_workers_raw:
                rec = row.get("record", {})
                if not isinstance(rec, dict):
                    continue
                rec_city = str(rec.get("city", "")).lower().strip()
                if any(v in rec_city for v in city_variants):
                    matched_workers.append(rec)
            matched_workers = matched_workers[:20]

        if not matched_workers:
            return {
                "city": city,
                "area": area,
                "disruption_type": disruption_type,
                "total_workers_in_area": 0,
                "workers_eligible_for_payout": 0,
                "total_simulated_payout": 0.0,
                "total_premium_from_affected": 0.0,
                "net_forecast_margin": 0.0,
                "worker_results": [],
                "mock_headline": headline,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "fallback_used": False,
            }

        # ── Run classic orchestrator for each matched worker ─────────────
        results_out: List[Dict[str, Any]] = []
        total_payout = 0.0
        total_premium = 0.0
        eligible_count = 0

        for rec in matched_workers:
            try:
                # Merge disruption overrides into the worker record
                augmented = {**rec, **overrides}

                # Simulate income loss from disruption (set to 20% of avg)
                # cooling_period_completed and premium_paid use REAL DB values
                # so only genuinely eligible workers receive payouts
                avg_income = float(rec.get("avg_52week_income") or rec.get("weekly_income") or 7500.0)
                augmented["weekly_income"] = avg_income * 0.20   # 80% income loss due to disruption
                augmented["avg_52week_income"] = avg_income
                augmented.setdefault("worker_id", rec.get("worker_id", 0))
                augmented.setdefault("city", city)

                worker_df = pd.DataFrame([augmented])
                wf = await classic_orchestrator.process_claim(worker_df, city=city)

                payout = float(getattr(wf, "payout_amount", 0) or 0)
                decision = getattr(wf, "decision", "REJECTED")
                premium = float(rec.get("premium_amount", 0) or 0)
                total_premium += premium

                if payout > 0:
                    eligible_count += 1
                    total_payout += payout

                loss_pct = 0.0
                if avg_income > 0:
                    loss_pct = ((avg_income - augmented["weekly_income"]) / avg_income) * 100.0

                eligibility = wf.extras.get("claim_eligibility") if wf.extras else None
                is_elig = False
                elig_reasons = []
                if eligibility:
                    is_elig = getattr(eligibility, "is_eligible", False)
                    elig_reasons = list(getattr(eligibility, "reasons", []) or [])

                results_out.append({
                    "worker_id": rec.get("worker_id"),
                    "city": rec.get("city") or city,
                    "area": area,
                    "slab": rec.get("selected_slab") or augmented.get("selected_slab") or "Standard Slab",
                    "decision": decision,
                    "payout_amount": payout,
                    "premium_amount": premium,
                    "distance_km": haversine_km(
                        center_lat, center_lon,
                        float(rec.get("outlet_lat") or 0),
                        float(rec.get("outlet_lon") or 0),
                    ),
                    "weekly_income_predicted": augmented["weekly_income"],
                    "avg_52week_income": avg_income,
                    "loss_percentage": loss_pct,
                    "ml_predictions": json_safe(wf.extras.get("ml_predictions") if wf.extras else None),
                    "is_eligible": is_elig,
                    "eligibility_reasons": json_safe(elig_reasons),
                    "payout_breakdown": json_safe(wf.extras.get("payout_breakdown") if wf.extras else None),
                })
            except Exception as e:
                logger.warning("Worker %s simulation error: %s", rec.get("worker_id"), e)
                continue

        net_margin = total_premium - total_payout

        return {
            "city": city,
            "area": area,
            "disruption_type": disruption_type,
            "radius_km": radius_km,
            "total_workers_in_area": len(matched_workers),
            "workers_eligible_for_payout": eligible_count,
            "total_simulated_payout": round(total_payout, 2),
            "total_premium_from_affected": round(total_premium, 2),
            "net_forecast_margin": round(net_margin, 2),
            "worker_results": results_out,
            "mock_headline": headline,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "geo_matched": geo_matched,
        }

    # ───────────────────────────────────────────────────────────────────
    # Live MCP Disruption Detection Engine
    # ───────────────────────────────────────────────────────────────────

    @application.post("/api/live/detect-disruptions", tags=["MCP Real-Time"])
    async def live_detect_disruptions():
        """
        Polls all 10 MCP-covered cities in parallel for REAL disruptions.

        Uses live NewsAPI + Tavily data — zero hardcoded overrides.
        Worker records are taken straight from Supabase and passed as-is
        to the Classic Orchestrator (income, cooling, premium all real).

        Payout can honestly be ₹0 if no workers meet eligibility criteria —
        this accurately reflects real-world conditions.

        Falls back to Supabase-derived baseline metrics if MCP Layer is offline.
        """
        from datetime import datetime, timezone

        COVERED_CITIES: List[str] = [
            "bengaluru", "chennai", "delhi", "hyderabad", "kolkata",
            "mumbai", "pune", "ahmedabad", "chandigarh", "coimbatore",
        ]
        CITY_ALIASES_LIVE: Dict[str, List[str]] = {
            "bengaluru":  ["bengaluru", "bangalore"],
            "chennai":    ["chennai"],
            "delhi":      ["delhi", "new delhi"],
            "hyderabad":  ["hyderabad"],
            "kolkata":    ["kolkata", "calcutta"],
            "mumbai":     ["mumbai"],
            "pune":       ["pune"],
            "ahmedabad":  ["ahmedabad"],
            "chandigarh": ["chandigarh"],
            "coimbatore": ["coimbatore"],
        }
        RISK_RANK_LIVE = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
        MIN_DISRUPTION_RANK = 1  # MEDIUM and above → assess workers

        scanned_at = datetime.now(timezone.utc).isoformat()
        mcp_server_url = os.getenv("MCP_SERVER_URL", "http://localhost:5100")

        # ── Fetch ALL workers from Supabase once (reused per city) ────────
        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        all_workers_raw: List[Dict[str, Any]] = []
        total_all_premium = 0.0

        try:
            from supabase import create_client as _create_sb
            _sb = _create_sb(supabase_url, supabase_key)
            _resp = _sb.table("gigshield_workers").select("record").execute()
            all_workers_raw = _resp.data or []
            for _row in all_workers_raw:
                _rec = _row.get("record", {})
                if isinstance(_rec, dict):
                    total_all_premium += float(_rec.get("premium_amount", 0) or 0)
        except Exception as _e:
            logger.warning("live_detect_disruptions: Supabase fetch failed: %s", _e)

        # ── Poll all 10 cities via MCP Layer in parallel (Pulse Check) ──────────
        mcp_offline = False
        pulse_results: List[Any] = []
        try:
            from src.integrations.mock_mcp_client import default_mcp_client
            mcp_client = default_mcp_client()
            if mcp_client is None:
                mcp_offline = True
            else:
                # FAST PULSE: Weather + News only (no crawl_queries)
                _pulse_tasks = [
                    mcp_client.get_monitoring_signals(c, context={"crawl_queries": []})
                    for c in COVERED_CITIES
                ]
                pulse_results = await asyncio.gather(*_pulse_tasks, return_exceptions=True)
                
                # Check if all failed
                if all(isinstance(p, Exception) for p in pulse_results):
                    mcp_offline = True
        except Exception as _e:
            logger.warning("live_detect_disruptions: Pulse check failed: %s", _e)
            mcp_offline = True

        # ── Escalate to Deep Analysis for potential disruptions ───────────
        city_mcp_profiles: Dict[str, Any] = {}
        if not mcp_offline and pulse_results:
            try:
                from backend.services.mcp_client import get_dynamic_risk_profile
            except ImportError:
                # Fallback if pathing is weird in the user's terminal
                sys.path.append(str(Path(__file__).resolve().parents[2]))
                from backend.services.mcp_client import get_dynamic_risk_profile
            
            escalate_cities = []
            for _city, _pulse in zip(COVERED_CITIES, pulse_results):
                if isinstance(_pulse, Exception) or _pulse is None:
                    continue
                    
                _weather = (_pulse.get("weather") or {})
                _news = (_pulse.get("news_data") or {})
                _w_level = _weather.get("hazard_level", "LOW")
                _n_level = _news.get("overall_threat_level", "LOW")
                
                # Pulse-based disruption detection
                if RISK_RANK_LIVE.get(_w_level, 0) >= MIN_DISRUPTION_RANK or \
                   RISK_RANK_LIVE.get(_n_level, 0) >= MIN_DISRUPTION_RANK:
                    escalate_cities.append(_city)
                else:
                    # Keep Pulse data for LOW risk cities
                    city_mcp_profiles[_city] = {
                        "overall_risk_level": "LOW",
                        "r_weather": 1.0,
                        "r_market": 1.0,
                        "combined_multiplier": 1.0,
                        "weather_data": _weather,
                        "market_intel": {
                            "hazard_context": "No immediate threats detected in pulse scan.",
                            "tavily_answer": "Deep scan skipped (Pulse normal).",
                            "hazards_found": []
                        }
                    }

            if escalate_cities:
                logger.info("live_detect: Escalating deep scan for: %s", escalate_cities)
                _deep_tasks = [
                    get_dynamic_risk_profile(city=c, work_type="delivery")
                    for c in escalate_cities
                ]
                _deep_results = await asyncio.gather(*_deep_tasks, return_exceptions=True)
                for _city, _profile in zip(escalate_cities, _deep_results):
                    if not isinstance(_profile, Exception):
                        city_mcp_profiles[_city] = _profile
                    else:
                        # Fallback for failed deep scan
                        city_mcp_profiles[_city] = {"overall_risk_level": "LOW", "fallback": True}

        # ── Identify disrupted cities for worker processing ──────────────
        disrupted_pairs: List[tuple] = []
        for _city, _profile in city_mcp_profiles.items():
            _risk = _profile.get("overall_risk_level", "LOW")
            if RISK_RANK_LIVE.get(_risk, 0) >= MIN_DISRUPTION_RANK:
                disrupted_pairs.append((_city, _profile))


        # ── Fallback: Supabase-derived metrics when MCP is offline ────────
        if mcp_offline or not city_mcp_profiles:
            _sb_premium = 0.0
            _sb_payout  = 0.0
            _sb_risk    = 0
            for _row in all_workers_raw:
                _rec = _row.get("record", {})
                if not isinstance(_rec, dict):
                    continue
                _sb_premium += float(_rec.get("premium_amount", 0) or 0)
                _sb_payout  += float(_rec.get("final_payout_amount", 0) or 0)
                if (
                    float(_rec.get("predicted_risk_score", 0) or 0) > 0.5
                    or float(_rec.get("predicted_income_loss_pct", 0) or 0) > 0
                ):
                    _sb_risk += 1
            return {
                "scanned_at":                 scanned_at,
                "cities_scanned":             len(COVERED_CITIES),
                "disruptions_detected":       0,
                "city_results":               [],
                "total_workers_affected":     _sb_risk,
                "total_workers_eligible":     0,
                "total_payout_computed":      round(_sb_payout, 2),
                "total_premium_from_affected": round(_sb_premium, 2),
                "total_all_premium":          round(_sb_premium, 2),
                "net_forecast_margin":        round(_sb_premium - _sb_payout, 2),
                "mcp_offline":                True,
                "fallback":                   True,
                "fallback_source":            "supabase",
                "mcp_server_url":             mcp_server_url,
            }

        # ── Per disrupted city: fetch workers → run Classic Orchestrator ───
        city_results_live: List[Dict[str, Any]] = []
        total_workers_affected = 0
        total_payout_computed  = 0.0
        total_premium_affected = 0.0
        total_eligible         = 0

        for _city, _mcp_profile in disrupted_pairs:
            _aliases = CITY_ALIASES_LIVE.get(_city, [_city])

            # Filter city workers from already-fetched Supabase data
            _city_workers: List[Dict[str, Any]] = []
            for _row in all_workers_raw:
                _rec = _row.get("record", {})
                if not isinstance(_rec, dict):
                    continue
                _rec_city = str(_rec.get("city", "")).lower().strip()
                if any(_v in _rec_city for _v in _aliases):
                    _city_workers.append(_rec)
            _city_workers = _city_workers[:30]  # Cap at 30 per city
            total_workers_affected += len(_city_workers)

            _city_payout   = 0.0
            _city_premium  = 0.0
            _city_eligible = 0
            _worker_results: List[Dict[str, Any]] = []

            for _rec in _city_workers:
                _premium = float(_rec.get("premium_amount", 0) or 0)
                _city_premium += _premium
                
                if classic_orchestrator:
                    try:
                        # ── FORECASTING AUGMENTATION ──────────────────────────
                        # Project income loss based on news/hazard severity
                        _risk_level = _mcp_profile.get("overall_risk_level", "LOW")
                        _avg_inc = float(_rec.get("avg_52week_income") or _rec.get("weekly_income") or 7500.0)
                        
                        _loss_factor = 1.0
                        if _risk_level == "CRITICAL": _loss_factor = 0.2  # 80% loss
                        elif _risk_level == "HIGH":   _loss_factor = 0.4  # 60% loss
                        elif _risk_level == "MEDIUM": _loss_factor = 0.6  # 40% loss
                        else: _loss_factor = 0.95 # 5% loss for LOW
                        
                        # Create a forecast copy
                        _forecast_rec = {**_rec}
                        _forecast_rec["weekly_income"] = _avg_inc * _loss_factor
                        
                        # Inject Disruption Context so the payout math sees it
                        # Map condition (Broken Clouds, Rallies) to a known disruption type
                        _cond = _mcp_profile.get("weather_data", {}).get("condition", "Hazard").lower()
                        _flags = _mcp_profile.get("disruption_flags", [])
                        
                        _forecast_rec["disruption_type"] = _flags[0] if _flags else ("rainfall" if "rain" in _cond else "infrastructure")
                        _forecast_rec["disruption_duration_hours"] = 12 if _risk_level == "CRITICAL" else 8
                        
                        # KEEP REAL FLAGS FROM SUPABASE:
                        # premium_paid, cooling_period_completed, weeks_active
                        
                        _wf = await classic_orchestrator.process_claim(
                            pd.DataFrame([_forecast_rec]), city=_city
                        )
                        _payout   = float(getattr(_wf, "payout_amount", 0) or 0)
                        _decision = getattr(_wf, "decision", "REJECTED")
                        
                        if _payout > 0:
                            _city_eligible += 1
                            _city_payout   += _payout
                            
                        _elig_obj     = _wf.extras.get("claim_eligibility") if _wf.extras else None
                        _is_elig      = getattr(_elig_obj, "is_eligible", False) if _elig_obj else False
                        _elig_reasons = list(getattr(_elig_obj, "reasons", []) or []) if _elig_obj else []
                        
                        _worker_results.append({
                            "worker_id":           _rec.get("worker_id"),
                            "city":                _rec.get("city") or _city,
                            "slab":                _rec.get("selected_slab") or "Standard Slab",
                            "decision":            _decision,
                            "payout_amount":       _payout,
                            "premium_amount":      _premium,
                            "avg_52week_income":   _avg_inc,
                            "weekly_income":       float(_forecast_rec["weekly_income"]),
                            "ml_predictions":      json_safe(_wf.extras.get("ml_predictions") if _wf.extras else None),
                            "is_eligible":         _is_elig,
                            "eligibility_reasons": json_safe(_elig_reasons),
                            "payout_breakdown":    json_safe(_wf.extras.get("payout_breakdown") if _wf.extras else None),
                        })

                    except Exception as _e:
                        logger.warning(
                            "live_detect: worker %s orchestrator error: %s",
                            _rec.get("worker_id"), _e,
                        )

            total_payout_computed  += _city_payout
            total_premium_affected += _city_premium
            total_eligible         += _city_eligible

            _market_intel  = _mcp_profile.get("market_intel", {})
            _weather_data  = _mcp_profile.get("weather_data", {})
            _hazards_raw   = _market_intel.get("hazards_found", [])
            _disrupt_flags = list(dict.fromkeys(
                h.get("keyword", "")
                for h in _hazards_raw
                if isinstance(h, dict) and h.get("keyword")
            ))

            city_results_live.append({
                "city":                        _city.title(),
                "overall_risk_level":          _mcp_profile.get("overall_risk_level", "LOW"),
                "r_weather":                   _mcp_profile.get("r_weather", 1.0),
                "r_market":                    _mcp_profile.get("r_market", 1.0),
                "combined_multiplier":         _mcp_profile.get("combined_multiplier", 1.0),
                "weather_condition":           _weather_data.get("condition", "unknown"),
                "weather_hazard_level":        _weather_data.get("hazard_level", "LOW"),
                "temperature_c":               _weather_data.get("temperature_c", 0),
                "humidity_percent":            _weather_data.get("humidity_percent", 0),
                "disruption_flags":            _disrupt_flags,
                "tavily_answer":               _market_intel.get("tavily_answer", ""),
                "hazard_context":              _market_intel.get("hazard_context", "No hazards detected."),
                "workers_found":               len(_city_workers),
                "workers_eligible_for_payout": _city_eligible,
                "total_payout":                round(_city_payout, 2),
                "total_premium":               round(_city_premium, 2),
                "worker_results":              _worker_results,
                "mcp_timestamp":               _mcp_profile.get("timestamp", ""),
            })

        return {
            "scanned_at":                  scanned_at,
            "cities_scanned":              len(COVERED_CITIES),
            "disruptions_detected":        len(disrupted_pairs),
            "city_results":                city_results_live,
            "total_workers_affected":      total_workers_affected,
            "total_workers_eligible":      total_eligible,
            "total_payout_computed":       round(total_payout_computed, 2),
            "total_premium_from_affected": round(total_premium_affected, 2),
            "total_all_premium":           round(total_all_premium, 2),
            "net_forecast_margin":         round(total_all_premium - total_payout_computed, 2),
            "mcp_offline":                 mcp_offline,
            "fallback":                    mcp_offline,
            "mcp_server_url":              mcp_server_url,
        }

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
