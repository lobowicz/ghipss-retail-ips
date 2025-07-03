import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './VerifyOTP.css';

export default function VerifyOTP() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const submit = async e => {
    e.preventDefault();
    try {
      await api.post('/auth/verify-otp', { phone, code });
      navigate('/login');
    } catch (error) {
      setErr(error.response?.data?.error || 'OTP verification failed');
    }
  };

  return (
    <div className='verify-otp-container'>
      <div className='verify-otp-card'>
        <h2 className="verify-otp-title">Verify OTP</h2>
        <p className="verify-otp-subtitle">
          Enter your phone number and the verification code sent to your device
        </p>
        {err && <div className="verify-otp-error">{err}</div>}
        <form className="verify-otp-form" onSubmit={submit}>
          <input className="verify-otp-input" placeholder="Phone" value={phone}
                onChange={e => setPhone(e.target.value)} required />
          <input className="verify-otp-input verify-otp-code-input" placeholder="OTP Code" value={code}
                onChange={e => setCode(e.target.value)} required maxLength="6"/>
          <button className="verify-otp-button" type="submit">Verify</button>
        </form>
      </div>
    </div>
  );
}
