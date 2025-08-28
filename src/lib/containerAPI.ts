/**
 * Container-based API layer for claudia-server
 * Works with persistent /workspace directory in Docker container
 */

import type { HooksConfiguration } from '@/types/hooks';

// Container API functions for server-side operations
export interface ContainerProject {
  id: string;
  name: string;
  path: string; // Full path in /workspace
  created_at: number;
  most_recent_session?: number;
  files?: ContainerFile[];
}

export interface ContainerFile {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified: number;
  extension?: string;
}

export interface ContainerSession {
  id: string;
  project_id: string;
  project_path: string;
  created_at: number;
  first_message?: string;
  message_timestamp?: string;
  todo_data?: any;
}

class ContainerAPI {
  private baseUrl = '/api'; // Will be served by container backend
  
  async listWorkspaceProjects(): Promise<ContainerProject[]> {
    try {
      // In container mode, this would call a backend API
      // For now, return mock data based on /workspace structure
      const response = await fetch(`${this.baseUrl}/workspace/projects`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      return await response.json();
    } catch (error) {
      console.warn('Container API not available, using mock data');
      return this.getMockProjects();
    }
  }

  async createProject(name: string): Promise<ContainerProject> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error('Failed to create project');
      return await response.json();
    } catch (error) {
      console.warn('Container API not available, using mock data');
      return this.getMockProject(name);
    }
  }

  async getProject(projectId: string): Promise<ContainerProject | null> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/projects/${projectId}`);
      if (!response.ok) throw new Error('Project not found');
      return await response.json();
    } catch (error) {
      console.warn('Container API not available, using mock data');
      return this.getMockProject(`project-${projectId}`);
    }
  }

  async listProjectFiles(projectId: string, path?: string): Promise<ContainerFile[]> {
    try {
      const url = path 
        ? `${this.baseUrl}/workspace/projects/${projectId}/files?path=${encodeURIComponent(path)}`
        : `${this.baseUrl}/workspace/projects/${projectId}/files`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to list files');
      return await response.json();
    } catch (error) {
      console.warn('Container API not available, using mock data');
      return this.getMockFiles();
    }
  }

  async readFile(projectId: string, filePath: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/projects/${projectId}/files/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      });
      if (!response.ok) throw new Error('Failed to read file');
      return await response.text();
    } catch (error) {
      console.warn('Container API not available, using mock data');
      return `// Mock content for ${filePath}\nconsole.log("Hello from ${filePath}");`;
    }
  }

  async writeFile(projectId: string, filePath: string, content: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/projects/${projectId}/files/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content })
      });
      if (!response.ok) throw new Error('Failed to write file');
    } catch (error) {
      console.warn('Container API not available - file write mocked');
    }
  }

  async deleteFile(projectId: string, filePath: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/projects/${projectId}/files/content`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      });
      if (!response.ok) throw new Error('Failed to delete file');
    } catch (error) {
      console.warn('Container API not available - file delete mocked');
    }
  }

  async executeCommand(projectId: string, command: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/projects/${projectId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      if (!response.ok) throw new Error('Failed to execute command');
      return await response.text();
    } catch (error) {
      console.warn('Container API not available - command execution mocked');
      return `Mock execution of: ${command}\nCommand completed successfully.`;
    }
  }

  // Mock data for development/fallback
  private getMockProjects(): ContainerProject[] {
    return [
      {
        id: 'sample-project',
        name: 'Sample Project',
        path: '/workspace/sample-project',
        created_at: Date.now() - 86400000, // 1 day ago
        most_recent_session: Date.now() - 3600000 // 1 hour ago
      },
      {
        id: 'my-app',
        name: 'My App',
        path: '/workspace/my-app',
        created_at: Date.now() - 172800000, // 2 days ago
      }
    ];
  }

  private getMockProject(name: string): ContainerProject {
    return {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
      path: `/workspace/${name.toLowerCase().replace(/\s+/g, '-')}`,
      created_at: Date.now(),
    };
  }

  private getMockFiles(): ContainerFile[] {
    return [
      {
        name: 'src',
        path: 'src',
        is_directory: true,
        size: 0,
        modified: Date.now() - 3600000
      },
      {
        name: 'package.json',
        path: 'package.json',
        is_directory: false,
        size: 1234,
        modified: Date.now() - 7200000,
        extension: 'json'
      },
      {
        name: 'README.md',
        path: 'README.md',
        is_directory: false,
        size: 2567,
        modified: Date.now() - 1800000,
        extension: 'md'
      }
    ];
  }
}

// Export singleton instance
export const containerAPI = new ContainerAPI();