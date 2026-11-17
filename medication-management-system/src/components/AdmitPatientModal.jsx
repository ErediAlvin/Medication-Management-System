import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, Building2, Bed } from 'lucide-react';
import { api } from '../services/api';

export default function AdmitPatientModal({ wards, onClose, onSuccess, currentUser }) {
  const [mrn, setMrn] = useState('MRN-' + Math.floor(10000 + Math.random() * 90000));
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('1980-01-01');
  const [gender, setGender] = useState('Male');
  const [wardId, setWardId] = useState(currentUser?.assigned_ward_id || (wards[0]?.id || ''));
  const [bedNumber, setBedNumber] = useState('');
  const [allergies, setAllergies] = useState('None Known');
  const [diagnoses, setDiagnoses] = useState('General observation and stabilization');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Patient full name is required');
      return;
    }
    if (!bedNumber.trim()) {
      setError('Bed number is required (e.g., Bed A-04)');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await api.admitPatient({
        mrn: mrn.trim(),
        full_name: fullName.trim(),
        dob,
        gender,
        ward_id: wardId,
        bed_number: bedNumber.trim(),
        allergies: allergies.trim() || 'None Known',
        diagnoses: diagnoses.trim() || 'Pending Evaluation'
      });

      if (res.success) {
        onSuccess(res.patient);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to admit patient');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-teal-600" />
            <h2 className="modal-title text-lg font-bold">Admit New Patient to Ward</h2>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-body py-4 space-y-3">
          {error && (
            <div className="error-alert flex items-center gap-2 text-xs">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Medical Record Number (MRN)</label>
              <input
                type="text"
                className="form-input"
                value={mrn}
                required
                onChange={(e) => setMrn(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Full Legal Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. John Doe"
                value={fullName}
                required
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-input"
                value={dob}
                required
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Gender</label>
              <select
                className="form-select"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Target Ward</label>
              <select
                className="form-select"
                value={wardId}
                required
                onChange={(e) => setWardId(e.target.value)}
              >
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Bed Allocation</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Bed A-04"
                value={bedNumber}
                required
                onChange={(e) => setBedNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label font-semibold text-amber-800">
              Known Drug Allergies (Critical)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Penicillin, Sulfa drugs, or 'None Known'"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Admission Diagnoses & Clinical Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="e.g. Acute exacerbation of COPD, Hypertension"
              value={diagnoses}
              onChange={(e) => setDiagnoses(e.target.value)}
            />
          </div>

          <div className="modal-footer flex items-center justify-end gap-2 border-t pt-3 mt-4">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-teal btn-sm flex items-center gap-1"
              disabled={submitting}
            >
              <UserPlus size={14} />
              <span>{submitting ? 'Admitting...' : 'Confirm Admission'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
