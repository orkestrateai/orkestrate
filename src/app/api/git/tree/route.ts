import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { authenticateRequestUser } from "@/lib/auth-user-request";

const execAsync = promisify(exec);

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  aggregateSize?: number;
  fileCount?: number;
  children?: FileNode[];
}

interface GitTreeEntry {
  path: string;
  size: number;
}

function parseLsTreeEntries(output: string): GitTreeEntry[] {
  const entries: GitTreeEntry[] = [];
  const lines = output.split("\n").filter(Boolean);
  const pattern = /^\d+\s+(?:blob|commit)\s+[a-f0-9]{40}\s+(\d+|-)\t(.+)$/;

  for (const line of lines) {
    const match = pattern.exec(line);
    if (!match) continue;

    const rawSize = match[1];
    const path = match[2];
    entries.push({
      path,
      size: rawSize === "-" ? 0 : Number(rawSize),
    });
  }

  return entries;
}

function sortNodes(nodes: FileNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  nodes.forEach((node) => {
    if (node.children) sortNodes(node.children);
  });
}

function annotateDirectoryStats(nodes: FileNode[]): { aggregateSize: number; fileCount: number } {
  let aggregateSize = 0;
  let fileCount = 0;

  for (const node of nodes) {
    if (node.type === "file") {
      const size = Number.isFinite(node.size) ? Number(node.size) : 0;
      node.aggregateSize = size;
      node.fileCount = 1;
      aggregateSize += size;
      fileCount += 1;
      continue;
    }

    const childStats = annotateDirectoryStats(node.children || []);
    node.aggregateSize = childStats.aggregateSize;
    node.fileCount = childStats.fileCount;
    aggregateSize += childStats.aggregateSize;
    fileCount += childStats.fileCount;
  }

  return { aggregateSize, fileCount };
}

function buildTree(entries: GitTreeEntry[]): FileNode[] {
  const root: FileNode[] = [];
  
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let currentLevel = root;
    let currentPath = "";
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;
      
      let node = currentLevel.find(n => n.name === part);
      
      if (!node) {
        node = {
          name: part,
          type: isLast ? 'file' : 'directory',
          path: currentPath,
        };
        if (isLast) {
          node.size = entry.size;
        }
        if (!isLast) {
          node.children = [];
        }
        currentLevel.push(node);
      }
      
      if (node.children) {
        currentLevel = node.children;
      }
    }
  }
  
  sortNodes(root);
  annotateDirectoryStats(root);
  return root;
}

export async function GET(req: NextRequest) {
  try {
    await authenticateRequestUser(req);
    // For now, if no user, we might want to check if we are in dev mode OR just allow for local lab
    // But let's follow standard auth if it exists
    // if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [treeResult, branchResult, headResult] = await Promise.all([
      execAsync("git ls-tree -r -l --full-tree HEAD", { maxBuffer: 20 * 1024 * 1024 }),
      execAsync("git rev-parse --abbrev-ref HEAD"),
      execAsync("git rev-parse HEAD"),
    ]);

    const entries = parseLsTreeEntries(treeResult.stdout);
    const tree = buildTree(entries);
    const totalBytes = entries.reduce((sum, item) => sum + item.size, 0);
    const branch = branchResult.stdout.trim() || "unknown";
    const commit = headResult.stdout.trim() || "unknown";

    return NextResponse.json({ 
        tree,
        repo: "orkestrate",
        branch,
        commit,
        stats: {
          totalFiles: entries.length,
          totalBytes,
        },
    }, { 
        headers: { "Cache-Control": "no-store" } 
    });
  } catch (error) {
    console.error("Git tree fetch error:", error);
    return NextResponse.json({ 
        error: "Internal server error", 
        detail: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
