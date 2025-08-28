/**
 * Web-compatible project management system
 * Stores projects and files in browser memory using IndexedDB
 */

export interface WebProject {
  id: string;
  name: string;
  files: WebProjectFile[];
  created_at: number;
  most_recent_session?: number;
}

export interface WebProjectFile {
  path: string; // relative path within project
  content: string | ArrayBuffer;
  type: 'text' | 'binary';
  size: number;
}

class WebProjectManager {
  private dbName = 'gooey-projects';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('name', 'name', { unique: false });
          projectStore.createIndex('created_at', 'created_at', { unique: false });
        }
        
        // Create sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('project_id', 'project_id', { unique: false });
          sessionStore.createIndex('created_at', 'created_at', { unique: false });
        }
      };
    });
  }

  async createProjectFromFiles(files: FileList, projectName?: string): Promise<WebProject> {
    if (!this.db) throw new Error('Database not initialized');

    const projectId = crypto.randomUUID();
    const name = projectName || `Project-${Date.now()}`;
    
    const projectFiles: WebProjectFile[] = [];
    
    // Process all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await this.readFileContent(file);
      
      projectFiles.push({
        path: file.webkitRelativePath || file.name,
        content: content,
        type: this.isTextFile(file.name) ? 'text' : 'binary',
        size: file.size
      });
    }

    const webProject: WebProject = {
      id: projectId,
      name: name,
      files: projectFiles,
      created_at: Date.now()
    };

    // Save to IndexedDB
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.add(webProject);
      
      request.onsuccess = () => resolve(webProject);
      request.onerror = () => reject(request.error);
    });
  }

  async listProjects(): Promise<WebProject[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getProject(projectId: string): Promise<WebProject | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.get(projectId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.delete(projectId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getProjectFile(projectId: string, filePath: string): Promise<WebProjectFile | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;
    
    return project.files.find(f => f.path === filePath) || null;
  }

  async updateProjectFile(projectId: string, filePath: string, content: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Project not found');
    
    const fileIndex = project.files.findIndex(f => f.path === filePath);
    if (fileIndex === -1) {
      // Add new file
      project.files.push({
        path: filePath,
        content: content,
        type: 'text',
        size: new Blob([content]).size
      });
    } else {
      // Update existing file
      project.files[fileIndex].content = content;
      project.files[fileIndex].size = new Blob([content]).size;
    }

    // Save updated project
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.put(project);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async readFileContent(file: File): Promise<string | ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => resolve(reader.result!);
      reader.onerror = () => reject(reader.error);
      
      if (this.isTextFile(file.name)) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  private isTextFile(filename: string): boolean {
    const textExtensions = [
      '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.less',
      '.html', '.htm', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
      '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb', '.go',
      '.rs', '.swift', '.kt', '.scala', '.clj', '.hs', '.ml', '.fs', '.vb',
      '.sql', '.sh', '.bat', '.ps1', '.dockerfile', '.gitignore', '.env'
    ];
    
    const ext = '.' + filename.split('.').pop()?.toLowerCase();
    return textExtensions.includes(ext) || !filename.includes('.');
  }
}

// Singleton instance
export const webProjectManager = new WebProjectManager();