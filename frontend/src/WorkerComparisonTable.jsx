import { useState } from "react";
import { ChevronDown, ChevronUp, Users, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Star } from "lucide-react";

// ─── BEHAVIORAL STORY COMPARISON ──────────────────────────────────────────────
// Replaces the dense data table with a human-readable narrative layout showing
// why behavioral history matters.

export default function WorkerComparisonTable() {
    const [open, setOpen] = useState(false);

    return (
        <div style={{ marginBottom: 20 }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                    borderRadius: open ? "12px 12px 0 0" : 12, padding: "16px 20px",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                    fontFamily: "var(--font)", transition: "all 0.2s",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ background: "var(--purple-pale)", padding: "6px", borderRadius: "8px" }}>
                        <Users size={18} color="var(--purple)" />
                    </div>
                    <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--purple-dark)" }}>
                            See The "Why" — A Story of 3 Drivers
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, marginTop: 2 }}>
                            Same income, same plan, same storm. Why do they get different payouts?
                        </div>
                    </div>
                </div>
                {open ? <ChevronUp size={20} color="var(--muted)" /> : <ChevronDown size={20} color="var(--muted)" />}
            </button>

            {open && (
                <div style={{
                    background: "var(--surface)", border: "1px solid var(--border)", borderTop: "none",
                    borderRadius: "0 0 12px 12px", padding: "30px", overflow: "hidden",
                    animation: "slide-up 0.3s ease"
                }}>
                    <div style={{ textAlign: "center", marginBottom: "26px", fontSize: "13px", color: "var(--muted)" }}>
                        <strong style={{ color: "var(--purple)" }}>The Setup:</strong> All 3 drivers earned an average of <strong>₹8,000</strong> a week, selected the <strong>Premium (100%)</strong> Slab, and lost <strong>₹1,500</strong> this week due to identical heavy rainfall.
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
                        
                        {/* Driver 1: Arjun (New) */}
                        <div style={{ background: "#F8FAFC", borderRadius: "16px", padding: "24px", border: "1px solid #E2E8F0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                                <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#E0E7FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px" }}>
                                    AS
                                </div>
                                <div>
                                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B" }}>Arjun</div>
                                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#4F46E5", letterSpacing: "0.5px" }}>NEW DRIVER</div>
                                </div>
                            </div>
                            <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6", marginBottom: "20px", minHeight: "80px" }}>
                                Arjun just joined the platform. Since he has no payment history, the AI calculates his premium exactly exactly by the book. No bonuses, no penalties.
                            </div>
                            
                            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                                    <span style={{ fontSize: "12px", color: "#64748B" }}>Weekly Premium</span>
                                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", fontFamily: "var(--mono)" }}>₹384</span>
                                </div>
                                <div style={{ height: "1px", background: "#E2E8F0", margin: "10px 0" }} />
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: "12px", color: "#64748B" }}>Claim Payout</span>
                                    <span style={{ fontSize: "16px", fontWeight: "800", color: "#0F172A", fontFamily: "var(--mono)" }}>₹1,200</span>
                                </div>
                            </div>
                        </div>

                        {/* Driver 2: Manoj (Defaulter) */}
                        <div style={{ background: "#FEF2F2", borderRadius: "16px", padding: "24px", border: "1px solid #FECACA" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                                <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px" }}>
                                    MK
                                </div>
                                <div>
                                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B" }}>Manoj</div>
                                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#DC2626", letterSpacing: "0.5px" }}>MISSED PAYMENTS</div>
                                </div>
                            </div>
                            <div style={{ fontSize: "13px", color: "#7F1D1D", lineHeight: "1.6", marginBottom: "20px", minHeight: "80px" }}>
                                Manoj missed <strong>6 weekly premium payments</strong> this year. Because the platform took the risk of covering him while he defaulted, he incurs a default penalty.
                            </div>
                            
                            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #FECACA" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                                    <span style={{ fontSize: "12px", color: "#64748B" }}>Weekly Premium</span>
                                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#DC2626", fontFamily: "var(--mono)", display: "flex", alignItems: "center", gap: "4px" }}>
                                        <TrendingUp size={14} /> ₹430
                                    </span>
                                </div>
                                <div style={{ height: "1px", background: "#E2E8F0", margin: "10px 0" }} />
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: "12px", color: "#64748B" }}>Claim Payout</span>
                                    <span style={{ fontSize: "16px", fontWeight: "800", color: "#DC2626", fontFamily: "var(--mono)", display: "flex", alignItems: "center", gap: "4px" }}>
                                        <TrendingDown size={16} /> ₹1,056
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Driver 3: Priya (Loyal) */}
                        <div style={{ background: "#F0FDF4", borderRadius: "16px", padding: "24px", border: "1px solid #BBF7D0", position: "relative" }}>
                            <div style={{ position: "absolute", top: "-10px", right: "20px", background: "#22C55E", padding: "4px 10px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "4px", color: "white", fontSize: "10px", fontWeight: "800", letterSpacing: "0.5px" }}>
                                <Star size={10} fill="white" /> TOP RATED
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                                <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#DCFCE7", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px" }}>
                                    PD
                                </div>
                                <div>
                                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B" }}>Priya</div>
                                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#16A34A", letterSpacing: "0.5px" }}>52 WEEKS LOYAL</div>
                                </div>
                            </div>
                            <div style={{ fontSize: "13px", color: "#14532D", lineHeight: "1.6", marginBottom: "20px", minHeight: "80px" }}>
                                Priya pays on time, every single week. Her consistency creates trust. The AI rewards this behavior by giving her a massive discount and boosting her payouts.
                            </div>
                            
                            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #BBF7D0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                                    <span style={{ fontSize: "12px", color: "#64748B" }}>Weekly Premium</span>
                                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#16A34A", fontFamily: "var(--mono)", display: "flex", alignItems: "center", gap: "4px" }}>
                                        <TrendingDown size={14} /> ₹342
                                    </span>
                                </div>
                                <div style={{ height: "1px", background: "#E2E8F0", margin: "10px 0" }} />
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: "12px", color: "#64748B" }}>Claim Payout</span>
                                    <span style={{ fontSize: "16px", fontWeight: "800", color: "#16A34A", fontFamily: "var(--mono)", display: "flex", alignItems: "center", gap: "4px" }}>
                                        <TrendingUp size={16} /> ₹1,356
                                    </span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}