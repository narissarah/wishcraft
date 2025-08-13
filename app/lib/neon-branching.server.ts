import { log } from "~/lib/logger.server";

/**
 * Neon Database Branching Utilities
 * For safe schema migrations and feature development
 */

interface NeonBranch {
  id: string;
  name: string;
  parent_id: string;
  created_at: string;
  updated_at: string;
}

interface CreateBranchOptions {
  name: string;
  parent?: string;
  ttl?: number; // Time to live in hours
}

const NEON_API_BASE = "https://api.neon.tech/v2";

/**
 * Get Neon project ID from DATABASE_URL
 */
function getProjectId(): string | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  
  // Extract project ID from hostname: ep-xxx-xxx-PROJECT_ID.region.aws.neon.tech
  const match = dbUrl.match(/ep-[^-]+-[^-]+-([^.]+)\./);
  return match ? match[1] : null;
}

/**
 * Create a new database branch
 */
export async function createDatabaseBranch(options: CreateBranchOptions): Promise<NeonBranch | null> {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = getProjectId();
  
  if (!apiKey || !projectId) {
    log.warn("Neon API key or project ID not configured");
    return null;
  }
  
  try {
    const body: any = {
      name: options.name,
      parent_id: options.parent || "main",
    };
    
    // Add TTL if specified (in seconds)
    if (options.ttl) {
      body.ttl = options.ttl * 3600;
    }
    
    const response = await fetch(`${NEON_API_BASE}/projects/${projectId}/branches`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ branch: body }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create branch: ${response.statusText}`);
    }
    
    const data = await response.json();
    log.info("Created Neon branch", { branch: data.branch.name });
    
    return data.branch;
  } catch (error) {
    log.error("Failed to create Neon branch", { error, options });
    return null;
  }
}

/**
 * List all database branches
 */
export async function listDatabaseBranches(): Promise<NeonBranch[]> {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = getProjectId();
  
  if (!apiKey || !projectId) {
    return [];
  }
  
  try {
    const response = await fetch(`${NEON_API_BASE}/projects/${projectId}/branches`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list branches: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.branches;
  } catch (error) {
    log.error("Failed to list Neon branches", { error });
    return [];
  }
}

/**
 * Delete a database branch
 */
export async function deleteDatabaseBranch(branchId: string): Promise<boolean> {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = getProjectId();
  
  if (!apiKey || !projectId) {
    return false;
  }
  
  try {
    const response = await fetch(`${NEON_API_BASE}/projects/${projectId}/branches/${branchId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete branch: ${response.statusText}`);
    }
    
    log.info("Deleted Neon branch", { branchId });
    return true;
  } catch (error) {
    log.error("Failed to delete Neon branch", { error, branchId });
    return false;
  }
}

/**
 * Create a development branch for a feature
 */
export async function createFeatureBranch(featureName: string): Promise<NeonBranch | null> {
  const branchName = `feature/${featureName.toLowerCase().replace(/\s+/g, '-')}`;
  
  return createDatabaseBranch({
    name: branchName,
    parent: "main",
    ttl: 168, // 7 days
  });
}

/**
 * Create a checkpoint branch for backup
 */
export async function createCheckpointBranch(description: string): Promise<NeonBranch | null> {
  const timestamp = new Date().toISOString().split('T')[0];
  const branchName = `checkpoint/${timestamp}-${description.toLowerCase().replace(/\s+/g, '-')}`;
  
  return createDatabaseBranch({
    name: branchName,
    parent: "main",
  });
}

/**
 * Get branch connection string
 */
export function getBranchConnectionString(branchId: string): string {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error("DATABASE_URL not configured");
  }
  
  // Replace the branch ID in the connection string
  // Format: postgresql://user:pass@ep-xxx-xxx-BRANCH_ID.region.aws.neon.tech/db
  return baseUrl.replace(/(@ep-[^-]+-[^-]+-)([^.]+)/, `$1${branchId}`);
}

/**
 * Clean up old feature branches
 */
export async function cleanupOldBranches(daysOld: number = 7): Promise<number> {
  const branches = await listDatabaseBranches();
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  let deletedCount = 0;
  
  for (const branch of branches) {
    // Skip main branch and checkpoints
    if (branch.name === "main" || branch.name.startsWith("checkpoint/")) {
      continue;
    }
    
    const createdDate = new Date(branch.created_at);
    if (createdDate < cutoffDate) {
      const success = await deleteDatabaseBranch(branch.id);
      if (success) {
        deletedCount++;
      }
    }
  }
  
  log.info("Cleaned up old branches", { deletedCount, daysOld });
  return deletedCount;
}