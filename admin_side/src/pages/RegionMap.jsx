import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';

const INDIA_TOPO_JSON = "https://raw.githubusercontent.com/Anujarya300/bubble_maps/master/data/geography-data/india.topo.json";

// Hardcoded coordinates for Indian cities since DB only has city names
const CITY_COORDINATES = {
  'Mumbai': [72.8777, 19.0760],
  'Delhi': [77.2090, 28.6139],
  'Bangalore': [77.5946, 12.9716],
  'Bengaluru': [77.5946, 12.9716],
  'Hyderabad': [78.4867, 17.3850],
  'Ahmedabad': [72.5714, 23.0225],
  'Chennai': [80.2707, 13.0827],
  'Kolkata': [88.3639, 22.5726],
  'Surat': [72.8311, 21.1702],
  'Pune': [73.8567, 18.5204],
  'Jaipur': [75.7873, 26.9124],
  'Lucknow': [80.9462, 26.8467],
  'Kanpur': [80.3319, 26.4499],
  'Nagpur': [79.0882, 21.1458],
  'Indore': [75.8577, 22.7196],
  'Thane': [72.9781, 19.1970],
  'Bhopal': [77.4126, 23.2599],
  'Visakhapatnam': [83.2185, 17.6868],
  'Patna': [85.1376, 25.5941],
  'Vadodara': [73.1812, 22.3072],
  'Ghaziabad': [77.4538, 28.6692],
  'Ludhiana': [75.8573, 30.9010],
  'Agra': [78.0081, 27.1767],
  'Nashik': [73.7898, 19.9975],
  'Faridabad': [77.3178, 28.4089],
  'Meerut': [77.7064, 28.9845],
  'Rajkot': [70.7923, 22.3039],
  'Kalyan-Dombivli': [73.1461, 19.2403],
  'Vasai-Virar': [72.7933, 19.3919],
  'Varanasi': [82.9962, 25.3176],
  'Srinagar': [74.7973, 34.0837],
  'Aurangabad': [75.3433, 19.8762],
  'Dhanbad': [86.4304, 23.7957],
  'Amritsar': [74.8723, 31.6340],
  'Navi Mumbai': [73.0297, 19.0330],
  'Allahabad': [81.8463, 25.4358],
  'Howrah': [88.3248, 22.5958],
  'Gwalior': [78.1828, 26.2124],
  'Jabalpur': [79.9339, 23.1815],
  'Coimbatore': [76.9558, 11.0168],
  'Vijayawada': [80.6480, 16.5062],
  'Jodhpur': [73.0243, 26.2389],
  'Madurai': [78.1198, 9.9252],
  'Raipur': [81.6296, 21.2514],
  'Kota': [75.8243, 25.2138]
};

