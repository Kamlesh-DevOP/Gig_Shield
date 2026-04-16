import { useState, useEffect } from "react";
import {
  CreditCard, Landmark, Zap, ShieldCheck, ArrowRight,
  ArrowLeft, CheckCircle2, AlertCircle, Info, Lock,
  Globe, Smartphone, Building, User, Hash, Sparkles
} from "lucide-react";
import { supabase } from "./supabaseClient";
import Stepper from "./Stepper";

export default function PayoutSetupPage({ workerId, onComplete, onBack }) {
  const [method, setMethod] = useState("upi"); // 'upi' or 'bank'
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [upiData, setUpiData] = useState({ upi_id: "" });
  const [bankData, setBankData] = useState({
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    account_holder: ""
  });

  // Fetch existing details on load
  useEffect(() => {
    async function fetchPayoutDetails() {
      if (!workerId) return;
      try {
        const { data, error } = await supabase
          .from("gigshield_workers")
          .select("payout_method, upi_id, bank_name, account_number, ifsc_code, account_holder")
          .eq("worker_id", parseInt(workerId, 10))
          .single();

        if (data && !error) {
          if (data.payout_method) setMethod(data.payout_method);
          if (data.upi_id) setUpiData({ upi_id: data.upi_id });
          if (data.account_number) {
            setBankData({
              bank_name: data.bank_name || "",
              account_number: data.account_number || "",
              ifsc_code: data.ifsc_code || "",
              account_holder: data.account_holder || ""
            });
          }
        }
      } catch (err) {
        console.error("Error fetching payout details:", err);
      } finally {
        setFetching(false);
      }
    }
    fetchPayoutDetails();
  }, [workerId]);

  const fillDemoData = () => {
    if (method === "upi") {
      setUpiData({ upi_id: "atharsh.bharat@okaxis" });
    } else {
      setBankData({
        bank_name: "HDFC Bank",
        account_number: "50100424219876",
        ifsc_code: "HDFC0001234",
        account_holder: "Atharsh Bharat"
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const details = method === "upi" ? upiData : bankData;
    
    // Validation
    if (method === "upi" && !upiData.upi_id.includes("@")) {
      setError("Please enter a valid UPI ID (e.g. name@bank)");
      setLoading(false);
      return;
    }

    try {
      // Use .update() instead of .upsert() to preserve the existing 'record' JSON data
      const payload = {
        payout_method: method,
        upi_id: method === "upi" ? upiData.upi_id : null,
        bank_name: method === "bank" ? bankData.bank_name : null,
        account_number: method === "bank" ? bankData.account_number : null,
        ifsc_code: method === "bank" ? bankData.ifsc_code : null,
        account_holder: method === "bank" ? bankData.account_holder : null,
      };

      const { error: updateError } = await supabase
        .from("gigshield_workers")
        .update(payload)
        .eq("worker_id", parseInt(workerId, 10));

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      console.error("Payout setup error:", err);
      setError("Failed to save payout details. Please ensure you have run the 'ALTER TABLE' script in Supabase.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="center-pg">
        <div className="card" style={{ textAlign: "center", padding: "60px", maxWidth: "450px" }}>
          <div className="ob-success-icon" style={{ background: "var(--green-bg)", color: "var(--green)" }}>
            <CheckCircle2 size={40} />
          </div>
          <h2 className="ob-success-title">Payouts Activated!</h2>
          <p style={{ color: "var(--muted)", marginBottom: "30px" }}>
            Your account is now ready for instant claim settlements. Redirecting to your dashboard...
          </p>
          <div className="spin"><Zap size={20} color="var(--purple)" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="l-wrap" style={{ gridTemplateColumns: "1fr 1fr" }}>
      {/* ── Left Explanation ── */}
      <div className="l-panel" style={{ padding: "60px" }}>
        <div className="l-grid" />
        <div className="l-content">
          <div className="l-logo" style={{ marginBottom: "40px" }}>
            <div className="l-logomark" style={{ background: "var(--green)" }}><Zap size={20} /></div>
            <div>
              <div className="l-logotype-name">InstantPay™</div>
              <div className="l-logotype-sub">Payout Gateway</div>
            </div>
          </div>

          <h1 className="l-headline" style={{ fontSize: "36px" }}>
            Lightning Fast<br /><em>Claim Payouts.</em>
          </h1>
          <p className="l-desc">
            We need your transaction details to ensure that when a rain disruption is detected, your insurance payout reaches you in seconds, not days.
          </p>

          <div style={{ marginTop: "50px" }}>
            <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#C4A8E0" }}>
                <Globe size={20} />
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: "15px" }}>Cross-Platform Payouts</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>Compatible with G-Pay, PhonePe, and all major banks.</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#C4A8E0" }}>
                <Zap size={20} />
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: "15px" }}>Instant Settlement</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>Autonomous trigger means money in your pocket instantly.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="secure-note" style={{ color: "rgba(255,255,255,0.4)", position: "absolute", bottom: "40px", left: "60px" }}>
          <Lock size={12} /> Bank-grade 256-bit AES Encryption
        </div>
      </div>

      {/* ── Right Form ── */}
      <div className="l-form-side" style={{ background: "var(--bg)", display: "block", paddingTop: "60px" }}>
        <div style={{ maxWidth: "460px", margin: "0 auto" }}>
          <Stepper currentStep={3} />
          <button className="back-btn" onClick={onBack} style={{ marginBottom: "24px" }}>
            <ArrowLeft size={16} /> Back to Policy Review
          </button>
          
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--purple-dark)", marginBottom: "8px" }}>Setup Your Payout Account</h2>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px", gap: "10px" }}>
            <p style={{ color: "var(--muted)", fontSize: "14px", flex: 1 }}>
              This is required for the company to process your insurance claims automatically.
            </p>
            <button 
              type="button" 
              onClick={fillDemoData}
              className="fill-btn"
              style={{
                fontSize: "12px", background: "var(--purple-pale)", color: "var(--purple)",
                border: "1px solid var(--purple-lt)", padding: "6px 12px", borderRadius: "8px",
                fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "5px"
              }}
            >
              <Sparkles size={14} /> Auto-fill Demo
            </button>
          </div>

          {/* Tabs */}
          <div className="pm-grid" style={{ marginBottom: "32px", gridTemplateColumns: "1fr 1fr" }}>
            <button 
              className={`pm-opt ${method === "upi" ? "sel" : ""}`}
              onClick={() => setMethod("upi")}
              style={{ padding: "16px" }}
            >
              <Smartphone size={18} /> UPI Transfer
            </button>
            <button 
              className={`pm-opt ${method === "bank" ? "sel" : ""}`}
              onClick={() => setMethod("bank")}
              style={{ padding: "16px" }}
            >
              <Building size={18} /> Bank Account
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {method === "upi" ? (
              <div className="l-input-wrap" style={{ marginBottom: "24px" }}>
                <label className="l-field-label">UPI ID (VPA)</label>
                <div className="l-input-wrap">
                  <span className="l-input-icon"><Smartphone size={18} /></span>
                  <input 
                    type="text" 
                    className="l-input" 
                    placeholder="e.g. mobile-num@okaxis" 
                    required 
                    value={upiData.upi_id}
                    onChange={e => setUpiData({ upi_id: e.target.value })}
                  />
                </div>
                <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)", display: "flex", gap: "6px" }}>
                  <Info size={14} /> Supports BHIM, GPay, PhonePe, Paytm
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px", marginBottom: "24px" }}>
                  <div>
                    <label className="l-field-label">Account Holder Name</label>
                    <div className="l-input-wrap">
                      <span className="l-input-icon"><User size={18} /></span>
                      <input 
                        type="text" 
                        className="l-input" 
                        placeholder="Name as per Bank Record" 
                        required 
                        value={bankData.account_holder}
                        onChange={e => setBankData({ ...bankData, account_holder: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="l-field-label">Bank Name</label>
                    <div className="l-input-wrap">
                      <span className="l-input-icon"><Landmark size={18} /></span>
                      <input 
                        type="text" 
                        className="l-input" 
                        placeholder="e.g. HDFC Bank, ICICI, SBI" 
                        required 
                        value={bankData.bank_name}
                        onChange={e => setBankData({ ...bankData, bank_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "12px" }}>
                    <div>
                      <label className="l-field-label">Account Number</label>
                      <div className="l-input-wrap">
                        <span className="l-input-icon"><CreditCard size={18} /></span>
                        <input 
                          type="text" 
                          className="l-input" 
                          placeholder="0000 0000 0000" 
                          required 
                          value={bankData.account_number}
                          onChange={e => setBankData({ ...bankData, account_number: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="l-field-label">IFSC Code</label>
                      <div className="l-input-wrap">
                        <span className="l-input-icon"><Hash size={18} /></span>
                        <input 
                          type="text" 
                          className="l-input" 
                          placeholder="HDFC000123" 
                          required 
                          value={bankData.ifsc_code}
                          onChange={e => setBankData({ ...bankData, ifsc_code: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {error && <div className="l-error" style={{ marginBottom: "20px" }}><AlertCircle size={14} /> {error}</div>}

            <button 
              type="submit" 
              className="l-btn" 
              disabled={loading}
              style={{ 
                height: "54px", 
                fontSize: "16px", 
                background: "var(--purple-dark)",
                boxShadow: "0 8px 24px rgba(59,7,100,0.2)"
              }}
            >
              {loading ? "Saving Details..." : (
                <>Finalize & Link Account <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div style={{ 
            marginTop: "32px", padding: "18px", background: "rgba(107,45,139,0.05)", 
            borderRadius: "12px", border: "1px dashed var(--purple-lt)",
            fontSize: "12px", color: "var(--muted)", lineHeight: "1.5"
          }}>
            <strong>Why is this the first preference?</strong><br />
            Our parametric engine executes payouts instantly. Without verified account details, your insurance cover remains inactive as we cannot guarantee instant rollout during emergencies.
          </div>
        </div>
      </div>
    </div>
  );
}
