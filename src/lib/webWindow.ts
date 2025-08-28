/**
 * Web-compatible window operations to replace Tauri's webviewWindow API
 * Uses standard browser window object and events
 */

export interface DragDropEvent {
  payload: {
    type: 'enter' | 'over' | 'leave' | 'drop';
    paths?: string[];
    position?: { x: number; y: number };
  };
}

export type DragDropHandler = (event: DragDropEvent) => void;
export type UnlistenFn = () => void;

/**
 * Mock webview window object for web compatibility
 */
export interface WebviewWindow {
  onDragDropEvent(handler: DragDropHandler): Promise<UnlistenFn>;
}

/**
 * Get current webview window (mock implementation for web)
 * @returns Mock webview window object
 */
export function getCurrentWebviewWindow(): WebviewWindow {
  return {
    /**
     * Listen to drag and drop events on the window
     * @param handler - Event handler function
     * @returns Promise resolving to unlisten function
     */
    async onDragDropEvent(handler: DragDropHandler): Promise<UnlistenFn> {
      const handleDragEnter = (e: DragEvent) => {
        e.preventDefault();
        handler({
          payload: {
            type: 'enter',
            position: { x: e.clientX, y: e.clientY }
          }
        });
      };

      const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        handler({
          payload: {
            type: 'over',
            position: { x: e.clientX, y: e.clientY }
          }
        });
      };

      const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        // Only trigger if we're actually leaving the window
        if (e.clientX === 0 || e.clientY === 0 || 
            e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
          handler({
            payload: {
              type: 'leave'
            }
          });
        }
      };

      const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        const paths: string[] = [];
        
        if (files) {
          for (let i = 0; i < files.length; i++) {
            // Create object URLs for files to use as "paths"
            paths.push(URL.createObjectURL(files[i]));
          }
        }

        handler({
          payload: {
            type: 'drop',
            paths,
            position: { x: e.clientX, y: e.clientY }
          }
        });
      };

      // Add event listeners to document body or window
      document.body.addEventListener('dragenter', handleDragEnter);
      document.body.addEventListener('dragover', handleDragOver);
      document.body.addEventListener('dragleave', handleDragLeave);
      document.body.addEventListener('drop', handleDrop);

      // Return cleanup function
      return () => {
        document.body.removeEventListener('dragenter', handleDragEnter);
        document.body.removeEventListener('dragover', handleDragOver);
        document.body.removeEventListener('dragleave', handleDragLeave);
        document.body.removeEventListener('drop', handleDrop);
      };
    }
  };
}