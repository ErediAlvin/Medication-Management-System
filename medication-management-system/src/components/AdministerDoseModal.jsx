import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  Pill,
  HeartPulse,
  FileText,
  AlertOctagon
} from 'lucide-react';
import { api } from '../services/api';

export default function AdministerDoseModal({
  dose,
  currentUser,
  onClose,
  onAdministered
}) {
  const [status, setStatus] = useState('ADMINISTERED');
  const [vitals, setVitals] = useState('');
  const [notes, setNotes] = useState('');
  const [verifiedFiveRights, setVerifiedFiveRights] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!dose) return null;

  const isNurse = currentUser?.role === 'NURSE';
  const isPharmacist = currentUser?.role === 'PHARMACIST';

  // Check for allergy conflict
  const patientAllergies = dose.patient_allergies || 'None';
  const hasPenicillinConflict =
    patientAllergies.toLowerCase().includes('penicillin') &&
    (dose.trade_name?.toLowerCase().includes('amoxicillin') ||
     dose.generic_name?.toLowerCase().includes('amoxicillin') ||
     dose.generic_name?.toLowerCase().includes('penicillin'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isPharmacist) {
      setError('Hospital Policy Violation: Pharmacists are strictly restricted from administering medications directly to patients.');
      return;
    }

    if (!isNurse) {
      setError('Access Denied: Only registered hospital nurses can record medication administration.');
      return;
    }

    if (!verifiedFiveRights) {
      setError('Safety Check Required: Please verify the Five Rights of Medication Administration before confirming.');
      return;
    }

    if (status === 'HELD' && !notes.trim()) {
      setError('Clinical documentation required: Please enter the clinical reason why this dose is being withheld/held.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.recordAdministration({
        dose_schedule_id: dose.id || dose.dose_id,
        status,
        notes: notes.trim(),
        vitals: vitals.trim()
      });

      if (res.success) {
        onAdministered(res.administration);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to record administration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="administer-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="administer-modal-header">
          <div className="flex items-center gap-3">
            <div className="administer-header-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="modal-title font-bold text-lg text-slate-900 m-0">
                Safe Medication Administration
              </h3>
              <p className="modal-subtitle text-xs text-slate-500 m-0">
                Module 5: Clinical verification, duplicate prevention &amp; safe dispensing
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            disabled={loading}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="administer-modal-body">
          {/* Pharmacist Safety Guard Warning */}
          {isPharmacist && (
            <div className="login-alert login-alert-error" style={{ marginBottom: 0 }}>
              <AlertOctagon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Separation of Duties Notice:</strong> You are currently logged in as a <strong>Pharmacist</strong>.
                Hospital safety protocols prohibit pharmacists from administering medications directly to patients.
              </div>
            </div>
          )}

          {/* Critical Allergy Conflict Warning Banner */}
          {hasPenicillinConflict && (
            <div className="allergy-alert-banner">
              <AlertTriangle size={22} className="text-rose-600 flex-shrink-0" style={{ marginTop: 1 }} />
              <div>
                <div className="allergy-alert-title">
                  CRITICAL ALLERGY CONFLICT WARNING!
                </div>
                <div className="allergy-alert-desc">
                  Patient <strong>{dose.patient_name}</strong> is documented allergic to <strong>'{patientAllergies}'</strong>.
                  Administering <strong>{dose.trade_name}</strong> ({dose.generic_name}) carries severe hypersensitivity / anaphylaxis risk!
                </div>
              </div>
            </div>
          )}

          {/* Submission Error Banner */}
          {error && (
            <div className="login-alert login-alert-error" style={{ marginBottom: 0 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong style={{ display: 'block', fontWeight: 700 }}>Administration Halted</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Target Dose & Patient Summary Card */}
          <div className="administer-info-card">
            <div className="patient-info-row">
              <div className="patient-badges-group">
                <span className="bed-badge">{dose.bed_number}</span>
                <span className="font-bold text-slate-900 text-sm">{dose.patient_name}</span>
                <span className="mrn-badge">MRN: {dose.mrn}</span>
              </div>
              <span className="slot-badge slot-morning-active" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                {dose.slot} ROUND
              </span>
            </div>

            <div className="medication-detail-card">
              <div>
                <div className="med-names-line">
                  <Pill size={16} className="text-teal-600 flex-shrink-0" />
                  <span>{dose.trade_name}</span>
                  <span className="text-xs font-normal text-slate-500 italic">({dose.generic_name})</span>
                </div>
                <div className="med-meta-line">
                  Dosage: <strong className="text-teal-800">{dose.dosage}</strong> &bull; Route: <strong>{dose.route}</strong> ({dose.dosage_form})
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                  Scheduled Time
                </span>
                <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 800, color: '#1e293b' }}>
                  {dose.target_time}
                </span>
              </div>
            </div>

            {dose.instructions && (
              <div className="instructions-alert-box">
                <strong>Physician/Pharmacist Instructions:</strong> {dose.instructions}
              </div>
            )}
          </div>

          {/* Administration Outcome Selector (2-Columns: ADMINISTERED or HELD) */}
          <div>
            <label className="form-label" style={{ marginBottom: 6 }}>
              Administration Outcome:
            </label>
            <div className="outcomes-selector-grid">
              <button
                type="button"
                className={`outcome-select-btn outcome-btn-administered ${status === 'ADMINISTERED' ? 'active' : ''}`}
                onClick={() => setStatus('ADMINISTERED')}
              >
                <CheckCircle2 size={18} />
                <span className="outcome-btn-title">ADMINISTERED</span>
                <span className="outcome-btn-sub">Dose dispensed</span>
              </button>

              <button
                type="button"
                className={`outcome-select-btn outcome-btn-held ${status === 'HELD' ? 'active' : ''}`}
                onClick={() => setStatus('HELD')}
              >
                <AlertTriangle size={18} />
                <span className="outcome-btn-title">HELD / WITHHELD</span>
                <span className="outcome-btn-sub">Clinical reason</span>
              </button>
            </div>
          </div>

          {/* Clinical Vitals Input */}
          <div>
            <label className="form-label" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <HeartPulse size={14} color="#e11d48" />
              <span>Patient Vitals at Dispensing:</span>
            </label>
            <input
              type="text"
              className="administer-input"
              placeholder="e.g. BP 120/80 mmHg, HR 72 bpm, SpO2 98%, Temp 36.6 C"
              value={vitals}
              onChange={(e) => setVitals(e.target.value)}
            />
          </div>

          {/* Clinical Administration Notes */}
          <div>
            <label className="form-label" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileText size={14} color="#64748b" />
              <span>Nurse Notes &amp; Patient Response:</span>
              {status === 'HELD' && (
                <span style={{ color: '#e11d48', fontWeight: 700 }}>* (Required for HELD doses)</span>
              )}
            </label>
            <textarea
              className="administer-textarea"
              rows="2"
              placeholder={
                status === 'ADMINISTERED'
                  ? 'e.g. Patient took oral dose with full glass of water, no acute discomfort.'
                  : 'Specify clinical rationale (e.g. systolic BP < 90 mmHg, scheduled for surgery fasting)...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* "Five Rights" Mandatory Verification Checkbox */}
          <div className="five-rights-container">
            <input
              type="checkbox"
              id="fiveRightsCheckbox"
              className="five-rights-checkbox"
              checked={verifiedFiveRights}
              onChange={(e) => setVerifiedFiveRights(e.target.checked)}
              disabled={isPharmacist}
            />
            <label htmlFor="fiveRightsCheckbox" style={{ cursor: 'pointer', flex: 1 }}>
              <div className="five-rights-title">
                I confirm verification of the Five Rights of Medication Administration:
              </div>
              <ul className="five-rights-list">
                <li><strong>Right Patient:</strong> {dose.patient_name} (MRN: {dose.mrn})</li>
                <li><strong>Right Medication:</strong> {dose.trade_name} ({dose.generic_name})</li>
                <li><strong>Right Dose &amp; Route:</strong> {dose.dosage} via {dose.route}</li>
                <li><strong>Right Time:</strong> {dose.slot} slot ({dose.target_time})</li>
                <li><strong>Right Documentation:</strong> Recording as {status}</li>
              </ul>
            </label>
          </div>

          {/* Nurse Sign-off Attribution Banner */}
          <div className="nurse-attribution-bar">
            <div>
              Attributed Nurse: <strong style={{ color: '#1e293b' }}>{currentUser?.name || 'Staff Nurse'}</strong>
              {currentUser?.license_number && <span> ({currentUser.license_number})</span>}
            </div>
            <div>
              Ward: <strong style={{ color: '#1e293b' }}>{currentUser?.ward_code || dose.ward_code || 'General'}</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="administer-modal-footer" style={{ margin: '0 -22px -20px -22px', padding: '14px 22px' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-sm ${
                status === 'ADMINISTERED'
                  ? 'btn-teal'
                  : 'btn-amber'
              }`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              disabled={loading || isPharmacist || !verifiedFiveRights}
              title={isPharmacist ? 'Pharmacists cannot administer medications' : ''}
            >
              {loading ? (
                <span>Recording &amp; Locking...</span>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Confirm &amp; Sign Dose ({status})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
