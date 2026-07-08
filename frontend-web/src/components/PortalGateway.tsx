import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PortalGateway() {
  const navigate = useNavigate();

  return (
    <section id="unified-portal" className="py-24 bg-cream relative z-10 scroll-mt-16">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div 
          className="bg-maroon-deep p-12 md:p-16 rounded-[24px] text-center relative overflow-hidden shadow-lg"
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
              Unified Portal Access
            </h2>
            <p className="text-white/70 font-sans text-base md:text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
              Centralized authentication gateway for Administrative Operators, Faculty Evaluators, and Enrolled Students. Secure your session to proceed.
            </p>
            
            <motion.button
              onClick={() => navigate('/login')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center justify-center px-8 py-3.5 bg-cta-tan hover:bg-[#ebdcb9] text-maroon font-sans font-bold rounded-full transition-all text-base shadow-md group"
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
