import React, { useState } from 'react';
import { Shield, Lock, User, LogIn, AlertTriangle, Radio, Building2 } from 'lucide-react';
import './LoginPage.css';

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);

    // Mock authentication
    setTimeout(() => {
      if (username === 'admin' && password === 'admin') {
        onLogin();
      } else {
        setError('Invalid admin credentials');
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="l-wrap">
      <div className="l-panel">
        <div className="l-grid" />
        <div className="l-content">
          <div className="l-logo">
            <div className="l-logomark"><Shield size={20} /></div>
            <div>
              <div className="l-logotype-name">GIC Admin Console</div>
              <div className="l-logotype-sub">Control Center</div>
            </div>
          </div>
          <h1 className="l-headline">
            System management<br /><em>optimized for administrators</em>.
          </h1>
          <p className="l-desc">
            Access the core management interface for Gig Insurance Company. Monitor regional risk, manage payouts, and oversee parametric insurance automation.
          </p>
          
          <div className="l-stats" style={{ marginTop: '40px' }}>
            <div>
              <div className="l-stat-val">2.4k</div>
              <div className="l-stat-label">Active Policies</div>
            </div>
            <div>
              <div className="l-stat-val">₹14M</div>
              <div className="l-stat-label">Total Coverage</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="l-form-side">
        <div className="l-form-card">
          <div className="l-form-title">Admin Login</div>
          <div className="l-form-sub">Enter your administrative credentials to access the console</div>

          <form onSubmit={handleLogin}>
            <label className="l-field-label">Username</label>
            <div className="l-input-wrap" style={{ marginBottom: 16 }}>
              <span className="l-input-icon"><User size={15} /></span>
              <input 
                className="l-input" 
                placeholder="Admin username" 
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>

            <label className="l-field-label">Password</label>
            <div className="l-input-wrap" style={{ marginBottom: 24 }}>
              <span className="l-input-icon"><Lock size={15} /></span>
              <input 
                className="l-input" 
                type="password" 
                placeholder="Admin password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && <div className="l-error"><AlertTriangle size={14} /> {error}</div>}
            
            <button className="l-btn" type="submit" disabled={loading}>
              {loading ? <span className="spin"><Radio size={16} /></span> : <><LogIn size={16} /> Authenticate Session</>}
            </button>
          </form>

          <div className="l-hint" style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, textAlign: 'center' }}>
              Restricted Area
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
              This portal is for GIC administrators only. Unauthorized access attempts are monitored and logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
