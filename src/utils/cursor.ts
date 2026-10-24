// Standalone mutable pointer object outside React to eliminate UI re-renders during mouse tracking
export const globalPointer = { x: 0, y: 0 };

let trackingInterval: ReturnType<typeof setInterval> | null = null;

export function initGlobalCursorTracking(isEnabledGetter: () => boolean) {
  if (trackingInterval || typeof window === 'undefined') return;

  trackingInterval = setInterval(async () => {
    if (!isEnabledGetter()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const pos = await invoke<[number, number]>('get_global_cursor_position');
      if (pos) {
        globalPointer.x = pos[0];
        globalPointer.y = pos[1];
      }
    } catch {
      // Browser fallback (state.pointer handles it in Three.js useFrame)
    }
  }, 50); // 20 Hz (every 50ms)
}
