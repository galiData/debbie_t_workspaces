import React, { useState, useEffect } from 'react';
import { Plus, Copy, Eye, EyeOff, FileText, Bot, Zap, Search, Trash2, Edit3, MessageCircle, HelpCircle, Save, AlertCircle, RefreshCw } from 'lucide-react';

// Direct Pinecone & OpenAI Integration (No Backend Needed!)
class WorkspaceService {
  constructor() {
    // These would come from environment variables in a real app
    // For demo, you'll need to set these directly (NOT recommended for production)
    this.openaiApiKey = process.env.REACT_APP_OPENAI_API_KEY;
    this.pineconeApiKey = process.env.REACT_APP_PINECONE_API_KEY;
    this.pineconeHost = 'https://bill-debbie-workspace-kpyty8f.svc.aped-4627-b74a.pinecone.io';
  }

  // Generate embeddings using OpenAI
  async generateEmbedding(text) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  // Create searchable text from workspace
  createSearchableText(workspace) {
    const sections = workspace.sections || {};
    const textParts = [
      workspace.name,
      workspace.owner,
      sections.role?.description,
      sections.goal,
      ...(sections.responsibilities || []).map(r => typeof r === 'string' ? r : r.content).filter(Boolean),
      sections.communicationStyle?.tone,
      sections.communicationStyle?.personality,
      sections.communicationStyle?.approach,
      ...(sections.responseGuidelines || []).map(g => typeof g === 'string' ? g : g.content).filter(Boolean),
      sections.triggers,
      sections.subjectMatterExpert,
      ...(sections.examples || []).map(ex => `Q: ${ex.question} A: ${ex.answer}`).filter(Boolean),
    ].filter(Boolean);

    return textParts.join(' ');
  }

