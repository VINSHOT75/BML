import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars, Cloud } from '@react-three/drei';
import * as THREE from 'three';

// Simple Truck Component
function Truck({ position, speed, color }) {
  const truckRef = useRef();
  const initialX = position[0];
  
  useFrame((state) => {
    if (truckRef.current) {
      // Move truck from left to right
      truckRef.current.position.x += speed;
      // Reset position when off screen
      if (truckRef.current.position.x > 15) {
        truckRef.current.position.x = -15;
      }
    }
  });

  return (
    <group ref={truckRef} position={position}>
      {/* Truck Body */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[2, 0.8, 1]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Truck Cabin */}
      <mesh position={[1.2, 0.6, 0]}>
        <boxGeometry args={[0.8, 0.6, 0.9]} />
        <meshStandardMaterial color="#1B4B7A" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Wheels */}
      <mesh position={[-0.6, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[-0.6, 0, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0.8, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0.8, 0, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
}

// Road Component
function Road() {
  const roadRef = useRef();
  
  return (
    <group>
      {/* Main Road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[40, 3]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {/* Road Lines */}
      {[-12, -8, -4, 0, 4, 8, 12].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.05, 0]}>
          <planeGeometry args={[2, 0.1]} />
          <meshStandardMaterial color="#FFD700" />
        </mesh>
      ))}
    </group>
  );
}

// Warehouse Component
function Warehouse({ position }) {
  return (
    <group position={position}>
      {/* Building */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[3, 2, 2]} />
        <meshStandardMaterial color="#4a5568" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 2.3, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[2.5, 0.3, 2.2]} />
        <meshStandardMaterial color="#E86F2A" />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.6, 1.01]}>
        <boxGeometry args={[1.5, 1.2, 0.1]} />
        <meshStandardMaterial color="#1B4B7A" />
      </mesh>
    </group>
  );
}

// Ground with Grid
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  );
}

// Main 3D Scene
export default function Scene3D() {
  const trucks = useMemo(() => [
    { position: [-10, 0, 0], speed: 0.05, color: '#E86F2A' },
    { position: [-5, 0, -4], speed: 0.04, color: '#3B82F6' },
    { position: [0, 0, 0], speed: 0.06, color: '#E86F2A' },
    { position: [8, 0, -4], speed: 0.035, color: '#22C55E' },
    { position: [-12, 0, 4], speed: 0.045, color: '#E86F2A' },
  ], []);

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 8, 15], fov: 50 }}
        style={{ background: 'linear-gradient(to bottom, #0f172a 0%, #1e3a5f 50%, #1B4B7A 100%)' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, 10, -5]} intensity={0.5} color="#E86F2A" />
        
        {/* Stars in background */}
        <Stars radius={100} depth={50} count={3000} factor={4} fade speed={1} />
        
        {/* Ground */}
        <Ground />
        
        {/* Roads */}
        <Road />
        <group position={[0, 0, -4]}>
          <Road />
        </group>
        <group position={[0, 0, 4]}>
          <Road />
        </group>
        
        {/* Warehouses */}
        <Warehouse position={[-8, 0, -8]} />
        <Warehouse position={[8, 0, -8]} />
        <Warehouse position={[0, 0, 8]} />
        
        {/* Animated Trucks */}
        {trucks.map((truck, index) => (
          <Truck key={index} {...truck} />
        ))}
        
        {/* Fog for depth */}
        <fog attach="fog" args={['#0f172a', 15, 40]} />
      </Canvas>
    </div>
  );
}
