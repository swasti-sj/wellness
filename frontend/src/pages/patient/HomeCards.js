import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/HomeCards.css';

function HomeCards() {
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState(null);
  const [lastVisit, setLastVisit] = useState(null);

  useEffect(() => {
  axios.get('http://localhost:5000/api/appointments/my-appointments', {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  })
  .then((res) => {
    setUpcoming(res.data.upcoming);
    setLastVisit(res.data.lastVisit);
  })
  .catch((err) => console.error('Error fetching appointment info:', err));
}, []);

  const handleBookNow = () => {
    navigate('/dashboard/book');
  };

  return (
    <div className="cards">
      <div className="card purple">
        {upcoming ? (
          <>
            <strong>Upcoming Appointment:</strong><br />
            Dr. {upcoming.doctorName} <br />
            {upcoming.date}, {upcoming.time}
          </>
        ) : (
          'No upcoming appointments.'
        )}
      </div>

      <div className="card white">
        {lastVisit ? (
          <>
            <strong>Last Visit:</strong><br />
            Dr. {lastVisit.doctorName} <br />
            Notes: {lastVisit.notes || 'No notes'}
          </>
        ) : (
          'No previous visits.'
        )}
      </div>

      <div className="card purple">
        <strong>Quick Book:</strong> <button onClick={handleBookNow}>Book Now</button>
      </div>
    </div>
  );
}

export default HomeCards;