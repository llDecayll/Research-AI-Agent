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

  // History & Scheduling
  const [history, setHistory] = useState([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [deltaLogs, setDeltaLogs] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

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
        const [settings, historyItems] = await Promise.all([
          apiRequest('/settings'),
          apiRequest('/history')
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

  // Automated rerun scheduler effect
  useEffect(() => {
    let interval = null;
    if (isScheduled && status === 'complete') {
      interval = setInterval(() => {
        handleRunOrchestration(null, report);
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isScheduled, status, report]);

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

        {activeTab === 'history' && (
          <div className="canvas-content-panel">
            <div className="dashboard-grid">
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Automated Tracking</h2>
                  <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))' }}>
                    Simulates ongoing cron jobs checking for updates to active variables. Re-runs the research tree every 10 seconds and highlights drifts.
                  </p>
                </div>

                <div className="switch-container" style={{ background: 'rgba(139,92,246,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-glow)' }}>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      disabled={!report}
                    />
                    <span className="slider"></span>
                  </label>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>
                      {isScheduled ? '🟢 Background monitoring active' : '🔴 Background monitoring inactive'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>
                      {!report ? 'Complete a research run first to toggle' : 'Compiles comparative delta summaries'}
                    </div>
                  </div>
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
