import { useState } from "react";
import {
    X, Building2, Zap, Database, MapPin, BarChart2,
    ShieldCheck, ChevronRight, CheckCircle, Code2,
    ArrowRight, Users, TrendingUp, AlertTriangle,
    Lock, Radio, Copy, Check, Webhook, Cpu, Activity,
    Terminal, Key
} from "lucide-react";

// ── Mock API code snippets ─────────────────────────────────────────────────────
const STEP_CODE = [
    {
        lang: "bash",
        code: `# Register your platform on GIC Partner Portal
curl -X POST https://api.gic.io/v1/partners/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "platform_name": "Zepto",
    "platform_type": "quick_commerce",
    "contact_email": "tech@zepto.team",
    "worker_count_estimate": 85000,
    "cities": ["Mumbai","Delhi","Bengaluru","Chennai"]
  }'

# Response:
# { "partner_id": "PRT-ZPT-0041", "api_key": "gic_live_sk_..." }`
    },
    {
        lang: "javascript",
        code: `// Sync your worker DB with GIC (run nightly)
const GIC = require('@gic/partner-sdk');
const client = new GIC({ apiKey: process.env.GIC_API_KEY });

// Push worker telemetry batch
await client.workers.sync({
  workers: [
    {
      worker_id: "W-129403",
      name: "Ravi Kumar",
      city: "Mumbai",
      platform: "Zepto",
      avg_weekly_income: 7200,
      active_hours_week: 42,
      gps_logs: [...],        // last 7 days
      orders_completed: 58,
    }
    // ... up to 10,000 workers per batch
  ]
});
// GIC auto-calculates risk, premium & coverage`
    },
    {
        lang: "javascript",
        code: `// GIC sends webhooks for claim events — subscribe here
await client.webhooks.subscribe({
  events: ["claim.triggered", "claim.paid", "worker.high_risk"],
  endpoint: "https://api.zepto.team/gic/webhooks",
  secret: process.env.WEBHOOK_SECRET,
});

// Webhook payload (claim.paid):
// {
//   event: "claim.paid",
//   worker_id: "W-129403",
//   amount: 1200,
//   city: "Mumbai",
//   trigger: "rainfall_18cm",
//   payout_upi: "ravi@upi",
//   timestamp: "2025-06-15T09:12:34Z"
// }

console.log("Worker protected automatically. Zero churn risk. ✓");`
    }
];

const WIZARD_STEPS = [
    {
        num: "01",
        title: "Register & Get API Keys",
        subtitle: "5-minute setup",
        icon: Lock,
        color: "#6366F1",
        description: "Create a GIC partner account, verify your platform credentials, and receive your live API keys. No sales call needed.",
        bullets: [
            "Instant API key generation",
            "Sandbox environment included",
            "Zero onboarding fee",
        ]
    },
    {
        num: "02",
        title: "Sync Worker Database",
        subtitle: "Automated nightly batch",
        icon: Database,
        color: "#7C3AED",
        description: "Push your worker records via our REST API or Kafka stream. GIC's ML pipeline runs risk scoring automatically.",
        bullets: [
            "Worker DB, GPS logs, income data",
            "Batch API up to 10K workers/call",
            "ML scoring runs in <200ms",
        ]
    },
    {
        num: "03",
        title: "Receive Webhooks & Reports",
        subtitle: "Real-time event stream",
        icon: Webhook,
        color: "#2563EB",
        description: "Get instant webhooks when claims trigger, payouts land, or workers enter high-risk zones. Full audit trail for compliance.",
        bullets: [
            "Webhook per claim event",
            "Weekly compliance report",
            "Worker welfare dashboard",
        ]
    }
];

const METRICS = [
    { val: "↓ 23%", label: "Worker Churn", sub: "avg across platforms", color: "#10B981" },
    { val: "₹0", label: "Ops Cost", sub: "fully automated claims", color: "#6366F1" },
    { val: "100%", label: "Welfare Compliance", sub: "IRDAI parametric rules", color: "#F59E0B" },
    { val: "48h", label: "Integration Time", sub: "median for mid-size platform", color: "#2563EB" },
];

function CodeBlock({ code, lang }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="b2b-code-block">
            <div className="b2b-code-header">
                <span className="b2b-code-lang">{lang}</span>
                <button className="b2b-code-copy" onClick={copy}>
                    {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                </button>
            </div>
            <pre className="b2b-code-body"><code>{code}</code></pre>
        </div>
    );
}

