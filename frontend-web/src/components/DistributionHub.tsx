import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import DotField from './ui/DotField';

export default function DistributionHub() {
  return (
    <section id="download-client" className="py-24 bg-cream border-t border-border-soft relative overflow-hidden">
      {/* Background DotField */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <DotField
          dotRadius={1.5}
          dotSpacing={14}
          bulgeStrength={32}
          glowRadius={140}
          sparkle={false}
          waveAmplitude={0}
          cursorRadius={400}
          cursorForce={0.1}
          bulgeOnly
          gradientFrom="#9B2242"
          gradientTo="#8A1E3A"
          glowColor="rgba(245, 227, 210, 0.4)"
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl font-bold mb-4 text-ink">Working On Anti-Plagiarism (Ongoing)</h2>
          <p className="text-gray-body max-w-2xl mx-auto font-sans leading-relaxed">
            Download the isolated desktop application required to participate in secure evaluations. The client features environment lockdown and real-time telemetry.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Windows Installer */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="bg-white p-8 rounded-xl border border-border-soft shadow-[0_20px_40px_rgba(0,0,0,0.06)] flex flex-col items-center text-center"
          >
            <div className="w-14 h-14 rounded-lg bg-chip-peach text-maroon flex items-center justify-center mb-6">
              <svg viewBox="0 0 88 88" className="w-7 h-7" fill="currentColor">
                <path d="M0,12.402l35.687-4.86l0.016,34.423l-35.67,0.23L0,12.402z M39.387,6.591L87.892,0v41.282L39.387,41.67L39.387,6.591z M39.367,45.474l48.525,0.485V87.67l-48.525-6.845V45.474z M0,45.626l35.67,0.306v33.407L0,74.757V45.626z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-ink mb-2 font-sans">Windows Deployment</h3>
            <p className="text-gray-body mb-8 text-sm font-sans leading-relaxed">
              Compatible with Windows 10 & 11 (64-bit). Includes runtime protections and secure boot checks.
            </p>
            <a 
              href="https://github.com/Rohith-Subramanian-Nithyadevi/CIRA/releases/download/v1.0.0/CIRA.Desktop.Client.Setup.1.0.0.exe" 
              className="mt-auto flex items-center justify-center w-full py-3 px-6 rounded-full bg-maroon hover:bg-maroon-deep text-white font-medium group transition-all text-sm font-semibold shadow-sm hover:scale-105 active:scale-95"
            >
              <Download className="w-4 h-4 mr-2 group-hover:-translate-y-0.5 transition-transform" />
              Download .exe
            </a>
          </motion.div>

          {/* macOS Installer */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="bg-white p-8 rounded-xl border border-border-soft shadow-[0_20px_40px_rgba(0,0,0,0.06)] flex flex-col items-center text-center"
          >
            <div className="w-14 h-14 rounded-lg bg-chip-peach text-maroon flex items-center justify-center mb-6">
              <svg viewBox="0 0 384 512" className="w-6 h-6" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-ink mb-2 font-sans">macOS Deployment</h3>
            <p className="text-gray-body mb-8 text-sm font-sans leading-relaxed">
              Universal binary for Apple Silicon (M1/M2/M3) and Intel. Requires macOS 12 Monterey or newer.
            </p>
            <a 
              href="https://github.com/Rohith-Subramanian-Nithyadevi/CIRA-Secure-Client.dmg" 
              className="mt-auto flex items-center justify-center w-full py-3 px-6 rounded-full bg-maroon hover:bg-maroon-deep text-white font-medium group transition-all text-sm font-semibold shadow-sm hover:scale-105 active:scale-95"
            >
              <Download className="w-4 h-4 mr-2 group-hover:-translate-y-0.5 transition-transform" />
              Download .dmg
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
