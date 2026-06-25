
import { motion } from 'framer-motion';
import { LogIn, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PortalGateway() {
  const navigate = useNavigate();

  return (
    <section className="py-20 relative z-10">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div 
          className="glass-card p-12 relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10">
            <LogIn className="w-12 h-12 mx-auto text-blue-400 mb-6" />
            <h2 className="text-3xl font-bold mb-4 text-white">Unified Portal Access</h2>
            <p className="text-slate-400 mb-10 max-w-2xl mx-auto text-lg">
              Centralized authentication gateway for Administrative Operators, Faculty Evaluators, and Enrolled Students. Secure your session to proceed.
            </p>
            
            <motion.button
              onClick={() => navigate('/login')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-blue-600 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 hover:bg-blue-500"
            >
              <span className="mr-2">Enter Secure Portal</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
