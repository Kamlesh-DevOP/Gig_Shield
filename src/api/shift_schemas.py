"""Pydantic models for the shift-start and hazard-check endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ShiftStartRequest(BaseModel):
    """Triggered when a gig worker starts a shift."""
    worker_id: int = Field(..., description="Unique identifier of the gig worker")
    city: str = Field(..., description="City where the shift is starting")
    work_type: str = Field(
        default="delivery",
        description="Gig sector: delivery, ride-share, courier, grocery, etc. Used for MCP risk analysis.",
    )
    crawl_queries: Optional[List[str]] = Field(
        default=None,
        description="Optional search queries for Tavily AI to find emerging hazards (e.g. 'Mumbai road closures today')",
    )
    # Optional full worker record for deeper analysis
    worker: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Full worker record dict for ML-backed risk assessment",
    )


class HazardAlert(BaseModel):
    """A single hazard alert detected from real-time data."""
    type: str = Field(..., description="Hazard type: Heavy_Rain, Extreme_Heat, Storm, Strike, etc.")
    severity: str = Field(..., description="Severity level: critical, high, medium, low")
    source: str = Field(..., description="Data source: OpenWeatherMap, NewsAPI, WebCrawler")
    description: str = Field(..., description="Human-readable description of the hazard")
    category: Optional[str] = Field(default=None, description="Hazard category: weather, civil_unrest, infrastructure, accident")


class CoverageAdjustment(BaseModel):
    """Recommended insurance coverage adjustment based on hazard analysis."""
    base_premium_multiplier: float = Field(1.0, description="Base premium multiplier (1.0 = no change)")
    adjustment_percent: float = Field(0.0, description="Percentage adjustment to coverage (+20 = 20% more coverage)")
    reason: str = Field("", description="Reason for adjustment")
    recommended_action: str = Field("proceed", description="proceed | caution | delay_shift | emergency_protocol")


class WeatherSummary(BaseModel):
    """Condensed weather data for the shift location."""
    city: str
    temperature_c: float = 28.0
    feels_like_c: float = 28.0
    humidity_percent: int = 70
    wind_speed_kmph: float = 0.0
    rainfall_mm: float = 0.0
    condition: str = "Clear"
    hazard_level: str = "LOW"


class NewsSummary(BaseModel):
    """Condensed news analysis for the shift location."""
    total_articles: int = 0
    disruption_flags: List[str] = Field(default_factory=list)
    overall_threat_level: str = "LOW"
    top_headlines: List[str] = Field(default_factory=list)


class CrawlSummary(BaseModel):
    """Condensed crawl findings."""
    urls_crawled: int = 0
    total_hazards_found: int = 0
    hazard_keywords: List[str] = Field(default_factory=list)
    hazard_level: str = "LOW"


class ShiftStartResponse(BaseModel):
    """Complete response for a shift-start hazard assessment."""
    worker_id: int
    city: str
    timestamp: str
    overall_hazard_level: str = Field(
        ...,
        description="Overall hazard level: CRITICAL, HIGH, MEDIUM, LOW",
    )
    weather: WeatherSummary
    news: NewsSummary
    crawl: Optional[CrawlSummary] = None
    alerts: List[HazardAlert] = Field(default_factory=list)
    coverage_adjustment: CoverageAdjustment
    notification_message: str = Field(
        "",
        description="Human-readable notification to send to the worker",
    )
    mcp_risk_profile: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Live MCP risk profile from analyze_localized_risk: overall_risk_level, "
            "combined_multiplier (P_final = P_base x R_weather x R_market), formula, hazard_context."
        ),
    )
    raw_data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Full raw data bundle (only if include_raw=True)",
    )


class HazardCheckRequest(BaseModel):
    """Quick hazard check for a city (no worker context needed)."""
    city: str = Field(..., description="City to check")
    crawl_queries: Optional[List[str]] = Field(default=None, description="Optional Tavily search queries for emerging hazards")


# ── Dynamic Risk Profile ─────────────────────────────────────────────────────

class DynamicRiskRequest(BaseModel):
    """
    Request a live composite risk profile for a gig worker's shift.

    Internally calls the MCP Layer tools in parallel:
      - get_weather        → R_weather
      - analyze_localized_risk → R_market
      - P_final = P_base × R_weather × R_market
    """
    city: str = Field(..., description="Shift city (e.g. 'Chennai', 'Mumbai')")
    work_type: str = Field(
        ...,
        description="Gig sector: 'delivery', 'ride-share', 'courier', 'grocery', etc.",
    )
    worker_id: Optional[int] = Field(default=None, description="Optional worker ID for tracing")


class DynamicRiskResponse(BaseModel):
    """Composite real-time risk profile returned by the MCP Host."""
    city: str
    work_type: str
    worker_id: Optional[int] = None
    overall_risk_level: str = Field(..., description="LOW | MEDIUM | HIGH | CRITICAL")
    r_weather: float = Field(..., description="Weather risk multiplier (1.0 = no risk)")
    r_market: float = Field(..., description="Market/civil risk multiplier from Tavily crawl")
    combined_multiplier: float = Field(..., description="Final premium multiplier = R_weather × R_market")
    formula: str = Field(default="", description="Human-readable formula string")
    weather_condition: str = Field(default="unknown")
    weather_hazard_level: str = Field(default="LOW")
    crawl_hazard_level: str = Field(default="LOW")
    tavily_answer: str = Field(default="", description="Tavily AI answer summary for the crawl query")
    hazard_context: str = Field(default="", description="Bullet-point hazard snippets from Tavily")
    timestamp: str = Field(default="")
    mcp_server_url: str = Field(default="")
    fallback_used: bool = Field(
        default=False,
        description="True if MCP server was unreachable and neutral-risk fallback was applied",
    )
