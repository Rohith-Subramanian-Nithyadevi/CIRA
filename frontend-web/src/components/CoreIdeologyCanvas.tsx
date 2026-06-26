
import { motion } from 'framer-motion';
import { BrainCircuit, ShieldCheck, TrendingUp } from 'lucide-react';
import ColorBends from './ui/ColorBends';

export default function CoreIdeologyCanvas() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  return (
    <section className="relative overflow-hidden min-h-screen">
      <div className="absolute inset-0 z-0 opacity-80 mix-blend-screen">
        <ColorBends
          colors={["#ff5c7a", "#8a5cff", "#00ffd1"]}
          rotation={90}
          speed={0.2}
          scale={1}
          frequency={1}
          warpStrength={1}
          mouseInfluence={1}
          noise={0.15}
          parallax={0.5}
          iterations={1}
          intensity={1.5}
          bandWidth={6}
          transparent={true}
          autoRotate={0}
        />
      </div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div 
          className="flex flex-col justify-center min-h-screen"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="text-center max-w-4xl mx-auto w-full relative z-10">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-8 text-white drop-shadow-2xl">
            Transforming Placement with <br className="hidden sm:block" /><span className="text-gradient drop-shadow-xl">Algorithmic Precision</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-100 leading-loose mb-12 max-w-3xl mx-auto font-medium drop-shadow-lg">
            The CIRA framework revolutionizes university readiness metrics via secure evaluations, deep algorithmic monitoring, and automated NLP-driven remediation loops.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a href="/login" className="px-8 py-3.5 bg-white text-slate-950 hover:bg-slate-200 rounded-xl font-bold text-lg transition-all shadow-xl hover:scale-105 active:scale-95">
              Get Started
            </a>
            <a href="#how-it-helps" className="px-8 py-3.5 bg-slate-900/80 backdrop-blur-md hover:bg-slate-800 border border-slate-700 text-slate-100 rounded-xl font-bold text-lg transition-all shadow-xl hover:border-slate-500">
              How It Helps
            </a>
          </div>
        </motion.div>
        </motion.div>

        <motion.div 
          id="how-it-helps"
          variants={containerVariants} 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid md:grid-cols-3 gap-8 pb-24 mt-12 scroll-mt-24"
        >
          <motion.div variants={itemVariants} className="glass-card p-8 group hover:bg-slate-800/50 transition-colors">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-slate-100">Secure Evaluations</h3>
            <p className="text-slate-400">
              Military-grade encrypted environments ensuring absolute academic integrity during diagnostic assessments.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-card p-8 group hover:bg-slate-800/50 transition-colors">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-7 h-7 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-slate-100">Deep Monitoring</h3>
            <p className="text-slate-400">
              Real-time telemetry tracking and predictive analytics calculating the Industry Readiness Index.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-card p-8 group hover:bg-slate-800/50 transition-colors">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 border border-indigo-500/20 group-hover:scale-110 transition-transform">
              <BrainCircuit className="w-7 h-7 text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-slate-100">NLP Remediation</h3>
            <p className="text-slate-400">
              Semantic algorithms automatically matching student deficiencies to adaptive assignments.
            </p>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
