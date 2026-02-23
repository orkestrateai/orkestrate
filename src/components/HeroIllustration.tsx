'use client';

import React from 'react';

// ─────────────────────────────────────────────
// Core Isometric Math
// ─────────────────────────────────────────────
const ISO_ANGLE = Math.PI / 6; // 30°
const CX = Math.cos(ISO_ANGLE); // ≈ 0.866
const SX = Math.sin(ISO_ANGLE); // 0.5

/** Converts 3D space coordinates to 2D screen coordinates */
function iso(x: number, y: number, z = 0) {
    return {
        x: (x - y) * CX,
        y: (x + y) * SX - z,
    };
}

/** Polygon point-string helper */
function pts(...pairs: [number, number][]) {
    return pairs.map(([x, y]) => `${x},${y}`).join(' ');
}

// ─────────────────────────────────────────────
// High-End Structural Primitives
// ─────────────────────────────────────────────

const IsoSlab = ({
    x, y, z = 0, w, h, d,
    fill = '#030303',
    edgeFill = '#000000',
    stroke = 'rgba(255,255,255,0.25)',
    lightEdge = 'rgba(255,255,255,0.6)',
    innerEtch = false,
}: {
    x: number; y: number; z?: number; w: number; h: number; d: number;
    fill?: string; edgeFill?: string; stroke?: string; lightEdge?: string; innerEtch?: boolean;
}) => {
    const t1 = iso(x, y, z + d);
    const t2 = iso(x + w, y, z + d);
    const t3 = iso(x + w, y + h, z + d);
    const t4 = iso(x, y + h, z + d);
    const b2 = iso(x + w, y, z);
    const b3 = iso(x + w, y + h, z);
    const b4 = iso(x, y + h, z);

    return (
        <g>
            <polygon
                points={pts([t4.x, t4.y], [t3.x, t3.y], [b3.x, b3.y], [b4.x, b4.y])}
                fill={edgeFill} stroke={stroke} strokeWidth={0.5} strokeLinejoin="round"
            />
            <polygon
                points={pts([t2.x, t2.y], [t3.x, t3.y], [b3.x, b3.y], [b2.x, b2.y])}
                fill={edgeFill} stroke={stroke} strokeWidth={0.5} strokeLinejoin="round"
            />
            <polygon
                points={pts([t1.x, t1.y], [t2.x, t2.y], [t3.x, t3.y], [t4.x, t4.y])}
                fill={fill} stroke={stroke} strokeWidth={1} strokeLinejoin="round"
            />
            <polyline
                points={pts([t4.x, t4.y], [t1.x, t1.y], [t2.x, t2.y])}
                stroke={lightEdge} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round"
            />
            {innerEtch && (
                <IsoPlane x={x + 4} y={y + 4} z={z + d}>
                    <rect
                        width={w - 8} height={h - 8}
                        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4 3"
                    />
                </IsoPlane>
            )}
        </g>
    );
};

const IsoPlane = ({ x, y, z = 0, children, opacity = 1 }: { x: number; y: number; z?: number; children: React.ReactNode; opacity?: number }) => {
    const pos = iso(x, y, z);
    return (
        <g opacity={opacity} transform={`translate(${pos.x}, ${pos.y}) matrix(${CX}, ${SX}, ${-CX}, ${SX}, 0, 0)`}>
            {children}
        </g>
    );
};

// ─────────────────────────────────────────────
// Wiring, Nodes & Data Paths
// ─────────────────────────────────────────────

const GroundNode = ({ x, y, zRise = 0, color = "#34d399" }: { x: number; y: number; zRise?: number; color?: string }) => {
    const floor = iso(x, y, 0);
    const top = iso(x, y, zRise);

    return (
        <g>
            <circle cx={floor.x} cy={floor.y} r={10} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
            <circle cx={floor.x} cy={floor.y} r={6} fill="none" stroke={color} strokeWidth={1} opacity={0.6} />
            <circle cx={floor.x} cy={floor.y} r={2.5} fill="#fff" filter="url(#glowAccent)" />
            {zRise > 0 && (
                <line
                    x1={floor.x} y1={floor.y} x2={top.x} y2={top.y}
                    stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="3 3"
                />
            )}
            {zRise > 0 && (
                <circle cx={top.x} cy={top.y} r={2} fill="rgba(255,255,255,0.5)" />
            )}
        </g>
    );
};

