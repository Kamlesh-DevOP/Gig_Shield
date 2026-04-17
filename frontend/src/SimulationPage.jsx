import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, CloudRain, Zap, ShieldCheck, Activity,
  AlertTriangle, CheckCircle, TrendingDown, Radio,
  MapPin, BarChart2, CircleDollarSign, Target,
  Droplets, Wind, Thermometer, Gauge, Satellite,
  Brain, Scan, BadgeCheck, XCircle, ChevronRight,
  Banknote, Clock, Percent, FileText, Map, RefreshCw
} from "lucide-react";
import DisruptionTypeTabs from "./DisruptionTypeTabs";
import CoverageMapTab from "./CoverageMap";

const API = "http://localhost:8000";
const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const isApproved = (d) => ["APPROVE", "auto_approve", "approved"].includes(String(d || "").toLowerCase().includes("approv") ? d : "") || String(d || "").toLowerCase().includes("approv");
const normalizeDecision = (d) => isApproved(d) ? "APPROVE" : String(d || "REJECT").toUpperCase();

// ── Simulation Step Pipeline ─────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { key: "idle", label: "Ready", icon: Zap, color: "var(--pipe-ready, #7B6899)" },
  { key: "weather", label: "Environmental", icon: CloudRain, color: "var(--pipe-env, #2563EB)" },
  { key: "market", label: "Market Intel", icon: Radio, color: "var(--pipe-market, #6366F1)" },
  { key: "analyzing", label: "ML Inference", icon: Brain, color: "var(--pipe-ml, #7C3AED)" },
  { key: "eligibility", label: "Eligibility Check", icon: Scan, color: "var(--pipe-elig, #D97706)" },
  { key: "decision", label: "Decision", icon: ShieldCheck, color: "var(--pipe-dec, #059669)" },
  { key: "payout", label: "Payout", icon: Banknote, color: "var(--pipe-pay, #10B981)" },
];

