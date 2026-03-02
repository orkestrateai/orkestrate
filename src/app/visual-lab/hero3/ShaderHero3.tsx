"use client";

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, Float } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// ═══ THE LOOM PRISM (The Orchestrator) ═══
function CentralPrism() {
    const ref = useRef<THREE.Mesh>(null!);

    useFrame((state, delta) => {
        // Very slow, deliberate rotation
        ref.current.rotation.y += delta * 0.1;
    });

    return (
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5}>
            <mesh ref={ref} position={[0, 0, 0]}>
                {/* A tall, hexagonal crystal */}
                <cylinderGeometry args={[1.2, 1.2, 5, 6]} />
                <MeshTransmissionMaterial
                    backside
                    samples={8}
                    thickness={3}
                    chromaticAberration={0.8} // High aberration for that rainbow "magical" glass look
                    anisotropy={0.3}
                    distortion={0.2}
                    distortionScale={0.5}
                    temporalDistortion={0.1}
                    clearcoat={1}
                    attenuationDistance={2}
                    attenuationColor="#ffffff"
                    color="#f1f5f9"
                />
                {/* The internal core providing the main glow */}
                <mesh position={[0, 0, 0]}>
                    <cylinderGeometry args={[0.2, 0.2, 4, 6]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
            </mesh>
        </Float>
    );
}

// ═══ CHAOTIC INPUT (Left Side) ═══
function ChaoticInputLines({ count = 25 }) {
    // Generate complex, tangled splines that all end at x=0
    const lines = useMemo(() => {
        const splines = [];
        for (let i = 0; i < count; i++) {
            const points = [];
            // Start far left
            let x = -15;
            // End at the prism
            const targetX = -1.2;
            const targetY = (Math.random() - 0.5) * 4;
            const targetZ = (Math.random() - 0.5) * 2;

            points.push(new THREE.Vector3(x, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8));

            // Generate wandering intermediate points
            while (x < -4) {
                x += 2 + Math.random() * 2;
                const y = Math.sin(x * 0.5 + i) * 3 + (Math.random() - 0.5) * 2;
                const z = Math.cos(x * 0.4 - i) * 3 + (Math.random() - 0.5) * 2;
                points.push(new THREE.Vector3(x, y, z));
            }

            // Final point hitting the prism
            points.push(new THREE.Vector3(targetX, targetY, targetZ));

            const curve = new THREE.CatmullRomCurve3(points);

            // Vary the colors slightly between cool/warm tones for the "multitude" feel
            const palette = ["#6366f1", "#0ea5e9", "#f43f5e", "#f59e0b", "#10b981"];
            const color = palette[Math.floor(Math.random() * palette.length)];

            splines.push({ curve, color, speed: 0.2 + Math.random() * 0.5, offset: Math.random() });
        }
        return splines;
    }, [count]);

    // Animate glowing packets along the curves
    const particlesRef = useRef<THREE.Group>(null!);

    useFrame((state, delta) => {
        if (!particlesRef.current) return;
        const time = state.clock.elapsedTime;

        particlesRef.current.children.forEach((mesh, index) => {
            const lineData = lines[index];
            // Loop progress from 0 to 1
            const progress = (time * lineData.speed + lineData.offset) % 1;

            // Get position on spline
            const pos = lineData.curve.getPointAt(progress);
            mesh.position.copy(pos);

            // Fade out as it hits the crystal
            const mat = (mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
            mat.opacity = progress > 0.9 ? 1 - ((progress - 0.9) * 10) : 1;
        });
    });

    return (
        <group>
            {/* The static, faint trails */}
            {lines.map((line, i) => (
                <mesh key={`trail-${i}`}>
                    <tubeGeometry args={[line.curve, 64, 0.02, 3, false]} />
                    <meshBasicMaterial color={line.color} transparent opacity={0.1} />
                </mesh>
            ))}

            {/* The moving glowing packets */}
            <group ref={particlesRef}>
                {lines.map((line, i) => (
                    <mesh key={`packet-${i}`}>
                        <sphereGeometry args={[0.08, 8, 8]} />
                        {/* High emissive multiple triggers the Bloom post-processing heavily */}
                        <meshBasicMaterial color={line.color} transparent />
                    </mesh>
                ))}
            </group>
        </group>
    );
}

// ═══ ORGANIZED OUTPUT (Right Side) ═══
function OrganizedOutputLines({ count = 25 }) {
    // Generate perfectly straight, parallel lines exiting the prism
    const lines = useMemo(() => {
        const straightLines = [];
        // Determine grid layout for the parallel lines
        const gridSize = Math.ceil(Math.sqrt(count));
        const spacing = 0.5;

        let created = 0;
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                if (created >= count) break;

                // Start exactly at the right face of the prism
                const startX = 1.2;
                // Center the grid on the Y and Z axes
                const startY = (y - (gridSize - 1) / 2) * spacing;
                const startZ = (x - (gridSize - 1) / 2) * spacing;

                // End far right
                const endX = 15;

                const points = [
                    new THREE.Vector3(startX, startY, startZ),
                    new THREE.Vector3(endX, startY, startZ)
                ];
                const curve = new THREE.CatmullRomCurve3(points);

                // Unified, branded color for the output (Orkestrate aesthetic)
                straightLines.push({ curve, color: "#38bdf8", speed: 0.8 + Math.random() * 0.4, offset: Math.random() });
                created++;
            }
        }
        return straightLines;
    }, [count]);

    const particlesRef = useRef<THREE.Group>(null!);

    useFrame((state) => {
        if (!particlesRef.current) return;
        const time = state.clock.elapsedTime;

        particlesRef.current.children.forEach((mesh, index) => {
            const lineData = lines[index];
            const progress = (time * lineData.speed + lineData.offset) % 1;
            const pos = lineData.curve.getPointAt(progress);
            mesh.position.copy(pos);

            const mat = (mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
            // Fade in as it leaves the crystal
            mat.opacity = progress < 0.1 ? progress * 10 : 1;
        });
    });

    return (
        <group>
            {/* The static, faint parallel trails */}
            {lines.map((line, i) => (
                <mesh key={`straight-trail-${i}`}>
                    <tubeGeometry args={[line.curve, 2, 0.015, 3, false]} />
                    {/* Extremely faint trailing lines to show structure */}
                    <meshBasicMaterial color="#e0f2fe" transparent opacity={0.05} />
                </mesh>
            ))}

            <group ref={particlesRef}>
                {lines.map((line, i) => (
                    <mesh key={`straight-packet-${i}`}>
                        {/* Slightly elongated "laser" look for the output packets */}
                        <cylinderGeometry args={[0.04, 0.04, 0.6, 8]} />
                        <meshBasicMaterial color={line.color} transparent />
                    </mesh>
                ))}
            </group>
        </group>
    );
}

