/**
 * RealisticProbeModels.tsx
 * ─────────────────────────
 * VOLUME 35 — Anatomically accurate probe models.
 *
 * Real-world dimensions used throughout:
 *   Curvilinear: footprint 55 mm wide, handle 130 mm long
 *   Linear:      footprint 42 mm wide, handle 120 mm long
 *
 * Both probes feature:
 *   - Correct geometry (not simple boxes)
 *   - Rubber grip zones
 *   - Clinical orientation notch (red, patient-right side)
 *   - Skin compression on contact (probe shifts into surface, footprint squashes)
 *   - Realistic bezier cable
 */

import React from 'react';
import * as THREE from 'three';

// ─── Shared Constants (real-world mm values) ──────────────────────────────────

const CURV = {
    footprintW: 55,    // mm — footprint width
    footprintD: 14,    // mm — footprint depth (AP)
    curveROC: 70,      // mm — radius of curvature (convex surface)
    neckH: 18,         // mm
    neckW: 30,         // mm
    handleH: 130,      // mm — handle length
    handleRtop: 16,    // mm — handle radius at top
    handleRbot: 20,    // mm — handle radius at bottom
};

const LIN = {
    footprintW: 42,    // mm
    footprintD: 12,    // mm
    footprintH: 6,     // mm
    neckH: 14,
    neckW: 24,
    handleH: 120,
    handleRtop: 14,
    handleRbot: 18,
};

// ─── Curvilinear Probe ────────────────────────────────────────────────────────

