import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
  oz: number;
  size: number;
  color: string;
  isBright?: boolean;
}

export default function GlobeAnimation() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 700);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 800);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Generate globe particles
    const particles: Particle[] = [];
    const numParticles = 650;
    const radius = Math.min(width, height) * 0.36;

    for (let i = 0; i < numParticles; i++) {
      const phi = Math.acos(-1 + (2 * i) / numParticles);
      const theta = Math.sqrt(numParticles * Math.PI) * phi;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const isBright = Math.random() < 0.14;

      particles.push({
        x,
        y,
        z,
        ox: x,
        oy: y,
        oz: z,
        size: isBright ? Math.random() * 2.4 + 1.6 : Math.random() * 1.3 + 0.7,
        color: isBright 
          ? '#E8D6B8' // CIRA Gold/Tan
          : (Math.random() > 0.4 ? '#C82A56' : 'rgba(245, 227, 210, 0.6)'), // CIRA Maroon & Soft Peach
        isBright,
      });
    }

    let rotX = 0;
    let rotY = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - width / 2;
      const y = e.clientY - rect.top - height / 2;
      targetMouseX = (x / width) * 0.4;
      targetMouseY = (y / height) * 0.4;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse interpolation
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      rotY += 0.003 + mouseX * 0.01;
      rotX += 0.001 + mouseY * 0.01;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const projectedParticles: { x: number; y: number; z: number; size: number; color: string; isBright?: boolean }[] = [];
      const cx = width / 2;
      const cy = height / 2;
      const fov = 450;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Rotate Y
        let x1 = p.ox * cosY - p.oz * sinY;
        let z1 = p.oz * cosY + p.ox * sinY;

        // Rotate X
        let y1 = p.oy * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.oy * sinX;

        // Perspective projection
        const scale = fov / (fov + z2 + radius);
        const px = x1 * scale + cx;
        const py = y1 * scale + cy;

        projectedParticles.push({
          x: px,
          y: py,
          z: z2,
          size: p.size * scale,
          color: p.color,
          isBright: p.isBright,
        });
      }

      // Draw atmosphere maroon glow
      const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.35);
      glowGrad.addColorStop(0, 'rgba(155, 34, 66, 0.15)');
      glowGrad.addColorStop(0.5, 'rgba(232, 214, 184, 0.04)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Connect nearby nodes with constellation lines
      const maxDistance = 65;
      for (let i = 0; i < projectedParticles.length; i++) {
        const p1 = projectedParticles[i];
        if (p1.z < -radius * 0.3) continue;

        for (let j = i + 1; j < projectedParticles.length; j += 4) {
          const p2 = projectedParticles[j];
          if (p2.z < -radius * 0.3) continue;

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * 0.25 * Math.max(0, (p1.z + radius) / (2 * radius));
            ctx.strokeStyle = p1.isBright || p2.isBright ? `rgba(232, 214, 184, ${alpha})` : `rgba(200, 42, 86, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Sort particles by depth
      projectedParticles.sort((a, b) => a.z - b.z);

      // Render dots
      for (let i = 0; i < projectedParticles.length; i++) {
        const p = projectedParticles[i];
        const alpha = Math.max(0.1, (p.z + radius * 1.2) / (2.4 * radius));

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;

        if (p.isBright) {
          // Glow halo around bright node
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(232, 214, 184, 0.28)';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
