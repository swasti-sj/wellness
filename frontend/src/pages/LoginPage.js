import { useState } from 'react';
import axios from 'axios';

function LoginPage() {
  const [roll, setRoll] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);

  const handleSubmit = async () => {
    const endpoint = isSignup
      ? 'http://localhost:5000/api/auth/signup'
      : 'http://localhost:5000/api/auth/login';

    try {
      const res = await axios.post(endpoint, { roll, password });
      localStorage.setItem('token', res.data.token);
      window.location.href = '/dashboard';
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
      <button onClick={handleSubmit}>{isSignup ? 'Signup' : 'Login'}</button>
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
