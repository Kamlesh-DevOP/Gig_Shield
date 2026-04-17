import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Map as MapIcon, LogOut } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import RegionMap from './pages/RegionMap';
import LoginPage from './pages/LoginPage';

import logo from './assets/logo1.png';

const Sidebar = ({ onLogout }) => {
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

      <div className="sidebar-footer">
        <button onClick={onLogout} className="logout-btn">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('admin_auth') === 'true';
  });

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('admin_auth', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin_auth');
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="layout-container">
        <Sidebar onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/map" element={<RegionMap />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;

