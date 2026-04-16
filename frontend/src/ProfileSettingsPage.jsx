import { useState } from "react";
import {
  User, Shield, CreditCard, Bell, Lock,
  LogOut, ArrowLeft, ChevronRight, Zap,
  Smartphone, Landmark, MapPin, Briefcase,
  CheckCircle2, AlertCircle, Save, BadgeCheck,
  ShieldCheck, Info
} from "lucide-react";

export default function ProfileSettingsPage({ partner, onBack, onLogout }) {
  const [activeTab, setActiveTab] = useState("profile"); // 'profile', 'payout', 'plan', 'security'
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const tabs = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "payout", label: "Payout Details", icon: CreditCard },
    { id: "plan", label: "Insurance Plan", icon: Zap },
    { id: "security", label: "Security", icon: Lock },
  ];

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  };

  // Helper to get plan display name
  const getPlanDisplay = () => {
    return partner.chosenPlan === "premium" ? "GIC Premium Cover" : "GIC Standard Cover";
  };

  return (
    <div style={{
      display: "flex",
      background: "var(--bg)",
      fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
      minHeight: "100vh"
    }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: "280px",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh"
      }}>
        <div style={{ padding: "32px 24px" }}>
          <button
            className="back-btn"
            onClick={onBack}
            style={{
              marginBottom: "32px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              padding: "0"
            }}
          >
            <ArrowLeft size={16} /> Dashboard
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, var(--purple-lt), var(--purple))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: 600,
              color: "white"
            }}>
              {partner.avatar}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "15px" }}>{partner.name}</div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>Worker ID: {partner.id.replace("DB", "")}</div>
            </div>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {tabs.map(Tab => (
              <button
                key={Tab.id}
                onClick={() => setActiveTab(Tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "none",
                  background: activeTab === Tab.id ? "var(--purple-pale)" : "transparent",
                  color: activeTab === Tab.id ? "var(--purple)" : "var(--muted)",
                  fontWeight: activeTab === Tab.id ? 500 : 400,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "left",
                  width: "100%"
                }}
              >
                <Tab.icon size={18} /> {Tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div style={{ marginTop: "auto", padding: "24px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onLogout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "var(--red)",
              background: "rgba(239, 68, 68, 0.05)",
              fontWeight: 500,
              cursor: "pointer",
              fontSize: "13px",
              transition: "all 0.2s"
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, padding: "48px 64px", overflowY: "auto", maxHeight: "100vh" }}>

        {activeTab === "profile" && (
          <div style={{ maxWidth: "620px" }}>
            <div style={{ marginBottom: "32px" }}>
              <h1 style={{ fontSize: "28px", fontWeight: 600, color: "var(--purple-dark)", marginBottom: "6px", letterSpacing: "-0.3px" }}>Profile Settings</h1>
              <p style={{ color: "var(--muted)", fontSize: "14px" }}>Manage your personal identity and platform association.</p>
            </div>

            <div style={{
              background: "var(--surface)",
              borderRadius: "20px",
              padding: "28px",
              marginBottom: "32px",
              border: "1px solid var(--border)"
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Full Name</label>
                  <input
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      fontSize: "14px",
                      color: "var(--text)",
                      opacity: 0.7
                    }}
                    value={partner.name}
                    readOnly
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Worker ID</label>
                  <input
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      fontSize: "14px",
                      color: "var(--text)",
                      opacity: 0.7
                    }}
                    value={partner.id.replace("DB", "")}
                    readOnly
                  />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Phone Number</label>
                  <input
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      fontSize: "14px",
                      color: "var(--text)"
                    }}
                    defaultValue="+91 98765 43210"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>City</label>
                  <input
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      fontSize: "14px",
                      color: "var(--text)",
                      opacity: 0.7
                    }}
                    value={partner.city}
                    readOnly
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Platform</label>
                  <input
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      fontSize: "14px",
                      color: "var(--text)",
                      opacity: 0.7
                    }}
                    value={partner.zone.split(" / ")[0]}
                    readOnly
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                background: "var(--purple)",
                color: "white",
                fontWeight: 500,
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {loading ? "Saving..." : saved ? <><CheckCircle2 size={16} /> Changes Saved</> : <><Save size={16} /> Update Profile</>}
            </button>
          </div>
        )}

        {activeTab === "payout" && (
          <div style={{ maxWidth: "620px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <h1 style={{ fontSize: "28px", fontWeight: 600, color: "var(--purple-dark)", marginBottom: "6px", letterSpacing: "-0.3px" }}>Payout Accounts</h1>
                <p style={{ color: "var(--muted)", fontSize: "14px" }}>Connected accounts for instant claim settlements.</p>
              </div>
              <div style={{
                background: "rgba(16, 185, 129, 0.08)",
                color: "var(--green)",
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                border: "1px solid rgba(16, 185, 129, 0.2)"
              }}>
                <ShieldCheck size={14} /> Account Verified
              </div>
            </div>

            <div style={{
              padding: "28px",
              border: "2px solid var(--purple-lt)",
              background: "var(--purple-pale)",
              borderRadius: "20px",
              marginBottom: "28px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--purple)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                }}>
                  {partner.payout_method === "upi" ? <Smartphone size={26} /> : <Landmark size={26} />}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--text)", marginBottom: "2px" }}>
                    {partner.payout_method === "upi" ? partner.upi_id : `A/C: ${partner.account_number}`}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Primary {partner.payout_method === "upi" ? "UPI" : "Bank"} Account
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <button style={{
                    background: "white",
                    border: "1px solid var(--border)",
                    padding: "6px 16px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    color: "var(--text)"
                  }}>Edit</button>
                </div>
              </div>
            </div>

            <div style={{
              background: "var(--surface)",
              padding: "20px",
              borderRadius: "14px",
              border: "1px solid var(--border)"
            }}>
              <h4 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px", color: "var(--text)" }}>
                <Info size={14} color="var(--purple)" /> Why verify your account?
              </h4>
              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: "1.5" }}>
                Our autonomous claims engine uses this account for <strong>Lightning Fast Payouts</strong> during red-alert weather events. Keep this updated to avoid delays.
              </p>
            </div>
          </div>
        )}

        {activeTab === "plan" && (
          <div style={{ maxWidth: "620px" }}>
            <div style={{ marginBottom: "32px" }}>
              <h1 style={{ fontSize: "28px", fontWeight: 600, color: "var(--purple-dark)", marginBottom: "6px", letterSpacing: "-0.3px" }}>Active Coverage</h1>
              <p style={{ color: "var(--muted)", fontSize: "14px" }}>Details about your current paramilitary protection plan.</p>
            </div>

            <div style={{
              background: "linear-gradient(135deg, #2D0A4E 0%, #3B0764 100%)",
              color: "#fff",
              padding: "32px",
              borderRadius: "20px",
              position: "relative",
              overflow: "hidden",
              marginBottom: "28px"
            }}>
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", opacity: 0.7, marginBottom: "8px" }}>Active Policy</div>
                <div style={{ fontSize: "26px", fontWeight: 600, marginBottom: "8px", letterSpacing: "-0.3px" }}>
                  {getPlanDisplay()}
                </div>
                <div style={{ fontSize: "13px", opacity: 0.9, display: "flex", alignItems: "center", gap: "6px" }}>
                  <BadgeCheck size={14} color="#C4A8E0" /> 100% Income Replacement Slab Active
                </div>
              </div>
              <div style={{ position: "absolute", bottom: "-24px", right: "-24px", opacity: 0.08, zIndex: 0 }}>
                <Shield size={140} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{
                background: "var(--surface)",
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid var(--border)"
              }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Weekly Premium</div>
                <div style={{ fontSize: "22px", fontWeight: 600, color: "var(--purple-dark)", fontFamily: "'Poppins', monospace" }}>₹320</div>
              </div>
              <div style={{
                background: "var(--surface)",
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid var(--border)"
              }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Next Renewal</div>
                <div style={{ fontSize: "22px", fontWeight: 600, color: "var(--purple-dark)", fontFamily: "'Poppins', monospace" }}>22 Jun '25</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div style={{ maxWidth: "620px" }}>
            <div style={{ marginBottom: "32px" }}>
              <h1 style={{ fontSize: "28px", fontWeight: 600, color: "var(--purple-dark)", marginBottom: "6px", letterSpacing: "-0.3px" }}>Security & Privacy</h1>
              <p style={{ color: "var(--muted)", fontSize: "14px" }}>Manage your password and account security settings.</p>
            </div>

            <div style={{
              background: "var(--surface)",
              borderRadius: "20px",
              padding: "28px",
              marginBottom: "32px",
              border: "1px solid var(--border)"
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Current Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      fontSize: "14px",
                      color: "var(--text)"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      fontSize: "14px",
                      color: "var(--text)"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      fontSize: "14px",
                      color: "var(--text)"
                    }}
                  />
                </div>
              </div>
            </div>

            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                background: "var(--purple)",
                color: "white",
                fontWeight: 500,
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              <Lock size={16} /> Update Password
            </button>
          </div>
        )}
      </main>
    </div>
  );
}