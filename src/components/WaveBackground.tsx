"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 30000;
const DUNE_RESOLUTION = 128;
const FLOOR_Y = -4;

const GREYSCALE_PALETTE = [
  new THREE.Color("#0a0a0a"),
  new THREE.Color("#141414"),
  new THREE.Color("#1f1f1f"),
  new THREE.Color("#2e2e2e"),
  new THREE.Color("#3d3d3d"),
];

function AccumulatingDunes() {
  const meshRef = useRef<THREE.Mesh>(null);
  const basePositions = useMemo(() => {
    const geom = new THREE.PlaneGeometry(
      30,
      15,
      DUNE_RESOLUTION,
      DUNE_RESOLUTION,
    );
    return geom.attributes.position.array.slice();
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const time = clock.getElapsedTime();
    const geom = meshRef.current.geometry;
    const posAttr = geom.attributes.position;
    const posArray = posAttr.array as Float32Array;

    const accumulationHeight = Math.min(time * 0.05, 3);

    for (let i = 0; i < posArray.length; i += 3) {
      const x = basePositions[i];
      const y = basePositions[i + 1];

      const ridge1 = Math.sin(x * 0.3 + time * 0.1) * Math.cos(y * 0.3) * 1.5;
      const ridge2 = Math.sin(x * 0.8 - y * 0.5) * 0.5;

      posArray[i + 2] = ridge1 + ridge2 + accumulationHeight;
    }

    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
  });

  return (
    <mesh
      ref={meshRef}
      rotation={new THREE.Euler(-Math.PI / 2, 0, 0)}
      position={new THREE.Vector3(0, FLOOR_Y, 0)}
      receiveShadow
    >
      <planeGeometry args={[30, 15, DUNE_RESOLUTION, DUNE_RESOLUTION]} />
      <meshStandardMaterial
        color="#111111"
        roughness={0.8}
        metalness={0.2}
        flatShading={false}
      />
    </mesh>
  );
}

function SandScene({
  mouseWorldRef,
}: {
  mouseWorldRef: React.RefObject<THREE.Vector2>;
}) {
  return (
    <>
      <ambientLight intensity={0.1} />

      <directionalLight
        position={new THREE.Vector3(-10, 5, -5)}
        intensity={2.5}
        color="#ffffff"
        castShadow
      />

      <spotLight
        position={new THREE.Vector3(10, 2, 5)}
        intensity={5000}
        angle={0.5}
        penumbra={1}
        color="#555555"
      />

      <fog attach="fog" args={["#050505", 5, 20]} />
      <AccumulatingDunes />
    </>
  );
}

// Fixed: Exporting as default and renamed to match your layout import
export default function WaveBackground() {
  const mouseWorldRef = useRef(new THREE.Vector2(0, 999));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: "#050505",
      }}
      onMouseMove={(e) => {
        mouseWorldRef.current.x = (e.clientX / window.innerWidth) * 20 - 10;
        mouseWorldRef.current.y = -(e.clientY / window.innerHeight) * 20 + 10;
      }}
    >
      <Canvas
        shadows
        camera={{ position: new THREE.Vector3(0, 0, 12), fov: 45 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <SandScene mouseWorldRef={mouseWorldRef} />
      </Canvas>
    </div>
  );
}
