
import { motion } from 'framer-motion';
import { Download, Monitor, Command } from 'lucide-react';

export default function DistributionHub() {
  return (
    <section className="py-20 bg-slate-900/30 border-t border-slate-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4 text-white">Secure Client Distribution Hub</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Download the isolated desktop application required to participate in secure evaluations. The client features environment lockdown and real-time telemetry.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Windows Installer */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="glass-card p-8 flex flex-col items-center text-center"
          >
            <Monitor className="w-16 h-16 text-blue-500 mb-6" />
            <h3 className="text-xl font-bold text-white mb-2">Windows Deployment</h3>
            <p className="text-slate-400 mb-8 text-sm">
              Compatible with Windows 10 & 11 (64-bit). Includes runtime protections and secure boot checks.
            </p>
            <a 
              href="/downloads/CIRA-Secure-Client.exe" 
              download
              className="mt-auto flex items-center justify-center w-full py-3 px-6 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all text-slate-200 font-medium group"
            >
              <Download className="w-4 h-4 mr-2 group-hover:-translate-y-1 transition-transform" />
              Download .exe
            </a>
          </motion.div>

          {/* macOS Installer */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="glass-card p-8 flex flex-col items-center text-center"
          >
            <Command className="w-16 h-16 text-slate-300 mb-6" />
            <h3 className="text-xl font-bold text-white mb-2">macOS Deployment</h3>
            <p className="text-slate-400 mb-8 text-sm">
              Universal binary for Apple Silicon (M1/M2/M3) and Intel. Requires macOS 12 Monterey or newer.
            </p>
            <a 
              href="/downloads/CIRA-Secure-Client.dmg" 
              download
              className="mt-auto flex items-center justify-center w-full py-3 px-6 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all text-slate-200 font-medium group"
            >
              <Download className="w-4 h-4 mr-2 group-hover:-translate-y-1 transition-transform" />
              Download .dmg
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
