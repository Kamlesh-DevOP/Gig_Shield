import { useEffect, useState, useRef } from "react";

// ─── MARKET SCALE STRIP ───────────────────────────────────────────────────────
// Animated count-up numbers for the Login page left panel.
// Also exports LivePayoutTicker for the rolling "last payout" feed.

function useCountUp(target, duration = 1200, start = false) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!start) return;
        let startTime = null;
        const step = (ts) => {
            if (!startTime) startTime = ts;
            const progress = Math.min((ts - startTime) / duration, 1);
            // ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setVal(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [target, duration, start]);
    return val;
}

function AnimatedStat({ value, suffix = "", prefix = "", label, decimals = 0, delay = 0, started }) {
    const [active, setActive] = useState(false);
    useEffect(() => {
        if (!started) return;
        const t = setTimeout(() => setActive(true), delay);
        return () => clearTimeout(t);
    }, [started, delay]);
    const display = useCountUp(value, 1200, active);
    const formatted = decimals > 0 ? display.toFixed(decimals) : display.toLocaleString("en-IN");
    return (
        <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-on-primary-muted)", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: -0.5 }}>
                {prefix}{formatted}{suffix}
            </div>
            <div style={{ fontSize: 11, color: "rgba(250,248,255,0.45)", letterSpacing: 1, textTransform: "uppercase", marginTop: 2, fontWeight: 500 }}>
                {label}
            </div>
        </div>
    );
}

// ── Live payout ticker ────────────────────────────────────────────────────────
const MOCK_EVENTS = [
    { worker: "Arjun S.", city: "Chennai", amount: "₹1,200", time: "2 min ago" },
    { worker: "Priya D.", city: "Chennai", amount: "₹1,356", time: "4 min ago" },
    { worker: "Ravi K.", city: "Mumbai", amount: "₹1,440", time: "7 min ago" },
    { worker: "Meena R.", city: "Kolkata", amount: "₹980", time: "11 min ago" },
    { worker: "Suresh M.", city: "Pune", amount: "₹1,120", time: "15 min ago" },
    { worker: "Anitha B.", city: "Bengaluru", amount: "₹760", time: "18 min ago" },
    { worker: "Vijay P.", city: "Hyderabad", amount: "₹1,680", time: "22 min ago" },
];

export function LivePayoutTicker() {
    const [idx, setIdx] = useState(0);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setVisible(false);
            setTimeout(() => {
                setIdx(i => (i + 1) % MOCK_EVENTS.length);
                setVisible(true);
            }, 400);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    const ev = MOCK_EVENTS[idx];

    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 8,
            opacity: visible ? 1 : 0, transition: "opacity 0.4s",
            background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "6px 12px",
            border: "1px solid rgba(255,255,255,0.1)",
        }}>
            <div style={{
                width: 7, height: 7, borderRadius: "50%", background: "#4ADE80",
                animation: "livepulse 1.8s ease-in-out infinite", flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: "rgba(250,248,255,0.7)" }}>
                Last payout:{" "}
                <strong style={{ color: "var(--text-on-primary-muted)" }}>{ev.amount}</strong>
                {" "}→ {ev.worker}, {ev.city} · {ev.time}
            </span>
        </div>
    );
}

// ── Main market stats section ─────────────────────────────────────────────────
export function MarketStatsRow({ started = true }) {
    return (
        <div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.12)", marginBottom: 20, position: "relative", zIndex: 1 }} />
            {/* Primary stats */}
            <div style={{ display: "flex", gap: 32, position: "relative", zIndex: 1, marginBottom: 14 }}>
                <AnimatedStat value={3200} suffix="+" label="Partners Covered" started={started} delay={0} />
                <AnimatedStat value={84} suffix="L+" label="Claims Paid" started={started} delay={150} />
                <AnimatedStat value={91} suffix="%" label="Accuracy Rate" started={started} delay={300} />
            </div>
            {/* Market size stats */}
            <div style={{ display: "flex", gap: 28, position: "relative", zIndex: 1, marginBottom: 14 }}>
                <AnimatedStat value={455} prefix="₹" suffix="B" label="Gig Market by FY2030" started={started} delay={450} />
                <AnimatedStat value={23} suffix="M+" label="Workers by 2030" started={started} delay={600} />
                <AnimatedStat value={0} suffix=" Competitors" label="First Mover" started={started} delay={750} />
            </div>
            {/* Platform partners */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                {["Zepto", "Blinkit", "Instamart"].map(p => (
                    <span key={p} style={{
                        fontSize: 10, fontWeight: 600, padding: "3px 10px",
                        borderRadius: 20, background: "rgba(255,255,255,0.08)",
                        color: "rgba(250,248,255,0.55)", border: "1px solid rgba(255,255,255,0.12)",
                        letterSpacing: 0.3,
                    }}>
                        {p}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default MarketStatsRow;