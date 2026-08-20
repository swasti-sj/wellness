import { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/PatientProfile.css";
import { useApi } from '../../context/ApiContext';

const DEPENDANT_ALLOWED_CATEGORIES = ["Faculty", "Staff", "Outsourced Staff"];

function PatientProfile() {
  const [profile, setProfile] = useState(null);
  const [newDependant, setNewDependant] = useState({ name: '', age: '', sex: '', relationship: '', bloodGroup: '', phone: '', allergies: '' });
  const [isSavingDependant, setIsSavingDependant] = useState(false);
  const [dependantError, setDependantError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const apiBaseUrl = useApi();

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/api/users/profile`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setProfile(res.data);
    } catch (err) {
      console.error("Failed to load profile:", err);
      setProfile(null);
    }
  };

  useEffect(() => {
    if (!apiBaseUrl) return;
    fetchProfile();
  }, [apiBaseUrl]);

  const handleChangeDependant = (e) => {
    const { name, value } = e.target;
    setNewDependant((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddDependant = async (e) => {
    e.preventDefault();
    setIsSavingDependant(true);
    setDependantError('');

    try {
      await axios.post(`${apiBaseUrl}/api/users/dependants`, newDependant, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setNewDependant({ name: '', age: '', sex: '', relationship: '', bloodGroup: '', phone: '', allergies: '' });
      setShowAddForm(false);
      await fetchProfile();
    } catch (err) {
      console.error('Failed to add dependant:', err);
      setDependantError(err.response?.data?.error || 'Unable to add dependant');
    } finally {
      setIsSavingDependant(false);
    }
  };

  const handleDeleteDependant = async (dependantId) => {
    if (!window.confirm('Remove this dependant?')) return;
    try {
      await axios.delete(`${apiBaseUrl}/api/users/dependants/${dependantId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      await fetchProfile();
    } catch (err) {
      console.error('Failed to delete dependant:', err);
      alert(err.response?.data?.error || 'Unable to remove dependant');
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (!profile) return (
    <div className="pp-loading">
      <div className="pp-spinner" />
      <span>Loading profile...</span>
    </div>
  );

  const infoFields = [
    { label: 'Name', value: profile.name },
    { label: 'Email', value: profile.email },
    { label: 'UHID', value: profile.uhid || 'Not assigned', highlight: true },
    { label: 'Age', value: profile.age || 'Not set' },
    { label: 'Sex', value: profile.sex || 'Not set' },
    { label: 'Phone', value: profile.phone || 'Not set' },
    { label: 'Institutional ID', value: profile.roll || 'Not set' },
    { label: 'Patient Category', value: profile.patientCategory || 'Not set' },
    { label: 'Clinical Consent', value: profile.consentAccepted ? 'Accepted' : 'Not Accepted' },
  ];

  const canAddDependants = DEPENDANT_ALLOWED_CATEGORIES.includes(profile.patientCategory);

  return (
    <div className="pp-container">
      <div className="pp-card">
        {/* Header */}
        <div className="pp-header">
          <img src={profile.picture} alt="Profile" className="pp-avatar" />
          <div className="pp-name">{profile.name}</div>
          <div className="pp-role">{profile.patientCategory || 'Patient'}</div>
          {profile.uhid && (
            <div className="pp-uhid-badge">UHID: {profile.uhid}</div>
          )}
        </div>

        {/* Info Grid */}
        <div className="pp-info-grid">
          {infoFields.map((f, i) => (
            <div key={i} className={`pp-info-item${f.highlight ? ' pp-highlight' : ''}`}>
              <span className="pp-info-label">{f.label}</span>
              <span className="pp-info-value">{f.value}</span>
            </div>
          ))}
        </div>

        {/* Dependants Section */}
        {canAddDependants && (
          <div className="pp-dependants-section">
            <div className="pp-dep-header">
              <span className="pp-dep-title">
                Dependants
                {profile.dependants?.length > 0 && (
                  <span className="pp-dep-count">{profile.dependants.length}</span>
                )}
              </span>
              <button
                className={`pp-add-dep-btn${showAddForm ? ' active' : ''}`}
                onClick={() => { setShowAddForm(v => !v); setDependantError(''); }}
              >
                {showAddForm ? '✕ Cancel' : '+ Add Dependant'}
              </button>
            </div>

            {/* Existing Dependants */}
            {profile.dependants?.length > 0 && (
              <div className="pp-dep-list">
                {profile.dependants.map((dep) => (
                  <div key={dep._id} className="pp-dep-card">
                    <div className="pp-dep-card-top">
                      <div className="pp-dep-avatar">{dep.name?.[0]?.toUpperCase() || '?'}</div>
                      <div className="pp-dep-info">
                        <div className="pp-dep-name">{dep.name}</div>
                        <div className="pp-dep-meta">
                          {dep.relationship && <span className="pp-dep-chip">{dep.relationship}</span>}
                          {dep.sex && <span className="pp-dep-chip">{dep.sex}</span>}
                          {dep.age !== undefined && dep.age !== '' && <span className="pp-dep-chip">Age {dep.age}</span>}
                        </div>
                      </div>
                      <div className="pp-dep-uhid-badge">{dep.uhid || '—'}</div>
                    </div>
                    {(dep.phone || dep.bloodGroup || dep.allergies) && (
                      <div className="pp-dep-extra">
                        {dep.phone && <span>{dep.phone}</span>}
                        {dep.bloodGroup && <span>{dep.bloodGroup}</span>}
                        {dep.allergies && <span>Allergies: {dep.allergies}</span>}
                      </div>
                    )}
                    <button className="pp-dep-remove-btn" onClick={() => handleDeleteDependant(dep._id)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Collapsible Add Form */}
            {showAddForm && (
              <div className="pp-dep-form-wrap">
                <form className="pp-dep-form" onSubmit={handleAddDependant}>
                  <div className="pp-dep-form-grid">
                    <label className="pp-dep-field">
                      <span>Name <span style={{ color: '#ff6b6b' }}>*</span></span>
                      <input
                        name="name"
                        placeholder="Full name"
                        value={newDependant.name}
                        onChange={handleChangeDependant}
                        required
                      />
                    </label>
                    <label className="pp-dep-field">
                      <span>Relationship <span style={{ color: '#ff6b6b' }}>*</span></span>
                      <input
                        name="relationship"
                        placeholder="e.g. Son, Daughter"
                        value={newDependant.relationship}
                        onChange={handleChangeDependant}
                        required
                      />
                    </label>
                    <label className="pp-dep-field">
                      <span>Age <span style={{ color: '#ff6b6b' }}>*</span></span>
                      <input
                        name="age"
                        type="number"
                        min="0"
                        max="120"
                        placeholder="Age"
                        value={newDependant.age}
                        onChange={handleChangeDependant}
                        required
                      />
                    </label>
                    <label className="pp-dep-field">
                      <span>Sex <span style={{ color: '#ff6b6b' }}>*</span></span>
                      <select
                        name="sex"
                        value={newDependant.sex}
                        onChange={handleChangeDependant}
                        required
                      >
                        <option value="" style={{ background: '#2d0a3a', color: '#fff' }}>Select</option>
                        <option value="Male" style={{ background: '#2d0a3a', color: '#fff' }}>Male</option>
                        <option value="Female" style={{ background: '#2d0a3a', color: '#fff' }}>Female</option>
                        <option value="Other" style={{ background: '#2d0a3a', color: '#fff' }}>Other</option>
                      </select>
                    </label>
                    <label className="pp-dep-field">
                      <span>Phone</span>
                      <input
                        name="phone"
                        placeholder="Phone number"
                        value={newDependant.phone}
                        onChange={handleChangeDependant}
                      />
                    </label>
                    <label className="pp-dep-field">
                      <span>Blood Group</span>
                      <input name="bloodGroup" placeholder="e.g. O+" value={newDependant.bloodGroup} onChange={handleChangeDependant} />
                    </label>
                    <label className="pp-dep-field pp-dep-full">
                      <span>Allergies</span>
                      <input name="allergies" placeholder="Known allergies" value={newDependant.allergies} onChange={handleChangeDependant} />
                    </label>
                  </div>
                  {dependantError && <p className="pp-dep-error">{dependantError}</p>}
                  <div className="pp-dep-form-footer">
                    <p className="pp-dep-uhid-note">UHID will be auto-assigned</p>
                    <button type="submit" className="pp-dep-submit-btn" disabled={isSavingDependant}>
                      {isSavingDependant ? 'Adding...' : 'Add Dependant'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Sign Out */}
        <button className="pp-signout-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default PatientProfile;
