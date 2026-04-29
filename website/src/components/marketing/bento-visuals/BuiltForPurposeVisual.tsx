"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { IsometricCanvas } from "./BentoVisualSystem";
import { Edges } from "@react-three/drei";

const DataCity = () => {
  const groupRef = useRef<THREE.Group>(null);

  const gridSize = 6;
  const bars = useMemo(() => {
    const items = [];
    for (let x = -gridSize; x <= gridSize; x += 2) {
      for (let z = -gridSize; z <= gridSize; z += 2) {
        const dist = Math.sqrt(x * x + z * z);
        const maxH = Math.max(0.5, 5 - dist * 0.8);
        items.push({ x, z, maxH, dist, delay: dist * 0.5 });
      }
    }
    return items;
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();

    groupRef.current.children.forEach((child, i) => {
      const barData = bars[i];
      if (barData) {
        const h = barData.maxH * (0.8 + 0.2 * Math.sin(time * 2 - barData.delay));
        child.scale.y = h;
        child.position.y = h / 2 - 2;
      }
    });
    groupRef.current.rotation.y = time * 0.05;
  });

  return (
    <group ref={groupRef}>
      {bars.map((b, i) => (
        <mesh key={i} position={[b.x, 0, b.z]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.3} />
          <Edges
            linewidth={1}
            threshold={15}
            color={b.dist < 3 ? "#ffffff" : "#444444"}
          />
        </mesh>
      ))}

      {/* Existing inner plane */}
      <mesh position={[0, -2.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 15]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.02} side={THREE.DoubleSide} />
      </mesh>

      {/* Hollow frame with gap — RingGeometry(innerRadius, outerRadius, segments) */}
      <mesh position={[0, -2.1, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <ringGeometry args={[12, 15, 4]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>

    </group>
  );
};

export const BuiltForPurposeVisual = () => {
  return (
    <div className="absolute inset-0 opacity-40 group-hover:opacity-100 transition-opacity duration-1000">
      <IsometricCanvas zoom={30}>
        <DataCity />
      </IsometricCanvas>
    </div>
  );
};