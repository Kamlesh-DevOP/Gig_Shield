import { useState } from "react";
import { CloudRain, X, TrendingDown, Zap, ChevronRight, AlertTriangle } from "lucide-react";

// ─── NEXT WEEK RISK BANNER ────────────────────────────────────────────────────
// Proactive intelligence: shows predicted disruption for upcoming week.
// Usage: <NextWeekRiskBanner partner={partner} pricing={pricing} onPayPremium={fn} />

const CITY_FORECASTS = {
    "Chennai": { rain: 18, prob: 0.78, alert: "IMD Orange Alert", season: "SW Monsoon active" },
    "Mumbai": { rain: 22, prob: 0.82, alert: "IMD Red Alert", season: "Heavy monsoon season" },
    "Bengaluru": { rain: 12, prob: 0.55, alert: "IMD Yellow Alert", season: "Moderate rainfall expected" },
    "Hyderabad": { rain: 8, prob: 0.35, alert: "No Alert", season: "Low disruption risk" },
    "Kolkata": { rain: 25, prob: 0.88, alert: "IMD Red Alert", season: "Cyclone season active" },
    "Delhi": { rain: 5, prob: 0.22, alert: "No Alert", season: "Dry spell continuing" },
    "Pune": { rain: 16, prob: 0.65, alert: "IMD Orange Alert", season: "Monsoon onset expected" },
    "Ahmedabad": { rain: 6, prob: 0.28, alert: "No Alert", season: "Low risk period" },
};

function getRainCovPct(cm) {
    if (cm < 5) return 0;
    if (cm < 10) return 0.40;
    if (cm < 15) return 0.60;
    if (cm < 20) return 0.80;
    return 1.00;
}

function getRiskLevel(prob) {
    if (prob >= 0.70) return { label: "HIGH", color: "#B91C1C", bg: "rgba(185,28,28,0.07)", bdr: "rgba(185,28,28,0.2)" };
    if (prob >= 0.40) return { label: "MEDIUM", color: "#D97706", bg: "rgba(217,119,6,0.07)", bdr: "rgba(217,119,6,0.2)" };
    return { label: "LOW", color: "#0D7A56", bg: "rgba(13,122,86,0.07)", bdr: "rgba(13,122,86,0.2)" };
}

export default function NextWeekRiskBanner({ partner, pricing, onPayPremium }) {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    const city = partner.city || "Chennai";
    const forecast = CITY_FORECASTS[city] || CITY_FORECASTS["Chennai"];
    const risk = getRiskLevel(forecast.prob);

    // Only show if medium or high risk
    if (risk.label === "LOW") return null;

    const rainCov = getRainCovPct(forecast.rain);
    const estimatedLoss = Math.round(pricing.avg * 0.25); // assume 25% income loss
    const estimatedPayout = Math.round(estimatedLoss * rainCov * pricing.adjCoverPct);

    return (
        <div
            className="sticky-banner"
            style={{
                background: risk.bg, border: `1px solid ${risk.bdr}`,
                borderRadius: 12, padding: "14px 18px", marginBottom: 16,
                display: "flex", alignItems: "flex-start", gap: 14,
            }}
        >
            {/* icon */}
            <div style={{ flexShrink: 0, marginTop: 2 }}>
                <AlertTriangle size={18} color={risk.color} />
            </div>

            {/* content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: risk.color }}>
                        Next Week Risk Alert: {forecast.alert}
                    </span>
                    <span style={{
                        fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 20,
                        background: risk.bg, color: risk.color, border: `1px solid ${risk.bdr}`,
                        letterSpacing: 0.8,
                    }}>
                        {risk.label} RISK
                    </span>
                </div>

                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.55 }}>
                    IMD forecasts <strong style={{ color: risk.color }}>{forecast.rain}cm rainfall</strong> in {city} next week ({forecast.season}).
                    Disruption probability: <strong style={{ color: risk.color }}>{(forecast.prob * 100).toFixed(0)}%</strong>.
                    {" "}If triggered, estimated payout:{" "}
                    <strong style={{ color: "var(--green)" }}>~{`₹${estimatedPayout.toLocaleString("en-IN")}`}</strong>.
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                        { label: `${forecast.rain}cm rain`, Icon: CloudRain },
                        { label: `${(rainCov * 100).toFixed(0)}% rain coverage`, Icon: Zap },
                        { label: `~₹${estimatedPayout.toLocaleString("en-IN")} payout if triggered`, Icon: TrendingDown },
                    ].map(({ label, Icon }) => (
                        <div key={label} style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 11, fontWeight: 600, color: "var(--muted)",
                            background: "rgba(255,255,255,0.6)", border: "1px solid var(--border)",
                            padding: "3px 9px", borderRadius: 20,
                        }}>
                            <Icon size={11} /> {label}
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "flex-end" }}>
                <button
                    onClick={onPayPremium}
                    style={{
                        background: "var(--purple)", color: "#fff", border: "none",
                        borderRadius: 9, padding: "9px 16px", cursor: "pointer",
                        fontFamily: "var(--font)", fontSize: 12, fontWeight: 700,
                        display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                        transition: "opacity 0.18s",
                    }}
                >
                    Stay Covered <ChevronRight size={13} />
                </button>
                <button
                    onClick={() => setDismissed(true)}
                    style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--muted)", fontSize: 11, display: "flex",
                        alignItems: "center", gap: 4, fontFamily: "var(--font)",
                    }}
                >
                    <X size={11} /> Dismiss
                </button>
            </div>
        </div>
    );
}