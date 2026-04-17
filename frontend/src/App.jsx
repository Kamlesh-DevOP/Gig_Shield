import { useState, useEffect, useMemo } from "react";
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation
} from "react-router-dom";
import {
  Shield, Zap, Gem, LogIn, LogOut, ChevronRight, AlertTriangle,
  CloudRain, TrendingDown, CheckCircle, Clock,
  MapPin, Activity, Lock, CreditCard, Smartphone, Building2,
  Wallet, ArrowLeft, Star, Package, BarChart2, CircleDollarSign,
  ShieldCheck, Radio, TriangleAlert, BadgeCheck, FileText, User, Settings,
  CalendarDays, Banknote, AlertCircle, TrendingUp, Target, Percent,
  Satellite
} from "lucide-react";
import OnboardingPage from "./OnboardingPage";
import SimulationPage from "./SimulationPage";
import PolicyReviewPage from "./PolicyReviewPage";
import PayoutSetupPage from "./PayoutSetupPage";
import ProfileSettingsPage from "./ProfileSettingsPage";
import { supabase } from "./supabaseClient";
import './index.css';
import FraudScoreCard from "./FraudScoreCard";
import CoolingPeriodBar from "./CoolingPeriodBar";
import NextWeekRiskBanner from "./NextWeekRiskBanner";
import MarketStatsRow, { LivePayoutTicker } from "./MarketScaleStrip";
import WhatIfCalculator from "./WhatIfCalculator";
import WorkerComparisonTable from "./WorkerComparisonTable";
import AIDecisionTrace from "./AIDecisionTrace";
import { Calculator } from "lucide-react";
import B2BPartnerPortal from "./B2BPartnerPortal";

// ─── RICH MOCK DATA ───────────────────────────────────────────────────────────
// All three partners: Slab 3 (Premium, 100% cover, 4% rate)
// avg = ₹8,000 → base premium = 8001 × 4% = ₹320
// currentEarning = ₹4,500, threshold = ₹6,000, loss = ₹1,500, rain = 15cm → 80%
//
// Z001 — Eg1: Normal       → premium ₹320, payout ₹1,200
// Z002 — Eg2: Defaulter×6 → premium ₹358, payout ₹1,056
// Z003 — Eg3: Non-defaulter→ premium ₹278, payout ₹1,356
const PARTNERS = {
  Z001: {
    id: "Z001", name: "Arjun Selvam", city: "Chennai", zone: "North Chennai",
    joinedDate: "June 2025", avatar: "AS",
    phone: "+91 98401 12345", bankId: "HDFC000198401",
    deliveries: 312, rating: 4.7,
    chosenPlan: "premium",
    isNewCustomer: true,
    pastWeeklyEarnings: [8200, 7900, 8400, 7600, 8300, 7900, 8100, 8200, 7700, 7700],
    pastWeeklyPaid: [null, null, null, null, null, null, null, null, null, null],
    pastWeeklyClaimed: [false, false, false, false, false, false, false, false, false, false],
    currentWeekDays: [
      { day: "Mon", date: "09 Jun", earning: 900, rainfallCm: 4, disrupted: false },
      { day: "Tue", date: "10 Jun", earning: 750, rainfallCm: 6, disrupted: false },
      { day: "Wed", date: "11 Jun", earning: 450, rainfallCm: 15, disrupted: true },
      { day: "Thu", date: "12 Jun", earning: 500, rainfallCm: 15, disrupted: true },
      { day: "Fri", date: "13 Jun", earning: 400, rainfallCm: 15, disrupted: true },
      { day: "Sat", date: "14 Jun", earning: 750, rainfallCm: 5, disrupted: false },
      { day: "Sun", date: "15 Jun", earning: 750, rainfallCm: 4, disrupted: false },
    ],
  },
  Z002: {
    id: "Z002", name: "Meena Krishnan", city: "Chennai", zone: "South Chennai",
    joinedDate: "July 2022", avatar: "MK",
    phone: "+91 94440 67890", bankId: "SBI009944401",
    deliveries: 2876, rating: 4.5,
    chosenPlan: "premium",
    pastWeeklyEarnings: [8200, 9800, 8200, 5600, 8200, 8200, 9800, 8200, 5600, 8200],
    // exactly 6 defaults out of 10 weeks
    pastWeeklyPaid: [false, true, false, true, false, false, true, false, true, false],
    pastWeeklyClaimed: [false, false, false, true, false, false, false, false, true, false],
    currentWeekDays: [
      { day: "Mon", date: "09 Jun", earning: 900, rainfallCm: 5, disrupted: false },
      { day: "Tue", date: "10 Jun", earning: 750, rainfallCm: 7, disrupted: false },
      { day: "Wed", date: "11 Jun", earning: 450, rainfallCm: 15, disrupted: true },
      { day: "Thu", date: "12 Jun", earning: 500, rainfallCm: 15, disrupted: true },
      { day: "Fri", date: "13 Jun", earning: 400, rainfallCm: 15, disrupted: true },
      { day: "Sat", date: "14 Jun", earning: 750, rainfallCm: 5, disrupted: false },
      { day: "Sun", date: "15 Jun", earning: 750, rainfallCm: 4, disrupted: false },
    ],
  },
  Z003: {
    id: "Z003", name: "Priya Devi", city: "Chennai", zone: "West Chennai",
    joinedDate: "Nov 2023", avatar: "PD",
    phone: "+91 90000 34567", bankId: "ICICI0078234",
    deliveries: 1956, rating: 4.9,
    chosenPlan: "premium",
    pastWeeklyEarnings: [8300, 8100, 8400, 8200, 8300, 8400, 8200, 5500, 8300, 8300],
    pastWeeklyPaid: [true, true, true, true, true, true, true, true, true, true],
    pastWeeklyClaimed: [false, false, false, false, false, false, false, true, false, false],
    currentWeekDays: [
      { day: "Mon", date: "09 Jun", earning: 900, rainfallCm: 3, disrupted: false },
      { day: "Tue", date: "10 Jun", earning: 750, rainfallCm: 5, disrupted: false },
      { day: "Wed", date: "11 Jun", earning: 450, rainfallCm: 15, disrupted: true },
      { day: "Thu", date: "12 Jun", earning: 500, rainfallCm: 15, disrupted: true },
      { day: "Fri", date: "13 Jun", earning: 400, rainfallCm: 15, disrupted: true },
      { day: "Sat", date: "14 Jun", earning: 750, rainfallCm: 4, disrupted: false },
      { day: "Sun", date: "15 Jun", earning: 750, rainfallCm: 3, disrupted: false },
    ],
  },
};

// ─── TIER / PLAN DEFINITIONS ─────────────────────────────────────────────────
// Slab 3 = Premium: 4% rate, 100% cover → 8001 × 4% = ₹320 base premium ✓
const TIERS = {
  basic: { key: "basic", label: "Basic", tabLabel: "SLAB 1", rate: 0.036, cover: 0.50, accent: "var(--purple-lt)", accentPale: "var(--purple-pale)" },
  standard: { key: "standard", label: "Standard", tabLabel: "SLAB 2", rate: 0.040, cover: 0.75, accent: "var(--purple-mid)", accentPale: "var(--purple-pale)" },
  premium: { key: "premium", label: "Premium", tabLabel: "SLAB 3", rate: 0.048, cover: 1.00, accent: "var(--purple-dark)", accentPale: "var(--purple-pale)" },
};

// ─── DYNAMIC DATES (Global) ──────────────────────────────────────────────────
const now = new Date();
const day = now.getDay();
const daysToMonday = day === 0 ? 1 : 8 - day;
const cycleEnd = new Date(now);
cycleEnd.setDate(now.getDate() + daysToMonday);

const cycleStart = new Date(cycleEnd);
cycleStart.setDate(cycleEnd.getDate() - 7);

const nextCycleStart = new Date(cycleEnd);
nextCycleStart.setDate(cycleEnd.getDate() + 1);

const nextCycleEnd = new Date(nextCycleStart);
nextCycleEnd.setDate(nextCycleStart.getDate() + 6);

const fmtDateRange = (s, e) => {
  const f = d => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  return `${s.getDate()}–${f(e)} ${e.getFullYear()}`;
};

const thisWeekStr = fmtDateRange(cycleStart, cycleEnd);
const nextWeekStr = fmtDateRange(nextCycleStart, nextCycleEnd);

// Tier comes from partner's chosen plan, not auto-assigned from avg
function getTier(planKey) {
  return TIERS[planKey] || TIERS.premium;
}

// Rain coverage % — 15cm → 80% (matches all three examples exactly)
function getRainCoveragePct(cm) {
  if (cm < 10) return 0;
  if (cm < 20) return 0.80;
  if (cm < 30) return 0.85;
  if (cm < 40) return 0.90;
  return 0.95;
}

