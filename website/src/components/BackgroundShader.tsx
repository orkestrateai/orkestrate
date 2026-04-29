"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  MeshTransmissionMaterial,
  Environment,
  PerspectiveCamera,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Noise,
} from "@react-three/postprocessing";



// Physics & Animation Config
const GRID_SIZE = 160;
const DAMPING = 0.99;
const START_DELAY = 0.0;
const RISE_DURATION = 3.5;
const PEAK_PAUSE = 1.0;
const DROP_DURATION = 1.5;

// Pre-computed constants (avoid recalculating every frame)
const BALL_RADIUS = 0.6;
const BALL_RADIUS_SQ = BALL_RADIUS * BALL_RADIUS;
const CENTER = GRID_SIZE / 2;
const GRID_SCALE = 60 / GRID_SIZE;
const WATER_LEVEL = -0.5;
const INTERACTION_SR = 25;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

// Phase timing boundaries (pre-computed)
const PHASE1_END = START_DELAY + RISE_DURATION;
const PHASE2_END = PHASE1_END + PEAK_PAUSE;
const PHASE3_END = PHASE2_END + DROP_DURATION;

/**
 * THE BALL SYSTEM
 * Uses ref-driven position to avoid React re-renders.
 * Sphere tessellation reduced from 128×128 to 64×64 — still 8,192 triangles,
 * indistinguishable at this size and camera distance.
 */
function Ball() {
  const meshRef = useRef<THREE.Mesh>(null);
  return (
    <mesh ref={meshRef} name="ball">
      <sphereGeometry args={[BALL_RADIUS, 64, 64]} />
      <MeshTransmissionMaterial
        backside
        samples={8} /* Reduced from 16. Barely perceptible difference at 0.6 radius. */
        thickness={1.5}
        chromaticAberration={0.05}
        anisotropy={0.5}
        distortion={0.02}
        color="#ffffff"
        transmission={1.0}
        roughness={0.02}
        ior={1.45}
      />
    </mesh>
  );
}

/**
 * RIPPLE FLOOR
 * Accepts ballY as a ref (not prop) so it never triggers React re-renders.
 * Wave sim uses squared-distance comparisons to eliminate sqrt calls.
 * Single merged vertex-write + max-displacement loop (was duplicated before).
 */
