"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PLANE_SIZE = 40;
const RESOLUTION = 150;
const LAYERS = 8; // Try changing this number to see more or fewer steps

function TopographicLandscape() {
  const meshRef = useRef<THREE.Mesh>(null);

  const basePositions = useMemo(() => {
    const geom = new THREE.PlaneGeometry(
      PLANE_SIZE,
      PLANE_SIZE,
      RESOLUTION,
      RESOLUTION,
    );
    return geom.attributes.position.array.slice();
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const time = clock.getElapsedTime() * 0.2;
    const geom = meshRef.current.geometry;
    const posAttr = geom.attributes.position;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < posArray.length; i += 3) {
      const x = basePositions[i];
      const y = basePositions[i + 1];

      // 1. Create a complex landscape using both X and Y
      const smoothHeight =
        Math.sin(x * 0.2 + time) * 2.0 + Math.cos(y * 0.2 - time) * 2.0;

      // 2. Force the smooth heights into discrete steps
      const steppedHeight = Math.floor(smoothHeight * LAYERS) / LAYERS;

      posArray[i + 2] = steppedHeight;
    }

    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
  });

  return (
    <mesh
      ref={meshRef}
      rotation={new THREE.Euler(-Math.PI / 2, 0, 0)}
      position={new THREE.Vector3(0, -2, 0)}
    >
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, RESOLUTION, RESOLUTION]} />
      {/* We are still using wireframe so you can see how the grid bends */}
      <meshStandardMaterial color="#ffffff" wireframe={true} />
    </mesh>
  );
}

export default function LayeredLandscapeScene() {
  return (
    <div className="w-screen h-screen bg-[#050505] fixed inset-0 -z-10">
      <Canvas camera={{ position: new THREE.Vector3(0, 5, 15), fov: 60 }}>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={new THREE.Vector3(10, 10, 5)}
          intensity={1}
        />
        <fog attach="fog" args={["#050505", 10, 35]} />
        <TopographicLandscape />
      </Canvas>
    </div>
  );
}
