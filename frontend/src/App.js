import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/patient/LoginPage';
import Dashboard from './pages/patient/Dashboard';
import './App.css';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
