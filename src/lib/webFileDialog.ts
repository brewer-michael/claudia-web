/**
 * Web-compatible file dialog system to replace Tauri's dialog plugin
 * Uses HTML input elements and File API
 */

export interface OpenDialogOptions {
  filters?: { name: string; extensions: string[] }[];
  defaultPath?: string;
  directory?: boolean;
  multiple?: boolean;
  title?: string;
}

export interface SaveDialogOptions {
  filters?: { name: string; extensions: string[] }[];
  defaultPath?: string;
  title?: string;
}

/**
 * Open file dialog to select files
 * @param options - Dialog options
 * @returns Promise resolving to selected file path(s) or null if cancelled
 */
export async function open(options: OpenDialogOptions = {}): Promise<string | string[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    
    if (options.multiple) {
      input.multiple = true;
    }
    
    if (options.directory) {
      // For directory selection, use webkitdirectory
      (input as any).webkitdirectory = true;
    }
    
    // Set accepted file types based on filters
    if (options.filters && options.filters.length > 0) {
      const extensions = options.filters.flatMap(filter => 
        filter.extensions.map(ext => ext.startsWith('.') ? ext : `.${ext}`)
      );
      input.accept = extensions.join(',');
    }
    
    input.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;
      
      if (!files || files.length === 0) {
        resolve(null);
        return;
      }
      
      if (options.multiple || options.directory) {
        // Return array of file paths (using File.name as path in web context)
        const paths = Array.from(files).map(file => {
          // Create a temporary URL for the file that can be used as a "path"
          return URL.createObjectURL(file);
        });
        resolve(paths);
      } else {
        // Return single file path
        resolve(URL.createObjectURL(files[0]));
      }
      
      // Clean up
      document.body.removeChild(input);
    };
    
    input.oncancel = () => {
      resolve(null);
      document.body.removeChild(input);
    };
    
    // Add to DOM and trigger click
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Save file dialog to save content to a file
 * @param options - Dialog options  
 * @returns Promise resolving to selected save path or null if cancelled
 */
export async function save(options: SaveDialogOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    // For save dialog, we'll use the download approach
    // Create a temporary link element
    const link = document.createElement('a');
    link.style.display = 'none';
    
    // Generate a default filename based on filters
    let filename = 'download';
    if (options.filters && options.filters.length > 0) {
      const firstExtension = options.filters[0].extensions[0];
      filename += firstExtension.startsWith('.') ? firstExtension : `.${firstExtension}`;
    }
    
    if (options.defaultPath) {
      const pathParts = options.defaultPath.split(/[/\\]/);
      filename = pathParts[pathParts.length - 1] || filename;
    }
    
    link.download = filename;
    
    // We can't actually save a file without content in web context,
    // so we'll return a promise that resolves with a mock path
    // The actual saving will need to be handled by the caller using the File API
    const mockPath = `/${filename}`;
    resolve(mockPath);
  });
}

/**
 * Web-compatible file writing function
 * @param filePath - Mock file path (not used in web context)
 * @param content - Content to save
 * @param filename - Optional filename override
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL
  URL.revokeObjectURL(url);
}

/**
 * Read file content from a File object or path
 * @param fileOrPath - File object or path string
 * @returns Promise resolving to file content
 */
export function readFileContent(fileOrPath: File | string): Promise<string> {
  if (typeof fileOrPath === 'string') {
    // If it's a blob URL, we can't read it directly
    // This would need to be handled by storing file references
    throw new Error('Cannot read file content from path in web context');
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target?.result as string || '');
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsText(fileOrPath);
  });
}