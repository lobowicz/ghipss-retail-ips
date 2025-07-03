import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Signup from './pages/Signup';
import VerifyOTP from './pages/VerifyOTP';
import Login from './pages/Login';
import MerchantDashboard from './pages/MerchantDashboard';
import ScanPay from './pages/ScanPay';
import Reconciliation from './pages/Reconciliation';

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/login" element={<Login />} />
        <Route path="/merchant" element={ <RequireAuth><MerchantDashboard /></RequireAuth> } />
        <Route path="/scan-pay" element={<ScanPay />} />
        <Route path="/reconciliation" element={<RequireAuth><Reconciliation /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}
