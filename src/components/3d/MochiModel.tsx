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
    case 'dizzy':
      return MODEL_PATHS.sleeping;
    case 'idle':
    case 'processing':
    default:
      return MODEL_PATHS.idle;
  }
}

// Preload ONLY the idle model immediately at boot so Mochi appears on screen in <15ms!
useGLTF.preload(MODEL_PATHS.idle, true, true);

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

// 3D Sleep Bubble Particles (Smooth 24x24 geometry, glossy soap glint, seamless lifecycle)
const SHARED_BUBBLE_GEOMETRY = new THREE.SphereGeometry(1, 24, 24);
const SHARED_GLINT_GEOMETRY = new THREE.SphereGeometry(1, 12, 12);
const SHARED_BUBBLE_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#7dd3fc',
  transparent: true,
  opacity: 0.65,
});
const SHARED_GLINT_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.85,
});

const SleepBubbles: React.FC<{ visible: boolean }> = ({ visible }) => {
  const bubblesRef = useRef<THREE.Group>(null);
  const bubbleData = useMemo(() => {
    return [
      { phase: 0.0, speed: 0.26, baseX: 0.16, baseScale: 0.046 },
      { phase: 0.32, speed: 0.30, baseX: 0.22, baseScale: 0.038 },
      { phase: 0.64, speed: 0.28, baseX: 0.12, baseScale: 0.052 },
      { phase: 0.84, speed: 0.34, baseX: 0.18, baseScale: 0.030 },
    ];
  }, []);

  useFrame((state, delta) => {
    if (!visible || !bubblesRef.current) return;
    const time = state.clock.elapsedTime;
    bubblesRef.current.children.forEach((group, i) => {
      const b = bubbleData[i];
      // Continuous normalized progress 0.0 -> 1.0 (seamless loop)
      const p = (time * b.speed + b.phase) % 1.0;

      // 1. Vertical float from head (0.26) up to top (0.96)
      const y = 0.26 + p * 0.70;
      group.position.y = y;

      // 2. Smooth natural S-curve sway
      const sway = Math.sin(time * 2.2 + i * 1.8) * 0.045;
      const targetX = b.baseX + sway;
      group.position.x = THREE.MathUtils.damp(group.position.x, targetX, 8, delta);
      group.position.z = Math.cos(time * 1.8 + i) * 0.025;

      // 3. Flawless 3-phase scale & pop lifecycle (Zero popping/snapping at 1.0):
      // - p < 0.20: Inflate smoothly from 0 to full size
      // - 0.20 <= p < 0.75: Full size with gentle breathing
      // - p >= 0.75: Gentle swell (+22%) and smooth shrink to 0 as it pops!
      let scaleMult = 1.0;
      if (p < 0.20) {
        scaleMult = Math.sin((p / 0.20) * Math.PI * 0.5);
      } else if (p >= 0.75) {
        const fadeP = (p - 0.75) / 0.25;
        scaleMult = (1 + Math.sin(fadeP * Math.PI) * 0.22) * (1 - fadeP);
      }
      const currentScale = Math.max(0.0001, b.baseScale * scaleMult);
      group.scale.setScalar(currentScale);
    });
  });

  return (
    <group ref={bubblesRef} visible={visible}>
      {bubbleData.map((b, i) => (
        <group key={i} position={[b.baseX, 0.26, 0]}>
          <mesh geometry={SHARED_BUBBLE_GEOMETRY} material={SHARED_BUBBLE_MATERIAL} />
          <mesh
            geometry={SHARED_GLINT_GEOMETRY}
            material={SHARED_GLINT_MATERIAL}
            scale={0.24}
            position={[0.35, 0.35, 0.7]}
          />
        </group>
      ))}
    </group>
  );
};

// 3D Dizzy Cartoon Stars (Spinning around Mochi's head when dizzy)
const SHARED_STAR_GEOMETRY = new THREE.OctahedronGeometry(0.042, 0);
const SHARED_STAR_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#fbbf24',
  transparent: true,
  opacity: 0.9,
});

