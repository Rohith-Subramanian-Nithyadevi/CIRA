
import CoreIdeologyCanvas from '../components/CoreIdeologyCanvas';
import DistributionHub from '../components/DistributionHub';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream font-sans text-ink selection:bg-maroon/20">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/92 backdrop-blur-md border-b border-border-soft h-16 flex items-center shadow-md">
        <div className="max-w-7xl mx-auto w-full px-6 flex items-center justify-between">
          <div className="font-sans font-semibold text-xl tracking-tight text-ink flex items-center">
            <img src="/img/favicon.ico" alt="CIRA Logo" className="w-8 h-8 mr-3 object-contain" />
            CIRA
          </div>
          <div className="flex items-center gap-6">
            <a href="#download-client" className="text-sm font-medium text-gray-body hover:text-maroon transition-colors">Test portal</a>
            <a href="/login" className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white rounded-full transition-all text-sm font-semibold shadow-sm hover:scale-105 active:scale-95">
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16">
        <CoreIdeologyCanvas />
        <DistributionHub />
      </main>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-border-soft">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="font-sans font-semibold text-lg text-ink flex items-center">
            <img src="/img/favicon.ico" alt="CIRA Logo" className="w-6 h-6 mr-2 object-contain" />
            CIRA
          </div>
          <div className="text-center text-xs text-gray-body">
            <p>© {new Date().getFullYear()} Amrita Vishwa Vidyapeetham Chennai Campus. All rights reserved.</p>
            <p className="mt-1">CIRA Adaptive Assessment Engine & Telemetry Infrastructure.</p>
          </div>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-gray-body hover:text-maroon transition-colors">Privacy Policy</a>
            <a href="#" className="text-gray-body hover:text-maroon transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
