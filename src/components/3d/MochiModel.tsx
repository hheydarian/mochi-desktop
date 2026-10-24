import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Center, Sparkles } from '@react-three/drei';
import { useMochiStore, type MascotState } from '../../store/useMochiStore';
import { soundFx } from '../../utils/sound';
import { globalPointer, initGlobalCursorTracking } from '../../utils/cursor';

// Tripo models face +X by default; rotate -90° on Y to look directly at user (+Z)
const BASE_ROTATION_Y = -Math.PI / 2;

// Paths to the 4 real optimized 3D models
export const MODEL_PATHS = {
  idle: './assets/models/mochi-idle.glb',
  waving: './assets/models/mochi-waving.glb',
  alert: './assets/models/mochi-alert.glb',
  sleeping: './assets/models/mochi-sleeping.glb',
} as const;

// 1. FAST STARTUP: Only preload the idle model immediately (<0.5s launch)
useGLTF.preload(MODEL_PATHS.idle, true, true);

export function getModelPathForState(state: MascotState): string {
  switch (state) {
    case 'waving':
      return MODEL_PATHS.waving;
    case 'alert':
    case 'dragOver':
      return MODEL_PATHS.alert;
    case 'sleeping':
      return MODEL_PATHS.sleeping;
    case 'idle':
    case 'processing':
    default:
      return MODEL_PATHS.idle;
  }
}

interface ModelRendererProps {
  modelPath: string;
}

