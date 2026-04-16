import { useState, useMemo } from "react";
import {
    Calculator, ChevronRight, ArrowLeft, BarChart2,
    CircleDollarSign, Target, Percent, TrendingDown,
    CloudRain, Shield, Zap, Gem, CheckCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const TIERS = {
    basic: { key: "basic", label: "Basic", tabLabel: "SLAB 1", rate: 0.036, cover: 0.50, accent: "#7E3DB5" },
    standard: { key: "standard", label: "Standard", tabLabel: "SLAB 2", rate: 0.040, cover: 0.75, accent: "#5B21B6" },
    premium: { key: "premium", label: "Premium", tabLabel: "SLAB 3", rate: 0.048, cover: 1.00, accent: "#3B0764" },
};

function getRainCov(cm) {
    if (cm < 5) return 0;
    if (cm < 10) return 0.40;
    if (cm < 15) return 0.60;
    if (cm < 20) return 0.80;
    return 1.00;
}

function computeCalc({ avgIncome, defaults, slab, rainfall, actualIncome }) {
    const tier = TIERS[slab];
    const BASE_RATE = 0.04;
    const planPremium = Math.round(avgIncome * tier.rate);
    const basePremium = Math.round(avgIncome * BASE_RATE);
    const defaultPenalty = Math.round(planPremium * defaults * 0.02);
    const isNonDefaulter = defaults === 0;
    const loyaltyReward = isNonDefaulter ? Math.round(basePremium * 0.13125) : 0;
    const weeklyPremium = planPremium + defaultPenalty - loyaltyReward;

    const threshold = Math.round(avgIncome * 0.75);
    const loss = Math.max(0, threshold - actualIncome);
    const rainCov = getRainCov(rainfall);
    const triggered = loss > 0 && rainfall >= 5;

    const defaultFinePct = defaults * 0.02;
    const loyaltyCovPct = isNonDefaulter ? 0.13 : 0;
    const netCoverableLoss = loss > 0
        ? Math.round(loss * (1 - defaultFinePct) * (1 + loyaltyCovPct))
        : 0;
    const payout = triggered
        ? Math.round(netCoverableLoss * rainCov * tier.cover)
        : 0;

    return {
        tier, planPremium, defaultPenalty, loyaltyReward, weeklyPremium,
        threshold, loss, rainCov, netCoverableLoss, payout, triggered,
        defaultFinePct, loyaltyCovPct,
    };
}

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

// ── Slider component ──────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, onChange, format, color = "var(--purple)", sublabel }) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, alignItems: "baseline" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>{label}</label>
                <span style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {format(value)}
                </span>
            </div>
            <div style={{ position: "relative" }}>
                <div style={{ height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.1s" }} />
                </div>
                <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    style={{
                        position: "absolute", top: -5, left: 0, right: 0,
                        width: "100%", opacity: 0, cursor: "pointer", height: 15,
                    }}
                />
            </div>
            {sublabel && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 5 }}>{sublabel}</div>}
        </div>
    );
}

