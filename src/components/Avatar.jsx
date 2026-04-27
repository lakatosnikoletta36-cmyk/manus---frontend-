// Avatar - 3D holographic humanoid built with React.createElement to bypass
// the visual-edits babel plugin's JSX attribute injection (which crashes R3F).
// Maps the AI's mood vector to direct emotional expression:
//   anger        → violent vibration + deep red pulsing core
//   sadness      → downward slump + dim blue aura
//   joy          → fast rotation + golden/yellow core
//   embarrassment → pink/blush center glow (overlaid)
//   energy       → drifting motion intensity
import React from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

const e = React.createElement;

const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

function dominantColor(mood) {
  // base = cool cyan
  let r = 0.0, g = 0.94, b = 1.0;
  const anger = mood.anger ?? 0;
  const sadness = mood.sadness ?? 0;
  const joy = mood.joy ?? 0.5;
  const stress = mood.stress ?? 0;

  // Sadness → desaturated deep blue
  if (sadness > 0.3) {
    const w = (sadness - 0.3) / 0.7;
    r = lerp(r, 0.08, w);
    g = lerp(g, 0.25, w);
    b = lerp(b, 0.75, w);
  }
  // Stress → magenta tint
  if (stress > 0.5) {
    const w = (stress - 0.5) / 0.5;
    r = lerp(r, 0.6, w * 0.6);
    g = lerp(g, 0.2, w * 0.6);
    b = lerp(b, 0.7, w * 0.6);
  }
  // Joy (high) → warm gold/yellow
  if (joy > 0.65) {
    const w = (joy - 0.65) / 0.35;
    r = lerp(r, 1.0, w);
    g = lerp(g, 0.85, w);
    b = lerp(b, 0.15, w);
  }
  // Anger overrides everything → deep red
  if (anger > 0.4) {
    const w = (anger - 0.4) / 0.6;
    r = lerp(r, 0.95, w);
    g = lerp(g, 0.05, w);
    b = lerp(b, 0.1, w);
  }
  return [r, g, b];
}

