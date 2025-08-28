/**
 * Web-compatible event system to replace Tauri's event system
 * Uses browser's EventTarget API for cross-component communication
 */

// Global event target for application-wide events
const globalEventTarget = new EventTarget();

// Type definitions for event payloads
export interface EventPayload {
  [key: string]: any;
}

// Mock UnlistenFn type to match Tauri's API
export type UnlistenFn = () => void;

/**
 * Listen to an event
 * @param eventName - Name of the event to listen to
 * @param handler - Event handler function
 * @returns Function to unlisten/cleanup
 */
export async function listen<T = any>(
  eventName: string, 
  handler: (event: { payload: T }) => void
): Promise<UnlistenFn> {
  const eventHandler = (event: Event) => {
    const customEvent = event as CustomEvent<T>;
    handler({ payload: customEvent.detail });
  };

  globalEventTarget.addEventListener(eventName, eventHandler);

  // Return unlisten function
  return () => {
    globalEventTarget.removeEventListener(eventName, eventHandler);
  };
}

/**
 * Emit an event
 * @param eventName - Name of the event to emit
 * @param payload - Event payload data
 */
export function emit<T = any>(eventName: string, payload: T): void {
  const customEvent = new CustomEvent(eventName, { detail: payload });
  globalEventTarget.dispatchEvent(customEvent);
}

/**
 * Listen once to an event (auto-unlistens after first trigger)
 * @param eventName - Name of the event to listen to
 * @param handler - Event handler function
 * @returns Promise that resolves with the event payload
 */
export async function once<T = any>(eventName: string): Promise<{ payload: T }> {
  return new Promise((resolve) => {
    const eventHandler = (event: Event) => {
      const customEvent = event as CustomEvent<T>;
      globalEventTarget.removeEventListener(eventName, eventHandler);
      resolve({ payload: customEvent.detail });
    };

    globalEventTarget.addEventListener(eventName, eventHandler);
  });
}

// Export the global event target for direct access if needed
export { globalEventTarget };