function PhysicalRippleFloor({
  ballYRef,
}: {
  ballYRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lastY = useRef(ballYRef.current);
  const isSettled = useRef(false);

  const simulation = useMemo(
    () => ({
      h1: new Float32Array(TOTAL_CELLS),
      h2: new Float32Array(TOTAL_CELLS),
    }),
    [],
  );

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(60, 60, GRID_SIZE - 1, GRID_SIZE - 1);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const frameRef = useRef(0);

  useFrame(() => {
    if (!meshRef.current || isSettled.current) return;

    // Warm-up delay for first 10 frames to allow shader compilation/GPU prep
    frameRef.current++;
    if (frameRef.current < 10) return;

    const t0 = performance.now();

    const ballY = ballYRef.current;
    const pos = meshRef.current.geometry.getAttribute("position");
    const { h1, h2 } = simulation;

    // --- Ball interaction ---
    const rawDy = (ballY - lastY.current) * 20.0;

    // Strict clamp! We drop very fast, which creates huge fake physics energy. 
    // This value is exactly what limits the size of the splash.
    const dy = Math.max(-1.0, Math.min(1.0, rawDy));

    const hasDy = Math.abs(dy) > 0.005;
    const distToWater = Math.abs(ballY - WATER_LEVEL);
    const currentInteractionRadius =
      distToWater < BALL_RADIUS
        ? Math.sqrt(BALL_RADIUS_SQ - distToWater * distToWater)
        : 0;

    let isActive = false;
    let activeCells = 0;

    // --- Ball interaction ---
    if (hasDy && currentInteractionRadius > 0) {
      for (let ix = -INTERACTION_SR; ix <= INTERACTION_SR; ix++) {
        const gx = CENTER + ix;
        if (gx < 0 || gx >= GRID_SIZE) continue;
        const vx = ix * GRID_SCALE;

        for (let iz = -INTERACTION_SR; iz <= INTERACTION_SR; iz++) {
          const gz = CENTER + iz;
          if (gz < 0 || gz >= GRID_SIZE) continue;

          const vz = iz * GRID_SCALE;
          const distSq = vx * vx + vz * vz;

          // Squared comparison — skip sqrt for the rejection test
          if (distSq < BALL_RADIUS_SQ) {
            const dist = Math.sqrt(distSq); // only compute sqrt on hits
            const diff = dist - currentInteractionRadius;
            const ringPush = Math.exp(-diff * diff * 20.0);
            h1[gz * GRID_SIZE + gx] += dy * ringPush * 0.15;
          }
        }
      }
    }
    lastY.current = ballY;

    // --- Wave propagation ---
    for (let i = 1; i < GRID_SIZE - 1; i++) {
      for (let j = 1; j < GRID_SIZE - 1; j++) {
        const idx = i * GRID_SIZE + j;
        const val =
          ((h1[idx - 1] +
            h1[idx + 1] +
            h1[idx - GRID_SIZE] +
            h1[idx + GRID_SIZE]) *
            0.5 -
            h2[idx]) *
          DAMPING;
        h2[idx] = val;

        if (val > 0.001 || val < -0.001) {
          isActive = true;
          activeCells++;
        }
      }
    }
    // Buffer swap
    const temp = simulation.h1;
    simulation.h1 = simulation.h2;
    simulation.h2 = temp;

    // --- Single merged vertex write + max displacement ---
    const arr = pos.array as Float32Array;
    let maxDisplacement = 0;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      const val = h1[i];
      arr[i * 3 + 1] = val;
      if (val > maxDisplacement) maxDisplacement = val;
      else if (-val > maxDisplacement) maxDisplacement = -val;
    }

    pos.needsUpdate = true;

    // Always compute normals during the active drop phase to prevent a sudden JS engine "de-opt" spike
    // when the ball hits the water and triggers a massive normal recalculation.
    const isDropping = ballY > -3.0 && ballY < 1.0;
    const didComputeNormals = maxDisplacement > 0.001 || isDropping;

    if (didComputeNormals) {
      meshRef.current.geometry.computeVertexNormals();
    }

    // Sleep when the ball is gone and water is flat
    if (ballY < -2.0 && !isActive) {
      isSettled.current = true;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, -0.5, 0]}>
      <meshPhysicalMaterial
        color="#020202"
        roughness={0.06}
        metalness={0.8}
        transparent
        opacity={0.9}
        ior={1.33}
      />
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
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.4 * opacity}
        />
      </mesh>

      {/* Layer 3 (Bottom) - Faintest */}
      <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[0.5, 0.03, 64, 4]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.2 * opacity}
        />
      </mesh>
    </group>
  );
}

