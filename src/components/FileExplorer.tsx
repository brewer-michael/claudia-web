import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  Plus,
  MoreHorizontal,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import { containerAPI } from '@/lib/containerAPI';

interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size?: number;
  modified?: string;
  children?: FileEntry[];
  expanded?: boolean;
}

interface FileExplorerProps {
  projectPath?: string;
  projectId?: string;
  onFileSelect?: (filePath: string) => void;
  onFileCreate?: (filePath: string, isDirectory: boolean) => void;
  className?: string;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  projectPath,
  projectId,
  onFileSelect,
  onFileCreate,
  className = ''
}) => {
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState<FileEntry[]>([]);

  // Load file tree when project path changes
  useEffect(() => {
    if (projectPath) {
      loadFileTree();
    }
  }, [projectPath]);

  // Filter files based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = filterFiles(fileTree, searchQuery.toLowerCase());
      setFilteredFiles(filtered);
    } else {
      setFilteredFiles([]);
    }
  }, [searchQuery, fileTree]);

  const loadFileTree = async (path?: string) => {
    if (!projectPath || !projectId) return;

    try {
      setLoading(true);
      
      // Use container API to list project files
      const containerFiles = await containerAPI.listProjectFiles(projectId, path);
      
      // Convert container files to file entries
      const entries = containerFiles.map(file => ({
        name: file.name,
        path: file.path,
        is_directory: file.is_directory,
        size: file.size,
        modified: new Date(file.modified).toISOString(),
        children: file.is_directory ? [] : undefined,
        expanded: false
      }));
      
      if (!path) {
        // Initial load - set root
        setFileTree(entries);
      } else {
        // Expand a specific directory
        setFileTree(prev => updateTreeWithChildren(prev, path, entries));
      }
    } catch (error) {
      console.error('Failed to load file tree:', error);
      
      // Fallback to regular API if container API fails
      try {
        const targetPath = path || projectPath;
        const entries = await api.listDirectoryContents(targetPath);
        
        if (!path) {
          const tree = entries.map(entry => ({
            ...entry,
            children: entry.is_directory ? [] : undefined,
            expanded: false
          }));
          setFileTree(tree);
        } else {
          setFileTree(prev => updateTreeWithChildren(prev, path, entries));
        }
      } catch (fallbackError) {
        console.error('Fallback API also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateTreeWithChildren = (tree: FileEntry[], targetPath: string, children: FileEntry[]): FileEntry[] => {
    return tree.map(item => {
      if (item.path === targetPath && item.is_directory) {
        return {
          ...item,
          children: children.map(child => ({
            ...child,
            children: child.is_directory ? [] : undefined,
            expanded: false
          })),
          expanded: true
        };
      } else if (item.children) {
        return {
          ...item,
          children: updateTreeWithChildren(item.children, targetPath, children)
        };
      }
      return item;
    });
  };

  const toggleDirectory = async (entry: FileEntry) => {
    if (!entry.is_directory) return;

    const isExpanded = expandedPaths.has(entry.path);
    const newExpandedPaths = new Set(expandedPaths);

    if (isExpanded) {
      newExpandedPaths.delete(entry.path);
    } else {
      newExpandedPaths.add(entry.path);
      // Load children if not already loaded
      if (!entry.children || entry.children.length === 0) {
        await loadFileTree(entry.path);
      }
    }

    setExpandedPaths(newExpandedPaths);
  };

  const handleFileClick = (entry: FileEntry) => {
    if (entry.is_directory) {
      toggleDirectory(entry);
    } else {
      onFileSelect?.(entry.path);
    }
  };

  const filterFiles = (files: FileEntry[], query: string): FileEntry[] => {
    const result: FileEntry[] = [];

    const searchInTree = (items: FileEntry[], parent?: FileEntry): void => {
      for (const item of items) {
        if (item.name.toLowerCase().includes(query)) {
          result.push({
            ...item,
            path: parent ? `${parent.path}/${item.name}` : item.path
          });
        }
        if (item.children) {
          searchInTree(item.children, item);
        }
      }
    };

    searchInTree(files);
    return result;
  };

  const getFileIcon = (entry: FileEntry) => {
    if (entry.is_directory) {
      const isExpanded = expandedPaths.has(entry.path);
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 text-blue-500" />
      ) : (
        <Folder className="h-4 w-4 text-blue-500" />
      );
    }
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const getChevronIcon = (entry: FileEntry) => {
    if (!entry.is_directory) return null;
    
    const isExpanded = expandedPaths.has(entry.path);
    return isExpanded ? (
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    ) : (
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
    );
  };

  const renderFileTree = (files: FileEntry[], depth = 0) => {
    return files.map((entry) => (
      <motion.div
        key={entry.path}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        <div
          className={`
            flex items-center gap-1 px-2 py-1 text-sm cursor-pointer
            hover:bg-accent/50 rounded-sm
            ${depth > 0 ? `ml-${Math.min(depth * 4, 12)}` : ''}
          `}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => handleFileClick(entry)}
        >
          <div className="flex items-center flex-1 gap-2">
            {getChevronIcon(entry)}
            {getFileIcon(entry)}
            <span className="truncate flex-1">{entry.name}</span>
          </div>
        </div>
        
        {/* Render children if expanded */}
        <AnimatePresence>
          {entry.is_directory && expandedPaths.has(entry.path) && entry.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {renderFileTree(entry.children, depth + 1)}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    ));
  };

  const renderSearchResults = (files: FileEntry[]) => {
    return files.map((entry) => (
      <motion.div
        key={entry.path}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-accent/50 rounded-sm"
        onClick={() => handleFileClick(entry)}
      >
        {getFileIcon(entry)}
        <span className="truncate flex-1">{entry.path}</span>
      </motion.div>
    ));
  };

  if (!projectPath) {
    return (
      <div className={`border-r bg-muted/30 ${className}`}>
        <div className="p-4 text-center text-sm text-muted-foreground">
          <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No project selected</p>
          <p className="text-xs mt-1">Open a project to browse files</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`border-r bg-muted/30 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="text-sm font-medium">Explorer</h3>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onFileCreate?.(projectPath, false)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New File</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>More Actions</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {/* Project name */}
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b">
        {projectPath.split('/').pop() || 'Project'}
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Loading files...
          </div>
        ) : searchQuery.trim() ? (
          <div className="p-1">
            {filteredFiles.length > 0 ? (
              renderSearchResults(filteredFiles)
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No files found matching "{searchQuery}"
              </div>
            )}
          </div>
        ) : (
          <div className="p-1">
            {renderFileTree(fileTree)}
          </div>
        )}
      </div>
    </div>
  );
};