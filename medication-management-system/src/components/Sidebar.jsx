import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  Building2,
  Pill,
  Activity,
  LogOut,
  ChevronDown,
  UserCheck,
  ShieldCheck,
  CalendarCheck
} from 'lucide-react';
import { api } from '../services/api';

export default function Sidebar({
  activeScreen,
  onNavigate,
  currentUser,
  onUserChange,
  onOpenCatalog,
  onSignOutClick,
  dueNowCount = 0
}) {
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
      alert('Failed to switch role: ' + err.message);
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
        return <span className="sidebar-badge badge-admin">System Admin</span>;
      case 'PHARMACIST':
        return <span className="sidebar-badge badge-pharm">Pharmacist</span>;
      case 'NURSE':
        return <span className="sidebar-badge badge-nurse">Nurse</span>;
      default:
        return <span className="sidebar-badge">{role}</span>;
    }
  };

  return (
    <aside className="shadcn-sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Activity size={20} className="text-teal-600" />
          </div>
          <div className="brand-info">
            <h1 className="brand-heading">AegisMed MMS</h1>
            <span className="brand-tagline">Clinical Inpatient Suite</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Menu */}
      <div className="sidebar-content">
        <div className="sidebar-group">
          <div className="sidebar-group-label">Clinical Core Modules</div>
          <nav className="sidebar-menu">
            {/* Page 1: Patient Registry & Wards */}
            <button
              className={`sidebar-menu-button ${activeScreen === 'patients' ? 'active' : ''}`}
              onClick={() => onNavigate('patients')}
            >
              <Users size={18} className="sidebar-menu-icon" />
              <span className="sidebar-menu-text">Patient Registry</span>
              <span className="sidebar-pill">Wards</span>
            </button>

            {/* Page 2: 3-Slot Medication Schedule & Guidance */}
            <button
              className={`sidebar-menu-button ${activeScreen === 'schedule' ? 'active' : ''}`}
              onClick={() => onNavigate('schedule')}
            >
              <Clock size={18} className="sidebar-menu-icon" />
              <span className="sidebar-menu-text">Medication Schedule</span>
              {dueNowCount > 0 ? (
                <span className="sidebar-pill-alert" title={`${dueNowCount} doses due right now`}>
                  {dueNowCount} Due
                </span>
              ) : (
                <span className="sidebar-pill">3 Slots</span>
              )}
            </button>
          </nav>
        </div>

        {/* Pharmacy & Catalog Tools */}
        <div className="sidebar-group mt-4">
          <div className="sidebar-group-label">Pharmacy Formulary</div>
          <nav className="sidebar-menu">
            <button
              className="sidebar-menu-button"
              onClick={onOpenCatalog}
            >
              <Pill size={18} className="sidebar-menu-icon text-teal-600" />
              <span className="sidebar-menu-text">Drug Formulary</span>
              <span className="sidebar-pill">Catalog</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Sidebar Footer with Active Persona Card */}
      <div className="sidebar-footer">
        {currentUser && (
          <div className="sidebar-user-card">
            <div className="flex items-center gap-2.5">
              <div className="user-avatar">
                {currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="user-details overflow-hidden">
                <div className="user-display-name truncate">{currentUser.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getRoleBadge(currentUser.role)}
                  {currentUser.ward_code && (
                    <span className="user-ward-pill">{currentUser.ward_code}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Persona Switcher Trigger */}
            <div className="relative mt-3">
              <button
                className="btn-persona-switch w-full"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={loading}
              >
                <div className="flex items-center gap-1.5">
                  <UserCheck size={14} className="text-slate-500" />
                  <span>Switch Clinical Role</span>
                </div>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {/* Persona Switcher Dropdown */}
              {dropdownOpen && (
                <div className="persona-dropdown-menu">
                  <div className="dropdown-title">Select Clinical Persona</div>
                  {demoAccounts.map(acc => (
                    <button
                      key={acc.id}
                      className={`persona-item ${acc.id === currentUser.id ? 'active' : ''}`}
                      onClick={() => handleSwitchAccount(acc)}
                    >
                      <div className="persona-name">{acc.name}</div>
                      <div className="persona-sub flex items-center gap-1 mt-0.5">
                        <span className={`role-dot dot-${acc.role.toLowerCase()}`}></span>
                        <span>{acc.role}</span>
                        {acc.ward_code && <span>• {acc.ward_code}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sign Out Button */}
            <button
              className="btn-signout mt-2 w-full flex items-center justify-center gap-1.5"
              onClick={onSignOutClick || handleLogout}
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