function MockTerminal({ logs, progress, success }) {
    return (
        <div className="b2b-terminal">
            <div className="b2b-terminal-header">
                <div className="b2b-terminal-dots">
                    <span style={{ background: "#FF5F56" }} />
                    <span style={{ background: "#FFBD2E" }} />
                    <span style={{ background: "#27C93F" }} />
                </div>
                <div className="b2b-terminal-title">gic-api-connection-test.sh</div>
            </div>
            <div className="b2b-terminal-body">
                {logs.length === 0 && <div className="b2b-terminal-idle">Click 'Run Connection Test' to verify your integration...</div>}
                {logs.map((log, i) => (
                    <div key={i} className="b2b-terminal-line">
                        <span className="b2b-terminal-prompt">$</span> {log}
                    </div>
                ))}
                {progress > 0 && progress < 100 && (
                    <div className="b2b-terminal-progress">
                        [{"#".repeat(Math.floor(progress / 5)) + ".".repeat(20 - Math.floor(progress / 5))}] {Math.floor(progress)}%
                    </div>
                )}
                {success && (
                    <div className="b2b-terminal-success">
                        <CheckCircle size={14} /> CONNECTION VERIFIED SUCCESSFULLY
                    </div>
                )}
            </div>
        </div>
    );
}

export default function B2BPartnerPortal({ onBack }) {
    const [activeStep, setActiveStep] = useState(0);
    const [showWizard, setShowWizard] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testProgress, setTestProgress] = useState(0);
    const [testLogs, setTestLogs] = useState([]);
    const [testSuccess, setTestSuccess] = useState(false);

    const runConnectionTest = () => {
        setIsTesting(true);
        setTestProgress(0);
        setTestLogs([]);
        setTestSuccess(false);

        const logs = [
            { m: "Initializing GIC Secure Handshake...", t: 400 },
            { m: "Validating API Key: gic_live_sk_8294...", t: 1200 },
            { m: "Connection established with Platform Gateway", t: 2000 },
            { m: "Syncing sample worker dataset (10 records)", t: 3000 },
            { m: "Verifying IRDAI parametric compliance nodes", t: 4500 },
            { m: "Activating Webhook: https://api.partner.io/wic/hooks", t: 5500 },
            { m: "B2B Tunnel Active. System Ready. ✓", t: 6500 },
        ];

        logs.forEach((log, i) => {
            setTimeout(() => {
                setTestLogs(prev => [...prev, log.m]);
                setTestProgress(((i + 1) / logs.length) * 100);
                if (i === logs.length - 1) {
                    setTestSuccess(true);
                    setIsTesting(false);
                }
            }, log.t);
        });
    };

    return (
        <div className="b2b-overlay" onClick={e => e.target === e.currentTarget && onBack()}>
            <div className="b2b-modal">
                {/* ── Header ── */}
                <div className="b2b-modal-header">
                    <div className="b2b-modal-logo">
                        <div className="b2b-logo-mark"><Building2 size={18} /></div>
                        <div>
                            <div className="b2b-logo-name">GIC for Platforms</div>
                            <div className="b2b-logo-sub">B2B Partner Integration Portal</div>
                        </div>
                    </div>
                    <button className="b2b-close" onClick={onBack}><X size={18} /></button>
                </div>

                <div className="b2b-modal-body">

                    {!showWizard ? (
                        <>
                            {/* ── Hero ── */}
                            <div className="b2b-hero">
                                <div className="b2b-hero-grid" />
                                <div className="b2b-hero-content">
                                    <div className="b2b-hero-badge">
                                        <Zap size={11} /> ENTERPRISE API
                                    </div>
                                    <h2 className="b2b-hero-title">
                                        Protect your gig workers.<br />
                                        <em>Automatically.</em>
                                    </h2>
                                    <p className="b2b-hero-desc">
                                        Zepto, Blinkit, Swiggy Instamart and other platforms plug into GIC's parametric insurance engine via API. Workers are covered the moment they log in. Claims pay out automatically when disruption hits — no forms, no delays.
                                    </p>
                                    <div className="b2b-hero-btns">
                                        <button className="b2b-cta-primary" onClick={() => setShowWizard(true)}>
                                            <Code2 size={15} /> View API Setup Wizard
                                        </button>
                                        <button className="b2b-cta-secondary">
                                            Download Integration Brief <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="b2b-hero-visual">
                                    <div className="b2b-flow-diagram">
                                        {[
                                            { label: "Zepto / Blinkit", sub: "Platform API", icon: Building2, color: "#6366F1" },
                                            { label: "GIC Engine", sub: "ML + Parametric", icon: Cpu, color: "#7C3AED" },
                                            { label: "Workers", sub: "Auto-protected", icon: Users, color: "#10B981" },
                                        ].map((node, i) => (
                                            <div key={i} className="b2b-flow-node-wrap">
                                                <div className="b2b-flow-node" style={{ borderColor: node.color, background: `${node.color}10` }}>
                                                    <node.icon size={18} color={node.color} />
                                                    <div className="b2b-fn-label">{node.label}</div>
                                                    <div className="b2b-fn-sub">{node.sub}</div>
                                                </div>
                                                {i < 2 && (
                                                    <div className="b2b-flow-arrow">
                                                        <div className="b2b-arrow-line" />
                                                        <ChevronRight size={12} color="var(--muted)" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ── Metrics ── */}
                            <div className="b2b-metrics">
                                {METRICS.map(m => (
                                    <div key={m.label} className="b2b-metric">
                                        <div className="b2b-metric-val" style={{ color: m.color }}>{m.val}</div>
                                        <div className="b2b-metric-label">{m.label}</div>
                                        <div className="b2b-metric-sub">{m.sub}</div>
                                    </div>
                                ))}
                            </div>

                            {/* ── What platforms share / get ── */}
                            <div className="b2b-exchange">
                                <div className="b2b-exchange-col b2b-share">
                                    <div className="b2b-col-header" style={{ color: "#6366F1" }}>
                                        <Database size={15} /> What Platforms Share
                                    </div>
                                    <div className="b2b-col-sub">Shared via secure API — GDPR & DPDP compliant</div>
                                    {[
                                        ["Worker Database", "Name, city, employment type, join date"],
                                        ["Income Telemetry", "Weekly earnings, orders completed, active hours"],
                                        ["GPS Logs", "Last 7 days location traces for disruption verification"],
                                        ["Inventory Signals", "Outlet-level operational status during disruptions"],
                                    ].map(([title, desc]) => (
                                        <div key={title} className="b2b-exchange-item">
                                            <div className="b2b-ex-dot" style={{ background: "#6366F1" }} />
                                            <div>
                                                <div className="b2b-ex-title">{title}</div>
                                                <div className="b2b-ex-desc">{desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="b2b-exchange-arrow">
                                    <ArrowRight size={20} color="var(--purple-lt)" />
                                </div>
                                <div className="b2b-exchange-col b2b-get">
                                    <div className="b2b-col-header" style={{ color: "#10B981" }}>
                                        <TrendingUp size={15} /> What Platforms Get
                                    </div>
                                    <div className="b2b-col-sub">Measurable welfare & retention outcomes</div>
                                    {[
                                        ["Reduced Worker Churn", "23% avg drop in attrition across partner platforms"],
                                        ["Welfare Compliance", "Full IRDAI-compliant parametric insurance coverage"],
                                        ["Real-Time Risk Dashboard", "Per-city risk heat maps, claim analytics, ML scores"],
                                        ["Zero Claims Ops", "GIC handles end-to-end: detection → verification → payout"],
                                    ].map(([title, desc]) => (
                                        <div key={title} className="b2b-exchange-item">
                                            <CheckCircle size={12} color="#10B981" style={{ marginTop: 3, flexShrink: 0 }} />
                                            <div>
                                                <div className="b2b-ex-title">{title}</div>
                                                <div className="b2b-ex-desc">{desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Logos ── */}
                            <div className="b2b-partners">
                                <div className="b2b-partners-label">Designed for India's top quick-commerce & delivery platforms</div>
                                <div className="b2b-partner-logos">
                                    {["Zepto", "Blinkit", "Instamart"].map(name => (
                                        <div key={name} className="b2b-partner-pill">{name}</div>
                                    ))}
                                </div>
                            </div>

                            {/* ── CTA ── */}
                            <div className="b2b-bottom-cta">
                                <div>
                                    <div className="b2b-cta-title">Ready to integrate?</div>
                                    <div className="b2b-cta-sub">3-step API wizard · 48h average integration · Dedicated support</div>
                                </div>
                                <button className="b2b-cta-primary" onClick={() => setShowWizard(true)}>
                                    <Code2 size={15} /> Open API Setup Wizard
                                </button>
                            </div>
                        </>
                    ) : (
                        // ── API WIZARD ──────────────────────────────────────────────────
                        <div className="b2b-wizard">
                            <button className="b2b-back-btn" onClick={() => setShowWizard(false)}>
                                ← Back to Overview
                            </button>

                            <div className="b2b-wizard-title">
                                <Code2 size={18} color="#6366F1" />
                                API Integration Wizard
                            </div>
                            <div className="b2b-wizard-sub">
                                Follow these 3 steps to integrate GIC parametric insurance into your platform.
                            </div>

                            {/* Step tabs */}
                            <div className="b2b-wizard-tabs">
                                {WIZARD_STEPS.map((step, i) => (
                                    <button
                                        key={i}
                                        className={`b2b-wizard-tab ${activeStep === i ? "active" : ""}`}
                                        style={activeStep === i ? { borderColor: step.color, color: step.color } : {}}
                                        onClick={() => setActiveStep(i)}
                                    >
                                        <span className="b2b-tab-num" style={activeStep === i ? { background: step.color } : {}}>{step.num}</span>
                                        <span className="b2b-tab-title">{step.title}</span>
                                        <span className="b2b-tab-sub">{step.subtitle}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Step content */}
                            {(() => {
                                const step = WIZARD_STEPS[activeStep];
                                const Icon = step.icon;
                                return (
                                    <div className="b2b-wizard-step-body">
                                        <div className="b2b-step-left">
                                            <div className="b2b-step-icon-wrap" style={{ background: `${step.color}15`, borderColor: `${step.color}30` }}>
                                                <Icon size={28} color={step.color} />
                                            </div>
                                            <div className="b2b-step-num" style={{ color: step.color }}>Step {step.num}</div>
                                            <div className="b2b-step-title">{step.title}</div>
                                            <div className="b2b-step-desc">{step.description}</div>
                                            <div className="b2b-step-bullets">
                                                {step.bullets.map(b => (
                                                    <div key={b} className="b2b-step-bullet">
                                                        <CheckCircle size={13} color={step.color} />
                                                        {b}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="b2b-step-nav">
                                                {activeStep > 0 && (
                                                    <button className="b2b-step-prev" onClick={() => setActiveStep(s => s - 1)}>
                                                        ← Previous
                                                    </button>
                                                )}
                                                {activeStep < WIZARD_STEPS.length - 1 && (
                                                    <button className="b2b-step-next" style={{ background: step.color }} onClick={() => setActiveStep(s => s + 1)}>
                                                        Next Step →
                                                    </button>
                                                )}
                                                {activeStep === WIZARD_STEPS.length - 1 && (
                                                    <button className="b2b-step-next" style={{ background: "#10B981" }}>
                                                        <CheckCircle size={14} /> Request Access
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="b2b-step-right">
                                            <div className="b2b-step-code-title">
                                                <Radio size={11} style={{ color: "#10B981" }} /> Live code sample
                                            </div>
                                            <CodeBlock code={STEP_CODE[activeStep].code} lang={activeStep === 0 ? "shell" : "javascript"} />

                                            {activeStep === 0 && (
                                                <div className="b2b-connection-test">
                                                    <div className="b2b-step-code-title" style={{ marginTop: 24 }}>
                                                        <Activity size={11} color="#6366F1" /> Connection Mock
                                                    </div>
                                                    <MockTerminal logs={testLogs} progress={testProgress} success={testSuccess} />
                                                    
                                                    {!testSuccess ? (
                                                        <button 
                                                            className={`b2b-test-btn ${isTesting ? "testing" : ""}`}
                                                            onClick={runConnectionTest}
                                                            disabled={isTesting}
                                                        >
                                                            {isTesting ? <><Zap size={14} className="spin" /> Testing...</> : 
                                                            <><Zap size={14} /> Run Connection Test</>}
                                                        </button>
                                                    ) : (
                                                        <div className="b2b-success-actions">
                                                            <div className="b2b-api-key-box">
                                                                <div className="b2b-key-label"><Key size={10} /> YOUR TEST API KEY</div>
                                                                <div className="b2b-key-val">gic_test_sk_92f0...8a1c</div>
                                                                <button className="b2b-key-copy" onClick={() => {
                                                                    navigator.clipboard.writeText("gic_test_sk_92f02b8a1c");
                                                                    alert("API Key copied to clipboard!");
                                                                }}>
                                                                    <Copy size={12} />
                                                                </button>
                                                            </div>
                                                            <button className="b2b-dashboard-btn" onClick={() => alert("Partner Dashboard coming soon!")}>
                                                                Enter Partner Dashboard <ArrowRight size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Progress */}
                                            <div className="b2b-wizard-progress">
                                                {WIZARD_STEPS.map((s, i) => (
                                                    <div
                                                        key={i}
                                                        className={`b2b-progress-dot ${i < activeStep ? "done" : i === activeStep ? "active" : ""}`}
                                                        style={i <= activeStep ? { background: s.color } : {}}
                                                    />
                                                ))}
                                                <div className="b2b-progress-label">
                                                    Step {activeStep + 1} of {WIZARD_STEPS.length}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}