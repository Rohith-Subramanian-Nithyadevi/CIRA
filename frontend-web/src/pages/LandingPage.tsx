
import CoreIdeologyCanvas from '../components/CoreIdeologyCanvas';
import DistributionHub from '../components/DistributionHub';
import FlowingMenu from '../components/ui/FlowingMenu';
import TargetCursor from '../components/ui/TargetCursor';

const flowingMenuItems = [
  { link: '#how-it-helps', text: 'Secure Evaluations', image: 'https://picsum.photos/600/400?random=10' },
  { link: '#how-it-helps', text: 'Deep Monitoring', image: 'https://picsum.photos/600/400?random=11' },
  { link: '#how-it-helps', text: 'NLP Remediation', image: 'https://picsum.photos/600/400?random=12' },
  { link: '#how-it-helps', text: 'Industry Readiness', image: 'https://picsum.photos/600/400?random=13' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream font-sans text-ink selection:bg-maroon/20">
      <TargetCursor 
        targetSelector="a, button, [role='button'], .cursor-target"
        spinDuration={2}
        hideDefaultCursor
        parallaxOn
        hoverDuration={0.2}
        cursorColor="#ffffff"
        cursorColorOnTarget="#B497CF"
      />
      
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
              Login
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16">
        <CoreIdeologyCanvas />

        {/* Flowing Menu – Hover to reveal marquee details */}
        <section id="how-it-helps" className="border-t border-border-soft scroll-mt-16">
          <div style={{ height: '260px', position: 'relative' }}>
            <FlowingMenu
              items={flowingMenuItems}
              speed={15}
              textColor="var(--ink)"
              bgColor="var(--bg-cream-edge)"
              marqueeBgColor="var(--maroon)"
              marqueeTextColor="var(--bg-cream)"
              borderColor="var(--border-soft)"
            />
          </div>
        </section>

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
            <p className="mt-1">CIRA - CIR Industry Readiness Accelerator</p><br></br>
            <p>© {new Date().getFullYear()} Amrita Vishwa Vidyapeetham Chennai Campus. All rights reserved.</p>
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