const RegionMap = () => {
  const [cityData, setCityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        setLoading(true);
        const { data: workers, error } = await supabase
          .from('gigshield_workers')
          .select('worker_id, record');
        
        if (error) throw error;

        const { data: decisions, error: decErr } = await supabase
          .from('gigshield_decisions')
          .select('worker_id, payout_amount')
          .gt('payout_amount', 0);
          
        if (decErr) throw decErr;

        const payoutM = {};
        decisions.forEach(d => {
           payoutM[d.worker_id] = (payoutM[d.worker_id] || 0) + (d.payout_amount || 0);
        });

        const citiesObj = {};

        workers.forEach(w => {
          const rec = w.record;
          // Capitalize first letter to match dictionary
          let rawCity = (rec.city || 'Unknown').trim();
          if (rawCity !== 'Unknown') {
              rawCity = rawCity.charAt(0).toUpperCase() + rawCity.slice(1).toLowerCase();
          }

          if (!citiesObj[rawCity]) {
             const coords = CITY_COORDINATES[rawCity];
             if (coords) {
                 citiesObj[rawCity] = { 
                   name: rawCity, 
                   lat: coords[1], 
                   long: coords[0], 
                   workers: 0, 
                   premium: 0, 
                   payout: 0 
                 };
             }
          }
          
          if (citiesObj[rawCity]) {
              citiesObj[rawCity].workers += 1;
              const premium = parseFloat(rec.premium_amount || 0);
              const estimatedPremium = premium || (rec.selected_slab?.toLowerCase().includes('premium') ? 1500 : 500);
              citiesObj[rawCity].premium += estimatedPremium;
              citiesObj[rawCity].payout += payoutM[w.worker_id] || 0;
          }
        });

        setCityData(Object.values(citiesObj));
      } catch (err) {
        console.error("Map fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMapData();
  }, []);

  const sizeScale = scaleLinear()
    .domain([0, Math.max(...cityData.map(c => c.workers), 1)])
    .range([5, 16]); 

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <h3 className="gradient-text">Locating Gig Workers...</h3>
      </div>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="map-page animate-fade-in" onMouseMove={(e) => {
      if(tooltipContent) {
        setTooltipPos({ x: e.clientX, y: e.clientY });
      }
    }}>
      <div className="flex-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 style={{color: '#F8FAFC'}}>City Coverage Insights</h2>
          <p className="text-secondary">Viewing active worker distribution across operational cities.</p>
        </div>
      </div>
      
      <div className="map-wrapper glass-panel" style={{ minHeight: '75vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 1300,
            center: [81, 23] 
          }}
          width={900}
          height={700}
          style={{ width: "100%", height: "100%" }}
        >
            {/* Render Base State Map */}
            <Geographies geography={INDIA_TOPO_JSON}>
              {({ geographies }) =>
                geographies.map((geo, index) => {
                  // A palette of sleek, modern dark-jewel tones to make it colorful but professional
                  const colors = ['#1E1B4B', '#172554', '#064E3B', '#0F172A', '#312E81', '#111827'];
                  const geoColor = colors[index % colors.length];

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={geoColor} 
                      stroke="rgba(167, 139, 250, 0.45)" // Purple-lt colored neon stroke
                      strokeWidth={1.5}
                      style={{
                        default: { outline: "none", transition: "fill 0.3s" },
                        hover: { outline: "none", fill: "#8B5CF6", cursor: "pointer" },
                        pressed: { outline: "none" }
                      }}
                    />
                  );
                })
              }
            </Geographies>

            {/* Render City Markers */}
            {cityData.map((city, i) => (
              <Marker 
                key={i} 
                coordinates={[city.long, city.lat]}
                onMouseEnter={() => {
                  setTooltipContent(city);
                }}
                onMouseLeave={() => {
                  setTooltipContent(null);
                }}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", cursor: "pointer" },
                  pressed: { outline: "none" }
                }}
              >
                {/* Glow effect */}
                <circle r={sizeScale(city.workers) + 3} fill="rgba(139, 92, 246, 0.3)" />
                <circle r={sizeScale(city.workers)} fill="#8B5CF6" stroke="#FFFFFF" strokeWidth={1.5} />
              </Marker>
            ))}
        </ComposableMap>
      </div>

      {tooltipContent && (
        <div 
          className="map-tooltip" 
          style={{ 
            left: tooltipPos.x + 15, 
            top: tooltipPos.y + 15 
          }}
        >
          <div className="tooltip-title">{tooltipContent.name}</div>
          <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
            <div className="flex-between">
              <span className="text-secondary">Workers Locally:</span>
              <strong style={{fontFamily: 'Inter, sans-serif'}}>{tooltipContent.workers}</strong>
            </div>
            <div className="flex-between">
              <span className="text-secondary">City Premium:</span>
              <strong className="text-accent" style={{fontFamily: 'Inter, sans-serif'}}>{formatCurrency(tooltipContent.premium)}</strong>
            </div>
            <div className="flex-between">
              <span className="text-secondary">Rolled Out:</span>
              <strong className="text-danger" style={{fontFamily: 'Inter, sans-serif'}}>{formatCurrency(tooltipContent.payout)}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionMap;
