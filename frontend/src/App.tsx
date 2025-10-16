import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to={isAuthenticated ? "/campaigns" : "/login"} />} />
        {/* We'll add more routes here */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;