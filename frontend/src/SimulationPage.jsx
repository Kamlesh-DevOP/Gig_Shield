import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, CloudRain, Zap, ShieldCheck, Activity,
  AlertTriangle, CheckCircle, TrendingDown, Radio,
  MapPin, BarChart2, CircleDollarSign, Target,
  Droplets, Wind, Thermometer, Gauge, Satellite,
  Brain, Scan, BadgeCheck, XCircle, ChevronRight,
  Banknote, Clock, Percent, FileText,
} from "lucide-react";

const API = "http://localhost:8000";
const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const isApproved = (d) => ["APPROVE", "auto_approve", "approved"].includes(String(d || "").toLowerCase().includes("approv") ? d : "") || String(d || "").toLowerCase().includes("approv");
const normalizeDecision = (d) => isApproved(d) ? "APPROVE" : String(d || "REJECT").toUpperCase();

// ── Simulation Step Pipeline ─────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { key: "idle",       label: "Ready",             icon: Zap,              color: "#7B6899" },
  { key: "weather",    label: "Fetching Weather",  icon: CloudRain,        color: "#2563EB" },
  { key: "analyzing",  label: "ML Inference",      icon: Brain,            color: "#7C3AED" },
  { key: "eligibility",label: "Eligibility Check", icon: Scan,             color: "#D97706" },
  { key: "decision",   label: "Decision",          icon: ShieldCheck,      color: "#059669" },
];

