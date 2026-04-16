import { CloudRain, Zap, Fuel, Wifi, Users, AlertTriangle, ChevronRight, Clock } from "lucide-react";

// ─── DISRUPTION TYPE SELECTOR ─────────────────────────────────────────────────
// Extended scenario picker for SimulationPage showing all 3 disruption categories.
// Usage: <DisruptionTypeTabs scenario={scenario} setScenario={fn} isRunning={bool} />

const CATEGORIES = [
    {
        id: "weather",
        label: "Weather Events",
        icon: CloudRain,
        color: "#2563EB",
        types: [
            { key: "flood", label: "Heavy Rainfall / Flood", desc: "150–250mm rain in 24h", live: true },
            { key: "cyclone", label: "Cyclone Alert", desc: "200–300mm + high winds", live: true },
            { key: "normal", label: "Normal Conditions", desc: "0–120mm random rain", live: true },
        ],
    },
    {
        id: "societal",
        label: "Societal Disruptions",
        icon: Users,
        color: "#D97706",
        types: [
            { key: "strike", label: "Transport Strike", desc: "Metro/bus halt, logistics freeze", live: false },
            { key: "curfew", label: "Government Curfew", desc: "Operational ban on movement", live: false },
            { key: "protest", label: "Civil Protest / Rally", desc: "Route blockages, zone lockdown", live: false },
        ],
    },
    {
        id: "technical",
        label: "Technical Failures",
        icon: Wifi,
        color: "#7C3AED",
        types: [
            { key: "platform_down", label: "Platform Outage", desc: "App server crash / API failure", live: false },
            { key: "fuel_shortage", label: "Fuel Shortage", desc: "Petrol unavailable, depot halt", live: false },
            { key: "isp_blackout", label: "ISP Blackout", desc: "Network / internet outage", live: false },
        ],
    },
];

export default function DisruptionTypeTabs({ scenario, setScenario, isRunning }) {
    // Derive category from scenario
    const activeCat = CATEGORIES.find(c => c.types.some(t => t.key === scenario))?.id || "weather";

    return (
        <div className="sim-disruption-selector">
            {/* Category row */}
            <div className="sim-cat-row" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isActive = activeCat === cat.id;
                    return (
                        <button
                            key={cat.id}
                            disabled={isRunning || cat.id !== "weather"}
                            className={`sim-cat-btn ${isActive ? "active" : ""}`}
                            style={isActive ? { borderColor: cat.color, color: cat.color, background: cat.color + "08" } : {}}
                        >
                            <Icon size={14} />
                            {cat.label}
                            {cat.id !== "weather" && (
                                <span className="soon-badge">SOON</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Type buttons for active category */}
            {CATEGORIES.filter(c => c.id === activeCat).map(cat => (
                <div key={cat.id} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {cat.types.map(t => (
                        <button
                            key={t.key}
                            className={`sim-scenario-btn ${scenario === t.key ? "active" : ""}`}
                            onClick={() => t.live && !isRunning && setScenario(t.key)}
                            disabled={isRunning || !t.live}
                            style={{ flex: 1, minWidth: 200 }}
                        >
                            <div className="ssb-label">
                                {t.label}
                                {t.live ? (
                                    <div className="live-pill">LIVE</div>
                                ) : (
                                    <div className="lock-icon"><Clock size={10} /></div>
                                )}
                            </div>
                            <div className="ssb-desc">{t.desc}</div>
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
}