  // Save workspace to Pinecone
  async saveWorkspace(workspace) {
    try {
      console.log('🔄 Generating embedding for workspace...');

      // Generate embedding
      const searchableText = this.createSearchableText(workspace);
      const embedding = await this.generateEmbedding(searchableText);

      console.log('✅ Embedding generated, saving to Pinecone...');

      // Prepare vector data
      const vectorId = `workspace_${workspace.id}`;
      const metadata = {
        name: workspace.name,
        owner: workspace.owner || '',
        isDefault: workspace.isDefault || false,
        createdAt: workspace.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        knowledgeBases: (workspace.sections?.knowledgeBases || []).join(','),
        triggers: workspace.sections?.triggers || '',
        workspaceData: JSON.stringify(workspace),
      };

      // Save to Pinecone
      const response = await fetch(`${this.pineconeHost}/vectors/upsert`, {
        method: 'POST',
        headers: {
          'Api-Key': this.pineconeApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vectors: [{
            id: vectorId,
            values: embedding,
            metadata: metadata,
          }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinecone error: ${response.status} - ${errorText}`);
      }

      console.log('✅ Workspace saved to Pinecone successfully!');

      return {
        ...workspace,
        vectorId: vectorId,
        lastSaved: new Date().toISOString(),
        syncedToPinecone: true,
      };

    } catch (error) {
      console.error('❌ Error saving to Pinecone:', error);
      throw error;
    }
  }

  // Get all workspaces from Pinecone
  async getWorkspaces() {
    try {
      console.log('🔄 Fetching workspaces from Pinecone...');

      // Query all workspace vectors (using a dummy vector for listing)
      const response = await fetch(`${this.pineconeHost}/query`, {
        method: 'POST',
        headers: {
          'Api-Key': this.pineconeApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vector: new Array(1536).fill(0.1), // Dummy vector for listing
          topK: 100,
          includeMetadata: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinecone error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      const workspaces = data.matches
        ?.filter(match => match.metadata?.workspaceData)
        .map(match => {
          try {
            const workspace = JSON.parse(match.metadata.workspaceData);
            return {
              ...workspace,
              vectorId: match.id,
              score: match.score,
              lastSaved: match.metadata.updatedAt,
              syncedToPinecone: true,
            };
          } catch (e) {
            console.error('Error parsing workspace data:', e);
            return null;
          }
        })
        .filter(Boolean) || [];

      console.log(`✅ Found ${workspaces.length} workspaces in Pinecone`);
      return workspaces;

    } catch (error) {
      console.error('❌ Error fetching from Pinecone:', error);
      throw error;
    }
  }

  // Update workspace in Pinecone
  async updateWorkspace(id, workspace) {
    // For Pinecone, update is the same as save (upsert)
    return await this.saveWorkspace(workspace);
  }

  // Delete workspace from Pinecone
  async deleteWorkspace(id) {
    try {
      const vectorId = id.toString().startsWith('workspace_') ? id : `workspace_${id}`;

      console.log(`🗑️ Deleting workspace from Pinecone: ${vectorId}`);

      const response = await fetch(`${this.pineconeHost}/vectors/delete`, {
        method: 'POST',
        headers: {
          'Api-Key': this.pineconeApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: [vectorId],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinecone error: ${response.status} - ${errorText}`);
      }

      console.log('✅ Workspace deleted from Pinecone');
      return true;

    } catch (error) {
      console.error('❌ Error deleting from Pinecone:', error);
      throw error;
    }
  }

  // Search workspaces semantically
  async searchWorkspaces(query, options = {}) {
    try {
      const { topK = 10 } = options;

      console.log(`🔍 Searching for: "${query}"`);

      // Generate embedding for search query
      const queryEmbedding = await this.generateEmbedding(query);

      // Search in Pinecone
      const response = await fetch(`${this.pineconeHost}/query`, {
        method: 'POST',
        headers: {
          'Api-Key': this.pineconeApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vector: queryEmbedding,
          topK: topK,
          includeMetadata: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinecone error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      const results = data.matches
        ?.filter(match => match.metadata?.workspaceData)
        .map(match => {
          try {
            const workspace = JSON.parse(match.metadata.workspaceData);
            return {
              ...workspace,
              vectorId: match.id,
              score: match.score,
              relevanceScore: Math.round(match.score * 100),
            };
          } catch (e) {
            console.error('Error parsing workspace data:', e);
            return null;
          }
        })
        .filter(Boolean) || [];

      console.log(`✅ Found ${results.length} matching workspaces`);
      return results;

    } catch (error) {
      console.error('❌ Error searching Pinecone:', error);
      throw error;
    }
  }
}

// Service instance ready for direct Pinecone integration
const workspaceService = new WorkspaceService();

const DebbieWorkspace = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(0);
  const [showFormatted, setShowFormatted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingWorkspaceName, setEditingWorkspaceName] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const createDefaultWorkspace = () => ({
    id: Date.now(), // Use timestamp to ensure uniqueness
    name: 'Default Assistant',
    owner: 'Data Engineering Team',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedToPinecone: false, // Will be true after first save
    sections: {
      role: {
        name: 'Debbie T.',
        description: 'The Data Platform Co-Assistant — your friendly guide to navigating the complexities of our data ecosystem.'
      },
      goal: 'Provide comprehensive assistance for data platform users by leveraging multiple knowledge sources.',
      knowledgeBases: ['DBT', 'Jira', 'Asana', 'Confluence'],
      responsibilities: [
        'Data Platform Navigation: Help users understand architecture and find documentation',
        'DBT Project Assistance: Analyze dependencies and optimize SQL',
      ],
      communicationStyle: {
        tone: 'Friendly, approachable, and slightly humorous while maintaining technical accuracy',
        personality: 'Enthusiastic learner who is eager to help but honest about still learning',
        approach: 'Collaborative and supportive, presenting as a helpful colleague'
      },
      responseGuidelines: [
        'Always consult relevant knowledge bases to provide comprehensive answers',
        'Reference specific sources when helpful',
      ],
      examples: [{
        id: 1,
        question: 'How should I structure my DBT models for customer data?',
        answer: 'Great question! From our Confluence standards, we follow a three-layer approach: staging → intermediate → marts.'
      }],
      triggers: 'Data transformation questions, DBT model inquiries, performance optimization requests',
      subjectMatterExpert: 'Data Engineering Team Lead with 5+ years experience',
      subjectMatterExpertEmail: 'gal.vekselman@hq.bill.com'
    }
  });

  const loadWorkspaces = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔄 Loading workspaces...');

      // Try to load from Pinecone first
      try {
        const pineconeWorkspaces = await workspaceService.getWorkspaces();

        if (pineconeWorkspaces.length > 0) {
          console.log(`✅ Loaded ${pineconeWorkspaces.length} workspaces from Pinecone`);
          setWorkspaces(pineconeWorkspaces);
          setActiveWorkspace(0);
        } else {
          // No workspaces in Pinecone, create default
          console.log('📝 No workspaces found in Pinecone, creating default workspace');
          const defaultWorkspace = createDefaultWorkspace();
          setWorkspaces([defaultWorkspace]);
          setActiveWorkspace(0);
        }
      } catch (pineconeError) {
        console.warn('⚠️ Could not load from Pinecone, using default workspace:', pineconeError.message);
        // Fallback to default workspace if Pinecone fails
        const defaultWorkspace = createDefaultWorkspace();
        setWorkspaces([defaultWorkspace]);
        setActiveWorkspace(0);
        setError(`Could not connect to Pinecone: ${pineconeError.message}`);
      }
    } catch (error) {
      console.error('❌ Failed to load workspaces:', error);
      setError('Failed to load workspaces.');
      // Last resort fallback
      const defaultWorkspace = createDefaultWorkspace();
      setWorkspaces([defaultWorkspace]);
      setActiveWorkspace(0);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshWorkspaces = async () => {
    setIsRefreshing(true);
    await loadWorkspaces();
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const safeGet = (obj, path, defaultValue = '') => {
    try {
      return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const safeArray = (arr) => Array.isArray(arr) ? arr : [];

  const getItemValue = (item) => {
    if (typeof item === 'object' && item !== null) {
      return item.content || '';
    }
    return item || '';
  };

  const getItemKey = (item, index) => {
    if (typeof item === 'object' && item !== null && item.id) {
      return `item-${item.id}`;
    }
    return `item-${index}`;
  };

  const generateFormattedPrompt = (workspace) => {
    if (!workspace?.sections) {
      return '<AgentInstructions>\n  <!-- Workspace data not available -->\n</AgentInstructions>';
    }

    const sections = workspace.sections;
    const knowledgeBaseDescriptions = {
      'DBT': 'For understanding data model dependencies, lineage, and project structure',
      'Confluence': 'For accessing team knowledge, processes, and best practices',
      'Jira': 'For tracking data-related tickets, issues, and project status',
      'Asana': 'For tracking data-related tickets, issues, and project status'
    };

    const knowledgeBases = safeArray(sections.knowledgeBases);
    const responsibilities = safeArray(sections.responsibilities).filter(r => getItemValue(r)?.trim());
    const responseGuidelines = safeArray(sections.responseGuidelines).filter(g => getItemValue(g)?.trim());
    const examples = safeArray(sections.examples).filter(ex => ex.question && ex.answer);

    return `<AgentInstructions>
  <Role>
    <Name>Debbie T.</Name>
    <Description>${safeGet(sections, 'role.description', 'Not specified')}</Description>
  </Role>
  
  <Goal>
    <Primary>${safeGet(sections, 'goal', 'Not specified')}</Primary>
  </Goal>
  
  <Capabilities>
    <KnowledgeBases>
${knowledgeBases.length > 0 ? knowledgeBases.map(kb => `      <Source name="${kb}">${knowledgeBaseDescriptions[kb] || 'Integration tool'}</Source>`).join('\n') : '      <Source>No knowledge bases selected</Source>'}
    </KnowledgeBases>
  </Capabilities>
  
  <Responsibilities>
${responsibilities.length > 0 ? responsibilities.map(resp => `    <Responsibility>${getItemValue(resp)}</Responsibility>`).join('\n') : '    <Responsibility>No responsibilities defined</Responsibility>'}
  </Responsibilities>
  
  <CommunicationStyle>
    <Tone>${safeGet(sections, 'communicationStyle.tone', 'Not specified')}</Tone>
    <Personality>${safeGet(sections, 'communicationStyle.personality', 'Not specified')}</Personality>
    <Approach>${safeGet(sections, 'communicationStyle.approach', 'Not specified')}</Approach>
  </CommunicationStyle>
  
  <ResponseGuidelines>
${responseGuidelines.length > 0 ? responseGuidelines.map(guideline => `    <Guideline>${getItemValue(guideline)}</Guideline>`).join('\n') : '    <Guideline>No guidelines defined</Guideline>'}
  </ResponseGuidelines>

  <TriggerConditions>
    <When>${safeGet(sections, 'triggers', 'Not specified')}</When>
  </TriggerConditions>

  <SubjectMatterExpert>
    <Profile>${safeGet(sections, 'subjectMatterExpert', 'Not specified')}</Profile>
    <Contact>${safeGet(sections, 'subjectMatterExpertEmail', 'Not specified')}</Contact>
  </SubjectMatterExpert>

  <Examples>
${examples.length > 0 ? examples.map(ex => `    <Example>
      <Question>${ex.question}</Question>
      <Answer>${ex.answer}</Answer>
    </Example>`).join('\n') : '    <Example>\n      <Question>No examples provided</Question>\n      <Answer>Please add example Q&A pairs</Answer>\n    </Example>'}
  </Examples>
</AgentInstructions>`;
  };

  const updateWorkspaceSection = (section, value) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      if (!updated[activeWorkspace]?.sections) return prev;

      if (section.includes('.')) {
        const [parent, child] = section.split('.');
        if (!updated[activeWorkspace].sections[parent]) {
          updated[activeWorkspace].sections[parent] = {};
        }
        updated[activeWorkspace].sections[parent][child] = value;
      } else {
        updated[activeWorkspace].sections[section] = value;
      }

      updated[activeWorkspace].updatedAt = new Date().toISOString();
      updated[activeWorkspace].syncedToPinecone = false; // Mark as needing sync
      return updated;
    });
  };

  const addWorkspace = () => {
    const newWorkspace = {
      id: Date.now(),
      name: `Workspace ${workspaces.length + 1}`,
      owner: '',
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedToPinecone: false,
      sections: {
        role: { name: 'Debbie T.', description: '' },
        goal: '',
        knowledgeBases: [],
        responsibilities: [''],
        communicationStyle: { tone: '', personality: '', approach: '' },
        responseGuidelines: [''],
        examples: [],
        triggers: '',
        subjectMatterExpert: '',
        subjectMatterExpertEmail: ''
      }
    };
    setWorkspaces(prev => [...prev, newWorkspace]);
    setActiveWorkspace(workspaces.length);
  };

  const addListItem = (section) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      if (!updated[activeWorkspace]?.sections) return prev;

      const currentArray = Array.isArray(updated[activeWorkspace].sections[section])
        ? [...updated[activeWorkspace].sections[section]]
        : [];

      const newItem = { id: Date.now() + Math.random(), content: '' };
      updated[activeWorkspace] = {
        ...updated[activeWorkspace],
        sections: {
          ...updated[activeWorkspace].sections,
          [section]: [...currentArray, newItem]
        },
        updatedAt: new Date().toISOString(),
        syncedToPinecone: false
      };

      return updated;
    });
  };

  const addExampleQA = () => {
    setWorkspaces(prev => {
      const updated = [...prev];
      if (!updated[activeWorkspace]?.sections) return prev;

      const currentExamples = Array.isArray(updated[activeWorkspace].sections.examples)
        ? [...updated[activeWorkspace].sections.examples]
        : [];

      const newExample = {
        id: Date.now() + Math.random(),
        question: '',
        answer: ''
      };

      updated[activeWorkspace] = {
        ...updated[activeWorkspace],
        sections: {
          ...updated[activeWorkspace].sections,
          examples: [...currentExamples, newExample]
        },
        updatedAt: new Date().toISOString(),
        syncedToPinecone: false
      };

      return updated;
    });
  };

  const updateExampleQA = (index, field, value) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      if (!updated[activeWorkspace]?.sections?.examples) return prev;

      const currentExamples = [...updated[activeWorkspace].sections.examples];
      if (currentExamples[index]) {
        currentExamples[index] = { ...currentExamples[index], [field]: value };
        updated[activeWorkspace] = {
          ...updated[activeWorkspace],
          sections: { ...updated[activeWorkspace].sections, examples: currentExamples },
          updatedAt: new Date().toISOString(),
          syncedToPinecone: false
        };
      }

      return updated;
    });
  };

  const removeExampleQA = (index) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      if (!updated[activeWorkspace]?.sections?.examples) return prev;

      const currentExamples = [...updated[activeWorkspace].sections.examples];
      currentExamples.splice(index, 1);

      updated[activeWorkspace] = {
        ...updated[activeWorkspace],
        sections: { ...updated[activeWorkspace].sections, examples: currentExamples },
        updatedAt: new Date().toISOString(),
        syncedToPinecone: false
      };

      return updated;
    });
  };

  const updateListItem = (section, index, value) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      if (!updated[activeWorkspace]?.sections?.[section]) return prev;

      const currentArray = Array.isArray(updated[activeWorkspace].sections[section])
        ? [...updated[activeWorkspace].sections[section]]
        : [];

      if (typeof currentArray[index] === 'object' && currentArray[index] !== null) {
        currentArray[index] = { ...currentArray[index], content: value };
      } else {
        currentArray[index] = value;
      }

      updated[activeWorkspace] = {
        ...updated[activeWorkspace],
        sections: { ...updated[activeWorkspace].sections, [section]: currentArray },
        updatedAt: new Date().toISOString(),
        syncedToPinecone: false
      };

      return updated;
    });
  };

  const removeListItem = (section, index) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      if (!updated[activeWorkspace]?.sections?.[section]) return prev;

      if (Array.isArray(updated[activeWorkspace].sections[section])) {
        updated[activeWorkspace].sections[section].splice(index, 1);
        updated[activeWorkspace].updatedAt = new Date().toISOString();
        updated[activeWorkspace].syncedToPinecone = false;
      }
      return updated;
    });
  };

  const deleteWorkspace = async (workspaceIndex) => {
    const workspace = workspaces[workspaceIndex];
    if (!workspace) return;

    try {
      // Delete from Pinecone if it was previously saved
      if (workspace.syncedToPinecone || workspace.vectorId) {
        setError(null);
        console.log(`🗑️ Deleting workspace "${workspace.name}" from Pinecone...`);
        await workspaceService.deleteWorkspace(workspace.id);
        console.log('✅ Workspace deleted from Pinecone');
      }

      // Remove from local state
      setWorkspaces(prev => prev.filter((_, index) => index !== workspaceIndex));

      // Adjust active workspace index
      if (activeWorkspace >= workspaceIndex) {
        setActiveWorkspace(Math.max(0, activeWorkspace - 1));
      }

      // If no workspaces left, create a default one
      if (workspaces.length === 1) {
        const defaultWorkspace = createDefaultWorkspace();
        setWorkspaces([defaultWorkspace]);
        setActiveWorkspace(0);
      }

    } catch (error) {
      console.error('❌ Error deleting workspace:', error);
      setError(`Failed to delete "${workspace.name}" from Pinecone: ${error.message}`);
      // Still remove from local state even if Pinecone deletion failed
      setWorkspaces(prev => prev.filter((_, index) => index !== workspaceIndex));
      if (activeWorkspace >= workspaceIndex) {
        setActiveWorkspace(Math.max(0, activeWorkspace - 1));
      }
    }
  };

  const updateWorkspaceName = (workspaceIndex, newName) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      updated[workspaceIndex].name = newName;
      updated[workspaceIndex].updatedAt = new Date().toISOString();
      updated[workspaceIndex].syncedToPinecone = false;
      return updated;
    });
  };

  const updateWorkspaceOwner = (owner) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      updated[activeWorkspace].owner = owner;
      updated[activeWorkspace].updatedAt = new Date().toISOString();
      updated[activeWorkspace].syncedToPinecone = false;
      return updated;
    });
  };

  const copyToClipboard = async () => {
    if (currentWorkspace) {
      const formatted = generateFormattedPrompt(currentWorkspace);
      await navigator.clipboard.writeText(formatted);
    }
  };

  const handleDeleteConfirm = (workspaceIndex, workspaceName) => {
    // eslint-disable-next-line no-restricted-globals
    const shouldDelete = confirm(`Are you sure you want to delete "${workspaceName}"? This will also remove it from Pinecone.`);
    if (shouldDelete) {
      deleteWorkspace(workspaceIndex);
    }
  };

  const saveCurrentWorkspace = async () => {
    if (!currentWorkspace) return;

    setIsSaving(true);
    setError(null);

    try {
      console.log('💾 Saving workspace to Pinecone:', currentWorkspace.name);

      // Real Pinecone save - now works directly from frontend!
      const savedWorkspace = await workspaceService.saveWorkspace(currentWorkspace);
      console.log('✅ Pinecone response:', savedWorkspace);

      // Update local state with save results
      setWorkspaces(prev => {
        const updated = [...prev];
        updated[activeWorkspace] = {
          ...savedWorkspace,
          lastSaved: new Date().toISOString(),
          syncedToPinecone: true
        };
        return updated;
      });

      setSaveStatus('success');
      console.log('🎉 Workspace saved successfully to Pinecone!');

      // Clear success message after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000);

    } catch (error) {
      console.error('❌ Failed to save workspace:', error);
      setSaveStatus('error');
      setError(`Failed to save "${currentWorkspace.name}": ${error.message}`);

      // Clear error status after 5 seconds
      setTimeout(() => setSaveStatus(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredWorkspaces = workspaces.filter(workspace =>
    workspace.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (workspace.owner || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading || workspaces.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Workspace...</h2>
          <p className="text-gray-600">Please wait while we initialize your workspace.</p>
        </div>
      </div>
    );
  }

  const currentWorkspace = workspaces[activeWorkspace];

  if (!currentWorkspace) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Workspace Error</h2>
          <p className="text-gray-600">Unable to load workspace. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Bot className="h-8 w-8 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">Debbie T. Workspace</h1>
              </div>
              <div className="text-sm text-gray-500">Build custom prompts for your data assistant</div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Refresh Button */}
              <button
                onClick={refreshWorkspaces}
                disabled={isRefreshing}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 text-gray-700 rounded-md transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              {/* Save Status Indicator - Enhanced */}
              {saveStatus && (
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  saveStatus === 'success' 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {saveStatus === 'success' ? (
                    <>
                      <span className="text-green-600">✅</span>
                      <span>Saved to Pinecone</span>
                    </>
                  ) : (
                    <>
                      <span className="text-red-600">❌</span>
                      <span>Save Failed</span>
                    </>
                  )}
                </div>
              )}

              {/* Save Button - Fixed styling to ensure visibility */}
              <button
                onClick={saveCurrentWorkspace}
                disabled={isSaving}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-md transition-colors disabled:opacity-75 disabled:cursor-not-allowed shadow-sm"
                style={{
                  backgroundColor: isSaving ? '#9CA3AF' : '#059669',
                  color: '#FFFFFF',
                  border: 'none'
                }}
              >
                <Save className="h-4 w-4" style={{ color: '#FFFFFF' }} />
                <span style={{ color: '#FFFFFF' }}>{isSaving ? 'Saving...' : 'Save to Pinecone'}</span>
              </button>

              {/* Show/Hide Formatted Toggle */}
              <button
                onClick={() => setShowFormatted(!showFormatted)}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              >
                {showFormatted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span>{showFormatted ? 'Hide' : 'Show'} Formatted</span>
              </button>

              {/* Copy Prompt Button */}
              <button
                onClick={copyToClipboard}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                <Copy className="h-4 w-4" />
                <span>Copy Prompt</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar */}
          <div className="col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900">Workspaces</h2>
                  <button onClick={addWorkspace} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search workspaces..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="p-2 overflow-y-auto" style={{maxHeight: '70vh'}}>
                {filteredWorkspaces.map((workspace, originalIndex) => {
                  const actualIndex = workspaces.findIndex(w => w.id === workspace.id);
                  return (
                    <div
                      key={workspace.id}
                      className={`group relative p-3 rounded-md transition-colors ${
                        activeWorkspace === actualIndex
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div onClick={() => setActiveWorkspace(actualIndex)} className="cursor-pointer">
                        {editingWorkspaceName === workspace.id ? (
                          <input
                            type="text"
                            value={workspace.name}
                            onChange={(e) => updateWorkspaceName(actualIndex, e.target.value)}
                            onBlur={() => setEditingWorkspaceName(null)}
                            onKeyPress={(e) => e.key === 'Enter' && setEditingWorkspaceName(null)}
                            className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <div className="font-medium">{workspace.name}</div>
                        )}
                        {workspace.owner && (
                          <div className="text-xs text-gray-500 mt-1">Owner: {workspace.owner}</div>
                        )}
                        {workspace.isDefault && (
                          <div className="text-xs text-blue-600 mt-1">Default</div>
                        )}
                        {workspace.syncedToPinecone ? (
                          <div className="text-xs text-green-600 mt-1">✅ Synced</div>
                        ) : (
                          <div className="text-xs text-orange-600 mt-1">⚠️ Not synced</div>
                        )}
                        {workspace.lastSaved && (
                          <div className="text-xs text-gray-400 mt-1">
                            Saved: {new Date(workspace.lastSaved).toLocaleTimeString()}
                          </div>
                        )}
                      </div>

                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkspaceName(workspace.id);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConfirm(actualIndex, workspace.name);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            <div className={`grid gap-8 transition-all duration-300 ${showFormatted ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* Editor Panel */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-orange-500" />
                    Edit Workspace
                    {!currentWorkspace.syncedToPinecone && (
                      <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                        Unsaved changes
                      </span>
                    )}
                  </h3>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto" style={{maxHeight: '75vh'}}>
                  {/* Workspace Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Workspace Name</label>
                    <input
                      type="text"
                      value={currentWorkspace.name || ''}
                      onChange={(e) => updateWorkspaceName(activeWorkspace, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Workspace Owner */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Workspace Owner</label>
                    <input
                      type="text"
                      value={currentWorkspace.owner || ''}
                      onChange={(e) => updateWorkspaceOwner(e.target.value)}
                      placeholder="Enter owner name or team"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Role Section */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Role</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={safeGet(currentWorkspace, 'sections.role.description', '')}
                          onChange={(e) => updateWorkspaceSection('role.description', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Goal Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Goal</label>
                    <textarea
                      value={safeGet(currentWorkspace, 'sections.goal', '')}
                      onChange={(e) => updateWorkspaceSection('goal', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Knowledge Bases */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Knowledge Bases</label>
                    <div className="grid grid-cols-2 gap-4">
                      {['DBT', 'Confluence', 'Jira', 'Asana'].map((kb) => {
                        const currentKnowledgeBases = safeArray(safeGet(currentWorkspace, 'sections.knowledgeBases', []));
                        const isSelected = currentKnowledgeBases.includes(kb);

                        const handleClick = () => {
                          setWorkspaces(prev => {
                            const updated = [...prev];
                            if (!updated[activeWorkspace]?.sections) return prev;

                            const currentKnowledgeBases = Array.isArray(updated[activeWorkspace].sections.knowledgeBases)
                              ? [...updated[activeWorkspace].sections.knowledgeBases]
                              : [];

                            const index = currentKnowledgeBases.indexOf(kb);
                            if (index > -1) {
                              currentKnowledgeBases.splice(index, 1);
                            } else {
                              currentKnowledgeBases.push(kb);
                            }

                            updated[activeWorkspace] = {
                              ...updated[activeWorkspace],
                              sections: {
                                ...updated[activeWorkspace].sections,
                                knowledgeBases: currentKnowledgeBases
                              },
                              updatedAt: new Date().toISOString(),
                              syncedToPinecone: false
                            };

                            return updated;
                          });
                        };

                        return (
                          <div
                            key={kb}
                            className="flex items-center space-x-3 cursor-pointer select-none hover:bg-gray-50 p-2 rounded-md transition-colors"
                            onClick={handleClick}
                          >
                            <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-700">{kb}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Responsibilities */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Responsibilities</label>
                      <button
                        onClick={() => addListItem('responsibilities')}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Add Responsibility
                      </button>
                    </div>
                    <div className="space-y-2">
                      {safeArray(safeGet(currentWorkspace, 'sections.responsibilities', [])).map((responsibility, index) => (
                        <div key={getItemKey(responsibility, index)} className="flex space-x-2">
                          <input
                            type="text"
                            value={getItemValue(responsibility)}
                            onChange={(e) => updateListItem('responsibilities', index, e.target.value)}
                            placeholder="Area: Description"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => removeListItem('responsibilities', index)}
                            className="px-2 py-2 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Communication Style */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Communication Style</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                        <input
                          type="text"
                          value={safeGet(currentWorkspace, 'sections.communicationStyle.tone', '')}
                          onChange={(e) => updateWorkspaceSection('communicationStyle.tone', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Personality</label>
                        <input
                          type="text"
                          value={safeGet(currentWorkspace, 'sections.communicationStyle.personality', '')}
                          onChange={(e) => updateWorkspaceSection('communicationStyle.personality', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Approach</label>
                        <input
                          type="text"
                          value={safeGet(currentWorkspace, 'sections.communicationStyle.approach', '')}
                          onChange={(e) => updateWorkspaceSection('communicationStyle.approach', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Response Guidelines */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Response Guidelines</label>
                      <button
                        onClick={() => addListItem('responseGuidelines')}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Add Guideline
                      </button>
                    </div>
                    <div className="space-y-2">
                      {safeArray(safeGet(currentWorkspace, 'sections.responseGuidelines', [])).map((guideline, index) => (
                        <div key={getItemKey(guideline, index)} className="flex space-x-2">
                          <input
                            type="text"
                            value={getItemValue(guideline)}
                            onChange={(e) => updateListItem('responseGuidelines', index, e.target.value)}
                            placeholder="Guideline description"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => removeListItem('responseGuidelines', index)}
                            className="px-2 py-2 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trigger Conditions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Conditions</label>
                    <textarea
                      value={safeGet(currentWorkspace, 'sections.triggers', '')}
                      onChange={(e) => updateWorkspaceSection('triggers', e.target.value)}
                      rows={2}
                      placeholder="Describe when this workspace should be triggered"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Subject Matter Expert */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Subject Matter Expert</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Profile</label>
                        <textarea
                          value={safeGet(currentWorkspace, 'sections.subjectMatterExpert', '')}
                          onChange={(e) => updateWorkspaceSection('subjectMatterExpert', e.target.value)}
                          rows={2}
                          placeholder="Describe the subject matter expert profile"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                        <input
                          type="email"
                          value={safeGet(currentWorkspace, 'sections.subjectMatterExpertEmail', '')}
                          onChange={(e) => updateWorkspaceSection('subjectMatterExpertEmail', e.target.value)}
                          placeholder="expert@company.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Q&A Examples */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">Example Q&A Pairs</label>
                      <button
                        onClick={addExampleQA}
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Example</span>
                      </button>
                    </div>
                    <div className="space-y-4">
                      {safeArray(safeGet(currentWorkspace, 'sections.examples', [])).map((example, index) => (
                        <div key={example.id || index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <MessageCircle className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium text-gray-700">Example {index + 1}</span>
                            </div>
                            <button
                              onClick={() => removeExampleQA(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Remove example"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
                                <HelpCircle className="h-4 w-4 text-green-500" />
                                <span>Question</span>
                              </label>
                              <textarea
                                value={example.question || ''}
                                onChange={(e) => updateExampleQA(index, 'question', e.target.value)}
                                rows={2}
                                placeholder="Enter an example question that users might ask..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
                                <MessageCircle className="h-4 w-4 text-blue-500" />
                                <span>Expected Answer</span>
                              </label>
                              <textarea
                                value={example.answer || ''}
                                onChange={(e) => updateExampleQA(index, 'answer', e.target.value)}
                                rows={4}
                                placeholder="Enter how Debbie T. should respond to this question..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      {safeArray(safeGet(currentWorkspace, 'sections.examples', [])).length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <MessageCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm">No examples added yet</p>
                          <p className="text-xs">Click "Add Example" to create Q&A pairs that demonstrate expected behavior</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Panel */}
              {showFormatted && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <Zap className="h-4 w-4 mr-2 text-blue-500" />
                      Formatted Prompt
                    </h3>
                  </div>
                  <div className="p-6">
                    <pre className="text-xs bg-gray-50 p-4 rounded-md overflow-auto border whitespace-pre-wrap" style={{maxHeight: '70vh', minHeight: '60vh'}}>
                      <code>{generateFormattedPrompt(currentWorkspace)}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebbieWorkspace;