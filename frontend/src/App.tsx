import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Admin from './pages/Admin';

function App() {
  const { isAuthenticated, isAdmin } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/campaigns" 
          element={isAuthenticated() ? <Campaigns /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/campaigns/:id" 
          element={isAuthenticated() ? <CampaignDetail /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/admin"
          element={isAuthenticated() && isAdmin() ? <Admin /> : <Navigate to="/campaigns" />}
        />
        <Route path="/" element={<Navigate to={isAuthenticated() ? "/campaigns" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;