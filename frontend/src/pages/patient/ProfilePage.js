import { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/PatientProfile.css";
import { useApi } from '../../context/ApiContext';
const DEPENDANT_ALLOWED_CATEGORIES = ["Faculty", "Staff", "Outsourced Staff"];
function PatientProfile() {
  const [profile, setProfile] = useState(null);
  const [newDependant, setNewDependant] = useState({ name: '', age: '', sex: '', relationship: '', bloodGroup: '', phone: '', allergies: '', uhid: '' });
  const [isSavingDependant, setIsSavingDependant] = useState(false);
  const [dependantError, setDependantError] = useState('');
  const apiBaseUrl = useApi();

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/api/users/profile`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
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
    if (!newDependant.name.trim()) {
      setDependantError('Dependant name is required');
      return;
    }

    setIsSavingDependant(true);
    setDependantError('');

    try {
      await axios.post(`${apiBaseUrl}/api/users/dependants`, newDependant, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setNewDependant({ name: '', age: '', sex: '', relationship: '', bloodGroup: '', phone: '', allergies: '', uhid: '' });
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
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
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

  if (!profile) return <div>Loading profile...</div>;

  return (
    <div className="patient-container">
      <div className="patient-card">
        <h2>My Profile</h2>
        <img src={profile.picture} alt="Profile" className="patient-picture" />

        <p>
          <strong>Name:</strong> {profile.name}
        </p>
        <p>
          <strong>Email:</strong> {profile.email}
        </p>
        <p>
          <strong>Age:</strong> {profile.age || "Not set"}
        </p>
        <p>
          <strong>Sex:</strong> {profile.sex || "Not set"}
        </p>
        <p>
          <strong>UHID:</strong> {profile.uhid || "Not assigned"}
        </p>
        <p>
          <strong>Phone:</strong> {profile.phone || "Not set"}
        </p>
        <p>
          <strong>Institutional ID:</strong> {profile.roll || "Not set"}
        </p>
        <p>
          <strong>Patient Category:</strong> {profile.patientCategory || "Not set"}
        </p>
        <p>
          <strong>Clinical Consent:</strong> {profile.consentAccepted ? "Accepted" : "Not Accepted"}
        </p>

        {profile.dependants?.length > 0 && (
          <div className="patient-dependants">
            <h3>Dependants</h3>
            {profile.dependants.map((dep) => (
              <div key={dep._id} className="patient-dependant-item">
                <div>
                  <p><strong>Name:</strong> {dep.name}</p>
                  <p><strong>Relationship:</strong> {dep.relationship || 'N/A'}</p>
                  <p><strong>Age:</strong> {dep.age || 'N/A'}</p>
                </div>
                <button className="dependant-delete-btn" onClick={() => handleDeleteDependant(dep._id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {DEPENDANT_ALLOWED_CATEGORIES.includes(profile.patientCategory) && (
          <div className="patient-dependant-form-card">
            <h3>Add Dependant</h3>
            <form className="dependant-form" onSubmit={handleAddDependant}>
              <label>
                Name
                <input name="name" value={newDependant.name} onChange={handleChangeDependant} required />
              </label>
              <label>
                Relationship
                <input name="relationship" value={newDependant.relationship} onChange={handleChangeDependant} />
              </label>
              <label>
                Age
                <input name="age" type="number" value={newDependant.age} onChange={handleChangeDependant} />
              </label>
              <label>
                Sex
                <select name="sex" value={newDependant.sex} onChange={handleChangeDependant}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label>
                UHID
                <input name="uhid" value={newDependant.uhid} onChange={handleChangeDependant} />
              </label>
              <label>
                Phone
                <input name="phone" value={newDependant.phone} onChange={handleChangeDependant} />
              </label>
              <label>
                Allergies
                <input name="allergies" value={newDependant.allergies} onChange={handleChangeDependant} />
              </label>
              <label>
                Blood Group
                <input name="bloodGroup" value={newDependant.bloodGroup} onChange={handleChangeDependant} />
              </label>
              {dependantError && <p className="dependant-error">{dependantError}</p>}
              <button type="submit" className="dependant-submit-btn" disabled={isSavingDependant}>
                {isSavingDependant ? 'Saving...' : 'Add Dependant'}
              </button>
            </form>
          </div>
        )}

        <button className="patient-signout-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default PatientProfile;
