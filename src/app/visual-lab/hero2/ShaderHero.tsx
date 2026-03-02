import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshDistortMaterial, useTexture, useVideoTexture } from '@react-three/drei';
import * as THREE from 'three';

/*
  Using meshStandardMaterial (proven stable) + Environment map reflections.
  No transmission, no iridescence, no clearcoat — just metallic + env reflections.
  Premium look via dark chrome material + colored lighting.
*/

const TOOL_CONFIGS = {
  opencode: { color: new THREE.Color('#1e1e3a'), roughness: 0.08, distort: 0, speed: 0, rotSpeed: 0.15 },
  claude: { color: new THREE.Color('#381b4d'), roughness: 0.25, distort: 0.7, speed: 4, rotSpeed: 0.3 },
  codex: { color: new THREE.Color('#13312c'), roughness: 0.02, distort: 0, speed: 0, rotSpeed: -0.1 }
};

function MainShapes({ activeTool = 'opencode' }: { activeTool?: string }) {
  const opencodeRef = useRef<THREE.Mesh>(null!);
  const claudeRef = useRef<THREE.Mesh>(null!);
  const codexRef = useRef<THREE.Mesh>(null!);

  const opencodeMat = useRef<THREE.MeshStandardMaterial>(null!);
  const claudeMat = useRef<any>(null!);
  const codexMat = useRef<THREE.MeshStandardMaterial>(null!);

  const groupRef = useRef<THREE.Group>(null!);
  const currentRotSpeed = useRef(0.15);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const config = TOOL_CONFIGS[activeTool as keyof typeof TOOL_CONFIGS] || TOOL_CONFIGS.opencode;

    // Smoothly scale active tools in, inactive tools out
    for (const [tool, ref] of [['opencode', opencodeRef], ['claude', claudeRef], ['codex', codexRef]] as const) {
      if (ref.current) {
        const targetScale = activeTool === tool ? 1 : 0.001; // Can't be exactly 0 to avoid matrix singularity
        ref.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      }
    }

    // Distort variables for Claude only
    if (claudeMat.current) {
      claudeMat.current.distort = THREE.MathUtils.lerp(claudeMat.current.distort, config.distort, 0.05);
      claudeMat.current.speed = THREE.MathUtils.lerp(claudeMat.current.speed, config.speed, 0.05);
    }

    // Dynamic group rotation
    currentRotSpeed.current = THREE.MathUtils.lerp(currentRotSpeed.current, config.rotSpeed, 0.02);
    groupRef.current.rotation.y += currentRotSpeed.current * delta * 5;
    groupRef.current.rotation.x = Math.sin(t * 0.1) * 0.1;

    // Manual floating animation
    groupRef.current.position.y = Math.sin(t * 1.5) * 0.1;
  });

  return (
    <group ref={groupRef} scale={0.6}>
      {/* OPENCODE: Sleek Torus Knot */}
      <mesh ref={opencodeRef} visible={activeTool === 'opencode' || opencodeRef.current?.scale.x > 0.01}>
        <torusKnotGeometry args={[1, 0.35, 128, 32, 2, 3]} />
        <meshStandardMaterial ref={opencodeMat} color={TOOL_CONFIGS.opencode.color} roughness={0.08} metalness={0.95} envMapIntensity={2.5} transparent opacity={1} />
      </mesh>

      {/* CLAUDE: Fluid Distort Blob */}
      <mesh ref={claudeRef} visible={activeTool === 'claude' || claudeRef.current?.scale.x > 0.01}>
        <sphereGeometry args={[1, 128, 128]} />
        <MeshDistortMaterial ref={claudeMat} color={TOOL_CONFIGS.claude.color} roughness={0.25} metalness={0.95} envMapIntensity={2.5} distort={0} speed={0} transparent opacity={1} />
      </mesh>

      {/* CODEX: Sharp Edged Icosahedron */}
      <mesh ref={codexRef} visible={activeTool === 'codex' || codexRef.current?.scale.x > 0.01}>
        <icosahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial ref={codexMat} color={TOOL_CONFIGS.codex.color} roughness={0.1} metalness={0.9} envMapIntensity={2.5} flatShading transparent opacity={1} />
      </mesh>
    </group>
  );
}