function Head({ mood, posture, speaking }) {
  const groupRef = React.useRef();
  const driftRef = React.useRef();
  const coreRef = React.useRef();
  const coreMatRef = React.useRef();
  const blushRef = React.useRef();
  const blushMatRef = React.useRef();
  const ring1Ref = React.useRef();
  const ring2Ref = React.useRef();
  const shellMatRef = React.useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!groupRef.current || !driftRef.current) return;

    const joy = mood?.joy ?? 0.5;
    const stress = mood?.stress ?? 0.2;
    const curiosity = mood?.curiosity ?? 0.5;
    const calm = mood?.calm ?? 0.5;
    const anger = mood?.anger ?? 0;
    const sadness = mood?.sadness ?? 0;
    const embarrass = mood?.embarrassment ?? 0;
    // Energy = high arousal emotions
    const energy = Math.max(0, Math.min(1, joy * 0.4 + curiosity * 0.3 + stress * 0.4 + anger * 0.7 - calm * 0.3 - sadness * 0.4));

    // ---- Posture-driven base tilt ----
    let tiltX = 0, tiltY = 0, baseY = 0;
    if (posture === 'leaning') tiltX = 0.18;
    else if (posture === 'thinking') { tiltX = -0.12; tiltY = 0.22; }
    else if (posture === 'attentive') tiltX = -0.06;
    else if (posture === 'slumped') { tiltX = 0.35; baseY = -0.4; }
    else if (posture === 'excited') tiltX = -0.18;
    else if (posture === 'defensive') { tiltX = -0.05; tiltY = -0.15; }

    // Sadness slump overrides Y
    if (sadness > 0.4) {
      tiltX += sadness * 0.4;
      baseY -= sadness * 0.35;
    }

    // ---- Anger violent vibration ----
    let vibX = 0, vibY = 0, vibZ = 0;
    if (anger > 0.35) {
      const intensity = (anger - 0.35) / 0.65; // 0..1
      const f = 35 + intensity * 25;
      vibX = (Math.sin(t * f * 1.7) + Math.sin(t * f * 2.3)) * 0.04 * intensity;
      vibY = (Math.cos(t * f * 1.9) + Math.sin(t * f * 2.1)) * 0.04 * intensity;
      vibZ = Math.sin(t * f * 2.7) * 0.03 * intensity;
    }

    // ---- Drift motion based on energy ----
    const drift = 0.15 + energy * 0.4;
    driftRef.current.position.x = Math.sin(t * (0.4 + energy * 0.6)) * drift;
    driftRef.current.position.y = baseY + Math.sin(t * (0.3 + energy * 0.5) + 1) * drift * 0.6;
    driftRef.current.position.z = Math.sin(t * 0.25) * 0.15;

    // ---- Rotation: joy = fast, sadness = slow, anger = jerky, default = gentle ----
    let rotSpeed = 0.25 + curiosity * 0.4;
    if (joy > 0.7) rotSpeed += (joy - 0.7) * 4.0; // fast spin when joyful
    if (sadness > 0.5) rotSpeed *= (1 - sadness * 0.7); // slow when sad
    if (anger > 0.5) rotSpeed += Math.sin(t * 25) * 0.6 * anger; // jerky

    groupRef.current.rotation.y = tiltY + Math.sin(t * rotSpeed) * 0.18 + vibY;
    groupRef.current.rotation.x = tiltX + Math.sin(t * 0.4) * 0.04 + vibX;
    groupRef.current.rotation.z = vibZ;
    groupRef.current.position.x = vibX;
    groupRef.current.position.y = vibY;

    // ---- Core breathing + speak pulse + emotion pulse ----
    const breath = 1 + Math.sin(t * 1.1) * 0.025;
    const speak = speaking ? 1 + Math.abs(Math.sin(t * 13)) * 0.05 : 1;
    const angerPulse = anger > 0.4 ? 1 + Math.sin(t * (12 + anger * 8)) * 0.07 * anger : 1;
    const sadShrink = 1 - sadness * 0.08;
    groupRef.current.scale.setScalar(breath * speak * angerPulse * sadShrink);

    // ---- Color the core based on dominant emotion ----
    if (coreMatRef.current) {
      const [r, g, b] = dominantColor(mood);
      coreMatRef.current.color.setRGB(r, g, b);
      coreMatRef.current.emissive.setRGB(r * 0.55, g * 0.55, b * 0.55);
      // Anger pulses emissive intensity hard
      let intensity = 0.6 + joy * 0.5 + (1 - calm) * 0.2;
      if (anger > 0.4) intensity += Math.abs(Math.sin(t * 14)) * anger * 1.2;
      if (sadness > 0.5) intensity *= 0.45;
      coreMatRef.current.emissiveIntensity = intensity;
    }
    if (coreRef.current) {
      const pulseFreq = 1.5 + curiosity * 1.5 + anger * 4;
      const pulse = 1 + Math.sin(t * pulseFreq) * (0.04 + anger * 0.08);
      coreRef.current.scale.setScalar(pulse);
    }

    // ---- Blush (embarrassment) — pink center glow ----
    if (blushRef.current && blushMatRef.current) {
      const visible = embarrass > 0.15;
      blushRef.current.visible = visible;
      if (visible) {
        const flicker = 0.7 + Math.sin(t * 2.5) * 0.3;
        blushMatRef.current.opacity = embarrass * 0.9 * flicker;
        blushMatRef.current.emissiveIntensity = 1.2 + embarrass * 1.5 + Math.sin(t * 3) * 0.2;
        blushRef.current.scale.setScalar(0.6 + embarrass * 0.5);
      }
    }

    // ---- Wireframe shell color shifts subtly ----
    if (shellMatRef.current) {
      const [r, g, b] = dominantColor(mood);
      shellMatRef.current.color.setRGB(
        lerp(0, r, 0.6),
        lerp(0.94, g, 0.6),
        lerp(1.0, b, 0.6),
      );
    }

    // ---- Halo rings: speed scales with energy / anger ----
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * (0.4 + energy * 0.8 + anger * 1.5);
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * (0.25 + energy * 0.5);
  });

  // Outer holographic shell (transparent, wireframe lattice)
  const shell = e(
    'mesh', { key: 'shell' },
    e('sphereGeometry', { args: [1.45, 32, 32] }),
    e('meshBasicMaterial', { ref: shellMatRef, color: '#00F0FF', wireframe: true, transparent: true, opacity: 0.18 })
  );
  // Soft glass sphere
  const glass = e(
    'mesh', { key: 'glass' },
    e('sphereGeometry', { args: [1.4, 48, 48] }),
    e('meshStandardMaterial', {
      color: '#00F0FF', transparent: true, opacity: 0.06, roughness: 0.2, metalness: 0.4
    })
  );
  // Inner reactive core
  const core = e(
    'mesh', { key: 'core', ref: coreRef },
    e('sphereGeometry', { args: [0.9, 48, 48] }),
    e('meshStandardMaterial', {
      ref: coreMatRef,
      color: '#00F0FF',
      emissive: '#0066AA',
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.7,
    })
  );
  // Pink blush center glow (visible only when embarrassed)
  const blush = e(
    'mesh', { key: 'blush', ref: blushRef, position: [0, 0, 0.55], visible: false },
    e('sphereGeometry', { args: [0.4, 32, 32] }),
    e('meshStandardMaterial', {
      ref: blushMatRef,
      color: '#FF6FA8',
      emissive: '#FF1F66',
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    })
  );
  // Eye points
  const eyeL = e(
    'mesh', { key: 'eyeL', position: [-0.32, 0.18, 0.85] },
    e('sphereGeometry', { args: [0.07, 16, 16] }),
    e('meshBasicMaterial', { color: '#FFFFFF' })
  );
  const eyeR = e(
    'mesh', { key: 'eyeR', position: [0.32, 0.18, 0.85] },
    e('sphereGeometry', { args: [0.07, 16, 16] }),
    e('meshBasicMaterial', { color: '#FFFFFF' })
  );
  // Halo rings
  const ring1 = e(
    'mesh', { key: 'ring1', ref: ring1Ref, rotation: [Math.PI / 2.2, 0, 0] },
    e('torusGeometry', { args: [1.7, 0.012, 8, 96] }),
    e('meshBasicMaterial', { color: '#00F0FF', transparent: true, opacity: 0.5 })
  );
  const ring2 = e(
    'mesh', { key: 'ring2', ref: ring2Ref, rotation: [Math.PI / 1.8, 0.4, 0] },
    e('torusGeometry', { args: [1.85, 0.006, 6, 96] }),
    e('meshBasicMaterial', { color: '#A855F7', transparent: true, opacity: 0.35 })
  );

  return e('group', { ref: driftRef },
    e('group', { ref: groupRef }, shell, glass, core, blush, eyeL, eyeR, ring1, ring2)
  );
}

