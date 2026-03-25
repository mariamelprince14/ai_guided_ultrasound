import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Center } from '@react-three/drei';
import * as THREE from 'three';
import type { ProbePose } from '@/types';
import styles from './VolumeViewer.module.css';

interface VolumeViewerProps {
    pose: ProbePose;
}

const VolumeScene: React.FC<{ pose: ProbePose }> = ({ pose }) => {
    const planeRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (planeRef.current) {
            // Map pose to 3D space
            // Position
            planeRef.current.position.set(
                pose.position.x * 0.5,
                pose.position.y * 0.5,
                pose.position.z * 0.5
            );

            // Rotation (convert degrees to radians)
            planeRef.current.rotation.set(
                THREE.MathUtils.degToRad(pose.rotation.pitch),
                THREE.MathUtils.degToRad(pose.rotation.yaw),
                THREE.MathUtils.degToRad(pose.rotation.roll)
            );
        }
    });

    return (
        <group>
            {/* The "Volume" (Patient Anatomy Context) */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[8, 8, 8]} />
                <meshStandardMaterial
                    color="#4a5568"
                    wireframe
                    transparent
                    opacity={0.1}
                />
            </mesh>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[7.8, 7.8, 7.8]} />
                <meshBasicMaterial
                    color="#2d3748"
                    transparent
                    opacity={0.3}
                    depthWrite={false}
                />
            </mesh>

            {/* Internal Anatomy Sim (Spheres representing organs) */}
            <mesh position={[1, 1, 0]}>
                <sphereGeometry args={[1.5, 32, 32]} />
                <meshStandardMaterial color="#c53030" transparent opacity={0.4} />
            </mesh>
            <mesh position={[-2, -1, 1]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshStandardMaterial color="#ed8936" transparent opacity={0.4} />
            </mesh>

            {/* The Scanning Plane (Probe Slice) */}
            <mesh ref={planeRef}>
                <planeGeometry args={[4, 5]} />
                <meshStandardMaterial
                    color="#6366f1"
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.5}
                    emissive="#6366f1"
                    emissiveIntensity={0.2}
                />
                <mesh rotation={[0, 0, 0]}>
                    <ringGeometry args={[0.1, 0.2, 32]} />
                    <meshBasicMaterial color="white" />
                </mesh>
            </mesh>

            <Grid infiniteGrid sectionColor="#4a5568" cellColor="#2d3748" fadeDistance={20} />
        </group>
    );
};

export const VolumeViewer: React.FC<VolumeViewerProps> = ({ pose }) => {
    return (
        <div className={styles.container}>
            <div className={styles.overlay}>
                <span className={styles.label}>3D VOLUME CONTEXT</span>
            </div>
            <div className={styles.vtkContainer}>
                <Canvas>
                    <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50} />
                    <OrbitControls enablePan={true} enableZoom={true} minDistance={5} maxDistance={30} />

                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} />

                    <Center>
                        <VolumeScene pose={pose} />
                    </Center>
                </Canvas>
            </div>
        </div>
    );
};
