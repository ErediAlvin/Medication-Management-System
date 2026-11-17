import React, { useState, useEffect } from 'react';
import {
  X,
  Pill,
  AlertTriangle,
  Clock,
  Calendar,
  Check,
  PlusCircle,
  ShieldAlert,
  Info,
  Sunrise,
  Sun,
  Sunset
} from 'lucide-react';
import { api } from '../services/api';

const TIME_SLOTS = [
  { id: 'MORNING', label: 'Morning Slot', time: '06:00 – 12:00 (Target: 08:00)', icon: Sunrise },
  { id: 'AFTERNOON', label: 'Afternoon Slot', time: '12:00 – 18:00 (Target: 14:00)', icon: Sun },
  { id: 'EVENING', label: 'Evening Slot', time: '18:00 – 24:00 (Target: 20:00)', icon: Sunset }
];

export default function AssignMedicationModal({
  patient,
  allPatients = [],
  onClose,
  onSuccess,
  currentUser
}) {
  const [selectedPatientId, setSelectedPatientId] = useState(patient?.id || (allPatients[0]?.id || ''));
  const [medications, setMedications] = useState([]);
  const [selectedMedId, setSelectedMedId] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('Oral');
  const [instructions, setInstructions] = useState('Take with full glass of water');
  const [selectedSlots, setSelectedSlots] = useState(['MORNING', 'EVENING']);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [allergyAlert, setAllergyAlert] = useState(null);

  // Active patient object
  const activePatient = patient || allPatients.find(p => p.id === selectedPatientId);

  useEffect(() => {
    loadMedications();
  }, []);

  const loadMedications = async () => {
    try {
      setLoading(true);
      const res = await api.getMedications();
      if (res.success && res.medications.length > 0) {
        setMedications(res.medications);
        setSelectedMedId(res.medications[0].id);
        setDosage(res.medications[0].strength);
        setRoute(res.medications[0].default_route);
      }
    } catch (err) {
      setError('Failed to load drug catalog: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cross-check drug selection with patient allergy
  const selectedMed = medications.find(m => m.id === selectedMedId);

  useEffect(() => {
    if (!activePatient || !selectedMed) {
      setAllergyAlert(null);
      return;
    }

    const patientAllergies = (activePatient.allergies || '').toLowerCase();
    if (patientAllergies && patientAllergies !== 'none' && patientAllergies !== 'none known') {
      const generic = selectedMed.generic_name.toLowerCase();
      const trade = selectedMed.trade_name.toLowerCase();

      if (
        patientAllergies.includes(generic) ||
        patientAllergies.includes(trade) ||
        (patientAllergies.includes('penicillin') && generic.includes('amoxicillin'))
      ) {
        setAllergyAlert(
          `ALLERGY SAFETY CONFLICT: Patient is documented allergic to '${activePatient.allergies}'. Prescribing '${selectedMed.trade_name}' (${selectedMed.generic_name}) presents a high risk of adverse reaction!`
        );
        return;
      }
    }
    setAllergyAlert(null);
  }, [selectedMedId, selectedPatientId, activePatient, selectedMed]);

  const handleMedChange = (medId) => {
    setSelectedMedId(medId);
    const med = medications.find(m => m.id === medId);
    if (med) {
      setDosage(med.strength);
      setRoute(med.default_route);
    }
  };

  const toggleSlot = (slotId) => {
    if (selectedSlots.includes(slotId)) {
      if (selectedSlots.length === 1) {
        alert('At least one daily schedule time slot must be selected.');
        return;
      }
      setSelectedSlots(selectedSlots.filter(s => s !== slotId));
    } else {
      setSelectedSlots([...selectedSlots, slotId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setError('Please select a patient.');
      return;
    }
    if (!selectedMedId) {
      setError('Please select a medication from the catalog.');
      return;
    }
    if (selectedSlots.length === 0) {
      setError('Select at least one daily administration time slot (Morning, Afternoon, or Evening).');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await api.assignPrescription({
        patient_id: selectedPatientId,
        medication_id: selectedMedId,
        dosage,
        route,
        instructions,
        slots: selectedSlots,
        start_date: startDate,
        end_date: endDate || null
      });

      if (res.success) {
        onSuccess(res.prescription);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to assign medication');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Pill size={20} />
            </div>
            <div>
              <h2 className="modal-title text-lg font-bold">Assign Medication to Patient</h2>
              <p className="text-xs text-muted">
                Pharmacist Prescription Order • Auto-scheduled into 3 daily slots
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-body py-4 space-y-4">
          {error && (
            <div className="error-alert p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Allergy Conflict Warning Banner */}
          {allergyAlert && (
            <div className="allergy-danger-banner p-3 bg-amber-50 border-2 border-amber-400 text-amber-900 rounded-lg text-xs font-semibold flex items-center gap-2 animate-pulse">
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
              <span>{allergyAlert}</span>
            </div>
          )}

          {/* Patient Selection or Summary Banner */}
          {patient ? (
            <div className="p-3 bg-slate-50 border rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">Target Patient</span>
                <div className="font-bold text-slate-900 text-base">{patient.full_name}</div>
                <div className="text-xs text-slate-600">
                  MRN: {patient.mrn} • {patient.ward_name} ({patient.bed_number})
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Documented Allergies</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${patient.allergies && patient.allergies.toLowerCase() !== 'none' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                  {patient.allergies || 'None Known'}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="form-label">Select Admitted Patient</label>
              <select
                className="form-select"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                required
              >
                {allPatients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.mrn}) — {p.ward_code}: {p.bed_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Drug Selection from Catalog */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Medication (Drug Catalog)</label>
              <select
                className="form-select"
                value={selectedMedId}
                onChange={(e) => handleMedChange(e.target.value)}
                required
                disabled={loading}
              >
                {medications.map(med => (
                  <option key={med.id} value={med.id}>
                    {med.trade_name} ({med.generic_name}) — {med.strength}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Prescribed Dosage & Strength</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 500 mg, 1 tablet"
                value={dosage}
                required
                onChange={(e) => setDosage(e.target.value)}
              />
            </div>
          </div>

          {/* Route & Catalog Warnings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Administration Route</label>
              <select
                className="form-select"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
              >
                <option value="Oral">Oral (PO)</option>
                <option value="IV">Intravenous (IV)</option>
                <option value="Subcutaneous">Subcutaneous (SC)</option>
                <option value="Intramuscular">Intramuscular (IM)</option>
                <option value="Inhalation">Inhalation</option>
                <option value="Topical">Topical</option>
                <option value="Sublingual">Sublingual</option>
              </select>
            </div>

            <div>
              <label className="form-label">Medication Warning / Precautions</label>
              <div className="p-2 bg-slate-50 border rounded text-xs text-slate-600 truncate">
                {selectedMed?.warnings || 'No specific precautions noted.'}
              </div>
            </div>
          </div>

          {/* Daily Schedule Slots (Morning, Afternoon, Evening) */}
          <div className="schedule-slots-section">
            <label className="form-label font-bold text-slate-800 flex items-center justify-between">
              <span>Daily Administration Time Slots (Core Clinical Schedule)</span>
              <span className="text-xs font-normal text-muted">Select all applicable daily slots</span>
            </label>

            <div className="grid grid-cols-3 gap-3 mt-2">
              {TIME_SLOTS.map(slot => {
                const isSelected = selectedSlots.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className={`slot-card p-3 border-2 rounded-lg text-left transition-all ${isSelected ? 'border-teal-600 bg-teal-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    onClick={() => toggleSlot(slot.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-teal-700">
                        {React.createElement(slot.icon, { size: 20 })}
                      </span>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300'}`}>
                        {isSelected && <Check size={12} />}
                      </div>
                    </div>
                    <div className="font-bold text-xs mt-2 text-slate-900">{slot.label}</div>
                    <div className="text-2xs text-muted mt-0.5">{slot.time}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dates & Instructions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                required
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">End Date (Optional / Duration)</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Special Administration Instructions</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="e.g. Take with morning meal, check blood pressure prior to administering"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          {/* Pharmacist Responsibility Notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
            <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Clinical Responsibility Notice:</span> This prescription will be queued into the patient's daily schedule across the selected time slots. Administration will be carried out and verified by the assigned ward nurses.
            </div>
          </div>

          {/* Modal Footer */}
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
              className="btn btn-primary btn-sm flex items-center gap-1"
              disabled={submitting}
            >
              <PlusCircle size={14} />
              <span>{submitting ? 'Assigning...' : 'Assign Prescription'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
