import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Environment, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ProbePose } from '@/types';
import styles from './ProbeSimulation.module.css';

interface ProbeProps {
    pose: ProbePose;
}

const ProbeMesh: React.FC<ProbeProps> = ({ pose }) => {
    const meshRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (meshRef.current) {
            // Convert pose (arbitrary units) to 3D space
            // Assuming pose.position is in cm or similar relative units
            meshRef.current.position.set(
                pose.position.x * 2,
                pose.position.y * 2,
                pose.position.z * 2
            );

            // Convert rotation (degrees) to radians
            meshRef.current.rotation.set(
                THREE.MathUtils.degToRad(pose.rotation.pitch),
                THREE.MathUtils.degToRad(pose.rotation.yaw),
                THREE.MathUtils.degToRad(pose.rotation.roll)
            );
        }
    });

    return (
        <group ref={meshRef}>
            {/* Probe Handle */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.6, 1.2, 0.4]} />
                <meshStandardMaterial color="#4a5568" roughness={0.3} metalness={0.8} />
            </mesh>

            {/* Probe Head (Curvilinear style) */}
            <mesh position={[0, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.3, 0.35, 0.2, 32, 1, false, 0, Math.PI]} />
                <meshStandardMaterial color="#2d3748" />
            </mesh>

            {/* Scanning Plane Indicator (Visual Guide) */}
            <mesh position={[0, -0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1.5, 2]} />
                <meshBasicMaterial
                    color="#6366f1"
                    transparent
                    opacity={0.15}
                    side={THREE.DoubleSide}
                />
            </mesh>

            <Html position={[0, 0.8, 0]} center>
                <div className={styles.label}>PROBE</div>
            </Html>
        </group>
    );
};

export const ProbeSimulation: React.FC<ProbeProps> = ({ pose }) => {
    return (
        <div className={styles.container}>
            <Canvas shadows>
                <PerspectiveCamera makeDefault position={[3, 3, 3]} fov={50} />
                <OrbitControls enablePan={false} enableZoom={true} />

                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                <spotLight position={[-5, 5, 0]} angle={0.3} penumbra={1} intensity={1} castShadow />

                <ProbeMesh pose={pose} />

                {/* Patient Body Surface Sim */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
                    <planeGeometry args={[10, 10]} />
                    <meshStandardMaterial color="#f7fafc" transparent opacity={0.5} />
                </mesh>

                <Grid
                    infiniteGrid
                    fadeDistance={10}
                    fadeStrength={5}
                    cellSize={1}
                    sectionSize={5}
                    sectionColor="#6366f1"
                    sectionThickness={1}
                />

                <Environment preset="city" />
            </Canvas>

            <div className={styles.hud}>
                <div className={styles.hudTitle}>3D PROBE SIMULATION</div>
                <div className={styles.poseGrid}>
                    <div className={styles.poseItem}>
                        <span>POS:</span>
                        <span>{pose.position.x.toFixed(1)}, {pose.position.y.toFixed(1)}, {pose.position.z.toFixed(1)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
