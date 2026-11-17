import React from 'react';
import { AlertTriangle, Pill, ClipboardList, Bed, PlusCircle } from 'lucide-react';

export default function PatientCard({ patient, onSelectPatient, onOpenAssignMed, currentUser }) {
  const hasAllergies = Boolean(
    patient.allergies &&
    patient.allergies.toLowerCase() !== 'none' &&
    patient.allergies.toLowerCase() !== 'none known'
  );

  const canPrescribe = currentUser?.role === 'PHARMACIST' || currentUser?.role === 'ADMIN';

  return (
    <div className="patient-card">
      {/* Top Header */}
      <div className="card-top flex items-center justify-between">
        <div className="bed-badge flex items-center gap-1">
          <Bed size={14} />
          <span>{patient.bed_number}</span>
        </div>
        <div className="ward-pill">{patient.ward_code || patient.ward_name}</div>
      </div>

      {/* Patient Identity */}
      <div className="card-body">
        <h3 className="patient-name">{patient.full_name}</h3>
        <div className="patient-meta flex items-center gap-2 text-xs text-muted">
          <span className="mrn-badge">MRN: {patient.mrn}</span>
          <span>•</span>
          <span>{patient.age ? `${patient.age} yrs` : patient.dob}</span>
          <span>•</span>
          <span>{patient.gender}</span>
        </div>

        {/* Allergy Warning Banner if present */}
        {hasAllergies ? (
          <div className="allergy-alert flex items-center gap-1">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
            <span className="font-semibold text-xs text-amber-800 truncate">
              Allergy: {patient.allergies}
            </span>
          </div>
        ) : (
          <div className="allergy-safe text-xs text-muted">No Known Drug Allergies (NKDA)</div>
        )}

        {/* Primary Diagnosis */}
        <div className="diagnosis-box">
          <span className="text-xs font-medium text-slate-500">Diagnosis:</span>
          <p className="diagnosis-text text-sm font-normal text-slate-800 truncate">
            {patient.diagnoses || 'Under clinical evaluation'}
          </p>
        </div>

        {/* Medications & Actions Footer */}
        <div className="card-footer flex items-center justify-between pt-3 border-t">
          <div className="meds-count flex items-center gap-1 text-xs font-semibold text-teal-700">
            <Pill size={14} />
            <span>{patient.active_prescriptions_count || 0} Active Meds</span>
          </div>

          <div className="flex items-center gap-1.5">
            {canPrescribe && (
              <button
                className="btn btn-primary btn-xs flex items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAssignMed(patient);
                }}
                title="Assign Medication"
              >
                <PlusCircle size={12} />
                <span>+ Prescribe</span>
              </button>
            )}

            <button
              className="btn btn-outline btn-xs flex items-center gap-1"
              onClick={() => onSelectPatient(patient)}
            >
              <ClipboardList size={12} />
              <span>Chart</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
