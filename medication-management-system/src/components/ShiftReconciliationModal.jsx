import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  Building2,
  RefreshCw,
  Check,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function ShiftReconciliationModal({
  wardId,
  wards = [],
  currentUser,
  onClose,
  onAdministerDose
}) {
  const [selectedWard, setSelectedWard] = useState(wardId || currentUser?.assigned_ward_id || 'all');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadReconciliation();
  }, [selectedWard]);

  const loadReconciliation = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getShiftReconciliation(selectedWard);
      if (res.success) {
        setReport(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load reconciliation report');
    } finally {
      setLoading(false);
    }
  };

  const summary = report?.summary || {
    totalScheduled: 0,
    administeredCount: 0,
    pendingCount: 0,
    heldCount: 0,
    isCleanHandover: false
  };

  const unadministered = report?.unadministeredDoses || [];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '780px', width: '100%' }}>
        {/* Header */}
        <div className="modal-header flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h3 className="modal-title font-bold text-lg text-slate-900 m-0">
                Shift Handover & Reconciliation Report
              </h3>
              <p className="modal-subtitle text-xs text-slate-500 m-0">
                Module 5: End-of-shift pending vs completed reconciliation & missed dose verification
              </p>
            </div>
          </div>
          <button
            className="btn btn-icon btn-sm text-slate-400 hover:text-slate-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Filters & Refresh */}
        <div className="p-4 bg-slate-50 border-b flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-500" />
            <select
              className="form-select text-xs py-1.5"
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
            >
              <option value="all">All Hospital Wards</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline btn-xs flex items-center gap-1"
              onClick={loadReconciliation}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Report</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Handover Status Banner */}
          {summary.isCleanHandover ? (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={28} className="text-emerald-600" />
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm m-0">
                    CLEAN SHIFT HANDOVER READY
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5 m-0">
                    All {summary.totalScheduled} scheduled doses for today have been administered or clinically accounted for.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">
                100% Accounted
              </span>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle size={28} className="text-amber-600" />
                <div>
                  <h4 className="font-bold text-amber-950 text-sm m-0">
                    ACTION REQUIRED BEFORE HANDOVER
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5 m-0">
                    <strong>{summary.pendingCount}</strong> scheduled dose(s) remain pending in this ward round.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-full">
                {summary.pendingCount} Pending
              </span>
            </div>
          )}

          {/* KPI Metrics Row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-white border rounded-xl text-center">
              <span className="text-2xs uppercase text-slate-500 font-bold block">Total Scheduled</span>
              <span className="text-xl font-extrabold text-slate-900 block mt-1">{summary.totalScheduled}</span>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <span className="text-2xs uppercase text-emerald-700 font-bold block">Administered</span>
              <span className="text-xl font-extrabold text-emerald-900 block mt-1">{summary.administeredCount}</span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <span className="text-2xs uppercase text-amber-800 font-bold block">Pending</span>
              <span className="text-xl font-extrabold text-amber-950 block mt-1">{summary.pendingCount}</span>
            </div>
            <div className="p-3 bg-slate-50 border rounded-xl text-center">
              <span className="text-2xs uppercase text-slate-500 font-bold block">Held / Refused</span>
              <span className="text-xl font-extrabold text-slate-700 block mt-1">{summary.heldCount}</span>
            </div>
          </div>

          {/* Pending Doses Action Table */}
          <div>
            <h4 className="font-bold text-sm text-slate-800 mb-2 flex items-center gap-1.5">
              <Clock size={16} className="text-amber-600" />
              <span>Pending & Unadministered Doses Requiring Review:</span>
            </h4>

            {unadministered.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed rounded-xl text-center text-xs text-slate-500">
                <ShieldCheck size={24} className="mx-auto mb-1 text-emerald-600" />
                No pending doses. All medications for this ward have been signed off.
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b text-slate-600 font-bold">
                    <tr>
                      <th className="p-2.5">Bed / Patient</th>
                      <th className="p-2.5">Medication</th>
                      <th className="p-2.5">Slot / Time</th>
                      <th className="p-2.5">Ward</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unadministered.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50/60">
                        <td className="p-2.5">
                          <span className="bed-badge mr-1.5">{d.bed_number}</span>
                          <span className="font-bold text-slate-900">{d.patient_name}</span>
                          <span className="text-2xs text-slate-400 block font-mono">MRN: {d.mrn}</span>
                        </td>
                        <td className="p-2.5">
                          <span className="font-bold text-slate-900">{d.trade_name}</span>
                          <span className="text-2xs text-teal-800 block font-semibold">{d.dosage} • {d.route}</span>
                        </td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-amber-100 text-amber-800">
                            {d.slot}
                          </span>
                          <span className="text-2xs text-slate-500 block font-mono mt-0.5">
                            Target: {d.target_time}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {d.ward_code}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            className="btn btn-teal btn-xs"
                            onClick={() => {
                              onClose();
                              if (onAdministerDose) onAdministerDose(d);
                            }}
                          >
                            Administer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t flex items-center justify-between">
          <div className="text-2xs text-slate-500">
            Reconciled for <strong>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</strong>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
