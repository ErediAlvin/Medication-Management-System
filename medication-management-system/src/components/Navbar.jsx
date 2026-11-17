import React, { useState, useEffect } from 'react';
import { Shield, UserCheck, LogOut, ChevronDown, Activity, Building2, Pill } from 'lucide-react';
import { api, authStorage } from '../services/api';

export default function Navbar({ currentUser, onUserChange, onOpenCatalog }) {
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getDemoAccounts().then(res => {
      if (res.success) setDemoAccounts(res.accounts);
    }).catch(console.error);
  }, []);

  const handleSwitchAccount = async (account) => {
    try {
      setLoading(true);
      const res = await api.login(account.email, account.demoPassword);
      if (res.success) {
        onUserChange(res.user);
        setDropdownOpen(false);
      }
    } catch (err) {
      alert('Failed to switch demo account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    onUserChange(null);
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return <span className="badge badge-admin">System Admin</span>;
      case 'PHARMACIST':
        return <span className="badge badge-pharm">Hospital Pharmacist</span>;
      case 'NURSE':
        return <span className="badge badge-nurse">Hospital Nurse</span>;
      default:
        return <span className="badge">{role}</span>;
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon">
          <Activity size={24} color="#0d9488" />
        </div>
        <div>
          <h1 className="brand-title">AegisMed MMS</h1>
          <p className="brand-subtitle">Hospital Medication Management System</p>
        </div>
      </div>

      <div className="navbar-actions">
        {currentUser && (
          <div className="user-profile">
            {/* Drug Formulary Catalog Button */}
            <button
              className="btn btn-outline btn-sm flex items-center gap-1.5"
              onClick={onOpenCatalog}
              title="Open Hospital Drug Formulary & Catalog"
            >
              <Pill size={14} className="text-teal-600" />
              <span>Drug Formulary</span>
            </button>

            <div className="user-info text-right">
              <div className="user-name font-semibold">{currentUser.name}</div>
              <div className="user-meta flex items-center justify-end gap-2">
                {getRoleBadge(currentUser.role)}
                {currentUser.ward_name && (
                  <span className="ward-tag flex items-center gap-1">
                    <Building2 size={12} />
                    {currentUser.ward_code || currentUser.ward_name}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Demo Switcher */}
            <div className="relative">
              <button
                className="btn btn-secondary btn-sm flex items-center gap-1"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={loading}
              >
                <UserCheck size={14} />
                <span>Switch Role</span>
                <ChevronDown size={14} />
              </button>

              {dropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">Switch Active Clinical Persona</div>
                  {demoAccounts.map(acc => (
                    <button
                      key={acc.id}
                      className={`dropdown-item ${acc.id === currentUser.id ? 'active' : ''}`}
                      onClick={() => handleSwitchAccount(acc)}
                    >
                      <div className="font-medium text-sm">{acc.name}</div>
                      <div className="text-xs text-muted flex items-center gap-1">
                        {acc.role} {acc.ward_code ? `• ${acc.ward_code}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btn btn-outline btn-sm flex items-center gap-1"
              onClick={handleLogout}
              title="Sign Out"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
