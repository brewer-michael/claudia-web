#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import path from 'path';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.query, req.body ? Object.keys(req.body) : '');
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Static file serving
app.use(express.static('dist'));

// Environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WORKSPACE_DIR = process.env.DEFAULT_WORKSPACE || '/workspace';

// Ensure workspace directory exists
async function ensureWorkspaceDir() {
  try {
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    console.log(`Workspace directory ready: ${WORKSPACE_DIR}`);
  } catch (error) {
    console.error('Failed to create workspace directory:', error);
  }
}

// Helper functions
async function listDirectory(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      is_directory: entry.isDirectory(),
      size: 0, // Will be filled by stat if needed
      modified: Date.now()
    }));
  } catch (error) {
    console.error('Error listing directory:', error);
    return [];
  }
}

async function getProjectId(projectPath) {
  return path.basename(projectPath);
}

// API Routes

// IPC Bridge - Handle invoke() calls from frontend
app.post('/api/invoke', async (req, res) => {
  try {
    const { command, args = [] } = req.body;
    
    console.log(`Handling invoke command: ${command}`, args);
    
    switch (command) {
      case 'get_home_directory':
        res.json(WORKSPACE_DIR);
        break;
        
      case 'list_projects':
        const entries = await listDirectory(WORKSPACE_DIR);
        const projects = entries
          .filter(entry => entry.is_directory)
          .map(entry => ({
            id: path.basename(entry.path),
            name: path.basename(entry.path),
            path: entry.path,
            created_at: Date.now()
          }));
        res.json(projects);
        break;
        
      case 'create_project':
        const [projectName] = args;
        if (!projectName) {
          return res.status(400).json({ error: 'Project name required' });
        }
        const projectPath = path.join(WORKSPACE_DIR, projectName);
        await fs.mkdir(projectPath, { recursive: true });
        const readmePath = path.join(projectPath, 'README.md');
        await fs.writeFile(readmePath, `# ${projectName}\n\nProject created on ${new Date().toISOString()}\n`);
        res.json({ id: projectName, name: projectName, path: projectPath });
        break;
        
      case 'get_claude_settings':
        // Mock Claude settings
        res.json({
          model: process.env.MODEL || 'claude-sonnet-4-20250514',
          max_tokens: parseInt(process.env.MAX_TOKENS) || 4096,
          api_key_configured: !!ANTHROPIC_API_KEY
        });
        break;
        
      case 'save_claude_settings':
        // Mock save - in container mode, settings are env vars
        res.json({ success: true });
        break;
        
      case 'check_claude_version':
        // Mock version check
        res.json({ version: '1.0.0', available: true });
        break;
        
      case 'get_system_prompt':
        // Try to read CLAUDE.md from current project or workspace
        try {
          const claudeMdPath = path.join(WORKSPACE_DIR, 'CLAUDE.md');
          const content = await fs.readFile(claudeMdPath, 'utf-8');
          res.send(content);
        } catch {
          res.send(''); // Return empty if no CLAUDE.md found
        }
        break;
        
      case 'save_system_prompt':
        const [promptContent] = args;
        const claudeMdPath = path.join(WORKSPACE_DIR, 'CLAUDE.md');
        await fs.writeFile(claudeMdPath, promptContent, 'utf-8');
        res.json({ success: true });
        break;
        
      // Mock implementations for features not applicable in container mode
      case 'list_agents':
      case 'list_running_sessions':
      case 'get_usage_stats':
      case 'mcp_list':
      case 'storage_list_tables':
      case 'list_checkpoints':
      case 'slash_commands_list':
        res.json([]);
        break;
        
      case 'get_project_sessions':
      case 'get_agent_run':
      case 'get_session_status':
      case 'get_usage_by_date_range':
      case 'mcp_get':
      case 'storage_read_table':
        res.json(null);
        break;
        
      default:
        console.log(`Unhandled invoke command: ${command}`);
        res.status(404).json({ error: `Unknown command: ${command}` });
        break;
    }
  } catch (error) {
    console.error(`Error handling invoke command:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get workspace projects
app.get('/api/workspace/projects', async (req, res) => {
  try {
    const entries = await listDirectory(WORKSPACE_DIR);
    const projects = entries
      .filter(entry => entry.is_directory)
      .map(entry => ({
        id: path.basename(entry.path),
        name: path.basename(entry.path),
        path: entry.path,
        created_at: Date.now(),
        most_recent_session: null
      }));
    
    res.json(projects);
  } catch (error) {
    console.error('Failed to list projects:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Create new project
app.post('/api/workspace/projects', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projectPath = path.join(WORKSPACE_DIR, name);
    await fs.mkdir(projectPath, { recursive: true });
    
    // Create initial README
    const readmePath = path.join(projectPath, 'README.md');
    await fs.writeFile(readmePath, `# ${name}\n\nProject created on ${new Date().toISOString()}\n`);

    const project = {
      id: name,
      name: name,
      path: projectPath,
      created_at: Date.now()
    };

    res.json(project);
  } catch (error) {
    console.error('Failed to create project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get project files
app.get('/api/workspace/projects/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: subPath } = req.query;
    
    const projectPath = path.join(WORKSPACE_DIR, projectId);
    const targetPath = subPath ? path.join(projectPath, subPath) : projectPath;
    
    const files = await listDirectory(targetPath);
    res.json(files);
  } catch (error) {
    console.error('Failed to list project files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Read file content
app.post('/api/workspace/projects/:projectId/files/content', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: filePath } = req.body;
    
    const projectPath = path.join(WORKSPACE_DIR, projectId);
    const fullPath = path.join(projectPath, filePath);
    
    const content = await fs.readFile(fullPath, 'utf-8');
    res.send(content);
  } catch (error) {
    console.error('Failed to read file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Write file content
app.put('/api/workspace/projects/:projectId/files/content', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: filePath, content } = req.body;
    
    const projectPath = path.join(WORKSPACE_DIR, projectId);
    const fullPath = path.join(projectPath, filePath);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to write file:', error);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// Execute command
app.post('/api/workspace/projects/:projectId/execute', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { command } = req.body;
    
    const projectPath = path.join(WORKSPACE_DIR, projectId);
    
    const { stdout, stderr } = await execAsync(command, { 
      cwd: projectPath,
      env: { ...process.env, ANTHROPIC_API_KEY }
    });
    
    res.send(stdout + (stderr ? '\n' + stderr : ''));
  } catch (error) {
    console.error('Failed to execute command:', error);
    res.status(500).send(error.message);
  }
});

// Generic file operations (for compatibility)
app.get('/api/files', async (req, res) => {
  try {
    const { path: dirPath } = req.query;
    const targetPath = dirPath ? path.resolve(WORKSPACE_DIR, dirPath) : WORKSPACE_DIR;
    
    // Security check - ensure path is within workspace
    if (!targetPath.startsWith(WORKSPACE_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const files = await listDirectory(targetPath);
    res.json(files);
  } catch (error) {
    console.error('Failed to list files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

app.post('/api/files/read', async (req, res) => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }
    
    const fullPath = path.resolve(WORKSPACE_DIR, filePath);
    
    // Security check
    if (!fullPath.startsWith(WORKSPACE_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const content = await fs.readFile(fullPath, 'utf-8');
    res.send(content);
  } catch (error) {
    console.error('Failed to read file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

app.post('/api/files/write', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }
    
    const fullPath = path.resolve(WORKSPACE_DIR, filePath);
    
    // Security check
    if (!fullPath.startsWith(WORKSPACE_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content || '', 'utf-8');
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to write file:', error);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// Chat endpoint (alias to anthropic proxy)
app.post('/api/chat', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(400).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Transform simple chat format to Anthropic API format if needed
    let requestBody = req.body;
    
    // If it's a simple message, wrap it in Anthropic format
    if (req.body.message && typeof req.body.message === 'string') {
      requestBody = {
        model: process.env.MODEL || 'claude-sonnet-4-20250514',
        max_tokens: parseInt(process.env.MAX_TOKENS) || 4096,
        messages: [
          {
            role: 'user',
            content: req.body.message
          }
        ]
      };
    }

    console.log('Chat request to Anthropic API...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', response.status, errorData);
      return res.status(response.status).send(errorData);
    }

    // Handle streaming response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      response.body.pipe(res);
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Anthropic API proxy for Claude conversations
app.post('/api/anthropic/v1/messages', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(400).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    console.log('Proxying request to Anthropic API...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', response.status, errorData);
      return res.status(response.status).send(errorData);
    }

    // Handle streaming response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      response.body.pipe(res);
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error('Anthropic API proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy Anthropic API request' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    anthropic_configured: !!ANTHROPIC_API_KEY,
    workspace: WORKSPACE_DIR 
  });
});

// Serve React app (must be last route)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
async function startServer() {
  await ensureWorkspaceDir();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Claudia server running on port ${PORT}`);
    console.log(`📁 Workspace directory: ${WORKSPACE_DIR}`);
    console.log(`🔑 Anthropic API Key: ${ANTHROPIC_API_KEY ? 'configured' : 'missing'}`);
  });
}

startServer().catch(console.error);