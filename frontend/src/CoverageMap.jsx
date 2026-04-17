import { useState, useEffect, useMemo } from "react";
import {
    Users, CloudRain, ShieldCheck, Activity, MapPin, 
    Zap, RefreshCw, Loader2, Info, Radio, AlertTriangle
} from "lucide-react";
import { 
    ComposableMap, 
    Geographies, 
    Geography, 
    Marker, 
    ZoomableGroup 
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { supabase } from "./supabaseClient";

// ── Configuration ─────────────────────────────────────────────────────────────
const INDIA_TOPO_JSON = "https://raw.githubusercontent.com/Anujarya300/bubble_maps/master/data/geography-data/india.topo.json";

const CITY_COORDS = {
    Delhi: [77.2090, 28.6139],
    Mumbai: [72.8777, 19.0760],
    Bengaluru: [77.5946, 12.9716],
    Chennai: [80.2707, 13.0827],
    Kolkata: [88.3639, 22.5726],
    Hyderabad: [78.4867, 17.3850],
    Pune: [73.8567, 18.5204],
    Ahmedabad: [72.5714, 23.0225],
};

const RISK_COLORS = {
    green: { fill: "#10B981", glow: "rgba(16,185,129,0.35)", label: "Low Risk", bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
    amber: { fill: "#F59E0B", glow: "rgba(245,158,11,0.35)", label: "Moderate", bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
    red: { fill: "#EF4444", glow: "rgba(239,68,68,0.4)", label: "High Risk", bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
};

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function CoverageMapTab({ partnerId, partnerData }) {
    const [cityData, setCityData] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedCity, setSelectedCity] = useState(null);
    const [liveHazard, setLiveHazard] = useState(null);
    const [hazardLoading, setHazardLoading] = useState(false);
    const [recentClaims, setRecentClaims] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const userCity = partnerData?.city || "Chennai";

    const fetchData = async () => {
        try {
            setRefreshing(true);
            const { data: workers, error: wErr } = await supabase
                .from('gic_workers')
                .select('record');

            if (wErr) throw wErr;

            const cities = {};
            workers.forEach(w => {
                const rec = w.record;
                const cname = rec.city || "Unknown";
                if (!cities[cname]) {
                    cities[cname] = {
                        workers: 0,
                        rainfallSum: 0,
                        rainfallCount: 0,
                        maxRain: 0,
                        coords: CITY_COORDS[cname] || null
                    };
                }
                cities[cname].workers += 1;
                cities[cname].rainfallSum += (rec.rainfall_cm || 0);
                cities[cname].rainfallCount += 1;
                if (rec.rainfall_cm > cities[cname].maxRain) cities[cname].maxRain = rec.rainfall_cm;
            });

            Object.keys(cities).forEach(cname => {
                const c = cities[cname];
                c.avgRain = c.rainfallSum / c.rainfallCount;
                if (c.maxRain > 15) c.riskLevel = "red";
                else if (c.maxRain > 8) c.riskLevel = "amber";
                else c.riskLevel = "green";
            });

            setCityData(cities);

            const { data: claims, error: cErr } = await supabase
                .from('gic_decisions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (cErr) throw cErr;
            setRecentClaims(claims);

        } catch (err) {
            console.error("Error fetching coverage data:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Fetch Live Hazard from MCP when city is selected
    useEffect(() => {
        if (selectedCity) {
            setHazardLoading(true);
            setLiveHazard(null);
            const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
            fetch(`${API_BASE_URL}/api/hazard/check`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ city: selectedCity })
            })
            .then(res => res.json())
            .then(data => {
                setLiveHazard(data);
                setHazardLoading(false);
            })
            .catch(err => {
                console.error("Hazard check failed", err);
                setHazardLoading(false);
            });
        }
    }, [selectedCity]);

    const totalWorkers = useMemo(() => Object.values(cityData).reduce((a, c) => a + c.workers, 0), [cityData]);
    const totalPayouts = useMemo(() => recentClaims.reduce((a, c) => a + (c.payout_amount || 0), 0), [recentClaims]);
    const highRiskCities = useMemo(() => Object.values(cityData).filter(c => c.riskLevel === "red").length, [cityData]);

    const filteredClaims = useMemo(() => {
        if (!selectedCity) return [];
        return recentClaims.filter(c => 
            c.payload_json?.city === selectedCity || 
            (selectedCity === "Bengaluru" && c.payload_json?.city === "Bangalore")
        ).slice(0, 5);
    }, [selectedCity, recentClaims]);

    const maxWorkers = Math.max(...Object.values(cityData).map(c => c.workers), 1);
    const sizeScale = scaleLinear()
        .domain([0, maxWorkers])
        .range([6, 24]);

    if (loading) {
        return (
            <div className="cmap-root loading-state">
                <Loader2 className="spin" size={40} color="var(--purple)" />
                <div className="loading-text">Syncing High-Fidelity Coverage Map...</div>
            </div>
        );
    }

    const cityInfo = selectedCity ? cityData[selectedCity] : null;
    const cityRisk = cityInfo ? RISK_COLORS[cityInfo.riskLevel] : null;

    return (
        <div className="cmap-root">
            {/* ── Summary strip ── */}
            <div className="cmap-stats-row">
                {[
                    { Icon: Users, label: "Total Active Workers", val: totalWorkers.toLocaleString("en-IN"), color: "#6366F1" },
                    { Icon: ShieldCheck, label: "Operational Hubs", val: Object.keys(cityData).length, color: "#10B981" },
                    { Icon: Activity, label: "Total Claims Disbursed", val: fmt(totalPayouts), color: "#F59E0B" },
                    { Icon: Zap, label: "Critical Risk Zones", val: highRiskCities, color: "#EF4444" },
                ].map(({ Icon, label, val, color }) => (
                    <div className="cmap-stat" key={label}>
                        <div className="cmap-stat-icon" style={{ background: `${color}18`, color }}>
                            <Icon size={16} />
                        </div>
                        <div>
                            <div className="cmap-stat-val" style={{ color }}>{val}</div>
                            <div className="cmap-stat-label">{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="cmap-body">
                {/* ── Professional Geographical Map ── */}
                <div className="cmap-map-wrap">
                    <div className="cmap-map-header">
                        <div className="cmap-map-title">
                            <MapPin size={13} /> Resource Distribution & Risk Heatmap
                            {refreshing && <RefreshCw size={12} className="spin" style={{ marginLeft: 8, opacity: 0.6 }} />}
                        </div>
                        {partnerData && (
                            <div className="cmap-user-zone">
                                <Info size={12} /> Your Zone: <strong style={{ color: "var(--purple)" }}>{partnerData.zone}</strong>
                            </div>
                        )}
                        <div className="cmap-legend">
                            {Object.entries(RISK_COLORS).map(([key, val]) => (
                                <span key={key} className="cmap-legend-item">
                                    <span className="cmap-legend-dot" style={{ background: val.fill }} />
                                    {val.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="cmap-viz-container">
                        <ComposableMap
                            projection="geoMercator"
                            projectionConfig={{
                                scale: 1200,
                                center: [82, 22] 
                            }}
                            width={800}
                            height={700}
                        >
                            <ZoomableGroup zoom={1} disablePanning disableZooming>
                                <Geographies geography={INDIA_TOPO_JSON}>
                                    {({ geographies }) =>
                                        geographies.map((geo) => (
                                            <Geography
                                                key={geo.rsmKey}
                                                geography={geo}
                                                fill="rgba(107, 45, 139, 0.04)"
                                                stroke="rgba(107, 45, 139, 0.2)"
                                                strokeWidth={0.8}
                                                style={{
                                                    default: { outline: "none" },
                                                    hover: { fill: "rgba(107, 45, 139, 0.08)", outline: "none" },
                                                    pressed: { outline: "none" }
                                                }}
                                            />
                                        ))
                                    }
                                </Geographies>

                                {Object.entries(cityData).map(([city, data]) => {
                                    if (!data.coords) return null;
                                    const r = sizeScale(data.workers);
                                    const risk = RISK_COLORS[data.riskLevel];
                                    const isSelected = selectedCity === city;
                                    const isUserCity = userCity.toLowerCase().includes(city.toLowerCase());

                                    return (
                                        <Marker 
                                            key={city} 
                                            coordinates={data.coords}
                                            onClick={() => setSelectedCity(city === selectedCity ? null : city)}
                                        >
                                            <g style={{ cursor: "pointer" }}>
                                                {/* Pulse / Glow Background */}
                                                {(data.riskLevel === "red" || isUserCity) && (
                                                    <circle 
                                                        r={r + (isSelected ? 10 : 6)} 
                                                        fill={isUserCity ? "rgba(126,61,181,0.2)" : risk.glow} 
                                                        className="cmap-pulse-ring" 
                                                    />
                                                )}
                                                {/* Main Marker */}
                                                <circle
                                                    r={r}
                                                    fill={risk.fill}
                                                    stroke={isUserCity ? "var(--purple-dark)" : isSelected ? "#fff" : "rgba(255,255,255,0.4)"}
                                                    strokeWidth={isUserCity ? 4 : isSelected ? 3 : 1.5}
                                                    style={{ transition: "all 0.4s ease" }}
                                                />
                                                {/* User Home Label */}
                                                {isUserCity && (
                                                    <text 
                                                        textAnchor="middle" 
                                                        y={r + 15} 
                                                        fontSize={10} 
                                                        fontWeight="800" 
                                                        fill="var(--purple-dark)"
                                                        style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                                                    >
                                                        Your Hub
                                                    </text>
                                                )}
                                            </g>
                                        </Marker>
                                    );
                                })}
                            </ZoomableGroup>
                        </ComposableMap>
                    </div>
                </div>

                {/* ── Site-Specific Detail Panel ── */}
                <div className="cmap-detail-panel">
                    {!selectedCity ? (
                        <div className="cmap-empty-panel">
                            <Info size={32} color="var(--purple-lt)" style={{ opacity: 0.5, marginBottom: 15 }} />
                            <div className="cmap-empty-title">Region Explorer</div>
                            <div className="cmap-empty-sub">Select a bubble on the map to trigger live MCP hazard analysis and local worker telemetry.</div>
                            
                            <div className="cmap-city-list">
                                {Object.entries(cityData).sort((a,b) => b[1].workers - a[1].workers).map(([city, data]) => (
                                    <div key={city} className="cmap-city-row" onClick={() => setSelectedCity(city)}>
                                        <span className="cmap-city-dot" style={{ background: RISK_COLORS[data.riskLevel].fill }} />
                                        <span className="cmap-city-name">{city}</span>
                                        <span className="cmap-city-workers">{data.workers.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="cmap-city-detail animate-slide-in">
                            <div className="ccd-header" style={{ borderBottom: `2px solid ${cityRisk.fill}` }}>
                                <div>
                                    <div className="ccd-city-name">{selectedCity} Hub</div>
                                    <div className="ccd-risk-badge" style={{ background: cityRisk.bg, color: cityRisk.text }}>
                                        {cityRisk.label}
                                    </div>
                                </div>
                                <button className="ccd-close" onClick={() => setSelectedCity(null)}>✕</button>
                            </div>

                            {/* Live MCP Hazard Intelligence */}
                            <div className="ccd-hazard-panel">
                                <div className="chp-title">
                                    <Radio size={12} /> Live MCP Intelligence
                                    {hazardLoading && <RefreshCw size={11} className="spin" style={{ marginLeft: 8 }} />}
                                </div>
                                {hazardLoading ? (
                                    <div className="chp-loading">Querying weather news & crowd signals...</div>
                                ) : liveHazard ? (
                                    <div className="chp-content">
                                        <div className="chp-weather">
                                            <div className="chpw-icon"><CloudRain size={20} color="#2563EB" /></div>
                                            <div>
                                                <div className="chpw-val">{liveHazard.weather?.condition || "Moderate Rain"}</div>
                                                <div className="chpw-label">Local Environment Triggers</div>
                                            </div>
                                        </div>
                                        {liveHazard.news && (
                                            <div className="chp-news">
                                                <div className="chpn-title"><AlertTriangle size={11} /> High-Priority Headlines</div>
                                                <div className="chpn-headline">{liveHazard.news.headline || `Heavy waterlogging reported in various parts of ${selectedCity}.`}</div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="chp-error">Unable to sync live hazard stream.</div>
                                )}
                            </div>

                            <div className="ccd-stats">
                                <div className="ccd-stat">
                                    <div className="ccd-stat-icon" style={{ color: "#6366F1", background: "#6366F115" }}><Users size={14} /></div>
                                    <div>
                                        <div className="ccd-stat-val">{cityInfo.workers.toLocaleString()}</div>
                                        <div className="ccd-stat-label">Active Force</div>
                                    </div>
                                </div>
                                <div className="ccd-stat">
                                    <div className="ccd-stat-icon" style={{ color: "#2563EB", background: "#2563EB15" }}><CloudRain size={14} /></div>
                                    <div>
                                        <div className="ccd-stat-val">{cityInfo.maxRain.toFixed(1)}cm</div>
                                        <div className="ccd-stat-label">Peak Intensity</div>
                                    </div>
                                </div>
                            </div>

                            <div className="ccd-claims">
                                <div className="ccd-claims-title">Recent Network Payouts</div>
                                {filteredClaims.length > 0 ? (
                                    <div className="ccd-claims-list">
                                        {filteredClaims.map(c => (
                                            <div key={c.id} className="ccd-claim-row">
                                                <div className="ccd-claim-id">ID-{c.trace_id.substring(0,6)}</div>
                                                <div className="ccd-claim-amount">{fmt(c.payout_amount)}</div>
                                                <div className="ccd-claim-status">
                                                    <span className={c.decision === "APPROVE" ? "status-paid" : "status-proc"}>
                                                        {c.decision}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="ccd-no-claims">
                                        No recent claims detected in this operational zone.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}