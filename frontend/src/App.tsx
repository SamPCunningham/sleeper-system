import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Campaigns from './pages/Campaigns';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/campaigns" 
          element={isAuthenticated ? <Campaigns /> : <Navigate to="/login" />} 
        />
        <Route path="/" element={<Navigate to={isAuthenticated ? "/campaigns" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;