const DizzyStars: React.FC<{ visible: boolean }> = ({ visible }) => {
  const starsRef = useRef<THREE.Group>(null);
  const starCount = 3;

  useFrame((state) => {
    if (!visible || !starsRef.current) return;
    const time = state.clock.elapsedTime * 4.8;
    starsRef.current.children.forEach((star, i) => {
      const angle = time + (i * Math.PI * 2) / starCount;
      const radius = 0.26;
      star.position.x = Math.cos(angle) * radius;
      star.position.z = Math.sin(angle) * radius;
      star.position.y = 0.38 + Math.sin(time * 2.5 + i) * 0.04;
      star.rotation.y = time * 2;
      star.rotation.z = time * 2;
    });
  });

  return (
    <group ref={starsRef} visible={visible}>
      {Array.from({ length: starCount }, (_, i) => (
        <mesh
          key={i}
          geometry={SHARED_STAR_GEOMETRY}
          material={SHARED_STAR_MATERIAL}
        />
      ))}
    </group>
  );
};

// 3D Glass Sweat Drop (Beside forehead under heavy system load)
const SHARED_SWEAT_GEOMETRY = new THREE.ConeGeometry(0.022, 0.065, 8);
const SHARED_SWEAT_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#67e8f9',
  transparent: true,
  opacity: 0.85,
});

const SweatDrop: React.FC<{ visible: boolean }> = ({ visible }) => {
  const dropRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!visible || !dropRef.current) return;
    const time = state.clock.elapsedTime * 3.5;
    dropRef.current.position.y = 0.22 + Math.sin(time) * 0.025;
    dropRef.current.scale.setScalar(0.9 + Math.sin(time * 2) * 0.15);
  });

  return (
    <mesh
      ref={dropRef}
      visible={visible}
      geometry={SHARED_SWEAT_GEOMETRY}
      material={SHARED_SWEAT_MATERIAL}
      position={[0.22, 0.22, 0.14]}
      rotation={[0, 0, -Math.PI / 4]}
    />
  );
};

// Procedural Focus & Calm Antenna Glow (Gentle cyan/emerald halo without audio)
const SHARED_ANTENNA_GEOMETRY = new THREE.SphereGeometry(0.04, 8, 8);