export default function SimulationPage({ partnerId, partnerData, onBack }) {
  const [activeTab, setActiveTab] = useState("simulation");
  const [city, setCity] = useState(partnerData?.city || "Chennai");
  const [scenario, setScenario] = useState("flood");
  const [step, setStep] = useState("idle");        // pipeline step
  const [weather, setWeather] = useState(null);
  const [marketIntel, setMarketIntel] = useState(null);
  const [mlPreds, setMlPreds] = useState(null);
  const [claimResult, setClaimResult] = useState(null);
  const [payoutResult, setPayoutResult] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);

  const addLog = (msg, type = "info") => {
    setLogs(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString() }]);
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const cities = ["Chennai", "Mumbai", "Bengaluru", "Hyderabad", "Kolkata", "Delhi", "Pune", "Ahmedabad"];
  const scenarios = [
    { key: "flood", label: "🌧️ Heavy Rainfall / Flood", desc: "150-250mm rain in 24h" },
    { key: "cyclone", label: "🌀 Cyclone Alert", desc: "200-300mm + high winds" },
    { key: "normal", label: "☀️ Normal Conditions", desc: "0-120mm random rain" },
  ];

  // Build the worker record for sending to backend
  // KEY: For the claim to be eligible, weekly_income must be BELOW 75% of avg_52week_income
  // During a disruption simulation, we model the income drop caused by the event
  const buildWorkerPayload = () => {
    const db = partnerData?.dbRecord || {};
    const avgIncome = db.avg_52week_income || 7500;

    // Simulate disrupted income based on scenario:
    // - Flood:   income drops to ~40-55% of average (heavy rain prevents deliveries)
    // - Cyclone: income drops to ~25-40% of average (severe disruption)
    // - Normal:  use actual income (no disruption)
    let simulatedWeeklyIncome;
    if (scenario === "flood") {
      simulatedWeeklyIncome = Math.round(avgIncome * 0.45); // 45% of average
    } else if (scenario === "cyclone") {
      simulatedWeeklyIncome = Math.round(avgIncome * 0.30); // 30% of average
    } else {
      simulatedWeeklyIncome = db.weekly_income || avgIncome * 0.95; // normal — near average
    }

    return {
      worker_id: db.worker_id || parseInt(partnerId.replace(/\D/g, "")) || 1,
      city: city,
      avg_52week_income: avgIncome,
      disruption_type: scenario === "flood" ? "Heavy_Rain" : scenario === "cyclone" ? "Cyclone" : "Normal",
      selected_slab: db.selected_slab || "Slab_100",
      income_loss_percentage: scenario === "flood" ? 55 : scenario === "cyclone" ? 70 : 5,
      employment_type: db.employment_type || "Full-Time",
      platform: db.platform || "Zepto",
      premium_paid: 1,   // Simulation assumes premium is paid
      cooling_period_completed: 1, // Simulation assumes cooling period done
      weeks_active: db.weeks_active || 26,
      week_of_year: db.week_of_year || 20,
      weekly_income: simulatedWeeklyIncome,
      income_std_dev: db.income_std_dev || 200,
      income_volatility: db.income_volatility || 0.1,
      orders_completed_week: scenario === "normal" ? (db.orders_completed_week || 50) : Math.round((db.orders_completed_week || 50) * 0.4),
      active_hours_week: scenario === "normal" ? (db.active_hours_week || 40) : Math.round((db.active_hours_week || 40) * 0.5),
      disruption_duration_hours: scenario === "flood" ? 12 : scenario === "cyclone" ? 24 : 0,
      rainfall_cm: scenario === "flood" ? 18 : scenario === "cyclone" ? 25 : 3,
      temperature_extreme: db.temperature_extreme || 28,
      cyclone_alert_level: scenario === "cyclone" ? 3 : 0,
      payment_consistency_score: db.payment_consistency_score || 0.9,
      fraud_trust_rating: db.fraud_trust_rating || 0.85,
      overall_risk_score: db.overall_risk_score || 0.2,
      disruption_exposure_risk: scenario === "normal" ? 0.1 : 0.7,
      distance_from_outlet_km: db.distance_from_outlet_km || 5,
      order_acceptance_rate: db.order_acceptance_rate || 0.9,
      order_decline_rate: db.order_decline_rate || 0.1,
      gps_spoofing_score: db.gps_spoofing_score || 0,
      movement_realism_score: db.movement_realism_score || 1,
      presence_score: db.presence_score || 1,
      peer_group_activity_ratio: db.peer_group_activity_ratio || 1,
      consecutive_payment_weeks: db.consecutive_payment_weeks || 10,
      coordinated_fraud_cluster_id: db.coordinated_fraud_cluster_id || 0,
      ip_gps_mismatch: db.ip_gps_mismatch || 0,
      device_sharing_flag: db.device_sharing_flag || 0,
    };
  };

  // ── Run the full simulation pipeline ──────────────────────────────────────
  const runSimulation = async () => {
    setError(null);
    setWeather(null);
    setMarketIntel(null);
    setMlPreds(null);
    setClaimResult(null);
    setPayoutResult(null);
    setLogs([]);

    const workerPayload = buildWorkerPayload();

    // Log simulation parameters
    const threshold = Math.round(workerPayload.avg_52week_income * 0.75);
    addLog(`🔧 Simulation: ${scenario.toUpperCase()} scenario for Worker #${workerPayload.worker_id} in ${city}`, "info");
    addLog(`   📊 Avg Income: ${fmt(workerPayload.avg_52week_income)} | Disrupted Income: ${fmt(workerPayload.weekly_income)} | Threshold: ${fmt(threshold)}`, "data");
    addLog(`   ${workerPayload.weekly_income < threshold ? "⚠️  Income BELOW threshold → claim will trigger!" : "✅ Income above threshold → no claim"}`, workerPayload.weekly_income < threshold ? "warning" : "info");
    addLog(`   🌧️ Rainfall: ${workerPayload.rainfall_cm}cm | Disruption: ${workerPayload.disruption_type} | Slab: ${workerPayload.selected_slab}`, "data");

    // ── STEP 1: Fetch weather data ──
    try {
      setStep("weather");
      addLog(`📡 Fetching weather data for ${city} (scenario: ${scenario})...`, "info");
      await sleep(600);

      const weatherRes = await fetch(`${API}/partner-mock/api/weather?city=${city}&scenario=${scenario}`);
      if (!weatherRes.ok) throw new Error(`Weather API returned ${weatherRes.status}`);
      const weatherData = await weatherRes.json();
      setWeather(weatherData);

      const maxRain = Math.max(...weatherData.reports.map(r => r.measurements.rainfall_mm_24h));
      const maxWind = Math.max(...weatherData.reports.map(r => r.measurements.wind_speed_kmph));
      const alertLevel = weatherData.reports[0]?.alerts?.level || "NONE";

      addLog(`✅ Weather received: ${weatherData.reports.length} station reports`, "success");
      addLog(`   📊 Max rainfall: ${maxRain}mm | Wind: ${maxWind} km/h | Alert: ${alertLevel}`, "data");

      if (maxRain >= 100) {
        addLog(`⚠️  RAINFALL TRIGGER: ${maxRain}mm exceeds 100mm threshold!`, "warning");
      } else {
        addLog(`ℹ️  Rainfall ${maxRain}mm — below trigger threshold (100mm)`, "info");
      }

      await sleep(800);
    } catch (e) {
      addLog(`❌ Weather fetch failed: ${e.message}`, "error");
      setError(`Weather API failed: ${e.message}`);
      setStep("idle");
      return;
    }

    // ── STEP 1.5: Market Intelligence (Tavily / News) ──
    try {
      setStep("market");
      addLog(`📡 Searching for active market disruptions in ${city} via MCP tools...`, "info");
      addLog(`   → Tool: tavily_search ('current hazards ${scenario} ${city}')`, "data");
      addLog(`   → Tool: get_news_threats (location: ${city})`, "data");
      await sleep(1000);

      // We'll call the real dynamic risk endpoint which uses MCP tools
      const marketRes = await fetch(`${API}/api/risk/dynamic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, work_type: partnerData?.dbRecord?.employment_type || "delivery" }),
      });

      if (!marketRes.ok) {
        // Fallback to mock data if MCP server isn't running
        addLog(`⚠️  MCP Layer unreachable. Using cached market intelligence.`, "warning");
        const mockIntel = getMockMarketIntel(city, scenario);
        setMarketIntel(mockIntel);
      } else {
        const intelData = await marketRes.json();
        setMarketIntel(intelData);
        addLog(`✅ Market intelligence received: ${intelData.overall_risk_level} threat level`, "success");
        if (intelData.hazard_context) {
          addLog(`   → Found: ${intelData.hazard_context}`, "warning");
        }
      }

      await sleep(600);
    } catch (e) {
      addLog(`⚠️  Market check failed: ${e.message}`, "warning");
      // Don't stop the whole pipeline for market intel failures
      await sleep(400);
    }

    // ── STEP 2: ML Inference ──
    try {
      setStep("analyzing");
      addLog("🧠 Running ML inference pipeline...", "info");
      addLog("   → Income Forecasting · Risk Scoring · Fraud Detection · Disruption Impact · Premium Prediction", "data");
      await sleep(500);

      const mlRes = await fetch(`${API}/api/inference/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker: workerPayload }),
      });

      if (!mlRes.ok) {
        const errText = await mlRes.text();
        throw new Error(`ML API ${mlRes.status}: ${errText}`);
      }

      const mlData = await mlRes.json();
      setMlPreds(mlData);

      addLog(`✅ ML predictions received for Worker #${mlData.worker_id}`, "success");

      // Extract key predictions
      const preds = mlData.predictions || {};
      if (preds.risk_score) {
        const rs = typeof preds.risk_score === "object" ? preds.risk_score.risk_score || preds.risk_score : preds.risk_score;
        addLog(`   🎯 Risk Score: ${typeof rs === "number" ? (rs * 100).toFixed(1) + "%" : JSON.stringify(rs)}`, "data");
      }
      if (preds.fraud_analysis) {
        const fp = preds.fraud_analysis.fraud_probability || preds.fraud_analysis;
        addLog(`   🔍 Fraud Probability: ${typeof fp === "number" ? (fp * 100).toFixed(1) + "%" : JSON.stringify(fp)}`, "data");
      }
      if (preds.income_forecast) {
        const inc = preds.income_forecast.ensemble || preds.income_forecast;
        addLog(`   💰 Forecasted Income: ${typeof inc === "number" ? fmt(Math.round(inc)) : JSON.stringify(inc)}`, "data");
      }
      if (preds.premium) {
        const pm = preds.premium.final_premium || preds.premium;
        addLog(`   📋 Predicted Premium: ${typeof pm === "number" ? fmt(Math.round(pm)) : JSON.stringify(pm)}`, "data");
      }

      await sleep(700);
    } catch (e) {
      addLog(`❌ ML inference failed: ${e.message}`, "error");
      setError(`ML inference failed: ${e.message}`);
      setStep("idle");
      return;
    }

    // ── STEP 3: Eligibility + Claim Decision ──
    try {
      setStep("eligibility");
      addLog("🔎 Checking claim eligibility via orchestrator...", "info");
      await sleep(500);

      const claimRes = await fetch(`${API}/api/claims/process-classic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker: workerPayload, city }),
      });

      if (!claimRes.ok) {
        const errText = await claimRes.text();
        throw new Error(`Claim API ${claimRes.status}: ${errText}`);
      }

      const claim = await claimRes.json();
      // Normalize decision to APPROVE/REJECT for the frontend
      claim.decision = normalizeDecision(claim.decision);
      setClaimResult(claim);

      addLog(`✅ Orchestrator response received`, "success");
      addLog(`   📌 Decision: ${claim.decision}`, claim.decision === "APPROVE" ? "success" : "warning");
      addLog(`   💯 Confidence: ${typeof claim.confidence === "number" ? (claim.confidence * 100).toFixed(1) + "%" : claim.confidence}`, "data");
      addLog(`   💰 Payout: ${fmt(claim.payout_amount || 0)}`, "data");
      addLog(`   ⏱  Processing Time: ${claim.processing_time_ms}ms`, "data");

      if (claim.claim_eligibility) {
        addLog(`   ✓ Eligible: ${claim.claim_eligibility.is_eligible}`, claim.claim_eligibility.is_eligible ? "success" : "warning");
        if (claim.claim_eligibility.reasons?.length) {
          claim.claim_eligibility.reasons.forEach(r => addLog(`      → ${r}`, "data"));
        }
      }

      await sleep(400);
      setStep("decision");
      addLog("━━━━━━━━━━━━━━━━━━", "info");
      addLog(`🏁 Decision: ${claim.decision} | Payout: ${fmt(claim.payout_amount || 0)}`, claim.decision === "APPROVE" ? "success" : "warning");

      // ── STEP 4: Simulate Payout (if approved) ──
      if (claim.decision === "APPROVE" && (claim.payout_amount || 0) > 0) {
        await sleep(800);
        setStep("payout");
        addLog("💸 Initiating RazorpayX payout simulation...", "info");
        addLog(`   → Contact creation → Fund account linking → Payout transfer`, "data");
        await sleep(1200);

        try {
          const reasonStr = `${scenario === "flood" ? "Heavy Rainfall" : scenario === "cyclone" ? "Cyclone" : "Normal"} - ${workerPayload.rainfall_cm * 10}mm`;
          const rolloutDateStr = new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' });

          const payoutRes = await fetch(`${API}/api/payout/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              worker_id: workerPayload.worker_id,
              amount: claim.payout_amount,
              claim_trace_id: claim.trace_id || `sim_${Date.now()}`,
              reason: reasonStr,
            }),
          });

          if (payoutRes.ok) {
            const payoutData = await payoutRes.json();
            setPayoutResult({ ...payoutData, rolloutDate: rolloutDateStr, rolloutReason: reasonStr });
            addLog(`✅ Payout ${payoutData.demo ? "(Demo)" : ""} initiated successfully!`, "success");
            addLog(`   💳 Payout ID: ${payoutData.payout_id}`, "data");
            addLog(`   📱 Mode: ${payoutData.mode} → ${payoutData.destination || "linked account"}`, "data");
            addLog(`   🏦 UTR: ${payoutData.utr || "pending"}`, "data");
            addLog(`   💰 Amount: ${fmt(payoutData.amount)}`, "data");
          } else {
            addLog(`⚠️  Payout API returned ${payoutRes.status}. Backend may not be configured.`, "warning");
            setPayoutResult({ status: "simulated", amount: claim.payout_amount, demo: true, payout_id: `sim_${Date.now()}`, mode: "UPI", utr: `UTR${Math.floor(Math.random() * 999999999)}`, rolloutDate: rolloutDateStr, rolloutReason: reasonStr });
          }
        } catch (payErr) {
          addLog(`⚠️  Payout simulation failed: ${payErr.message}. Showing mock result.`, "warning");
          setPayoutResult({ status: "simulated", amount: claim.payout_amount, demo: true, payout_id: `sim_${Date.now()}`, mode: "UPI", utr: `UTR${Math.floor(Math.random() * 999999999)}`, rolloutDate: rolloutDateStr, rolloutReason: reasonStr });
        }

        addLog("━━━━━━━━━━━━━━━━━━", "info");
        addLog(`🏁 Full pipeline complete! Payout of ${fmt(claim.payout_amount)} processed.`, "success");
      }
    } catch (e) {
      addLog(`❌ Claim processing failed: ${e.message}`, "error");
      setError(`Claim processing failed: ${e.message}`);
      setStep("idle");
    }
  };

  const isRunning = !["idle", "decision", "payout"].includes(step);
  const isDone = step === "decision" || step === "payout";
  const currentStepIdx = PIPELINE_STEPS.findIndex(s => s.key === step);

  return (
    <div className="sim-page">
      <div className="sim-inner">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* ── Tab Nav ── */}
        <div className="sim-tabs-nav">
          <button
            className={`sim-tab-btn ${activeTab === "simulation" ? "active" : ""}`}
            onClick={() => setActiveTab("simulation")}
          >
            <Satellite size={14} /> Live Simulation
          </button>
          <button
            className={`sim-tab-btn ${activeTab === "map" ? "active" : ""}`}
            onClick={() => setActiveTab("map")}
          >
            <Map size={14} /> Coverage Map
          </button>
        </div>

        {activeTab === "map" && <CoverageMapTab partnerId={partnerId} partnerData={partnerData} />}

        {activeTab === "simulation" && <>

          {/* ── Hero ── */}
          <div className="sim-hero">
            <div className="sim-hero-grid" />
            <div className="sim-hero-content">
              <div className="sim-hero-badge">
                <Satellite size={12} /> LIVE SIMULATION
              </div>
              <div className="sim-hero-title">Disruption Simulation Engine</div>
              <div className="sim-hero-sub">
                Trigger a real weather event → watch the ML pipeline analyze, score, and decide payouts in real time.
              </div>
            </div>
            <div className="sim-hero-visual">
              <div className={`sim-radar ${isRunning ? "active" : ""}`}>
                <CloudRain size={32} color="var(--text-on-primary-muted)" />
                <div className="radar-ring r1" />
                <div className="radar-ring r2" />
                <div className="radar-ring r3" />
              </div>
            </div>
          </div>

          {/* ── Controls ── */}
          <div className="sim-controls">
            {/* <div className="sim-control-group">
              <label className="sim-label">
                <MapPin size={13} /> City
              </label>
              <select
                className="sim-select"
                value={city}
                onChange={e => setCity(e.target.value)}
                disabled={isRunning}
              >
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div> */}

            <div className="sim-control-group" style={{ flex: 2 }}>
              <label className="sim-label">
                <CloudRain size={13} /> Scenario
              </label>
              <DisruptionTypeTabs scenario={scenario} setScenario={setScenario} isRunning={isRunning} />
            </div>

            <div className="sim-control-group" style={{ alignSelf: "flex-end" }}>
              <button
                className={`btn-premium ${isRunning ? "running" : ""}`}
                onClick={runSimulation}
                disabled={isRunning}
                style={{ height: "48px", minWidth: "180px" }}
              >
                {isRunning ? (
                  <><span className="spin"><Radio size={16} /></span> Running...</>
                ) : isDone ? (
                  <><RefreshCw size={16} /> Re-run Simulation</>
                ) : (
                  <><Zap size={16} /> Run Simulation</>
                )}
              </button>
            </div>
          </div>

          {/* ── Pipeline Steps ── */}
          <div className="sim-pipeline">
            {PIPELINE_STEPS.map((ps, i) => {
              const isActive = ps.key === step;
              const isPast = i < currentStepIdx;
              const isFuture = i > currentStepIdx;
              const Icon = ps.icon;
              return (
                <div key={ps.key} className="sim-pipe-step-wrapper">
                  <div className={`sim-pipe-step ${isActive ? "active" : isPast ? "done" : "future"}`}>
                    <div className="sps-icon" style={{
                      background: isPast ? "var(--green-bg)"
                        : isActive ? `${ps.color}18`
                          : "var(--surface2)",
                      borderColor: isPast ? "var(--green-bdr)"
                        : isActive ? ps.color
                          : "var(--border)",
                      color: isPast ? "var(--green)"
                        : isActive ? ps.color
                          : "var(--muted)",
                    }}>
                      {isPast ? <CheckCircle size={16} /> : isActive && isRunning ? <span className="spin"><Radio size={16} /></span> : <Icon size={16} />}
                    </div>
                    <div className="sps-label" style={{
                      color: isPast ? "var(--green)"
                        : isActive ? ps.color
                          : "var(--muted)",
                    }}>{ps.label}</div>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div className={`sim-pipe-line ${isPast ? "done" : ""}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Main content: Results + Live Log ── */}
          <div className="sim-main-grid">
            {/* ── Left: Results ── */}
            <div className="sim-results">

              {/* Market Intelligence Results */}
              {marketIntel && (
                <div className="sim-result-card market-card">
                  <div className="src-header">
                    <Radio size={15} color="#6366F1" />
                    <span>Market Intelligence — {marketIntel.city}</span>
                    <span className={`src-badge ${marketIntel.overall_risk_level === "HIGH" || marketIntel.overall_risk_level === "CRITICAL" ? "badge-red" : "badge-green"}`}>
                      {marketIntel.overall_risk_level} RISK
                    </span>
                  </div>

                  <div className="market-intel-content">
                    <div className="mi-summary-row">
                      <div className="mi-factor">
                        <div className="mi-factor-label">Risk Multiplier</div>
                        <div className="mi-factor-val">{marketIntel.combined_multiplier?.toFixed(2)}x</div>
                      </div>
                      <div className="mi-factor">
                        <div className="mi-factor-label">Environment</div>
                        <div className="mi-factor-val" style={{ textTransform: 'capitalize' }}>{marketIntel.weather_condition || "Clear"}</div>
                      </div>
                      <div className="mi-factor">
                        <div className="mi-factor-label">Search Signal</div>
                        <div className="mi-factor-val">{marketIntel.crawl_hazard_level || "LOW"}</div>
                      </div>
                    </div>

                    {marketIntel.hazard_context && (
                      <div className="mi-context-box">
                        <div className="mi-context-title"><AlertTriangle size={12} /> Active Search Analysis</div>
                        <div className="mi-context-text">{marketIntel.hazard_context}</div>
                      </div>
                    )}

                    {marketIntel.tavily_answer && (
                      <div className="mi-tavily-box">
                        <div className="mi-tavily-title"><Satellite size={12} /> Web-Crawl Intel (Tavily AI)</div>
                        <div className="mi-tavily-answer">{marketIntel.tavily_answer}</div>
                      </div>
                    )}

                    <div className="mi-formula">
                      <code>{marketIntel.formula || `P_final = P_base x ${marketIntel.r_weather} x ${marketIntel.r_market}`}</code>
                    </div>
                  </div>
                </div>
              )}

              {/* Weather Results */}
              {weather && (
                <div className="sim-result-card weather-card">
                  <div className="src-header">
                    <CloudRain size={15} color="#2563EB" />
                    <span>Weather Data — {weather.city}</span>
                    <span className="src-badge" style={{ background: "var(--badge-bg, #2563EB15)", color: "var(--badge-text, #2563EB)", borderColor: "var(--badge-bdr, #2563EB44)" }}>
                      {weather.reports.length} stations
                    </span>
                  </div>
                  <div className="sim-weather-grid">
                    {weather.reports.map((r, i) => (
                      <div key={i} className="sw-station">
                        <div className="sw-area">{r.area}</div>
                        <div className="sw-metrics">
                          <div className="sw-metric">
                            <Droplets size={12} color="#2563EB" />
                            <span className="sw-metric-val">{r.measurements.rainfall_mm_24h}mm</span>
                            <span className="sw-metric-label">Rain</span>
                          </div>
                          <div className="sw-metric">
                            <Wind size={12} color="#64748B" />
                            <span className="sw-metric-val">{r.measurements.wind_speed_kmph} km/h</span>
                            <span className="sw-metric-label">Wind</span>
                          </div>
                          <div className="sw-metric">
                            <Thermometer size={12} color="#DC2626" />
                            <span className="sw-metric-val">{r.measurements.temperature_c}°C</span>
                            <span className="sw-metric-label">Temp</span>
                          </div>
                          <div className="sw-metric">
                            <Gauge size={12} color="#7C3AED" />
                            <span className="sw-metric-val">{r.measurements.humidity_percent}%</span>
                            <span className="sw-metric-label">Humidity</span>
                          </div>
                        </div>
                        <div className={`sw-alert sw-alert-${r.alerts.level.toLowerCase()}`}>
                          <AlertTriangle size={10} /> {r.alerts.level} Alert — {r.condition_summary}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ML Predictions */}
              {mlPreds && (
                <div className="sim-result-card ml-card">
                  <div className="src-header">
                    <Brain size={15} color="#7C3AED" />
                    <span>ML Predictions — Worker #{mlPreds.worker_id}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: "12px 0" }}>
                    {mlPreds.predictions && Object.entries(mlPreds.predictions).map(([key, val]) => {
                      if (key === "claim_eligibility") {
                        // Show as a simple badge
                        const eligible = val?.is_eligible ?? (typeof val === "object" ? Object.values(val)[0] : val);
                        return (
                          <div key={key} style={{
                            padding: "12px 14px", borderRadius: 10, gridColumn: "span 3",
                            background: eligible ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.05)",
                            border: `1px solid ${eligible ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)"}`,
                            display: "flex", alignItems: "center", gap: 8,
                          }}>
                            {eligible ? <CheckCircle size={14} color="var(--green)" /> : <XCircle size={14} color="var(--red)" />}
                            <span style={{ fontWeight: 600, fontSize: 12, color: eligible ? "var(--green)" : "var(--red)" }}>
                              {eligible ? "Eligible for Claim" : "Not Eligible"}
                            </span>
                          </div>
                        );
                      }
                      const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                      let displayVal = "";
                      if (typeof val === "number") {
                        displayVal = val > 100 ? fmt(Math.round(val)) : val.toFixed(3);
                      } else if (typeof val === "object" && val !== null) {
                        const num = val.ensemble || val.final_premium || val.risk_score || val.fraud_probability || val.behavior_score;
                        if (typeof num === "number") {
                          if (key.includes("score") || key.includes("fraud") || key.includes("behavior")) {
                            displayVal = (num * 100).toFixed(1) + "%";
                          } else {
                            displayVal = num > 100 ? fmt(Math.round(num)) : num.toFixed(3);
                          }
                        } else {
                          displayVal = "—";
                        }
                      } else {
                        displayVal = String(val);
                      }

                      const iconMap = {
                        "Income Forecast": CircleDollarSign, "Risk Scoring": Target, "Risk Score": Target,
                        "Fraud Detection": Scan, "Fraud Analysis": Scan, "Premium Prediction": Banknote,
                        "Premium": Banknote, "Disruption Impact": TrendingDown, "Behavior Analysis": Activity,
                      };
                      const Icon = iconMap[label] || BarChart2;

                      return (
                        <div key={key} style={{
                          padding: "12px 14px", borderRadius: 10,
                          background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.08)",
                          textAlign: "center",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 6 }}>
                            <Icon size={12} color="#7C3AED" />
                            <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</span>
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--ml-num, #7C3AED)" }}>{displayVal}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Decision / Claim Result */}
              {claimResult && (
                <div className={`sim-result-card decision-card ${claimResult.decision === "APPROVE" ? "approved" : "rejected"}`}>
                  <div className="src-header">
                    {claimResult.decision === "APPROVE"
                      ? <BadgeCheck size={15} color="var(--green)" />
                      : <XCircle size={15} color="var(--red)" />
                    }
                    <span>Claim Decision</span>
                    <span className={`src-badge ${claimResult.decision === "APPROVE" ? "badge-green" : "badge-red"}`}>
                      {claimResult.decision}
                    </span>
                  </div>

                  {/* ── Summary Row ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, margin: "16px 0" }}>
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: claimResult.payout_amount > 0 ? "rgba(16,185,129,0.06)" : "rgba(0,0,0,0.03)", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Final Payout</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: claimResult.payout_amount > 0 ? "var(--green)" : "var(--text)", fontFamily: "var(--mono)", marginTop: 4 }}>
                        {fmt(claimResult.payout_amount || 0)}
                      </div>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(0,0,0,0.03)", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Confidence</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--purple)", fontFamily: "var(--mono)", marginTop: 4 }}>
                        {typeof claimResult.confidence === "number" ? (claimResult.confidence * 100).toFixed(1) + "%" : claimResult.confidence || "—"}
                      </div>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(0,0,0,0.03)", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>Processing</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text2)", fontFamily: "var(--mono)", marginTop: 4 }}>
                        {Math.round(claimResult.processing_time_ms / 1000) || 0}<span style={{ fontSize: 12, fontWeight: 500 }}> second(s)</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Eligibility Status ── */}
                  {claimResult.claim_eligibility && (
                    <div style={{
                      padding: "14px 18px", borderRadius: 12, marginBottom: 14,
                      background: claimResult.claim_eligibility.is_eligible ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.05)",
                      border: `1px solid ${claimResult.claim_eligibility.is_eligible ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)"}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: claimResult.claim_eligibility.reasons?.length ? 10 : 0 }}>
                        {claimResult.claim_eligibility.is_eligible
                          ? <CheckCircle size={15} color="var(--green)" />
                          : <XCircle size={15} color="var(--red)" />
                        }
                        <span style={{ fontWeight: 700, fontSize: 13, color: claimResult.claim_eligibility.is_eligible ? "var(--green)" : "var(--red)" }}>
                          {claimResult.claim_eligibility.is_eligible ? "Eligible for Claim Payout" : "Not Eligible for Payout"}
                        </span>
                      </div>
                      {claimResult.claim_eligibility.reasons?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                          {claimResult.claim_eligibility.reasons.map((r, i) => (
                            <span key={i} style={{
                              fontSize: 11, padding: "4px 10px", borderRadius: 6,
                              background: claimResult.claim_eligibility.is_eligible ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.06)",
                              color: claimResult.claim_eligibility.is_eligible ? "#047857" : "#DC2626",
                              border: `1px solid ${claimResult.claim_eligibility.is_eligible ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.15)"}`,
                              fontWeight: 500,
                            }}>
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Payout Breakdown ── */}
                  {claimResult.payout_breakdown && (
                    <div style={{
                      padding: "20px 24px", borderRadius: 14, marginBottom: 20,
                      background: "rgba(107,45,139,0.03)", border: "1px solid rgba(107,45,139,0.08)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, fontWeight: 700, color: "var(--purple-dark)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <Banknote size={15} color="var(--purple)" /> Payout Calculation Breakdown
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
                        {Object.entries(claimResult.payout_breakdown).map(([k, v]) => {
                          if (k === "breakdown") return null;
                          const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                          const isAmount = typeof v === "number" && v > 10;
                          const isPercent = typeof v === "number" && v <= 1 && v >= 0;
                          const displayVal = typeof v === "number"
                            ? (isPercent ? (v * 100).toFixed(1) + "%" : isAmount ? fmt(Math.round(v)) : v.toFixed(3))
                            : String(v);
                          return (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{label}</span>
                              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--mono)", color: typeof v === "number" ? "var(--purple)" : "var(--purple)" }}>{displayVal}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── ML Predictions Summary (compact) ── */}
                  {claimResult.ml_predictions && (
                    <div style={{
                      padding: "14px 18px", borderRadius: 12,
                      background: "rgba(124,58,237,0.03)", border: "1px solid rgba(124,58,237,0.08)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 12, fontWeight: 700, color: "var(--purple-dark)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <Brain size={13} color="#7C3AED" /> ML Model Scores
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {Object.entries(claimResult.ml_predictions).map(([k, v]) => {
                          if (k === "claim_eligibility") return null; // Skip — already shown above
                          const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                          let displayVal = "";
                          if (typeof v === "number") {
                            displayVal = v > 100 ? fmt(Math.round(v)) : v.toFixed(3);
                          } else if (typeof v === "object" && v !== null) {
                            const num = v.ensemble || v.final_premium || v.risk_score || v.fraud_probability || v.behavior_score;
                            displayVal = typeof num === "number" ? (num > 100 ? fmt(Math.round(num)) : num.toFixed(3)) : "—";
                          } else {
                            displayVal = String(v);
                          }
                          return (
                            <div key={k} style={{
                              padding: "6px 12px", borderRadius: 8, fontSize: 11,
                              background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.1)",
                              display: "flex", alignItems: "center", gap: 6,
                            }}>
                              <span style={{ color: "var(--muted)", fontWeight: 500 }}>{label}</span>
                              <span style={{ fontWeight: 700, fontFamily: "var(--mono)", color: "var(--ml-num, #7C3AED)" }}>{displayVal}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Trace Info (compact footer) ── */}
                  <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 11, color: "var(--muted)", paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                    <span>Trace: <code style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{claimResult.trace_id?.slice(0, 16)}...</code></span>
                    <span>Worker: #{claimResult.worker_id}</span>
                    {claimResult.timestamp && <span>{new Date(claimResult.timestamp).toLocaleString()}</span>}
                  </div>
                </div>
              )}

              {/* Payout Result */}
              {payoutResult && (
                <div className="sim-result-card" style={{
                  background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
                  border: "1.5px solid var(--green-bdr)",
                }}>
                  <div className="src-header">
                    <BadgeCheck size={15} color="var(--green)" />
                    <span>Payout {payoutResult.demo ? "(Demo)" : "Processed"}</span>
                    <span className="src-badge badge-green">
                      {payoutResult.status === "processed" || payoutResult.status === "demo_success" ? "CREDITED" : "SIMULATED"}
                    </span>
                  </div>
                  <div style={{ padding: "16px 0" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div style={{ padding: 16, borderRadius: 12, background: "rgba(16,185,129,0.08)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Amount Credited</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--green)", fontFamily: "var(--mono)" }}>{fmt(payoutResult.amount || 0)}</div>
                      </div>
                      <div style={{ padding: 16, borderRadius: 12, background: "rgba(16,185,129,0.08)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Transfer Mode</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>{payoutResult.mode || "UPI"}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        ["Payout ID", payoutResult.payout_id?.slice(0, 20) + "..."],
                        ["UTR", payoutResult.utr || "Pending"],
                        ["Destination", payoutResult.destination || "Linked Account"],
                        ["Status", payoutResult.status?.toUpperCase()],
                        ["Rollout Date", payoutResult.rolloutDate || new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' })],
                        ["Reason", payoutResult.rolloutReason || payoutResult.reason || "Parametric Claim"],
                      ].map(([l, v]) => (
                        <div key={l} className="sd-detail-row">
                          <span className="sd-detail-label">{l}</span>
                          <span className="sd-detail-val" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    {/* <div style={{ marginTop: 12, textAlign: "center" }}>
                      <button
                        onClick={async () => {
                          try {
                            await fetch(`${API}/api/payout/reset`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ payout_id: payoutResult.payout_id }),
                            });
                            setPayoutResult(null);
                            addLog("\u21bb Payout reset \u2014 ready for re-test", "info");
                          } catch (e) { console.error("Reset failed:", e); }
                        }}
                        style={{
                          fontSize: 11, padding: "6px 16px", borderRadius: 6,
                          background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.12)",
                          color: "var(--muted)", cursor: "pointer",
                        }}
                      >
                        Reset Payout (Debug)
                      </button>
                    </div> */}
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="sim-error-card">
                  <AlertTriangle size={16} color="var(--red)" />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Simulation Error</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{error}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                      Make sure the backend is running: <code>uvicorn app:app --host 0.0.0.0 --port 8000</code>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!weather && !mlPreds && !claimResult && !error && (
                <div className="sim-empty">
                  <Satellite size={40} color="var(--purple-lt)" />
                  <div className="sim-empty-title">Ready to Simulate</div>
                  <div className="sim-empty-sub">
                    Select a city and scenario, then click <strong>Run Simulation</strong> to trigger the full ML pipeline.
                  </div>
                  <div className="sim-empty-steps">
                    <div>1. Weather data is fetched from the partner API</div>
                    <div>2. ML models run inference (risk, fraud, income, premium)</div>
                    <div>3. Orchestrator checks eligibility & calculates payout</div>
                    <div>4. Decision is rendered with full breakdown</div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: Live Log ── */}
            <div className="sim-log-panel">
              <div className="sim-log-header">
                <Activity size={13} /> Pipeline Log
                {logs.length > 0 && <span className="sim-log-count">{logs.length} events</span>}
              </div>
              <div className="sim-log-body" ref={logRef}>
                {logs.length === 0 ? (
                  <div className="sim-log-empty">Waiting for simulation...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className={`sim-log-entry log-${log.type}`}>
                      <span className="sim-log-ts">{log.ts}</span>
                      <span className="sim-log-msg">{log.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getMockMarketIntel(city, scenario) {
  const isCyc = scenario === "cyclone";
  const isFlood = scenario === "flood";

  return {
    city,
    overall_risk_level: isCyc ? "CRITICAL" : isFlood ? "HIGH" : "LOW",
    combined_multiplier: isCyc ? 1.45 : isFlood ? 1.25 : 1.05,
    r_weather: isCyc ? 1.3 : isFlood ? 1.15 : 1.0,
    r_market: isCyc ? 1.15 : isFlood ? 1.1 : 1.05,
    weather_condition: isCyc ? "cyclone" : isFlood ? "heavy rain" : "clear",
    crawl_hazard_level: isCyc ? "HIGH" : isFlood ? "MEDIUM" : "LOW",
    hazard_context: isCyc
      ? "Cyclone warning in effect. Major road closures on OMR and ECR. Port operations suspended."
      : isFlood
        ? "Heavy waterlogging reported in Whitefield and Silk Board. Bengaluru traffic police issued advisory."
        : "Normal market conditions. Minor traffic delays in central business district.",
    tavily_answer: isCyc
      ? "Active cyclone alerts for coastal regions. Local authorities have declared a public holiday. Deliveries are highly disrupted with 70% of outlets offline."
      : isFlood
        ? "Search reveals localized flooding in 4 major sectors. Strike activity noted by gig worker unions protesting unsafe working conditions in rain."
        : "Current search results show no major protests or strikes. Road conditions are normal for Bengaluru/Chennai current peak hours.",
    formula: "P_final = P_base x R_weather x R_market"
  };
}
