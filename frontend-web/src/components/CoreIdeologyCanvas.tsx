import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, ShieldCheck, TrendingUp } from 'lucide-react';
import DotField from './ui/DotField';

export default function CoreIdeologyCanvas() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration || isNaN(video.duration)) return;
    
    const stopTime = Math.max(0, video.duration - 1);
    if (video.currentTime >= stopTime) {
      video.pause();
      video.currentTime = stopTime;
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(err => {
        console.log("Autoplay blocked by browser", err);
      });
    }
  }, []);
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
    <div className="w-full">
      {/* Hero Section */}
      <section 
        className="relative overflow-hidden py-20 md:py-32 border-b border-border-soft"
        style={{ background: 'radial-gradient(circle, var(--bg-cream) 0%, var(--bg-cream-edge) 100%)' }}
      >
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

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div 
            className="grid md:grid-cols-[55fr_45fr] gap-12 md:gap-16 items-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Left Column: Headline and CTAs */}
            <motion.div variants={itemVariants} className="text-left w-full">
              <h1 className="font-serif text-4xl md:text-5xl lg:text-[56px] font-bold text-ink leading-[1.05] tracking-tight mb-6">
                Transforming Placement with <br className="hidden sm:block" />
                <span className="text-maroon">Algorithmic Precision</span>
              </h1>
              <p className="text-base md:text-lg text-gray-body leading-relaxed mb-8 max-w-xl font-sans">
                The CIRA framework revolutionizes university readiness metrics via secure evaluations, deep algorithmic monitoring, and automated NLP-driven remediation loops.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-start gap-4">
                <a href="/login" className="w-full sm:w-auto px-8 py-3.5 bg-maroon hover:bg-maroon-deep text-white text-center rounded-full font-sans font-bold text-base transition-all shadow-md hover:scale-105 active:scale-95">
                  Get Started
                </a>
                <a href="#how-it-helps" className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-cream border border-border-soft text-ink text-center rounded-full font-sans font-bold text-base transition-all shadow-sm hover:scale-105 active:scale-95">
                  How It Helps
                </a>
              </div>
            </motion.div>

            {/* Right Column: Floating Browser Mockup */}
            <motion.div variants={itemVariants} className="w-full flex justify-center">
              <div className="relative w-full max-w-md bg-white rounded-xl border border-border-soft shadow-[0_20px_40px_rgba(0,0,0,0.06)] overflow-hidden">
                {/* Browser Chrome header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-cream border-b border-border-soft">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
                  </div>
                  <div className="h-3 w-24 bg-gray-body/15 rounded ml-2"></div>
                </div>
                {/* Video Content Area */}
                <div className="relative aspect-[16/10] bg-black overflow-hidden select-none">
                  <video
                    ref={videoRef}
                    src="/img/srcv.mp4"
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    onTimeUpdate={handleTimeUpdate}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="how-it-helps" className="bg-cream-edge py-24 md:py-32 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            variants={containerVariants} 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid md:grid-cols-3 gap-8"
          >
            {/* Feature 1 */}
            <motion.div variants={itemVariants} className="bg-white p-8 rounded-xl border border-border-soft shadow-[0_20px_40px_rgba(0,0,0,0.06)] flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-lg bg-chip-peach text-maroon flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-sans text-ink mb-3">Secure Evaluations</h3>
              <p className="text-gray-body text-sm leading-relaxed font-sans">
                Military-grade encrypted environments ensuring absolute academic integrity during diagnostic assessments.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div variants={itemVariants} className="bg-white p-8 rounded-xl border border-border-soft shadow-[0_20px_40px_rgba(0,0,0,0.06)] flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-lg bg-chip-peach text-maroon flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-sans text-ink mb-3">Deep Monitoring</h3>
              <p className="text-gray-body text-sm leading-relaxed font-sans">
                Real-time telemetry tracking and predictive analytics calculating the Industry Readiness Index.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div variants={itemVariants} className="bg-white p-8 rounded-xl border border-border-soft shadow-[0_20px_40px_rgba(0,0,0,0.06)] flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-lg bg-chip-peach text-maroon flex items-center justify-center mb-6">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-sans text-ink mb-3">NLP Remediation</h3>
              <p className="text-gray-body text-sm leading-relaxed font-sans">
                Semantic algorithms automatically matching student deficiencies to adaptive assignments.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