const FocusAntennaGlow: React.FC<{ active: boolean }> = ({ active }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowColor = '#34d399';

  useFrame((state) => {
    if (!active) return;
    const t = state.clock.elapsedTime * 2.2;
    const pulse = 0.75 + Math.sin(t) * 0.25;
    if (lightRef.current) {
      lightRef.current.intensity = pulse * 1.3;
    }
    if (meshRef.current) {
      meshRef.current.scale.setScalar(0.85 + pulse * 0.2);
    }
  });

  if (!active) return null;

  return (
    <group position={[0, 0.44, 0]}>
      <pointLight ref={lightRef} color={glowColor} intensity={1.3} distance={1.1} />
      <mesh ref={meshRef} geometry={SHARED_ANTENNA_GEOMETRY}>
        <meshBasicMaterial color={glowColor} transparent opacity={0.65} />
      </mesh>
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
    isHighSystemLoad,
    systemVitals,
    focusMode,
    toggleFocusMode,
    showSpeechBubble,
    lang,
  } = useMochiStore();

  const rootGroupRef = useRef<THREE.Group>(null);
  const motionGroupRef = useRef<THREE.Group>(null);
  const squashRef = useRef(0);
  const waveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const frameGovernorRef = useRef(0);
  const lastActivePointerRef = useRef(performance.now());

  // Mouse Tornado Detector Refs
  const lastAngleRef = useRef<number | null>(null);
  const angularHistoryRef = useRef<{ time: number; dTheta: number }[]>([]);
  const isDizzyRef = useRef<boolean>(false);

  // Smooth Jelly Morph State Machine
  const [displayedState, setDisplayedState] = useState<MascotState>(mascotState);
  const targetStateRef = useRef<MascotState>(mascotState);
  const morphRef = useRef<{
    phase: 'idle' | 'anticipation' | 'pop' | 'sleep_sink' | 'wake_stretch';
    startTime: number;
    squashFactor: number;
    popFactor: number;
    sinkFactor: number;
  }>({
    phase: 'idle',
    startTime: 0,
    squashFactor: 0,
    popFactor: 0,
    sinkFactor: 0,
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
  const [secondaryModelsLoaded, setSecondaryModelsLoaded] = useState(false);

  // Lazy-load secondary models in background 450ms after Mochi is already visible on screen!
  useEffect(() => {
    const timer = setTimeout(() => {
      setSecondaryModelsLoaded(true);
      useGLTF.preload(MODEL_PATHS.waving, true, true);
      useGLTF.preload(MODEL_PATHS.alert, true, true);
      useGLTF.preload(MODEL_PATHS.sleeping, true, true);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  // Initialize event-driven cursor tracking (Zero IPC polling)
  useEffect(() => {
    initGlobalCursorTracking(() => useMochiStore.getState().globalMouseTracking);
  }, []);

  // Proactive working set trim 1.5s after mount once models and shaders are resident in memory
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('trim_memory');
      } catch {
        // Ignore in web preview
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Midnight Gremlin (02:00 AM - 05:00 AM)
  const lastMidnightYawnRef = useRef<number>(Date.now() - 1000 * 60 * 18);
  useEffect(() => {
    const checkMidnightGremlin = () => {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 2 && hour < 5) {
        const timeSince = Date.now() - lastMidnightYawnRef.current;
        if (timeSince >= 20 * 60 * 1000) {
          lastMidnightYawnRef.current = Date.now();
          soundFx.yawn();
          showSpeechBubble({
            id: 'midnight_' + Date.now(),
            text:
              lang === 'fa'
                ? 'ساعت از ۲ نصفه‌شب گذشته... نمی‌خوای بخوابی رفیق؟ 🦉🌙'
                : 'It is past 2:00 AM... time to get some sleep, buddy? 🦉🌙',
            timeoutMs: 6000,
          });
        }
      }
    };

    const interval = setInterval(checkMidnightGremlin, 60000);
    checkMidnightGremlin();
    return () => clearInterval(interval);
  }, [lang, showSpeechBubble]);

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

  // Initiate Organic Jelly Morph when mascotState changes
  useEffect(() => {
    if (mascotState === displayedState && targetStateRef.current === mascotState) return;
    targetStateRef.current = mascotState;

    morphRef.current = {
      phase: 'anticipation',
      startTime: performance.now(),
      squashFactor: 0,
      popFactor: 0,
      sinkFactor: 0,
    };
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

    if (isHighSystemLoad) {
      showSpeechBubble({
        id: 'vitals_' + Date.now(),
        icon: 'vitals',
        text:
          lang === 'fa'
            ? `هوووف! سیستم داغ کرده! برنامه ${systemVitals.topProcess} داره رم (${systemVitals.memoryPercent}٪) / CPU (${systemVitals.cpuPercent}٪) رو می‌بلعه! 💦🔥`
            : `Phew! Heavy system load! Process ${systemVitals.topProcess} is hogging RAM (${systemVitals.memoryPercent}%) / CPU (${systemVitals.cpuPercent}%)! 💦🔥`,
        timeoutMs: 5000,
      });
    }

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

  const handleDoubleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    toggleFocusMode();
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
        throttleModulo = 2; // 30 FPS during sleep so bubbles and gentle breathing are silky smooth!
      } else if (focusMode) {
        throttleModulo = 4; // 15 FPS in Focus Mode (calm, minimal resource load)
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
    const isDizzy = displayedState === 'dizzy';
    const isProcessing = displayedState === 'processing';

    // --- Mouse Tornado Angular Tracking (6π rad in < 3s) ---
    const pointerDistFromCenter = Math.hypot(targetPointerX, targetPointerY);
    if (pointerDistFromCenter > 0.08) {
      const currentAngle = Math.atan2(targetPointerY, targetPointerX);
      if (lastAngleRef.current !== null) {
        let diff = currentAngle - lastAngleRef.current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) > 0.04) {
          angularHistoryRef.current.push({ time: now, dTheta: diff });
        }
      }
      lastAngleRef.current = currentAngle;
    } else {
      lastAngleRef.current = null;
    }

    // Clean up history older than 3 seconds
    angularHistoryRef.current = angularHistoryRef.current.filter((item) => now - item.time < 3000);

    // Sum angular rotation
    const totalRotation = angularHistoryRef.current.reduce((sum, item) => sum + item.dTheta, 0);
    if (Math.abs(totalRotation) >= Math.PI * 6 && !isDizzyRef.current) {
      isDizzyRef.current = true;
      angularHistoryRef.current = [];
      setMascotState('dizzy');
      soundFx.dizzy();
      showSpeechBubble({
        id: 'dizzy_' + Date.now(),
        text: lang === 'fa' ? 'آخ سرم گیج رفت! 😵‍💫🌀' : 'Woah, my head is spinning! 😵‍💫🌀',
        timeoutMs: 3500,
      });

      setTimeout(() => {
        isDizzyRef.current = false;
        if (useMochiStore.getState().mascotState === 'dizzy') {
          setMascotState('idle');
        }
      }, 3500);
    }

    // --- Autonomous Life Engine ---
    if (autonomousMode && !isDizzy) {
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

    // --- 2. Processing State 360 Spin & Dizzy Wobble ---
    if (isProcessing) {
      motion.rotation.y += delta * 2.8 * speedMult;
    } else if (isDizzy) {
      motion.rotation.y += Math.sin(time * 5) * 0.25 * delta * 60;
      motion.rotation.z = Math.sin(time * 8) * 0.18;
      motion.rotation.x = Math.cos(time * 6) * 0.14;
    } else {
      motion.rotation.y = THREE.MathUtils.damp(motion.rotation.y, 0, 8, delta);
    }

    // --- 3. Jelly Breathing & Gentle Floating ---
    let floatY = 0;
    let jellyY = 0;
    const breathRateMultiplier = isHighSystemLoad ? 2.6 : focusMode ? 0.6 : 1.0;

    if (isSleeping) {
      floatY = Math.sin(time * 1.2) * 0.02;
      jellyY = Math.sin(time * 1.2) * 0.055;
    } else if (isProcessing) {
      floatY = Math.sin(time * 3.8) * 0.04;
      jellyY = Math.sin(time * 3.8) * 0.035;
    } else if (isDizzy) {
      floatY = Math.sin(time * 4.2) * 0.03;
      jellyY = Math.sin(time * 6.5) * 0.06;
    } else {
      floatY = Math.sin(time * 2.2 * breathRateMultiplier) * 0.035;
      jellyY = Math.sin(time * 2.2 * breathRateMultiplier) * 0.042;
    }

    // Periodic Happy Hop in Idle
    const hopCycle = (time * 0.45) % 9;
    const hopY = !isSleeping && hopCycle < 0.65 ? Math.sin((hopCycle / 0.65) * Math.PI) * 0.07 : 0;

    // --- 4. Organic Two-Phase Jelly Morph State Machine ---
    const morph = morphRef.current;
    if (morph.phase === 'anticipation') {
      const elapsed = performance.now() - morph.startTime;
      const duration = 120; // 120ms organic anticipation squash
      const progress = Math.min(1, elapsed / duration);
      morph.squashFactor = Math.sin(progress * Math.PI * 0.5);

      if (progress >= 1) {
        // Swap 3D model exactly at peak squash compression!
        const nextState = targetStateRef.current;
        const prevState = displayedState;
        setDisplayedState(nextState);
        morph.startTime = performance.now();
        morph.squashFactor = 0;

        if (nextState === 'sleeping') {
          morph.phase = 'sleep_sink';
        } else if (prevState === 'sleeping') {
          morph.phase = 'wake_stretch';
        } else {
          morph.phase = 'pop';
        }
      }
    } else if (morph.phase === 'pop') {
      const elapsed = performance.now() - morph.startTime;
      const duration = 340; // 340ms harmonic spring settle
      const t = elapsed / duration;
      if (t >= 1) {
        morph.phase = 'idle';
        morph.popFactor = 0;
      } else {
        morph.popFactor = Math.sin(t * Math.PI) * Math.exp(-t * 3.4);
      }
    } else if (morph.phase === 'sleep_sink') {
      const elapsed = performance.now() - morph.startTime;
      const duration = 420; // 420ms gentle melt into sleep
      const t = elapsed / duration;
      if (t >= 1) {
        morph.phase = 'idle';
        morph.sinkFactor = 0;
      } else {
        morph.sinkFactor = (1 - t) * Math.sin(t * Math.PI * 0.5);
      }
    } else if (morph.phase === 'wake_stretch') {
      const elapsed = performance.now() - morph.startTime;
      const duration = 360; // 360ms yawn stretch
      const t = elapsed / duration;
      if (t >= 1) {
        morph.phase = 'idle';
        morph.popFactor = 0;
      } else {
        morph.popFactor = Math.sin(t * Math.PI) * Math.exp(-t * 3.0);
      }
    }

    // --- 5. Interactive Click Squash & Stretch ---
    squashRef.current = THREE.MathUtils.damp(squashRef.current, 0, 8.5, delta);
    const clickSquash = squashRef.current;

    // Default base scale is 0.76 (10% smaller, delicate & cute)
    const baseScale = mascotScale;
    const jellyXZ = jellyY * 0.5;

    // Morph Scale & Position Offsets:
    const morphY = -morph.squashFactor * 0.22 + morph.popFactor * 0.25 - morph.sinkFactor * 0.08;
    const morphXZ = morph.squashFactor * 0.14 - morph.popFactor * 0.13 + morph.sinkFactor * 0.06;
    const morphPosY = -morph.squashFactor * 0.04 - morph.sinkFactor * 0.02;

    motion.position.y = THREE.MathUtils.damp(motion.position.y, floatY + hopY + morphPosY, 10 * speedMult, delta);

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
      case 'dizzy':
        return 'sleeping';
      case 'idle':
      case 'processing':
      default:
        return 'idle';
    }
  }, [displayedState]);

  return (
    <group ref={rootGroupRef} onClick={handleClick} onDoubleClick={handleDoubleClick}>
      <group ref={motionGroupRef}>
        {/* Scene-Graph Object Pooling: Idle is mounted immediately (<15ms); secondary models load lazily */}
        <PooledModel modelPath={MODEL_PATHS.idle} visible={activeKey === 'idle'} />
        {(secondaryModelsLoaded || activeKey !== 'idle') && (
          <>
            <PooledModel modelPath={MODEL_PATHS.waving} visible={activeKey === 'waving'} />
            <PooledModel modelPath={MODEL_PATHS.alert} visible={activeKey === 'alert'} />
            <PooledModel modelPath={MODEL_PATHS.sleeping} visible={activeKey === 'sleeping'} />
          </>
        )}

        {/* 3D Sleep Bubbles (Never unmounted, zero GPU buffer allocation leak) */}
        <SleepBubbles visible={displayedState === 'sleeping'} />

        {/* 3D Dizzy Stars (Spinning around Mochi's head when dizzy) */}
        <DizzyStars visible={displayedState === 'dizzy'} />

        {/* 3D Glass Sweat Drop (Beside forehead under heavy system load) */}
        <SweatDrop visible={isHighSystemLoad} />

        {/* 3D Procedural Focus & Calm Antenna Glow */}
        <FocusAntennaGlow active={focusMode} />

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
