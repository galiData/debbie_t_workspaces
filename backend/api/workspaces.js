// backend/api/workspaces.js
// Node.js/Express API endpoints for Pinecone integration

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import express from 'express';

const router = express.Router();

// Initialize Pinecone and OpenAI
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const index = pinecone.index(process.env.PINECONE_INDEX || 'bill-debbie-workspace');

// Helper function to generate embeddings
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Helper function to create searchable text from workspace
function createSearchableText(workspace) {
  const sections = workspace.sections || {};

  // Combine all relevant text fields for embedding
  const textParts = [
    workspace.name,
    workspace.owner,
    sections.role?.description,
    sections.goal,
    ...(sections.responsibilities || []).map(r => typeof r === 'string' ? r : r.content),
    sections.communicationStyle?.tone,
    sections.communicationStyle?.personality,
    sections.communicationStyle?.approach,
    ...(sections.responseGuidelines || []).map(g => typeof g === 'string' ? g : g.content),
    sections.triggers,
    sections.subjectMatterExpert,
    ...(sections.examples || []).map(ex => `Q: ${ex.question} A: ${ex.answer}`),
  ].filter(Boolean);

  return textParts.join(' ');
}

// CREATE - Save workspace to Pinecone
router.post('/workspaces', async (req, res) => {
  try {
    const workspace = req.body;

    // Generate embedding from workspace content
    const searchableText = createSearchableText(workspace);
    const embedding = await generateEmbedding(searchableText);

    // Prepare metadata (Pinecone has metadata size limits)
    const metadata = {
      name: workspace.name,
      owner: workspace.owner || '',
      isDefault: workspace.isDefault || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Store key fields in metadata for filtering
      knowledgeBases: (workspace.sections?.knowledgeBases || []).join(','),
      triggers: workspace.sections?.triggers || '',
    };

    // Store in Pinecone
    const vectorId = workspace.id ? `workspace_${workspace.id}` : `workspace_${Date.now()}`;

    await index.upsert([{
      id: vectorId,
      values: embedding,
      metadata: {
        ...metadata,
        workspaceData: JSON.stringify(workspace), // Store full workspace data
      }
    }]);

    res.json({
      success: true,
      id: vectorId,
      workspace: { ...workspace, vectorId }
    });

  } catch (error) {
    console.error('Error saving workspace:', error);
    res.status(500).json({ error: 'Failed to save workspace' });
  }
});

// READ - Get all workspaces
router.get('/workspaces', async (req, res) => {
  try {
    // Query all workspace vectors
    const queryResponse = await index.query({
      vector: new Array(1536).fill(0), // Dummy vector for listing
      topK: 100, // Adjust based on your needs
      includeMetadata: true,
      filter: { }, // Add filters if needed
    });

    const workspaces = queryResponse.matches
      .filter(match => match.metadata?.workspaceData)
      .map(match => {
        try {
          const workspace = JSON.parse(match.metadata.workspaceData);
          return {
            ...workspace,
            vectorId: match.id,
            score: match.score,
          };
        } catch (e) {
          console.error('Error parsing workspace data:', e);
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    res.json({ workspaces });

  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// READ - Get workspace by ID
router.get('/workspaces/:id', async (req, res) => {
  try {
    const vectorId = req.params.id.startsWith('workspace_') ?
      req.params.id : `workspace_${req.params.id}`;

    const fetchResponse = await index.fetch([vectorId]);

    if (!fetchResponse.vectors[vectorId]) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const vector = fetchResponse.vectors[vectorId];
    const workspace = JSON.parse(vector.metadata.workspaceData);

    res.json({
      workspace: {
        ...workspace,
        vectorId: vectorId,
      }
    });

  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// UPDATE - Update existing workspace
router.put('/workspaces/:id', async (req, res) => {
  try {
    const vectorId = req.params.id.startsWith('workspace_') ?
      req.params.id : `workspace_${req.params.id}`;
    const workspace = req.body;

    // Generate new embedding
    const searchableText = createSearchableText(workspace);
    const embedding = await generateEmbedding(searchableText);

    // Update metadata
    const metadata = {
      name: workspace.name,
      owner: workspace.owner || '',
      isDefault: workspace.isDefault || false,
      updatedAt: new Date().toISOString(),
      knowledgeBases: (workspace.sections?.knowledgeBases || []).join(','),
      triggers: workspace.sections?.triggers || '',
      workspaceData: JSON.stringify(workspace),
    };

    // Update in Pinecone
    await index.upsert([{
      id: vectorId,
      values: embedding,
      metadata,
    }]);

    res.json({
      success: true,
      workspace: { ...workspace, vectorId }
    });

  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// DELETE - Delete workspace
router.delete('/workspaces/:id', async (req, res) => {
  try {
    const vectorId = req.params.id.startsWith('workspace_') ?
      req.params.id : `workspace_${req.params.id}`;

    await index.deleteOne(vectorId);

    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// SEARCH - Semantic search workspaces
router.post('/workspaces/search', async (req, res) => {
  try {
    const { query, filters = {}, topK = 10 } = req.body;

    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(query);

    // Search in Pinecone
    const searchResponse = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: filters,
    });

    const results = searchResponse.matches
      .filter(match => match.metadata?.workspaceData)
      .map(match => {
        try {
          const workspace = JSON.parse(match.metadata.workspaceData);
          return {
            ...workspace,
            vectorId: match.id,
            score: match.score,
          };
        } catch (e) {
          console.error('Error parsing workspace data:', e);
          return null;
        }
      })
      .filter(Boolean);

    res.json({ results });

  } catch (error) {
    console.error('Error searching workspaces:', error);
    res.status(500).json({ error: 'Failed to search workspaces' });
  }
});

// BULK OPERATIONS
router.post('/workspaces/bulk', async (req, res) => {
  try {
    const { operation, workspaces } = req.body;

    if (operation === 'create') {
      const vectors = [];

      for (const workspace of workspaces) {
        const searchableText = createSearchableText(workspace);
        const embedding = await generateEmbedding(searchableText);
        const vectorId = workspace.id ? `workspace_${workspace.id}` : `workspace_${Date.now()}_${Math.random()}`;

        vectors.push({
          id: vectorId,
          values: embedding,
          metadata: {
            name: workspace.name,
            owner: workspace.owner || '',
            isDefault: workspace.isDefault || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            knowledgeBases: (workspace.sections?.knowledgeBases || []).join(','),
            triggers: workspace.sections?.triggers || '',
            workspaceData: JSON.stringify(workspace),
          }
        });
      }

      await index.upsert(vectors);
      res.json({ success: true, created: vectors.length });

    } else if (operation === 'delete') {
      const vectorIds = workspaces.map(id =>
        id.startsWith('workspace_') ? id : `workspace_${id}`
      );

      await index.deleteMany(vectorIds);
      res.json({ success: true, deleted: vectorIds.length });
    }

  } catch (error) {
    console.error('Error in bulk operation:', error);
    res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
});

export default router;