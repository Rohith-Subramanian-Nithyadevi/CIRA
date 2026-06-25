
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';

// Placeholder for the actual Login component to be built later
function LoginPlaceholder() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="glass-card p-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Centralized Login Portal</h1>
        <p className="text-slate-400">Authentication system integration pending.</p>
        <a href="/" className="mt-6 inline-block text-blue-400 hover:text-blue-300">Return to Gateway</a>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPlaceholder />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
