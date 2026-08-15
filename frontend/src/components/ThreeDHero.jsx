import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  Float, 
  Sparkles, 
  MeshDistortMaterial, 
  Environment, 
  ContactShadows,
  PerspectiveCamera,
  Sphere
} from '@react-three/drei';

function Scene() {
  const meshRef = useRef();

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    meshRef.current.rotation.x = time * 0.2;
    meshRef.current.rotation.y = time * 0.3;
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#FF0000" />
      
      <Suspense fallback={null}>
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <mesh ref={meshRef}>
            <sphereGeometry args={[1, 128, 128]} />
            <MeshDistortMaterial
              color="#FF0000"
              speed={4}
              distort={0.4}
              radius={1}
              metalness={0.9}
              roughness={0.1}
              emissive="#220000"
            />
          </mesh>
        </Float>
        <Sparkles count={150} scale={12} size={2} speed={0.4} opacity={0.4} color="#FF0000" />
        <Environment preset="city" />
        <ContactShadows 
          position={[0, -2.5, 0]} 
          opacity={0.5} 
          scale={10} 
          blur={2} 
          far={4.5} 
        />
      </Suspense>
    </>
  );
}

const ThreeDHero = () => {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas shadows legacy={false}>
        <Scene />
      </Canvas>
    </div>
  );
};

export default ThreeDHero;
