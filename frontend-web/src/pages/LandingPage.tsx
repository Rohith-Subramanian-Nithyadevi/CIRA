
import CoreIdeologyCanvas from '../components/CoreIdeologyCanvas';
import PortalGateway from '../components/PortalGateway';
import DistributionHub from '../components/DistributionHub';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-50 selection:bg-blue-500/30">
      {/* Top Navigation Bar - Minimal */}
      <nav className="w-full border-b border-white/5 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tighter text-white flex items-center">
            <span className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 mr-3 flex items-center justify-center text-sm">C</span>
            CIRA
          </div>
          <div className="text-sm font-medium text-slate-400">
            Secure Unified Portal
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        <CoreIdeologyCanvas />
        <PortalGateway />
        <DistributionHub />
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-900 bg-slate-950 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} Amrita Vishwa Vidyapeetham Chennai Campus. All rights reserved.</p>
        <p className="mt-2">CIRA Adaptive Assessment Engine & Telemetry Infrastructure.</p>
      </footer>
    </div>
  );
}