export default function SimulationPage({ partnerId, partnerData, onBack }) {
  const [city, setCity] = useState(partnerData?.city || "Chennai");
  const [scenario, setScenario] = useState("flood");
  const [step, setStep]         = useState("idle");        // pipeline step
  const [weather, setWeather]   = useState(null);
  const [mlPreds, setMlPreds]   = useState(null);
  const [claimResult, setClaimResult] = useState(null);
  const [error, setError]       = useState(null);
  const [logs, setLogs]         = useState([]);
  const logRef = useRef(null);

  const addLog = (msg, type = "info") => {
    setLogs(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString() }]);
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const cities = ["Chennai", "Mumbai", "Bengaluru", "Hyderabad", "Kolkata", "Delhi", "Pune", "Ahmedabad"];
  const scenarios = [
    { key: "flood",   label: "🌧️ Heavy Rainfall / Flood", desc: "150-250mm rain in 24h" },
    { key: "cyclone", label: "🌀 Cyclone Alert",          desc: "200-300mm + high winds" },
    { key: "normal",  label: "☀️ Normal Conditions",       desc: "0-120mm random rain" },
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
      worker_id:              db.worker_id     || parseInt(partnerId.replace(/\D/g, "")) || 1,
      city:                   city,
      avg_52week_income:      avgIncome,
      disruption_type:        scenario === "flood" ? "Heavy_Rain" : scenario === "cyclone" ? "Cyclone" : "Normal",
      selected_slab:          db.selected_slab          || "Slab_100",
      income_loss_percentage: scenario === "flood" ? 55 : scenario === "cyclone" ? 70 : 5,
      employment_type:        db.employment_type         || "Full-Time",
      platform:               db.platform                || "Zepto",
      premium_paid:           1,   // Simulation assumes premium is paid
      cooling_period_completed: 1, // Simulation assumes cooling period done
      weeks_active:           db.weeks_active            || 26,
      week_of_year:           db.week_of_year            || 20,
      weekly_income:          simulatedWeeklyIncome,
      income_std_dev:         db.income_std_dev           || 200,
      income_volatility:      db.income_volatility        || 0.1,
      orders_completed_week:  scenario === "normal" ? (db.orders_completed_week || 50) : Math.round((db.orders_completed_week || 50) * 0.4),
      active_hours_week:      scenario === "normal" ? (db.active_hours_week || 40) : Math.round((db.active_hours_week || 40) * 0.5),
      disruption_duration_hours: scenario === "flood" ? 12 : scenario === "cyclone" ? 24 : 0,
      rainfall_cm:            scenario === "flood" ? 18 : scenario === "cyclone" ? 25 : 3,
      temperature_extreme:    db.temperature_extreme      || 28,
      cyclone_alert_level:    scenario === "cyclone" ? 3 : 0,
      payment_consistency_score: db.payment_consistency_score || 0.9,
      fraud_trust_rating:     db.fraud_trust_rating       || 0.85,
      overall_risk_score:     db.overall_risk_score       || 0.2,
      disruption_exposure_risk: scenario === "normal" ? 0.1 : 0.7,
      distance_from_outlet_km:  db.distance_from_outlet_km  || 5,
      order_acceptance_rate:  db.order_acceptance_rate     || 0.9,
      order_decline_rate:     db.order_decline_rate        || 0.1,
      gps_spoofing_score:     db.gps_spoofing_score        || 0,
      movement_realism_score: db.movement_realism_score    || 1,
      presence_score:         db.presence_score            || 1,
      peer_group_activity_ratio: db.peer_group_activity_ratio || 1,
      consecutive_payment_weeks: db.consecutive_payment_weeks || 10,
      coordinated_fraud_cluster_id: db.coordinated_fraud_cluster_id || 0,
      ip_gps_mismatch:        db.ip_gps_mismatch           || 0,
      device_sharing_flag:    db.device_sharing_flag        || 0,
    };
  };

  // ── Run the full simulation pipeline ──────────────────────────────────────
  const runSimulation = async () => {
    setError(null);
    setWeather(null);
    setMlPreds(null);
    setClaimResult(null);
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
      addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
      addLog(`🏁 Simulation complete! Decision: ${claim.decision} | Payout: ${fmt(claim.payout_amount || 0)}`, claim.decision === "APPROVE" ? "success" : "warning");
    } catch (e) {
      addLog(`❌ Claim processing failed: ${e.message}`, "error");
      setError(`Claim processing failed: ${e.message}`);
      setStep("idle");
    }
  };

  const isRunning = !["idle", "decision"].includes(step);
  const isDone = step === "decision";
  const currentStepIdx = PIPELINE_STEPS.findIndex(s => s.key === step);

  return (
    <div className="sim-page">
      <div className="sim-inner">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

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
              <CloudRain size={32} color="#C4A8E0" />
              <div className="radar-ring r1" />
              <div className="radar-ring r2" />
              <div className="radar-ring r3" />
            </div>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="sim-controls">
          <div className="sim-control-group">
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
          </div>

          <div className="sim-control-group" style={{ flex: 2 }}>
            <label className="sim-label">
              <CloudRain size={13} /> Scenario
            </label>
            <div className="sim-scenario-row">
              {scenarios.map(s => (
                <button
                  key={s.key}
                  className={`sim-scenario-btn ${scenario === s.key ? "active" : ""}`}
                  onClick={() => setScenario(s.key)}
                  disabled={isRunning}
                >
                  <span className="ssb-label">{s.label}</span>
                  <span className="ssb-desc">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sim-control-group" style={{ alignSelf: "flex-end" }}>
            <button
              className={`sim-run-btn ${isRunning ? "running" : isDone ? "done" : ""}`}
              onClick={runSimulation}
              disabled={isRunning}
            >
              {isRunning ? (
                <><span className="spin"><Radio size={16} /></span> Running...</>
              ) : isDone ? (
                <><Zap size={16} /> Re-run Simulation</>
              ) : (
                <><Zap size={16} /> Run Simulation</>
              )}
            </button>
          </div>
        </div>

        {/* ── Pipeline Steps ── */}
        <div className="sim-pipeline">
          {PIPELINE_STEPS.map((ps, i) => {
            const isActive  = ps.key === step;
            const isPast    = i < currentStepIdx;
            const isFuture  = i > currentStepIdx;
            const Icon      = ps.icon;
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

            {/* Weather Results */}
            {weather && (
              <div className="sim-result-card weather-card">
                <div className="src-header">
                  <CloudRain size={15} color="#2563EB" />
                  <span>Weather Data — {weather.city}</span>
                  <span className="src-badge" style={{ background: "#2563EB15", color: "#2563EB", borderColor: "#2563EB44" }}>
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
                <div className="sim-ml-grid">
                  {renderMLPredictions(mlPreds.predictions)}
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

                <div className="sim-decision-grid">
                  <div className="sd-main-box">
                    <div className="sd-main-label">Final Payout</div>
                    <div className={`sd-main-val ${claimResult.payout_amount > 0 ? "green" : ""}`}>
                      {fmt(claimResult.payout_amount || 0)}
                    </div>
                    <div className="sd-main-sub">
                      Confidence: {typeof claimResult.confidence === "number" ? (claimResult.confidence * 100).toFixed(1) + "%" : claimResult.confidence}
                      {" · "}
                      {claimResult.processing_time_ms}ms
                    </div>
                  </div>

                  <div className="sd-details">
                    {[
                      ["Decision", claimResult.decision],
                      ["Trace ID", claimResult.trace_id?.slice(0, 12) + "..."],
                      ["Worker ID", claimResult.worker_id],
                      ["Timestamp", claimResult.timestamp ? new Date(claimResult.timestamp).toLocaleString() : "—"],
                    ].map(([l, v]) => (
                      <div key={l} className="sd-detail-row">
                        <span className="sd-detail-label">{l}</span>
                        <span className="sd-detail-val">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Eligibility details */}
                {claimResult.claim_eligibility && (
                  <div className="sd-eligibility">
                    <div className="sd-elig-header">
                      {claimResult.claim_eligibility.is_eligible
                        ? <><CheckCircle size={13} color="var(--green)" /> Eligible for Payout</>
                        : <><XCircle size={13} color="var(--red)" /> Not Eligible</>
                      }
                    </div>
                    {claimResult.claim_eligibility.reasons?.length > 0 && (
                      <ul className="sd-elig-reasons">
                        {claimResult.claim_eligibility.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Payout breakdown */}
                {claimResult.payout_breakdown && (
                  <div className="sd-breakdown">
                    <div className="sd-breakdown-title"><Banknote size={13} /> Payout Breakdown</div>
                    <div className="sd-breakdown-items">
                      {Object.entries(claimResult.payout_breakdown).map(([k, v]) => (
                        <div key={k} className="sd-bd-item">
                          <span className="sd-bd-label">{k.replace(/_/g, " ")}</span>
                          <span className="sd-bd-val">{typeof v === "number" ? (v > 10 ? fmt(Math.round(v)) : v.toFixed(3)) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ML predictions in claim */}
                {claimResult.ml_predictions && (
                  <div className="sd-breakdown" style={{ marginTop: 12 }}>
                    <div className="sd-breakdown-title"><Brain size={13} /> ML Predictions (from Orchestrator)</div>
                    <div className="sd-breakdown-items">
                      {Object.entries(claimResult.ml_predictions).map(([k, v]) => (
                        <div key={k} className="sd-bd-item">
                          <span className="sd-bd-label">{k.replace(/_/g, " ")}</span>
                          <span className="sd-bd-val">{typeof v === "number" ? v.toFixed(4) : typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function renderMLPredictions(preds) {
  if (!preds) return null;
  const cards = [];
  const tryNum = (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "object" && v !== null) {
      const first = Object.values(v)[0];
      if (typeof first === "number") return first;
    }
    return null;
  };

  const entries = Object.entries(preds);
  entries.forEach(([key, val]) => {
    const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    let displayVal = "";
    let isPercentage = false;

    if (typeof val === "number") {
      displayVal = val > 100 ? fmt(Math.round(val)) : val.toFixed(3);
    } else if (typeof val === "object" && val !== null) {
      // Try to extract the most meaningful value
      const meaningful = val.ensemble || val.final_premium || val.risk_score || val.fraud_probability || val.behavior_score;
      const num = tryNum(meaningful ?? val);
      if (num !== null) {
        if (key.includes("score") || key.includes("fraud") || key.includes("behavior")) {
          displayVal = (num * 100).toFixed(1) + "%";
          isPercentage = true;
        } else {
          displayVal = num > 100 ? fmt(Math.round(num)) : num.toFixed(3);
        }
      } else {
        displayVal = JSON.stringify(val).slice(0, 50);
      }
    } else {
      displayVal = String(val);
    }

    const icons = {
      "Income Forecast": CircleDollarSign,
      "Risk Scoring": Target,
      "Risk Score": Target,
      "Fraud Detection": Scan,
      "Fraud Analysis": Scan,
      "Premium Prediction": Banknote,
      "Premium": Banknote,
      "Disruption Impact": TrendingDown,
      "Behavior Analysis": Activity,
    };
    const Icon = icons[label] || BarChart2;

    cards.push(
      <div key={key} className="sim-ml-item">
        <div className="smi-icon"><Icon size={14} /></div>
        <div className="smi-label">{label}</div>
        <div className="smi-val">{displayVal}</div>
      </div>
    );
  });

  return cards;
}