function AnimatedOrb({ pos, s, index, activeTool = 'opencode' }: { pos: [number, number, number], s: number, index: number, activeTool?: string }) {
  const ref = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);

  // Mix of static textures and video textures (muted to allow autoplay)
  const tex0 = useVideoTexture('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', { crossOrigin: 'Anonymous', muted: true, loop: true }) as THREE.Texture;
  const tex1 = useTexture('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=512&auto=format&fit=crop') as THREE.Texture;
  const tex2 = useTexture('https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=512&auto=format&fit=crop') as THREE.Texture;
  const tex3 = useVideoTexture('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', { crossOrigin: 'Anonymous', muted: true, loop: true }) as THREE.Texture;

  const textures = [tex0, tex1, tex2, tex3];
  const activeTexture = textures[index % 4];

  // Tint colors for the media based on tools
  const ORB_COLORS = {
    opencode: ['#8b5cf6', '#0ea5e9', '#6d28d9', '#06b6d4'],
    claude: ['#d946ef', '#f43f5e', '#f59e0b', '#ec4899'],
    codex: ['#10b981', '#3b82f6', '#14b8a6', '#84cc16']
  };

  // Calculate initial angles based on assigned pos
  const initialRadius = Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2]);
  const initialAngle = Math.atan2(pos[2], pos[0]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Orbiting motion around the center
    const orbitSpeed = 0.5 + index * 0.2;
    const angle = initialAngle + t * orbitSpeed;

    // Elliptical/wobbly orbit
    ref.current.position.x = Math.cos(angle) * (initialRadius + Math.sin(t * 2 + index) * 0.2);
    ref.current.position.z = Math.sin(angle) * (initialRadius + Math.cos(t * 1.5 + index) * 0.2);
    ref.current.position.y = pos[1] + Math.sin(t * (2 + index * 0.5)) * 0.3;

    // Slowly rotate the orb itself
    ref.current.rotation.y += 0.01;
    ref.current.rotation.x += 0.005;

    if (matRef.current) {
      const themeColors = ORB_COLORS[activeTool as keyof typeof ORB_COLORS] || ORB_COLORS.opencode;
      const targetColor = new THREE.Color(themeColors[index % themeColors.length]);
      // Slightly lerp color to tint the media
      matRef.current.color.lerp(targetColor, 0.05);
      matRef.current.emissive.lerp(targetColor, 0.05);
    }
  });

  return (
    <mesh ref={ref} scale={s}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        ref={matRef}
        map={activeTexture}
        color={ORB_COLORS.opencode[index]}
        emissive={ORB_COLORS.opencode[index]}
        emissiveMap={activeTexture}
        emissiveIntensity={1.5}
        toneMapped={false}
      />
    </mesh>
  );
}

function AccentOrbs({ activeTool = 'opencode' }: { activeTool?: string }) {
  return (
    <group>
      {/* Scaled down orbits to match smaller center shape */}
      {[
        { pos: [1.3, 0.4, -0.3] as [number, number, number], s: 0.1 },
        { pos: [-1.2, -0.5, 0.4] as [number, number, number], s: 0.07 },
        { pos: [0.9, -0.7, 0.6] as [number, number, number], s: 0.05 },
        { pos: [-1.4, 0.8, -0.2] as [number, number, number], s: 0.08 },
      ].map((orb, i) => (
        <AnimatedOrb key={i} {...orb} index={i} activeTool={activeTool} />
      ))}
    </group>
  );
}

function SceneLayout({ activeTool }: { activeTool?: string }) {
  const { viewport } = useThree();

  // A fixed offset based on viewport ratio is safer than pixel size on mount
  const isDesktop = typeof window !== 'undefined' ? window.innerWidth > 1024 : false;
  const offsetX = isDesktop ? 2.2 : 0; // Fixed world-space offset to the right

  return (
    <group position={[offsetX, 0, 0]}>
      {/* Colored lighting for visual richness */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#6d28d9" />
      <pointLight position={[2, -2, 3]} intensity={0.6} color="#0ea5e9" />
      <pointLight position={[-2, 3, 1]} intensity={0.4} color="#8b5cf6" />

      <MainShapes activeTool={activeTool} />
      <AccentOrbs activeTool={activeTool} />
    </group>
  );
}

export default function ShaderHero({ activeTool = 'opencode' }: { activeTool?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 w-full h-full min-h-screen">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 42 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Environment preset="city" background={false} />
          <SceneLayout activeTool={activeTool} />
        </Suspense>
      </Canvas>
    </div>
  );
}
