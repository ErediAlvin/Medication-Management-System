import React, { useState } from 'react';
import {
  Activity,
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  LogIn
} from 'lucide-react';
import { api } from '../services/api';

export default function LoginScreen({ onLoginSuccess, isLoggedOutNotice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loggedOutBanner, setLoggedOutBanner] = useState(isLoggedOutNotice);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setLoggedOutBanner(false);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both your hospital email and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login(email.trim(), password.trim());
      if (res.success && res.user) {
        let targetScreen = 'patients';
        if (res.user.role === 'NURSE') {
          targetScreen = 'schedule';
        } else if (res.user.role === 'PHARMACIST') {
          targetScreen = 'patients';
        } else if (res.user.role === 'ADMIN') {
          targetScreen = 'patients';
        }
        onLoginSuccess(res.user, targetScreen);
      } else {
        setError(res.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-card">
        {/* Brand Header */}
        <div className="login-header">
          <div className="login-logo-icon">
            <Activity size={32} color="#ffffff" />
          </div>
          <h1 className="login-brand-title">AegisMed MMS</h1>
          <p className="login-brand-subtitle">
            Clinical Workstation &amp; Inpatient Medication Portal
          </p>
        </div>

        <div className="login-body">
          {/* Logged Out Success Notice */}
          {loggedOutBanner && (
            <div className="login-alert login-alert-success">
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong style={{ display: 'block', fontWeight: 700 }}>Session Terminated Safely</strong>
                <span>You have been securely signed out. Patient data remains locked and protected.</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="login-alert login-alert-error">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong style={{ display: 'block', fontWeight: 700 }}>Authentication Failed</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label className="login-label">Hospital Email Address</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  className="login-input"
                  placeholder="e.g. staff.member@hospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">Clinical Access Password</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input login-input-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="login-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="login-spinner" />
                  <span>Authenticating Station...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Sign In to Station</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Compliance Footer */}
        <div className="login-footer">
          <p className="login-footer-text">
            <ShieldCheck size={12} color="#059669" />
            <span>Encrypted Inpatient System &bull; HIPAA &amp; Separation of Duties Enforced</span>
          </p>
        </div>
      </div>
    </div>
  );
}
