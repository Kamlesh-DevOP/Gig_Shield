import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, AlertTriangle, Users, DollarSign, LayoutDashboard, Telescope, Radar, Zap, X, RefreshCw, MapPin, CloudLightning, ChevronDown } from 'lucide-react';

const COLORS = ['#6B2D8B', '#C4A8E0', '#5B21B6', '#0D7A56', '#B91C1C'];

const CITY_AREAS = {
  "Bengaluru": ["BTM", "Electronic City", "Whitefield"],
  "Chennai": ["Sholinganallur", "Velachery", "Tambaram"],
  "Mumbai": ["Bandra", "Andheri", "Dadar"],
  "Hyderabad": ["Gachibowli", "Hitech City", "Secunderabad"],
  "Delhi": ["Rohini", "Dwarka", "Connaught Place"],
  "Kolkata": ["Salt Lake", "Howrah", "Park Street"],
  "Pune": ["Hinjewadi", "Kothrud", "Viman Nagar"],
  "Ahmedabad": ["Navrangpura", "SG Highway", "Maninagar"],
};

const DISRUPTION_TYPES = [
  { id: "flood", label: "Flood / Heavy Rain", icon: "🌊", color: "#3B82F6" },
  { id: "cyclone", label: "Cyclone", icon: "🌀", color: "#8B5CF6" },
  { id: "strike", label: "Transport Strike", icon: "🚧", color: "#F59E0B" },
  { id: "protest", label: "Mass Protest", icon: "📢", color: "#EF4444" },
  { id: "curfew", label: "Curfew / Section 144", icon: "🚨", color: "#DC2626" },
];