const ModelRenderer: React.FC<ModelRendererProps> = ({ modelPath }) => {
  const { scene } = useGLTF(modelPath, true, true);

  // Configure material properties for Pixar/Clay aesthetic
  useMemo(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.roughness = 0.42;
          mat.metalness = 0.04;
          mat.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  return (
    <Center key={modelPath} top={false}>
      {/* Base 90-degree yaw correction so Mochi's face points straight forward */}
      <group rotation={[0, BASE_ROTATION_Y, 0]}>
        <primitive object={scene} />
      </group>
    </Center>
  );
};

// 3D Sleep Bubble Particles that rise up and gently pop when sleeping
const SleepBubbles: React.FC = () => {
  const bubblesRef = useRef<THREE.Group>(null);
  const bubbleCount = 4;
  const bubbleData = useMemo(() => {
    return Array.from({ length: bubbleCount }, (_, i) => ({
      offsetY: i * 0.22,
      speed: 0.32 + i * 0.08,
      baseX: 0.16 + (i % 2 === 0 ? 0.06 : -0.06),
      scale: 0.035 + i * 0.016,
    }));
  }, []);

  useFrame((state) => {
    if (!bubblesRef.current) return;
    const time = state.clock.elapsedTime;
    bubblesRef.current.children.forEach((child, i) => {
      const b = bubbleData[i];
      const y = (time * b.speed + b.offsetY) % 0.85;
      child.position.y = 0.28 + y;
      child.position.x = b.baseX + Math.sin(time * 2.2 + i * 1.5) * 0.04;
      const alpha = Math.sin((y / 0.85) * Math.PI);
      const mesh = child as THREE.Mesh;
      if (mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, alpha * 0.7);
      }
    });
  });

  return (
    <group ref={bubblesRef}>
      {bubbleData.map((b, i) => (
        <mesh key={i} scale={b.scale} position={[b.baseX, 0.28 + b.offsetY, 0]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial
            color="#93c5fd"
            emissive="#60a5fa"
            emissiveIntensity={0.4}
            transparent
            opacity={0.65}
            roughness={0.12}
          />
        </mesh>
      ))}
    </group>
  );
};

export const MochiModel: React.FC = () => {
  const {
    mascotState,
    setMascotState,
    globalMouseTracking,
    autonomousMode,
    autoSleepDelay,
    mascotScale,
    animSpeed,
    soundEnabled,
  } = useMochiStore();

  const rootGroupRef = useRef<THREE.Group>(null);
  const motionGroupRef = useRef<THREE.Group>(null);
  const squashRef = useRef(0);
  const waveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth Jelly Morph State Machine
  const [displayedState, setDisplayedState] = useState<MascotState>(mascotState);
  const morphRef = useRef<{
    phase: 'idle' | 'squash' | 'pop';
    startTime: number;
    squashFactor: number;
    popFactor: number;
  }>({
    phase: 'idle',
    startTime: 0,
    squashFactor: 0,
    popFactor: 0,
  });

  const lastCursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastActiveTimeRef = useRef<number>(Date.now());
  const lastGreetTimeRef = useRef<number>(0);
  const curiousLookRef = useRef<{ targetX: number; targetY: number; nextChange: number }>({
    targetX: 0,
    targetY: 0,
    nextChange: Date.now() + 10000,
  });

  const [showSparkles, setShowSparkles] = useState(false);

  // 2. STAGGERED PRELOAD: Lazily preload remaining 3 models 1.5 seconds after initial launch
  useEffect(() => {
    const timer = setTimeout(() => {
      useGLTF.preload(MODEL_PATHS.waving, true, true);
      useGLTF.preload(MODEL_PATHS.alert, true, true);
      useGLTF.preload(MODEL_PATHS.sleeping, true, true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // 3. ZERO RE-RENDER GLOBAL POINTER TRACKING: Initialize 20Hz loop writing to globalPointer
  useEffect(() => {
    initGlobalCursorTracking(() => useMochiStore.getState().globalMouseTracking);
  }, []);

  // Speed multiplier
  const speedMult = useMemo(() => {
    switch (animSpeed) {
      case 'chill':
        return 0.72;
      case 'energetic':
        return 1.45;
      case 'normal':
      default:
        return 1.0;
    }
  }, [animSpeed]);

  // Initiate Jelly Morph when mascotState changes
  useEffect(() => {
    if (mascotState !== displayedState) {
      morphRef.current = {
        phase: 'squash',
        startTime: performance.now(),
        squashFactor: 0,
        popFactor: 0,
      };
    }
  }, [mascotState, displayedState]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
    };
  }, []);

  // Springy squash & stretch on click with temporary waving state
  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();

    squashRef.current = 1.0;
    setShowSparkles(true);
    setTimeout(() => setShowSparkles(false), 2200);

    if (soundEnabled) soundFx.boing();

    if (mascotState === 'sleeping') {
      setMascotState('idle');
      lastActiveTimeRef.current = Date.now();
    } else {
      if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
      setMascotState('waving');

      waveTimerRef.current = setTimeout(() => {
        if (useMochiStore.getState().mascotState === 'waving') {
          setMascotState('idle');
        }
      }, 2500);
    }
  };

  useFrame((state, delta) => {
    const root = rootGroupRef.current;
    const motion = motionGroupRef.current;
    if (!root || !motion) return;

    const time = state.clock.elapsedTime * speedMult;
    const now = Date.now();
    const isSleeping = displayedState === 'sleeping';
    const isProcessing = displayedState === 'processing';

    // Read directly from zero-render globalPointer object
    let targetPointerX = state.pointer.x;
    let targetPointerY = state.pointer.y;

    if (globalMouseTracking && (globalPointer.x !== 0 || globalPointer.y !== 0)) {
      targetPointerX = globalPointer.x;
      targetPointerY = -globalPointer.y;
    }

    // --- Autonomous Life Engine ---
    if (autonomousMode) {
      const movedDist = Math.hypot(
        targetPointerX - lastCursorRef.current.x,
        targetPointerY - lastCursorRef.current.y
      );

      // Mouse motion resets inactivity timer
      if (movedDist > 0.035) {
        lastActiveTimeRef.current = now;
        lastCursorRef.current = { x: targetPointerX, y: targetPointerY };

        // Wake up immediately on cursor motion
        if (mascotState === 'sleeping') {
          setMascotState('idle');
        }
      }

      // 1. Configurable Inactivity Sleep Check
      if (
        autoSleepDelay > 0 &&
        now - lastActiveTimeRef.current > autoSleepDelay &&
        mascotState === 'idle' &&
        displayedState === 'idle'
      ) {
        setMascotState('sleeping');
      }

      // 2. Proximity Greeting: cursor enters close proximity (< 0.20 distance from mascot)
      const distFromCenter = Math.hypot(targetPointerX, targetPointerY);
      if (
        distFromCenter < 0.22 &&
        mascotState === 'idle' &&
        now - lastGreetTimeRef.current > 35000
      ) {
        lastGreetTimeRef.current = now;
        setMascotState('waving');
        if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
        waveTimerRef.current = setTimeout(() => {
          if (useMochiStore.getState().mascotState === 'waving') {
            setMascotState('idle');
          }
        }, 2800);
      }

      // 3. Autonomous Curious Gazing in Idle
      if (mascotState === 'idle' && !isSleeping) {
        if (now > curiousLookRef.current.nextChange) {
          curiousLookRef.current = {
            targetX: (Math.random() - 0.5) * 0.35,
            targetY: (Math.random() - 0.5) * 0.22,
            nextChange: now + 8000 + Math.random() * 8000,
          };
        }
        targetPointerX += curiousLookRef.current.targetX;
        targetPointerY += curiousLookRef.current.targetY;
      }
    }

    // --- 1. Head and Body Rotation ---
    const headTiltZ = !isSleeping ? Math.sin(time * 0.8) * 0.08 : 0.04;
    const waddleZ = !isSleeping ? Math.sin(time * 1.6) * 0.03 : 0;

    if (!isSleeping) {
      const targetRotY = THREE.MathUtils.clamp(targetPointerX * 0.48, -0.55, 0.55);
      const targetRotX = THREE.MathUtils.clamp(-targetPointerY * 0.32, -0.32, 0.32);

      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, targetRotY, delta * 6 * speedMult);
      root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, targetRotX, delta * 6 * speedMult);
      root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, headTiltZ + waddleZ, delta * 5 * speedMult);
    } else {
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, 0, delta * 3);
      root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, 0.16, delta * 3);
      root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, 0.05, delta * 3);
    }

    // --- 2. Processing State 360 Spin ---
    if (isProcessing) {
      motion.rotation.y += delta * 2.8 * speedMult;
    } else {
      motion.rotation.y = THREE.MathUtils.lerp(motion.rotation.y, 0, delta * 8);
    }

    // --- 3. Jelly Breathing & Gentle Floating ---
    let floatY = 0;
    let jellyY = 0;

    if (isSleeping) {
      floatY = Math.sin(time * 1.2) * 0.02;
      jellyY = Math.sin(time * 1.2) * 0.055;
    } else if (isProcessing) {
      floatY = Math.sin(time * 3.8) * 0.04;
      jellyY = Math.sin(time * 3.8) * 0.035;
    } else {
      floatY = Math.sin(time * 2.2) * 0.035;
      jellyY = Math.sin(time * 2.2) * 0.042;
    }

    // Periodic Happy Hop in Idle
    const hopCycle = (time * 0.45) % 9;
    const hopY = !isSleeping && hopCycle < 0.65 ? Math.sin((hopCycle / 0.65) * Math.PI) * 0.07 : 0;
    motion.position.y = THREE.MathUtils.lerp(motion.position.y, floatY + hopY, delta * 10 * speedMult);

    // --- 4. Two-Phase Jelly Pop Morph State Machine ---
    const morph = morphRef.current;
    if (morph.phase === 'squash') {
      const elapsed = performance.now() - morph.startTime;
      const progress = Math.min(1, elapsed / 85);
      morph.squashFactor = Math.sin(progress * Math.PI * 0.5);

      if (progress >= 1) {
        setDisplayedState(mascotState);
        morph.phase = 'pop';
        morph.startTime = performance.now();
        morph.squashFactor = 0;
      }
    } else if (morph.phase === 'pop') {
      const elapsed = performance.now() - morph.startTime;
      const t = elapsed / 260;
      if (t >= 1) {
        morph.phase = 'idle';
        morph.popFactor = 0;
      } else {
        morph.popFactor = Math.sin(t * Math.PI) * Math.exp(-t * 3.2);
      }
    }

    // --- 5. Interactive Click Squash & Stretch ---
    squashRef.current = THREE.MathUtils.lerp(squashRef.current, 0, delta * 8.5);
    const clickSquash = squashRef.current;

    // Default base scale is 0.76 (10% smaller, delicate & cute)
    const baseScale = mascotScale;
    const jellyXZ = jellyY * 0.5;

    // Morph Scale Factors
    const morphY = -morph.squashFactor * 0.22 + morph.popFactor * 0.26;
    const morphXZ = morph.squashFactor * 0.15 - morph.popFactor * 0.14;

    const finalScaleX = baseScale * (1 - jellyXZ + clickSquash * 0.32 + morphXZ);
    const finalScaleY = baseScale * (1 + jellyY - clickSquash * 0.36 + morphY);
    const finalScaleZ = baseScale * (1 - jellyXZ + clickSquash * 0.32 + morphXZ);

    root.scale.set(finalScaleX, finalScaleY, finalScaleZ);
  });

  const currentModelPath = useMemo(() => getModelPathForState(displayedState), [displayedState]);

  return (
    <group ref={rootGroupRef} onClick={handleClick}>
      <group ref={motionGroupRef}>
        <ModelRenderer modelPath={currentModelPath} />

        {/* 3D Sleep Bubbles */}
        {displayedState === 'sleeping' && <SleepBubbles />}

        {/* Transient Sparkles on Click or Waving */}
        {(displayedState === 'waving' || showSparkles) && (
          <Sparkles
            count={14}
            scale={1.6}
            size={2.2}
            speed={0.7}
            color="#f472b6"
            position={[0, 0.2, 0]}
          />
        )}
      </group>
    </group>
  );
};

export default MochiModel;
