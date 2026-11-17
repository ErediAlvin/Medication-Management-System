import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import WardSelector from './components/WardSelector';
import PatientCard from './components/PatientCard';
import PatientRecordModal from './components/PatientRecordModal';
import AdmitPatientModal from './components/AdmitPatientModal';
import AssignMedicationModal from './components/AssignMedicationModal';
import MedicationCatalogModal from './components/MedicationCatalogModal';
import MedicationScheduleScreen from './components/MedicationScheduleScreen';
import LoginScreen from './components/LoginScreen';
import LogoutModal from './components/LogoutModal';
import { api, authStorage } from './services/api';
import {
  Building2,
  Users,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  ShieldCheck,
  Pill,
  Clock
} from 'lucide-react';
import './App.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(authStorage.getUser());
  const [activeScreen, setActiveScreen] = useState('schedule');
  const [wards, setWards] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Authentication & Logout state
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggedOutNotice, setIsLoggedOutNotice] = useState(false);

  // Filters for Patient Registry
  const [selectedWardId, setSelectedWardId] = useState('all');
  const [myPatientsOnly, setMyPatientsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [assignMedPatient, setAssignMedPatient] = useState(null);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  // Live Due Now count for sidebar badge
  const [dueNowCount, setDueNowCount] = useState(0);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = authStorage.getUser();
      if (user) {
        setCurrentUser(user);
        // Role-based automatic screen redirection
        if (user.role === 'NURSE') {
          setActiveScreen('schedule');
        } else {
          setActiveScreen('patients');
        }
        await loadWards();
        await fetchDueNowCount();
      }
    } catch (err) {
      console.error('Initialization error:', err);
      setError('Failed to connect to Hospital API. Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (user, targetScreen) => {
    setCurrentUser(user);
    setActiveScreen(targetScreen || (user.role === 'NURSE' ? 'schedule' : 'patients'));
    setIsLoggedOutNotice(false);
    loadWards();
    fetchDueNowCount();
  };

  const handleConfirmLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      authStorage.clearToken();
      authStorage.clearUser();
      setCurrentUser(null);
      setIsLogoutModalOpen(false);
      setIsLoggedOutNotice(true);
    }
  };

  const loadWards = async () => {
    try {
      const res = await api.getWards();
      if (res.success) {
        setWards(res.wards);
      }
    } catch (err) {
      console.error('Failed to load wards:', err);
    }
  };

  const fetchDueNowCount = async () => {
    try {
      const res = await api.getDailySchedule();
      if (res.success && res.metrics) {
        setDueNowCount(res.metrics.dueNowDoses || 0);
      }
    } catch (e) {
      // Ignore
    }
  };

  // Load patients whenever filters change
  useEffect(() => {
    if (currentUser) {
      loadPatients();
      fetchDueNowCount();
    }
  }, [currentUser, selectedWardId, myPatientsOnly, searchQuery, activeScreen]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.getPatients({
        ward_id: selectedWardId,
        my_patients: myPatientsOnly,
        search: searchQuery
      });

      if (res.success) {
        setPatients(res.patients);
      }
    } catch (err) {
      setError(err.message || 'Failed to load patients.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (newUser) => {
    if (!newUser) {
      handleConfirmLogout();
      return;
    }
    setCurrentUser(newUser);
    // Role-based automatic screen redirection
    if (newUser.role === 'NURSE') {
      setActiveScreen('schedule');
    } else {
      setActiveScreen('patients');
    }
    setSelectedWardId('all');
    setMyPatientsOnly(false);
    setSearchQuery('');
    loadWards();
    fetchDueNowCount();
  };

  // If user is not logged in, render dedicated Login Screen
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        isLoggedOutNotice={isLoggedOutNotice}
      />
    );
  }

  const isPharmacist = currentUser?.role === 'PHARMACIST';
  const isNurse = currentUser?.role === 'NURSE';

  // Group patients by ward for partitioned display
  const patientsByWard = wards.map(ward => {
    const wardPatients = patients.filter(p => p.ward_id === ward.id);
    return {
      ward,
      patients: wardPatients
    };
  }).filter(group => {
    if (myPatientsOnly) {
      return group.ward.id === currentUser?.assigned_ward_id;
    }
    if (selectedWardId !== 'all') {
      return group.ward.id === selectedWardId;
    }
    return true;
  });

  return (
    <div className="shadcn-app-wrapper">
      {/* Shadcn Sidebar */}
      <Sidebar
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
        currentUser={currentUser}
        onUserChange={handleUserChange}
        onOpenCatalog={() => setIsCatalogModalOpen(true)}
        onSignOutClick={() => setIsLogoutModalOpen(true)}
        dueNowCount={dueNowCount}
      />

      {/* Main Screen Content View */}
      <div className="shadcn-main-viewport">
        {/* Page 2: Dedicated Medication Schedule Screen (Module 4) */}
        {activeScreen === 'schedule' ? (
          <div className="screen-container p-6">
            <MedicationScheduleScreen
              wards={wards}
              currentUser={currentUser}
              onOpenPatientChart={(patientId) => setSelectedPatientId(patientId)}
            />
          </div>
        ) : (
          /* Page 1: Patient Registry & Wards Screen (Module 2 & 3) */
          <div className="screen-container p-6">
            {/* Header */}
            <div className="workspace-header">
              <div>
                <h2 className="workspace-title text-2xl font-bold flex items-center gap-2">
                  <span>Patient Registry & Ward Partitions</span>
                  {isPharmacist && <span className="badge badge-pharm">Pharmacist View</span>}
                  {isNurse && <span className="badge badge-nurse">Nurse View</span>}
                </h2>
                <p className="workspace-subtitle text-sm text-slate-500">
                  {isPharmacist
                    ? 'Assign multi-medication regimens across daily slots. Doses will appear in the schedule.'
                    : 'Manage ward patients, bed allocations, and clinical charts.'}
                </p>
              </div>

              <div className="header-badges flex items-center gap-2">
                <span className="badge badge-outline flex items-center gap-1">
                  <Building2 size={14} />
                  <span>{wards.length} Wards Active</span>
                </span>
                <span className="badge badge-teal flex items-center gap-1">
                  <Users size={14} />
                  <span>{patients.length} Admitted Patients</span>
                </span>
                <button
                  className="btn btn-icon btn-sm"
                  onClick={() => { loadWards(); loadPatients(); }}
                  title="Refresh Data"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {/* Pharmacist Prescription Mode Banner */}
            {isPharmacist && (
              <div className="pharmacist-banner p-3.5 bg-blue-50 border border-blue-200 rounded-xl mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-950 text-xs font-medium">
                  <Pill size={18} className="text-blue-600 flex-shrink-0" />
                  <span>
                    <strong>Pharmacist Order Mode:</strong> You can assign new prescriptions using the <strong>"+ Prescribe"</strong> button on any patient. Scheduled doses automatically populate the <strong>Medication Schedule</strong> tab.
                  </span>
                </div>
                <button
                  className="btn btn-primary btn-xs flex items-center gap-1 flex-shrink-0 ml-3"
                  onClick={() => setAssignMedPatient({})}
                >
                  <Pill size={12} />
                  <span>+ Quick Prescribe</span>
                </button>
              </div>
            )}

            {/* Nurse Focus Banner if viewing "My Assigned Ward" */}
            {myPatientsOnly && currentUser?.ward_name && (
              <div className="nurse-focus-banner flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-lg mb-4">
                <div className="flex items-center gap-2 text-teal-900 text-sm font-medium">
                  <ShieldCheck size={18} className="text-teal-600" />
                  <span>
                    Filtered to your assigned ward: <strong>{currentUser.ward_name} ({currentUser.ward_code})</strong>
                  </span>
                </div>
                <button
                  className="btn btn-outline btn-xs"
                  onClick={() => setMyPatientsOnly(false)}
                >
                  Show All Wards
                </button>
              </div>
            )}

            {/* Ward Selector & Search Actions */}
            <WardSelector
              wards={wards}
              selectedWardId={selectedWardId}
              onSelectWard={setSelectedWardId}
              myPatientsOnly={myPatientsOnly}
              onToggleMyPatients={() => setMyPatientsOnly(!myPatientsOnly)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenAdmitModal={() => setIsAdmitModalOpen(true)}
              currentUser={currentUser}
            />

            {/* Error Alert */}
            {error && (
              <div className="error-alert my-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Partitioned Patients View */}
            {loading ? (
              <div className="loading-container p-12 text-center text-muted">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-teal-600" />
                <p className="text-sm font-medium">Loading ward patients...</p>
              </div>
            ) : patients.length === 0 ? (
              <div className="empty-patients-state p-12 border-2 border-dashed rounded-xl text-center text-muted bg-white">
                <Users size={36} className="mx-auto mb-2 text-slate-300" />
                <h3 className="text-base font-semibold text-slate-700">No Patients Found</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {searchQuery
                    ? `No patients match the search term "${searchQuery}".`
                    : 'No admitted patients found in this selection.'}
                </p>
                {(currentUser?.role === 'ADMIN' || currentUser?.role === 'NURSE') && (
                  <button
                    className="btn btn-teal btn-sm mt-4"
                    onClick={() => setIsAdmitModalOpen(true)}
                  >
                    + Admit New Patient
                  </button>
                )}
              </div>
            ) : (
              <div className="ward-partitions-list space-y-6">
                {patientsByWard.map(({ ward, patients: wardPatients }) => (
                  <div key={ward.id} className="ward-partition-section">
                    <div className="partition-header flex items-center justify-between pb-2 mb-3 border-b">
                      <div className="flex items-center gap-2">
                        <Building2 size={20} className="text-teal-700" />
                        <h3 className="partition-title text-lg font-bold text-slate-800">
                          {ward.name}
                        </h3>
                        <span className="ward-code-badge">{ward.code}</span>
                        <span className="text-xs text-muted">({ward.location})</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-semibold text-slate-600">
                          Occupancy: {wardPatients.length} / {ward.capacity} Beds
                        </span>
                      </div>
                    </div>

                    {wardPatients.length === 0 ? (
                      <div className="p-4 bg-slate-50 border rounded text-xs text-slate-500 text-center">
                        No admitted patients currently in {ward.name}.
                      </div>
                    ) : (
                      <div className="patients-grid">
                        {wardPatients.map(patient => (
                          <PatientCard
                            key={patient.id}
                            patient={patient}
                            onSelectPatient={(p) => setSelectedPatientId(p.id)}
                            onOpenAssignMed={(p) => setAssignMedPatient(p)}
                            currentUser={currentUser}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Patient Clinical Record Drawer / Modal */}
      {selectedPatientId && (
        <PatientRecordModal
          patientId={selectedPatientId}
          onClose={() => setSelectedPatientId(null)}
          onRefresh={() => {
            loadPatients();
            fetchDueNowCount();
          }}
          currentUser={currentUser}
          onOpenAssignMed={(p) => {
            setSelectedPatientId(null);
            setAssignMedPatient(p);
          }}
        />
      )}

      {/* Assign Medication Modal (Module 3) */}
      {assignMedPatient && (
        <AssignMedicationModal
          patient={assignMedPatient.id ? assignMedPatient : null}
          allPatients={patients}
          onClose={() => setAssignMedPatient(null)}
          onSuccess={() => {
            loadPatients();
            fetchDueNowCount();
          }}
          currentUser={currentUser}
        />
      )}

      {/* Patient Admission Modal */}
      {isAdmitModalOpen && (
        <AdmitPatientModal
          wards={wards}
          onClose={() => setIsAdmitModalOpen(false)}
          onSuccess={() => {
            loadWards();
            loadPatients();
            fetchDueNowCount();
          }}
          currentUser={currentUser}
        />
      )}

      {/* Formulary Drug Catalog Modal */}
      {isCatalogModalOpen && (
        <MedicationCatalogModal
          onClose={() => setIsCatalogModalOpen(false)}
          currentUser={currentUser}
        />
      )}

      {/* Station Sign Out Confirmation Modal */}
      {isLogoutModalOpen && (
        <LogoutModal
          currentUser={currentUser}
          onConfirm={handleConfirmLogout}
          onCancel={() => setIsLogoutModalOpen(false)}
        />
      )}
    </div>
  );
}
