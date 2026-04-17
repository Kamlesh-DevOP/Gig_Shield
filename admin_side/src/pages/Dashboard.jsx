import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, AlertTriangle, Users, DollarSign, LayoutDashboard, Telescope, Radar, Zap, X, RefreshCw, MapPin, CloudLightning, ChevronDown, Satellite, Activity, Wifi, WifiOff } from 'lucide-react';

const COLORS = ['#6B2D8B', '#C4A8E0', '#5B21B6', '#0D7A56', '#B91C1C'];

const CITY_AREAS = {
  "Bengaluru": ["BTM Layout", "Electronic City", "Indiranagar"],
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

const MCP_SCAN_STEPS = [
  "Connecting to MCP Layer (port 5100)...",
  "Polling all 10 covered cities in parallel...",
  "Analyzing live NewsAPI + Tavily feeds...",
  "Identifying disrupted cities from real news...",
  "Fetching affected workers from Supabase...",
  "Running Classic Orchestrator per worker (no overrides)...",
  "Aggregating real-time risk intelligence...",
];

const RISK_LEVEL_CONFIG = {
  LOW: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  MEDIUM: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  HIGH: { color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
  CRITICAL: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
};

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
  const [simArea, setSimArea] = useState("BTM Layout");
  const [simType, setSimType] = useState("flood");
  const [simRunning, setSimRunning] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState(null);

  // Live MCP Scan state
  const [mcpScanRunning, setMcpScanRunning] = useState(false);
  const [mcpScanStep, setMcpScanStep] = useState(0);
  const [mcpScanResult, setMcpScanResult] = useState(null);
  const [mcpScanError, setMcpScanError] = useState(null);
  const hasTriggeredScan = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setIsPredicting(true); // Ensure scanner shows during agent analysis

        // 1. Fetch current status from Supabase (Historical/Current)
        const { data: workers, error: workerErr } = await supabase
          .from('gic_workers')
          .select('record, ingested_at');

        if (workerErr) throw workerErr;

        let premiumSum = 0;
        let payoutSum = 0;
        let slabCounts = {};
        let disruptionCount = 0;
        let disruptionTypeMap = {};

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
        });

        const slabPieData = Object.keys(slabCounts)
          .filter(k => k && k !== 'Unknown' && k !== 'null')
          .map(key => ({ name: key, value: slabCounts[key] }));
        
        const disruptionBarsData = Object.keys(disruptionTypeMap).map(key => ({ name: key, Anomalies: disruptionTypeMap[key] }));

        // 1b. Update Stats with Baseline Data (Foreground)
        setStats(prev => {
          const baselinePremium = premiumSum * 0.95;
          const baselinePayout = payoutSum * 1.1;
          const baselineMargin = (100 - (baselinePayout / (baselinePremium || 1)) * 100).toFixed(1);
          const baselineRisk = ((disruptionCount / Math.max(workers.length, 1)) * 100).toFixed(1);

          return {
            ...prev,
            totalWorkers: workers.length,
            totalPremium: premiumSum,
            totalPayout: payoutSum,
            disruptions: disruptionCount,
            slabDistribution: slabPieData,
            disruptionTypeData: disruptionBarsData,
            // Baseline/Statistical fallback values
            forecastPremium: baselinePremium,
            forecastPayout: baselinePayout,
            workersAtRisk: disruptionCount,
            netProfitForecast: baselinePremium - baselinePayout,
            lossRatioData: [
              { name: 'Baseline', margin: parseFloat(baselineMargin), risk: parseFloat(baselineRisk) }
            ]
          };
        });

        setLoading(false);

        // 2. Background Task: Trigger Live Pulse Scan (Interactive Steps)
        if (!hasTriggeredScan.current) {
          runMcpScan();
          hasTriggeredScan.current = true;
        }

        // 3. Background Task: Fetch AI Predictive Analysis (Non-blocking)
        setIsPredicting(true);
        try {
          const backendUrl = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8000';
          const forecastResp = await fetch(`${backendUrl}/api/forecast/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          if (forecastResp.ok) {
            const forecastResults = await forecastResp.json();
            
            setStats(prev => {
              const nextWeekMargin = (100 - (forecastResults.total_payout_liability / (forecastResults.total_premium || 1)) * 100).toFixed(1);
              const nextWeekRisk = ((forecastResults.workers_at_risk / Math.max(workers.length, 1)) * 100).toFixed(1);
              const thisWeekMargin = (100 - (payoutSum / (premiumSum || 1)) * 100).toFixed(1);
              const thisWeekRisk = ((disruptionCount / Math.max(workers.length, 1)) * 100).toFixed(1);

              return {
                ...prev,
                lossRatioData: [
                  { name: 'This Week', margin: parseFloat(thisWeekMargin), risk: parseFloat(thisWeekRisk) },
                  { name: 'Next Week', margin: parseFloat(nextWeekMargin), risk: parseFloat(nextWeekRisk) }
                ],
                forecastPremium: forecastResults.total_premium,
                forecastPayout: forecastResults.total_payout_liability,
                workersAtRisk: forecastResults.workers_at_risk,
                netProfitForecast: forecastResults.net_margin_forecast
              };
            });
          }
        } catch (fErr) {
          console.warn("Forecast API unavailable:", fErr);
        } finally {
          setIsPredicting(false);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setLoading(false);
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
      const backendUrl = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8000';
      const resp = await fetch(`${backendUrl}/api/simulate/disruption`, {
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

  const runMcpScan = async () => {
    setMcpScanRunning(true);
    setMcpScanResult(null);
    setMcpScanError(null);
    setSimResult(null); // clear any active simulation
    setShowSimPanel(false);
    setMcpScanStep(0);

    const stepInterval = setInterval(() => {
      setMcpScanStep(prev => {
        if (prev < MCP_SCAN_STEPS.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 900);

    try {
      const backendUrl = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8000';
      const resp = await fetch(`${backendUrl}/api/live/detect-disruptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      clearInterval(stepInterval);
      setMcpScanStep(MCP_SCAN_STEPS.length - 1);
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.detail || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      await new Promise(r => setTimeout(r, 500));
      setMcpScanResult(data);
    } catch (err) {
      clearInterval(stepInterval);
      setMcpScanError(err.message || 'MCP scan failed. Is the backend running on port 8000?');
    } finally {
      setMcpScanRunning(false);
    }
  };

  const resetMcpScan = () => {
    setMcpScanResult(null);
    setMcpScanError(null);
    setMcpScanStep(0);
  };

  useEffect(() => {
    // Automatically trigger MCP scan right after component mounts
    // Use ref guard to prevent double-triggering in strict mode or re-renders
    if (!hasTriggeredScan.current) {
      runMcpScan();
      hasTriggeredScan.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Determine which data source is active
  const isSimActive = !!simResult;
  const isMcpActive = !!mcpScanResult;
  const isMcpFallback = isMcpActive && mcpScanResult.fallback;

  // Workers at Risk: SIM → MCP → Supabase baseline
  const displayWorkersAtRisk = isSimActive
    ? simResult.total_workers_in_area
    : isMcpActive
      ? mcpScanResult.total_workers_affected
      : stats.workersAtRisk;

  // ── Derived Predictive Metrics for Dashboard Cards ──
  
  // 1. Forecasted Premium context
  const displayForecastPremium = isSimActive 
    ? stats.forecastPremium // In Simulation, we use the baseline premium
    : isMcpActive 
      ? mcpScanResult.total_all_premium 
      : stats.forecastPremium;

  // 2. Real-time/Active Payout Decisions (This is what determines 'Live Net Margin')
  const displayRealTimePayout = isSimActive 
    ? simResult.total_simulated_payout 
    : isMcpActive 
      ? mcpScanResult.total_payout_computed 
      : 0; // If no active event, payout is 0

  // 3. Projected Payout (For secondary logic)
  const displayForecastPayout = isSimActive 
    ? simResult.total_simulated_payout 
    : isMcpActive 
      ? mcpScanResult.total_payout_computed 
      : stats.forecastPayout;

  // 4. Net margin = Gross Premium − Payout (Mathematically consistent fallback)
  const displayNetProfit = displayForecastPremium - displayRealTimePayout;

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header-modern">
        <div className="dh-left">
          <div className="dh-logo-wrap">
            <LayoutDashboard className="dh-logo-icon" size={24} />
          </div>
          <div>
            <h2 className="dh-title">Admin Dashboard</h2>
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

      {/* ── Section 1: Live Disruption Monitor (Current) ── */}
      <div className={`predictive-section glass-panel ${isSimActive ? 'sim-active-panel' : ''}`} style={{ marginBottom: '2rem' }}>
        <div className="predictive-header">
          <div className="dh-logo-wrap" style={{ width: 36, height: 36, background: 'rgba(239, 68, 68, 0.1)' }}>
            <Activity className="text-danger" size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="dh-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Current Week: Live Disruption Monitor
              {isSimActive && (
                <span className="sim-inline-badge">⚡ SIM</span>
              )}
              {isMcpActive && !isMcpFallback && !isSimActive && (
                <span className="sim-inline-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>🛰️ LIVE RISK ({mcpScanResult.disruptions_detected} EVENTS)</span>
              )}
            </h3>
            <p className="dh-subtitle" style={{ fontSize: '0.75rem' }}>
              Real-time response layer polling external signals and simulation parameters
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!simRunning && !isSimActive && !mcpScanRunning && (
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
                Clear Simulation
              </button>
            )}
          </div>
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

        {/* ── LIVE MCP Scan Animation ── */}
        {mcpScanRunning && !simRunning && (
          <div className="agents-processing animate-fade-in" style={{ borderColor: 'var(--purple)' }}>
            <div className="agents-orb-wrap">
              <div className="agents-orb" style={{ background: 'var(--purple-dark)' }}>
                <Satellite size={40} className="agents-radar-icon" style={{ color: '#fff' }} />
                <div className="agents-scan-line" style={{ background: 'linear-gradient(to bottom, transparent, var(--purple))' }}></div>
              </div>
              <div className="agents-pulse-ring" style={{ borderColor: 'var(--purple)' }}></div>
              <div className="agents-pulse-ring ring2" style={{ borderColor: 'var(--purple)' }}></div>
            </div>
            <h4 className="agents-title gradient-text">Live MCP Disruption Scan in Progress</h4>
            <div className="agents-steps">
              {MCP_SCAN_STEPS.map((step, i) => (
                <div key={i} className={`agent-step ${i < mcpScanStep ? 'done' : i === mcpScanStep ? 'active' : 'pending'}`}>
                  <span className="agent-step-dot" style={i <= mcpScanStep ? { background: 'var(--purple)' } : {}}></span>
                  <span className="agent-step-text">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Error Banners ── */}
        {simError && (
          <div className="sim-error-banner animate-fade-in">
            <AlertTriangle size={16} />
            <span>{simError}</span>
            <button onClick={resetSimulation} className="sim-error-close"><X size={14} /></button>
          </div>
        )}
        {mcpScanError && !isSimActive && (
          <div className="sim-error-banner animate-fade-in" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <WifiOff size={16} />
              <span>{mcpScanError}</span>
            </div>
            <button onClick={resetMcpScan} className="sim-error-close"><X size={14} /></button>
          </div>
        )}

        {/* ── Real-time Analytics Dashboard (Only shown when results are ready) ── */}
        {!mcpScanRunning && !simRunning && (
          <>
            <div className="predictive-grid animate-fade-in" style={{ marginTop: '1.5rem' }}>
              {/* Workers Affected (Real-time) */}
              <div className={`pred-card ${isSimActive ? 'pred-card-sim' : isMcpActive && !isMcpFallback ? 'pred-card-live' : ''}`}>
                <span className="pred-label">
                  Workers Affected (Real-time)
                  {isSimActive && <span className="sim-badge">⚡ SIM</span>}
                  {isMcpActive && !isMcpFallback && !isSimActive && <span className="sim-badge" style={{ background: 'var(--red)', color: '#fff' }}>🛰️ LIVE</span>}
                </span>
                <div className={`pred-val ${isSimActive ? 'sim-val-amber' : isMcpActive && !isMcpFallback ? 'text-danger' : ''}`}>
                  {isSimActive ? simResult.total_workers_in_area : isMcpActive ? mcpScanResult.total_workers_affected : 0}
                </div>
                <div className="pred-sub text-danger">
                  {isSimActive
                    ? `${simResult.workers_eligible_for_payout} eligible for payout in ${simArea}`
                    : isMcpActive && !isMcpFallback
                      ? `Detected across ${mcpScanResult.disruptions_detected} active disruption zones`
                      : 'No active disruption triggers detected'}
                </div>
              </div>

              {/* Premium Context (Real-time) */}
              <div className={`pred-card ${isSimActive ? 'pred-card-sim' : isMcpActive && !isMcpFallback ? 'pred-card-live' : ''}`}>
                <span className="pred-label">
                  Premium Collected (Live Context)
                  {isSimActive && <span className="sim-badge">⚡ SIM</span>}
                  {isMcpActive && !isMcpFallback && !isSimActive && <span className="sim-badge" style={{ background: 'var(--red)', color: '#fff' }}>🛰️ LIVE</span>}
                </span>
                <div className="pred-val text-accent">
                  {formatCurrency(displayForecastPremium)}
                </div>
                <div className="pred-sub text-secondary">
                  Total premium baseline for {stats.totalWorkers} workers
                </div>
              </div>

              {/* Real-time Payout (Disbursement) */}
              <div className={`pred-card ${isSimActive ? 'pred-card-sim' : isMcpActive && !isMcpFallback ? 'pred-card-live' : ''}`}>
                <span className="pred-label">
                  Real-time Payout Calculation
                  {isSimActive && <span className="sim-badge">⚡ SIM</span>}
                  {isMcpActive && !isMcpFallback && !isSimActive && <span className="sim-badge" style={{ background: 'var(--red)', color: '#fff' }}>🛰️ LIVE</span>}
                </span>
                <div className={`pred-val ${isSimActive ? 'sim-val-payout' : (isMcpActive && !isMcpFallback) ? 'text-danger' : ''}`}>
                  {formatCurrency(displayRealTimePayout)}
                </div>
                <div className="pred-sub text-secondary">
                  {isSimActive
                    ? `Agent-decided payouts for ${selectedDisruption.label} scenario`
                    : isMcpActive && !isMcpFallback
                      ? 'Computed agent decisions for live disruptions'
                      : 'Awaiting event trigger...'}
                </div>
              </div>

              {/* Real-time Net Margin */}
              <div className={`pred-card ${isSimActive ? 'pred-card-sim' : isMcpActive && !isMcpFallback ? 'pred-card-live' : ''}`}>
                <span className="pred-label text-success">
                  Live Net Margin
                  {isSimActive && <span className="sim-badge">⚡ SIM</span>}
                </span>
                <div className={`pred-val ${displayNetProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(displayNetProfit)}
                </div>
                <div className="pred-sub text-secondary">
                  Profit after accounting for live/simulated events
                </div>
              </div>
            </div>

            {/* ── Simulated or Real Worker Details Table ── */}
            {((isSimActive && simResult.worker_results && simResult.worker_results.length > 0) || (isMcpActive && !isMcpFallback && !isSimActive && mcpScanResult.disruptions_detected > 0 && mcpScanResult.city_results.some(c => c.worker_results.length > 0))) && (
              <div className="sim-table-container glass-panel animate-fade-in" style={{ marginTop: '0', marginBottom: '2rem', padding: '1.25rem', overflowX: 'auto' }}>
                <div className="chart-header" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(107, 45, 139, 0.1)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isSimActive ? <Zap size={16} className="text-accent" /> : <Activity size={16} style={{ color: 'var(--red)' }} />}
                    {isSimActive
                      ? `Simulated Worker Records (${simResult.worker_results.length})`
                      : `Real MCP-Triggered Workers (${mcpScanResult.city_results.reduce((acc, c) => acc + c.worker_results.length, 0)})`}
                  </h3>
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
                    {(isSimActive ? simResult.worker_results : mcpScanResult.city_results.flatMap(c => c.worker_results)).filter(w => (w.payout_amount || 0) > 0).map(w => {
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
          </>
        )}
      </div>

      {/* ── Section 2: ML-Driven Weekly Forecast (Next Week) ── */}
      <div className="predictive-section glass-panel" style={{ background: 'linear-gradient(135deg, rgba(107, 45, 139, 0.02) 0%, rgba(255, 255, 255, 0.05) 100%)' }}>
        <div className="predictive-header">
          <div className="dh-logo-wrap" style={{ width: 36, height: 36, background: 'rgba(107, 45, 139, 0.1)' }}>
            <TrendingUp className="text-secondary" size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="dh-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Next Week: Multi-Model Predictive Analysis
              <span className="sim-inline-badge" style={{ background: 'rgba(107, 45, 139, 0.1)', color: 'var(--purple)', border: '1px solid rgba(107, 45, 139, 0.3)' }}>🤖 ML-DRIVEN</span>
            </h3>
            <p className="dh-subtitle" style={{ fontSize: '0.75rem' }}>
              Portfolio-wide statistical projections derived from baseline worker records and historical ML scores
            </p>
          </div>
        </div>

        {!isPredicting ? (
          <div className="predictive-grid animate-fade-in" style={{ marginTop: '1rem' }}>
            {/* Baseline Workers at Risk */}
            <div className="pred-card">
              <span className="pred-label">Projected Workers at Risk (Statistical)</span>
              <div className="pred-val text-warning">
                {stats.workersAtRisk}
              </div>
              <div className="pred-sub text-secondary">
                High probability based on ML risk scores and occupation history
              </div>
            </div>

            {/* Expected Gross Premium */}
            <div className="pred-card">
              <span className="pred-label">Projected Weekly Revenue (Premium)</span>
              <div className="pred-val text-accent">
                {formatCurrency(stats.forecastPremium)}
              </div>
              <div className="pred-sub text-secondary">
                Calculated across all {stats.totalWorkers} active workers for next cycle
              </div>
            </div>

            {/* Actuarial Payout Liability */}
            <div className="pred-card">
              <span className="pred-label">Actuarial Payout Liability (Next Cycle)</span>
              <div className="pred-val text-danger">
                {formatCurrency(stats.forecastPayout)}
              </div>
              <div className="pred-sub text-secondary">
                Predicted liability based on forecasted income & loss probability
              </div>
            </div>

            {/* Net Profit Forecast Margin */}
            <div className="pred-card highlight-purple">
              <span className="pred-label" style={{ color: 'var(--purple-dark)' }}>Next Week Net Margin Forecast</span>
              <div className={`pred-val ${stats.netProfitForecast >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(stats.netProfitForecast)}
              </div>
              <div className="pred-sub" style={{ color: 'var(--muted-dark)' }}>
                Statistical yield after accounting for expected model anomalies
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── AI Scanner Animation (Prominent) ── */}
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
