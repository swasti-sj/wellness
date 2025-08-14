import { useEffect, useState } from 'react';
import axios from 'axios';
import InitialProfileForm from './InitialProfileForm';
import HomeCards from './HomeCards';
import AppointmentBooking from './AppointmentBooking';
import VisitHistory from './VisitHistory';
import { Routes, Route, Link } from 'react-router-dom';
import ProfilePage from './ProfilePage';
import '../../styles/Dashboard.css';
function Dashboard() {
  const [profileFilled, setProfileFilled] = useState(null);

  useEffect(() => {
    axios
      .get('http://localhost:5000/api/users/profile', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })
      .then((res) => {
        if (res.data?.name) setProfileFilled(true);
        else setProfileFilled(false);
      })
      .catch(() => setProfileFilled(false));
  }, []);

  if (profileFilled === null) return <div>Loading...</div>;
  if (!profileFilled) return <InitialProfileForm onComplete={() => setProfileFilled(true)} />;

  return (
    <div className="dashboard-container">
      <nav style={{ marginBottom: '20px' }}>
        <Link to="/dashboard" style={{ marginRight: '10px' }}>Home</Link>
        <Link to="/dashboard/book" style={{ marginRight: '10px' }}>Book Appointment</Link>
        <Link to="/dashboard/history" style={{ marginRight: '10px' }}>Visit History</Link>
        <Link to="/dashboard/profile">My Profile</Link>
      </nav>

      <Routes>
        <Route path="/" element={<HomeCards />} />
        <Route path="/book" element={<AppointmentBooking />} />
        <Route path="/history" element={<VisitHistory />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </div>
  );
}

export default Dashboard;
