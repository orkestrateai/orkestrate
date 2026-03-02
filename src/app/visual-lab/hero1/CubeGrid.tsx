'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

const GRID = 5;
const SIZE = 0.72;
const GAP = 0.1;
const STEP = SIZE + GAP;

// Dark matte color palette
const PALETTE = ['#333333', '#2e2e2e', '#2a2a2a', '#262626', '#383838', '#303030'];

function pickColor() {
    return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

// Check if cube should be visible (remove some edge cubes for organic shape)
function shouldShow(x: number, y: number, z: number) {
    const cx = (GRID - 1) / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cx) ** 2 + (z - cx) ** 2);
    if (dist > cx + 0.8) return false;
    // Remove a few random edge cubes for organic feel
    if (dist > cx && Math.random() > 0.6) return false;
    return true;
}

interface CubeProps {
    position: [number, number, number];
    color: string;
}

function Cube({ position, color }: CubeProps) {
    return (
        <RoundedBox
            args={[SIZE, SIZE, SIZE]}
            radius={0.06}
            smoothness={4}
            position={position}
        >
            <meshStandardMaterial
                color={color}
                roughness={0.55}
                metalness={0.45}
            />
        </RoundedBox>
    );
}

function CubeGrid3D() {
    const groupRef = useRef<THREE.Group>(null!);

    // Generate cube data once
    const cubes = useMemo(() => {
        const result: { pos: [number, number, number]; color: string }[] = [];
        const offset = ((GRID - 1) * STEP) / 2;

        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                for (let z = 0; z < GRID; z++) {
                    if (!shouldShow(x, y, z)) continue;
                    result.push({
                        pos: [
                            x * STEP - offset,
                            y * STEP - offset,
                            z * STEP - offset,
                        ],
                        color: pickColor(),
                    });
                }
            }
        }
        return result;
    }, []);

    // Slow idle rotation
    useFrame((_, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.06;
        }
    });

    return (
        <group ref={groupRef} rotation={[0.55, -0.75, 0.15]}>
            {cubes.map((cube, i) => (
                <Cube key={i} position={cube.pos} color={cube.color} />
            ))}
        </group>
    );
}

export default function CubeGridScene() {
    return (
        <div className="w-full h-full" style={{ minHeight: '500px' }}>
            <Canvas
                dpr={[1, 1.5]}
                camera={{ position: [0, 1, 7.5], fov: 40 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent' }}
            >
                {/* Strong key light + fill + rim for visible dark cubes */}
                <ambientLight intensity={0.6} />
                <directionalLight
                    position={[8, 10, 6]}
                    intensity={2.5}
                    color="#f0f0f0"
                />
                <directionalLight
                    position={[-5, -3, 8]}
                    intensity={1.0}
                    color="#94a3b8"
                />
                {/* Rim light from behind for edge definition */}
                <directionalLight
                    position={[-3, 5, -8]}
                    intensity={1.2}
                    color="#64748b"
                />

                <CubeGrid3D />
            </Canvas>
        </div>
    );
}
