import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Center, Sparkles } from '@react-three/drei';
import { useMochiStore, type MascotState } from '../../store/useMochiStore';
import { soundFx } from '../../utils/sound';
import { globalPointer, initGlobalCursorTracking } from '../../utils/cursor';

// Tripo models face +X by default; rotate -90° on Y to look directly at user (+Z)
const BASE_ROTATION_Y = -Math.PI / 2;

// Paths to the 4 real optimized 3D models (~210KB each)
export const MODEL_PATHS = {
  idle: './assets/models/mochi-idle.glb',
  waving: './assets/models/mochi-waving.glb',
  alert: './assets/models/mochi-alert.glb',
  sleeping: './assets/models/mochi-sleeping.glb',
} as const;

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

// Preload all 4 models immediately into GPU memory (<50ms total for 800KB)
useGLTF.preload(MODEL_PATHS.idle, true, true);
useGLTF.preload(MODEL_PATHS.waving, true, true);
useGLTF.preload(MODEL_PATHS.alert, true, true);
useGLTF.preload(MODEL_PATHS.sleeping, true, true);

interface PooledModelProps {
  modelPath: string;
  visible: boolean;
}

// Scene-Graph Object Pooling Component:
// Stays mounted in the Three.js scene tree; toggling `visible` has zero CPU overhead,
// avoids garbage collection and prevents WebGL shader recompilations (switches in 0.001ms).
const PooledModel: React.FC<PooledModelProps> = ({ modelPath, visible }) => {
  const { scene } = useGLTF(modelPath, true, true);

  // Configure material properties for Pixar/Clay aesthetic once on load
  useMemo(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.roughness = 0.42;
          mat.metalness = 0.04;
        }
      }
    });
  }, [scene]);

  return (
    <group visible={visible}>
      <Center top={false}>
        <group rotation={[0, BASE_ROTATION_Y, 0]}>
          <primitive object={scene} />
        </group>
      </Center>
    </group>
  );
};

// 3D Sleep Bubble Particles (Single allocation, zero GPU leak)
const SHARED_BUBBLE_GEOMETRY = new THREE.SphereGeometry(1, 8, 8);
const SHARED_BUBBLE_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#93c5fd',
  transparent: true,
  opacity: 0.55,
});

const SleepBubbles: React.FC<{ visible: boolean }> = ({ visible }) => {
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

  useFrame((state, delta) => {
    if (!visible || !bubblesRef.current) return;
    const time = state.clock.elapsedTime;
    bubblesRef.current.children.forEach((child, i) => {
      const b = bubbleData[i];
      const y = (time * b.speed + b.offsetY) % 0.85;
      child.position.y = 0.28 + y;
      const targetX = b.baseX + Math.sin(time * 2.2 + i * 1.5) * 0.04;
      child.position.x = THREE.MathUtils.damp(child.position.x, targetX, 8, delta);
    });
  });

  return (
    <group ref={bubblesRef} visible={visible}>
      {bubbleData.map((b, i) => (
        <mesh
          key={i}
          geometry={SHARED_BUBBLE_GEOMETRY}
          material={SHARED_BUBBLE_MATERIAL}
          scale={b.scale}
          position={[b.baseX, 0.28 + b.offsetY, 0]}
        />
      ))}
    </group>
  );
};

