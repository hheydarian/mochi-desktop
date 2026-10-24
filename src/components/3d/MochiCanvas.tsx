import React, { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MochiModel } from './MochiModel';
import { Sparkles } from 'lucide-react';
import { useMochiStore } from '../../store/useMochiStore';

const GlassCanvasLoader: React.FC = () => {
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center p-2 rounded-full glass-orb border border-white/30 shadow-lg pointer-events-none select-none animate-spin">
        <Sparkles className="w-4 h-4 text-pink-300" />
      </div>
    </Html>
  );
};

// Super-lightweight zero-GPU procedural radial gradient contact shadow
const ZeroCostShadow: React.FC = () => {
  const shadowTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(15, 8, 28, 0.7)');
      gradient.addColorStop(0.35, 'rgba(25, 12, 40, 0.35)');
      gradient.addColorStop(0.7, 'rgba(30, 15, 50, 0.08)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }, []);

  if (!shadowTexture) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
      <planeGeometry args={[1.4, 1.4]} />
      <meshBasicMaterial
        map={shadowTexture}
        transparent
        opacity={0.78}
        depthWrite={false}
      />
    </mesh>
  );
};

interface MochiCanvasProps {
  isHovered?: boolean;
  onMascotClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const MochiCanvas: React.FC<MochiCanvasProps> = ({
  onMascotClick,
  onContextMenu,
}) => {
  const mascotOpacity = useMochiStore((state) => state.mascotOpacity);
  const isWindowVisible = useMochiStore((state) => state.isWindowVisible);

  return (
    <div
      onClick={onMascotClick}
      onContextMenu={onContextMenu}
      className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing bg-transparent transition-opacity duration-200"
      style={{ opacity: mascotOpacity }}
    >
      <Canvas
        // Hardware VSync synchronized loop when visible; strictly frozen (0.0% CPU/GPU) when hidden
        frameloop={isWindowVisible ? 'always' : 'never'}
        camera={{ position: [0, 0, 2.75], fov: 40 }}
        gl={{
          alpha: true,
          antialias: false, // Huge performance boost; 10k tris are silky smooth without AA overhead
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        dpr={[1, 1.25]} // Cap DPR to prevent high-DPI fillrate choke
        className="w-full h-full !bg-transparent"
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        {/* Streamlined Studio Lighting (2 directional lights + 1 ambient = 50% fewer shader calculations) */}
        <ambientLight intensity={1.3} color="#fffaf5" />
        <directionalLight position={[2.5, 3.5, 2.5]} intensity={2.0} color="#fff3ea" />
        <directionalLight position={[-2.0, 2.0, -2.0]} intensity={1.1} color="#f472b6" />

        {/* Real 3D Mochi Model inside Suspense */}
        <Suspense fallback={<GlassCanvasLoader />}>
          <MochiModel />
          <ZeroCostShadow />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default MochiCanvas;