function ParticleAura({ mood }) {
  const ref = React.useRef();
  const matRef = React.useRef();
  const count = 600;
  const positions = React.useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.2 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const calm = mood?.calm ?? 0.5;
    const anger = mood?.anger ?? 0;
    const sadness = mood?.sadness ?? 0;
    ref.current.rotation.y = t * (0.05 + (1 - calm) * 0.18 + anger * 0.5);
    ref.current.rotation.x = Math.sin(t * 0.2) * 0.1;
    if (matRef.current) {
      const [r, g, b] = dominantColor(mood);
      matRef.current.color.setRGB(r, g, b);
      matRef.current.opacity = sadness > 0.5 ? 0.25 : 0.7; // dim aura when sad
    }
  });

  return e(
    'points', { ref },
    e('bufferGeometry', null,
      e('bufferAttribute', {
        attach: 'attributes-position',
        args: [positions, 3],
        count: positions.length / 3,
        itemSize: 3,
        array: positions,
      })
    ),
    e('pointsMaterial', {
      ref: matRef,
      color: '#00F0FF',
      size: 0.022,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })
  );
}

function Scene({ mood, posture, speaking }) {
  return e(React.Fragment, null,
    e('ambientLight', { intensity: 0.4 }),
    e('pointLight', { position: [4, 4, 4], intensity: 1.6, color: '#00F0FF' }),
    e('pointLight', { position: [-4, -2, 2], intensity: 0.8, color: '#A855F7' }),
    e(Head, { mood, posture, speaking }),
    e(ParticleAura, { mood })
  );
}

export default function Avatar({ mood, posture = 'idle', speaking = false }) {
  return e(Canvas, {
    dpr: [1, 1.5],
    camera: { position: [0, 0, 4.6], fov: 45 },
    gl: { antialias: true, alpha: true },
    style: { background: 'transparent', width: '100%', height: '100%' },
  }, e(Scene, { mood, posture, speaking }));
}
