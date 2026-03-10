'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
    MeshTransmissionMaterial,
    Environment,
    ContactShadows,
    PerspectiveCamera
} from '@react-three/drei';
import { EffectComposer, Bloom, Noise, DepthOfField } from '@react-three/postprocessing';

// Physics & Animation Config
const GRID_SIZE = 120;
const DAMPING = 0.99;
const START_DELAY = 0.0;
const RISE_DURATION = 3.5;
const PEAK_PAUSE = 1.0;
const DROP_DURATION = 1.5;

/**
 * THE BALL SYSTEM
 * Simple interactive sphere with transmission material
 */
function Ball({ y }: { y: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    return (
        <mesh ref={meshRef} position={[0, y, 0]}>
            <sphereGeometry args={[0.6, 128, 128]} />
            <MeshTransmissionMaterial
                backside samples={64} thickness={1.5}
                chromaticAberration={0.05} anisotropy={0.5}
                distortion={0.02} color="#ffffff" transmission={1.0}
                roughness={0.02} ior={1.45}
            />
        </mesh>
    );
}

function PhysicalRippleFloor({ ballY }: { ballY: number }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const lastY = useRef(ballY);
    const simulation = useMemo(() => ({
        h1: new Float32Array(GRID_SIZE * GRID_SIZE),
        h2: new Float32Array(GRID_SIZE * GRID_SIZE),
    }), []);
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(60, 60, GRID_SIZE - 1, GRID_SIZE - 1);
        geo.rotateX(-Math.PI / 2);
        return geo;
    }, []);

    useFrame(() => {
        if (!meshRef.current) return;
        const pos = meshRef.current.geometry.getAttribute('position');
        const { h1, h2 } = simulation;
        const ballRadius = 0.6;
        const centerX = GRID_SIZE / 2;
        const centerZ = GRID_SIZE / 2;
        const gridScale = 60 / GRID_SIZE;

        const waterLevel = -0.5;
        const distToWater = Math.abs(ballY - waterLevel);
        const dy = (ballY - lastY.current) * 20.0;
        const currentInteractionRadius = distToWater < ballRadius ? Math.sqrt(ballRadius ** 2 - distToWater ** 2) : 0;

        const sr = 25;
        for (let ix = -sr; ix <= sr; ix++) {
            for (let iz = -sr; iz <= sr; iz++) {
                const gx = centerX + ix; const gz = centerZ + iz;
                if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) continue;
                const vx = ix * gridScale; const vz = iz * gridScale;
                const dist = Math.sqrt(vx * vx + vz * vz);
                if (dist < ballRadius && Math.abs(dy) > 0.01 && currentInteractionRadius > 0) {
                    const ringPush = Math.exp(-Math.pow(dist - currentInteractionRadius, 2.0) * 20.0);
                    // Increased ripple intensity from user interaction (0.15)
                    h1[gz * GRID_SIZE + gx] += dy * ringPush * 0.15;
                }
            }
        }
        lastY.current = ballY;

        for (let i = 1; i < GRID_SIZE - 1; i++) {
            for (let j = 1; j < GRID_SIZE - 1; j++) {
                const idx = i * GRID_SIZE + j;
                h2[idx] = ((h1[idx - 1] + h1[idx + 1] + h1[idx - GRID_SIZE] + h1[idx + GRID_SIZE]) / 2 - h2[idx]) * DAMPING;
            }
        }
        const temp = simulation.h1; simulation.h1 = simulation.h2; simulation.h2 = temp;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < h1.length; i++) arr[i * 3 + 1] = h1[i];
        pos.needsUpdate = true;
        meshRef.current.geometry.computeVertexNormals();
    });

    return (
        <mesh ref={meshRef} geometry={geometry} position={[0, -0.5, 0]}>
            <meshPhysicalMaterial color="#020202" roughness={0.06} metalness={0.8} transparent opacity={0.9} ior={1.33} />
        </mesh>
    );
}

function OrkestrateLogo3D({ opacity = 1 }: { opacity?: number }) {
    return (
        <group scale={[0.5, 0.5, 1]} position={[0, 2.25, 0]}>
            {/* Layer 1 (Top) - Brightest, most opaque */}
            <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 3, 0, 0]}>
                <torusGeometry args={[0.5, 0.03, 64, 4]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
            </mesh>

            {/* Layer 2 (Middle) - Semi-transparent */}
            <mesh position={[0, 0, 0]} rotation={[Math.PI / 3, 0, 0]}>
                <torusGeometry args={[0.5, 0.03, 64, 4]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.4 * opacity} />
            </mesh>

            {/* Layer 3 (Bottom) - Faintest */}
            <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 3, 0, 0]}>
                <torusGeometry args={[0.5, 0.03, 64, 4]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.2 * opacity} />
            </mesh>
        </group>
    );
}

