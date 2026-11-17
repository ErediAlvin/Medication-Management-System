import React, { useState, useEffect } from 'react';
import { X, Pill, Search, Plus, AlertCircle, ShieldAlert, Check } from 'lucide-react';
import { api } from '../services/api';

export default function MedicationCatalogModal({ onClose, currentUser }) {
  const [medications, setMedications] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // New drug form state
  const [tradeName, setTradeName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [dosageForm, setDosageForm] = useState('Tablet');
  const [strength, setStrength] = useState('');
  const [defaultRoute, setDefaultRoute] = useState('Oral');
  const [warnings, setWarnings] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canManageCatalog = currentUser?.role === 'PHARMACIST' || currentUser?.role === 'ADMIN';

  useEffect(() => {
    loadCatalog();
  }, [search]);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const res = await api.getMedications(search);
      if (res.success) {
        setMedications(res.medications);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!tradeName.trim() || !genericName.trim() || !strength.trim()) {
      setError('Trade name, generic name, and strength are required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await api.createMedication({
        trade_name: tradeName.trim(),
        generic_name: genericName.trim(),
        dosage_form: dosageForm,
        strength: strength.trim(),
        default_route: defaultRoute,
        warnings: warnings.trim() || 'Standard clinical precautions apply.'
      });

      if (res.success) {
        setShowAddForm(false);
        setTradeName('');
        setGenericName('');
        setStrength('');
        setWarnings('');
        await loadCatalog();
      }
    } catch (err) {
      setError(err.message || 'Failed to add medication.');
    } finally {
      setSaving(false);
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
              <h2 className="modal-title text-lg font-bold">Hospital Drug Formulary & Catalog</h2>
              <p className="text-xs text-muted">
                Official formulary drugs available for inpatient prescription
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManageCatalog && (
              <button
                className={`btn btn-sm ${showAddForm ? 'btn-secondary' : 'btn-teal'} flex items-center gap-1`}
                onClick={() => setShowAddForm(!showAddForm)}
              >
                <Plus size={14} />
                <span>{showAddForm ? 'Cancel Form' : 'Add Medication'}</span>
              </button>
            )}
            <button className="btn-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body py-4 space-y-4">
          {/* Add Drug Form */}
          {showAddForm && (
            <form onSubmit={handleAddMedication} className="p-4 bg-slate-50 border rounded-lg space-y-3">
              <h3 className="font-bold text-sm text-slate-800">Add New Drug to Formulary</h3>
              {error && (
                <div className="text-xs text-rose-700 p-2 bg-rose-50 border border-rose-200 rounded">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Brand / Trade Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Lipitor, Augmentin"
                    value={tradeName}
                    required
                    onChange={(e) => setTradeName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Generic Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Atorvastatin, Amoxicillin/Clavulanate"
                    value={genericName}
                    required
                    onChange={(e) => setGenericName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Strength</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 20 mg, 1 g"
                    value={strength}
                    required
                    onChange={(e) => setStrength(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Dosage Form</label>
                  <select
                    className="form-select"
                    value={dosageForm}
                    onChange={(e) => setDosageForm(e.target.value)}
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Vial for Injection">Vial for Injection</option>
                    <option value="Oral Liquid">Oral Liquid</option>
                    <option value="Pen Cartridge">Pen Cartridge</option>
                    <option value="Topical Cream">Topical Cream</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Default Route</label>
                  <select
                    className="form-select"
                    value={defaultRoute}
                    onChange={(e) => setDefaultRoute(e.target.value)}
                  >
                    <option value="Oral">Oral (PO)</option>
                    <option value="IV">Intravenous (IV)</option>
                    <option value="Subcutaneous">Subcutaneous (SC)</option>
                    <option value="Intramuscular">Intramuscular (IM)</option>
                    <option value="Inhalation">Inhalation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Clinical Precautions / Warnings</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. High Alert: Double check dosage; check penicillin allergies"
                  value={warnings}
                  onChange={(e) => setWarnings(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-teal btn-xs"
                  disabled={saving}
                >
                  {saving ? 'Adding...' : 'Save to Catalog'}
                </button>
              </div>
            </form>
          )}

          {/* Search Bar */}
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search catalog by brand or generic name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Drugs Table */}
          <div className="catalog-table-wrapper border rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b text-xs font-semibold text-slate-600">
                  <th className="p-3">Trade Name</th>
                  <th className="p-3">Generic Name</th>
                  <th className="p-3">Strength & Form</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Clinical Precautions</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((m) => (
                  <tr key={m.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{m.trade_name}</td>
                    <td className="p-3 text-slate-700 italic">{m.generic_name}</td>
                    <td className="p-3">
                      <span className="font-semibold text-teal-700">{m.strength}</span> ({m.dosage_form})
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">
                        {m.default_route}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-500 max-w-xs">
                      {m.warnings || 'Standard precautions'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted">
            {medications.length} active medications registered in formulary
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close Catalog
          </button>
        </div>
      </div>
    </div>
  );
}
