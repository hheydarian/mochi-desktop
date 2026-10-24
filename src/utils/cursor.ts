import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Standalone mutable pointer object outside React to eliminate UI re-renders during mouse tracking
export const globalPointer = { x: 0, y: 0 };

let unlisten: UnlistenFn | null = null;

export async function initGlobalCursorTracking(isEnabledGetter: () => boolean) {
  if (unlisten || typeof window === 'undefined') return;

  try {
    unlisten = await listen<[number, number]>('cursor-move', (event) => {
      if (!isEnabledGetter()) return;
      const [x, y] = event.payload;
      globalPointer.x = x;
      globalPointer.y = y;
    });
  } catch {
    // Browser fallback (state.pointer handles it in Three.js useFrame)
  }
}
