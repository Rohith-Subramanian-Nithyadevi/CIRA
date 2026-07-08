import CoreIdeologyCanvas from '../components/CoreIdeologyCanvas';
import DistributionHub from '../components/DistributionHub';
import TargetCursor from '../components/ui/TargetCursor';
import { ShieldCheck, Activity, Cpu, Award } from 'lucide-react';

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

        {/* Bento Grid Features Section */}
        <section id="how-it-helps" className="py-20 border-t border-border-soft scroll-mt-16 bg-[#FDFBF7]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl font-serif font-bold text-ink mb-4">How CIRA Drives Excellence</h2>
              <p className="text-gray-body text-base">A multidimensional accelerator framework tailored for student progress, secure testing environments, and comprehensive industry readiness mapping.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Secure Evaluations (Col Span 2) */}
              <div className="md:col-span-2 bg-white border border-border-soft rounded-2xl p-8 shadow-sm flex flex-col justify-between hover:border-maroon/30 hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-maroon/5 rounded-full blur-3xl group-hover:bg-maroon/10 transition-all"></div>
                <div>
                  <div className="w-12 h-12 rounded-xl bg-maroon/10 flex items-center justify-center mb-6 border border-maroon/20">
                    <ShieldCheck className="w-6 h-6 text-maroon" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-ink mb-3">Secure Evaluations</h3>
                  <p className="text-gray-body text-sm leading-relaxed max-w-xl">
                    Integrity is key to learning. CIRA features a built-in lockdown examination portal that prevents screen sharing, unauthorized tabs, external displays, and keyboard shortcuts. Students write exams in a fully proctored environment, ensuring fair assessment metrics.
                  </p>
                </div>
                <div className="mt-8 flex items-center text-xs font-bold text-maroon uppercase tracking-wider gap-1.5">
                  Proctoring lockdown active <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
                </div>
              </div>

              {/* Card 2: Deep Monitoring (Col Span 1) */}
              <div className="bg-white border border-border-soft rounded-2xl p-8 shadow-sm flex flex-col justify-between hover:border-maroon/30 hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-maroon/5 rounded-full blur-2xl group-hover:bg-maroon/10 transition-all"></div>
                <div>
                  <div className="w-12 h-12 rounded-xl bg-maroon/10 flex items-center justify-center mb-6 border border-maroon/20">
                    <Activity className="w-6 h-6 text-maroon" />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-ink mb-3">Deep Monitoring</h3>
                  <p className="text-gray-body text-sm leading-relaxed">
                    Track academic trajectories across years, departments, and sections. Real-time class analytics dashboard reports score distributions and subject readiness instantly.
                  </p>
                </div>
                <div className="mt-8 text-xs font-semibold text-gray-body/65">
                  Analytical visualizations & metrics
                </div>
              </div>

              {/* Card 3: NLP Remediation (Col Span 1) */}
              <div className="bg-white border border-border-soft rounded-2xl p-8 shadow-sm flex flex-col justify-between hover:border-maroon/30 hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-maroon/5 rounded-full blur-2xl group-hover:bg-maroon/10 transition-all"></div>
                <div>
                  <div className="w-12 h-12 rounded-xl bg-maroon/10 flex items-center justify-center mb-6 border border-maroon/20">
                    <Cpu className="w-6 h-6 text-maroon" />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-ink mb-3">NLP Remediation</h3>
                  <p className="text-gray-body text-sm leading-relaxed">
                    Identify knowledge gaps dynamically. Natural Language Processing automatically reads evaluation feedback to generate tailored remediation assignments focused on student weaknesses.
                  </p>
                </div>
                <div className="mt-8 text-xs font-semibold text-gray-body/65">
                  Algorithmically mapped homework
                </div>
              </div>

              {/* Card 4: Industry Readiness (Col Span 2) */}
              <div className="md:col-span-2 bg-white border border-border-soft rounded-2xl p-8 shadow-sm flex flex-col justify-between hover:border-maroon/30 hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-maroon/5 rounded-full blur-3xl group-hover:bg-maroon/10 transition-all"></div>
                <div>
                  <div className="w-12 h-12 rounded-xl bg-maroon/10 flex items-center justify-center mb-6 border border-maroon/20">
                    <Award className="w-6 h-6 text-maroon" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-ink mb-3">Industry Readiness</h3>
                  <p className="text-gray-body text-sm leading-relaxed max-w-xl">
                    Bridge the classroom-to-career gap. Accelerate aptitude skill acquisition, soft skills communication, and verbal reasoning to align with top tier recruitment and technical screening assessments.
                  </p>
                </div>
                <div className="mt-8 flex items-center text-xs font-bold text-maroon uppercase tracking-wider">
                  Technical & corporate mapping syllabus
                </div>
              </div>
            </div>
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
