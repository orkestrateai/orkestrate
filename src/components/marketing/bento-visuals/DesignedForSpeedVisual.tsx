"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { IsometricCanvas } from "./BentoVisualSystem";
import { Edges } from "@react-three/drei";

const FastLanes = () => {
  const lanesRef = useRef<THREE.Group>(null);
  const laneCount = 5;
  const blocksPerLane = 3;

  const getLaneSpeed = (laneIdx: number) => {
    return 12 + (laneIdx % 3) * 6; // Fast, staggered speeds
  };

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (lanesRef.current) {
      // Animate the blocks zipping along the lanes
      lanesRef.current.children.forEach((laneGroup, laneIdx) => {
        const speed = getLaneSpeed(laneIdx);
        // The first child is the track. The subsequent children are the moving blocks.
        for (let i = 1; i <= blocksPerLane; i++) {
          const block = laneGroup.children[i] as THREE.Mesh;
          if (block) {
            // Predictable offset to space out the blocks
            const offset = laneIdx * 2.3 + i * 8.0;
            
            // Loop Z position from front right (positive Z) to back left (negative Z)
            // Z ranges from 15 to -15
            const cycleDuration = 30 / speed;
            const normalizedTime = ((time + offset) % cycleDuration) / cycleDuration;
            const zPos = 15 - (normalizedTime * 30);
            
            block.position.z = zPos;

            // Optional: flash effect when they pass the center
            const centralPulse = Math.max(0, 1 - Math.abs(zPos) * 0.2);
            if (block.material) {
              (block.material as THREE.MeshBasicMaterial).opacity = 0.05 + centralPulse * 0.8;
            }
          }
        }
      });
    }
  });

  return (
    <group position={[0, -2, 0]}>
      <group ref={lanesRef}>
        {Array.from({ length: laneCount }).map((_, laneIdx) => (
          // Space out the lanes along the X axis
          <group key={laneIdx} position={[(laneIdx - (laneCount - 1) / 2) * 1.8, 0, 0]}>
            
            {/* The Track Slab */}
            <mesh position={[0, -0.2, 0]}>
              <boxGeometry args={[1.2, 0.1, 25]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.02} />
              <Edges linewidth={1} color="#333333" />
            </mesh>
            
            {/* The traveling Data Blocks */}
            {Array.from({ length: blocksPerLane }).map((_, blockIdx) => (
              <mesh key={blockIdx} position={[0, 0.4, 0]}>
                <boxGeometry args={[1, 0.4, 2.5]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
                <Edges linewidth={1.5} color="#ffffff" />
              </mesh>
            ))}
            
          </group>
        ))}
      </group>
    </group>
  );
};

export const DesignedForSpeedVisual = () => {
  return (
    <div className="absolute inset-0 opacity-40 group-hover:opacity-100 transition-opacity duration-1000">
      <IsometricCanvas zoom={35}>
        <FastLanes />
      </IsometricCanvas>
    </div>
  );
};
