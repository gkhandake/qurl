import React, { useState, useEffect } from 'react';
import { getVscodeApi } from './vscode';

const vscode = getVscodeApi();

interface HeaderItem {
  key: string;
  value: string;
  active: boolean;
}

interface NodeBase {
  id: string;
  name: string;
  parentId: string | null;
}

interface RequestNode extends NodeBase {
  type: 'request';
  method: string;
  url: string;
  headers: HeaderItem[];
  body: string;
}

interface FolderNode extends NodeBase {
  type: 'folder';
  expanded?: boolean;
}

type CollectionNode = RequestNode | FolderNode;

// --- SVG Icons mimicking VS Code Codicons ---
const FolderIcon = () => (
  <svg className="icon-svg" viewBox="0 0 16 16"><path d="M7 2l1 1h6v9H2V2h5zm0-1H1v12h14V4H8L7 1z"/></svg>
);
const FolderOpenedIcon = () => (
  <svg className="icon-svg" viewBox="0 0 16 16"><path d="M1 2v12h14V4H8L7 2H1zm13 11H2V3h4.5l1 2H14v8z"/></svg>
);
const FileIcon = () => (
  <svg className="icon-svg" viewBox="0 0 16 16"><path d="M13 4l-4-4H3v16h10V4zm-1 9H4V1h4v4h4v8z"/></svg>
);
const PlusIcon = () => (
  <svg className="icon-svg" style={{margin:0}} viewBox="0 0 16 16"><path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/></svg>
);
const CopyIcon = () => (
  <svg className="icon-svg" style={{margin:0}} viewBox="0 0 16 16"><path d="M4 4l1-1h5.4L14 6.6V16H4V4zm6 1l3 3h-3V5zM5 5v10h8V9H9V5H5z"/><path d="M2.5 1h6L9 1.5V3H8V2H3v9h1v1H2.5L2 11.5v-10L2.5 1z"/></svg>
);

