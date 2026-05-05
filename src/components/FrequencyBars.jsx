import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

function Bars({ analyserRef, dataRef, count = 48 }) {
  const meshRefs = useRef([]);

  useFrame(() => {
    if (!analyserRef.current || !dataRef.current) return;
    analyserRef.current.getByteFrequencyData(dataRef.current);

    meshRefs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const dataIndex = Math.floor((index * dataRef.current.length) / count);
      const value = dataRef.current[dataIndex] / 255;
      const targetHeight = Math.max(0.05, value * 2.8);
      mesh.scale.y += (targetHeight - mesh.scale.y) * 0.16;
      mesh.position.y = mesh.scale.y / 2;
      const hue = 260 + value * 60;
      mesh.material.color.setHSL(hue / 360, 0.82, 0.52 + value * 0.24);
      mesh.material.emissive.setHSL(hue / 360, 0.8, 0.18 * value);
    });
  });

  return (
    <group>
      {Array.from({ length: count }).map((_, index) => {
        const angle = (index / count) * Math.PI * 2;
        const radius = 2;
        return (
          <mesh
            key={index}
            ref={(element) => {
              meshRefs.current[index] = element;
            }}
            position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.07, 1, 0.07]} />
            <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.18} />
          </mesh>
        );
      })}
    </group>
  );
}

export function CircularVisualizer({ analyserRef, dataRef, size = 220 }) {
  useEffect(() => {}, [analyserRef, dataRef]);

  return (
    <div style={{ width: size, height: size }}>
      <Canvas camera={{ position: [0, 4.8, 0.1], fov: 60 }}>
        <ambientLight intensity={0.35} />
        <Bars analyserRef={analyserRef} dataRef={dataRef} />
      </Canvas>
    </div>
  );
}