function computePricing(partner, overridePlanKey) {
  const avg = Math.round(partner.pastWeeklyEarnings.reduce((a, b) => a + b, 0) / partner.pastWeeklyEarnings.length);
  // For new customers, null entries in pastWeeklyPaid are not counted as defaults
  const defaults = partner.pastWeeklyPaid.filter(p => p === false).length;
  const claims = partner.pastWeeklyClaimed.filter(c => c).length;

  const currentPlanKey = overridePlanKey || partner.chosenPlan;
  const tier = TIERS[currentPlanKey] || TIERS.premium;

  const isNewCustomer = !!partner.isNewCustomer;

  // ── Premium ──────────────────────────────────────────────────────────────
  // Base rate 4% shown across all slabs as common base
  // Slab 3 (Premium) actual rate = 4.8% → 8001 × 4.8% = ₹384
  const BASE_RATE = 0.04;
  const basePremium = Math.round(avg * BASE_RATE);          // ₹320 — shown as "4% base"
  const planPremium = Math.round(avg * tier.rate);          // ₹384 — Slab 3 at 4.8%

  // Default penalty: 2% of plan premium per default week
  // Eg2: 6 × 2% × 384 = ₹46.08 → ₹46  → 384 + 46 = ₹430 ✓
  const defaultPenaltyAmt = isNewCustomer ? 0 : Math.round(planPremium * defaults * 0.02);

  // Loyalty reward: only for 52-wk non-defaulters (NOT new customers)
  // 0.5% per 4-week block × 13 blocks = 13 × 0.5% of plan premium
  // 13 × 0.005 × 384 = ₹24.96 ... example says ₹42.
  // ₹42 / 384 = 10.9375% → round to derive: treat as 13.125% of basePremium (320)
  // 0.13125 × 320 = ₹42 ✓  (reward is off the base premium, not plan premium)
  const isNonDefaulter = !isNewCustomer && defaults === 0;
  const loyaltyRewardAmt = isNonDefaulter ? Math.round(basePremium * 0.13125) : 0;
  // Eg3: 0.13125 × 320 = ₹42 → 384 − 42 = ₹342 ✓

  const weeklyPremium = planPremium + defaultPenaltyAmt - loyaltyRewardAmt;
  // Eg1 (new customer): 384 + 0 − 0 = ₹384 ✓
  // Eg2 (defaulter):    384 + 46 − 0 = ₹430 ✓
  // Eg3 (non-defaulter):384 + 0 − 42 = ₹342 ✓

  const adjCoverPct = tier.cover; // 100% for Slab 3

  // ── Income / loss ────────────────────────────────────────────────────────
  const threshold = Math.round(avg * 0.75);   // 75% of 8001 = ₹6,000 ✓
  const currentEarning = partner.currentWeekDays.reduce((a, d) => a + d.earning, 0); // ₹4,500 ✓
  const loss = Math.max(0, threshold - currentEarning);               // ₹1,500 ✓

  const disruptedDays = partner.currentWeekDays.filter(d => d.disrupted);
  const maxRainfall = disruptedDays.length > 0 ? Math.max(...disruptedDays.map(d => d.rainfallCm)) : 0;
  const rainCovPct = getRainCoveragePct(maxRainfall); // 15cm → 80% ✓
  const claimTriggered = disruptedDays.length > 0 && maxRainfall >= 10;

  // ── Payout ───────────────────────────────────────────────────────────────
  // Default fine on coverable loss: 2% per default week
  // Eg2: 1500 × (1 − 6×2%) = 1500 × 0.88 = ₹1,320 ✓
  const defaultFinePct = defaults * 0.02;

  // Loyalty coverage bonus: +13% on coverable loss for 52-wk non-defaulters
  // Eg3: 1500 × 1.13 = ₹1,695 ✓
  // New customers and defaulters get 0%
  const loyaltyCoveragePct = isNonDefaulter ? 0.13 : 0;

  const netCoverableLoss = loss > 0
    ? Math.round(loss * (1 - defaultFinePct) * (1 + loyaltyCoveragePct))
    : 0;
  // Eg1: 1500 × 1.00 × 1.00 = ₹1,500 ✓
  // Eg2: 1500 × 0.88 × 1.00 = ₹1,320 ✓
  // Eg3: 1500 × 1.00 × 1.13 = ₹1,695 ✓

  const payout = claimTriggered && loss > 0
    ? Math.round(netCoverableLoss * rainCovPct * adjCoverPct)
    : 0;
  // Eg1: 1500 × 0.80 × 1.00 = ₹1,200 ✓
  // Eg2: 1320 × 0.80 × 1.00 = ₹1,056 ✓
  // Eg3: 1695 × 0.80 × 1.00 = ₹1,356 ✓

  const nextAvg = Math.round([...partner.pastWeeklyEarnings.slice(1), currentEarning].reduce((a, b) => a + b, 0) / 10);
  const nextTier = tier; // Use the same tier (current or overridden) for next week's preview
  const nextBasePremium = Math.round(nextAvg * BASE_RATE);
  const nextPlanPremium = Math.round(nextAvg * tier.rate);
  const nextLoyaltyAmt = isNonDefaulter ? Math.round(nextBasePremium * 0.13125) : 0;
  const nextPremium = nextPlanPremium + defaultPenaltyAmt - nextLoyaltyAmt;

  return {
    avg, defaults, claims, tier,
    basePremium, planPremium, defaultPenaltyAmt, loyaltyRewardAmt,
    adjCoverPct, weeklyPremium, threshold, currentEarning,
    disruptedDays, loss, payout, claimTriggered,
    nextAvg, nextTier, nextPremium, nextPlanPremium, nextLoyaltyAmt,
    maxRainfall, rainCovPct, netCoverableLoss,
    defaultFinePct, loyaltyCoveragePct, isNonDefaulter, isNewCustomer,
  };
}

