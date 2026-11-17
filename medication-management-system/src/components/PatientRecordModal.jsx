import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Pill,
  Clock,
  Bed,
  Calendar,
  User,
  CheckCircle2,
  FileText,
  UserMinus,
  Edit2,
  Save,
  PlusCircle,
  Ban,
  ShieldCheck,
  ShieldAlert,
  Sunrise,
  Sun,
  Sunset
} from 'lucide-react';
import { api } from '../services/api';

export default function PatientRecordModal({
  patientId,
  onClose,
  onRefresh,
  currentUser,
  onOpenAssignMed
}) {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editBed, setEditBed] = useState('');
  const [editAllergies, setEditAllergies] = useState('');
  const [editDiagnoses, setEditDiagnoses] = useState('');
  const [saving, setSaving] = useState(false);

  // Module 5 Administration History state
  const [adminHistory, setAdminHistory] = useState([]);
  const [medTab, setMedTab] = useState('prescriptions'); // 'prescriptions' | 'history'

  const isPharmacist = currentUser?.role === 'PHARMACIST';
  const isAdmin = currentUser?.role === 'ADMIN';
  const canPrescribe = isPharmacist || isAdmin;

  useEffect(() => {
    loadPatient();
  }, [patientId]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      setError(null);
      const [res, histRes] = await Promise.all([
        api.getPatientById(patientId),
        api.getAdministrationHistory(patientId).catch(() => ({ history: [] }))
      ]);

      if (res.success) {
        setPatient(res.patient);
        setEditBed(res.patient.bed_number);
        setEditAllergies(res.patient.allergies || '');
        setEditDiagnoses(res.patient.diagnoses || '');
      }
      if (histRes?.history) {
        setAdminHistory(histRes.history);
      }
    } catch (err) {
      setError(err.message || 'Failed to load patient record');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUpdate = async () => {
    try {
      setSaving(true);
      await api.updatePatient(patientId, {
        bed_number: editBed,
        allergies: editAllergies,
        diagnoses: editDiagnoses
      });
      setIsEditing(false);
      await loadPatient();
      onRefresh();
    } catch (err) {
      alert('Failed to update patient: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscontinueRx = async (rx) => {
    if (!window.confirm(`Are you sure you want to discontinue ${rx.trade_name} for ${patient?.full_name}?`)) {
      return;
    }
    try {
      setLoading(true);
      await api.discontinuePrescription(rx.id);
      await loadPatient();
      onRefresh();
    } catch (err) {
      alert('Failed to discontinue prescription: ' + err.message);
      setLoading(false);
    }
  };

  const handleDischarge = async () => {
    if (!window.confirm(`Are you sure you want to discharge patient ${patient?.full_name}? This will free up ${patient?.bed_number}.`)) {
      return;
    }
    try {
      setLoading(true);
      await api.dischargePatient(patientId);
      onRefresh();
      onClose();
    } catch (err) {
      alert('Failed to discharge patient: ' + err.message);
      setLoading(false);
    }
  };

  if (!patientId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="avatar-badge">
              <User size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="modal-title text-xl font-bold">{patient?.full_name || 'Patient Chart'}</h2>
                <span className="mrn-badge">MRN: {patient?.mrn}</span>
                <span className={`status-badge ${patient?.status === 'ADMITTED' ? 'status-active' : 'status-inactive'}`}>
                  {patient?.status}
                </span>
              </div>
              <p className="text-xs text-muted">
                Admitted on {patient?.admission_date ? new Date(patient.admission_date).toLocaleDateString() : 'N/A'} • {patient?.ward_name} ({patient?.bed_number})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (currentUser?.role === 'ADMIN' || currentUser?.role === 'NURSE') && (
              <button
                className="btn btn-outline btn-xs flex items-center gap-1"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 size={12} />
                <span>Edit Chart</span>
              </button>
            )}
            <button className="btn-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body py-4">
          {loading && <div className="loading-state">Loading patient clinical record...</div>}
          {error && <div className="error-alert">{error}</div>}

          {patient && !loading && (
            <div className="patient-chart-content space-y-4">
              {/* Pharmacist Administration Guard Warning Banner */}
              {isPharmacist && (
                <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-blue-600 flex-shrink-0" />
                    <span>
                      <strong>Pharmacist Scope:</strong> You can assign and review medication orders below. Doses are administered strictly by ward nurses.
                    </span>
                  </div>
                </div>
              )}

              {/* Patient Core Summary Banner */}
              <div className="chart-summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Age & Gender</span>
                  <span className="summary-value">{patient.age} yrs ({patient.gender})</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Assigned Ward</span>
                  <span className="summary-value">{patient.ward_name} ({patient.ward_code})</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Bed Location</span>
                  {isEditing ? (
                    <input
                      type="text"
                      className="form-input text-xs"
                      value={editBed}
                      onChange={(e) => setEditBed(e.target.value)}
                    />
                  ) : (
                    <span className="summary-value font-bold text-teal-700">{patient.bed_number}</span>
                  )}
                </div>
                <div className="summary-item">
                  <span className="summary-label">Active Prescriptions</span>
                  <span className="summary-value font-bold text-teal-700">{patient.activePrescriptionsCount}</span>
                </div>
              </div>

              {/* Allergies and Diagnoses Section */}
              <div className="clinical-alert-box">
                <div className="alert-header flex items-center gap-1 text-amber-800 font-semibold text-sm">
                  <AlertTriangle size={16} />
                  <span>Known Drug Allergies (Critical Clinical Safety Alert)</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="form-input mt-2"
                    value={editAllergies}
                    placeholder="Enter allergies or 'None Known'"
                    onChange={(e) => setEditAllergies(e.target.value)}
                  />
                ) : (
                  <div className={`mt-1 p-2 rounded text-sm ${patient.allergies && patient.allergies.toLowerCase() !== 'none' ? 'bg-amber-100 text-amber-900 font-semibold' : 'bg-slate-100 text-slate-700'}`}>
                    {patient.allergies || 'No Known Drug Allergies (NKDA)'}
                  </div>
                )}
              </div>

              {/* Diagnoses Section */}
              <div className="diagnoses-section">
                <div className="section-label font-semibold text-sm text-slate-700">Primary Clinical Diagnoses</div>
                {isEditing ? (
                  <textarea
                    className="form-textarea mt-1"
                    rows={2}
                    value={editDiagnoses}
                    onChange={(e) => setEditDiagnoses(e.target.value)}
                  />
                ) : (
                  <div className="p-3 bg-slate-50 border rounded text-sm text-slate-800 mt-1">
                    {patient.diagnoses || 'Under clinical investigation.'}
                  </div>
                )}
              </div>

              {/* Assigned Medications & Administration Audit (Modules 3 & 5) */}
              <div className="medications-section pt-3 border-t">
                {/* Section Sub-Navigation Tabs */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                        medTab === 'prescriptions'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                      onClick={() => setMedTab('prescriptions')}
                    >
                      <Pill size={14} />
                      <span>Active Prescriptions ({patient.prescriptions?.length || 0})</span>
                    </button>

                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                        medTab === 'history'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                      onClick={() => setMedTab('history')}
                    >
                      <ShieldCheck size={14} />
                      <span>Administration Audit Log ({adminHistory.length})</span>
                    </button>
                  </div>

                  {medTab === 'prescriptions' && canPrescribe && patient.status === 'ADMITTED' && (
                    <button
                      className="btn btn-primary btn-xs flex items-center gap-1"
                      onClick={() => onOpenAssignMed(patient)}
                    >
                      <PlusCircle size={14} />
                      <span>+ Prescribe Medication</span>
                    </button>
                  )}
                </div>

                {medTab === 'history' ? (
                  /* Module 5: Safe Administration Log Table */
                  adminHistory.length === 0 ? (
                    <div className="empty-state p-6 border-dashed border-2 rounded-lg text-center text-muted bg-slate-50">
                      <Clock size={28} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">No Administration Logs Yet</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Doses recorded by ward nurses in daily rounds will appear in this immutable audit trail.
                      </p>
                    </div>
                  ) : (
                    <div className="border rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b text-slate-600 font-bold">
                          <tr>
                            <th className="p-2.5">Medication</th>
                            <th className="p-2.5">Round Slot</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Nurse / Signer</th>
                            <th className="p-2.5">Administered At</th>
                            <th className="p-2.5">Vitals & Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {adminHistory.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5">
                                <span className="font-bold text-slate-900 block">{item.trade_name}</span>
                                <span className="text-2xs text-slate-500 italic block">{item.generic_name}</span>
                                <span className="text-2xs text-teal-800 font-semibold">{item.dosage} • {item.route}</span>
                              </td>
                              <td className="p-2.5">
                                <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-slate-100 text-slate-700 block w-max">
                                  {item.slot}
                                </span>
                                <span className="text-2xs text-slate-400 block font-mono mt-0.5">
                                  {new Date(item.date).toLocaleDateString()}
                                </span>
                              </td>
                              <td className="p-2.5">
                                {item.status === 'ADMINISTERED' && (
                                  <span className="px-2 py-0.5 rounded text-2xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                                    <CheckCircle2 size={11} />
                                    <span>ADMINISTERED</span>
                                  </span>
                                )}
                                {item.status === 'HELD' && (
                                  <span className="px-2 py-0.5 rounded text-2xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-max">
                                    <AlertTriangle size={11} />
                                    <span>HELD</span>
                                  </span>
                                )}
                                {item.status === 'REFUSED' && (
                                  <span className="px-2 py-0.5 rounded text-2xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1 w-max">
                                    <X size={11} />
                                    <span>REFUSED</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-700">
                                <div className="font-semibold text-slate-900">{item.nurse_name}</div>
                                {item.nurse_license && (
                                  <div className="text-2xs text-slate-400 font-mono">{item.nurse_license}</div>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-600 font-mono text-2xs">
                                {new Date(item.administered_at).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="p-2.5 text-slate-600 text-2xs">
                                {item.vitals && (
                                  <div className="text-slate-700 font-medium">
                                    <span className="text-slate-400">Vitals:</span> {item.vitals}
                                  </div>
                                )}
                                {item.notes && (
                                  <div className="text-slate-600 italic mt-0.5">
                                    "{item.notes}"
                                  </div>
                                )}
                                {!item.vitals && !item.notes && (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  /* Module 3: Active Prescriptions View */
                  (!patient.prescriptions || patient.prescriptions.length === 0) ? (
                    <div className="empty-state p-6 border-dashed border-2 rounded-lg text-center text-muted bg-slate-50">
                      <Pill size={28} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">No Medications Prescribed Yet</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {canPrescribe
                          ? 'Click "+ Prescribe Medication" above to assign drugs across daily slots.'
                          : 'A hospital pharmacist will assign the medication regimen.'}
                      </p>
                    </div>
                  ) : (
                  <div className="medication-list space-y-3">
                    {patient.prescriptions.map((rx) => (
                      <div key={rx.id} className="rx-card p-4 border rounded-xl bg-white shadow-sm hover:shadow transition-shadow">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rx-name font-bold text-slate-900 text-base">{rx.trade_name}</span>
                              <span className="rx-generic text-xs text-slate-500 italic">({rx.generic_name})</span>
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              Prescribed by: <strong>{rx.prescribed_by_name}</strong> on {new Date(rx.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`status-pill ${rx.status === 'ACTIVE' ? 'pill-active' : 'pill-inactive'}`}>
                              {rx.status}
                            </span>
                            {canPrescribe && rx.status === 'ACTIVE' && (
                              <button
                                className="btn btn-danger-outline btn-xs flex items-center gap-1"
                                onClick={() => handleDiscontinueRx(rx)}
                                title="Discontinue Prescription"
                              >
                                <Ban size={12} />
                                <span>Discontinue</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Dosage and Route specs */}
                        <div className="rx-specs-row mt-3 flex items-center gap-4 text-xs bg-slate-50 p-2.5 rounded-lg border">
                          <div>
                            <span className="text-slate-400 block font-medium">DOSAGE:</span>
                            <span className="font-bold text-slate-800">{rx.dosage}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">ROUTE:</span>
                            <span className="font-bold text-slate-800">{rx.route} ({rx.dosage_form})</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">SCHEDULE DURATION:</span>
                            <span className="font-medium text-slate-700">
                              {rx.start_date} {rx.end_date ? `to ${rx.end_date}` : '(Ongoing)'}
                            </span>
                          </div>
                        </div>

                        {/* Scheduled Time Slots (Morning, Afternoon, Evening) */}
                        <div className="rx-slots-bar mt-3 flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                            <Clock size={13} /> 3 Daily Slots:
                          </span>
                          <div className="flex items-center gap-1.5">
                            {['MORNING', 'AFTERNOON', 'EVENING'].map(slot => {
                              const isSlotAssigned = rx.slots?.includes(slot);
                              return (
                                <span
                                  key={slot}
                                  className={`slot-badge ${isSlotAssigned ? `slot-${slot.toLowerCase()}-active` : 'slot-inactive'} flex items-center gap-1`}
                                >
                                  {slot === 'MORNING' && <Sunrise size={11} />}
                                  {slot === 'AFTERNOON' && <Sun size={11} />}
                                  {slot === 'EVENING' && <Sunset size={11} />}
                                  <span>{slot === 'MORNING' ? 'Morning' : slot === 'AFTERNOON' ? 'Afternoon' : 'Evening'}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {rx.instructions && (
                          <div className="rx-instructions mt-2 text-xs text-slate-700 bg-teal-50 border border-teal-100 p-2 rounded">
                            <span className="font-bold text-teal-800">Instructions:</span> {rx.instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer flex items-center justify-between border-t pt-3">
          <div>
            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'NURSE') && patient?.status === 'ADMITTED' && (
              <button
                className="btn btn-danger-outline btn-sm flex items-center gap-1"
                onClick={handleDischarge}
                disabled={loading}
              >
                <UserMinus size={14} />
                <span>Discharge Patient</span>
              </button>
            )}
          </div>

          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close Chart
          </button>
        </div>
      </div>
    </div>
  );
}
