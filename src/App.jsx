import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Shield, Coins, Play, Sparkles, Clock, Settings, 
  Download, Clipboard, Trash2, Plus, ArrowRight, History, 
  TrendingUp, RefreshCw, AlertCircle, CheckCircle2, HelpCircle, 
  Activity, FileText, X, Sun, Moon, Network, MessageSquare,
  Minus, Maximize
} from 'lucide-react';
import { generateDelta, PRESETS } from './orchestrator/engine.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json();
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Standard auto-layout algorithm for tree levels
function layoutTree(tree) {
  const levelsCount = {};
  const levelsCurrentIndex = {};

  const countNodes = (node) => {
    levelsCount[node.level] = (levelsCount[node.level] || 0) + 1;
    if (node.children) node.children.forEach(countNodes);
  };
  countNodes(tree);

  const positionNode = (node) => {
    levelsCurrentIndex[node.level] = (levelsCurrentIndex[node.level] || 0) + 1;
    const count = levelsCount[node.level];
    const index = levelsCurrentIndex[node.level];

    // Space nodes horizontally on an 800px wide grid canvas
    const width = 800;
    const step = width / (count + 1);
    node.x = Math.round(step * index - 105) + 30; // Center offset + horizontal margin
    node.y = 40 + node.level * 145; // 145px vertical step distance

    if (node.children) node.children.forEach(positionNode);
  };
  positionNode(tree);
  return tree;
}

// Sankey-style source contribution diagram: each source flows into the
// aggregated dataset with a band height proportional to how much it contributed.
function renderSourceFlow(distribution) {
  if (!distribution || distribution.length === 0) {
    return <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>No source data recorded.</p>;
  }

  const total = distribution.reduce((sum, d) => sum + (Number(d.count) || 0), 0) || 1;
  const width = 360;
  const height = Math.max(120, distribution.length * 38);
  const palette = ['#8b5cf6', '#ec4899', '#f97316', '#ef4444', '#38bdf8', '#22c55e', '#eab308'];
  const targetX = width - 150;
  const targetTop = 20;
  const targetHeight = height - 40;

  let srcY = 10;
  let tgtY = targetTop;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {/* aggregated target bar */}
      <rect x={targetX + 80} y={targetTop} width="14" height={targetHeight} rx="3" fill="hsl(var(--primary))" opacity="0.85" />
      <text x={targetX + 70} y={targetTop + targetHeight / 2} textAnchor="end" fontSize="11" fill="currentColor" dominantBaseline="middle">
        Aggregated
      </text>

      {distribution.map((d, i) => {
        const frac = (Number(d.count) || 0) / total;
        const band = Math.max(8, frac * targetHeight);
        const color = palette[i % palette.length];
        const sy = srcY;
        const ty = tgtY;
        srcY += band + 6;
        tgtY += band;

        const path = `M 110 ${sy + band / 2}
                      C ${(110 + targetX + 80) / 2} ${sy + band / 2},
                        ${(110 + targetX + 80) / 2} ${ty + band / 2},
                        ${targetX + 80} ${ty + band / 2}`;

        return (
          <g key={i}>
            <text x="0" y={sy + band / 2} fontSize="11" fill="currentColor" dominantBaseline="middle">
              {d.source} ({d.count})
            </text>
            <path d={path} stroke={color} strokeWidth={band} fill="none" opacity="0.45" />
          </g>
        );
      })}
    </svg>
  );
}