const AGENT_STEPS = [
  "Fetching workers from Supabase...",
  "Geo-filtering by outlet coordinates...",
  "Augmenting records with disruption parameters...",
  "Running Classic Orchestrator...",
  "Agent evaluating income loss thresholds...",
  "Aggregating payout decisions...",
  "Updating predictive metrics...",
];

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalWorkers: 0,
    totalPremium: 0,
    totalPayout: 0,
    disruptions: 0,
    slabDistribution: [],
    lossRatioData: [],
    disruptionTypeData: [],
    recentAlerts: [],
    forecastPremium: 0,
    forecastPayout: 0,
    workersAtRisk: 0,
    netProfitForecast: 0
  });
  const [loading, setLoading] = useState(true);
  const [isPredicting, setIsPredicting] = useState(true);

  // Simulation state
  const [showSimPanel, setShowSimPanel] = useState(false);
  const [simCity, setSimCity] = useState("Bengaluru");
  const [simArea, setSimArea] = useState("Whitefield");
  const [simType, setSimType] = useState("flood");
  const [simRunning, setSimRunning] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: workers, error: workerErr } = await supabase
          .from('gigshield_workers')
          .select('record, ingested_at');

        if (workerErr) throw workerErr;

        let premiumSum = 0;
        let payoutSum = 0;
        let slabCounts = {};
        let disruptionCount = 0;
        let disruptionTypeMap = {};
        let forecastPremiumSum = 0;
        let forecastPayoutSum = 0;
        let riskWorkers = 0;

        workers.forEach(w => {
          const rec = w.record;
          const slab = rec.selected_slab || 'Unknown';
          const premium = parseFloat(rec.premium_amount || 0);
          const estimatedPremium = premium || (slab.toLowerCase().includes('premium') ? 1500 : 500);
          const actualPayout = parseFloat(rec.final_payout_amount || 0);

          premiumSum += estimatedPremium;
          payoutSum += actualPayout;
          slabCounts[slab] = (slabCounts[slab] || 0) + 1;

          if (rec.disruption_type && rec.disruption_type.toLowerCase() !== 'none') {
            disruptionCount += 1;
            const dType = rec.disruption_type.charAt(0).toUpperCase() + rec.disruption_type.slice(1);
            disruptionTypeMap[dType] = (disruptionTypeMap[dType] || 0) + 1;
          }

          const pRiskScore = parseFloat(rec.predicted_risk_score || 0);
          const pIncomeLossPct = parseFloat(rec.predicted_income_loss_pct || 0);
          const pForecastIncome = parseFloat(rec.forecasted_weekly_income || 0);

          let coverageMult = 0.75;
          if (slab.toLowerCase().includes('100') || slab.toLowerCase().includes('slab_100')) coverageMult = 1.0;
          if (slab.toLowerCase().includes('50') || slab.toLowerCase().includes('slab_50')) coverageMult = 0.5;

          let premPct = 0.04;
          if (coverageMult === 1.0) premPct = 0.048;
          if (coverageMult === 0.5) premPct = 0.036;

          const fPrem = pForecastIncome * premPct;
          forecastPremiumSum += fPrem;
          const fPayout = (pForecastIncome * (pIncomeLossPct / 100)) * coverageMult;
          forecastPayoutSum += fPayout;

          if (pRiskScore > 0.5 || pIncomeLossPct > 0 || rec.cyclone_alert_level > 0) {
            riskWorkers += 1;
          }
        });

        const slabPieData = Object.keys(slabCounts)
          .filter(k => k && k !== 'Unknown' && k !== 'null')
          .map(key => ({ name: key, value: slabCounts[key] }));
        const disruptionBarsData = Object.keys(disruptionTypeMap).map(key => ({ name: key, Anomalies: disruptionTypeMap[key] }));
        const thisWeekMargin = (100 - (payoutSum / (premiumSum || 1)) * 100).toFixed(1);
        const thisWeekRisk = ((disruptionCount / Math.max(workers.length, 1)) * 100).toFixed(1);
        const nextWeekMargin = (100 - (forecastPayoutSum / (forecastPremiumSum || 1)) * 100).toFixed(1);
        const nextWeekRisk = ((riskWorkers / Math.max(workers.length, 1)) * 100).toFixed(1);
        
        const dynamicLossRatioData = [
          { name: 'This Week', margin: parseFloat(thisWeekMargin), risk: parseFloat(thisWeekRisk) },
          { name: 'Next Week', margin: parseFloat(nextWeekMargin), risk: parseFloat(nextWeekRisk) }
        ];

        setStats({
          totalWorkers: workers.length,
          totalPremium: premiumSum,
          totalPayout: payoutSum,
          disruptions: disruptionCount,
          slabDistribution: slabPieData,
          lossRatioData: dynamicLossRatioData,
          disruptionTypeData: disruptionBarsData,
          forecastPremium: forecastPremiumSum,
          forecastPayout: forecastPayoutSum,
          workersAtRisk: riskWorkers,
          netProfitForecast: forecastPremiumSum - forecastPayoutSum
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
        setTimeout(() => setIsPredicting(false), 2500);
      }
    };
    fetchData();
  }, []);

  // When city changes, reset area to first available
  useEffect(() => {
    const areas = CITY_AREAS[simCity] || [];
    if (areas.length > 0) setSimArea(areas[0]);
  }, [simCity]);

  const runSimulation = async () => {
    setSimRunning(true);
    setSimResult(null);
    setSimError(null);
    setShowSimPanel(false);
    setSimStep(0);

    // Animate through agent steps
    const stepInterval = setInterval(() => {
      setSimStep(prev => {
        if (prev < AGENT_STEPS.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 700);

    try {
      const resp = await fetch('http://localhost:8000/api/simulate/disruption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: simCity,
          area: simArea,
          disruption_type: simType,
          radius_km: 8.0,
        }),
      });

      clearInterval(stepInterval);
      setSimStep(AGENT_STEPS.length - 1);

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.detail || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      await new Promise(r => setTimeout(r, 600));
      setSimResult(data);
    } catch (err) {
      clearInterval(stepInterval);
      setSimError(err.message || 'Simulation failed. Is the backend running on port 8000?');
    } finally {
      setSimRunning(false);
    }
  };

  const resetSimulation = () => {
    setSimResult(null);
    setSimError(null);
    setSimStep(0);
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <h3 className="gradient-text">Analyzing Gig Data...</h3>
      </div>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  const selectedDisruption = DISRUPTION_TYPES.find(d => d.id === simType) || DISRUPTION_TYPES[0];

  // Determine if we show simulated values or live values
  const isSimActive = !!simResult;
  const displayWorkersAtRisk = isSimActive ? simResult.total_workers_in_area : stats.workersAtRisk;
  // Projected Gross Premium = ALL workers' premium from DB (never changes — all workers still pay)
  const displayForecastPremium = stats.forecastPremium;
  const displayForecastPayout = isSimActive ? simResult.total_simulated_payout : stats.forecastPayout;
  // Net margin = total DB premium minus simulated payout (or normal forecast)
  const displayNetProfit = isSimActive
    ? stats.forecastPremium - simResult.total_simulated_payout
    : stats.netProfitForecast;

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header-modern">
        <div className="dh-left">
          <div className="dh-logo-wrap">
            <LayoutDashboard className="dh-logo-icon" size={24} />
          </div>
          <div>
            <h2 className="dh-title">Dashboard</h2>
            <p className="dh-subtitle">Live analytics &amp; performance metrics</p>
          </div>
        </div>
      </div>

      <div className="metrics-strip">
        <div className="metric-item">
          <div className="metric-header">
            <span className="metric-label">Collected Premium</span>
            <DollarSign className="metric-icon text-accent" size={16} />
          </div>
          <div className="metric-value">{formatCurrency(stats.totalPremium)}</div>
          <div className="metric-trend text-success"><TrendingUp size={12} /> +12% this week</div>
        </div>
        <div className="metric-divider"></div>
        <div className="metric-item">
          <div className="metric-header">
            <span className="metric-label">Amount Rolled Out</span>
            <DollarSign className="metric-icon" style={{ color: 'var(--red)' }} size={16} />
          </div>
          <div className="metric-value">{formatCurrency(stats.totalPayout)}</div>
          <div className="metric-trend" style={{ color: 'var(--red)' }}>Auto-disbursed</div>
        </div>
        <div className="metric-divider"></div>
        <div className="metric-item">
          <div className="metric-header">
            <span className="metric-label">Active Coverage</span>
            <Users className="metric-icon text-accent" size={16} />
          </div>
          <div className="metric-value">{stats.totalWorkers} <span className="metric-unit">workers</span></div>
          <div className="metric-trend text-secondary">Across operational regions</div>
        </div>
        <div className="metric-divider"></div>
        <div className="metric-item">
          <div className="metric-header">
            <span className="metric-label">Anomalies Detected</span>
            <AlertTriangle className="metric-icon" style={{ color: 'var(--red)' }} size={16} />
          </div>
          <div className="metric-value">{stats.disruptions} <span className="metric-unit">events</span></div>
          <div className="metric-trend text-secondary">Historical flagged risks</div>
        </div>
      </div>

      {/* ── Predictive Finance Engine Section ── */}
      <div className={`predictive-section glass-panel ${isSimActive ? 'sim-active-panel' : ''}`}>
        <div className="predictive-header">
          <div className="dh-logo-wrap" style={{ width: 36, height: 36 }}>
            <TrendingUp className="text-accent" size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="dh-title" style={{ fontSize: '1.1rem' }}>
              Next Week Predictive Finance Engine
              {isSimActive && (
                <span className="sim-inline-badge">⚡ SIM</span>
              )}
            </h3>
            <p className="dh-subtitle" style={{ fontSize: '0.75rem' }}>
              {isSimActive
                ? `Disruption simulation active — ${simCity} / ${simArea} / ${selectedDisruption.label}`
                : 'AI aggregated projections based on global API monitors'}
            </p>
          </div>

          {/* Simulate Disruption Button */}
          {!simRunning && !isSimActive && (
            <button
              id="simulate-disruption-btn"
              className="simulate-btn"
              onClick={() => setShowSimPanel(v => !v)}
            >
              <Zap size={14} />
              Simulate Disruption
              <ChevronDown size={12} style={{ transition: 'transform 0.2s', transform: showSimPanel ? 'rotate(180deg)' : 'none' }} />
            </button>
          )}

          {isSimActive && (
            <button className="reset-sim-btn" onClick={resetSimulation}>
              <RefreshCw size={13} />
              Reset to Live Data
            </button>
          )}
        </div>

        {/* ── Simulation Config Panel (slide-down) ── */}
        {showSimPanel && !simRunning && !isSimActive && (
          <div className="sim-config-panel animate-fade-in">
            <div className="sim-config-row">
              <div className="sim-config-group">
                <label className="sim-config-label">
                  <MapPin size={12} /> City
                </label>
                <select
                  id="sim-city-select"
                  className="sim-select"
                  value={simCity}
                  onChange={e => setSimCity(e.target.value)}
                >
                  {Object.keys(CITY_AREAS).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="sim-config-group">
                <label className="sim-config-label">
                  <MapPin size={12} /> Area (Geo-filtered)
                </label>
                <select
                  id="sim-area-select"
                  className="sim-select"
                  value={simArea}
                  onChange={e => setSimArea(e.target.value)}
                >
                  {(CITY_AREAS[simCity] || []).map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sim-disruption-types">
              <label className="sim-config-label"><CloudLightning size={12} /> Disruption Type</label>
              <div className="sim-type-grid">
                {DISRUPTION_TYPES.map(dt => (
                  <button
                    key={dt.id}
                    id={`sim-type-${dt.id}`}
                    className={`sim-type-btn ${simType === dt.id ? 'selected' : ''}`}
                    style={simType === dt.id ? { borderColor: dt.color, background: `${dt.color}15`, color: dt.color } : {}}
                    onClick={() => setSimType(dt.id)}
                  >
                    <span className="sim-type-icon">{dt.icon}</span>
                    <span className="sim-type-label">{dt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sim-config-footer">
              <p className="sim-config-hint">
                Workers within <strong>8 km radius</strong> of {simArea} outlet coordinates will be geo-filtered from Supabase and processed by the agent pipeline.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="sim-cancel-btn" onClick={() => setShowSimPanel(false)}>
                  <X size={13} /> Cancel
                </button>
                <button
                  id="run-simulation-btn"
                  className="run-sim-btn"
                  onClick={runSimulation}
                >
                  <Zap size={14} /> Run Simulation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Agent Processing Animation ── */}
        {simRunning && (
          <div className="agents-processing animate-fade-in">
            <div className="agents-orb-wrap">
              <div className="agents-orb">
                <Radar size={40} className="agents-radar-icon" />
                <div className="agents-scan-line"></div>
              </div>
              <div className="agents-pulse-ring"></div>
              <div className="agents-pulse-ring ring2"></div>
            </div>
            <h4 className="agents-title gradient-text">Agents Processing {simCity} / {simArea}</h4>
            <div className="agents-steps">
              {AGENT_STEPS.map((step, i) => (
                <div key={i} className={`agent-step ${i < simStep ? 'done' : i === simStep ? 'active' : 'pending'}`}>
                  <span className="agent-step-dot"></span>
                  <span className="agent-step-text">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Simulation Error ── */}
        {simError && (
          <div className="sim-error-banner animate-fade-in">
            <AlertTriangle size={16} />
            <span>{simError}</span>
            <button onClick={resetSimulation} className="sim-error-close"><X size={14} /></button>
          </div>
        )}

        {/* ── Active Simulation Banner ── */}
        {isSimActive && (
          <div className="sim-active-banner animate-fade-in">
            <div className="sim-banner-left">
              <span className="sim-banner-icon">{selectedDisruption.icon}</span>
              <div>
                <div className="sim-banner-title">⚡ DISRUPTION SIMULATION ACTIVE</div>
                <div className="sim-banner-sub">"{simResult.mock_headline}"</div>
              </div>
            </div>
            <div className="sim-banner-meta">
              <span>{simResult.total_workers_in_area} workers sampled from {simResult.geo_matched ? `within ${simResult.radius_km}km of ` : ''}{simArea}</span>
              <span className="sim-banner-dot">·</span>
              <span>{simResult.workers_eligible_for_payout} eligible for payout (paid premiums + cooling done)</span>
            </div>
          </div>
        )}

        {/* ── Predictive Cards ── */}
        {!isPredicting && !simRunning && (
          <div className="predictive-grid animate-fade-in">
            {/* Workers at Risk */}
            <div className={`pred-card ${isSimActive ? 'pred-card-sim' : ''}`}>
              <span className="pred-label">
                Workers at Risk (Alert Zone)
                {isSimActive && <span className="sim-badge">⚡ SIM</span>}
              </span>
              <div className={`pred-val ${isSimActive ? 'sim-val-amber' : ''}`}>
                {displayWorkersAtRisk}
              </div>
              <div className="pred-sub text-danger">
                {isSimActive
                  ? `${simResult.workers_eligible_for_payout} eligible for payout in ${simArea}`
                  : 'High probability of being in risk zone'}
              </div>
            </div>

            {/* Projected Gross Premium */}
            <div className={`pred-card ${isSimActive ? 'pred-card-sim' : ''}`}>
              <span className="pred-label">
                Projected Gross Premium
                {isSimActive && <span className="sim-badge">⚡ SIM</span>}
              </span>
              <div className={`pred-val ${isSimActive ? 'sim-val-amber' : ''}`}>
                {formatCurrency(displayForecastPremium)}
              </div>
              <div className="pred-sub text-secondary">
                {isSimActive
                  ? `Total collected from all ${stats.totalWorkers} workers (unaffected by disruption)`
                  : 'Based on base rate + seasonal modifiers'}
              </div>
            </div>

            {/* Projected Roll-Outs */}
            <div className={`pred-card ${isSimActive ? 'pred-card-sim' : ''}`}>
              <span className="pred-label">
                Projected Roll-Outs
                {isSimActive && <span className="sim-badge">⚡ SIM</span>}
              </span>
              <div className={`pred-val ${isSimActive ? 'sim-val-payout' : 'text-danger'}`}>
                {formatCurrency(displayForecastPayout)}
              </div>
              <div className="pred-sub text-secondary">
                {isSimActive
                  ? `Agent-decided payouts for ${selectedDisruption.label} scenario`
                  : 'Expected actuarial liability'}
              </div>
            </div>

            {/* Net Profit Forecast */}
            <div className={`pred-card highlight ${isSimActive ? 'pred-card-sim' : ''}`}>
              <span className="pred-label" style={{ color: isSimActive ? 'var(--sim-amber)' : 'var(--text-dark)' }}>
                Net Profit Forecast Margin
                {isSimActive && <span className="sim-badge">⚡ SIM</span>}
              </span>
              <div className={`pred-val ${isSimActive ? (displayNetProfit >= 0 ? 'sim-val-green' : 'sim-val-payout') : (displayNetProfit >= 0 ? 'text-success' : 'text-danger')}`}>
                {formatCurrency(displayNetProfit)}
              </div>
              <div className="pred-sub" style={{ color: 'var(--muted-dark)' }}>
                {isSimActive
                  ? `Total premium − ${simResult.workers_eligible_for_payout} payout claims in ${simArea}`
                  : 'AI derived cycle profitability'}
              </div>
            </div>
          </div>
        )}

        {/* ── Simulated Worker Details Table ── */}
        {isSimActive && simResult.worker_results && simResult.worker_results.length > 0 && (
          <div className="sim-table-container glass-panel animate-fade-in" style={{ marginTop: '1.5rem', padding: '1.25rem', overflowX: 'auto' }}>
            <div className="chart-header" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(107, 45, 139, 0.1)', paddingBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem' }}>Simulated Worker Records ({simResult.worker_results.length})</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: 'var(--muted-dark)', borderBottom: '1px solid rgba(107, 45, 139, 0.1)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Worker ID</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Geo-Location</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Income Context &amp; Loss</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>ML Risk Score</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Eligibility Status</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Final Payout Calculation</th>
                </tr>
              </thead>
              <tbody>
                {simResult.worker_results.filter(w => (w.payout_amount || 0) > 0).map(w => {
                  let riskScore = 'N/A';
                  if (w.ml_predictions && w.ml_predictions.risk_score) {
                    const extracted = w.ml_predictions.risk_score.risk_score;
                    if (extracted !== undefined) {
                      riskScore = Number(extracted).toFixed(2);
                    }
                  }

                  const pb = w.payout_breakdown || {};
                  const isEligible = w.is_eligible;
                  
                  return (
                    <React.Fragment key={w.worker_id}>
                    <tr style={{ borderBottom: '1px solid rgba(107, 45, 139, 0.05)', backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top' }}>
                        <strong style={{ color: 'var(--text-dark)' }}>#{w.worker_id}</strong>
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(107, 45, 139, 0.1)', color: 'var(--purple)', borderRadius: '4px', fontWeight: 600 }}>
                            {w.slab || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top' }}>
                        <span style={{ fontWeight: '500', color: 'var(--text-dark)' }}>{w.city} / {w.area}</span><br />
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted-dark)' }}>{(w.distance_km || 0).toFixed(1)} km from center</span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top' }}>
                        <span style={{ color: 'var(--muted-dark)' }}>Avg:</span> {formatCurrency(w.avg_52week_income || 0)} <br />
                        <span style={{ color: 'var(--muted-dark)' }}>Pred:</span> <span style={{ color: 'var(--text-dark)' }}>{formatCurrency(w.weekly_income_predicted || 0)}</span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: riskScore !== 'N/A' && parseFloat(riskScore) > 0.5 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: riskScore !== 'N/A' && parseFloat(riskScore) > 0.5 ? 'var(--red)' : '#D97706'
                        }}>
                          {riskScore !== 'N/A' ? `${riskScore} Risk factor` : 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top' }}>
                        {isEligible ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ display: 'inline-block', width: 'fit-content', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(13, 122, 86, 0.1)', color: 'var(--green)' }}>Eligible</span>
                            {w.eligibility_reasons && <span style={{ fontSize: '0.7rem', color: 'var(--success)', whiteSpace: 'wrap' }}>{w.eligibility_reasons.join(' • ')}</span>}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ display: 'inline-block', width: 'fit-content', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)' }}>Not Eligible</span>
                            {w.eligibility_reasons && w.eligibility_reasons.map((r, i) => (
                                <span key={i} style={{ fontSize: '0.65rem', color: 'var(--red)', lineHeight: '1.2' }}>• {r}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'top', minWidth: '180px' }}>
                        <strong style={{ color: w.payout_amount > 0 ? 'var(--accent)' : 'var(--muted-dark)', fontSize: '0.95rem' }}>{formatCurrency(w.payout_amount)}</strong>
                        {w.payout_amount > 0 && w.payout_breakdown ? (
                           <div style={{ fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderBottom: '1px solid rgba(107, 45, 139, 0.05)', paddingBottom: '2px' }}>
                                <span style={{ color: 'var(--muted-dark)' }}>Base Coverable:</span>
                                <strong>{formatCurrency(pb.base_coverable_amount || pb.baseline_payout || 0)}</strong>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderBottom: '1px solid rgba(107, 45, 139, 0.05)', paddingBottom: '2px' }}>
                                <span style={{ color: 'var(--muted-dark)' }}>Loyalty Bonus:</span>
                                <strong style={{ color: 'var(--green)' }}>+{(pb.loyalty_bonus_pct || 0) * 100}%</strong>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderBottom: '1px solid rgba(107, 45, 139, 0.05)', paddingBottom: '2px' }}>
                                <span style={{ color: 'var(--muted-dark)' }}>Slab Multiplier:</span>
                                <strong>{(pb.slab_coverage_pct || 0) * 100}%</strong>
                              </div>
                           </div>
                        ) : (
                           <div style={{ fontSize: '0.7rem', color: 'var(--red)', marginTop: '4px', lineHeight: '1.4', background: 'rgba(239, 68, 68, 0.05)', padding: '4px 6px', borderRadius: '4px' }}>
                              ✖ Failed eligibility checks
                           </div>
                        )}
                      </td>
                    </tr>
                    {isEligible && (
                      <tr style={{ background: 'rgba(107, 45, 139, 0.015)' }}>
                        <td colSpan="6" style={{ padding: '0.5rem 1rem 1rem 1rem', borderBottom: '2px solid rgba(107, 45, 139, 0.1)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(107, 45, 139, 0.1)' }}>
                            <div>
                              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--muted-dark)', fontWeight: 600, letterSpacing: '0.5px' }}>Income Forecast</span>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)', marginTop: '2px' }}>{formatCurrency(w.ml_predictions?.income_forecast?.ensemble || w.ml_predictions?.income_forecast || 0)}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '2px' }}>LSTM & SARIMAX output</div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--muted-dark)', fontWeight: 600, letterSpacing: '0.5px' }}>Fraud Prob</span>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: w.ml_predictions?.fraud_analysis?.fraud_probability > 0.3 ? 'var(--red)' : 'var(--text-dark)', marginTop: '2px' }}>
                                {w.ml_predictions?.fraud_analysis?.fraud_probability ? (w.ml_predictions.fraud_analysis.fraud_probability * 100).toFixed(1) + '%' : 'N/A'}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '2px' }}>Trust Rating: {w.ml_predictions?.fraud_analysis?.trust_rating ? (w.ml_predictions?.fraud_analysis?.trust_rating * 100).toFixed(0) + '%' : 'N/A'}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--muted-dark)', fontWeight: 600, letterSpacing: '0.5px' }}>Behavior Score</span>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)', marginTop: '2px' }}>
                                {w.ml_predictions?.behavior_score?.behavior_score ? (w.ml_predictions.behavior_score.behavior_score * 100).toFixed(1) + '%' : 'N/A'}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '2px', textTransform: 'capitalize' }}>Tier: {w.ml_predictions?.behavior_score?.behavior_tier || 'N/A'}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--muted-dark)', fontWeight: 600, letterSpacing: '0.5px' }}>Math Breakdown</span>
                              <div style={{ fontSize: '0.7rem', color: 'var(--purple-dark)', marginTop: '6px', lineHeight: '1.4' }}>
                                {pb.breakdown || pb.explanation_string || "N/A"}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {isPredicting && !simRunning && (
          <div className="ai-scanner-container">
            <div className="ai-scanner-box">
              <Radar className="radar-icon" size={56} />
              <Telescope className="telescope-icon" size={28} />
              <div className="scanning-line"></div>
            </div>
            <h4 className="scanning-text gradient-text">Executing AI Models to Predict Next Week's Scenarios...</h4>
            <p className="scanning-sub">Analyzing global meteorological grids and anomaly parameters</p>
          </div>
        )}
      </div>

      <div className="charts-grid">
        <div className="chart-container glass-panel" style={{ padding: '1.25rem' }}>
          <div className="chart-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <h3>Financial Health &amp; Profitability Outlook</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-dark)' }}>Comparing our actual profit margins against predicted risk thresholds.</p>
          </div>
          <div style={{ height: '320px', paddingRight: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.lossRatioData}>
                <defs>
                  <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--green)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,45,139,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-dark)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis domain={[90, 100]} stroke="var(--muted-dark)" tickFormatter={(v) => `${v}%`} fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface-dark)', borderColor: 'var(--border-dark)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-dark)' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)' }}
                />
                <Area type="monotone" dataKey="margin" stroke="var(--green)" strokeWidth={3} fillOpacity={1} fill="url(#colorMargin)" name="Net Profit Margin %" />
                <Area type="monotone" dataKey="risk" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" name="Risk Sensitivity Index" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-container glass-panel" style={{ padding: '1.25rem' }}>
          <div className="chart-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <h3>Slab Distribution</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-dark)' }}>See exactly which insurance tiers our workers prefer!</p>
          </div>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.slabDistribution} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} stroke="none" dataKey="value">
                  {stats.slabDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface-dark)', borderColor: 'var(--border-dark)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-dark)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: 'var(--muted-dark)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="charts-grid" style={{ marginTop: '1.5rem', gridTemplateColumns: '1.5fr 1fr' }}>
        <div className="chart-container glass-panel" style={{ padding: '1.25rem', minHeight: '300px' }}>
          <div className="chart-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <h3>Active Disruption Profiler</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-dark)' }}>Here's a breakdown of exactly what's causing active anomalies!</p>
          </div>
          <div style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.disruptionTypeData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,45,139,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-dark)" fontSize={12} tickLine={false} axisLine={false} dy={5} />
                <YAxis stroke="var(--muted-dark)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} dx={-5} />
                <Tooltip cursor={{ fill: 'rgba(107, 45, 139, 0.1)' }} contentStyle={{ backgroundColor: 'var(--surface-dark)', borderColor: 'var(--border-dark)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-dark)' }} />
                <Bar dataKey="Anomalies" fill="var(--accent)" radius={[4, 4, 0, 0]}>
                  {stats.disruptionTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-container glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '300px' }}>
          <div className="chart-header" style={{ marginBottom: '0.5rem' }}>
            <h3>Prediction AI Architecture</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-dark)', lineHeight: '1.6' }}>
            Wondering how we predict these numbers? Our sophisticated LangChain <strong>MonitorAgent</strong> continuously scans global weather and news APIs for upcoming disruptions, while parallel agents verify worker geo-location patterns.
          </p>
          <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(107, 45, 139, 0.05)', borderRadius: '8px', border: '1px solid rgba(107, 45, 139, 0.1)' }}>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--purple-dark)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} className="text-accent" /> Actuarial Machine Learning
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-dark)', lineHeight: '1.5' }}>
              Instead of guessing, an array of 6 Deep Learning pipelines runs the math! An <strong style={{ color: 'var(--text-dark)' }}>LSTM Model</strong> forecasts each worker's weekly baseline income, while an <strong style={{ color: 'var(--text-dark)' }}>XGBoost</strong> model calculates the exact financial loss radius when a specific disruption impacts their city.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
