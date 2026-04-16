import { useState, useMemo } from "react";
import {
  Shield, CheckCircle, ArrowLeft, ArrowRight, FileText,
  Gem, Zap, CircleDollarSign, Target, Scale,
  Lock, BadgeCheck, HelpCircle, Info
} from "lucide-react";
import Stepper from "./Stepper";

const TIERS = {
  basic: {
    key: "Slab_50",
    label: "Basic",
    rate: 0.036,
    cover: 0.50,
    accent: "#7E3DB5",
    accentPale: "rgba(126,61,181,0.08)",
    description: "Essential protection for minor disruptions."
  },
  standard: {
    key: "Slab_75",
    label: "Standard",
    rate: 0.040,
    cover: 0.75,
    accent: "#5B21B6",
    accentPale: "rgba(91,33,182,0.09)",
    description: "Most popular choice for steady gig income."
  },
  premium: {
    key: "Slab_100",
    label: "Premium",
    rate: 0.048,
    cover: 1.00,
    accent: "#3B0764",
    accentPale: "rgba(59,7,100,0.09)",
    description: "Full income replacement for any disruption."
  },
};

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function PolicyReviewPage({ workerData, onConfirm, onBack }) {
  const [selectedSlab, setSelectedSlab] = useState("Slab_75");
  const [agreed, setAgreed] = useState(false);

  const currentTier = useMemo(() =>
    Object.values(TIERS).find(t => t.key === selectedSlab) || TIERS.standard
  , [selectedSlab]);

  // Mock calculation based on typical gig worker income if actual not provided
  const avgIncome = 8500;
  const premium = Math.round(avgIncome * currentTier.rate);
  const threshold = Math.round(avgIncome * 0.75);

  const handleFinalize = () => {
    if (!agreed) return;
    onConfirm(selectedSlab);
  };

  return (
    <div className="l-wrap" style={{ gridTemplateColumns: "0.8fr 1.2fr" }}>
      {/* ── Left Sidebar Info ── */}
      <div className="l-panel" style={{ padding: "40px" }}>
        <div className="l-grid" />
        <div className="l-content">
          <div className="l-logo" style={{ marginBottom: "30px" }}>
            <div className="l-logomark"><Shield size={20} /></div>
            <div>
              <div className="l-logotype-name">GIC</div>
              <div className="l-logotype-sub">Policy Review</div>
            </div>
          </div>
          <h1 className="l-headline" style={{ fontSize: "32px" }}>
            Finalize Your<br /><em>Protection</em> Plan.
          </h1>
          <p className="l-desc" style={{ fontSize: "14px" }}>
            You're just one step away from autonomous income security. Choose your coverage slab and review your policy terms.
          </p>

          <div className="policy-highlights" style={{ marginTop: "40px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "20px" }}>
              <div style={{ color: "var(--purple-lt)" }}><Zap size={18} /></div>
              <div>
                <div style={{ color: "var(--text-on-primary)", fontSize: "14px", fontWeight: 600 }}>Zero Paperwork</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>Payouts are triggered automatically by rainfall data.</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "20px" }}>
              <div style={{ color: "var(--purple-lt)" }}><Scale size={18} /></div>
              <div>
                <div style={{ color: "var(--text-on-primary)", fontSize: "14px", fontWeight: 600 }}>Parametric Fairness</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>Fixed payouts based on verifiable weather thresholds.</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ color: "var(--purple-lt)" }}><Lock size={18} /></div>
              <div>
                <div style={{ color: "var(--text-on-primary)", fontSize: "14px", fontWeight: 600 }}>8-Week Cooling Period</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>Standard wait time to prevent adverse selection.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="l-hint" style={{ color: "rgba(255,255,255,0.4)", textAlign: "left" }}>
          <Info size={12} /> Your 10-week rolling average is estimated at {fmt(avgIncome)}.
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="policy-review-main" style={{ padding: "50px", overflowY: "auto", maxHeight: "100vh", background: "var(--bg)" }}>
        <Stepper currentStep={2} />
        
        <button className="back-btn" onClick={onBack} style={{ marginBottom: "30px", marginTop: "20px" }}>
          <ArrowLeft size={16} /> Update Work Details
        </button>

        <section>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <BadgeCheck size={20} color="var(--purple)" />
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--purple-dark)" }}>Choose Your Coverage Slab</h2>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "24px" }}>
            Select the protection level that fits your weekly budget and risk appetite.
          </p>

          <div className="slab-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "40px" }}>
            {Object.values(TIERS).map((t) => (
              <div
                key={t.key}
                onClick={() => setSelectedSlab(t.key)}
                style={{
                  padding: "20px",
                  borderRadius: "16px",
                  background: selectedSlab === t.key ? "#fff" : "var(--surface2)",
                  border: `2px solid ${selectedSlab === t.key ? t.accent : "var(--border)"}`,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: selectedSlab === t.key ? "0 10px 25px rgba(0,0,0,0.05)" : "none",
                  transform: selectedSlab === t.key ? "translateY(-2px)" : "none"
                }}
              >
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  background: selectedSlab === t.key ? t.accentPale : "rgba(0,0,0,0.05)",
                  display: "flex", alignItems: "center", justifyCenter: "center",
                  justifyContent: "center", marginBottom: "12px", color: t.accent
                }}>
                  {t.key === "Slab_100" ? <Gem size={18} /> : t.key === "Slab_75" ? <Zap size={18} /> : <Shield size={18} />}
                </div>
                <div style={{ fontWeight: 700, color: "var(--purple-dark)", fontSize: "15px" }}>{t.label}</div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "12px" }}>{t.description}</div>
                <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--mono)", color: selectedSlab === t.key ? t.accent : "var(--text)" }}>{(t.rate * 100).toFixed(1)}%</div>
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>Weekly Rate</div>
              </div>
            ))}
          </div>
        </section>

        {/* Transaction Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "40px" }}>
          <div className="card" style={{ padding: "24px", border: "1px solid var(--border)", borderRadius: "16px", background: "#fff" }}>
            <div className="card-title" style={{ marginBottom: "20px", fontSize: "12px" }}><CircleDollarSign size={14} /> Transaction Preview</div>
            <div className="detail-row"><span className="detail-label">Est. Weekly Premium</span><span className="detail-val" style={{ color: "var(--purple)", fontSize: "18px" }}>{fmt(premium)}</span></div>
            <div className="detail-row"><span className="detail-label">Coverage Tier</span><span className="detail-val">{currentTier.label}</span></div>
            <div className="detail-row"><span className="detail-label">Income Replacement</span><span className="detail-val">{(currentTier.cover * 100).toFixed(0)}%</span></div>
          </div>
          <div className="card" style={{ padding: "24px", border: "1px solid var(--border)", borderRadius: "16px", background: "#fff" }}>
            <div className="card-title" style={{ marginBottom: "20px", fontSize: "12px" }}><Target size={14} /> Policy Parameters</div>
            <div className="detail-row"><span className="detail-label">Income Threshold</span><span className="detail-val">{fmt(threshold)} (75%)</span></div>
            <div className="detail-row"><span className="detail-label">Trigger Event</span><span className="detail-val">Rain ≥ 15cm</span></div>
            <div className="detail-row"><span className="detail-label">Settlement Mode</span><span className="detail-val">Instant / Automated</span></div>
          </div>
        </div>

        {/* Terms and Conditions Accordion-style box */}
        <section style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <FileText size={18} color="var(--purple)" />
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--purple-dark)" }}>Agreement & Disclosure</h2>
          </div>
          <div style={{
            background: "#fff", border: "1.5px solid var(--border)", borderRadius: "14px",
            padding: "20px", maxHeight: "180px", overflowY: "auto", fontSize: "12px",
            color: "var(--muted)", lineHeight: "1.6", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
          }}>
            <p style={{ marginBottom: "12px" }}><strong>1. Parametric Trigger:</strong> Payouts are solely based on objective weather data from authorized meteorological stations. Personal loss claims without station-verified disruption are not eligible.</p>
            <p style={{ marginBottom: "12px" }}><strong>2. 75% Income Threshold:</strong> Payouts only trigger if your combined weekly income falls below 75% of your 10-week rolling average due to a verified disruption.</p>
            <p style={{ marginBottom: "12px" }}><strong>3. Premium Payments:</strong> Premiums are due weekly. Consecutive non-payment for more than 2 weeks will result in policy suspension and reset of your cooling period.</p>
            <p><strong>4. Fraud Policy:</strong> Any attempt to spoof GPS location or manipulate activity logs will result in immediate permanent expulsion from the GIC network and forfeiture of all premiums paid.</p>
          </div>

          <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="checkbox"
              id="agree-check"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--purple)" }}
            />
            <label htmlFor="agree-check" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text2)", cursor: "pointer" }}>
              I have read and agree to the <strong>GIC Parametric Protection Terms</strong>.
            </label>
          </div>
        </section>

        {/* Action Button */}
        <button
          className="l-btn"
          disabled={!agreed}
          onClick={handleFinalize}
          style={{
            height: "56px", fontSize: "17px",
            opacity: agreed ? 1 : 0.5,
            transform: agreed ? "none" : "none",
            background: agreed ? "var(--purple)" : "var(--muted)",
            boxShadow: agreed ? "0 10px 20px rgba(107,45,139,0.2)" : "none"
          }}
        >
          Activate My Protection <ArrowRight size={20} />
        </button>

        <div style={{ textAlign: "center", marginTop: "24px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: "var(--muted)", fontSize: "12px" }}>
          <Lock size={12} /> SSL Secured & Encrypted · GIC Node Encryption Active
        </div>
      </div>
    </div>
  );
}
