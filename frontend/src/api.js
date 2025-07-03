import axios from 'axios';

const api = axios.create({
  baseURL: '/',  // proxy in package.json points to http://localhost:4000
  headers: { 'Content-Type': 'application/json' }
});

// "axios interceptor" - attach JWT token automatically if present
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