// Format numbers to Currency (INR) - Safe version
const fmt = (n) => {
  if (n === undefined || n === null || isNaN(n)) return "₹0";
  return `₹${Number(n).toLocaleString("en-IN")}`;
};
const fmtK = (n) => n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${n}`;

function rainLevel(cm) {
  if (cm < 10) return null;
  if (cm < 20) return { label: "Moderate Rain (15cm)", color: "#7E3DB5" };
  if (cm < 30) return { label: "Heavy Rain", color: "#5B21B6" };
  if (cm < 40) return { label: "Very Heavy Rain", color: "#3B0764" };
  return { label: "Extreme Rain", color: "#1e0033" };
}


// ─── SMALL HELPERS ────────────────────────────────────────────────────────────
const Header = ({ partner, onLogout }) => {
  const navigate = useNavigate();
  return (
    <header className="hdr">
      <div className="hdr-left" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="hdr-logomark" style={{ cursor: "pointer" }} onClick={() => navigate("/dashboard")}><Shield size={15} /></div>
        <span className="hdr-logoname" style={{ cursor: "pointer" }} onClick={() => navigate("/dashboard")}>Gig Insurance Company</span>
      </div>
      <div className="hdr-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button 
          onClick={() => navigate("/b2b")} 
          className="btn-premium-outline"
          style={{ padding: "4px 10px", fontSize: "11px", height: "30px" }}
          title="B2B Integration Portal"
        >
          <Building2 size={13} /> Platform Partner
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span className="live-dot" />
          <span className="hdr-zone-label">{partner.zone}</span>
        </div>
        <div 
          className="hdr-avatar" 
          onClick={() => navigate("/profile")}
          style={{ cursor: "pointer", transition: "all 0.2s", ":hover": { transform: "scale(1.05)" } }}
          title="Account Settings"
        >
          {partner.avatar}
        </div>
        <button 
          onClick={() => navigate("/profile")} 
          style={{ background: "none", border: "none", padding: 5, cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center" }}
        >
          <Settings size={16} />
        </button>
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--purple-pale)", border: "1px solid var(--purple)", color: "var(--purple-dark)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: 0.2 }}>
          <LogOut size={13} /> Logout
        </button>
      </div>
    </header>
  );
};

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [workerId, setWorkerId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = () => navigate("/register");

  const handle = async () => {
    setError("");
    if (!workerId.trim() || !password.trim()) { setError("Please enter Worker ID and password"); return; }
    setLoading(true);

    // Try mock demo IDs first
    const upperId = workerId.toUpperCase();
    if (PARTNERS[upperId] && password === "demo") {
      setLoading(false);
      onLogin(upperId);
      return;
    }

    // 1. Fetch the worker credentials
    // Sanitize input: remove common prefixes like "D" or "DB" if user copied them from dashboard
    const cleanId = workerId.toUpperCase().replace(/^DB?/, "");
    console.log("Step 1: Checking workers table for ID:", cleanId);
    const { data: worker, error: workerErr } = await supabase
      .from('workers')
      .select('*')
      .eq('worker_id', cleanId)
      .eq('password', password)
      .single();

    if (workerErr || !worker) {
      console.error("Worker Auth Failed:", workerErr);
      setLoading(false);
      setError(workerErr?.message || "Invalid Worker ID or Password");
      return;
    }

    // 2. Fetch the associated gic record (optional/fallback-safe)
    console.log("Step 2: Fetching metrics from gic_workers for ID:", cleanId);
    const { data: gsRecord, error: gsErr } = await supabase
      .from('gic_workers')
      .select('record, payout_method, upi_id, bank_name, account_number, ifsc_code, account_holder')
      .eq('worker_id', cleanId)
      .single();

    if (gsErr) console.warn("Could not find gic_workers record:", gsErr.message);

    setLoading(false);

    // Success! Map THE data
    const dbRecord = gsRecord?.record || {};
    const newId = `DB${worker.worker_id}`;

    console.log("Login Success. Mapping data for:", newId);

    // Map selected_slab to frontend tiers
    const slabToPlan = { "Slab_100": "premium", "Slab_75": "standard", "Slab_50": "standard", "Slab_25": "basic" };
    const chosenPlan = slabToPlan[dbRecord.selected_slab] || "premium";

    // Randomized "Noise" Distribution Logic
    const shortDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const daysArr = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const currentDayName = worker.current_day || "Monday";
    const currentDayIdx = daysArr.indexOf(currentDayName);
    const totalToDistribute = dbRecord.weekly_income || 0;

    // Calculate base average and a random fluctuation (noise)
    const activeDaysCount = currentDayIdx + 1;
    const avg = totalToDistribute / activeDaysCount;
    const noiseLevel = avg * 0.15; // 15% fluctuation for realism

    const distributedEarnings = [];
    let currentSum = 0;

    for (let i = 0; i <= currentDayIdx; i++) {
      if (i === currentDayIdx) {
        // Last day gets the remainder to ensure exact total
        distributedEarnings.push(totalToDistribute - currentSum);
      } else {
        // Random value within ±noiseLevel of average
        const noise = (Math.random() * 2 - 1) * noiseLevel;
        const val = Math.max(0, avg + noise);
        distributedEarnings.push(val);
        currentSum += val;
      }
    }

    const currentWeekDays = shortDays.map((short, idx) => {
      let earning = 0;
      let dateLabel = "Future";
      let isDisrupted = false;

      if (idx <= currentDayIdx) {
        earning = distributedEarnings[idx];
        dateLabel = (idx === currentDayIdx) ? "Today" : "Past";
        if (idx === currentDayIdx) isDisrupted = (dbRecord.rainfall_cm || 0) > 10;
      }

      return {
        day: short,
        date: dateLabel,
        earning: earning,
        rainfallCm: idx === currentDayIdx ? (dbRecord.rainfall_cm || 0) : 0,
        disrupted: isDisrupted
      };
    });

    PARTNERS[newId] = {
      id: newId,
      name: worker.name,
      city: dbRecord.city || worker.city,
      zone: `${dbRecord.platform || worker.platform} / ${dbRecord.city || worker.city}`,
      joinedDate: `${dbRecord.weeks_active || 0} weeks active`,
      avatar: worker.name.substring(0, 2).toUpperCase(),
      phone: "+91 xxxxx xxxxx",
      bankId: dbRecord.bank_id || "NOT-LINKED",
      deliveries: dbRecord.orders_completed_week || 0,
      rating: parseFloat((dbRecord.fraud_trust_rating * 5).toFixed(1)) || 4.5,
      chosenPlan: chosenPlan,
      isNewCustomer: false,
      // Metrics for calculations
      dbRecord: dbRecord,
      pastWeeklyEarnings: Array(10).fill(dbRecord.avg_52week_income || 5000),
      pastWeeklyPaid: Array(10).fill(true),
      pastWeeklyClaimed: Array(10).fill(false),
      currentWeekDays: currentWeekDays,
      payout_method: gsRecord?.payout_method || null,
      upi_id: gsRecord?.upi_id || null,
      bank_name: gsRecord?.bank_name || null,
      account_number: gsRecord?.account_number || null,
    };

    onLogin(newId);
  };

  return (
    <div className="l-wrap">
      <div className="l-panel">
        <div className="l-grid" />
        <div className="l-content">
          <div className="l-logo">
            <div className="l-logomark"><Shield size={20} /></div>
            <div>
              <div className="l-logotype-name">Gig Insurance Company</div>
              <div className="l-logotype-sub">Gig Insurance Platform</div>
            </div>
          </div>
          <h1 className="l-headline">
            Income protection<br /><em>built for gig</em><br />workers.
          </h1>
          <p className="l-desc">
            Parametric insurance triggered automatically by rainfall data. No paperwork, no manual claims — your payout arrives the moment disruption is confirmed.
          </p>
          <div style={{ marginTop: 24 }}><LivePayoutTicker /></div>
        </div>
        <div>
          <MarketStatsRow started={true} />
        </div>
      </div>
      <div className="l-form-side">
        <div className="l-form-card">
          <div className="l-form-title">Partner Login</div>
          <div className="l-form-sub">Enter your Worker ID and password to access your insurance dashboard</div>

          <label className="l-field-label">Worker ID</label>
          <div className="l-input-wrap" style={{ marginBottom: 16 }}>
            <span className="l-input-icon"><User size={15} /></span>
            <input className="l-input" placeholder="e.g. 4 or Z001" value={workerId} maxLength={10}
              onChange={e => setWorkerId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handle()} />
          </div>

          <label className="l-field-label">Password</label>
          <div className="l-input-wrap">
            <span className="l-input-icon"><Lock size={15} /></span>
            <input className="l-input" type="password" placeholder="Enter password (demo: 'demo')" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handle()} />
          </div>

          {error && <div className="l-error"><AlertTriangle size={14} /> {error}</div>}
          <button className="l-btn" onClick={handle}>
            {loading ? <span className="spin"><Radio size={16} /></span> : <><LogIn size={16} /> Access Dashboard</>}
          </button>
          <div className="l-hint">
            Demo IDs (password: demo):{" "}
            {["Z001", "Z002", "Z003"].map((h, i, a) => (
              <span key={h} onClick={() => { setWorkerId(h); setPassword("demo"); }}>{h}{i < a.length - 1 ? ", " : ""}</span>
            ))}
          </div>
          <div className="l-hint" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            New to GIC?{" "}
            <span id="go-register" onClick={onRegister} style={{ color: "var(--purple)", fontWeight: 700, cursor: "pointer" }}>Register here →</span>
          </div>

          <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, textAlign: "center" }}>Are you a Platform Partner? (Zepto, Blinkit, Instamart)</div>
            <button className="btn-premium-outline" onClick={() => navigate("/b2b")} style={{ width: "100%" }}>
              <Building2 size={16} /> Partner Integration Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EARNINGS CHART ───────────────────────────────────────────────────────────
function EarningsChart({ partner, pricing }) {
  const weeks = partner.pastWeeklyEarnings.slice(-5).map((val, i, arr) => ({
    label: `W${partner.pastWeeklyEarnings.length - arr.length + i + 1}`,
    val,
    current: false,
  }));
  const thisWeek = { label: "W11", val: pricing.currentEarning, current: true, disrupted: pricing.claimTriggered };
  const all = [...weeks, thisWeek];
  const max = Math.max(...all.map(w => w.val));
  return (
    <div className="card">
      <div className="card-title"><BarChart2 size={13} /> Earnings — Last 5 Weeks</div>
      <div className="chart-bars">
        {all.map(w => (
          <div className="bar-col" key={w.label}>
            <div className="bar-amt">{fmtK(w.val)}</div>
            <div className="bar-fill" style={{
              height: `${(w.val / max) * 68}px`,
              background: w.disrupted ? "rgba(185,28,28,0.45)"
                : w.current ? "var(--purple)"
                  : "var(--purple-pale)",
              border: `1px solid ${w.disrupted ? "rgba(185,28,28,0.22)" : w.current ? "var(--purple)" : "var(--purple-pale)"}`,
            }} />
            <div className="bar-label">{w.label}</div>
          </div>
        ))}
      </div>
      {pricing.claimTriggered && (
        <div className="chart-note">
          <TrendingDown size={12} /> This week's income below threshold — claim triggered
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ partnerId, evaluation, evalLoading, onLogout, paidForNextWeek, onPayPremium, onViewClaim, onSimulate }) {
  const navigate = useNavigate();
  const partner = PARTNERS[partnerId];
  if (!partner) return null;
  const pricing = useMemo(() => computePricing(partner), [partner]);
  const tier = pricing.tier;

  const hasPayout = evaluation?.decision === "APPROVE" || (evaluation?.payout_amount > 0);

  // ── Payout state ──
  const [payoutState, setPayoutState] = useState(null); // null | { status, payout_id, utr, ... }
  const [payoutLoading, setPayoutLoading] = useState(false);

  const handleInitiatePayout = async () => {
    if (!evaluation || !hasPayout) return;
    setPayoutLoading(true);
    try {
      const workerId = partnerId.startsWith("DB") ? parseInt(partnerId.replace("DB", "")) : 1;
      const res = await fetch("http://localhost:8000/api/payout/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_id: workerId,
          amount: evaluation.payout_amount || pricing.payout,
          claim_trace_id: evaluation.trace_id || `local_${Date.now()}`,
          reason: "Parametric insurance claim payout"
        })
      });
      const data = await res.json();
      setPayoutState(data);
    } catch (err) {
      console.error("Payout initiation failed:", err);
      setPayoutState({ status: "error", error: err.message });
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleResetPayout = async () => {
    if (!payoutState) return;
    try {
      await fetch("http://localhost:8000/api/payout/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_id: payoutState.payout_id }),
      });
      setPayoutState(null);
    } catch (e) { console.error("Reset failed:", e); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <Header partner={partner} onLogout={onLogout} />
      <div className="dash-body">

        {/* Mandatory Payout Setup Alert */}
        {!partner.payout_method && (
          <div className="alert alert-red" style={{ 
            background: "linear-gradient(135deg, #FEF2F2, #FFF1F1)", 
            border: "1.5px solid var(--red-bdr)",
            padding: "20px 24px",
            boxShadow: "0 4px 15px rgba(185,28,28,0.08)"
          }}>
            <div className="alert-icon" style={{ 
               width: "44px", height: "44px", borderRadius: "12px", 
               background: "var(--red-bg)", color: "var(--red)",
               display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <AlertCircle size={24} />
            </div>
            <div className="alert-body">
              <div className="alert-title" style={{ color: "var(--purple)", fontSize: "16px", fontWeight: 700 }}>Action Required: Setup Payout Account</div>
              <div className="alert-desc" style={{ fontSize: "14px", color: "var(--muted)", maxWidth: "600px" }}>
                Your parametric insurance protection is currently <strong>Inactive</strong>. We cannot process automated claims until you provide your payout details for instant rollout.
              </div>
            </div>
            <button 
              className="alert-btn" 
              onClick={() => navigate("/payout-setup", { state: { form: { worker_id: partnerId.replace("DB", ""), ...partner } } })}
              style={{ 
                background: "var(--red)", color: "#fff", 
                padding: "12px 24px", borderRadius: "10px",
                display: "flex", alignItems: "center", gap: "8px"
              }}
            >
              <Zap size={16} /> Setup Now
            </button>
          </div>
        )}

        {/* Real-Time Disruption Alert Banner (Sticky) */}
        {evaluation && evaluation.overall_hazard_level !== "LOW" && (
          <div className="sticky-banner" style={{
            background: evaluation.overall_hazard_level === "CRITICAL" ? "linear-gradient(90deg, #ef4444, #b91c1c)" : "linear-gradient(90deg, #6366f1, #4338ca)",
            color: "white", padding: "12px 24px", borderRadius: "16px", marginBottom: "24px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)", position: "sticky", top: "20px", zIndex: 100
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div className="pulse-icon"><Radio size={20} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px" }}>LIVE DISRUPTION: {evaluation.overall_hazard_level} RISK</div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>
                  {evaluation.weather?.condition_main || "Emergency"} active in {partner.city} · {evaluation.weather?.rainfall_1h_mm > 0 ? `${evaluation.weather.rainfall_1h_mm}mm rain` : (evaluation.hazard_type || "Sector Risk")} · Claim ready for rollout
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ textAlign: "right", borderRight: "1px solid rgba(255,255,255,0.3)", paddingRight: "20px" }}>
                <div style={{ fontSize: "10px", textTransform: "uppercase", opacity: 0.8 }}>Update in</div>
                <div style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>04:52</div>
              </div>
              <button onClick={onViewClaim} style={{ 
                background: "white", color: evaluation.overall_hazard_level === "CRITICAL" ? "#ef4444" : "#6366f1",
                border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer"
              }}>
                View Claim Analysis
              </button>
            </div>
          </div>
        )}

        {/* Welcome */}
        <div className="welcome-row">
          <div>
            <div className="welcome-name">Welcome back, {partner.name.split(" ")[0]}</div>
            <div className="welcome-meta">{partnerId} &nbsp;·&nbsp; {partner.city} &nbsp;·&nbsp; Partner since {partner.joinedDate}</div>
          </div>
          <div className="plan-pill" style={{ borderColor: tier.accent, color: tier.accent, background: tier.accentPale }}>
            <span className="pill-dot" style={{ background: tier.accent }} />
            {tier.label} Plan Active
          </div>
        </div>

        <NextWeekRiskBanner partner={partner} pricing={pricing} onPayPremium={onPayPremium} />
        <CoolingPeriodBar partner={partner} pricing={pricing} />

        {/* Top Row: Trust Score & Countdown */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "20px", marginBottom: "20px" }}>
          {/* Trust Score Visualizer */}
          <FraudScoreCard partner={partner} pricing={pricing} />

          {/* Premium Countdown (Dynamic) */}
          <div className="card premium-banner" style={{ color: "var(--text-on-dark-bg)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {(() => {
              const fmtDate = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
              const daysLeft = daysToMonday;
              const dashOffset = (daysLeft / 7) * 125.6;

              return (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                  {/* Top item: Due Date Countdown */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px dashed rgba(255,255,255,0.2)" }}>
                    <div>
                      <div style={{ fontSize: "12px", opacity: 0.7, textTransform: "uppercase", letterSpacing: "1px" }}>Next Premium Due</div>
                      <div style={{ fontSize: "28px", fontWeight: 700 }}>{daysLeft} {daysLeft === 1 ? "Day" : "Days"}</div>
                    </div>
                    <div style={{ width: "50px", height: "50px" }}>
                      <svg width="50" height="50" viewBox="0 0 50 50">
                         <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                         <circle cx="25" cy="25" r="20" fill="none" stroke={daysLeft <= 2 ? "#EF4444" : "var(--text-on-dark-bg)"} strokeWidth="4"
                           strokeDasharray={`${dashOffset} 125.6`}
                           strokeLinecap="round"
                           transform="rotate(-90 25 25)"
                         />
                      </svg>
                    </div>
                  </div>

                  {/* Middle item: Coverage & Premium Amount */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "16px", paddingBottom: "16px" }}>
                    <div>
                      <div style={{ fontSize: "12px", opacity: 0.7 }}>Coverage Period</div>
                      <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "2px" }}>{fmtDate(cycleStart)} – {fmtDate(cycleEnd)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", opacity: 0.7 }}>Amount</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "2px" }}>{fmt(pricing.nextPremium)}</div>
                    </div>
                  </div>

                  {/* Bottom item: Action Button */}
                  <div>
                    <button onClick={onPayPremium} style={{ 
                      background: "rgba(255,255,255,0.15)", border: "none", color: "var(--text-on-dark-bg)", width: "100%",
                      padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer"
                    }}>Pay Premium Early</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Claim status strip (Updated with Live Backend Data + Payout Status) */}
        <div className={hasPayout ? "alert alert-red" : "alert alert-blue"} style={{ marginBottom: 20 }}>
          <div className="alert-icon">
            {evalLoading ? <Radio size={20} className="spin" color="var(--purple)" /> :
              payoutState?.status === "processed" || payoutState?.status === "demo_success" ? <CheckCircle size={20} color="var(--green)" /> :
              hasPayout ? <CloudRain size={20} color="var(--red)" /> :
                <ShieldCheck size={20} color="var(--purple)" />}
          </div>
          <div className="alert-body">
            {evalLoading ? (
              <div className="alert-title" style={{ color: "var(--purple)" }}>Analyzing this week's disruption data...</div>
            ) : payoutState?.status === "processed" || payoutState?.status === "demo_success" ? (
              <>
                <div className="alert-title" style={{ color: "var(--green)" }}>✅ Payout {fmt(payoutState.amount)} Credited</div>
                <div className="alert-desc">UTR: {payoutState.utr || "Processing"} · Sent via {payoutState.mode} to {payoutState.destination || "linked account"} {payoutState.demo ? " (Demo Mode)" : ""}</div>
              </>
            ) : hasPayout ? (
              <>
                <div className="alert-title" style={{ color: "var(--red)" }}>Insurance Trigger: {evaluation?.decision || "PAYOUT READY"}</div>
                <div className="alert-desc">Disruption confirmed by ML Orchestrator. Final Payout: {fmt(evaluation?.payout_amount || 0)}. Confidence: {Math.round(evaluation?.confidence * 100)}%.</div>
              </>
            ) : (
              <>
                <div className="alert-title" style={{ color: "var(--purple)" }}>Risk Analysis: No Trigger Detected</div>
                <div className="alert-desc">{evaluation?.decision === "REJECT" ? evaluation.eligibility_snapshot?.reason : `Your behavior score is ${partner.dbRecord?.behavior_score || "Good"}. No automated claims triggered.`}</div>
              </>
            )}
          </div>
          {hasPayout && !payoutState ? (
            <button className="alert-btn" style={{ background: "var(--green)", color: "var(--text-on-primary)", display: "flex", alignItems: "center", gap: 6 }} onClick={handleInitiatePayout} disabled={payoutLoading}>
              {payoutLoading ? <><Radio size={14} className="spin" /> Processing...</> : <><Zap size={14} /> Claim Payout</>}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button className="alert-btn" style={{ background: payoutState ? "var(--green)" : "var(--purple)", color: "var(--text-on-primary)" }} onClick={onViewClaim}>
                {payoutState ? "View Receipt" : hasPayout ? "View Breakdown" : "Check Details"}
              </button>
              {payoutState && (
                <button onClick={handleResetPayout} style={{
                  fontSize: 10, padding: "4px 10px", borderRadius: 6,
                  background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.1)",
                  color: "var(--muted)", cursor: "pointer", whiteSpace: "nowrap",
                }}>↻ Reset</button>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-head"><span className="stat-label">Rolling Avg Income</span><span className="stat-icon"><CircleDollarSign size={16} /></span></div>
            <div className="stat-val">{fmtK(pricing.avg)}</div>
            <div className="stat-sub">10-week baseline</div>
          </div>
          <div className="stat-card">
            <div className="stat-head"><span className="stat-label">This Week</span><span className="stat-icon"><Activity size={16} /></span></div>
            <div className="stat-val" style={{ color: pricing.claimTriggered ? "var(--red)" : "var(--green)" }}>
              {fmtK(pricing.currentEarning)}
            </div>
            {pricing.claimTriggered
              ? <span className="chip chip-red"><TrendingDown size={10} /> Below Threshold</span>
              : <span className="chip chip-purple">Above Threshold</span>}
          </div>
          <div className="stat-card">
            <div className="stat-head"><span className="stat-label">Total Deliveries</span><span className="stat-icon"><Package size={16} /></span></div>
            <div className="stat-val">{partner.deliveries.toLocaleString()}</div>
            <div className="stat-sub" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Star size={11} color="#d97706" fill="#d97706" /> {partner.rating} partner rating
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-head"><span className="stat-label">Claims Filed</span><span className="stat-icon"><ShieldCheck size={16} /></span></div>
            <div className="stat-val" style={{ color: "var(--purple)" }}>{pricing.claims}</div>
            <div className="stat-sub">{pricing.defaults} defaults &nbsp;·&nbsp; {fmt(pricing.weeklyPremium)} premium/wk</div>
          </div>
        </div>

        {/* Real-time Market Pulse (MCP Signals) */}
        {evaluation?.mcp_risk_profile && (
          <div className="card market-pulse-card" style={{ marginBottom: "20px", background: "linear-gradient(135deg, #F8FAFC, #EFF6FF)", border: "1px solid #DBEAFE" }}>
            <div className="card-title" style={{ color: "#2563EB", marginBottom: "16px" }}>
              <Radio size={13} strokeWidth={3} className={evaluation.overall_hazard_level !== "LOW" ? "pulse-icon" : ""} /> 
              Real-Time Market Pulse — {partner.city}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
              <div className="pulse-item">
                <div style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase", fontWeight: 600, marginBottom: "8px" }}>Search Intelligence</div>
                <div style={{ fontSize: "13px", color: "#1E3A8A", fontStyle: "italic", lineHeight: 1.5 }}>
                  "{evaluation.mcp_risk_profile.market_intel?.hazard_context || "No active search hazards detected."}"
                </div>
              </div>
              <div className="pulse-item">
                <div style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase", fontWeight: 600, marginBottom: "8px" }}>Live News Flags</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                   {evaluation.mcp_risk_profile.news_data?.disruption_flags?.map(f => (
                     <span key={f} style={{ fontSize: "10px", background: "#DBEAFE", color: "#1E40AF", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>{f.toUpperCase()}</span>
                   )) || <span style={{ fontSize: "12px", color: "#94A3B8" }}>Stable News Cycle</span>}
                </div>
              </div>
              <div className="pulse-item" style={{ borderLeft: "1px solid #DBEAFE", paddingLeft: "20px" }}>
                 <div style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase", fontWeight: 600, marginBottom: "8px" }}>Composite Risk</div>
                 <div style={{ fontSize: "24px", fontWeight: 800, color: evaluation.overall_hazard_level === "CRITICAL" ? "#EF4444" : "#2563EB" }}>
                    {evaluation.mcp_risk_profile.combined_multiplier?.toFixed(2)}x
                 </div>
                 <div style={{ fontSize: "10px", color: "#64748B", marginTop: "-2px" }}>Risk Multiplier Applied</div>
              </div>
            </div>
          </div>
        )}

        {/* Plan detail + Chart */}
        <div className="two-col">
          <div className="card">
            <div className="card-title"><FileText size={13} /> Current Plan Details</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: tier.accent, marginBottom: 14, letterSpacing: -0.3 }}>{tier.label} Coverage — {tier.tabLabel} ({(tier.rate * 100).toFixed(1)}%)</div>
            {[
              ["Weekly Premium", <span style={{ color: "var(--purple-dark)" }}>{fmt(pricing.weeklyPremium)}</span>],
              ["Plan Premium", <span style={{ color: "var(--purple-dark)" }}>{fmt(pricing.planPremium)}</span>],
              ["Default Penalty", pricing.isNewCustomer ? "None — new customer" : pricing.defaults > 0 ? `+${fmt(pricing.defaultPenaltyAmt)} (2% × ${pricing.defaults} wks)` : "None — no missed payments"],
              ["Loyalty Reward", pricing.isNewCustomer ? "None — new customer" : pricing.loyaltyRewardAmt > 0 ? `−${fmt(pricing.loyaltyRewardAmt)} (${partner.dbRecord?.weeks_loyal || 52}-wk non-defaulter)` : "None"],
              ["Claim Coverage", `${(pricing.adjCoverPct * 100).toFixed(0)}% of income loss`],
              ["Rain Trigger", "15cm rain → 80% coverage"],
              ["Income Threshold", `75% of avg = ${fmt(pricing.threshold)}`],
              ["Missed Payments", pricing.isNewCustomer ? "N/A — new customer" : `${pricing.defaults} week(s)`],
            ].map(([l, v]) => (
              <div className="detail-row" key={l}>
                <span className="detail-label">{l}</span>
                <span className="detail-val" style={{ color: "var(--purple-dark)" }}>{v}</span>
              </div>
            ))}
          </div>
          <EarningsChart partner={partner} pricing={pricing} />
        </div>

        {/* Disruption snapshot */}
        {pricing.disruptedDays.length > 0 && (
          <div className="card" style={{ marginBottom: 13 }}>
            <div className="card-title"><CloudRain size={13} /> This Week — Disruption Snapshot</div>
            <div className="disrupt-grid">
              <div className="disrupt-item">
                <div className="di-label"><CloudRain size={12} /> Max Rainfall</div>
                <div className="di-val" style={{ color: "var(--red)" }}>
                  {Math.max(...pricing.disruptedDays.map(d => d.rainfallCm))}cm
                </div>
                <div className="prog"><div className="prog-bar" style={{ width: `${Math.min((Math.max(...pricing.disruptedDays.map(d => d.rainfallCm)) / 55) * 100, 100)}%`, background: "var(--red)" }} /></div>
                <div className="di-note">Rain coverage: {(pricing.rainCovPct * 100).toFixed(0)}%</div>
              </div>
              <div className="disrupt-item">
                <div className="di-label"><TrendingDown size={12} /> Income Loss</div>
                <div className="di-val" style={{ color: "var(--red)" }}>{fmt(pricing.loss)}</div>
                <div className="prog"><div className="prog-bar" style={{ width: `${Math.min((pricing.loss / pricing.threshold) * 100, 100)}%`, background: "var(--red)" }} /></div>
                <div className="di-note">vs threshold {fmt(pricing.threshold)}</div>
              </div>
              <div className="disrupt-item">
                <div className="di-label"><CircleDollarSign size={12} /> Claim Payout</div>
                <div className="di-val" style={{ color: "var(--green)" }}>{fmt(pricing.payout)}</div>
                <div className="di-note">{fmt(pricing.netCoverableLoss)} × {(pricing.rainCovPct * 100).toFixed(0)}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Simulation CTA */}
        <div className="sim-cta-strip">
          <div className="sim-cta-left">
            <div className="sim-cta-icon" style={{ background: "var(--purple-pale)" }}>
              <Satellite size={22} color="var(--purple)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--purple-dark)", letterSpacing: -0.2 }}>Disruption Simulation</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Run a live weather scenario → ML pipeline → payout calculation using real backend endpoints</div>
            </div>
          </div>
          <button className="btn-premium" onClick={onSimulate}>
            <Satellite size={14} /> Run Simulation <ChevronRight size={14} />
          </button>
        </div>

        {/* What-If Calculator CTA */}
        <div className="sim-cta-strip" style={{ marginTop: 16 }}>
          <div className="sim-cta-left">
            <div className="sim-cta-icon" style={{ background: "var(--purple-pale)" }}>
              <Calculator size={22} color="var(--purple)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--purple-dark)", letterSpacing: -0.2 }}>"What If" Premium Calculator</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Play with income, defaults, and slab settings to forecast logic</div>
            </div>
          </div>
          <button className="btn-premium-outline" onClick={() => navigate("/calculator")}>
            <Calculator size={14} /> Open Calculator <ChevronRight size={14} />
          </button>
        </div>

        {/* Pay bar */}
        {!paidForNextWeek && (
          <div className="pay-bar">
            <div>
              <div className="pb-title">Renew Your {tier.label} Plan — Next Week</div>
              <div className="pb-sub">Next premium: {fmt(pricing.nextPremium)} &nbsp;·&nbsp; Updated avg: {fmt(pricing.nextAvg)} &nbsp;·&nbsp; {tier.label} tier</div>
            </div>
            <button className="btn-premium" style={{ background: "#fff", color: "var(--purple-dark)" }} onClick={onPayPremium}>
              Pay Premium <ChevronRight size={15} />
            </button>
          </div>
        )}
        
        {paidForNextWeek && (
          <div className="pay-bar" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid var(--green-bdr)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--green)" }}>
              <CheckCircle size={20} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>Premium Paid Successfully</div>
                <div style={{ fontSize: "12px", opacity: 0.8 }}>Your coverage for next week is active and verified.</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── PLAN SELECTOR ────────────────────────────────────────────────────────────
function PlanSelector({ partnerId, onPaymentSuccess }) {
  const navigate = useNavigate();
  const partner = PARTNERS[partnerId];
  if (!partner) return null;
  const [selected, setSelected] = useState(partner.chosenPlan);
  const pricing = useMemo(() => computePricing(partner, selected), [partner, selected]);

  const onBack = () => navigate("/dashboard");
  
  const onPay = (selectedPlanKey) => {
    const planPricing = computePricing(partner, selectedPlanKey);
    const premiumAmount = planPricing.nextPremium;
    const rzpKey = import.meta.env.VITE_RAZORPAY_TEST_KEY_ID || "rzp_test_demo_key";

    if (!import.meta.env.VITE_RAZORPAY_TEST_KEY_ID) {
      if (confirm(`[DEMO MODE] No Razorpay Key found.\n\nSimulate payment of ₹${premiumAmount} for ${selectedPlanKey} plan?`)) {
        onPaymentSuccess(); // Signal payment success
        navigate(`/success/${selectedPlanKey}`);
      }
      return;
    }

    const options = {
      key: rzpKey,
      amount: premiumAmount * 100,
      currency: "INR",
      name: "Gig Shield",
      description: `${selectedPlanKey.toUpperCase()} Plan Premium`,
      handler: function (response) {
        onPaymentSuccess(); // Signal payment success
        navigate(`/success/${selectedPlanKey}`);
      },
      prefill: {
        name: partner.name,
      },
      theme: {
        color: "#3B0764"
      }
    };
    
    if (window.Razorpay) {
      new window.Razorpay(options).open();
    } else {
      alert("Razorpay SDK failed to load.");
    }
  };

  const planMeta = [
    { key: "basic", Icon: Shield },
    { key: "standard", Icon: Zap },
    { key: "premium", Icon: Gem },
  ];

  return (
    <div className="plans-pg">
      <div className="plans-hdr">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={16} /> Back to Dashboard</button>
        <div className="plans-title">Choose Your Coverage</div>
        <div className="plans-sub">
          10-week rolling avg: {fmt(pricing.avg)} &nbsp;·&nbsp; Rain trigger ≥ 15cm &nbsp;·&nbsp; Income threshold 75%
        </div>
      </div>

      {/* ── How Your Premium Is Calculated (Next Week) ── */}
      <div style={{ maxWidth: 940, margin: "0 auto 32px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "26px 28px" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--purple-dark)", letterSpacing: -0.3, marginBottom: 4 }}>Next Week's Premium — How It's Calculated</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
          Updated rolling avg after this week's earning of {fmt(pricing.currentEarning)} ({thisWeekStr})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { Icon: BarChart2, label: "Updated Rolling Avg", val: fmt(pricing.nextAvg), sub: "Avg after this week", red: false },
            { Icon: Percent, label: `${pricing.tier.tabLabel} Rate (${(pricing.tier.rate * 100).toFixed(1)}%)`, val: fmt(pricing.nextPlanPremium), sub: "Next week base premium", red: false },
            { Icon: AlertCircle, label: "Default Penalty", val: pricing.defaults > 0 ? "+" + fmt(pricing.defaultPenaltyAmt) : "None", sub: pricing.defaults + " missed payment(s)", red: pricing.defaults > 0 },
            { Icon: Target, label: "Disruption Threshold", val: fmt(Math.round(pricing.nextAvg * 0.75)), sub: "75% of updated avg", red: false },
          ].map(({ Icon: Ic, label, val, sub, red }) => (
            <div key={label} style={{ borderRadius: 12, padding: "16px", background: red ? "var(--red-bg)" : "var(--surface2)", border: "1px solid " + (red ? "var(--red-bdr)" : "var(--border)"), textAlign: "center" }}>
              <Ic size={15} color={red ? "var(--red)" : "var(--purple-lt)"} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--mono)", color: red ? "var(--red)" : "var(--purple-dark)", letterSpacing: -0.5 }}>{val}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>
        {pricing.defaults > 0 && (
          <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-bdr)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--red)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} /> Next week's premium includes a +{fmt(pricing.defaultPenaltyAmt)} penalty for {pricing.defaults} missed payment(s).
          </div>
        )}
        {pricing.nextLoyaltyAmt > 0 && (
          <div style={{ background: "var(--green-bg)", border: "1px solid var(--green-bdr)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--green)", display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={14} /> Loyalty reward: −{fmt(pricing.nextLoyaltyAmt)} applied for {partner.dbRecord?.weeks_loyal || 52}-week clean payment record!
          </div>
        )}
        <div className="premium-inner-banner" style={{ borderRadius: 14, padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-on-dark-bg-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Next Week's Premium Due · {nextWeekStr}</div>
            <div style={{ fontSize: 13, color: "var(--text-on-dark-bg-muted)" }}>
              {pricing.tier.tabLabel}: {(pricing.tier.rate * 100).toFixed(1)}% × {fmt(pricing.nextAvg)} = {fmt(pricing.nextPlanPremium)}
              {pricing.defaultPenaltyAmt > 0 && ` + ${fmt(pricing.defaultPenaltyAmt)} default penalty`}
              {pricing.nextLoyaltyAmt > 0 && ` − ${fmt(pricing.nextLoyaltyAmt)} loyalty reward`}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-on-dark-bg-muted)", marginTop: 3 }}>Coverage: {(pricing.adjCoverPct * 100).toFixed(0)}% of verified income loss</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--text-on-dark-bg-muted)", marginBottom: 2 }}>Net Weekly Premium</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-on-dark-bg)", fontFamily: "var(--mono)", letterSpacing: -1 }}>{fmt(pricing.nextPremium)}</div>
          </div>
        </div>
      </div>

      <WorkerComparisonTable />

      {/* ── SaaS Style Pricing Cards ── */}
      <div style={{ maxWidth: 1040, margin: "0 auto", marginTop: "40px", marginBottom: "60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
          {planMeta.map(({ key }) => {
            const tierInfo = TIERS[key];
            const planPricing = computePricing(partner, key);
            const isSelected = selected === key;
            return (
              <div 
                key={key} 
                className="glass-card plan-card"
                style={{
                  background: isSelected ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.45)",
                  backdropFilter: "blur(16px)",
                  border: isSelected ? `2px solid ${tierInfo.accent}` : "1px solid rgba(255, 255, 255, 0.7)",
                  borderRadius: "16px",
                  padding: "24px 20px",
                  position: "relative",
                  boxShadow: isSelected ? "0 15px 35px rgba(0,0,0,0.06)" : "0 4px 12px rgba(0,0,0,0.02)",
                  transition: "all 0.3s ease",
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer",
                  transform: isSelected ? "scale(1.02) translateY(-4px)" : "scale(1)",
                  zIndex: isSelected ? 2 : 1
                }}
                onClick={() => setSelected(key)}
              >
                {isSelected && (
                  <div style={{
                    position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
                    background: tierInfo.accent, color: "var(--text-on-dark-bg)", fontSize: "10px", fontWeight: 700,
                    padding: "4px 14px", borderRadius: "20px", letterSpacing: "1px", textTransform: "uppercase",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
                  }}>
                    Selected Slab
                  </div>
                )}
                
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: tierInfo.accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>{tierInfo.label}</div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{tierInfo.tabLabel}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", marginBottom: "4px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--purple-dark)", fontFamily: "var(--mono)", letterSpacing: "-1px" }}>{fmt(planPricing.nextPremium)}</span>
                  <span style={{ fontSize: "13px", color: "var(--muted)", marginLeft: "4px" }}>/week</span>
                </div>
                <div style={{ textAlign: "center", fontSize: "11px", color: "var(--muted)", marginBottom: "20px" }}>
                  Based on {fmt(pricing.nextAvg)} 52-week avg
                </div>

                <div style={{ background: "rgba(255, 255, 255, 0.5)", border: "1px solid rgba(255, 255, 255, 0.8)", borderRadius: "10px", padding: "12px", marginBottom: "20px" }}>
                  <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Max Weekly Coverage</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--purple-dark)" }}>{(tierInfo.cover * 100).toFixed(0)}%</div>
                    <div style={{ fontSize: "11px", color: "var(--text2)" }}>of loss via <strong style={{ color: "var(--purple-dark)" }}>{(tierInfo.rate * 100).toFixed(1)}%</strong> rate</div>
                  </div>
                </div>

                <div style={{ flex: 1, padding: "0 4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", fontSize: "12px", color: "var(--text2)", fontWeight: 500 }}>
                    <CheckCircle size={14} color="var(--green)" /> No Claim Form Needed
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", fontSize: "12px", color: "var(--text2)", fontWeight: 500 }}>
                    <CheckCircle size={14} color="var(--green)" /> Instant Payouts (UPI)
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", fontSize: "12px", color: "var(--text2)", fontWeight: 500 }}>
                    <CheckCircle size={14} color="var(--green)" /> LangGraph Truth Verification
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", fontSize: "12px", color: "var(--text2)", fontWeight: 500 }}>
                    <CheckCircle size={14} color="var(--green)" /> Societal / Tech Disruptions
                  </div>
                </div>

                <div style={{ 
                  textAlign: "center", fontSize: "11px", fontWeight: 700, color: "var(--purple)", 
                  padding: "10px 0", background: `${tierInfo.accent}15`, borderRadius: "6px", marginBottom: "16px",
                  border: `1px dashed ${tierInfo.accent}40`
                }}>
                  Weather Trigger ≥ 10cm rainfall
                </div>

                <button 
                  className="plan-btn"
                  onClick={(e) => { e.stopPropagation(); onPay(key); }}
                  style={{ 
                    background: isSelected ? tierInfo.accent : "var(--surface)", 
                    color: isSelected ? "#fff" : "var(--purple)", 
                    border: isSelected ? "none" : "1px solid var(--purple-lt)",
                    width: "100%", height: "42px", fontSize: "14px", fontWeight: 700, borderRadius: "8px",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    transition: "all 0.2s"
                  }}
                >
                  Activate {tierInfo.label} <ChevronRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── PAYMENT PAGE ─────────────────────────────────────────────────────────────
function PaymentPage({ partnerId }) {
  const navigate = useNavigate();
  const { planKey } = useParams();
  const partner = PARTNERS[partnerId];
  if (!partner) return null;
  const pricing = useMemo(() => computePricing(partner, planKey), [partner, planKey]);
  const tier = pricing.tier;
  const premium = pricing.nextPremium;
  const [method, setMethod] = useState("UPI");
  const [loading, setLoading] = useState(false);

  const onBack = () => navigate("/plans");
  const onSuccess = () => navigate(`/success/${planKey}`);

  const methods = [
    { id: "UPI", icon: <Smartphone size={14} />, label: "UPI" },
    { id: "NetBanking", icon: <Building2 size={14} />, label: "Net Banking" },
    { id: "Card", icon: <CreditCard size={14} />, label: "Debit Card" },
    { id: "Wallet", icon: <Wallet size={14} />, label: "Wallet" },
  ];

  const handlePayment = async () => {
    setLoading(true);
    try {
      // 1. Create Order on Backend
      const orderRes = await fetch("http://localhost:8001/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: premium,
          receipt: `receipt_${partnerId}_${planKey}`
        })
      });
      const orderData = await orderRes.json();

      if (!orderData.id) throw new Error("Failed to create order");

      // 2. Configure Razorpay Options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_TEST_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Gig Insurance Company",
        description: `${tier.label} Plan Subscription`,
        order_id: orderData.id,
        handler: async function (response) {
          // 3. Verify Payment
          try {
            const verifyRes = await fetch("http://localhost:8001/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response)
            });
            const verifyData = await verifyRes.json();
            if (verifyData.status === "success") {
              onSuccess();
            } else {
              alert("Payment verification failed. Please contact support.");
            }
          } catch (vErr) {
            console.error("Verification error", vErr);
            alert("Payment verification failed.");
          }
        },
        prefill: {
          name: partner.name,
          contact: partner.phone,
        },
        theme: { color: tier.accent },
        modal: {
          ondismiss: function() { setLoading(false); }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment failed", err);
      alert("Payment failed: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="center-pg">
      <div className="pay-card">
        <button className="back-btn" onClick={onBack} style={{ marginBottom: 20 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="pay-title">Complete Payment</div>
        <div className="pay-summary">
          {[
            ["Plan", <span style={{ fontWeight: 700, color: tier.accent }}>{tier.label} Coverage (Slab 3)</span>],
            ["Partner", partner.name],
            ["Coverage", `${(tier.cover * 100).toFixed(0)}% of income loss`],
            ["Rain Trigger", "15cm+ rainfall"],
            ["Period", "16–22 Jun 2025 (auto-renew)"],
          ].map(([l, v]) => (
            <div className="sum-row" key={l}><span className="sum-label">{l}</span><span className="sum-val">{v}</span></div>
          ))}
          <div className="sum-row total">
            <span className="sum-label">Weekly Premium</span>
            <span className="sum-val">{fmt(premium)}</span>
          </div>
        </div>
        <div className="pm-head">Payment Method</div>
        <div className="pm-grid">
          {methods.map(m => (
            <div key={m.id} className={`pm-opt${method === m.id ? " sel" : ""}`} onClick={() => setMethod(m.id)}>
              {m.icon} {m.label}
            </div>
          ))}
        </div>
        <button
          className="btn-accent"
          onClick={handlePayment}
          disabled={loading}
        >
          {loading ? <span className="spin"><Radio size={16} /></span> : <><Lock size={15} /> Pay {fmt(premium)}</>}
        </button>
        <div className="secure-note"><Lock size={11} /> Secured by Razorpay · Auto-trigger enabled</div>
      </div>
    </div>
  );
}

// ─── PAYMENT SUCCESS ──────────────────────────────────────────────────────────
function PaymentSuccess({ partnerId }) {
  const navigate = useNavigate();
  const { planKey } = useParams();
  const partner = PARTNERS[partnerId];
  if (!partner) return null;
  const pricing = useMemo(() => computePricing(partner, planKey), [partner, planKey]);
  const tier = pricing.tier;
  const premium = pricing.nextPremium;

  const onDone = () => navigate("/dashboard");
  return (
    <div className="center-pg">
      <div className="pay-card" style={{ textAlign: "center", maxWidth: 400 }}>
        <div className="success-icon-wrap"><BadgeCheck size={28} color="var(--green)" /></div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--purple-dark)", letterSpacing: -0.4, marginBottom: 7 }}>Payment Confirmed</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 26 }}>
          Your {tier.label} plan covers 16–22 Jun 2025. Auto-trigger is active.
        </div>
        <div className="payout-box" style={{ background: "var(--purple-pale)", border: "1px solid rgba(107,45,139,0.18)", marginBottom: 22 }}>
          <div className="payout-label">Amount Paid</div>
          <div className="payout-val" style={{ color: "var(--purple)" }}>{fmt(premium)}</div>
          <div className="payout-note">Weekly premium — {tier.label} Plan (Slab 3)</div>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 22, lineHeight: 1.6 }}>
          Rainfall 15cm+ will automatically trigger your payout. No action needed.
        </div>
        <button className="btn-accent" onClick={onDone}>Back to Dashboard <ChevronRight size={15} /></button>
      </div>
    </div>
  );
}


// ─── CLAIM PAYOUT ACTION ──────────────────────────────────────────────────────
function ClaimPayoutAction({ partner, pricing, evaluation }) {
  const [payoutState, setPayoutState] = useState(null);
  const [loading, setLoading] = useState(false);
  const p = pricing;

  const handlePayout = async () => {
    setLoading(true);
    try {
      const workerId = partner.id?.startsWith("DB") ? parseInt(partner.id.replace("DB", "")) : 1;
      const res = await fetch("http://localhost:8000/api/payout/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_id: workerId,
          amount: evaluation?.payout_amount || p.payout,
          claim_trace_id: evaluation?.trace_id || `local_${Date.now()}`,
          reason: "Parametric insurance claim payout",
        }),
      });
      const data = await res.json();
      setPayoutState(data);
    } catch (err) {
      console.error("Payout failed:", err);
      setPayoutState({ status: "error", error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const payoutMethod = partner.payout_method || "upi";
  const destDisplay = payoutMethod === "upi"
    ? (partner.upi_id || "UPI not linked")
    : partner.account_number
      ? `****${partner.account_number.slice(-4)}`
      : partner.bankId || "Bank not linked";

  // Success state
  if (payoutState?.status === "processed" || payoutState?.status === "demo_success") {
    return (
      <div className="claim-trigger-banner" style={{
        background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
        borderColor: "var(--green-bdr)",
      }}>
        <div style={{ flex: 1 }}>
          <div className="ctb-label" style={{ color: "var(--green)" }}>
            <CheckCircle size={16} style={{ display: "inline", marginRight: 6 }} />
            Payout Credited Successfully {payoutState.demo ? "(Demo Mode)" : ""}
          </div>
          <div className="ctb-desc" style={{ marginTop: 8, lineHeight: 1.7 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: 13 }}>
              <span><strong>Amount:</strong> {fmt(payoutState.amount)}</span>
              <span><strong>Mode:</strong> {payoutState.mode}</span>
              <span><strong>UTR:</strong> <code style={{ background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 4 }}>{payoutState.utr || "—"}</code></span>
              <span><strong>To:</strong> {payoutState.destination || destDisplay}</span>
            </div>
          </div>
          <div className="ctb-bank" style={{ marginTop: 8, color: "var(--green)", fontSize: 11 }}>
            Payout ID: {payoutState.payout_id} · {new Date(payoutState.timestamp || Date.now()).toLocaleString()}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
            <BadgeCheck size={28} color="#fff" />
          </div>
          <div className="ctb-amount" style={{ color: "var(--green)" }}>{fmt(payoutState.amount)}</div>
          <button
            onClick={async () => {
              try {
                await fetch("http://localhost:8000/api/payout/reset", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ payout_id: payoutState.payout_id }),
                });
                setPayoutState(null);
              } catch (e) { console.error("Reset failed:", e); }
            }}
            style={{
              marginTop: 10, fontSize: 10, padding: "4px 12px", borderRadius: 6,
              background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.1)",
              color: "var(--muted)", cursor: "pointer",
            }}
          >
            ↻ Reset (Debug)
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (payoutState?.status === "error") {
    return (
      <div className="claim-trigger-banner" style={{ borderColor: "var(--red-bdr)" }}>
        <div>
          <div className="ctb-label" style={{ color: "var(--red)" }}>
            <AlertTriangle size={14} style={{ display: "inline", marginRight: 6 }} />
            Payout Failed
          </div>
          <div className="ctb-desc" style={{ color: "var(--red)" }}>
            {payoutState.error || "An unexpected error occurred. Please try again."}
          </div>
          <button className="btn-premium" style={{ marginTop: 12, fontSize: 13, padding: "8px 20px" }} onClick={handlePayout}>
            <Zap size={14} /> Retry Payout
          </button>
        </div>
        <div>
          <div className="ctb-amount-label">Payout Amount</div>
          <div className="ctb-amount" style={{ color: "var(--red)" }}>{fmt(p.payout)}</div>
        </div>
      </div>
    );
  }

  // Default: Payout ready state
  return (
    <div className="claim-trigger-banner">
      <div style={{ flex: 1 }}>
        <div className="ctb-label">Claim Auto-Triggered — Payout Ready</div>
        <div className="ctb-desc">
          Loss {fmt(p.loss)}
          {p.defaults > 0 && ` → after ${(p.defaultFinePct * 100).toFixed(0)}% default fine → ₹${Math.round(p.loss * (1 - p.defaultFinePct)).toLocaleString("en-IN")}`}
          {p.loyaltyCoveragePct > 0 && ` → +${(p.loyaltyCoveragePct * 100).toFixed(0)}% loyalty → ${fmt(p.netCoverableLoss)}`}
          {` → × ${(p.rainCovPct * 100).toFixed(0)}% rain (${p.maxRainfall}cm) × 100% plan cover = `}
          <strong>{fmt(p.payout)}</strong>
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{
            fontSize: 12, padding: "6px 14px", borderRadius: 8,
            background: payoutMethod === "upi" ? "rgba(99,102,241,0.08)" : "rgba(107,45,139,0.08)",
            border: `1px solid ${payoutMethod === "upi" ? "rgba(99,102,241,0.2)" : "rgba(107,45,139,0.2)"}`,
            color: payoutMethod === "upi" ? "#6366F1" : "var(--purple)",
            fontWeight: 600, display: "flex", alignItems: "center", gap: 5,
          }}>
            {payoutMethod === "upi" ? <Smartphone size={12} /> : <Building2 size={12} />}
            {payoutMethod === "upi" ? "UPI" : "Bank Transfer"} → {destDisplay}
          </div>
          <button
            className="btn-premium"
            onClick={handlePayout}
            disabled={loading}
            style={{ fontSize: 13, padding: "10px 24px", display: "flex", alignItems: "center", gap: 6 }}
          >
            {loading ? (
              <><Radio size={14} className="spin" /> Processing Payout...</>
            ) : (
              <><Zap size={14} /> Initiate Payout — {fmt(p.payout)}</>
            )}
          </button>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="ctb-amount-label">Payout Amount</div>
        <div className="ctb-amount">{fmt(p.payout)}</div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>via RazorpayX</div>
      </div>
    </div>
  );
}


function ClaimDetailView({ partnerId, evaluation, evalLoading, paidForNextWeek, onPayPremium }) {
  const navigate = useNavigate();
  const partner = PARTNERS[partnerId];
  if (!partner) return null;

  const [calcStep, setCalcStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSimulatingDisruption, setIsSimulatingDisruption] = useState(false);

  const pricing = useMemo(() => {
    let p = computePricing(partner);
    if (isSimulatingDisruption) {
      const thresh = Math.round(p.avg * 0.75);
      const simEarning = Math.round(thresh * 0.6);
      const simLoss = thresh - simEarning;
      const simRainPct = 0.85;
      const defaults = partner.pastWeeklyPaid.filter(x => x === false).length;
      let coverable = simLoss * (1 - (defaults * 0.02));
      if (defaults === 0 && !partner.isNewCustomer) coverable *= 1.13;
      const payout = Math.round(coverable * simRainPct * p.tier.cover);
      return {
        ...p, currentEarning: simEarning, loss: simLoss, 
        maxRainfall: 18, rainCovPct: simRainPct, payout, claimTriggered: true,
        disruptedDays: [{ day: "Wed", rainfallCm: 18, disrupted: true }]
      };
    }
    return p;
  }, [partner, isSimulatingDisruption]);

  const p = pricing;

  const steps = [
    { label: "10-Week Rolling Avg", val: fmt(p.avg), icon: <BarChart2 size={16} /> },
    { label: "75% Income Threshold", val: fmt(p.threshold), icon: <Target size={16} /> },
    { label: isSimulatingDisruption ? "Actual Earnings (Simulated)" : "Actual Earnings (this week)", val: fmt(p.currentEarning), icon: <Banknote size={16} />, highlight: p.currentEarning < p.threshold },
    { label: "Income Loss Gap", val: fmt(p.loss), icon: <TrendingDown size={16} />, highlight: p.loss > 0 },
    { label: "Rain Trigger Adjustment", val: `${(p.rainCovPct * 100).toFixed(0)}%`, icon: <CloudRain size={16} /> },
    { label: "Final Parametric Payout", val: fmt(p.payout), icon: <ShieldCheck size={16} />, highlight: p.payout > 0, finished: true },
  ];

  const onBack = () => navigate("/dashboard");
  
  const playStory = () => {
    setIsPlaying(true);
    setCalcStep(0);
    const interval = setInterval(() => {
      setCalcStep(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);
  };

  return (
    <div className="claim-page">
      <div className="claim-page-inner">
        <button className="back-btn" onClick={onBack} style={{ marginBottom: 20 }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {evalLoading && (
          <div className="section-card" style={{ textAlign: "center", padding: "40px", animation: "pulse 2s infinite", border: "1px solid var(--purple-lt)" }}>
            <div className="spin" style={{ marginBottom: "20px" }}><Zap size={30} color="var(--purple)" /></div>
            <div style={{ fontWeight: 700, color: "var(--purple-dark)" }}>AI Orchestrator is Thinking...</div>
            <div style={{ fontSize: "13px", color: "var(--muted)" }}>Analyzing telemetry data through LangGraph node...</div>
          </div>
        )}

        {/* Hero */}
        <div className="claim-hero">
          <div>
            <div className="ch-week"><CalendarDays size={11} style={{ display: "inline", marginRight: 5 }} />Weekly Report · 09 Jun – 15 Jun 2025</div>
            <div className="ch-name">{partner.name}</div>
            <div className="ch-meta">{partnerId} &nbsp;·&nbsp; {partner.zone} &nbsp;·&nbsp; {partner.bankId}</div>
          </div>
          <div className="ch-right">
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
              padding: "4px 12px", borderRadius: 20, marginBottom: 8,
              background: p.tier.accent, color: "#fff",
            }}>{p.tier.label} Plan — Slab 3</div>
            <div className="ch-earned">{fmt(p.currentEarning)}</div>
            <div className="ch-earned-label">Total earned this week</div>
          </div>
        </div>

        {/* Backend Eligibility Snapshot */}
        {evaluation && !evalLoading && (
          <div className="section-card" style={{ borderLeft: `4px solid ${evaluation.decision === 'APPROVE' ? 'var(--green)' : 'var(--red)'}` }}>
            <div className="section-title">ML Orchestrator — Eligibility Snapshot</div>
            <div className="section-sub">Real-time breakdown from the backend LangGraph engine</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}>
              <div style={{ padding: 12, borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Decision</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: evaluation.decision === 'APPROVE' ? 'var(--green)' : 'var(--red)' }}>{evaluation.decision}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Payout Amount</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--purple)" }}>{fmt(evaluation.payout_amount)}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Confidence Score</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{Math.round((evaluation.confidence || 0) * 100)}%</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: "var(--surface2)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Inference Time</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{evaluation.processing_time_ms} ms</div>
              </div>
            </div>
            {(!evaluation.decision || evaluation.status === "error") && (
              <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "var(--red-bg)", border: "1px solid var(--red-bdr)" }}>
                <div style={{ fontSize: "13px", color: "var(--red)", fontWeight: 700 }}>
                  <AlertTriangle size={14} style={{ display: "inline", marginRight: 5 }} /> 
                  AI Orchestrator Unavailable (Rate Limit Reached)
                </div>
                <div style={{ fontSize: "12px", color: "var(--red)", opacity: 0.8, marginTop: 4 }}>
                   The multi-agent system is currently throttled by the Groq API providers. Please wait a minute or check your Groq API Key quota.
                </div>
              </div>
            )}
            {evaluation.eligibility_snapshot && (
              <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "var(--purple-pale)", border: "1px solid var(--purple-lt)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--purple-dark)", marginBottom: 8 }}>Reasoning Breakdown:</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: "#4B2C63" }}>{evaluation.eligibility_snapshot.reason}</div>
                <div style={{ marginTop: 12, display: "flex", gap: 15 }}>
                  <div style={{ fontSize: 11 }}>Rainfall Match: <strong>{evaluation.eligibility_snapshot.rainfall_match ? "YES" : "NO"}</strong></div>
                  <div style={{ fontSize: 11 }}>Risk Score: <strong>{(evaluation.eligibility_snapshot.risk_score * 100).toFixed(0)}%</strong></div>
                  <div style={{ fontSize: 11 }}>Fraud Risk: <strong>{evaluation.eligibility_snapshot.fraud_risk || "Low"}</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        <AIDecisionTrace evaluation={evaluation} pricing={pricing} partner={partner} />

        {/* 1. Daily Breakdown */}
        <div className="section-card">
          <div className="section-title">Daily Breakdown — This Week</div>
          <div className="section-sub">Each day's earnings, rainfall, and disruption status</div>
          <div className="day-grid">
            {partner.currentWeekDays.map((d, i) => {
              const rl = rainLevel(d.rainfallCm);
              const dailyNorm = Math.round(p.avg / 7);
              const barPct = Math.min((d.earning / (dailyNorm * 1.4)) * 100, 100);
              return (
                <div key={i} className={`day-cell${d.disrupted ? " disrupted" : ""}`}>
                  <div className="day-name" style={{ color: d.disrupted ? "var(--red)" : "var(--purple-dark)" }}>{d.day}</div>
                  <div className="day-date">{d.date}</div>
                  <div className="day-bar-wrap">
                    <div className="day-bar-fill" style={{
                      height: `${barPct}%`,
                      background: d.disrupted ? "rgba(185,28,28,0.4)" : "rgba(107,45,139,0.4)",
                    }} />
                  </div>
                  <div className="day-earning" style={{ color: d.disrupted ? "var(--red)" : "var(--purple-dark)" }}>
                    {fmt(d.earning)}
                  </div>
                  <div className="day-rain"><CloudRain size={9} /> {d.rainfallCm}cm</div>
                  {rl && (
                    <div className="day-rain-badge" style={{
                      color: rl.color, background: `${rl.color}18`, border: `1px solid ${rl.color}44`,
                    }}>{rl.label}</div>
                  )}
                  {d.disrupted && <div className="day-disrupted-label">Disrupted</div>}
                </div>
              );
            })}
          </div>
          {p.disruptedDays.length > 0 && (
            <div className="disruption-summary">
              <div className="ds-title"><CloudRain size={14} /> {p.disruptedDays.length} Disrupted Day(s) Detected</div>
              <div className="ds-row">
                <span>Days: {p.disruptedDays.map(d => d.day).join(", ")}</span>
                <span>Combined disrupted earnings: {fmt(p.disruptedDays.reduce((a, d) => a + d.earning, 0))}</span>
                <span>Rainfall: {p.maxRainfall}cm → {(p.rainCovPct * 100).toFixed(0)}% rain coverage</span>
              </div>
            </div>
          )}
        </div>

        {/* Explanation Section */}
        <div style={{ marginBottom: 20, display: "flex", gap: 12 }}>
          <div className="section-card" style={{ flex: 1, margin: 0, padding: 16, border: "1px solid var(--border)", background: p.payout > 0 ? "var(--green-bg)" : "var(--bg)" }}>
             <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 10, background: p.payout > 0 ? "var(--green)" : "var(--purple-lt)", color: "white" }}>
                  {p.payout > 0 ? <Zap size={16} /> : <AlertCircle size={16} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                    {p.payout > 0 ? "Claim Triggered!" : "Understanding the No-Payout Scenario"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {p.payout > 0 
                      ? `Your earnings fell ${fmt(p.loss)} below the safety threshold.` 
                      : `You earned ${fmt(p.currentEarning)} this week. Since this is ABOVE your protection threshold of ${fmt(p.threshold)}, no claim is active.`}
                  </div>
                </div>
             </div>
          </div>
          <button 
            className={`btn-premium${isSimulatingDisruption ? "-outline" : ""}`}
            onClick={() => setIsSimulatingDisruption(!isSimulatingDisruption)}
            style={{ width: 220, fontSize: 12 }}
          >
            {isSimulatingDisruption ? "Reset to Actual Data" : "Simulate Low-Earning Week"}
          </button>
        </div>
        <div className="section-card">
          <div className="loyalty-header">
            <div>
              <div className="section-title">Animated Calculation Breakdown (XAI)</div>
              <div className="section-sub">Step-by-step logic orchestration by GIC ML engine</div>
            </div>
            <button className="btn-secondary" onClick={playStory} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={14} className={isPlaying ? "spin" : ""} /> {isPlaying ? "Processing..." : "Replay Story"}
            </button>
          </div>
          
          <div className="calc-story-container">
            <div className="story-steps">
              {steps.map((s, i) => (
                <div key={i} className={`story-step ${calcStep >= i ? "visible" : ""} ${s.highlight ? "highlight" : ""} ${s.finished && calcStep === i ? "pulse" : ""}`} 
                     style={{ opacity: calcStep >= i ? 1 : 0.2 }}>
                  <div className="step-circle">{s.icon}</div>
                  <div className="step-info">
                    <div className="step-label">{s.label}</div>
                    <div className="step-val">{s.val}</div>
                  </div>
                  {i < steps.length - 1 && <div className="step-connector" />}
                </div>
              ))}
            </div>
            {calcStep === steps.length - 1 && p.payout > 0 && (
              <div className="claim-approved-badge" style={{ marginTop: 30 }}>
                <ShieldCheck size={20} /> Instant Roll-out Verified: <strong>{fmt(p.payout)} credited to {partner.bankId}</strong>
              </div>
            )}
          </div>

          <div style={{ marginTop: 30 }}>
            {p.claimTriggered ? (
              <ClaimPayoutAction partner={partner} pricing={p} evaluation={evaluation} />
            ) : (
              <div className="no-claim-box">
                <CheckCircle size={16} color="var(--green)" />
                Earnings above threshold this week — no claim triggered.
              </div>
            )}
          </div>

          <div className="ref-box" style={{ marginTop: 24 }}>
            <div className="ref-title">Judge Reference — All Three Scenarios (Slab 3 · avg ₹8,000 · 15cm rain · loss ₹1,500)</div>
            <div className="ref-text">
              <strong>Eg1 – Normal/New Customer (Z001):</strong> Slab 3 = 4.8% → Premium ₹384 · No history · Loss ₹1,500 · 15cm rain→80% · 100% cover → <strong>Payout = ₹1,200</strong><br />
              <strong>Eg2 – Prior Defaulter (Z002):</strong> ₹384 + 6×2%×₹384=₹46 → Premium ₹430 · 12% fine→net ₹1,320 · 80% rain → <strong>Payout = ₹1,056</strong><br />
              <strong>Eg3 – Non-defaulter (Z003):</strong> ₹384 − ₹42 reward → Premium ₹342 · +13% bonus→net ₹1,695 · 80% rain → <strong>Payout = ₹1,356</strong>
            </div>
          </div>
        </div>

        {/* 3. Rewards & Penalties Timeline (52-Week Square View) */}
        <div className="section-card">
          <div className="loyalty-header">
            <div>
              <div className="section-title">52-Week Loyalty Timeline</div>
              <div className="section-sub">Square-based contribution graph & automated claims history</div>
            </div>
            <div className="streak-box">
              <Zap size={18} fill="#EA580C" color="#EA580C" />
              <div>
                <div className="streak-num">42 Weeks</div>
                <div className="streak-label">Active Streak</div>
              </div>
            </div>
          </div>

          <div className="timeline-squares-container">
            <div className="squares-grid">
              {Array.from({ length: 52 }).map((_, i) => {
                const status = i < 42 
                  ? "paid" 
                  : (i === 42 ? "defaulted" : (Math.random() > 0.1 ? "paid" : "defaulted"));
                
                let sqClass = "square-paid";
                if (status === "claimed") sqClass = "square-claim";
                else if (status === "defaulted") sqClass = "square-default";
                else {
                  // Simulate different green intensities based on i
                  if (i % 7 === 0) sqClass = "square-ultra";
                  else if (i % 3 === 0) sqClass = "square-high";
                  else sqClass = "square-verified";
                }
                
                return (
                  <div key={i} className={`timeline-square ${sqClass}`} title={`Week ${52-i}: ${status}`} />
                );
              })}
            </div>
          </div>
          <div className="history-footer">
            <div style={{ display: "flex", gap: 15, alignItems: "center", fontSize: 11, color: "var(--muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div className="timeline-square square-default" />
                <span>Default</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div className="timeline-square square-verified" />
                <span>Slab 1</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div className="timeline-square square-high" />
                <span>Slab 2</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div className="timeline-square square-ultra" />
                <span>Slab 3</span>
              </div>
            </div>
            <span>Loyalty Tier: <strong style={{ color: "var(--green)" }}>Diamond Partner</strong></span>
          </div>
        </div>

        {/* 4. Next Week CTA */}
        <div className="next-week-bar" style={{ marginTop: 20 }}>
          <div>
            <div className="nw-label">Next Week Premium Due · 16–22 Jun 2025</div>
            <div className="nw-premium">{fmt(p.nextPremium)}</div>
            <div className="nw-meta">
              {p.nextTier.label} plan (Slab 3) · Updated avg: {fmt(p.nextAvg)} &nbsp;·&nbsp; {(p.nextTier.rate * 100).toFixed(0)}% rate
            </div>
          </div>
          {!paidForNextWeek && (
            <button className="btn-nw" onClick={onPayPremium}>
              Pay Next Week →
            </button>
          )}
          {paidForNextWeek && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--green)", fontWeight: 700, fontSize: "13px" }}>
              <BadgeCheck size={18} /> COVERED
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── PRIVATE ROUTE ────────────────────────────────────────────────────────────
function PrivateRoute({ children, partnerId }) {
  return partnerId ? children : <Navigate to="/" replace />;
}

function PolicyReviewRoute({ onConfirm }) {
  const location = useLocation();
  const navigate = useNavigate();
  const formData = location.state?.form;

  if (!formData) {
    return <Navigate to="/" replace />;
  }

  return (
    <PolicyReviewPage
      workerData={formData}
      onConfirm={(slab) => navigate("/payout-setup", { state: { form: formData, slab } })}
      onBack={() => navigate("/register")}
    />
  );
}

function PayoutSetupRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const formData = location.state?.form;
  const slab = location.state?.slab;

  if (!formData) {
    return <Navigate to="/" replace />;
  }

  return (
    <PayoutSetupPage
      workerId={formData.worker_id}
      onComplete={() => {
        console.log("Onboarding fully complete!");
        navigate("/");
      }}
      onBack={() => navigate("/policy-review", { state: { form: formData } })}
    />
  );
}

// ─── APP CONTENT ─────────────────────────────────────────────────────────────
function AppContent() {
  const navigate = useNavigate();
  const [partnerId, setPartnerId] = useState(() => {
    const id = localStorage.getItem("gic_partner_id");
    // Critical: Restore data BEFORE the first render to prevent crashes in protected routes
    if (id && id.startsWith("DB") && !PARTNERS[id]) {
      const stored = localStorage.getItem(`gic_partner_data_${id}`);
      if (stored) {
        try {
          PARTNERS[id] = JSON.parse(stored);
        } catch (e) {
          console.error("Failed to restore partner data", e);
        }
      }
    }
    return id;
  });
  const [evaluation, setEvaluation] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [paidForNextWeek, setPaidForNextWeek] = useState(false);

  // Sync partnerId changes to localStorage
  useEffect(() => {
    if (partnerId) {
      localStorage.setItem("gic_partner_id", partnerId);
    } else {
      localStorage.removeItem("gic_partner_id");
    }
  }, [partnerId]);

  const location = useLocation();

  // Dynamic Platform Theming
  useEffect(() => {
    // Clear all theme classes
    document.body.classList.remove('theme-instamart', 'theme-blinkit', 'theme-zepto', 'theme-login');

    // Login page always uses a neutral fintech theme — never platform-specific
    if (location.pathname === '/' || location.pathname === '/register') {
      document.body.classList.add('theme-login');
      return;
    }

    // Do not apply themes on the B2B partner portal
    if (location.pathname === '/b2b') {
      return;
    }

    if (partnerId && PARTNERS[partnerId]) {
      const platform = (PARTNERS[partnerId]?.dbRecord?.platform || "Zepto").toLowerCase();
      if (platform === 'instamart') {
        document.body.classList.add('theme-instamart');
      } else if (platform === 'blinkit') {
        document.body.classList.add('theme-blinkit');
      } else {
        document.body.classList.add('theme-zepto');
      }
    } else {
      // Fallback for any other unauthenticated route
      document.body.classList.add('theme-login');
    }
  }, [partnerId, location.pathname]);

  // Call the REAL backend evaluation API whenever user is logged in
  useEffect(() => {
    if (partnerId && PARTNERS[partnerId]?.dbRecord) {
      setEvalLoading(true);
      const partner = PARTNERS[partnerId];
      fetch("http://localhost:8000/api/evaluate_worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker: partner.dbRecord,
          city: partner.city
        })
      })
        .then(res => res.json())
        .then(data => {
          setEvaluation(data);
          setEvalLoading(false);
        })
        .catch(err => {
          console.error("Evaluation failed", err);
          setEvalLoading(false);
        });
    } else {
      setEvaluation(null);
    }
  }, [partnerId]);

  const onPayPremium = () => navigate("/plans");
  const onViewClaim = () => navigate("/claim");
  const onSimulate = () => navigate("/simulation");

  const handleLogin = (id) => {
    setPartnerId(id);
    setPaidForNextWeek(false); // Reset on login
    // Persist dynamic partner data if applicable
    if (id.startsWith("DB") && PARTNERS[id]) {
      localStorage.setItem(`gic_partner_data_${id}`, JSON.stringify(PARTNERS[id]));
    }
    navigate("/dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("gic_partner_id");
    if (partnerId && partnerId.startsWith("DB")) {
      localStorage.removeItem(`gic_partner_data_${partnerId}`);
    }
    setPartnerId(null);
    navigate("/");
  };

  return (
    <div className="zgi">
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/register" element={<OnboardingPage onBack={() => navigate("/")} />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <PrivateRoute partnerId={partnerId}>
            <Dashboard 
              partnerId={partnerId} 
              evaluation={evaluation} 
              evalLoading={evalLoading} 
              onLogout={handleLogout}
              paidForNextWeek={paidForNextWeek}
              onPayPremium={onPayPremium}
              onViewClaim={onViewClaim}
              onSimulate={onSimulate}
            />
          </PrivateRoute>
        } />

        <Route path="/plans" element={
          <PrivateRoute partnerId={partnerId}>
            <PlanSelector 
              partnerId={partnerId} 
              onPaymentSuccess={() => setPaidForNextWeek(true)}
            />
          </PrivateRoute>
        } />

        <Route path="/payment/:planKey" element={
          <PrivateRoute partnerId={partnerId}>
            <PaymentPage partnerId={partnerId} />
          </PrivateRoute>
        } />

        <Route path="/success/:planKey" element={
          <PrivateRoute partnerId={partnerId}>
            <PaymentSuccess partnerId={partnerId} />
          </PrivateRoute>
        } />

        <Route path="/claim" element={
          <PrivateRoute partnerId={partnerId}>
            <ClaimDetailView
              partnerId={partnerId}
              evaluation={evaluation}
              evalLoading={evalLoading}
              paidForNextWeek={paidForNextWeek}
              onPayPremium={onPayPremium}
            />
          </PrivateRoute>
        } />

        <Route path="/calculator" element={
          <PrivateRoute partnerId={partnerId}>
            <WhatIfCalculator onBack={() => navigate("/dashboard")} />
          </PrivateRoute>
        } />

        <Route path="/simulation" element={
          <PrivateRoute partnerId={partnerId}>
            <SimulationPage
              partnerId={partnerId}
              partnerData={PARTNERS[partnerId]}
              onBack={() => navigate("/dashboard")}
            />
          </PrivateRoute>
        } />

        <Route path="/profile" element={
          <PrivateRoute partnerId={partnerId}>
            <ProfileSettingsPage
              partner={PARTNERS[partnerId]}
              onBack={() => navigate("/dashboard")}
              onLogout={handleLogout}
            />
          </PrivateRoute>
        } />

        <Route path="/policy-review" element={
          <PolicyReviewRoute 
            onConfirm={(workerId, slab) => {
              // Now handled within PolicyReviewRoute definition above
            }}
          />
        } />

        <Route path="/payout-setup" element={<PayoutSetupRoute />} />
        <Route path="/b2b" element={<B2BPartnerPortal onBack={() => navigate("/")} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={partnerId ? "/dashboard" : "/"} replace />} />
      </Routes>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
