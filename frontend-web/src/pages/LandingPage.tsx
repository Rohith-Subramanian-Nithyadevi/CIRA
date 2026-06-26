
import CoreIdeologyCanvas from '../components/CoreIdeologyCanvas';
import PortalGateway from '../components/PortalGateway';
import DistributionHub from '../components/DistributionHub';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-50 selection:bg-blue-500/30">
      {/* Floating Glassmorphic Navigation Bar */}
      <div className="fixed top-0 inset-x-0 z-50 p-4 sm:p-6 pointer-events-none">
        <nav className="pointer-events-auto max-w-5xl mx-auto border border-white/10 bg-slate-900/30 backdrop-blur-xl rounded-2xl h-16 flex items-center justify-between px-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="font-bold text-xl tracking-tighter text-white flex items-center">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 mr-3 flex items-center justify-center text-sm shadow-inner shadow-white/20">C</span>
            CIRA
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
              <a href="#unified-portal" className="hover:text-white transition-colors">Unified Portal</a>
            </div>
            <a href="/login" className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-950 rounded-xl transition-all text-sm font-bold shadow-lg shadow-white/10 hover:scale-105 active:scale-95">
              Sign up
            </a>
          </div>
        </nav>
      </div>

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
