import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '@/store/useAppStore';

interface GhostOverlayProps {
    scale: number;
}

/**
 * GhostOverlay
 * ------------
 * Provides subtle proximity guidance for major organs.
 * Only active in Beginner and Intermediate (when hint is on) modes.
 */
export const GhostOverlay: React.FC<GhostOverlayProps> = ({ scale }) => {
    const { probePos, visualizationSettings } = useAppStore();
    const groupRef = useRef<THREE.Group>(null);

    // Only show if guidance is enabled (Beginner mode or Intermediate Hint)
    if (!visualizationSettings.showGuidance) return null;

    // Default major organ locations (relative to CT center in mm)
    // In a real system, these would come from the volume segmentation metadata
    const organs = [
        { name: 'Liver', pos: [60, -20, 10], color: '#ef4444' },
        { name: 'Right Kidney', pos: [80, 40, -30], color: '#10b981' },
        { name: 'Left Kidney', pos: [-80, 40, -30], color: '#10b981' },
        { name: 'Spleen', pos: [-70, -10, 20], color: '#8b5cf6' },
        { name: 'Gallbladder', pos: [30, -30, 40], color: '#f59e0b' },
        { name: 'Aorta', pos: [0, 20, -10], color: '#ef4444' },
    ];

    return (
        <group ref={groupRef}>
            {organs.map((organ) => (
                <OrganGhost
                    key={organ.name}
                    name={organ.name}
                    position={[organ.pos[0] * scale, organ.pos[1] * scale, organ.pos[2] * scale]}
                    color={organ.color}
                    probePos={probePos}
                    scale={scale}
                />
            ))}
        </group>
    );
};

interface OrganGhostProps {
    name: string;
    position: [number, number, number];
    color: string;
    probePos: { x: number; y: number; z: number };
    scale: number;
}

const OrganGhost: React.FC<OrganGhostProps> = ({ name, position, color, probePos, scale }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const textRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!meshRef.current) return;

        // Calculate distance to probe
        const dx = probePos.x * scale - position[0];
        const dy = probePos.y * scale - position[1];
        const dz = probePos.z * scale - position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Proximity threshold: 60mm
        const threshold = 60 * scale;
        const opacity = Math.max(0, 1 - dist / threshold);

        // Update visibility/opacity
        meshRef.current.visible = opacity > 0.01;
        (meshRef.current.material as THREE.MeshStandardMaterial).opacity = opacity * 0.15;
        
        if (textRef.current) {
            textRef.current.visible = opacity > 0.3;
            // Face the camera
            textRef.current.quaternion.copy(state.camera.quaternion);
        }
    });

    return (
        <group position={position}>
            <mesh ref={meshRef}>
                <sphereGeometry args={[15 * scale, 32, 32]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.5}
                    transparent
                    opacity={0}
                    depthWrite={false}
                />
            </mesh>
            
            <group ref={textRef}>
                <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                    <Text
                        position={[0, 20 * scale, 0]}
                        fontSize={8 * scale}
                        color="white"
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.5 * scale}
                        outlineColor="black"
                    >
                        {name}
                    </Text>
                </Float>
            </group>
        </group>
    );
};
