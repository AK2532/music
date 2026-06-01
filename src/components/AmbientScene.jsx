import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { audioMetrics } from '../hooks/useAudioEngine';
import { useTheme } from '../services/ThemeContext';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uBass;
  uniform vec3 uColor1; // Pitch Black
  uniform vec3 uColor2; // Deep Charcoal
  uniform vec3 uColor3; // Subtle Obsidian
  uniform vec3 uColor4; // Midnight Noir
  
  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ) );
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv;
    
    float t = uTime * 0.05;
    float audioSwell = uBass * 0.15;
    
    float n1 = snoise(uv * 1.5 + vec2(t, t * 0.4));
    float n2 = snoise(uv * 2.0 - vec2(t * 0.2, t * 0.6));
    float n3 = snoise(uv * 0.8 + vec2(-t * 0.5, t * 0.3));
    
    float fluid = (n1 + n2 + n3) / 3.0;
    
    vec3 color = mix(uColor1, uColor2, smoothstep(-1.0, 0.0, fluid));
    color = mix(color, uColor3, smoothstep(0.0, 0.6, fluid + audioSwell));
    color = mix(color, uColor4, smoothstep(0.4, 1.0, fluid + audioSwell * 1.5));

    // Subtle elegant grain to prevent banding on pure blacks
    float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
    color += grain * 0.015;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function DarkGlassPaint() {
  const materialRef = useRef();
  const { theme, themes, activePalette } = useTheme();
  const currentPalette = activePalette || themes[theme] || themes.black;

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBass: { value: 0 },
    uColor1: { value: new THREE.Color(currentPalette.bg || '#000000') },
    uColor2: { value: new THREE.Color(currentPalette.surface || '#0a0a0a') },
    uColor3: { value: new THREE.Color(currentPalette.surface || '#141414') },
    uColor4: { value: new THREE.Color(currentPalette.bg || '#050505') }
  }), []);

  useEffect(() => {
    if (materialRef.current) {
      // Lighten the surface color slightly for fluid contrast
      const baseSurface = new THREE.Color(currentPalette.surface || '#0a0a0a');
      const lighterSurface = baseSurface.clone().lerp(new THREE.Color('#ffffff'), 0.05);

      materialRef.current.uniforms.uColor1.value.set(currentPalette.bg || '#000000');
      materialRef.current.uniforms.uColor2.value.set(currentPalette.surface || '#0a0a0a');
      materialRef.current.uniforms.uColor3.value.set(lighterSurface);
      materialRef.current.uniforms.uColor4.value.set(currentPalette.bg || '#050505');
    }
  }, [currentPalette]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      materialRef.current.uniforms.uBass.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uBass.value,
        audioMetrics.bass || 0,
        0.05
      );
    }
  });

  return (
    <mesh position={[0, 0, -10]} scale={[30, 20, 1]}>
      <planeGeometry args={[1, 1, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}

export const AmbientScene = () => {
  const [dpr, setDpr] = useState(1.5);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      pointerEvents: 'none',
      background: 'transparent'
    }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={dpr}>
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(2)} />
        <DarkGlassPaint />
      </Canvas>
    </div>
  );
};
