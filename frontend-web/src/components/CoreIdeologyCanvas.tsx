
import { motion } from 'framer-motion';
import { BrainCircuit, ShieldCheck, TrendingUp } from 'lucide-react';

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
    <section className="relative py-24 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/20 rounded-full blur-3xl pointer-events-none" />
      
      <motion.div 
        className="max-w-7xl mx-auto px-6 relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            Transforming Placement with <span className="text-gradient">Algorithmic Precision</span>
          </h1>
          <p className="text-xl text-slate-400 leading-relaxed">
            The CIRA framework revolutionizes university readiness metrics via secure evaluations, deep algorithmic monitoring, and automated NLP-driven remediation loops.
          </p>
        </motion.div>

        <motion.div variants={containerVariants} className="grid md:grid-cols-3 gap-8">
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
      </motion.div>
    </section>
  );
}