function OrkestrateEnvironment() {
    return (
        <Environment resolution={1024}>
            {/* Soft ambient base */}
            <ambientLight intensity={0.5} />

            {/* The 3D Logo positioned to reflect perfectly in the center of the sphere */}
            <group position={[0, -4, 0]} scale={1.5} rotation={[-0.0125, 0, 0]}>
                <OrkestrateLogo3D />
            </group>
            {/* Studio lighting panels - scaled down to not wash out the logo reflection */}
            <mesh position={[-2, 2, -3]} rotation={[0, Math.PI / 3, 0]}>
                <planeGeometry args={[1, 10]} />
                <meshBasicMaterial color="#ffffffff" transparent opacity={0.5} />
            </mesh>
            <mesh position={[2, 2, -3]} rotation={[0, -Math.PI / 3, 0]}>
                <planeGeometry args={[1, 10]} />
                <meshBasicMaterial color="#ffffffff" transparent opacity={0.5} />
            </mesh>
            <mesh position={[0, 1, -3]} rotation={[Math.PI / 2, 0, 0]} scale={20}>
                <planeGeometry args={[10, 1]} />
                <meshBasicMaterial color="#d22424ff" transparent opacity={0.75} />
            </mesh>
        </Environment>
    );
}

function Experience({ onComplete, onStartReveal, hideLogo = false }: { onComplete: () => void; onStartReveal: () => void; hideLogo?: boolean }) {
    const [ballY, setBallY] = useState(-1.5);
    const [showLogo, setShowLogo] = useState(false);
    const [logoOpacity, setLogoOpacity] = useState(0);
    const completed = useRef(false);
    const startedReveal = useRef(false);

    useFrame((state) => {
        const t = state.clock.elapsedTime;

        let targetY = -1.5;

        if (t < START_DELAY + RISE_DURATION) {
            // Phase 1: Rise
            const p = Math.min(1, Math.max(0, (t - START_DELAY) / RISE_DURATION));
            const easedP = p * p * (3 - 2 * p);
            targetY = THREE.MathUtils.lerp(-1.5, 1.2, easedP);
        } else if (t < START_DELAY + RISE_DURATION + PEAK_PAUSE) {
            // Phase 2: Pause at peak with small bobbing
            const peakTime = t - (START_DELAY + RISE_DURATION);
            targetY = 1.2 + Math.sin(peakTime * 0.8) * 0.03;

            if (!startedReveal.current) {
                startedReveal.current = true;
                onStartReveal();
            }
        } else if (t < START_DELAY + RISE_DURATION + PEAK_PAUSE + DROP_DURATION) {
            // Phase 3: Drop back into water
            const dp = Math.min(1, Math.max(0, (t - (START_DELAY + RISE_DURATION + PEAK_PAUSE)) / DROP_DURATION));
            const easedDP = dp * dp; // Faster drop
            targetY = THREE.MathUtils.lerp(1.2, -3.5, easedDP);
        } else {
            // Phase 4: Completed
            targetY = -3.5;
            if (!completed.current) {
                completed.current = true;
                if (!hideLogo) setShowLogo(true);
                onComplete();
            }
        }

        setBallY(targetY);

        if (showLogo && logoOpacity < 1) {
            setLogoOpacity(prev => Math.min(1, prev + 0.02));
        }
    });

    return (
        <>
            <color attach="background" args={['#030303']} />
            <fog attach="fog" args={['#030303', 2, 25]} />
            <PerspectiveCamera makeDefault position={[0, 1.2, 11]} fov={30} />
            <PhysicalRippleFloor ballY={ballY} />

            <Ball y={ballY} />

            {/* <ContactShadows opacity={0.6} scale={15} blur={4} far={4} color="#ebe3e3ff" /> */}
            <OrkestrateEnvironment />

            {showLogo && (
                <group position={[0, 0, 3]} scale={1} rotation={[0, 0, 0]}>
                    <OrkestrateLogo3D opacity={logoOpacity} />
                </group>
            )}

            <EffectComposer multisampling={2}>
                <Bloom intensity={1.2} luminanceThreshold={0.7} mipmapBlur />
                <Noise opacity={0.01} />
            </EffectComposer>
        </>
    );
}

export function BackgroundShader({ onComplete, onStartReveal, hideLogo = false }: { onComplete?: () => void; onStartReveal?: () => void; hideLogo?: boolean }) {
    return (
        <div className="absolute inset-0 z-0 bg-[#050505]">
            <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
                <Experience
                    onComplete={onComplete || (() => { })}
                    onStartReveal={onStartReveal || (() => { })}
                    hideLogo={hideLogo}
                />
            </Canvas>
        </div>
    );
}
