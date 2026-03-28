"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { IsometricCanvas } from "./BentoVisualSystem";
import { Edges, Line } from "@react-three/drei";

const OrbitalSync = () => {
  const centerRef = useRef<THREE.Mesh>(null);
  const orbitGroupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (centerRef.current) {
      centerRef.current.rotation.y = time * 0.5;
      centerRef.current.rotation.x = time * 0.3;
      // Pulse scale of the core
      const coreScale = 1 + Math.sin(time * 3) * 0.05;
      centerRef.current.scale.set(coreScale, coreScale, coreScale);
    }
    if (orbitGroupRef.current) {
      orbitGroupRef.current.rotation.y = -time * 0.8;
      // Bob up and down as a unit
      orbitGroupRef.current.position.y = Math.sin(time * 2) * 0.2;
    }
  });

  // Coordinates for 3 orbital satellites arranged in a triangle
  const agentPositions = [
    [3, 0, 0],
    [-1.5, 0, 2.6],
    [-1.5, 0, -2.6]
  ] as [number, number, number][];

  return (
    <group>
      {/* Central Core (The Truth / Sync State) */}
      <mesh ref={centerRef}>
        <octahedronGeometry args={[1.2, 0]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.6} />
        <Edges linewidth={1.5} color="#ffffff" />
      </mesh>
      
      {/* Orbiting Agents */}
      <group ref={orbitGroupRef}>
        {agentPositions.map((pos, i) => (
          <group key={i}>
            {/* Agent Ship/Pyramid */}
            <mesh position={pos} rotation={[1, i, 0]}>
              <coneGeometry args={[0.5, 1, 3]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.4} />
              <Edges linewidth={1} color="#888888" />
            </mesh>
            {/* Sync Lines communicating to Center */}
            <Line
              points={[pos, [0, 0, 0]]}
              color="#ffffff"
              lineWidth={1}
              transparent
              opacity={0.3}
              dashed={true}
              dashScale={3}
            />
          </group>
        ))}
        {/* Faint Orbital Path Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.95, 3.05, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};

export const PoweredByAgentsVisual = () => {
  return (
    <div className="absolute inset-0 opacity-40 group-hover:opacity-100 transition-opacity duration-1000">
      <IsometricCanvas zoom={40}>
        <OrbitalSync />
      </IsometricCanvas>
    </div>
  );
};