export default function App() {
  // Navigation & Theme
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme_preference') || 'dark');
  const [zoom, setZoom] = useState(1);

  // Input states
  const [industry, setIndustry] = useState('Solar Energy (US)');
  const [context, setContext] = useState(
    'Analyze the viability of residential solar subscription models in sun-belt states (Texas, Arizona, Florida) given high interest rates and changing utility net-metering policies.'
  );

  // Structured Research Goal (Phase 1)
  const [goalField, setGoalField] = useState('');         // e.g. "Cardiologist"
  const [goalLocation, setGoalLocation] = useState('');   // e.g. "Bangalore"
  const [goalObjective, setGoalObjective] = useState(''); // free-text mandate
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Custom agents defined in the Goal modal (injected as Level 1 source agents)
  const [goalCustomAgents, setGoalCustomAgents] = useState([]); // [{ name, instructions, source }]
  const [draftAgent, setDraftAgent] = useState({ name: '', instructions: '', source: 'web' });
  
  // Hierarchical Agent Tree State (Initialized with coordinates)
  const [activeTree, setActiveTree] = useState(() => {
    const tree = JSON.parse(JSON.stringify(PRESETS.solar.tree));
    return layoutTree(tree);
  });
  const [selectedNode, setSelectedNode] = useState(null);

  // Dragging state on 2D space
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [nodeStartPos, setNodeStartPos] = useState({ x: 0, y: 0 });

  // Dynamic Add Agent Forms
  const [newAgentForm, setNewAgentForm] = useState(null); // 'vertical' | 'horizontal' | null
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('');
  const [newAgentInstructions, setNewAgentInstructions] = useState('');
  const [newAgentSource, setNewAgentSource] = useState('web');

  // API Providers & Keys settings
  const [apiProvider, setApiProvider] = useState('gemini');
  const [apiKeys, setApiKeys] = useState({ gemini: '', openai: '', anthropic: '', openrouter: '' });
  const [currentKeyInput, setCurrentKeyInput] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Orchestrator Execution State
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'complete' | 'failed'
  const [errorMessage, setErrorMessage] = useState('');
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [report, setReport] = useState('');
  const [analysis, setAnalysis] = useState(null);

  // History & Scheduling
  const [history, setHistory] = useState([]);
  const [deltaLogs, setDeltaLogs] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // Phase 5 — server-side recurring schedules
  const [schedules, setSchedules] = useState([]);
  const [scheduleInterval, setScheduleInterval] = useState(1440); // minutes (default daily)

  // UI Refs
  const terminalEndRef = useRef(null);
  const visualizerContainerRef = useRef(null);
  const inspectorPanelRef = useRef(null);
  const dragMovedRef = useRef(false);
  const suppressClickRef = useRef(false);

  // Theme Sync Effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme_preference', theme);
  }, [theme]);

  useEffect(() => {
    const loadServerState = async () => {
      try {
        const [settings, historyItems, scheduleItems] = await Promise.all([
          apiRequest('/settings'),
          apiRequest('/history'),
          apiRequest('/schedules')
        ]);

        setApiProvider(settings.provider || 'gemini');
        setApiKeys({
          gemini: '',
          openai: '',
          anthropic: '',
          openrouter: '',
          ...(settings.apiKeys || {})
        });
        setTavilyKey(settings.tavilyApiKey || '');
        setHistory(historyItems);
        setSchedules(scheduleItems);
      } catch (error) {
        console.error('Failed to load backend state:', error);
      }
    };

    loadServerState();
  }, []);

  // Sync API Key input field
  useEffect(() => {
    setCurrentKeyInput(apiKeys[apiProvider] || '');
  }, [apiProvider, apiKeys]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  useEffect(() => {
    const currentAsset = document
      .querySelector('script[type="module"][src*="/assets/index-"]')
      ?.getAttribute('src');

    if (!currentAsset) return undefined;

    const checkForNewBuild = async () => {
      try {
        const response = await fetch(`${window.location.pathname}?buildCheck=${Date.now()}`, {
          cache: 'no-store'
        });
        const html = await response.text();
        const match = html.match(/<script type="module" crossorigin src="([^"]+)"/);

        if (match && match[1] !== currentAsset) {
          window.location.reload();
        }
      } catch (error) {
        console.error('Build check failed:', error);
      }
    };

    const interval = window.setInterval(checkForNewBuild, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!selectedNode || newAgentForm || showSettingsModal) return;

      const target = event.target;
      if (inspectorPanelRef.current?.contains(target)) return;
      if (target.closest('.agent-node-card')) return;

      setSelectedNode(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [selectedNode, newAgentForm, showSettingsModal]);

  // Dragging event handler registered on window
  useEffect(() => {
    if (!draggedNodeId) return;

    const handleMouseMove = (e) => {
      const deltaX = (e.clientX - dragStartPos.x) / zoom;
      const deltaY = (e.clientY - dragStartPos.y) / zoom;

      if (Math.abs(e.clientX - dragStartPos.x) > 3 || Math.abs(e.clientY - dragStartPos.y) > 3) {
        dragMovedRef.current = true;
      }

      setActiveTree(prevTree => {
        const cloned = JSON.parse(JSON.stringify(prevTree));
        const node = findNodeById(cloned, draggedNodeId);
        if (node) {
          node.x = nodeStartPos.x + deltaX;
          node.y = nodeStartPos.y + deltaY;
        }
        return cloned;
      });
    };

    const handleMouseUp = () => {
      suppressClickRef.current = dragMovedRef.current;
      setDraggedNodeId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedNodeId, dragStartPos, nodeStartPos, zoom]);

  // Drag trigger logic on element mouse-down
  const startDrag = (e, nodeId) => {
    // Only drag on left click
    if (e.button !== 0) return;

    // Don't start drag if clicking input fields
    if (e.target.closest('input') || e.target.closest('button') || e.target.closest('textarea')) return;

    const node = findNodeById(activeTree, nodeId);
    if (!node) return;

    e.preventDefault();
    dragMovedRef.current = false;
    suppressClickRef.current = false;
    setDraggedNodeId(nodeId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setNodeStartPos({ x: node.x || 0, y: node.y || 0 });
    setSelectedNode(null);
    setNewAgentForm(null);
  };

  // Save specific API Provider Key
  const saveProviderKey = async () => {
    const updatedKeys = { ...apiKeys, [apiProvider]: currentKeyInput };

    try {
      const saved = await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          provider: apiProvider,
          apiKeys: updatedKeys,
          tavilyApiKey: tavilyKey
        })
      });

      setApiProvider(saved.provider);
      setApiKeys(saved.apiKeys);
      setTavilyKey(saved.tavilyApiKey || '');
      alert(`${apiProvider.toUpperCase()} API key saved to the backend database.`);
    } catch (error) {
      console.error(error);
      alert(`Unable to save key: ${error.message}`);
    }
  };

  // Save Tavily web-search key (enables grounded research)
  const saveTavilyKey = async () => {
    try {
      const saved = await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          provider: apiProvider,
          apiKeys,
          tavilyApiKey: tavilyKey
        })
      });

      setApiProvider(saved.provider);
      setApiKeys(saved.apiKeys);
      setTavilyKey(saved.tavilyApiKey || '');
      alert(tavilyKey
        ? 'Tavily search key saved. Agents will now ground findings in real web sources.'
        : 'Tavily search key cleared. Agents will run ungrounded.');
    } catch (error) {
      console.error(error);
      alert(`Unable to save Tavily key: ${error.message}`);
    }
  };

  // Presets Loader
  const loadPreset = (type) => {
    if (PRESETS[type]) {
      setIndustry(PRESETS[type].industry);
      setContext(PRESETS[type].context);
      const clonedTree = JSON.parse(JSON.stringify(PRESETS[type].tree));
      layoutTree(clonedTree);
      setActiveTree(clonedTree);
      setSelectedNode(null);
      setNewAgentForm(null);
    }
  };

  // Build a single rich context string from the structured goal fields.
  // The orchestrator/planner reads this to design the agent network.
  const composeContext = (objective, field, location) => {
    const parts = [];
    if (objective.trim()) parts.push(objective.trim());
    const tags = [];
    if (field.trim()) tags.push(`Field/Specialty: ${field.trim()}`);
    if (location.trim()) tags.push(`Location: ${location.trim()}`);
    if (tags.length) parts.push(tags.join('. ') + '.');
    return parts.join(' ');
  };

  // Map a chosen source to a sensible default allowedDomains list, so the
  // backend research layer knows where each custom source agent should look.
  const SOURCE_DOMAIN_HINTS = {
    web: [],
    google: [],
    instagram: ['instagram.com'],
    reddit: ['reddit.com'],
    youtube: ['youtube.com'],
    facebook: ['facebook.com'],
    website: []
  };

  // Add a custom agent draft into the goal's agent list
  const addDraftAgent = () => {
    if (!draftAgent.name.trim() || !draftAgent.instructions.trim()) return;
    setGoalCustomAgents((prev) => [
      ...prev,
      {
        name: draftAgent.name.trim().toUpperCase().replace(/\s+/g, '_'),
        instructions: draftAgent.instructions.trim(),
        source: draftAgent.source
      }
    ]);
    setDraftAgent({ name: '', instructions: '', source: 'web' });
  };

  const removeDraftAgent = (idx) => {
    setGoalCustomAgents((prev) => prev.filter((_, i) => i !== idx));
  };

  // Apply the structured goal: compose context, seed a fresh tree, and inject
  // any custom source agents as Level 1 children of the Master Orchestrator.
  const applyGoal = () => {
    if (!industry.trim()) {
      alert('Please enter an Industry for this research goal.');
      return;
    }

    const composedContext = composeContext(goalObjective, goalField, goalLocation);
    setContext(composedContext);

    // Start from a clean master node and attach the user's custom source agents.
    const tree = {
      id: 'agent-master',
      name: 'MASTER_ORCHESTRATOR',
      role: 'Master Orchestrator',
      instructions: `Coordinate research on ${industry}${goalField ? ` (${goalField})` : ''}${goalLocation ? ` in ${goalLocation}` : ''} and synthesize the final report.`,
      level: 0,
      status: 'idle',
      logs: [],
      children: goalCustomAgents.map((agent, index) => ({
        id: `agent-${index + 1}`,
        name: agent.name,
        role: agent.source === 'web' || agent.source === 'google'
          ? 'Web Research Specialist'
          : `${agent.source.charAt(0).toUpperCase() + agent.source.slice(1)} Source Specialist`,
        instructions: agent.instructions,
        source: agent.source,
        allowedDomains: SOURCE_DOMAIN_HINTS[agent.source] || [],
        level: 1,
        status: 'idle',
        logs: [],
        children: []
      }))
    };

    layoutTree(tree);
    setActiveTree(tree);
    setSelectedNode(null);
    setNewAgentForm(null);
    setShowGoalModal(false);
  };

  // Tree Helper - Get nodes by level
  const getNodesAtLevel = (node, targetLevel, result = []) => {
    if (node.level === targetLevel) {
      result.push(node);
    } else if (node.children) {
      node.children.forEach(child => getNodesAtLevel(child, targetLevel, result));
    }
    return result;
  };

  // Tree Helper - Find parent node
  const findParentNode = (root, targetId) => {
    if (root.children) {
      if (root.children.some(c => c.id === targetId)) {
        return root;
      }
      for (const child of root.children) {
        const parent = findParentNode(child, targetId);
        if (parent) return parent;
      }
    }
    return null;
  };

  // Tree Helper - Find node by ID
  const findNodeById = (root, targetId) => {
    if (root.id === targetId) return root;
    if (root.children) {
      for (const child of root.children) {
        const found = findNodeById(child, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  // Add Dynamic Sub-agent (Horizontal or Vertical)
  const handleAddAgent = (e) => {
    e.preventDefault();
    if (!newAgentName.trim() || !newAgentRole.trim() || !newAgentInstructions.trim()) return;

    const newAgent = {
      id: `agent-${Math.random().toString(36).substring(2, 9)}`,
      name: newAgentName.trim().toUpperCase().replace(/\s+/g, '_'),
      role: newAgentRole.trim(),
      instructions: newAgentInstructions.trim(),
      source: newAgentSource,
      allowedDomains: SOURCE_DOMAIN_HINTS[newAgentSource] || [],
      level: 1, // Will be updated based on vertical or horizontal
      status: 'idle',
      logs: [],
      children: [],
      x: 0,
      y: 0
    };

    const clonedTree = { ...activeTree };

    if (newAgentForm === 'vertical') {
      // Adding Child (Vertical)
      const target = findNodeById(clonedTree, selectedNode.id);
      if (target) {
        newAgent.level = target.level + 1;
        if (newAgent.level > 3) {
          alert("Maximum hierarchical depth is 3 sub-agent levels.");
          return;
        }
        newAgent.x = (target.x || 0) + (target.children.length * 40) - 20;
        newAgent.y = (target.y || 0) + 145;
        target.children.push(newAgent);
      }
    } else if (newAgentForm === 'horizontal') {
      // Adding Sibling (Horizontal)
      const parent = findParentNode(clonedTree, selectedNode.id);
      if (parent) {
        newAgent.level = selectedNode.level;
        newAgent.x = (selectedNode.x || 0) + 230;
        newAgent.y = selectedNode.y || 0;
        parent.children.push(newAgent);
      } else {
        alert("Cannot add horizontal sibling to Master Orchestrator.");
        return;
      }
    }

    // Save and select new agent
    setActiveTree(clonedTree);
    setSelectedNode(newAgent);
    
    // Reset inputs
    setNewAgentName('');
    setNewAgentRole('');
    setNewAgentInstructions('');
    setNewAgentSource('web');
    setNewAgentForm(null);
  };

  // Delete Node from Tree
  const handleDeleteAgent = (nodeId) => {
    if (nodeId === 'agent-master') {
      alert("Cannot delete the Master Orchestrator.");
      return;
    }

    const clonedTree = { ...activeTree };
    const parent = findParentNode(clonedTree, nodeId);
    
    if (parent) {
      parent.children = parent.children.filter(child => child.id !== nodeId);
      setActiveTree(clonedTree);
      setSelectedNode(null);
      setNewAgentForm(null);
    }
  };

  // Run Orchestrator Pipeline
  const handleRunOrchestration = async (e, rerunReport = null) => {
    if (e) e.preventDefault();

    setStatus('running');
    setTerminalLogs([]);
    setObjectives([]);
    setReport('');
    setAnalysis(null);
    setActiveTab('live');
    setSelectedNode(null);

    // Reset status on tree nodes
    const resetNodes = (n) => {
      n.status = "idle";
      n.logs = [];
      if (n.children) n.children.forEach(resetNodes);
    };
    const clonedActiveTree = JSON.parse(JSON.stringify(activeTree));
    resetNodes(clonedActiveTree);
    setActiveTree(clonedActiveTree);

    const activeKey = apiKeys[apiProvider] || null;

    const logMessage = (type, text, agentName = null) => {
      setTerminalLogs(prev => [...prev, { type, text, agentName, time: new Date().toLocaleTimeString() }]);
      
      // Update local logs on the tree node in state
      if (agentName) {
        setActiveTree(current => {
          const updated = JSON.parse(JSON.stringify(current));
          const node = findNodeById(updated, findNodeIdByName(updated, agentName));
          if (node) {
            node.logs.push(text);
          }
          return updated;
        });
      }
    };

    const findNodeIdByName = (root, name) => {
      if (root.name === name) return root.id;
      if (root.children) {
        for (const child of root.children) {
          const res = findNodeIdByName(child, name);
          if (res) return res;
        }
      }
      return null;
    };

    try {
      logMessage('info', 'Hierarchical Orchestrator initialized.');
      logMessage('info', `Provider Selected: ${activeKey ? apiProvider.toUpperCase() : 'Mock Mode'}`);

      const { jobId } = await apiRequest('/orchestrations', {
        method: 'POST',
        body: JSON.stringify({
          industry,
          context,
          field: goalField,
          location: goalLocation,
          activeTree: clonedActiveTree,
          provider: apiProvider
        })
      });

      let processedEvents = 0;
      let orchestrationResult = null;

      while (!orchestrationResult) {
        const job = await apiRequest(`/orchestrations/${jobId}`);
        const freshEvents = job.events.slice(processedEvents);

        freshEvents.forEach((evt) => {
          switch (evt.status) {
            case 'analyzing':
              logMessage('info', evt.message);
              break;
            case 'objectives_created':
              setObjectives(evt.objectives);
              logMessage('success', 'Objectives formulated successfully.');
              evt.objectives.forEach((obj) => logMessage('info', `Objective: ${obj}`));
              logMessage('success', 'Active agents initialized in tree.');
              break;
            case 'agent_start':
              setActiveTree((current) => {
                const updated = JSON.parse(JSON.stringify(current));
                const node = findNodeById(updated, evt.brief.id);
                if (node) node.status = 'active';
                return updated;
              });
              logMessage('agent', `Agent ${evt.agentName} starting research mandate...`, evt.agentName);
              break;
            case 'agent_log':
              logMessage('agent', evt.log, evt.agentName);
              break;
            case 'agent_complete':
              setActiveTree((current) => {
                const updated = JSON.parse(JSON.stringify(current));
                const node = findNodeById(updated, evt.report.id);
                if (node) {
                  node.status = 'complete';
                  node.report = evt.report.report;
                }
                return updated;
              });
              logMessage('success', 'Mandate resolved. Output compiled.', evt.agentName);
              break;
            case 'synthesizing':
              logMessage('info', evt.message);
              break;
            case 'aggregating':
              logMessage('info', evt.message);
              break;
            case 'analysis_complete':
              setAnalysis(evt.analysis);
              logMessage('success', 'Aggregation & analysis complete. Analytics ready.');
              break;
            case 'complete':
              logMessage('success', 'Master synthesis complete. Unified report written.');
              break;
            case 'error':
              logMessage('warn', evt.message);
              break;
          }
        });

        processedEvents = job.events.length;

        if (job.status === 'failed') {
          throw new Error(job.error || 'Orchestration crashed.');
        }

        if (job.status === 'complete') {
          orchestrationResult = job.result;
          break;
        }

        await wait(800);
      }

      const finalReport = orchestrationResult.report;
      setReport(finalReport);
      if (orchestrationResult.analysis) setAnalysis(orchestrationResult.analysis);
      setStatus('complete');
      setActiveTab('report');
      setActiveTree(JSON.parse(JSON.stringify(orchestrationResult.treeSnapshot)));
      setHistory((prev) => [orchestrationResult.historyItem, ...prev]);

      if (rerunReport) {
        const delta = generateDelta(rerunReport, finalReport);
        setDeltaLogs((prev) => [
          {
            id: crypto.randomUUID(),
            date: new Date().toLocaleTimeString(),
            industry,
            delta
          },
          ...prev
        ]);
      }

    } catch (err) {
      console.error(err);
      setStatus('failed');
      setErrorMessage(err.message || 'Orchestration crashed.');
      logMessage('warn', `Process crashed: ${err.message}`);
    }
  };

  // Copy report
  const copyToClipboard = () => {
    navigator.clipboard.writeText(report);
    alert('Report copied to clipboard!');
  };

  // Download report
  const downloadReport = () => {
    const element = document.createElement("a");
    const file = new Blob([report], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `research_report_${industry.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Generic file download helper
  const downloadBlob = (content, mime, filename) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: mime });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const slug = () => industry.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  // Export the contact/entity directory as CSV (CRM/Sheet ready)
  const exportContactsCSV = () => {
    if (!analysis?.contacts?.length) {
      alert('No contacts were extracted in this run.');
      return;
    }
    const headers = ['name', 'organization', 'role', 'phone', 'location', 'rating', 'source', 'url'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = analysis.contacts.map((c) => headers.map((h) => escape(c[h])).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    downloadBlob(csv, 'text/csv', `contacts_${slug()}.csv`);
  };

  // Export the full structured analysis as JSON
  const exportAnalysisJSON = () => {
    if (!analysis) return;
    downloadBlob(JSON.stringify({ industry, field: goalField, location: goalLocation, analysis }, null, 2), 'application/json', `analysis_${slug()}.json`);
  };

  // Export a Word-openable document (HTML .doc — zero-dependency, opens in Word)
  const exportDocx = () => {
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const a = analysis;

    const contactsTable = a?.contacts?.length
      ? `<h2>Contact Directory</h2><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
        <tr><th>Name</th><th>Organization</th><th>Role</th><th>Phone</th><th>Rating</th><th>Source</th></tr>
        ${a.contacts.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.organization)}</td><td>${esc(c.role)}</td><td>${esc(c.phone)}</td><td>${esc(c.rating)}</td><td>${esc(c.source)}</td></tr>`).join('')}
      </table>` : '';

    const gapTable = a?.idealVsActual?.dimensions?.length
      ? `<h2>Ideal vs Actual — Gap Analysis</h2><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
        <tr><th>Dimension</th><th>Ideal</th><th>Actual</th><th>Error Margin</th><th>Improvement</th></tr>
        ${a.idealVsActual.dimensions.map((d) => `<tr><td>${esc(d.dimension)}</td><td>${esc(d.ideal)}</td><td>${esc(d.actual)}</td><td>${esc(d.errorMargin)}</td><td>${esc(d.improvement)}</td></tr>`).join('')}
      </table>` : '';

    const marketBlock = a?.marketSize
      ? `<h2>Market Size</h2><p><b>${esc(a.marketSize.headline)}</b><br/>${esc(a.marketSize.totalEstimate)}</p>
        ${a.marketSize.breakdown?.length ? `<ul>${a.marketSize.breakdown.map((b) => `<li>${esc(b.segment)}: ${esc(b.count)} — ${esc(b.note)}</li>`).join('')}</ul>` : ''}` : '';

    const statsBlock = a?.statistics
      ? `<h2>Statistics</h2><ul>
        <li>Success rate: ${esc(a.statistics.successRate)}</li>
        <li>Growth rate: ${esc(a.statistics.growthRate)}</li>
        <li>Confidence: ${esc(a.statistics.confidence)}</li></ul>` : '';

    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Research Report — ${esc(industry)}</title></head>
      <body style="font-family:Calibri,Arial,sans-serif">
        <h1>Research Report — ${esc(industry)}${goalField ? ` / ${esc(goalField)}` : ''}${goalLocation ? ` — ${esc(goalLocation)}` : ''}</h1>
        <p><i>Generated ${new Date().toLocaleString()}</i></p>
        ${marketBlock}${statsBlock}${gapTable}${contactsTable}
        <h2>Full Synthesis</h2>
        <pre style="white-space:pre-wrap;font-family:Calibri,Arial,sans-serif">${esc(report)}</pre>
      </body></html>`;

    downloadBlob(html, 'application/msword', `research_report_${slug()}.doc`);
  };

  const INTERVAL_OPTIONS = [
    { value: 60, label: 'Hourly' },
    { value: 360, label: 'Every 6 hours' },
    { value: 720, label: 'Every 12 hours' },
    { value: 1440, label: 'Daily' },
    { value: 10080, label: 'Weekly' }
  ];

  const intervalLabel = (mins) =>
    INTERVAL_OPTIONS.find((o) => o.value === mins)?.label || `Every ${mins} min`;

  // Create a recurring schedule from the current goal + agent tree
  const createSchedule = async () => {
    if (!industry.trim()) {
      alert('Set an Industry (via Define Goal) before scheduling.');
      return;
    }
    try {
      const created = await apiRequest('/schedules', {
        method: 'POST',
        body: JSON.stringify({
          label: `${industry}${goalField ? ` · ${goalField}` : ''}${goalLocation ? ` · ${goalLocation}` : ''}`,
          industry,
          context,
          field: goalField,
          location: goalLocation,
          provider: apiProvider,
          treeSnapshot: activeTree,
          intervalMinutes: scheduleInterval
        })
      });
      setSchedules((prev) => [created, ...prev]);
    } catch (error) {
      alert(`Unable to create schedule: ${error.message}`);
    }
  };

  const toggleSchedule = async (id, active) => {
    try {
      const updated = await apiRequest(`/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active })
      });
      setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (error) {
      alert(`Unable to update schedule: ${error.message}`);
    }
  };

  const removeSchedule = async (id) => {
    try {
      await apiRequest(`/schedules/${id}`, { method: 'DELETE' });
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      alert(`Unable to delete schedule: ${error.message}`);
    }
  };

  // One-click: load a schedule's goal back into the workspace
  const loadScheduleIntoWorkspace = (schedule) => {
    setIndustry(schedule.industry);
    setContext(schedule.context);
    setGoalField(schedule.field || '');
    setGoalLocation(schedule.location || '');
    if (schedule.treeSnapshot) {
      const cloned = JSON.parse(JSON.stringify(schedule.treeSnapshot));
      layoutTree(cloned);
      setActiveTree(cloned);
    }
    setActiveTab('dashboard');
  };

  // Poll history + schedules so server-side scheduled runs surface automatically
  useEffect(() => {
    if (schedules.filter((s) => s.active).length === 0) return undefined;
    const interval = setInterval(async () => {
      try {
        const [historyItems, scheduleItems] = await Promise.all([
          apiRequest('/history'),
          apiRequest('/schedules')
        ]);
        setHistory(historyItems);
        setSchedules(scheduleItems);
      } catch (error) {
        console.error('Schedule refresh failed:', error);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [schedules]);

  // Parse scores for Opportunity Scorecard
  const parseOpportunityTable = () => {
    if (!report) return null;
    const lines = report.split('\n');
    const tableStartIndex = lines.findIndex(line => line.includes('| Dimension | Score | Rationale |'));
    if (tableStartIndex === -1) return null;

    const items = [];
    for (let i = tableStartIndex + 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('|')) break;
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const dimension = parts[0].replace(/\*\*/g, '');
        let score = 'Moderate';
        if (parts[1].includes('Strong') || parts[1].includes('🟢')) score = 'Strong';
        else if (parts[1].includes('Weak') || parts[1].includes('🔴')) score = 'Weak';
        
        items.push({
          dimension,
          score,
          rawScore: parts[1],
          rationale: parts[2]
        });
      }
    }
    return items.length > 0 ? items : null;
  };

  const opportunityItems = parseOpportunityTable();

  // Flatten tree nodes list for absolute canvas layout rendering
  const getFlatNodes = (node, list = []) => {
    list.push(node);
    if (node.children) {
      node.children.forEach(child => getFlatNodes(child, list));
    }
    return list;
  };
  const flatNodesList = getFlatNodes(activeTree);

  // Generate connection paths directly from coordinates
  const getConnectorLines = (node, lines = []) => {
    if (node.children && node.children.length > 0) {
      const startX = (node.x || 0) + 105;
      const startY = (node.y || 0) + 75; // bottom center of 210x75px card
      node.children.forEach(child => {
        const endX = (child.x || 0) + 105;
        const endY = (child.y || 0); // top center of child card
        const path = `M ${startX} ${startY} C ${startX} ${(startY + endY) / 2}, ${endX} ${(startY + endY) / 2}, ${endX} ${endY}`;
        lines.push({ id: `${node.id}-${child.id}`, path });
        getConnectorLines(child, lines);
      });
    }
    return lines;
  };
  const connectorLinesList = getConnectorLines(activeTree);
  const containerWidth = visualizerContainerRef.current?.clientWidth || 1280;
  const containerHeight = visualizerContainerRef.current?.clientHeight || 800;
  const inspectorWidth = 340;
  const inspectorHeight = 380;
  const inspectorBaseTop = ((selectedNode?.y || 0) * zoom) + 110;
  const inspectorBaseLeft = ((selectedNode?.x || 0) * zoom) + 230;
  let inspectorLeft = Math.min(inspectorBaseLeft, containerWidth - inspectorWidth - 18);
  let inspectorTop = Math.min(inspectorBaseTop, containerHeight - inspectorHeight - 18);

  if (inspectorLeft < 18) inspectorLeft = 18;
  if (inspectorTop < 88) inspectorTop = 88;
  if (inspectorBaseLeft + inspectorWidth > containerWidth - 18) {
    inspectorLeft = Math.max(18, ((selectedNode?.x || 0) * zoom) - inspectorWidth - 18);
  }

  const handleNodeClick = (node) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    setSelectedNode(node);
    setNewAgentForm(null);
  };

  const tabItems = [
    { id: 'dashboard', icon: Network, label: 'Agent Workspace', disabled: false },
    { id: 'live', icon: Activity, label: 'Live Run', disabled: status !== 'running' },
    { id: 'report', icon: FileText, label: 'Synthesized Report', disabled: !report },
    { id: 'analytics', icon: TrendingUp, label: 'Analytics & Data', disabled: !analysis },
    { id: 'history', icon: History, label: 'History & Tracking', disabled: false }
  ];

  return (
    <div className="app-container immersive-app">
      <div className="tree-visualizer-container immersive-canvas" ref={visualizerContainerRef}>
        <div className="canvas-top-tabs">
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`tab-btn ${activeTab === item.id ? 'active' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'history') setSelectedHistoryItem(null);
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="canvas-utility-bar">
          <div className={`badge ${apiKeys[apiProvider] ? 'badge-strong' : 'badge-moderate'}`}>
            {apiKeys[apiProvider] ? `${apiProvider.toUpperCase()} Connected` : 'Mock Mode Active'}
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: '8px 10px' }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '8px 12px' }}
            onClick={() => setShowSettingsModal(true)}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>

        <div className="canvas-quick-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowGoalModal(true)}
            title="Define the research goal: industry, field, location & source agents"
          >
            <Sparkles size={16} />
            <span>Define Goal</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={status === 'running'}
            onClick={handleRunOrchestration}
          >
            <Play size={16} />
            <span>{status === 'running' ? 'Running...' : 'Run Orchestrator'}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const cloned = JSON.parse(JSON.stringify(activeTree));
              layoutTree(cloned);
              setActiveTree(cloned);
            }}
          >
            <RefreshCw size={14} />
            <span>Reset Layout</span>
          </button>
        </div>

        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            transition: 'transform 0.15s ease-out',
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            position: 'absolute',
            top: '96px',
            left: 0
          }}
        >
          <svg className="tree-svg-overlay" style={{ minWidth: '1200px', minHeight: '900px', position: 'absolute', top: 0, left: 0 }}>
            {connectorLinesList.map((line) => (
              <path key={line.id} d={line.path} className="tree-connection-path" />
            ))}
          </svg>

          {flatNodesList.map((node) => (
            <div
              key={node.id}
              id={`node-${node.id}`}
              className={`agent-node-card level-${node.level} ${selectedNode?.id === node.id ? 'selected' : ''} ${node.status}`}
              style={{
                position: 'absolute',
                left: `${node.x || 0}px`,
                top: `${node.y || 0}px`,
                cursor: draggedNodeId === node.id ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: 'none',
                zIndex: draggedNodeId === node.id ? 100 : 5
              }}
              onMouseDown={(e) => startDrag(e, node.id)}
              onClick={() => handleNodeClick(node)}
            >
              {node.level > 0 && <span className={`node-indicator ${node.status}`} />}
              <span className={`node-badge level-${node.level}`}>Level {node.level}</span>
              <div className="node-title">
                {node.level === 0 ? `👑 ${node.name}` : `👤 ${node.name}`}
              </div>
              <div className="node-role">{node.role}</div>
              {node.level > 0 && node.source && node.source !== 'web' && (
                <div className="node-source-tag">🔗 {node.source}</div>
              )}
            </div>
          ))}
        </div>

        <div className="canvas-toolbar">
          <button
            type="button"
            className="canvas-toolbar-btn"
            onClick={() => {
              const cloned = JSON.parse(JSON.stringify(activeTree));
              layoutTree(cloned);
              setActiveTree(cloned);
              setZoom(1);
            }}
            title="Auto-align & Reset Zoom"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            className="canvas-toolbar-btn"
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
            title="Zoom In"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="canvas-toolbar-btn"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            title="Zoom Out"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="canvas-toolbar-btn"
            onClick={() => setZoom(1)}
            title="Reset Zoom"
          >
            <Maximize size={14} />
          </button>
        </div>

        {activeTab === 'dashboard' && selectedNode && (
          <div
            ref={inspectorPanelRef}
            className="canvas-side-panel sidebar-panel scrollable"
            style={{ left: `${inspectorLeft}px`, top: `${inspectorTop}px` }}
          >
            <div className="sidebar-panel-header">
              <h2>
                <Network size={16} style={{ color: 'hsl(var(--primary))' }} />
                <span>Agent Inspector</span>
              </h2>
              {selectedNode && (
                <span className={`node-badge level-${selectedNode.level}`}>
                  Level {selectedNode.level} • {selectedNode.level === 0 ? 'Master' : 'Sub-agent'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                <div style={{ background: 'rgba(139,92,246,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glow)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Agent Code Name</div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: 'hsl(var(--primary))' }}>{selectedNode.name}</div>

                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginTop: '10px' }}>Specialization Role</div>
                  <div style={{ fontSize: '13px' }}>{selectedNode.role}</div>

                  {selectedNode.level > 0 && (
                    <>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginTop: '10px' }}>Data Source</div>
                      <div style={{ fontSize: '13px' }}>🔗 {selectedNode.source || 'web'}{selectedNode.allowedDomains?.length ? ` (${selectedNode.allowedDomains.join(', ')})` : ''}</div>
                    </>
                  )}

                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginTop: '10px' }}>Instructions</div>
                  <div style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', lineHeight: '1.4' }}>{selectedNode.instructions}</div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={12} />
                    <span>Agent Node Logs</span>
                  </div>

                  <div className="inspector-terminal">
                    {selectedNode.logs && selectedNode.logs.length > 0 ? (
                      selectedNode.logs.map((log, idx) => (
                        <div key={idx} className="inspector-terminal-line">⚡ {log}</div>
                      ))
                    ) : (
                      <div style={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>No logs recorded for this node. Run the orchestrator to fetch logs.</div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-glow)', paddingTop: '10px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '8px', fontSize: '11px' }}
                      disabled={selectedNode.level >= 3}
                      onClick={() => setNewAgentForm('vertical')}
                      title="Add a child reporting to this agent"
                    >
                      ➕ Add Child
                    </button>

                    <button
                      className="btn btn-secondary"
                      style={{ padding: '8px', fontSize: '11px' }}
                      disabled={selectedNode.level === 0}
                      onClick={() => setNewAgentForm('horizontal')}
                      title="Add a sibling reporting to the same parent"
                    >
                      ➕ Add Sibling
                    </button>
                  </div>

                  {selectedNode.level > 0 && (
                    <button
                      className="btn btn-danger"
                      style={{ padding: '8px', width: '100%', fontSize: '11px' }}
                      onClick={() => handleDeleteAgent(selectedNode.id)}
                    >
                      <Trash2 size={12} />
                      <span>Delete Sub-agent Branch</span>
                    </button>
                  )}
                </div>
              </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="canvas-content-panel">
            <div className="terminal-container">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span className="terminal-dot dot-red" />
                  <span className="terminal-dot dot-yellow" />
                  <span className="terminal-dot dot-green" />
                </div>
                <div className="terminal-title">Main Orchestration Execution Terminal</div>
                <div style={{ width: '30px' }} />
              </div>

              <div className="terminal-body">
                {terminalLogs.map((log, idx) => {
                  let logClass = 'info';
                  let prefix = '[ORCHESTRATOR]';
                  if (log.type === 'success') logClass = 'success';
                  if (log.type === 'warn') logClass = 'warn';
                  if (log.type === 'agent') {
                    logClass = 'agent';
                    prefix = `[${log.agentName}]`;
                  }
                  return (
                    <div key={idx} className={`terminal-line ${logClass}`}>
                      <span style={{ color: 'rgba(255,255,255,0.15)', marginRight: '6px' }}>{log.time}</span>
                      <strong style={{ marginRight: '6px' }}>{prefix}</strong>
                      {log.text}
                    </div>
                  );
                })}
                {status === 'running' && (
                  <div className="terminal-line">
                    <span className="terminal-cursor" />
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="canvas-content-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {opportunityItems && (
                <div className="agents-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {opportunityItems.map((item, idx) => (
                    <div key={idx} className="opportunity-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '12px' }}>{item.dimension}</strong>
                        <span className={`badge ${
                          item.score === 'Strong' ? 'badge-strong' : item.score === 'Moderate' ? 'badge-moderate' : 'badge-weak'
                        }`}>
                          {item.score}
                        </span>
                      </div>
                      <p style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', lineHeight: '1.4' }}>
                        {item.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="glass-card" style={{ padding: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-glow)' }}>
                  <h2 style={{ fontSize: '15px' }}>📄 Consolidated Research Report</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={copyToClipboard}>
                      <Clipboard size={13} />
                      <span>Copy</span>
                    </button>
                    <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={downloadReport}>
                      <Download size={13} />
                      <span>Download (.md)</span>
                    </button>
                  </div>
                </div>

                <div className="report-content">
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', color: 'hsl(var(--text-secondary))', fontSize: '13.5px', lineHeight: '1.7' }}>
                    {report}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && analysis && (
          <div className="canvas-content-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Export bar */}
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
                <h2 style={{ fontSize: '15px' }}>📊 Aggregated Analysis</h2>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={exportContactsCSV}>
                    <Download size={13} /><span>Contacts CSV</span>
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={exportAnalysisJSON}>
                    <Download size={13} /><span>Analysis JSON</span>
                  </button>
                  <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={exportDocx}>
                    <FileText size={13} /><span>Word (.doc)</span>
                  </button>
                </div>
              </div>

              {/* Stats chips */}
              <div className="agents-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="opportunity-card">
                  <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Success Rate</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'hsl(var(--primary))' }}>{analysis.statistics?.successRate ?? 'N/A'}</div>
                </div>
                <div className="opportunity-card">
                  <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Growth Rate</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#22c55e' }}>{analysis.statistics?.growthRate ?? 'N/A'}</div>
                </div>
                <div className="opportunity-card">
                  <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Confidence</div>
                  <div style={{ fontSize: '22px', fontWeight: 700 }}>{analysis.statistics?.confidence ?? 'N/A'}</div>
                </div>
                <div className="opportunity-card">
                  <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Overall Sentiment</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: analysis.sentiment?.overall === 'Positive' ? '#22c55e' : analysis.sentiment?.overall === 'Negative' ? 'hsl(var(--danger))' : '#f59e0b' }}>
                    {analysis.sentiment?.overall ?? 'Mixed'}
                  </div>
                </div>
              </div>

              {/* Market Size + Source Distribution (Sankey-style) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div className="glass-card">
                  <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>🌍 Market Size</h3>
                  <p style={{ fontSize: '12px', fontWeight: 600 }}>{analysis.marketSize?.headline}</p>
                  <p style={{ fontSize: '13px', color: 'hsl(var(--primary))', margin: '6px 0' }}>{analysis.marketSize?.totalEstimate}</p>
                  {analysis.marketSize?.breakdown?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                      {analysis.marketSize.breakdown.map((b, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid var(--border-glow)', paddingBottom: '4px' }}>
                          <span>{b.segment}</span>
                          <strong style={{ color: 'hsl(var(--primary))' }}>{b.count}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="glass-card">
                  <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>🔀 Source Contribution Flow</h3>
                  {renderSourceFlow(analysis.statistics?.sourceDistribution || [])}
                </div>
              </div>

              {/* Ideal vs Actual */}
              {analysis.idealVsActual?.dimensions?.length > 0 && (
                <div className="glass-card" style={{ padding: 0 }}>
                  <h3 style={{ fontSize: '14px', padding: '14px 20px', borderBottom: '1px solid var(--border-glow)' }}>📐 Ideal vs Actual — Gap Analysis</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr><th>Dimension</th><th>Ideal</th><th>Actual</th><th>Error Margin</th><th>Improvement</th></tr>
                      </thead>
                      <tbody>
                        {analysis.idealVsActual.dimensions.map((d, i) => (
                          <tr key={i}>
                            <td><strong>{d.dimension}</strong></td>
                            <td style={{ color: '#22c55e' }}>{d.ideal}</td>
                            <td style={{ color: '#f59e0b' }}>{d.actual}</td>
                            <td style={{ color: 'hsl(var(--danger))' }}>{d.errorMargin}</td>
                            <td style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))' }}>{d.improvement}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sentiment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div className="glass-card">
                  <h3 style={{ fontSize: '14px', marginBottom: '8px', color: '#22c55e' }}>👍 Positive Themes</h3>
                  <ul style={{ fontSize: '12.5px', color: 'hsl(var(--text-secondary))', paddingLeft: '18px', lineHeight: '1.7' }}>
                    {(analysis.sentiment?.positives || []).map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
                <div className="glass-card">
                  <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'hsl(var(--danger))' }}>👎 Negative Themes</h3>
                  <ul style={{ fontSize: '12.5px', color: 'hsl(var(--text-secondary))', paddingLeft: '18px', lineHeight: '1.7' }}>
                    {(analysis.sentiment?.negatives || []).map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              </div>

              {/* Contact Directory */}
              <div className="glass-card" style={{ padding: 0 }}>
                <h3 style={{ fontSize: '14px', padding: '14px 20px', borderBottom: '1px solid var(--border-glow)' }}>
                  📇 Contact Directory {analysis.contacts?.length ? `(${analysis.contacts.length})` : ''}
                </h3>
                {analysis.contacts?.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr><th>Name</th><th>Organization</th><th>Role</th><th>Phone</th><th>Rating</th><th>Source</th></tr>
                      </thead>
                      <tbody>
                        {analysis.contacts.map((c, i) => (
                          <tr key={i}>
                            <td><strong>{c.name}</strong></td>
                            <td>{c.organization}</td>
                            <td>{c.role}</td>
                            <td>{c.phone || <span style={{ color: 'hsl(var(--text-muted))' }}>—</span>}</td>
                            <td>{c.rating || '—'}</td>
                            <td><span className="badge badge-moderate" style={{ fontSize: '10px' }}>{c.source}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', fontStyle: 'italic', padding: '14px 20px' }}>
                    No contacts were extracted from the sources in this run.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="canvas-content-panel">
            <div className="dashboard-grid">
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Automated Scheduling</h2>
                  <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))' }}>
                    Schedule the current goal + agent tree to re-run automatically on the server. New runs appear in history below. Switch industry/field anytime via <strong>Define Goal</strong>, then schedule again.
                  </p>
                </div>

                {/* Create schedule */}
                <div style={{ background: 'rgba(139,92,246,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-glow)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>
                    Schedule current goal: <strong style={{ color: 'hsl(var(--primary))' }}>{industry}{goalField ? ` · ${goalField}` : ''}{goalLocation ? ` · ${goalLocation}` : ''}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="form-select"
                      value={scheduleInterval}
                      onChange={(e) => setScheduleInterval(Number(e.target.value))}
                      style={{ flex: 1 }}
                    >
                      {INTERVAL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <button className="btn btn-primary" onClick={createSchedule}>
                      <Clock size={14} />
                      <span>Schedule</span>
                    </button>
                  </div>
                </div>

                {/* Active schedules */}
                <div>
                  <h3 style={{ fontSize: '13px', marginBottom: '10px', color: 'hsl(var(--text-secondary))' }}>
                    Active Schedules ({schedules.length})
                  </h3>
                  {schedules.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>No schedules yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {schedules.map((s) => (
                        <div key={s.id} className="glass-card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {s.active ? '🟢' : '⚪'} {s.label}
                            </div>
                            <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                              {intervalLabel(s.intervalMinutes)} • last run: {s.lastRun ? new Date(s.lastRun).toLocaleString() : 'pending'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button className="btn btn-secondary" style={{ padding: '5px 8px', fontSize: '11px' }} onClick={() => loadScheduleIntoWorkspace(s)} title="Load this goal into the workspace">
                              <RefreshCw size={12} />
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '5px 8px', fontSize: '11px' }} onClick={() => toggleSchedule(s.id, !s.active)}>
                              {s.active ? 'Pause' : 'Resume'}
                            </button>
                            <button className="btn btn-danger" style={{ padding: '5px 8px', fontSize: '11px' }} onClick={() => removeSchedule(s.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <h3 style={{ fontSize: '13px', marginBottom: '10px', color: 'hsl(var(--text-secondary))' }}>Delta Drift Log</h3>
                  {deltaLogs.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>No comparative shifts reported yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {deltaLogs.map((item) => (
                        <details key={item.id} className="glass-card" style={{ padding: '10px' }}>
                          <summary style={{ cursor: 'pointer', fontWeight: '600', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>🔄 Shift: {item.industry}</span>
                            <span style={{ color: 'hsl(var(--text-muted))' }}>{item.date}</span>
                          </summary>
                          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#4ade80', background: '#050811', padding: '10px', borderRadius: '4px', marginTop: '8px' }}>
                            {item.delta}
                          </pre>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 style={{ fontSize: '18px' }}>Run History</h2>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px' }}>
                  {history.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>No archive runs recorded.</p>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="history-item">
                        <div>
                          <strong style={{ fontSize: '14px' }}>💼 {item.industry}</strong>
                          <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                            {item.date} • {item.providerUsed.toUpperCase()}
                          </div>
                        </div>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '11px' }}
                          onClick={() => {
                            setSelectedHistoryItem(item);
                            setReport(item.report);
                            setIndustry(item.industry);
                            setContext(item.context);
                            setAnalysis(item.analysis || null);
                            if (item.treeSnapshot) {
                              setActiveTree(JSON.parse(JSON.stringify(item.treeSnapshot)));
                            }
                            setActiveTab('report');
                          }}
                        >
                          Load
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {newAgentForm && (
        <div className="modal-overlay">
          <form onSubmit={handleAddAgent} className="modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '15px' }}>
                Add {newAgentForm === 'vertical' ? 'Child (Vertical)' : 'Sibling (Horizontal)'} Sub-agent
              </h3>
              <button type="button" className="modal-close-btn" onClick={() => setNewAgentForm(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Code Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. PRICING_AUDITOR"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Specialist Role</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Competitor Price Auditor"
                value={newAgentRole}
                onChange={(e) => setNewAgentRole(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Data Source</label>
              <select
                className="form-select"
                value={newAgentSource}
                onChange={(e) => setNewAgentSource(e.target.value)}
              >
                <option value="web">Open Web</option>
                <option value="google">Google Advanced Search</option>
                <option value="instagram">Instagram</option>
                <option value="reddit">Reddit</option>
                <option value="facebook">Facebook</option>
                <option value="youtube">YouTube</option>
                <option value="website">Specific Websites</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Instructions / Mandate</label>
              <textarea
                className="form-textarea"
                placeholder="Describe what specific research questions this sub-agent must resolve..."
                value={newAgentInstructions}
                onChange={(e) => setNewAgentInstructions(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
              Save Agent
            </button>
          </form>
        </div>
      )}

      {/* RESEARCH GOAL MODAL (Phase 1) */}
      {showGoalModal && (
        <div className="modal-overlay">
          <div className="modal-content scrollable" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '88vh', overflowY: 'auto', maxWidth: '560px' }}>
            <div className="modal-header">
              <h2>🎯 Define Research Goal</h2>
              <button className="modal-close-btn" onClick={() => setShowGoalModal(false)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', marginTop: '-6px' }}>
              The Master Orchestrator reads this goal to design and dispatch its sub-agent network.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">Industry *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Healthcare"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Field / Specialty</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Cardiologist"
                  value={goalField}
                  onChange={(e) => setGoalField(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Location</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Bangalore"
                value={goalLocation}
                onChange={(e) => setGoalLocation(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Objective / Mandate</label>
              <textarea
                className="form-textarea"
                placeholder="What exactly should this research achieve? e.g. Map every cardiologist, their hospitals, ratings, contact details, and identify the biggest service gaps."
                value={goalObjective}
                onChange={(e) => setGoalObjective(e.target.value)}
              />
            </div>

            {/* Custom source agents */}
            <div style={{ borderTop: '1px solid var(--border-glow)', paddingTop: '12px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                Custom Source Agents
              </label>
              <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginBottom: '10px' }}>
                Define named agents and the source each one researches. They become Level 1 specialists under the orchestrator. Leave empty to let the orchestrator auto-design the team.
              </p>

              {goalCustomAgents.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                  {goalCustomAgents.map((agent, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'rgba(139,92,246,0.04)', border: '1px solid var(--border-glow)', borderRadius: '6px', padding: '8px 10px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                          {agent.name} <span style={{ fontSize: '10px', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>• {agent.source}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {agent.instructions}
                        </div>
                      </div>
                      <button className="btn btn-danger" style={{ padding: '5px 8px', fontSize: '11px', flexShrink: 0 }} onClick={() => removeDraftAgent(idx)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Agent name e.g. INSTAGRAM_MONITOR"
                  value={draftAgent.name}
                  onChange={(e) => setDraftAgent({ ...draftAgent, name: e.target.value })}
                />
                <select
                  className="form-select"
                  value={draftAgent.source}
                  onChange={(e) => setDraftAgent({ ...draftAgent, source: e.target.value })}
                >
                  <option value="web">Open Web</option>
                  <option value="google">Google Advanced Search</option>
                  <option value="instagram">Instagram</option>
                  <option value="reddit">Reddit</option>
                  <option value="facebook">Facebook</option>
                  <option value="youtube">YouTube</option>
                  <option value="website">Specific Websites</option>
                </select>
              </div>
              <textarea
                className="form-textarea"
                style={{ marginTop: '8px' }}
                placeholder="Instructions for this agent: what should it find from this source?"
                value={draftAgent.instructions}
                onChange={(e) => setDraftAgent({ ...draftAgent, instructions: e.target.value })}
              />
              <button className="btn btn-secondary" style={{ marginTop: '8px', width: '100%', padding: '8px' }} onClick={addDraftAgent}>
                <Plus size={14} />
                <span>Add Source Agent</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-glow)', paddingTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowGoalModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={applyGoal}>
                <CheckCircle2 size={15} />
                <span>Apply Goal &amp; Build Tree</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="modal-header">
              <h2>Settings & Key Manager</h2>
              <button className="modal-close-btn" onClick={() => setShowSettingsModal(false)}>
                <X size={20} />
              </button>
            </div>

            {/* API Provider Selector */}
            <div className="form-group">
              <label className="form-label">API Service Provider</label>
              <select 
                className="form-select"
                value={apiProvider}
                onChange={(e) => setApiProvider(e.target.value)}
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">ChatGPT (OpenAI)</option>
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="openrouter">OpenRouter (Universal)</option>
              </select>
            </div>

            {/* API Key paste container */}
            <div className="form-group">
              <label className="form-label">
                {apiProvider.toUpperCase()} Secret API Key
              </label>
              <input 
                type="password" 
                className="form-input" 
                placeholder={`Paste your ${apiProvider} key...`}
                value={currentKeyInput}
                onChange={(e) => setCurrentKeyInput(e.target.value)}
              />
              <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                Your key is stored in the local backend database. Leave empty to use simulated mock intelligence.
              </p>
            </div>

            {/* Tavily web-search key (grounded research) */}
            <div className="form-group">
              <label className="form-label">
                Tavily Search API Key
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Paste your Tavily key to enable grounded research..."
                  value={tavilyKey}
                  onChange={(e) => setTavilyKey(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={saveTavilyKey}>
                  Save
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                Optional. When set, sub-agents perform real web search (restricted to their allowed domains) and must ground every finding in retrieved sources. Leave empty to run ungrounded.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={async () => {
                  const updatedKeys = { ...apiKeys, [apiProvider]: '' };

                  try {
                    const saved = await apiRequest('/settings', {
                      method: 'PUT',
                      body: JSON.stringify({
                        provider: apiProvider,
                        apiKeys: updatedKeys,
                        tavilyApiKey: tavilyKey
                      })
                    });

                    setCurrentKeyInput('');
                    setApiProvider(saved.provider);
                    setApiKeys(saved.apiKeys);
                    setTavilyKey(saved.tavilyApiKey || '');
                  } catch (error) {
                    console.error(error);
                    alert(`Unable to clear key: ${error.message}`);
                  }
                }}
                style={{ color: 'hsl(var(--danger))' }}
              >
                Clear Key
              </button>
              <button className="btn btn-primary" onClick={saveProviderKey}>
                Save Key
              </button>
              <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
