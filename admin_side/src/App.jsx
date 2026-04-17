import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map as MapIcon } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import RegionMap from './pages/RegionMap';

import logo from './assets/logo1.png';

const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ padding: '0', marginBottom: '3rem', display: 'flex', justifyContent: 'center' }}>
        <img 
          src={logo} 
          alt="GIC Logo" 
          style={{ 
            height: '110px', 
            width: 'auto',
            objectFit: 'contain'
          }} 
        />
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
