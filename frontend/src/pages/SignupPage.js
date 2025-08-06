import React, { useState } from 'react';
import axios from 'axios';

function SignupPage() {
  const [form, setForm] = useState({ roll: '', password: '' });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    axios.post('http://localhost:5000/api/auth/signup', form)
      .then(() => {
        alert('Signup successful. Please login.');
        window.location.href = '/login';
      }).catch((err) => {
        alert(err.response?.data?.message || 'Signup failed');
      });
  };

  return (
    <div>
      <h2>Signup</h2>
      <form onSubmit={handleSubmit}>
        <input name="roll" placeholder="Roll Number" onChange={handleChange} required />
        <input name="password" type="password" placeholder="Password" onChange={handleChange} required />
        <button type="submit">Signup</button>
      </form>
    </div>
  );
}

export default SignupPage;
