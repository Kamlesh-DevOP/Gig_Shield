import { useEffect, useState } from "react";
import { Shield, Scan, Radio, MapPin, Users, Activity, Smartphone, Eye } from "lucide-react";

// ─── FRAUD SCORE CARD ────────────────────────────────────────────────────────
// Drop-in component for Dashboard. Shows the multi-layer fraud trust system.
// Usage: <FraudScoreCard partner={partner} pricing={pricing} />

export default function FraudScoreCard({ partner, pricing }) {
    const [animated, setAnimated] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 300);
        return () => clearTimeout(t);
    }, []);

    const db = partner.dbRecord || {};

    // Derive scores from dbRecord or use intelligent defaults
    const overallScore = db.fraud_trust_rating
        ? Math.round(db.fraud_trust_rating * 5 * 10) / 10
        : pricing.isNewCustomer ? 4.2 : pricing.defaults > 0 ? 3.1 : 4.8;

    const subScores = [
        {
            key: "gps",
            label: "GPS Integrity",
            icon: MapPin,
            score: db.gps_spoofing_score !== undefined ? Math.round((1 - db.gps_spoofing_score) * 100) : pricing.isNewCustomer ? 85 : pricing.defaults > 2 ? 68 : 94,
            desc: "Location authenticity vs spoofing detection",
            color: "#0D7A56",
        },
        {
            key: "movement",
            label: "Movement Realism",
            icon: Activity,
            score: db.movement_realism_score !== undefined ? Math.round(db.movement_realism_score * 100) : pricing.isNewCustomer ? 78 : pricing.defaults > 2 ? 72 : 96,
            desc: "Delivery route pattern vs straight-line fraud",
            color: "#5B21B6",
        },
        {
            key: "peer",
            label: "Peer Group Match",
            icon: Users,
            score: db.peer_group_activity_ratio !== undefined ? Math.round(db.peer_group_activity_ratio * 100) : pricing.isNewCustomer ? 80 : pricing.defaults > 2 ? 61 : 91,
            desc: "Activity vs outlet cohort during disruption",
            color: "#2563EB",
        },
        {
            key: "behavior",
            label: "Behavioral Score",
            icon: Eye,
            score: db.behavior_score !== undefined ? Math.round(db.behavior_score * 100) : Math.round((1 - (pricing.defaults / 52)) * 100),
            desc: "Order acceptance, login hours, decline rate",
            color: "#D97706",
        },
        {
            key: "device",
            label: "Device Trust",
            icon: Smartphone,
            score: db.device_sharing_flag === 1 ? 42 : db.ip_gps_mismatch === 1 ? 55 : pricing.isNewCustomer ? 88 : 97,
            desc: "Single device use, IP-GPS consistency",
            color: "#6B2D8B",
        },
    ];

    // Score to color
    const scoreColor = (s) => {
        if (s >= 80) return "#0D7A56";
        if (s >= 60) return "#D97706";
        return "#B91C1C";
    };
    const scoreLabel = (s) => {
        if (s >= 80) return "Good";
        if (s >= 60) return "Fair";
        return "Risk";
    };

    // Circular arc math
    const R = 42;
    const cx = 60, cy = 60;
    const circumference = 2 * Math.PI * R;
    const pct = overallScore / 5;
    const arcLen = animated ? pct * circumference * 0.75 : 0;
    const dashOffset = circumference - arcLen;

    const arcColor =
        overallScore >= 4 ? "#0D7A56" :
            overallScore >= 2.5 ? "#D97706" :
                "#B91C1C";

    const riskLabel =
        overallScore >= 4 ? "LOW RISK" :
            overallScore >= 2.5 ? "MEDIUM RISK" :
                "HIGH RISK";

    const premiumImpact =
        overallScore < 2.5
            ? `+${((2.5 - overallScore) * 0.1 * 100).toFixed(1)}% premium surcharge`
            : "No premium surcharge";

    return (
        <div
            className="card"
            style={{ marginBottom: 13 }}
        >
            <div className="card-title">
                <Shield size={13} /> Fraud Trust Score — Multi-Layer Analysis
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 24, alignItems: "center" }}>
                {/* ── Circular gauge ── */}
                <div style={{ textAlign: "center" }}>
                    <svg width={120} height={120} viewBox="0 0 120 120" style={{ overflow: "visible" }}>
                        {/* background ring */}
                        <circle
                            cx={cx} cy={cy} r={R}
                            fill="none"
                            stroke="var(--border)"
                            strokeWidth={9}
                            strokeDasharray={circumference * 0.75 + " " + circumference}
                            strokeDashoffset={circumference * 0.125}
                            strokeLinecap="round"
                            transform={`rotate(135 ${cx} ${cy})`}
                        />
                        {/* colored arc */}
                        <circle
                            cx={cx} cy={cy} r={R}
                            fill="none"
                            stroke={arcColor}
                            strokeWidth={9}
                            strokeDasharray={arcLen + " " + circumference}
                            strokeDashoffset={circumference * 0.125}
                            strokeLinecap="round"
                            transform={`rotate(135 ${cx} ${cy})`}
                            style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)" }}
                        />
                        {/* score text */}
                        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--purple-dark)" fontSize={22} fontWeight={700} fontFamily="'IBM Plex Mono',monospace">
                            {overallScore.toFixed(1)}
                        </text>
                        <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--muted)" fontSize={10} fontWeight={600}>
                            / 5.0
                        </text>
                    </svg>
                    <div style={{
                        display: "inline-block", fontSize: 10, fontWeight: 700,
                        padding: "2px 10px", borderRadius: 20, letterSpacing: 1,
                        background: arcColor + "18", color: arcColor, border: `1px solid ${arcColor}44`,
                        marginTop: 2,
                    }}>
                        {riskLabel}
                    </div>
                    <div style={{ fontSize: 11, color: arcColor === "#0D7A56" ? "var(--green)" : arcColor, marginTop: 6, fontWeight: 600 }}>
                        {premiumImpact}
                    </div>
                </div>

                {/* ── Sub-scores ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {subScores.map((s) => {
                        const Icon = s.icon;
                        const pct = animated ? s.score : 0;
                        return (
                            <div key={s.key} style={{ display: "grid", gridTemplateColumns: "24px 110px 1fr 36px", gap: 8, alignItems: "center" }}>
                                <Icon size={13} color={s.color} />
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>{s.label}</div>
                                <div style={{ height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%", borderRadius: 3,
                                        width: `${pct}%`,
                                        background: scoreColor(s.score),
                                        transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
                                    }} />
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: scoreColor(s.score), fontFamily: "'IBM Plex Mono',monospace", textAlign: "right" }}>
                                    {scoreLabel(s.score)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Fraud detection layers note ── */}
            <div style={{
                marginTop: 14, padding: "10px 14px",
                background: "var(--surface2)", borderRadius: 9,
                border: "1px solid var(--border)",
                display: "flex", gap: 10, alignItems: "flex-start",
            }}>
                <Scan size={13} color="var(--purple-lt)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
                    <strong style={{ color: "var(--purple)" }}>5-layer anti-spoofing system</strong> — GPS + movement realism + peer cohort validation + behavioral tracking + device trust.
                    {" "}Score &lt; 2.5 triggers <strong>+0.1% premium per 0.1 drop</strong>. All payouts cross-validated against outlet activity logs.
                </div>
            </div>
        </div>
    );
}