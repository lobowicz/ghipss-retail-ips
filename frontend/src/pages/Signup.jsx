import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './Signup.css';

export default function Signup() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', pin: '', cardImage: null
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // handles user input changes
  const handleChange = e => {
    const { name, value, files } = e.target;
    if (files) setForm(f => ({ ...f, [name]: files[0] }));
    else setForm(f => ({ ...f, [name]: value }));
  };

  // on submit, post to 'auth/signup', then redirect to OTP page
  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append('name', form.name);
      data.append('email', form.email);
      data.append('phone', form.phone);
      data.append('pin', form.pin);
      data.append('cardImage', form.cardImage);

      await api.post('/auth/signup', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate('/verify-otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h1 className="signup-title">Sign Up</h1>
        {error && <div className="signup-error">{error}</div>}
        <form className="signup-form" onSubmit={handleSubmit}>
          <input className="signup-input" name="name" placeholder="Name / Business Name"  onChange={handleChange} required />
          <input className="signup-input" name="email" type="email" placeholder="Email" onChange={handleChange} required />
          <input className="signup-input" name="phone" placeholder="Phone (233559307777)" onChange={handleChange} required />
          <input className="signup-input" name="pin" type="password" placeholder="Choose 4-digit PIN" onChange={handleChange} required />
          <label>Upload your GhanaCard 
            <input className="signup-input" name="cardImage" type="file" onChange={handleChange} accept="image/*" required />
          </label>
          <button className="signup-button" type="submit">Submit</button>
        </form>
      </div>
    </div>
  );
}
