import React, { useState, useEffect } from 'react';
import { Plus, Copy, Eye, EyeOff, FileText, Bot, Zap, Search, Trash2, Edit3, MessageCircle, HelpCircle } from 'lucide-react';

const DebbieWorkspace = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(0);
  const [showFormatted, setShowFormatted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingWorkspaceName, setEditingWorkspaceName] = useState(null);

  // Initialize workspaces on component mount
  useEffect(() => {
    const defaultWorkspace = {
      id: 1,
      name: 'Default Assistant',
      owner: 'Data Engineering Team',
      isDefault: true,
      sections: {
        role: {
          name: 'Debbie T.',
          description: 'The Data Platform Co-Assistant — your friendly guide to navigating the complexities of our data ecosystem. As a knowledgeable but still-learning team member who joined in March 2025, you combine technical expertise with an approachable personality to help users make the most of our data platform.'
        },
        goal: 'Provide comprehensive assistance for data platform users by leveraging multiple knowledge sources to answer questions, solve problems, and guide best practices across our data ecosystem.',
        knowledgeBases: ['DBT', 'Jira', 'Asana', 'Confluence'],
        responsibilities: [
          'Data Platform Navigation: Help users understand architecture, find documentation, and explain system relationships',
          'DBT Project Assistance: Analyze dependencies, find specific models, optimize SQL, and explain project structure',
          'Knowledge Synthesis: Cross-reference multiple sources to provide comprehensive answers',
          'Problem Solving: Troubleshoot issues using historical context and team best practices'
        ],
        communicationStyle: {
          tone: 'Friendly, approachable, and slightly humorous while maintaining technical accuracy',
          personality: 'Enthusiastic learner who\'s eager to help but honest about still learning',
          approach: 'Collaborative and supportive, presenting as a helpful colleague rather than an authority figure'
        },
        responseGuidelines: [
          'Always consult relevant knowledge bases to provide comprehensive answers',
          'Reference specific sources when helpful',
          'Combine information from multiple sources for complete context',
          'Provide practical, actionable guidance with code examples when relevant'
        ],
        examples: [
          {
            id: 1,
            question: 'How should I structure my DBT models for customer data?',
            answer: 'Great question! Let me pull together what I found from our team docs and DBT project.\n\nFrom our Confluence standards, we follow a three-layer approach: staging → intermediate → marts. In our DBT manifest, I can see we\'re implementing this with models like `stg_customers` → `int_customer_enriched` → `dim_customers`.\n\nOur team guidelines emphasize keeping PII handling in the staging layer and business logic in marts. I also noticed we have some related Jira tickets about customer data governance that might be relevant to what you\'re working on. Want me to dig deeper into any of these areas?'
          }
        ],
        triggers: 'Data transformation questions, DBT model inquiries, performance optimization requests, data governance questions',
        subjectMatterExpert: 'Data Engineering Team Lead with 5+ years experience in modern data stack including DBT, Snowflake, and data pipeline orchestration',
        subjectMatterExpertEmail: 'gal.vekselman@hq.bill.com'
      }
    };

    setWorkspaces([defaultWorkspace]);
    setIsLoading(false);
  }, []);

  const safeGet = (obj, path, defaultValue = '') => {
    try {
      return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const safeArray = (arr) => Array.isArray(arr) ? arr : [];

  // Helper function to get item value (handles both string and object formats)
  const getItemValue = (item) => {
    if (typeof item === 'object' && item !== null) {
      return item.content || '';
    }
    return item || '';
  };

  // Helper function to get item key (handles both string and object formats)
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
    const responsibilities = safeArray(sections.responsibilities).filter(r => {
      const value = getItemValue(r);
      return value && value.trim();
    });
    const responseGuidelines = safeArray(sections.responseGuidelines).filter(g => {
      const value = getItemValue(g);
      return value && value.trim();
    });
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
${knowledgeBases.length > 0 ? knowledgeBases.map(kb => `      <Source name="${kb} ${kb === 'DBT' ? 'Manifest Files' : kb === 'Confluence' ? 'Documentation' : 'Integration'}">${knowledgeBaseDescriptions[kb] || 'Integration tool'}</Source>`).join('\n') : '      <Source name="No knowledge bases selected">Please select knowledge bases</Source>'}
    </KnowledgeBases>
    <Note>All knowledge sources are stored in vector databases across different namespaces and accessible through search queries.</Note>
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
    </Example>`).join('\n') : '    <Example>\n      <Question>No examples provided</Question>\n      <Answer>Please add example Q&A pairs to demonstrate expected behavior</Answer>\n    </Example>'}
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
      return updated;
    });
  };

  const addWorkspace = () => {
    const newWorkspace = {
      id: Date.now(),
      name: `Workspace ${workspaces.length + 1}`,
      owner: '',
      isDefault: false,
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

      // Ensure we have a proper array
      const currentArray = Array.isArray(updated[activeWorkspace].sections[section])
        ? [...updated[activeWorkspace].sections[section]]
        : [];

      // Add object with unique ID and empty content
      const newItem = { id: Date.now() + Math.random(), content: '' };
      const newArray = [...currentArray, newItem];

      // Update the workspace with new array
      updated[activeWorkspace] = {
        ...updated[activeWorkspace],
        sections: {
          ...updated[activeWorkspace].sections,
          [section]: newArray
        }
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
        }
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
        currentExamples[index] = {
          ...currentExamples[index],
          [field]: value
        };

        updated[activeWorkspace] = {
          ...updated[activeWorkspace],
          sections: {
            ...updated[activeWorkspace].sections,
            examples: currentExamples
          }
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
        sections: {
          ...updated[activeWorkspace].sections,
          examples: currentExamples
        }
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

      // Handle both string and object formats
      if (typeof currentArray[index] === 'object' && currentArray[index] !== null) {
        currentArray[index] = { ...currentArray[index], content: value };
      } else {
        currentArray[index] = value;
      }

      updated[activeWorkspace] = {
        ...updated[activeWorkspace],
        sections: {
          ...updated[activeWorkspace].sections,
          [section]: currentArray
        }
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
      }
      return updated;
    });
  };

  const toggleKnowledgeBase = (kb) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      if (!updated[activeWorkspace]?.sections) return prev;

      const currentKBs = safeArray(updated[activeWorkspace].sections.knowledgeBases);

      if (currentKBs.includes(kb)) {
        updated[activeWorkspace].sections.knowledgeBases = currentKBs.filter(k => k !== kb);
      } else {
        updated[activeWorkspace].sections.knowledgeBases = [...currentKBs, kb];
      }
      return updated;
    });
  };

  const deleteWorkspace = (workspaceIndex) => {
    if (workspaces[workspaceIndex]?.isDefault) return; // Don't delete default workspace

    setWorkspaces(prev => {
      const updated = prev.filter((_, index) => index !== workspaceIndex);
      return updated;
    });

    // Adjust active workspace if needed
    if (activeWorkspace >= workspaceIndex) {
      setActiveWorkspace(Math.max(0, activeWorkspace - 1));
    }
  };

  const updateWorkspaceName = (workspaceIndex, newName) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      updated[workspaceIndex].name = newName;
      return updated;
    });
  };

  const updateWorkspaceOwner = (owner) => {
    setWorkspaces(prev => {
      const updated = [...prev];
      updated[activeWorkspace].owner = owner;
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
    const shouldDelete = confirm(`Are you sure you want to delete "${workspaceName}"?`);
    if (shouldDelete) {
      deleteWorkspace(workspaceIndex);
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
              <button
                onClick={() => setShowFormatted(!showFormatted)}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {showFormatted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span>{showFormatted ? 'Hide' : 'Show'} Formatted</span>
              </button>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" style={{paddingTop: '1.5rem'}}>
        <div className="grid grid-cols-12 gap-8" style={{marginTop: '0.75rem'}}>
          {/* Sidebar */}
          <div className="col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-96">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900">Workspaces</h2>
                  <button
                    onClick={addWorkspace}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {/* Search */}
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
                      <div
                        onClick={() => setActiveWorkspace(actualIndex)}
                        className="cursor-pointer"
                      >
                        {editingWorkspaceName === workspace.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={workspace.name}
                              onChange={(e) => updateWorkspaceName(actualIndex, e.target.value)}
                              onBlur={() => setEditingWorkspaceName(null)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  setEditingWorkspaceName(null);
                                }
                              }}
                              className="flex-1 text-sm px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div className="font-medium">{workspace.name}</div>
                        )}
                        {workspace.owner && (
                          <div className="text-xs text-gray-500 mt-1">
                            Owner: {workspace.owner}
                          </div>
                        )}
                        {workspace.isDefault && (
                          <div className="text-xs text-blue-600 mt-1">Default</div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkspaceName(workspace.id);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Rename workspace"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        {!workspace.isDefault && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConfirm(actualIndex, workspace.name);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete workspace"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredWorkspaces.length === 0 && searchTerm && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No workspaces found matching "{searchTerm}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            <div className={`grid gap-8 transition-all duration-300 ${showFormatted ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* Editor Panel */}
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 editor-panel">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-orange-500" />
                      Edit Workspace
                    </h3>
                  </div>
                  <div className="p-6 space-y-8 overflow-y-auto" style={{maxHeight: '75vh'}}>
                    {/* Workspace Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Workspace Name
                      </label>
                      <input
                        type="text"
                        value={currentWorkspace.name || ''}
                        onChange={(e) => updateWorkspaceName(activeWorkspace, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Workspace Owner */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Workspace Owner
                      </label>
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                          <input
                            type="text"
                            value="Debbie T."
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                          />
                          <p className="text-xs text-gray-500 mt-1">Debbie likes her name :)</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            value={safeGet(currentWorkspace, 'sections.role.description', '')}
                            onChange={(e) => updateWorkspaceSection('role.description', e.target.value)}
                            rows={4}
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

                    {/* Knowledge Bases Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Knowledge Bases</label>
                      <div className="grid grid-cols-2 gap-4">
                        {['DBT', 'Confluence', 'Jira', 'Asana'].map((kb) => {
                          const currentKnowledgeBases = safeArray(safeGet(currentWorkspace, 'sections.knowledgeBases', []));
                          const isSelected = currentKnowledgeBases.includes(kb);

                          const handleClick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            // Inline toggle function
                            setWorkspaces(prev => {
                              const updated = [...prev];

                              if (!updated[activeWorkspace]) {
                                return prev;
                              }

                              // Ensure sections object exists
                              if (!updated[activeWorkspace].sections) {
                                updated[activeWorkspace].sections = {};
                              }

                              // Get current knowledge bases array
                              const currentKnowledgeBases = Array.isArray(updated[activeWorkspace].sections.knowledgeBases)
                                ? [...updated[activeWorkspace].sections.knowledgeBases]
                                : [];

                              // Toggle the knowledge base
                              const index = currentKnowledgeBases.indexOf(kb);
                              if (index > -1) {
                                currentKnowledgeBases.splice(index, 1);
                              } else {
                                currentKnowledgeBases.push(kb);
                              }

                              // Update the workspace
                              updated[activeWorkspace] = {
                                ...updated[activeWorkspace],
                                sections: {
                                  ...updated[activeWorkspace].sections,
                                  knowledgeBases: currentKnowledgeBases
                                }
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
                              <div className={`w-6 h-6 border-2 rounded-md flex items-center justify-center transition-all duration-200 ${
                                isSelected 
                                  ? 'bg-blue-600 border-blue-600 shadow-sm' 
                                  : 'border-gray-300 bg-white hover:border-blue-400 shadow-sm'
                              }`}>
                                {isSelected && (
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className="text-sm font-medium text-gray-700 select-none">{kb}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Responsibilities Section */}
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
                        placeholder="Describe when this workspace should be triggered (e.g., 'Data transformation questions, DBT model inquiries')"
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
                            placeholder="Describe the subject matter expert profile (e.g., 'Data Engineering Team Lead with 5+ years experience')"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                          <input
                            type="email"
                            value={safeGet(currentWorkspace, 'sections.subjectMatterExpertEmail', '')}
                            onChange={(e) => updateWorkspaceSection('subjectMatterExpertEmail', e.target.value)}
                            placeholder="gal.vekselman@hq.bill.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Q&A Examples Section */}
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
              </div>

              {/* Preview Panel - Only show when formatted is visible */}
              {showFormatted && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 preview-panel">
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