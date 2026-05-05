import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere } from '@react-three/drei';
import * as THREE from 'three';

const AnimatedGradient = () => {
  const meshA = useRef();
  const meshB = useRef();

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (meshA.current) {
      meshA.current.distort = 0.4 + Math.sin(time * 0.5) * 0.1;
      meshA.current.speed = 1.5 + Math.cos(time * 0.3) * 0.5;
    }
    if (meshB.current) {
      meshB.current.distort = 0.5 + Math.cos(time * 0.4) * 0.1;
      meshB.current.speed = 1.2 + Math.sin(time * 0.2) * 0.4;
    }
  });

  return (
    <group>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
        <Sphere args={[1, 64, 64]} position={[-2, 1, -5]}>
          <MeshDistortMaterial
            ref={meshA}
            color="#ff9b54"
            roughness={0.2}
            metalness={0.8}
            distort={0.4}
            speed={2}
            transparent
            opacity={0.15}
          />
        </Sphere>
      </Float>

      <Float speed={1.5} rotationIntensity={0.8} floatIntensity={1.5}>
        <Sphere args={[1.5, 64, 64]} position={[3, -1, -6]}>
          <MeshDistortMaterial
            ref={meshB}
            color="#52d1c6"
            roughness={0.3}
            metalness={0.7}
            distort={0.5}
            speed={1.5}
            transparent
            opacity={0.12}
          />
        </Sphere>
      </Float>

      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} color="#ff9b54" intensity={0.5} />
    </group>
  );
};

export const CanvasBackground = () => {
  return (
    <div className="app-background" style={{ 
      position: 'fixed', 
      inset: 0, 
      zIndex: -1, 
      pointerEvents: 'none',
      background: 'radial-gradient(circle at center, #0a111a 0%, #03060a 100%)'
    }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <AnimatedGradient />
      </Canvas>
    </div>
  );
};
