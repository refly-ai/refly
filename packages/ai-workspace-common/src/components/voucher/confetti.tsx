import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
}

const COLORS = ['#1BC09F', '#0E9F77', '#00D4AA', '#4ECDC4', '#2ECC71'];

function StarSVG({ size, color, rotation }: { size: number; color: string; rotation: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 23 23"
      fill="none"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d="M14.5507 0.0404677C15.0467 0.173367 15.4006 0.610628 15.4272 1.1234C15.6827 6.05383 18.2867 10.5642 22.4289 13.2506C22.8596 13.5301 23.0614 14.0552 22.9285 14.5512C22.7956 15.0472 22.3583 15.4011 21.8455 15.4277C16.9151 15.6832 12.4048 18.2872 9.7183 22.4294C9.43883 22.8601 8.91372 23.0619 8.41774 22.929C7.92175 22.7961 7.56786 22.3588 7.54121 21.846C7.28574 16.9156 4.68169 12.4053 0.539557 9.7188C0.108803 9.43933 -0.0929299 8.91422 0.039969 8.41824C0.172868 7.92225 0.610129 7.56836 1.12291 7.54171C6.05333 7.28624 10.5637 4.68219 13.2501 0.540056L13.3661 0.389046C13.6606 0.0639002 14.1168 -0.0757824 14.5507 0.0404677Z"
        fill={color}
      />
    </svg>
  );
}

export function Confetti({ isActive = true }: { isActive?: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!isActive) {
      setParticles([]);
      return;
    }

    // Create initial particles
    const initialParticles: Particle[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      size: 10 + Math.random() * 14,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      speedX: (Math.random() - 0.5) * 2,
      speedY: 1.5 + Math.random() * 2,
      opacity: 0.7 + Math.random() * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    setParticles(initialParticles);

    // Animation loop
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.speedX,
            y: p.y + p.speedY,
            rotation: p.rotation + p.rotationSpeed,
            speedY: p.speedY + 0.05, // Gravity acceleration
            opacity: p.y > 80 ? p.opacity - 0.02 : p.opacity,
          }))
          .filter((p) => p.opacity > 0 && p.y < 120),
      );
    }, 30);

    // Stop generating after 3 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isActive]);

  if (!isActive || particles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            opacity: particle.opacity,
            transition: 'none',
          }}
        >
          <StarSVG size={particle.size} color={particle.color} rotation={particle.rotation} />
        </div>
      ))}
    </div>
  );
}

export default Confetti;
