import { useState } from 'react';
import axios from 'axios';
import '../../styles/LoginPage.css'; 
function LoginPage() {
  const [roll, setRoll] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient'); // default role
  const [isSignup, setIsSignup] = useState(false);

  const handleSubmit = async () => {
  const endpoint = isSignup
    ? 'http://localhost:5000/api/auth/signup'
    : 'http://localhost:5000/api/auth/login';

  const payload = isSignup
    ? { roll, password, role }
    : { roll, password };

  try {
    const res = await axios.post(endpoint, payload);
    
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('role', res.data.role); // store role for later use

    // Redirect based on role
    if (res.data.role === 'patient') {
      window.location.href = '/dashboard';
    } else if (res.data.role === 'doctor') {
      window.location.href = '/docdashboard';
    } else if (res.data.role === 'admin') {
      window.location.href = '/admindashboard';
    } else {
      alert('Unknown role');
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Error occurred');
  }
};


  return (
    <div className="login-container">
      <h2>{isSignup ? 'Student Signup' : 'Student Login (LDAP)'}</h2>

      <input
        placeholder="Roll No"
        value={roll}
        onChange={(e) => setRoll(e.target.value)}
      />

      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {isSignup && (
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="patient">Patient</option>
          <option value="doctor">Doctor</option>
          <option value="admin">Admin</option>
        </select>
      )}

      <button onClick={handleSubmit}>
        {isSignup ? 'Signup' : 'Login'}
      </button>

      <p>
        {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
        <span
          onClick={() => setIsSignup(!isSignup)}
          style={{ color: 'blue', cursor: 'pointer' }}
        >
          {isSignup ? 'Login' : 'Signup'}
        </span>
      </p>
    </div>
  );
}

export default LoginPage;
