"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera, Edges } from "@react-three/drei";
import * as THREE from "three";

/**
 * Shared DNA for Bento Visuals:
 * - Orthographic Camera for Isometric Projection
 * - Wireframe/Edge rendering for technical aesthetic
 * - Subtle floating/rotational animations
 * - Performance optimized for auto-scrolling landing pages
 */

const CameraSetup = ({ zoom }: { zoom: number }) => {
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera;
  useEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }, [camera, zoom]);
  return null;
};

export const IsometricCanvas = ({ children, zoom = 40 }: { children: React.ReactNode, zoom?: number }) => {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-5 overflow-hidden">
      <Canvas
        gl={{ antialias: true, alpha: true }}
        dpr={typeof window !== 'undefined' ? window.devicePixelRatio : 2}
      >
        <OrthographicCamera
          makeDefault
          position={[10, 10, 10]}
          near={0.1}
          far={2000}
        />
        <CameraSetup zoom={50} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        {children}
      </Canvas>
    </div>
  );
};

export const WireframeBlock = ({
  position = [0, 0, 0] as [number, number, number],
  args = [1, 1, 1] as [number, number, number],
  color = "#ffffff",
  opacity = 0.2,
  animation = "none"
}: {
  position?: [number, number, number];
  args?: [number, number, number];
  color?: string;
  opacity?: number;
  animation?: "float" | "rotate" | "none";
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;

    if (animation === "float") {
      meshRef.current.position.y = position[1] + Math.sin(time + position[0]) * 0.1;
    } else if (animation === "rotate") {
      meshRef.current.rotation.y = time * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={args} />
      <meshBasicMaterial color="#000000" transparent opacity={0.05} />
      <Edges
        linewidth={1}
        threshold={15}
        color={color}
      >
        <meshBasicMaterial transparent opacity={opacity} />
      </Edges>
    </mesh>
  );
};
