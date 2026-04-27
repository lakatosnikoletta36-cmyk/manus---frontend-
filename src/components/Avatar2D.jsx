// 2D SVG humanoid silhouette — fallback when WebGL/R3F fails.
// Mirrors the 3D emotion → expression mapping.
import React from 'react';

function dominantColor(mood) {
  let r = 0, g = 240, b = 255;
  const anger = mood.anger ?? 0;
  const sadness = mood.sadness ?? 0;
  const joy = mood.joy ?? 0.5;
  if (sadness > 0.3) {
    const w = (sadness - 0.3) / 0.7;
    r = Math.round(20 * w + r * (1 - w));
    g = Math.round(60 * w + g * (1 - w));
    b = Math.round(190 * w + b * (1 - w));
  }
  if (joy > 0.65) {
    const w = (joy - 0.65) / 0.35;
    r = Math.round(255 * w + r * (1 - w));
    g = Math.round(220 * w + g * (1 - w));
    b = Math.round(40 * w + b * (1 - w));
  }
  if (anger > 0.4) {
    const w = (anger - 0.4) / 0.6;
    r = Math.round(240 * w + r * (1 - w));
    g = Math.round(15 * w + g * (1 - w));
    b = Math.round(25 * w + b * (1 - w));
  }
  return [r, g, b];
}

export default function Avatar2D({ mood = {}, posture = 'idle', speaking = false }) {
  const joy = mood.joy ?? 0.5;
  const stress = mood.stress ?? 0.2;
  const curiosity = mood.curiosity ?? 0.5;
  const sadness = mood.sadness ?? 0;
  const anger = mood.anger ?? 0;
  const embarrass = mood.embarrassment ?? 0;
  const [r, g, b] = dominantColor(mood);
  const stroke = `rgb(${r},${g},${b})`;

  const tilt = (posture === 'leaning' ? 8 : posture === 'thinking' ? -6 : posture === 'slumped' ? 14 : 0) + sadness * 12;
  const breathScale = 1 + Math.sin(Date.now() / 800) * 0.012;
  const shake = anger > 0.4 ? `translate(${(Math.random() - 0.5) * 6 * anger}px, ${(Math.random() - 0.5) * 6 * anger}px)` : '';
  const slumpY = sadness * 18;

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <div className="absolute inset-0" style={{
        background: `radial-gradient(circle at 50% 45%, rgba(${r},${g},${b},${0.18 - sadness * 0.1}), transparent 60%)`,
        opacity: sadness > 0.5 ? 0.5 : 1,
      }} />
      <svg
        viewBox="0 0 400 500"
        className="w-full h-full max-w-[520px]"
        style={{
          filter: `drop-shadow(0 0 ${24 + anger * 30}px rgba(${r},${g},${b},${0.55 + anger * 0.4}))`,
          transform: `${shake} translateY(${slumpY}px) rotate(${tilt * 0.2}deg) scale(${breathScale})`,
          transition: anger > 0.4 ? 'none' : 'transform 0.6s ease',
        }}
      >
        <defs>
          <radialGradient id="head-grad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.9" />
            <stop offset="60%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blush-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF1F66" stopOpacity={Math.min(0.85, embarrass)} />
            <stop offset="100%" stopColor="#FF6FA8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="160" r="120" fill="none" stroke={stroke} strokeOpacity="0.18" strokeDasharray="3 6" />
        <circle cx="200" cy="160" r="140" fill="none" stroke={stroke} strokeOpacity="0.10" strokeDasharray="2 10" />
        <ellipse cx="200" cy="160" rx="68" ry="80" fill="url(#head-grad)" stroke={stroke} strokeOpacity="0.6" strokeWidth="1.2" />
        {embarrass > 0.15 && (
          <ellipse cx="200" cy="170" rx="55" ry="35" fill="url(#blush-grad)" />
        )}
        <ellipse cx="178" cy="155" rx="6" ry={speaking ? 4 : 6} fill="#fff" />
        <ellipse cx="222" cy="155" rx="6" ry={speaking ? 4 : 6} fill="#fff" />
        <path
          d={
            anger > 0.5
              ? `M 178 200 L 222 192`
              : sadness > 0.5
              ? `M 178 200 Q 200 ${200 - sadness * 12} 222 200`
              : joy > 0.6
              ? `M 178 195 Q 200 ${195 + joy * 18} 222 195`
              : `M 178 195 Q 200 ${198 + (joy - 0.3) * 8} 222 195`
          }
          fill="none" stroke={stroke} strokeOpacity="0.85" strokeWidth="1.5" strokeLinecap="round"
        />
        <path d="M 185 235 L 185 260 L 215 260 L 215 235" fill="url(#head-grad)" stroke={stroke} strokeOpacity="0.4" />
        <path d="M 130 260 Q 200 270 270 260 L 280 420 Q 200 440 120 420 Z" fill="url(#head-grad)" stroke={stroke} strokeOpacity="0.5" strokeWidth="1.2" />
        <line x1="160" y1="290" x2="240" y2="290" stroke={stroke} strokeOpacity="0.3" strokeDasharray="2 4" />
        <line x1="170" y1="320" x2="230" y2="320" stroke={stroke} strokeOpacity="0.25" strokeDasharray="2 4" />
        <circle cx="200" cy="350" r={6 + curiosity * 4} fill={stroke} fillOpacity="0.6" />
        <line x1="130" y1="270" x2={posture === 'leaning' ? 110 : 100} y2="380" stroke={stroke} strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
        <line x1="270" y1="270" x2={posture === 'leaning' ? 290 : 300} y2="380" stroke={stroke} strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
