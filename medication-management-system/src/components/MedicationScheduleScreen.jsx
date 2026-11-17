import React, { useState, useEffect } from 'react';
import {
  Clock,
  Pill,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Filter,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  ShieldAlert,
  ShieldCheck,
  Check,
  Activity,
  ClipboardCheck
} from 'lucide-react';
import { api } from '../services/api';
import AdministerDoseModal from './AdministerDoseModal';
import ShiftReconciliationModal from './ShiftReconciliationModal';

const ROUND_SLOTS = [
  { id: 'ALL', label: 'All Daily Rounds', icon: Clock },
  { id: 'MORNING', label: 'Morning Round (08:00)', icon: Sunrise, time: '06:00 – 12:00' },
  { id: 'AFTERNOON', label: 'Afternoon Round (14:00)', icon: Sun, time: '12:00 – 18:00' },
  { id: 'EVENING', label: 'Evening Round (20:00)', icon: Sunset, time: '18:00 – 24:00' }
];

export default function MedicationScheduleScreen({
  wards = [],
  currentUser,
  onOpenPatientChart
}) {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedSlot, setSelectedSlot] = useState('ALL');
  const [selectedWardId, setSelectedWardId] = useState('all');
  const [myPatientsOnly, setMyPatientsOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  // Module 5 Modals
  const [administeringDose, setAdministeringDose] = useState(null);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [selectedSlot, selectedWardId, myPatientsOnly, statusFilter, currentUser]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.getDailySchedule({
        slot: selectedSlot,
        ward_id: selectedWardId,
        my_patients: myPatientsOnly,
        status: statusFilter
      });

      if (res.success) {
        setScheduleData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load medication schedule');
    } finally {
      setLoading(false);
    }
  };

  const isNurse = currentUser?.role === 'NURSE';
  const isPharmacist = currentUser?.role === 'PHARMACIST';
  const currentSlot = scheduleData?.currentSlot || 'MORNING';

  // Group doses by Ward for clear ward-partitioned guidance
  const doses = scheduleData?.doses || [];
  const metrics = scheduleData?.metrics || {
    totalDoses: 0,
    completedDoses: 0,
    pendingDoses: 0,
    dueNowDoses: 0,
    overdueDoses: 0,
    completionRate: 0
  };

  // Grouping by ward
  const dosesByWard = wards.map(ward => {
    const wardDoses = doses.filter(d => d.ward_id === ward.id);
    return {
      ward,
      doses: wardDoses
    };
  }).filter(group => selectedWardId === 'all' || group.ward.id === selectedWardId);

  const getGuidanceBadge = (guidance, slot) => {
    switch (guidance) {
      case 'DUE_NOW':
        return (
          <span className="guidance-badge badge-due-now flex items-center gap-1">
            <span className="due-pulse-dot"></span>
            <span>DUE NOW ({slot})</span>
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="guidance-badge badge-upcoming flex items-center gap-1">
            <Clock size={12} />
            <span>UPCOMING ({slot})</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="guidance-badge badge-completed flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>ADMINISTERED</span>
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="guidance-badge badge-overdue flex items-center gap-1">
            <AlertTriangle size={12} />
            <span>OVERDUE ({slot})</span>
          </span>
        );
      default:
        return <span className="guidance-badge">{guidance}</span>;
    }
  };

  return (
    <div className="schedule-screen space-y-6">
      {/* Top Clinical Header & Active Clock Banner */}
      <div className="schedule-header bg-white p-5 border rounded-xl shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock size={24} className="text-teal-600" />
              <h2 className="schedule-title">
                Daily Medication Administration Schedule
              </h2>
            </div>
            <p className="schedule-subtitle">
              Module 5: Safe dispensing, duplicate prevention, Five Rights verification & shift reconciliation
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Shift Reconciliation Modal Trigger */}
            <button
              className="btn btn-outline btn-sm flex items-center gap-1.5"
              onClick={() => setIsReconciliationOpen(true)}
              title="Open Shift Handover & Reconciliation Report"
            >
              <ClipboardCheck size={16} className="text-teal-600" />
              <span>Shift Reconciliation</span>
              {metrics.pendingDoses > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-2xs font-bold">
                  {metrics.pendingDoses} Pending
                </span>
              )}
            </button>

            {/* Active Round & Clock Badge */}
            <div className="active-round-banner flex items-center gap-4 bg-slate-50 border p-2.5 rounded-lg">
              <div>
                <span className="text-2xs uppercase text-slate-400 font-bold block">Hospital Clock</span>
                <span className="font-mono text-sm font-bold text-slate-800">{currentTime}</span>
              </div>
              <div className="h-7 w-px bg-slate-200"></div>
              <div>
                <span className="text-2xs uppercase text-teal-700 font-bold block">Active Shift Round</span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
                  {currentSlot === 'MORNING' && <Sunrise size={15} className="text-amber-500" />}
                  {currentSlot === 'AFTERNOON' && <Sun size={15} className="text-amber-600" />}
                  {currentSlot === 'EVENING' && <Sunset size={15} className="text-purple-600" />}
                  <span>{currentSlot} ROUND ACTIVE</span>
                </div>
              </div>
              <button
                className="btn btn-icon btn-sm"
                onClick={loadSchedule}
                title="Refresh Schedule"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Pharmacist Administration Constraint Reminder */}
        {isPharmacist && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2">
            <ShieldAlert size={16} className="text-blue-600 flex-shrink-0" />
            <span>
              <strong>Clinical Guard:</strong> Pharmacist role is active. You can monitor all patient schedules and slot fulfillment below. Direct administration must be carried out by ward nurses.
            </span>
          </div>
        )}
      </div>

      {/* HORIZONTAL CARDS: KPI Metrics Pending vs Completed Live Tracking */}
      {/* Explicit inline grid style to guarantee 100% horizontal side-by-side rendering */}
      <div
        className="horizontal-metrics-row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: '14px',
          width: '100%',
          marginBottom: '20px',
          boxSizing: 'border-box'
        }}
      >
        {/* Total Scheduled */}
        <div className="kpi-card kpi-card-total" style={{ minWidth: 0, margin: 0 }}>
          <div className="kpi-top flex items-center justify-between">
            <span className="kpi-label text-slate-600">Total Today</span>
            <div className="kpi-icon-pill bg-slate-100 text-slate-600">
              <Pill size={15} />
            </div>
          </div>
          <div className="kpi-value text-slate-900">{metrics.totalDoses}</div>
          <div className="kpi-sub text-slate-500">Doses Scheduled Today</div>
        </div>

        {/* Due Now */}
        <div className="kpi-card kpi-card-due" style={{ minWidth: 0, margin: 0 }}>
          <div className="kpi-top flex items-center justify-between">
            <span className="kpi-label text-amber-800">Due Now</span>
            <div className="kpi-icon-pill bg-amber-100 text-amber-700">
              <Clock size={15} />
            </div>
          </div>
          <div className="kpi-value text-amber-900">{metrics.dueNowDoses}</div>
          <div className="kpi-sub text-amber-700 font-medium">Active slot pending</div>
        </div>

        {/* Completed */}
        <div className="kpi-card kpi-card-completed" style={{ minWidth: 0, margin: 0 }}>
          <div className="kpi-top flex items-center justify-between">
            <span className="kpi-label text-emerald-800">Completed</span>
            <div className="kpi-icon-pill bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="kpi-value text-emerald-900">{metrics.completedDoses}</div>
          <div className="kpi-sub text-emerald-700 font-medium">{metrics.completionRate}% completion rate</div>
        </div>

        {/* Upcoming */}
        <div className="kpi-card kpi-card-upcoming" style={{ minWidth: 0, margin: 0 }}>
          <div className="kpi-top flex items-center justify-between">
            <span className="kpi-label text-slate-600">Upcoming</span>
            <div className="kpi-icon-pill bg-slate-100 text-slate-500">
              <Calendar size={15} />
            </div>
          </div>
          <div className="kpi-value text-slate-700">
            {doses.filter(d => d.isUpcoming).length}
          </div>
          <div className="kpi-sub text-slate-500">Later daily slots</div>
        </div>

        {/* Overdue */}
        <div className="kpi-card kpi-card-overdue" style={{ minWidth: 0, margin: 0 }}>
          <div className="kpi-top flex items-center justify-between">
            <span className="kpi-label text-rose-800">Overdue</span>
            <div className="kpi-icon-pill bg-rose-100 text-rose-700">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="kpi-value text-rose-900">{metrics.overdueDoses}</div>
          <div className="kpi-sub text-rose-700 font-medium">Missed round warning</div>
        </div>
      </div>

      {/* Round Slot Filter Tabs & Controls */}
      <div className="schedule-filter-bar bg-white p-4 border rounded-xl shadow-sm flex items-center justify-between flex-wrap gap-4">
        {/* 3 Slots Tabs */}
        <div className="slot-tabs flex items-center gap-2">
          {ROUND_SLOTS.map(slot => {
            const Icon = slot.icon;
            const isSelected = selectedSlot === slot.id;
            const isCurrent = slot.id === currentSlot;

            return (
              <button
                key={slot.id}
                className={`slot-filter-btn flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${isSelected ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                onClick={() => setSelectedSlot(slot.id)}
              >
                <Icon size={14} />
                <span>{slot.label}</span>
                {isCurrent && slot.id !== 'ALL' && (
                  <span className={`px-1.5 py-0.2 rounded text-2xs font-bold ${isSelected ? 'bg-teal-800 text-teal-100' : 'bg-amber-100 text-amber-800'}`}>
                    Active Now
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Ward & Nurse Filters */}
        <div className="flex items-center gap-2.5">
          {isNurse && currentUser?.assigned_ward_id && (
            <button
              className={`btn btn-xs ${myPatientsOnly ? 'btn-teal' : 'btn-outline'} flex items-center gap-1`}
              onClick={() => setMyPatientsOnly(!myPatientsOnly)}
            >
              <Check size={14} />
              <span>My Ward Only ({currentUser.ward_code})</span>
            </button>
          )}

          <select
            className="form-select text-xs py-1.5"
            value={selectedWardId}
            onChange={(e) => {
              if (myPatientsOnly) setMyPatientsOnly(false);
              setSelectedWardId(e.target.value);
            }}
          >
            <option value="all">All Wards</option>
            {wards.map(w => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>

          <select
            className="form-select text-xs py-1.5"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Only</option>
            <option value="ADMINISTERED">Completed Only</option>
          </select>
        </div>
      </div>

      {/* Schedule Doses Partitioned by Ward */}
      {loading ? (
        <div className="p-12 text-center text-muted bg-white border rounded-xl">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-teal-600" />
          <p className="text-sm">Calculating daily 3-slot schedules and guidance...</p>
        </div>
      ) : doses.length === 0 ? (
        <div className="empty-schedule-card p-12 border-2 border-dashed rounded-xl text-center bg-white">
          <Pill size={36} className="mx-auto mb-2 text-slate-300" />
          <h3 className="font-bold text-base text-slate-800">No Medication Doses Due</h3>
          <p className="text-xs text-slate-500 mt-1">
            No active prescriptions match the selected daily time slot or ward criteria.
          </p>
        </div>
      ) : (
        <div className="ward-schedule-sections space-y-6">
          {dosesByWard.map(({ ward, doses: wardDoses }) => {
            if (wardDoses.length === 0) return null;

            return (
              <div key={ward.id} className="ward-schedule-block bg-white p-5 border rounded-xl shadow-sm">
                {/* Ward Round Header */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-teal-700" />
                    <h3 className="font-bold text-base text-slate-800">{ward.name}</h3>
                    <span className="ward-code-badge">{ward.code}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>
                      Doses in round: <strong>{wardDoses.length}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">
                      {wardDoses.filter(d => d.isCompleted).length} Completed
                    </span>
                    <span>•</span>
                    <span className="text-amber-700 font-semibold">
                      {wardDoses.filter(d => d.isDueNow).length} Due Now
                    </span>
                  </div>
                </div>

                {/* Doses Grid (Horizontal 2-columns side-by-side) */}
                <div className="doses-grid">
                  {wardDoses.map(dose => (
                    <div
                      key={dose.dose_id || dose.id}
                      className={`dose-schedule-card p-4 border-2 rounded-xl transition-all ${dose.isDueNow ? 'border-amber-400 bg-amber-50/40 shadow-sm' : dose.isCompleted ? 'border-emerald-200 bg-emerald-50/20' : dose.isOverdue ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200 bg-white'}`}
                    >
                      {/* Dose Top Row */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bed-badge">{dose.bed_number}</span>
                            <span className="font-bold text-slate-900 text-sm">{dose.patient_name}</span>
                            <span className="mrn-badge">MRN: {dose.mrn}</span>
                          </div>
                          {dose.patient_allergies && dose.patient_allergies.toLowerCase() !== 'none' && dose.patient_allergies.toLowerCase() !== 'none known' && (
                            <div className="text-2xs text-amber-800 font-semibold mt-1 flex items-center gap-1">
                              <AlertTriangle size={12} className="text-amber-600" />
                              <span>Allergy: {dose.patient_allergies}</span>
                            </div>
                          )}
                        </div>

                        {/* Guidance Status Pill */}
                        <div>
                          {getGuidanceBadge(dose.guidance, dose.slot)}
                        </div>
                      </div>

                      {/* Medication Prescription Details */}
                      <div className="dose-med-body mt-3 p-3 bg-white border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-base text-slate-900">{dose.trade_name}</span>
                            <span className="text-xs text-slate-500 italic ml-2">({dose.generic_name})</span>
                          </div>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                            Target: {dose.target_time}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-700">
                          <div>
                            <span className="text-slate-400 font-medium">DOSAGE:</span>{' '}
                            <span className="font-bold text-teal-800">{dose.dosage}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium">ROUTE:</span>{' '}
                            <span className="font-bold text-slate-800">{dose.route}</span> ({dose.dosage_form})
                          </div>
                        </div>

                        {dose.instructions && (
                          <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                            <span className="font-semibold text-slate-700">Instructions:</span> {dose.instructions}
                          </div>
                        )}
                      </div>

                      {/* Action / Completion Footer */}
                      <div className="dose-footer mt-3 flex items-center justify-between pt-2 border-t">
                        <div className="text-2xs text-slate-500">
                          {dose.isCompleted ? (
                            <span className="text-emerald-700 font-medium">
                              Signed by {dose.administered_by_name || 'Nurse'} at {new Date(dose.administered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span>Prescribed by {dose.prescribed_by_name}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={() => onOpenPatientChart(dose.patient_id)}
                          >
                            Chart
                          </button>

                          {/* Module 5 Execution Trigger: Open Safe Dispensing Modal */}
                          {isNurse && !dose.isCompleted && (
                            <button
                              className={`btn btn-xs flex items-center gap-1 ${dose.isDueNow ? 'btn-teal' : 'btn-primary-outline'}`}
                              onClick={() => setAdministeringDose(dose)}
                            >
                              <CheckCircle2 size={13} />
                              <span>Administer Dose</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Module 5 Safe Dispensing Modal */}
      {administeringDose && (
        <AdministerDoseModal
          dose={administeringDose}
          currentUser={currentUser}
          onClose={() => setAdministeringDose(null)}
          onAdministered={() => {
            loadSchedule();
          }}
        />
      )}

      {/* Module 5 Shift Reconciliation Modal */}
      {isReconciliationOpen && (
        <ShiftReconciliationModal
          wardId={selectedWardId}
          wards={wards}
          currentUser={currentUser}
          onClose={() => setIsReconciliationOpen(false)}
          onAdministerDose={(d) => {
            setAdministeringDose(d);
          }}
        />
      )}
    </div>
  );
}