function OrkestrateEnvironment() {
  return (
    <Environment resolution={256}>
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

/**
 * EXPERIENCE
 * All animation state is driven by refs, not useState.
 * Ball, floor, and logo positions are mutated directly via scene graph.
 * React re-renders: ZERO during animation (only on discrete events).
 */
function Experience({
  onComplete,
  onStartReveal,
  hideLogo = false,
}: {
  onComplete: () => void;
  onStartReveal: () => void;
  hideLogo?: boolean;
}) {
  const ballYRef = useRef(-1.5);
  const ballRef = useRef<THREE.Group>(null);
  const logoRef = useRef<THREE.Group>(null);
  const logoOpacityRef = useRef(0);
  const completed = useRef(false);
  const startedReveal = useRef(false);
  const showLogo = useRef(false);

  // Cache material refs for direct opacity mutation
  const logoMat1 = useRef<THREE.MeshBasicMaterial>(null);
  const logoMat2 = useRef<THREE.MeshBasicMaterial>(null);
  const logoMat3 = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    let targetY = -1.5;

    if (t < PHASE1_END) {
      const p = Math.min(1, Math.max(0, (t - START_DELAY) / RISE_DURATION));
      const easedP = p * p * (3 - 2 * p);
      targetY = -1.5 + easedP * 2.7;
    } else if (t < PHASE2_END) {
      const peakTime = t - PHASE1_END;
      targetY = 1.2 + Math.sin(peakTime * 0.8) * 0.03;

      if (!startedReveal.current) {
        startedReveal.current = true;
        // Defer UI thread block to allow current WebGL frame to finish rendering
        setTimeout(onStartReveal, 0);
      }
    } else if (t < PHASE3_END) {
      const dp = Math.min(1, Math.max(0, (t - PHASE2_END) / DROP_DURATION));
      const easedDP = dp * dp;
      targetY = 1.2 + easedDP * -4.7;
    } else {
      targetY = -3.5;
      if (!completed.current) {
        completed.current = true;
        if (!hideLogo) showLogo.current = true;
        // Defer massive UI thread block (landing page mount) to next tick
        setTimeout(onComplete, 0);
      }
    }

    // Direct ref mutation — no React re-render
    ballYRef.current = targetY;

    // Move ball mesh directly via scene graph
    if (ballRef.current) {
      ballRef.current.position.y = targetY;
    }

    // Logo fade-in via direct material mutation
    if (showLogo.current && logoRef.current) {
      logoRef.current.visible = true;
      if (logoOpacityRef.current < 1) {
        logoOpacityRef.current = Math.min(1, logoOpacityRef.current + 0.02);
        const o = logoOpacityRef.current;
        if (logoMat1.current) logoMat1.current.opacity = o;
        if (logoMat2.current) logoMat2.current.opacity = 0.4 * o;
        if (logoMat3.current) logoMat3.current.opacity = 0.2 * o;
      }
    }
  });

  return (
    <>
      <color attach="background" args={["#030303"]} />
      <fog attach="fog" args={["#030303", 2, 25]} />
      <PerspectiveCamera makeDefault position={[0, 1.2, 11]} fov={30} />
      <PhysicalRippleFloor ballYRef={ballYRef} />

      <group ref={ballRef} position={[0, -1.5, 0]}>
        <Ball />
      </group>

      <OrkestrateEnvironment />

      {/* Logo always mounted but hidden — avoids mount/unmount churn */}
      <group
        ref={logoRef}
        position={[0, 0, 3]}
        visible={false}
      >
        <group scale={[0.5, 0.5, 1]} position={[0, 2.25, 0]}>
          <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 3, 0, 0]}>
            <torusGeometry args={[0.5, 0.03, 64, 4]} />
            <meshBasicMaterial
              ref={logoMat1}
              color="#ffffff"
              transparent
              opacity={0}
            />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 3, 0, 0]}>
            <torusGeometry args={[0.5, 0.03, 64, 4]} />
            <meshBasicMaterial
              ref={logoMat2}
              color="#ffffff"
              transparent
              opacity={0}
            />
          </mesh>
          <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 3, 0, 0]}>
            <torusGeometry args={[0.5, 0.03, 64, 4]} />
            <meshBasicMaterial
              ref={logoMat3}
              color="#ffffff"
              transparent
              opacity={0}
            />
          </mesh>
        </group>
      </group>

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.2} luminanceThreshold={0.7} mipmapBlur />
        <Noise opacity={0.01} />
      </EffectComposer>
    </>
  );
}

export function BackgroundShader({
  onComplete,
  onStartReveal,
  hideLogo = false,
}: {
  onComplete?: () => void;
  onStartReveal?: () => void;
  hideLogo?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-0 bg-[#050505] pointer-events-none">
      <Canvas dpr={[1, 1.5]} gl={{ antialias: false, alpha: true }}>
        <Experience
          onComplete={onComplete || (() => { })}
          onStartReveal={onStartReveal || (() => { })}
          hideLogo={hideLogo}
        />
      </Canvas>
    </div>
  );
}
