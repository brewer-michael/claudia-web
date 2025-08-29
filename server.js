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

// Serve React app
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