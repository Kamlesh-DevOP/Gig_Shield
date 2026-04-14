import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map as MapIcon } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import RegionMap from './pages/RegionMap';

const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ padding: '0 0.5rem', marginBottom: '3.5rem' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 900, 
          letterSpacing: '-2.5px',
          fontFamily: "'Poppins', sans-serif",
          background: 'linear-gradient(135deg, #10B981, #C4B5FD)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: '1'
        }}>GIC</h1>
      </div>

      <nav className="nav-links">
        <NavLink
          to="/"
          className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/map"
          className={`nav-item ${location.pathname === '/map' ? 'active' : ''}`}
        >
          <MapIcon size={20} />
          <span>Regional Insights</span>
        </NavLink>
      </nav>
    </aside>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <div className="layout-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/map" element={<RegionMap />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