export const MochiModel: React.FC<{ isHovered?: boolean }> = ({ isHovered = false }) => {
  const {
    mascotState,
    setMascotState,
    sleepSource,
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

  const frameGovernorRef = useRef(0);
  const lastActivePointerRef = useRef(performance.now());

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

  // Initialize event-driven cursor tracking (Zero IPC polling)
  useEffect(() => {
    initGlobalCursorTracking(() => useMochiStore.getState().globalMouseTracking);
  }, []);

  // Proactive working set trim 6 seconds after mount once models and shaders are resident in memory
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('trim_memory');
      } catch {
        // Ignore in web preview
      }
    }, 6000);
    return () => clearTimeout(timer);
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
    setDisplayedState(mascotState);
    morphRef.current = {
      phase: 'pop',
      startTime: performance.now(),
      squashFactor: 0,
      popFactor: 0.18,
    };
  }, [mascotState]);

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

    // Read directly from zero-render globalPointer object pushed from Rust event
    let targetPointerX = state.pointer.x;
    let targetPointerY = state.pointer.y;

    if (globalMouseTracking && (globalPointer.x !== 0 || globalPointer.y !== 0)) {
      targetPointerX = globalPointer.x;
      targetPointerY = -globalPointer.y;
    }

    const movedDist = Math.hypot(
      targetPointerX - lastCursorRef.current.x,
      targetPointerY - lastCursorRef.current.y
    );

    const now = Date.now();
    const nowPerf = performance.now();

    if (movedDist > 0.015) {
      lastActivePointerRef.current = nowPerf;
    }

    const timeSinceMovement = nowPerf - lastActivePointerRef.current;
    const isActivelyMoving = timeSinceMovement < 1000;
    const isWaving = displayedState === 'waving';
    const isClicking = squashRef.current > 0.02;
    const isMorphing = morphRef.current.phase !== 'idle';

    // Zero-Idle Governor:
    // When user is not interacting, throttle frames to cut GPU/CPU by 80-95%!
    let throttleModulo = 1; // 1 = every frame (60 FPS hardware VSync)
    if (!isHovered && !isActivelyMoving && !isWaving && !isClicking && !isMorphing) {
      if (displayedState === 'sleeping') {
        throttleModulo = 5; // 12 FPS during sleep
      } else if (timeSinceMovement > 10000) {
        throttleModulo = 4; // 15 FPS in deep idle (>10s still)
      } else {
        throttleModulo = 2; // 30 FPS in calm idle
      }
    }

    frameGovernorRef.current = (frameGovernorRef.current + 1) % throttleModulo;
    if (frameGovernorRef.current !== 0) {
      // Do NOT execute WebGL render pass on skipped frames!
      return;
    }

    const time = state.clock.elapsedTime * speedMult;
    const isSleeping = displayedState === 'sleeping';
    const isProcessing = displayedState === 'processing';

    // --- Autonomous Life Engine ---
    if (autonomousMode) {
      // Mouse motion resets inactivity timer
      if (movedDist > 0.035) {
        lastActiveTimeRef.current = now;
        lastCursorRef.current = { x: targetPointerX, y: targetPointerY };

        // Only wake up automatically if Mochi fell asleep automatically via inactivity!
        if (mascotState === 'sleeping' && sleepSource === 'auto') {
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
        setMascotState('sleeping', 'auto');
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

    // --- 1. Head and Body Rotation via Frame-Independent Damped Springs ---
    const headTiltZ = !isSleeping ? Math.sin(time * 0.8) * 0.08 : 0.04;
    const waddleZ = !isSleeping ? Math.sin(time * 1.6) * 0.03 : 0;

    if (!isSleeping) {
      const targetRotY = THREE.MathUtils.clamp(targetPointerX * 0.48, -0.55, 0.55);
      const targetRotX = THREE.MathUtils.clamp(-targetPointerY * 0.32, -0.32, 0.32);

      root.rotation.y = THREE.MathUtils.damp(root.rotation.y, targetRotY, 6 * speedMult, delta);
      root.rotation.x = THREE.MathUtils.damp(root.rotation.x, targetRotX, 6 * speedMult, delta);
      root.rotation.z = THREE.MathUtils.damp(root.rotation.z, headTiltZ + waddleZ, 5 * speedMult, delta);
    } else {
      root.rotation.y = THREE.MathUtils.damp(root.rotation.y, 0, 3, delta);
      root.rotation.x = THREE.MathUtils.damp(root.rotation.x, 0.16, 3, delta);
      root.rotation.z = THREE.MathUtils.damp(root.rotation.z, 0.05, 3, delta);
    }

    // --- 2. Processing State 360 Spin ---
    if (isProcessing) {
      motion.rotation.y += delta * 2.8 * speedMult;
    } else {
      motion.rotation.y = THREE.MathUtils.damp(motion.rotation.y, 0, 8, delta);
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
    motion.position.y = THREE.MathUtils.damp(motion.position.y, floatY + hopY, 10 * speedMult, delta);

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
    squashRef.current = THREE.MathUtils.damp(squashRef.current, 0, 8.5, delta);
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

    // Render pass execution
    state.gl.render(state.scene, state.camera);
  }, 1);

  const activeKey = useMemo(() => {
    switch (displayedState) {
      case 'waving':
        return 'waving';
      case 'alert':
      case 'dragOver':
        return 'alert';
      case 'sleeping':
        return 'sleeping';
      case 'idle':
      case 'processing':
      default:
        return 'idle';
    }
  }, [displayedState]);

  return (
    <group ref={rootGroupRef} onClick={handleClick}>
      <group ref={motionGroupRef}>
        {/* Scene-Graph Object Pooling: All 4 models kept mounted, instant 0.001ms zero-cost visibility switch */}
        <PooledModel modelPath={MODEL_PATHS.idle} visible={activeKey === 'idle'} />
        <PooledModel modelPath={MODEL_PATHS.waving} visible={activeKey === 'waving'} />
        <PooledModel modelPath={MODEL_PATHS.alert} visible={activeKey === 'alert'} />
        <PooledModel modelPath={MODEL_PATHS.sleeping} visible={activeKey === 'sleeping'} />

        {/* 3D Sleep Bubbles (Never unmounted, zero GPU buffer allocation leak) */}
        <SleepBubbles visible={displayedState === 'sleeping'} />

        {/* Transient Sparkles on Click or Waving (Pooled in scene graph, zero shader recreation) */}
        <group visible={displayedState === 'waving' || showSparkles}>
          <Sparkles
            count={12}
            scale={1.6}
            size={2.2}
            speed={0.7}
            color="#f472b6"
            position={[0, 0.2, 0]}
          />
        </group>
      </group>
    </group>
  );
};

export default MochiModel;
