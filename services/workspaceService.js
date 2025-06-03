// services/workspaceService.js
// Frontend service for Pinecone workspace operations

class WorkspaceService {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  // Helper method for API calls
  async apiCall(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API call failed: ${endpoint}`, error);
      throw error;
    }
  }

  // CREATE - Save workspace
  async saveWorkspace(workspace) {
    try {
      const response = await this.apiCall('/workspaces', {
        method: 'POST',
        body: JSON.stringify(workspace),
      });

      return response.workspace;
    } catch (error) {
      throw new Error(`Failed to save workspace: ${error.message}`);
    }
  }

  // READ - Get all workspaces
  async getWorkspaces() {
    try {
      const response = await this.apiCall('/workspaces');
      return response.workspaces || [];
    } catch (error) {
      throw new Error(`Failed to fetch workspaces: ${error.message}`);
    }
  }

  // READ - Get workspace by ID
  async getWorkspace(id) {
    try {
      const response = await this.apiCall(`/workspaces/${id}`);
      return response.workspace;
    } catch (error) {
      if (error.message.includes('404')) {
        throw new Error('Workspace not found');
      }
      throw new Error(`Failed to fetch workspace: ${error.message}`);
    }
  }

  // UPDATE - Update workspace
  async updateWorkspace(id, workspace) {
    try {
      const response = await this.apiCall(`/workspaces/${id}`, {
        method: 'PUT',
        body: JSON.stringify(workspace),
      });

      return response.workspace;
    } catch (error) {
      throw new Error(`Failed to update workspace: ${error.message}`);
    }
  }

  // DELETE - Delete workspace
  async deleteWorkspace(id) {
    try {
      await this.apiCall(`/workspaces/${id}`, {
        method: 'DELETE',
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to delete workspace: ${error.message}`);
    }
  }

  // SEARCH - Semantic search
  async searchWorkspaces(query, options = {}) {
    try {
      const { filters = {}, topK = 10 } = options;

      const response = await this.apiCall('/workspaces/search', {
        method: 'POST',
        body: JSON.stringify({ query, filters, topK }),
      });

      return response.results || [];
    } catch (error) {
      throw new Error(`Failed to search workspaces: ${error.message}`);
    }
  }

  // BULK OPERATIONS
  async bulkCreateWorkspaces(workspaces) {
    try {
      const response = await this.apiCall('/workspaces/bulk', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'create',
          workspaces,
        }),
      });

      return response;
    } catch (error) {
      throw new Error(`Failed to bulk create workspaces: ${error.message}`);
    }
  }

  async bulkDeleteWorkspaces(workspaceIds) {
    try {
      const response = await this.apiCall('/workspaces/bulk', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'delete',
          workspaces: workspaceIds,
        }),
      });

      return response;
    } catch (error) {
      throw new Error(`Failed to bulk delete workspaces: ${error.message}`);
    }
  }

  // Utility methods
  async syncWorkspaces(localWorkspaces) {
    try {
      // Get remote workspaces
      const remoteWorkspaces = await this.getWorkspaces();
      const remoteMap = new Map(remoteWorkspaces.map(w => [w.id, w]));

      const toCreate = [];
      const toUpdate = [];

      for (const localWorkspace of localWorkspaces) {
        const remote = remoteMap.get(localWorkspace.id);

        if (!remote) {
          toCreate.push(localWorkspace);
        } else if (this.isWorkspaceNewer(localWorkspace, remote)) {
          toUpdate.push(localWorkspace);
        }
      }

      // Perform sync operations
      const results = {
        created: 0,
        updated: 0,
        errors: [],
      };

      // Create new workspaces
      for (const workspace of toCreate) {
        try {
          await this.saveWorkspace(workspace);
          results.created++;
        } catch (error) {
          results.errors.push({ workspace: workspace.name, error: error.message });
        }
      }

      // Update existing workspaces
      for (const workspace of toUpdate) {
        try {
          await this.updateWorkspace(workspace.id, workspace);
          results.updated++;
        } catch (error) {
          results.errors.push({ workspace: workspace.name, error: error.message });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to sync workspaces: ${error.message}`);
    }
  }

  // Helper to compare workspace versions
  isWorkspaceNewer(local, remote) {
    const localDate = new Date(local.updatedAt || local.createdAt || 0);
    const remoteDate = new Date(remote.updatedAt || remote.createdAt || 0);
    return localDate > remoteDate;
  }

  // Export workspace data
  async exportWorkspaces(workspaceIds = null) {
    try {
      let workspaces;

      if (workspaceIds) {
        workspaces = await Promise.all(
          workspaceIds.map(id => this.getWorkspace(id))
        );
      } else {
        workspaces = await this.getWorkspaces();
      }

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        workspaces: workspaces.map(({ vectorId, score, ...workspace }) => workspace),
      };

      return exportData;
    } catch (error) {
      throw new Error(`Failed to export workspaces: ${error.message}`);
    }
  }

  // Import workspace data
  async importWorkspaces(exportData, options = {}) {
    try {
      const { overwrite = false, validateFirst = true } = options;

      if (validateFirst) {
        this.validateImportData(exportData);
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: [],
      };

      for (const workspace of exportData.workspaces) {
        try {
          if (!overwrite) {
            // Check if workspace exists
            try {
              await this.getWorkspace(workspace.id);
              results.skipped++;
              continue;
            } catch (error) {
              // Workspace doesn't exist, proceed with import
            }
          }

          await this.saveWorkspace(workspace);
          results.imported++;
        } catch (error) {
          results.errors.push({
            workspace: workspace.name || workspace.id,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to import workspaces: ${error.message}`);
    }
  }

  validateImportData(data) {
    if (!data || !data.workspaces || !Array.isArray(data.workspaces)) {
      throw new Error('Invalid import data format');
    }

    for (const workspace of data.workspaces) {
      if (!workspace.id || !workspace.name) {
        throw new Error('Invalid workspace data: missing id or name');
      }
    }
  }
}

// Create and export singleton instance
const workspaceService = new WorkspaceService();
export default workspaceService;