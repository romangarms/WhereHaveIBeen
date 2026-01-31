/**
 * App Component
 * Main application component with routing
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/layout/Navigation';
import HomePage from './components/pages/HomePage';
import AboutPage from './components/pages/AboutPage';
import SetupPage from './components/pages/SetupPage';
import useAuth from './hooks/useAuth';

export default function App() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <Router>
      <div className="min-h-screen bg-neutral-50">
        <Navigation isAuthenticated={isAuthenticated} onSignOut={logout} />

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/setup" element={<SetupPage />} />
        </Routes>
      </div>
    </Router>
  );
}