const FloorPath = ({ path, delay = "0s" }: { path: number[][], delay?: string }) => {
    const floorPoints = path.map(p => iso(p[0], p[1], 0));
    const pathData = "M " + floorPoints.map(pt => `${pt.x},${pt.y}`).join(" L ");

    return (
        <g>
            <path d={pathData} stroke="rgba(255,255,255,0.15)" strokeWidth={1} fill="none" strokeLinejoin="bevel" />
            <circle r={2.5} fill="#fff" filter="url(#glowAccent)">
                <animateMotion dur="4s" repeatCount="indefinite" path={pathData} begin={delay} />
            </circle>
        </g>
    );
};

// ─────────────────────────────────────────────
// Complex Architectural Elements
// ─────────────────────────────────────────────

const GroundGrid = () => {
    const lines = [];
    const STEP = 50;
    for (let v = -800; v <= 800; v += STEP) {
        const major = v % 200 === 0;
        const opac = major ? 0.05 : 0.015;
        const a = iso(v, -800, 0); const b = iso(v, 800, 0);
        const c = iso(-800, v, 0); const d = iso(800, v, 0);
        lines.push(<line key={`x${v}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={`rgba(255,255,255,${opac})`} strokeWidth={1} />);
        lines.push(<line key={`y${v}`} x1={c.x} y1={c.y} x2={d.x} y2={d.y} stroke={`rgba(255,255,255,${opac})`} strokeWidth={1} />);
    }
    return <g>{lines}</g>;
};

const CenterHub = () => {
    return (
        <g>
            <IsoPlane x={-180} y={-180} z={0}>
                <rect width={360} height={360} fill="none" stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                <rect x={20} y={20} width={320} height={320} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.15)" />
            </IsoPlane>

            <IsoSlab x={-150} y={-150} z={0} w={300} h={300} d={4} fill="#020202" />
            <IsoSlab x={-120} y={-120} z={10} w={240} h={160} d={8} fill="#050505" stroke="rgba(255,255,255,0.3)" />
            <IsoSlab x={-120} y={40} z={10} w={140} h={80} d={8} fill="#050505" stroke="rgba(255,255,255,0.3)" />
            <IsoSlab x={-80} y={-80} z={24} w={160} h={160} d={10} fill="#080808" stroke="rgba(255,255,255,0.4)" lightEdge="rgba(255,255,255,0.8)" innerEtch />

            <IsoPlane x={0} y={0} z={36}>
                <g stroke="#34d399" strokeWidth={5} strokeLinecap="round" filter="url(#glowAccent)">
                    <line x1={0} y1={-28} x2={0} y2={28} />
                    <line x1={-28} y1={0} x2={28} y2={0} />
                    <line x1={-20} y1={-20} x2={20} y2={20} />
                    <line x1={-20} y1={20} x2={20} y2={-20} />
                    <circle cx={0} cy={0} r={5} fill="#fff" stroke="#34d399" strokeWidth={3} />
                </g>
            </IsoPlane>
        </g>
    );
};

// ─────────────────────────────────────────────
// UI Node Components
// ─────────────────────────────────────────────

const AgentCard = ({ x, y, z, label, icon, iconUrl }: { x: number; y: number; z: number; label: string; icon?: React.ReactNode; iconUrl?: string }) => (
    <g>
        <IsoSlab x={x} y={y} z={z} w={160} h={54} d={4} fill="#020202" innerEtch />
        <IsoPlane x={x} y={y} z={z + 4.5}>
            <g transform="translate(16, 27)">
                <g transform="translate(0, -10)">
                    <path d="M0,4 L10,0 L20,4 L20,16 L10,20 L0,16 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeLinejoin="round" />
                    <g transform="translate(5, 5)">
                        {iconUrl ? (
                            <image href={iconUrl} width="10" height="10" preserveAspectRatio="xMidYMid meet" />
                        ) : (
                            <g transform="scale(0.5)">{icon}</g>
                        )}
                    </g>
                </g>
                <text x={34} y={4} fill="#f4f4f5" fontSize={14} fontWeight={500} letterSpacing="0.02em" fontFamily="system-ui, sans-serif">{label}</text>
            </g>
        </IsoPlane>
    </g>
);

const ServerBox = ({ x, y, z, label, type = 'solid' }: { x: number; y: number; z: number; label: string; type?: 'solid' | 'stacked' }) => {
    return (
        <g>
            {type === 'stacked' ? (
                <g>
                    <IsoSlab x={x} y={y} z={z} w={140} h={100} d={6} fill="#050505" />
                    <IsoSlab x={x} y={y} z={z + 10} w={140} h={100} d={6} fill="#050505" />
                    <IsoSlab x={x} y={y} z={z + 20} w={140} h={100} d={6} fill="#050505" innerEtch />
                </g>
            ) : (
                <g>
                    <IsoSlab x={x} y={y} z={z} w={140} h={100} d={26} fill="#030303" innerEtch />
                    <IsoPlane x={x + 140} y={y} z={z}>
                        <rect x={0} y={0} width={26} height={100} fill="none" />
                        {[10, 30, 50, 70, 90].map(vy => (
                            <line key={vy} x1={0} y1={vy} x2={26} y2={vy} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                        ))}
                    </IsoPlane>
                </g>
            )}

            <IsoPlane x={x + 70} y={y + 50} z={z + (type === 'stacked' ? 26 : 26)}>
                <rect x={-20} y={-30} width={40} height={20} rx={4} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
                <text x={0} y={15} fill="#a1a1aa" fontSize={12} fontWeight={600} letterSpacing="0.1em" textAnchor="middle">{label}</text>
            </IsoPlane>
        </g>
    );
};

const FlatPill = ({ x, y, label }: { x: number; y: number; label: string }) => (
    <IsoPlane x={x} y={y} z={0}>
        <rect x={0} y={0} width={140} height={40} rx={20} fill="rgba(0,0,0,0.8)" stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} strokeDasharray="4 4" />
        <rect x={4} y={4} width={132} height={32} rx={16} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
        <text x={70} y={24} fill="#a1a1aa" fontSize={11} fontWeight={600} letterSpacing="0.1em" textAnchor="middle">{label}</text>
    </IsoPlane>
);

// ─────────────────────────────────────────────
// Main Exported Component
// ─────────────────────────────────────────────

export default function HeroIllustration() {
    const agents = [
        { x: -440, y: -40, z: 80, label: 'Claude Code', iconUrl: 'https://cdn.brandfetch.io/idmJWF3N06/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1721803183866' },
        { x: -360, y: 80, z: 80, label: 'OpenCode', iconUrl: 'https://cdn.brandfetch.io/id8ixWaeze/w/180/h/180/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1768205132942' },
        { x: -280, y: 200, z: 80, label: 'Codex', iconUrl: 'https://cdn.brandfetch.io/idR3duQxYl/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1749527480180' },
    ];

    const servers = [
        { x: 120, y: -300, z: 0, label: 'Shared Room', type: 'stacked' as const },
        { x: 280, y: -180, z: 0, label: 'State Sync', type: 'solid' as const },
    ];

    const pills = [
        { x: 220, y: 140, label: 'Observability' },
        { x: 340, y: 260, label: 'Realtime' },
        { x: 460, y: 380, label: 'Security' },
    ];

    const pathways = [
        [[-400, -10], [-200, -10], [-200, 0], [-150, 0]],
        [[-320, 110], [-200, 110], [-200, 0]],
        [[-240, 230], [-100, 230], [-100, 150]],
        [[150, -40], [150, -250], [190, -250]],
        [[150, 40], [150, -130], [350, -130]],
        [[100, 150], [290, 150], [290, 160]],
        [[0, 150], [0, 280], [410, 280]],
        [[-100, 150], [-100, 400], [530, 400]],
    ];

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
            {/* Radial vignette — fades edges to pure black */}
            <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 60% 50%, transparent 30%, #000 75%)' }}
            />

            <svg
                viewBox="-850 -500 1700 1200"
                className="w-full h-full max-w-none md:translate-x-64 md:translate-y-12 transition-transform duration-700"
                style={{ shapeRendering: 'geometricPrecision' }}
                preserveAspectRatio="xMidYMid slice"
            >
                <defs>
                    <filter id="glowAccent" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <GroundGrid />

                {pathways.map((path, i) => (
                    <FloorPath key={`path-${i}`} path={path} delay={`${i * 0.5}s`} />
                ))}

                {agents.map((agent, i) => (
                    <GroundNode key={`node-in-${i}`} x={agent.x + 40} y={agent.y + 30} zRise={agent.z} />
                ))}
                {servers.map((srv, i) => (
                    <GroundNode key={`node-srv-${i}`} x={srv.x + 70} y={srv.y + 50} zRise={0} color="#a1a1aa" />
                ))}
                {pills.map((pill, i) => (
                    <GroundNode key={`node-pill-${i}`} x={pill.x + 70} y={pill.y + 20} zRise={0} color="#a1a1aa" />
                ))}

                <CenterHub />

                {agents.map((agent, i) => (
                    <AgentCard key={`agent-${i}`} {...agent} />
                ))}
                {servers.map((server, i) => (
                    <ServerBox key={`server-${i}`} {...server} />
                ))}
                {pills.map((pill, i) => (
                    <FlatPill key={`pill-${i}`} {...pill} />
                ))}
            </svg>
        </div>
    );
}
