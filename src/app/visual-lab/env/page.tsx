'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei';

function OrkestrateLogo3D() {
    return (
        <group scale={[1, 0.5, 1]}>
            {/* Layer 1 (Top) - Brightest, most opaque */}
            <mesh position={[0, 1.2, 0.3]} rotation={[0, 0, Math.PI / 4]}>
                <torusGeometry args={[1, 0.05, 16, 4]} />
                <meshBasicMaterial color="#F2F2F2" />
            </mesh>
            <mesh position={[0, 1.2, 0.3]} rotation={[0, 0, Math.PI / 4]}>
                <torusGeometry args={[1, 0.02, 16, 4]} />
                <meshBasicMaterial color="#F2F2F2" transparent opacity={0.14} />
            </mesh>

            {/* Layer 2 (Middle) - Semi-transparent */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
                <torusGeometry args={[1, 0.05, 16, 4]} />
                <meshBasicMaterial color="#F2F2F2" transparent opacity={0.6} />
            </mesh>
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
                <torusGeometry args={[1, 0.02, 16, 4]} />
                <meshBasicMaterial color="#F2F2F2" transparent opacity={0.08} />
            </mesh>

            {/* Layer 3 (Bottom) - Faintest */}
            <mesh position={[0, -1.2, -0.3]} rotation={[0, 0, Math.PI / 4]}>
                <torusGeometry args={[1, 0.05, 16, 4]} />
                <meshBasicMaterial color="#F2F2F2" transparent opacity={0.35} />
            </mesh>
        </group>
    );
}

function OrkestrateEnvironment() {
    return (
        <Environment background resolution={1024}>
            {/* Soft ambient base */}
            <ambientLight intensity={0.5} />

            {/* The 3D Logo positioned to reflect perfectly in the center of the sphere */}
            <group position={[0, 2, -10]} scale={3}>
                <OrkestrateLogo3D />
            </group>

            {/* Studio lighting panels to create beautiful edge un-lit highlights on the glass */}
            <mesh position={[-10, 0, -5]} rotation={[0, Math.PI / 3, 0]}>
                <planeGeometry args={[2, 20]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[10, 0, -5]} rotation={[0, -Math.PI / 3, 0]}>
                <planeGeometry args={[2, 20]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 10, -5]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[20, 2]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
        </Environment>
    );
}

export default function EnvPreviewPage() {
    return (
        <main className="w-screen h-screen bg-[#050505]">
            <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
                <PerspectiveCamera makeDefault position={[0, 0, 15]} fov={50} />
                <OrbitControls />
                <OrkestrateEnvironment />

                {/* A reference sphere to see how the environment lights it */}
                <mesh>
                    <sphereGeometry args={[2, 64, 64]} />
                    <meshStandardMaterial metalness={1} roughness={0} />
                </mesh>
            </Canvas>
        </main>
    );
}
