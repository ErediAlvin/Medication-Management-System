import React from 'react';
import { LogOut, X, ShieldAlert, Check } from 'lucide-react';

export default function LogoutModal({ currentUser, onConfirm, onCancel }) {
  if (!currentUser) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 100 }}>
      <div className="modal-content" style={{ maxWidth: '420px', width: '100%' }}>
        <div className="modal-header flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <LogOut size={20} />
            </div>
            <div>
              <h3 className="modal-title font-bold text-base text-slate-900 m-0">
                Confirm Station Sign Out
              </h3>
              <p className="modal-subtitle text-xs text-slate-500 m-0">
                Terminate active clinical session
              </p>
            </div>
          </div>
          <button
            className="btn btn-icon btn-sm text-slate-400 hover:text-slate-600"
            onClick={onCancel}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-700 m-0 leading-relaxed">
            Are you sure you want to log out of your clinical session as{' '}
            <strong className="text-slate-900">{currentUser.name}</strong> ({currentUser.role})?
          </p>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-2xs text-amber-900 flex items-start gap-2">
            <ShieldAlert size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Security Protocol:</strong> Your active session token will be invalidated immediately. Open patient charts will be closed to protect Protected Health Information (PHI).
            </div>
          </div>
        </div>

        <div className="modal-footer flex items-center justify-end gap-2.5 p-3.5 bg-slate-50 border-t">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm flex items-center gap-1.5"
            onClick={onConfirm}
          >
            <LogOut size={14} />
            <span>Sign Out & Lock Station</span>
          </button>
        </div>
      </div>
    </div>
  );
}
