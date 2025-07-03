import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import './Login.css';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const submit = async e => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', { phone, pin });
      localStorage.setItem('token', res.data.token);
      navigate('/merchant');
    } catch (error) {
      setErr(error.response?.data?.error || 'Login failed.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">GhIPSS GhanaPay Login</h1>
        {err && <div className="login-error">{err}</div>}
        <form className="login-form" onSubmit={submit}>
          <input 
            className="login-input"
            type="tel" 
            placeholder="Phone Number" 
            value={phone} 
            onChange={e => setPhone(e.target.value)} 
            required 
          />
          <input 
            className="login-input"
            type="password" 
            placeholder="PIN" 
            value={pin} 
            onChange={e => setPin(e.target.value)} 
            required 
          />
          <button className="login-button" type="submit">Login</button>

          <p>
            Don’t have an account? <Link to="/signup">Sign up here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
