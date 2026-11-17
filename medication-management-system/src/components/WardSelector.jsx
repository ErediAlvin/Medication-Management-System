import React from 'react';
import { Building2, Search, UserPlus, Filter, CheckCircle2 } from 'lucide-react';

export default function WardSelector({
  wards,
  selectedWardId,
  onSelectWard,
  myPatientsOnly,
  onToggleMyPatients,
  searchQuery,
  onSearchChange,
  onOpenAdmitModal,
  currentUser
}) {
  const isNurse = currentUser?.role === 'NURSE';

  return (
    <div className="ward-selector-container">
      {/* Search and Action Bar */}
      <div className="search-actions-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by Patient Name, MRN, or Bed Number..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="action-buttons-group">
          {isNurse && currentUser?.assigned_ward_id && (
            <button
              className={`btn ${myPatientsOnly ? 'btn-primary' : 'btn-outline'} btn-sm flex items-center gap-1`}
              onClick={onToggleMyPatients}
            >
              <CheckCircle2 size={16} />
              <span>My Assigned Ward ({currentUser.ward_code || 'My Ward'})</span>
            </button>
          )}

          {(currentUser?.role === 'ADMIN' || currentUser?.role === 'NURSE') && (
            <button
              className="btn btn-teal btn-sm flex items-center gap-1"
              onClick={onOpenAdmitModal}
            >
              <UserPlus size={16} />
              <span>Admit Patient</span>
            </button>
          )}
        </div>
      </div>

      {/* Ward Partition Tabs */}
      <div className="ward-tabs">
        <button
          className={`ward-tab ${selectedWardId === 'all' && !myPatientsOnly ? 'active' : ''}`}
          onClick={() => {
            if (myPatientsOnly) onToggleMyPatients();
            onSelectWard('all');
          }}
        >
          <div className="tab-title flex items-center gap-1">
            <Building2 size={16} />
            <span>All Hospital Wards</span>
          </div>
          <span className="tab-badge">
            {wards.reduce((acc, w) => acc + (w.occupied_beds || 0), 0)} Patients
          </span>
        </button>

        {wards.map((ward) => {
          const isSelected = selectedWardId === ward.id && !myPatientsOnly;
          const isNurseAssignedWard = currentUser?.assigned_ward_id === ward.id;

          return (
            <button
              key={ward.id}
              className={`ward-tab ${isSelected ? 'active' : ''}`}
              onClick={() => {
                if (myPatientsOnly) onToggleMyPatients();
                onSelectWard(ward.id);
              }}
            >
              <div className="tab-title flex items-center gap-1">
                <span>{ward.name}</span>
                {isNurseAssignedWard && (
                  <span className="assigned-dot" title="Your Assigned Ward"></span>
                )}
              </div>
              <div className="tab-stats flex items-center gap-2">
                <span className="occupancy-pill">
                  {ward.occupied_beds || 0} / {ward.capacity} Beds
                </span>
                <span className="ward-code-tag">{ward.code}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
