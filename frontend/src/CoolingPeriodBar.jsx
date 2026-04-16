import { Shield, Clock, CheckCircle, Lock, Zap } from "lucide-react";

// ─── COOLING PERIOD PROGRESS BAR ─────────────────────────────────────────────
// Shows the 8-week cooling period status. Prevents adverse selection.
// Usage: <CoolingPeriodBar partner={partner} pricing={pricing} />

export default function CoolingPeriodBar({ partner, pricing }) {
    const db = partner.dbRecord || {};

    // Derive weeks active
    const weeksActive = db.weeks_active || (partner.isNewCustomer ? 3 : 52);
    const coolingComplete = db.cooling_period_completed === 1 || weeksActive >= 8;
    const coolingWeek = Math.min(weeksActive, 8);
    const pct = (coolingWeek / 8) * 100;

    // For demo users without DB records, show sensible values
    const displayWeek = partner.isNewCustomer ? 3 : coolingComplete ? 8 : coolingWeek;
    const displayPct = (displayWeek / 8) * 100;
    const isComplete = partner.isNewCustomer ? false : coolingComplete;

    if (isComplete && weeksActive > 20) {
        // Long-term member: show compact "fully unlocked" badge instead
        return (
            <div style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "var(--green-bg)", border: "1px solid var(--green-bdr)",
                borderRadius: 12, padding: "12px 18px", marginBottom: 13,
            }}>
                <CheckCircle size={18} color="var(--green)" />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>
                        Claim Eligibility: Fully Unlocked
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {weeksActive}+ weeks active · All disruption claims eligible · Anti-adverse-selection cleared
                    </div>
                </div>
                <div style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 10px",
                    borderRadius: 20, background: "var(--green-bg)",
                    color: "var(--green)", border: "1px solid var(--green-bdr)",
                    letterSpacing: 0.5,
                }}>
                    ACTIVE
                </div>
            </div>
        );
    }

    const weeksLeft = 8 - displayWeek;
    const bgColor = isComplete ? "var(--green-bg)" : "var(--purple-pale)";
    const bdrColor = isComplete ? "var(--green-bdr)" : "rgba(107,45,139,0.18)";
    const fillColor = isComplete ? "var(--green)" : "var(--purple)";
    const textColor = isComplete ? "var(--green)" : "var(--purple-dark)";

    return (
        <div style={{
            background: bgColor, border: `1px solid ${bdrColor}`,
            borderRadius: 12, padding: "14px 18px", marginBottom: 13,
        }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isComplete
                        ? <CheckCircle size={14} color="var(--green)" />
                        : <Lock size={14} color="var(--purple)" />
                    }
                    <span style={{ fontSize: 13, fontWeight: 700, color: textColor }}>
                        {isComplete ? "Cooling Period Complete — Claims Unlocked" : `Cooling Period — Week ${displayWeek} of 8`}
                    </span>
                </div>
                <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                    background: isComplete ? "var(--green-bg)" : "var(--purple-pale)",
                    color: isComplete ? "var(--green)" : "var(--purple)",
                    border: `1px solid ${bdrColor}`, letterSpacing: 0.5,
                }}>
                    {isComplete ? "UNLOCKED" : `${weeksLeft} WK LEFT`}
                </span>
            </div>

            {/* Progress bar with week ticks */}
            <div style={{ position: "relative", marginBottom: 8 }}>
                <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                        height: "100%", borderRadius: 4,
                        width: `${displayPct}%`,
                        background: fillColor,
                        transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)",
                    }} />
                </div>
                {/* Week tick marks */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(w => (
                        <div key={w} style={{
                            fontSize: 9, fontWeight: 600,
                            color: w <= displayWeek ? fillColor : "var(--muted)",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        }}>
                            <div style={{
                                width: 2, height: 4,
                                background: w <= displayWeek ? fillColor : "var(--border)",
                                borderRadius: 1,
                            }} />
                            W{w}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.55, marginTop: 8 }}>
                <strong style={{ color: textColor }}>Why this exists:</strong> Workers must pay premiums for 8 weeks before claiming —
                this prevents enrolling only before forecasted disruptions (cyclones, heavy rain). Your eligibility{" "}
                {isComplete
                    ? "is fully active. Claims process automatically."
                    : `unlocks in ${weeksLeft} week${weeksLeft !== 1 ? "s" : ""}. Keep premiums paid to maintain streak.`
                }
            </div>
        </div>
    );
}