export const CurvilinearProbeHead: React.FC<{
    scale: number;
    isInContact: boolean;
    pressureLevel: number;
}> = ({ scale, isInContact, pressureLevel }) => {
    const fw  = CURV.footprintW * scale;
    const fd  = CURV.footprintD * scale;
    const roc = CURV.curveROC * scale;
    const nh  = CURV.neckH * scale;

    // Skin compression: squash footprint slightly as pressure increases
    const squash = 1.0 - pressureLevel * 0.12;

    const footColor = isInContact ? '#1e3a8a' : '#111827';
    const emissiveColor = isInContact ? '#2563eb' : '#000000';
    const emissiveIntensity = isInContact ? 0.8 + pressureLevel * 0.4 : 0;

    return (
        <group name="curvilinear-head">
            {/* Convex scanning footprint — large-radius cylinder cap */}
            <group scale={[1, squash, 1]}>
                <mesh position={[0, 0, 0]}>
                    {/* Convex surface: partial cylinder pointing forward (+Z = front) */}
                    <cylinderGeometry args={[roc, roc, fw, 64, 1, true, -Math.PI * 0.15, Math.PI * 0.3]} />
                    <meshPhysicalMaterial
                        color={footColor}
                        roughness={0.08}
                        metalness={0.7}
                        emissive={emissiveColor}
                        emissiveIntensity={emissiveIntensity}
                        clearcoat={1.0}
                        clearcoatRoughness={0.05}
                        transmission={0.25}
                        thickness={2}
                        ior={1.5}
                    />
                </mesh>
            </group>

            {/* Main housing body */}
            <mesh position={[0, -(nh * 0.5), 0]}>
                <boxGeometry args={[fw * 0.82, nh, fd * 1.1]} />
                <meshPhysicalMaterial color="#0f172a" roughness={0.25} metalness={0.15} clearcoat={0.5} />
            </mesh>

            {/* Side grips (rounded ergonomic caps) */}
            {[-1, 1].map((side) => (
                <mesh key={side} position={[side * fw * 0.44, -nh * 0.3, 0]}>
                    <capsuleGeometry args={[fd * 0.45, nh * 0.55, 24, 16]} />
                    <meshStandardMaterial color="#1e293b" roughness={0.85} />
                </mesh>
            ))}

            {/* Rubber grip band */}
            <mesh position={[0, -nh * 0.6, 0]}>
                <boxGeometry args={[fw * 0.78, nh * 0.2, fd * 1.05]} />
                <meshStandardMaterial color="#334155" roughness={0.95} />
            </mesh>

            {/* Orientation notch — RED, on patient-right side (+X) */}
            <mesh position={[fw * 0.43, -nh * 0.15, fd * 0.5]}>
                <boxGeometry args={[fw * 0.04, nh * 0.28, fd * 0.06]} />
                <meshBasicMaterial color="#ef4444" />
            </mesh>

            {/* Neck transition to handle */}
            <mesh position={[0, -(nh + CURV.neckH * scale * 0.5), 0]}>
                <cylinderGeometry args={[CURV.neckW * 0.5 * scale, fw * 0.35, CURV.neckH * scale, 32]} />
                <meshStandardMaterial color="#0f172a" roughness={0.3} />
            </mesh>

            {/* Contact glow ring */}
            {isInContact && (
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1 * scale, 0]}>
                    <ringGeometry args={[fw * 0.55, fw * 0.62, 48]} />
                    <meshBasicMaterial
                        color="#3b82f6"
                        transparent
                        opacity={0.35 + pressureLevel * 0.4}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
};

// ─── Linear Probe ─────────────────────────────────────────────────────────────

export const LinearProbeHead: React.FC<{
    scale: number;
    isInContact: boolean;
    pressureLevel: number;
}> = ({ scale, isInContact, pressureLevel }) => {
    const fw = LIN.footprintW * scale;
    const fd = LIN.footprintD * scale;
    const fh = LIN.footprintH * scale;
    const nh = LIN.neckH * scale;

    const squash = 1.0 - pressureLevel * 0.08;
    const emissiveIntensity = isInContact ? 0.7 + pressureLevel * 0.3 : 0;

    return (
        <group name="linear-head">
            {/* Flat array scanning surface */}
            <group scale={[1, squash, 1]}>
                <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[fw, fh * 0.4, fd]} />
                    <meshPhysicalMaterial
                        color={isInContact ? '#1e40af' : '#1f2937'}
                        roughness={0.06}
                        metalness={0.85}
                        emissive={isInContact ? '#1d4ed8' : '#000000'}
                        emissiveIntensity={emissiveIntensity}
                        clearcoat={1.0}
                    />
                </mesh>
            </group>

            {/* Structural housing */}
            <mesh position={[0, -fh * 0.55, 0]}>
                <boxGeometry args={[fw * 1.04, fh, fd * 1.04]} />
                <meshPhysicalMaterial color="#0f172a" roughness={0.2} metalness={0.1} clearcoat={0.3} />
            </mesh>

            {/* Side profile blocks */}
            {[-1, 1].map((side) => (
                <mesh key={side} position={[side * fw * 0.52, -fh * 0.4, 0]}>
                    <boxGeometry args={[fw * 0.06, fh * 0.9, fd * 1.02]} />
                    <meshStandardMaterial color="#1e293b" roughness={0.5} />
                </mesh>
            ))}

            {/* Orientation marker — RED on +X side */}
            <mesh position={[fw * 0.48, -fh * 0.2, fd * 0.52]}>
                <boxGeometry args={[fw * 0.04, fh * 0.5, fd * 0.06]} />
                <meshBasicMaterial color="#ef4444" />
            </mesh>

            {/* Neck transition */}
            <mesh position={[0, -(fh + nh * 0.5), 0]}>
                <cylinderGeometry args={[LIN.neckW * 0.5 * scale, fw * 0.4, nh, 32]} />
                <meshStandardMaterial color="#111827" roughness={0.3} />
            </mesh>

            {/* Contact glow */}
            {isInContact && (
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1 * scale, 0]}>
                    <ringGeometry args={[fw * 0.6, fw * 0.66, 48]} />
                    <meshBasicMaterial
                        color="#3b82f6"
                        transparent
                        opacity={0.3 + pressureLevel * 0.35}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
};

// ─── Clinical Handle (shared) ─────────────────────────────────────────────────

export const ProbeHandle: React.FC<{
    scale: number;
    probeType: 'curvilinear' | 'linear';
}> = ({ scale, probeType }) => {
    const cfg = probeType === 'curvilinear' ? CURV : LIN;
    const hH = cfg.handleH * scale;
    const rTop = cfg.handleRtop * scale;
    const rBot = cfg.handleRbot * scale;
    const headOffset = probeType === 'curvilinear'
        ? (CURV.neckH + CURV.footprintD) * scale
        : (LIN.neckH + LIN.footprintH) * scale;

    return (
        <group name="clinical-handle" position={[0, headOffset + hH * 0.5, 0]}>
            {/* Main tapered body — white clinical housing */}
            <mesh>
                <cylinderGeometry args={[rTop, rBot, hH, 48]} />
                <meshPhysicalMaterial
                    color="#f1f5f9"
                    roughness={0.22}
                    metalness={0.04}
                    clearcoat={0.9}
                    clearcoatRoughness={0.12}
                />
            </mesh>

            {/* Soft-touch grip band (lower 1/3) */}
            <mesh position={[0, -hH * 0.28, 0]}>
                <cylinderGeometry args={[rBot * 1.04, rBot * 1.06, hH * 0.32, 48]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.78} />
            </mesh>

            {/* Grip texture ribs */}
            {[-1, 0, 1].map((i) => (
                <mesh key={i} position={[0, -hH * 0.22 + i * hH * 0.07, 0]}>
                    <torusGeometry args={[rBot * 1.07, rBot * 0.06, 8, 40]} />
                    <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
                </mesh>
            ))}

            {/* Freeze/save button */}
            <mesh position={[rTop * 0.8, hH * 0.12, 0]} rotation={[0, 0, Math.PI * 0.15]}>
                <capsuleGeometry args={[rTop * 0.28, rTop * 0.55, 10, 8]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.6} />
            </mesh>

            {/* Cable exit at top of handle */}
            <mesh position={[0, hH * 0.5, 0]}>
                <cylinderGeometry args={[rTop * 0.55, rTop * 0.6, rTop * 0.5, 24]} />
                <meshStandardMaterial color="#334155" roughness={0.6} />
            </mesh>

            {/* Bezier cable drooping naturally */}
            <mesh>
                <tubeGeometry args={[
                    new THREE.QuadraticBezierCurve3(
                        new THREE.Vector3(0, hH * 0.52, 0),
                        new THREE.Vector3(0, hH * 0.9 + 30 * scale, -18 * scale),
                        new THREE.Vector3(60 * scale, hH * 1.5 + 60 * scale, -50 * scale)
                    ),
                    28, 2.5 * scale, 8, false,
                ]} />
                <meshStandardMaterial color="#1e293b" roughness={0.55} />
            </mesh>
        </group>
    );
};

// ─── Integrated Probe Assembly ────────────────────────────────────────────────

export const RealisticProbe: React.FC<{
    scale: number;
    probeType: 'curvilinear' | 'linear';
    isInContact: boolean;
    pressureLevel: number;
}> = ({ scale, probeType, isInContact, pressureLevel }) => {
    // Skin compression: shift probe into surface slightly when in contact
    const compressionY = isInContact ? -(pressureLevel * 1.5 * scale) : 0;

    return (
        <group position={[0, compressionY, 0]}>
            {probeType === 'curvilinear' ? (
                <CurvilinearProbeHead scale={scale} isInContact={isInContact} pressureLevel={pressureLevel} />
            ) : (
                <LinearProbeHead scale={scale} isInContact={isInContact} pressureLevel={pressureLevel} />
            )}
            <ProbeHandle scale={scale} probeType={probeType} />
        </group>
    );
};

// ─── Probe Type Selector UI ───────────────────────────────────────────────────

export const ProbeTypeSelector: React.FC<{
    currentType: string;
    onSelect: (type: 'curvilinear' | 'linear') => void;
}> = ({ currentType, onSelect }) => {
    const btnBase: React.CSSProperties = {
        padding: '10px 18px',
        borderRadius: '8px',
        color: '#f8fafc',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        letterSpacing: '0.5px',
    };

    const active: React.CSSProperties = {
        ...btnBase,
        background: '#3b82f6',
        border: '1px solid #60a5fa',
        boxShadow: '0 0 12px rgba(59,130,246,0.35)',
    };

    const inactive: React.CSSProperties = {
        ...btnBase,
        background: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
    };

    return (
        <div style={{ display: 'flex', gap: '10px' }}>
            <button style={currentType === 'curvilinear' ? active : inactive} onClick={() => onSelect('curvilinear')}>
                CURVILINEAR
            </button>
            <button style={currentType === 'linear' ? active : inactive} onClick={() => onSelect('linear')}>
                LINEAR
            </button>
        </div>
    );
};