export default function WhatIfCalculator({ onBack }) {
    const navigate = useNavigate();
    const [avgIncome, setAvgIncome] = useState(8000);
    const [defaults, setDefaults] = useState(0);
    const [slab, setSlab] = useState("premium");
    const [rainfall, setRainfall] = useState(15);
    const [actualIncome, setActualIncome] = useState(4500);

    const calc = useMemo(
        () => computeCalc({ avgIncome, defaults, slab, rainfall, actualIncome }),
        [avgIncome, defaults, slab, rainfall, actualIncome]
    );

    const planMeta = [
        { key: "basic", Icon: Shield },
        { key: "standard", Icon: Zap },
        { key: "premium", Icon: Gem },
    ];

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "28px 32px" }}>
            <div style={{ maxWidth: 1040, margin: "0 auto" }}>

                <button className="back-btn" onClick={onBack || (() => navigate("/dashboard"))}>
                    <ArrowLeft size={16} /> Back to Dashboard
                </button>

                {/* Header */}
                <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: "var(--purple-pale)", border: "1px solid var(--purple-lt)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <Calculator size={18} color="var(--purple)" />
                        </div>
                        <div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--purple-dark)", letterSpacing: -0.4 }}>
                                "What If" Premium Calculator
                            </div>
                            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                                Drag the sliders to see how income, defaults, rainfall & slab affect your premium and payout
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

                    {/* ── LEFT: Controls ── */}
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 26px" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--purple-dark)", marginBottom: 20 }}>
                            Adjust Parameters
                        </div>

                        <Slider
                            label="Rolling Avg Weekly Income"
                            value={avgIncome} min={2000} max={20000} step={100}
                            onChange={setAvgIncome}
                            format={v => fmt(v)}
                            color="var(--purple)"
                            sublabel="Your 52-week moving average — the base for all calculations"
                        />

                        <Slider
                            label="This Week's Actual Income"
                            value={actualIncome} min={0} max={avgIncome} step={100}
                            onChange={v => setActualIncome(Math.min(v, avgIncome))}
                            format={v => fmt(v)}
                            color={actualIncome < avgIncome * 0.75 ? "var(--red)" : "var(--green)"}
                            sublabel={`Threshold is ${fmt(Math.round(avgIncome * 0.75))} (75% of avg) — go below to trigger a claim`}
                        />

                        <Slider
                            label="Rainfall This Week (cm)"
                            value={rainfall} min={0} max={40} step={1}
                            onChange={setRainfall}
                            format={v => `${v}cm`}
                            color="#2563EB"
                            sublabel={`Coverage at ${rainfall}cm: ${(getRainCov(rainfall) * 100).toFixed(0)}% — trigger requires ≥5cm`}
                        />

                        <Slider
                            label="Missed Premium Payments (past 52 wks)"
                            value={defaults} min={0} max={12} step={1}
                            onChange={setDefaults}
                            format={v => v === 0 ? "None" : `${v} default${v > 1 ? "s" : ""}`}
                            color={defaults === 0 ? "var(--green)" : defaults > 4 ? "var(--red)" : "#D97706"}
                            sublabel="Each default adds 2% penalty to premium and reduces payout coverage"
                        />

                        {/* Slab selector */}
                        <div style={{ marginTop: 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>
                                Coverage Slab
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                                {planMeta.map(({ key, Icon }) => {
                                    const t = TIERS[key];
                                    const isSel = slab === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setSlab(key)}
                                            style={{
                                                background: isSel ? t.accent + "12" : "var(--surface2)",
                                                border: `1.5px solid ${isSel ? t.accent : "var(--border)"}`,
                                                borderRadius: 10, padding: "10px 8px",
                                                cursor: "pointer", textAlign: "center",
                                                transition: "all 0.18s",
                                            }}
                                        >
                                            <Icon size={16} color={isSel ? t.accent : "var(--muted)"} style={{ marginBottom: 5 }} />
                                            <div style={{ fontSize: 11, fontWeight: 700, color: isSel ? t.accent : "var(--muted)" }}>{t.label}</div>
                                            <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>{(t.rate * 100).toFixed(1)}% · {(t.cover * 100).toFixed(0)}% cover</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: Live Results ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                        {/* Premium result */}
                        <div style={{
                            background: "linear-gradient(135deg,#2D0A4E,#5B21B6)",
                            borderRadius: 16, padding: "22px 24px",
                        }}>
                            <div style={{ fontSize: 11, color: "var(--text-on-primary-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                                Weekly Premium Due
                            </div>
                            <div style={{ fontSize: 38, fontWeight: 700, color: "var(--text-on-primary)", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: -1, marginBottom: 6 }}>
                                {fmt(calc.weeklyPremium)}
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(196,168,224,0.85)", lineHeight: 1.6 }}>
                                {calc.tier.label} ({(calc.tier.rate * 100).toFixed(1)}%) × {fmt(avgIncome)} = {fmt(calc.planPremium)}
                                {calc.defaultPenalty > 0 && ` + ${fmt(calc.defaultPenalty)} penalty`}
                                {calc.loyaltyReward > 0 && ` − ${fmt(calc.loyaltyReward)} loyalty`}
                            </div>
                        </div>

                        {/* Payout result */}
                        <div style={{
                            background: calc.triggered ? "var(--green-bg)" : "var(--surface2)",
                            border: `1px solid ${calc.triggered ? "var(--green-bdr)" : "var(--border)"}`,
                            borderRadius: 16, padding: "18px 22px",
                        }}>
                            <div style={{ fontSize: 11, color: calc.triggered ? "var(--green)" : "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
                                {calc.triggered ? "Claim Payout Triggered" : "No Claim This Week"}
                            </div>
                            <div style={{ fontSize: 34, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: -1, color: calc.triggered ? "var(--green)" : "var(--muted)", marginBottom: 6 }}>
                                {fmt(calc.payout)}
                            </div>
                            {calc.triggered ? (
                                <div style={{ fontSize: 12, color: "var(--green)", opacity: 0.85, lineHeight: 1.6 }}>
                                    Loss {fmt(calc.loss)} → after adjustments: {fmt(calc.netCoverableLoss)} × {(calc.rainCov * 100).toFixed(0)}% rain × {(calc.tier.cover * 100).toFixed(0)}% slab
                                </div>
                            ) : (
                                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                                    {actualIncome >= calc.threshold
                                        ? `Income ${fmt(actualIncome)} ≥ threshold ${fmt(calc.threshold)} — no loss to cover`
                                        : `Rainfall ${rainfall}cm < 5cm minimum trigger`
                                    }
                                </div>
                            )}
                        </div>

                        {/* Slab comparison mini-table */}
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 22px" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--purple-dark)", marginBottom: 14 }}>
                                Compare All Slabs
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                                {["basic", "standard", "premium"].map((k) => {
                                    const c = computeCalc({ avgIncome, defaults, slab: k, rainfall, actualIncome });
                                    const t = TIERS[k];
                                    const isCur = k === slab;
                                    return (
                                        <div
                                            key={k}
                                            onClick={() => setSlab(k)}
                                            style={{
                                                display: "grid", gridTemplateColumns: "70px 1fr 1fr 1fr",
                                                padding: "10px 0", cursor: "pointer",
                                                borderBottom: k !== "premium" ? "1px solid var(--border)" : "none",
                                                background: isCur ? t.accent + "06" : "transparent",
                                                borderRadius: isCur ? 8 : 0,
                                                paddingLeft: isCur ? 8 : 0,
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            <div style={{ fontSize: 12, fontWeight: 700, color: isCur ? t.accent : "var(--muted)" }}>
                                                {t.label}
                                            </div>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 1 }}>PREMIUM</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "var(--purple-dark)" }}>{fmt(c.weeklyPremium)}</div>
                                            </div>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 1 }}>PAYOUT</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: c.payout > 0 ? "var(--green)" : "var(--muted)" }}>{fmt(c.payout)}</div>
                                            </div>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 1 }}>COVER</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}>{(t.cover * 100).toFixed(0)}%</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Breakdown mini */}
                        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
                            {[
                                ["Threshold (75% of avg)", fmt(calc.threshold)],
                                ["Income gap / loss", fmt(calc.loss)],
                                ["Rain coverage", `${(calc.rainCov * 100).toFixed(0)}%`],
                                ["Default fine on payout", calc.defaultPenalty > 0 ? `−${(calc.defaultFinePct * 100).toFixed(0)}%` : "None"],
                                ["Loyalty coverage bonus", calc.loyaltyReward > 0 ? `+${(calc.loyaltyCovPct * 100).toFixed(0)}%` : "None"],
                            ].map(([l, v]) => (
                                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12, borderBottom: "1px solid var(--border)" }}>
                                    <span style={{ color: "var(--muted)" }}>{l}</span>
                                    <span style={{ fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", color: "var(--text)" }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}