export default function App() {
  const [nodes, setNodes] = useState<CollectionNode[]>([]);
  
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<HeaderItem[]>([{ key: '', value: '', active: true }]);
  const [body, setBody] = useState('');
  
  const [activeTab, setActiveTab] = useState<'headers' | 'body'>('headers');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveParentId, setSaveParentId] = useState<string | null>(null);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderParentId, setFolderParentId] = useState<string | null>(null);

  useEffect(() => {
    vscode.postMessage({ command: 'loadCollections' });

    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'loadedCollections':
          setNodes(Array.isArray(message.payload) ? message.payload : []);
          break;
        case 'requestResponse':
          setLoading(false);
          setResponse(message.payload);
          break;
        case 'requestError':
          setLoading(false);
          setResponse({
            isError: true,
            status: 'Failed',
            ...message.payload
          });
          break;
      }
    };

    window.addEventListener('message', messageListener);
    return () => window.removeEventListener('message', messageListener);
  }, []);

  const saveNodesToGlobal = (newNodes: CollectionNode[]) => {
    setNodes(newNodes);
    vscode.postMessage({
      command: 'saveCollection',
      payload: { collections: newNodes }
    });
  };

  const sendRequest = () => {
    if (!url) return;
    setLoading(true);
    setResponse(null);
    vscode.postMessage({
      command: 'sendRequest',
      payload: { method, url, headers, body }
    });
  };

  const generateCurl = () => {
    let curl = `curl -X ${method} "${url}"`;
    headers.forEach(h => {
      if (h.key && h.active) curl += ` -H "${h.key}: ${h.value}"`;
    });
    if (method !== 'GET' && body) curl += ` -d '${body}'`;
    navigator.clipboard.writeText(curl);
  };

  const openSaveModal = () => {
    setSaveName(method + ' ' + url);
    setSaveParentId(null);
    setShowSaveModal(true);
  };

  const confirmSaveRequest = () => {
    if (!saveName) return;
    const newReq: RequestNode = {
      id: Date.now().toString(),
      type: 'request',
      name: saveName,
      parentId: saveParentId,
      method,
      url,
      headers,
      body
    };
    saveNodesToGlobal([...nodes, newReq]);
    setShowSaveModal(false);
  };

  const openFolderModal = (parentId: string | null = null) => {
    setFolderName('');
    setFolderParentId(parentId);
    setShowFolderModal(true);
  };

  const confirmSaveFolder = () => {
    if (!folderName) return;
    const newFolder: FolderNode = {
      id: Date.now().toString(),
      type: 'folder',
      name: folderName,
      parentId: folderParentId,
      expanded: true
    };
    saveNodesToGlobal([...nodes, newFolder]);
    setShowFolderModal(false);
  };

  const loadRequest = (req: RequestNode) => {
    setMethod(req.method);
    setUrl(req.url);
    setHeaders(req.headers || [{ key: '', value: '', active: true }]);
    setBody(req.body || '');
    setResponse(null);
  };

  const toggleFolder = (folder: FolderNode) => {
    const updated = nodes.map(n => n.id === folder.id ? { ...n, expanded: !(n as FolderNode).expanded } : n);
    saveNodesToGlobal(updated as CollectionNode[]);
  };

  const startNewRequest = () => {
    setMethod('GET');
    setUrl('');
    setHeaders([{ key: '', value: '', active: true }]);
    setBody('');
    setResponse(null);
  };

  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = val;
    setHeaders(newHeaders);
  };

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '', active: true }]);
  };

  const removeHeader = (index: number) => {
    const newH = headers.filter((_, i) => i !== index);
    if (newH.length === 0) newH.push({ key: '', value: '', active: true });
    setHeaders(newH);
  };

  const renderTree = (parentId: string | null, depth = 0) => {
    const children = nodes.filter(n => n.parentId === parentId);
    if (children.length === 0 && depth === 0) {
      return (
        <div style={{ padding: '16px', opacity: 0.5, fontSize: '12px', textAlign: 'center' }}>
          No collections found.
        </div>
      );
    }

    return children.sort((a,b) => (a.type === 'folder' ? -1 : 1)).map(node => {
      const paddingLeft = 16 + depth * 12;
      if (node.type === 'folder') {
        const isExpanded = (node as FolderNode).expanded;
        return (
          <div key={node.id}>
            <div 
              className="collection-item" 
              style={{ paddingLeft }}
              onClick={() => toggleFolder(node as FolderNode)}
            >
              {isExpanded ? <FolderOpenedIcon /> : <FolderIcon />}
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
            </div>
            {isExpanded && renderTree(node.id, depth + 1)}
          </div>
        );
      } else {
        return (
          <div key={node.id} className="collection-item" style={{ paddingLeft }} onClick={() => loadRequest(node as RequestNode)}>
            <span className={`method-badge method-${(node as RequestNode).method}`}>{(node as RequestNode).method}</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
          </div>
        );
      }
    });
  };

  const foldersOnly = nodes.filter(n => n.type === 'folder') as FolderNode[];

  return (
    <div className="app-container">
      {/* Sidebar Collections */}
      <div className="sidebar">
        <div className="sidebar-header">
          <span>Qurl Collections</span>
          <div style={{ display: 'flex', gap: '4px' }}>
             <button className="btn-icon" title="New Folder" onClick={() => openFolderModal(null)}><FolderIcon /></button>
             <button className="btn-icon" title="New Request" onClick={startNewRequest}><PlusIcon /></button>
          </div>
        </div>
        <div className="collection-list">
          {renderTree(null)}
        </div>
      </div>

      <div className="main-content">
        {/* URL Bar */}
        <div className="url-bar-section">
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
            <option>PATCH</option>
          </select>
          <input 
            type="text" 
            className="url-input" 
            placeholder="https://api.example.com/v1/resource" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendRequest()}
          />
          <button className="btn" onClick={sendRequest} disabled={loading}>
            {loading ? 'Sending...' : 'Send'}
          </button>
          <button className="btn btn-secondary" onClick={openSaveModal}>Save</button>
        </div>

        {/* Request Setup Tabs */}
        <div className="tabs">
          <div className={`tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>Headers</div>
          <div className={`tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>Body</div>
          <div style={{ flex: 1 }}></div>
          <button className="btn-icon" style={{ margin: '4px' }} title="Copy as cURL" onClick={generateCurl}>
            <CopyIcon />
          </button>
        </div>

        <div className="panel-container">
          {activeTab === 'headers' && (
            <div style={{ overflowY: 'auto' }}>
              {headers.map((h, i) => (
                <div key={i} className="key-value-row">
                  <input placeholder="Header Name" value={h.key} onChange={(e) => updateHeader(i, 'key', e.target.value)} />
                  <input placeholder="Value" value={h.value} onChange={(e) => updateHeader(i, 'value', e.target.value)} />
                  <button className="remove-btn" title="Remove" onClick={() => removeHeader(i)}>×</button>
                </div>
              ))}
              <button className="add-btn" onClick={addHeader}>+ Add Header</button>
            </div>
          )}

          {activeTab === 'body' && (
            <textarea 
              className="code-area"
              placeholder="Enter JSON or raw text body here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          )}
        </div>

        <div className="response-section">
          {!response ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.3, fontSize: '14px' }}>
              Send a request to see the response here
            </div>
          ) : response.isError ? (
            <div className="error-banner">
              <h4>Request Failed: {response.code || 'Network Error'}</h4>
              <p>{response.error}</p>
              {response.config?.url && (
                <p style={{ opacity: 0.7, marginTop: 8 }}>Attempted {response.config.method?.toUpperCase()} {response.config.url}</p>
              )}
            </div>
          ) : (
            <>
              <div className="response-meta">
                <span>Status: <span className={`status-badge ${response.status >= 200 && response.status < 300 ? 'status-good' : (response.status >= 400 ? 'status-bad' : 'status-warn')}`}>{response.status} {response.statusText}</span></span>
                {response.time && <span>Time: <span style={{ color: 'var(--success-color)' }}>{response.time} ms</span></span>}
                {response.data && <span>Size: {new Blob([typeof response.data === 'string' ? response.data : JSON.stringify(response.data)]).size} bytes</span>}
              </div>
              <pre className="resp-body">
                {typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data}
              </pre>
            </>
          )}
        </div>
      </div>

      {/* Save Request Modal */}
      {showSaveModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Save Request</h3>
            <label>Name</label>
            <input style={{ width: '100%', marginBottom: 12 }} value={saveName} onChange={e => setSaveName(e.target.value)} />
            
            <label>Folder Location</label>
            <select style={{ width: '100%', marginBottom: 16 }} value={saveParentId || ''} onChange={e => setSaveParentId(e.target.value || null)}>
              <option value="">(Root)</option>
              {foldersOnly.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button className="btn" onClick={confirmSaveRequest}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showFolderModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>New Folder</h3>
            <label>Folder Name</label>
            <input style={{ width: '100%', marginBottom: 12 }} value={folderName} onChange={e => setFolderName(e.target.value)} />
            
            <label>Parent Folder</label>
            <select style={{ width: '100%', marginBottom: 16 }} value={folderParentId || ''} onChange={e => setFolderParentId(e.target.value || null)}>
              <option value="">(Root)</option>
              {foldersOnly.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowFolderModal(false)}>Cancel</button>
              <button className="btn" onClick={confirmSaveFolder}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