// ═══ SCENE COMPOSITION ═══
function Scene() {
    const { viewport } = useThree();

    // Rotate the entire assembly slightly so we look down the "barrel" of the output
    const isDesktop = viewport.width > 5;
    const rotation: [number, number, number] = isDesktop ? [0.1, -0.15, 0] : [0, 0, 0];
    const position: [number, number, number] = isDesktop ? [1, 0, 0] : [0, 0, 0];

    return (
        <group position={position} rotation={rotation}>
            {/* Intense, dramatic lighting for the glass */}
            <ambientLight intensity={0.1} />
            <spotLight position={[0, 10, 0]} intensity={5} color="#ffffff" angle={0.5} penumbra={1} />
            <pointLight position={[-5, 0, 5]} intensity={3} color="#f43f5e" distance={15} />
            <pointLight position={[5, 0, 5]} intensity={3} color="#38bdf8" distance={15} />

            <CentralPrism />
            <ChaoticInputLines count={25} />
            <OrganizedOutputLines count={25} />

            {/* The magic! Heavy bloom creates the ethereal midjourney/light-trail aesthetic */}
            <EffectComposer multisampling={4}>
                <Bloom
                    luminanceThreshold={0.5}
                    luminanceSmoothing={0.9}
                    intensity={2.5}
                    mipmapBlur={true}
                />
            </EffectComposer>
        </group>
    );
}

export default function ShaderHero3() {
    return (
        <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 14], fov: 40 }}
            gl={{ antialias: false, powerPreference: 'high-performance' }} // Bloom handles antialiasing often
            style={{ background: '#020202' }} // ensure pure near-black for bloom contrast
        >
            <Environment preset="night" background={false} />
            <Scene />
        </Canvas>
    );
}
