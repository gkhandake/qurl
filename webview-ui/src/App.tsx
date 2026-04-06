import React, { useState, useEffect } from 'react';
import { getVscodeApi } from './vscode';

const vscode = getVscodeApi();

interface HeaderItem {
  key: string;
  value: string;
  active: boolean;
}

interface RequestState {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: HeaderItem[];
  body: string;
}

export default function App() {
  const [collections, setCollections] = useState<RequestState[]>([]);
  
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<HeaderItem[]>([{ key: '', value: '', active: true }]);
  const [body, setBody] = useState('');
  
  const [activeTab, setActiveTab] = useState<'headers' | 'body'>('headers');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  useEffect(() => {
    vscode.postMessage({ command: 'loadCollections' });

    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'loadedCollections':
          setCollections(message.payload);
          break;
        case 'requestResponse':
          setLoading(false);
          setResponse(message.payload);
          break;
        case 'requestError':
          setLoading(false);
          setResponse({ status: 'Error', statusText: message.payload.error, data: '' });
          break;
      }
    };

    window.addEventListener('message', messageListener);
    return () => window.removeEventListener('message', messageListener);
  }, []);

  const sendRequest = () => {
    if (!url) return;
    setLoading(true);
    setResponse(null);
    vscode.postMessage({
      command: 'sendRequest',
      payload: { method, url, headers, body }
    });
  };

  const saveToCollection = () => {
    const name = prompt('Enter a name for this request:', method + ' ' + url);
    if (!name) return;

    const newReq: RequestState = {
      id: Date.now().toString(),
      name,
      method,
      url,
      headers,
      body
    };

    const updated = [...collections, newReq];
    setCollections(updated);
    vscode.postMessage({
      command: 'saveCollection',
      payload: { collections: updated }
    });
  };

  const loadRequest = (req: RequestState) => {
    setMethod(req.method);
    setUrl(req.url);
    setHeaders(req.headers || [{ key: '', value: '', active: true }]);
    setBody(req.body || '');
    setResponse(null);
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

  return (
    <div className="app-container">
      {/* Sidebar Collections */}
      <div className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Collections</span>
          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={startNewRequest}>+</button>
        </div>
        <div className="collection-list">
          {collections.map(c => (
            <div key={c.id} className="collection-item" onClick={() => loadRequest(c)}>
              <span className={`method-badge method-${c.method}`}>{c.method}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
            </div>
          ))}
          {collections.length === 0 && (
            <div style={{ padding: '16px', opacity: 0.5, fontSize: '12px', textAlign: 'center' }}>
              No saved requests yet.
            </div>
          )}
        </div>
      </div>

      <div className="main-content">
        {/* URL Bar */}
        <div className="url-bar-section">
          <select className="method-select" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
            <option>PATCH</option>
          </select>
          <input 
            type="text" 
            className="url-input" 
            placeholder="Enter request URL" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendRequest()}
          />
          <button className="btn" onClick={sendRequest} disabled={loading}>
            {loading ? 'Sending...' : 'Send'}
          </button>
          <button className="btn btn-secondary" onClick={saveToCollection}>Save</button>
        </div>

        {/* Request Setup Tabs */}
        <div className="tabs">
          <div className={`tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>Headers</div>
          <div className={`tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>Body</div>
        </div>

        <div className="panel-container">
          {activeTab === 'headers' && (
            <div>
              {headers.map((h, i) => (
                <div key={i} className="key-value-row">
                  <input placeholder="Key" value={h.key} onChange={(e) => updateHeader(i, 'key', e.target.value)} />
                  <input placeholder="Value" value={h.value} onChange={(e) => updateHeader(i, 'value', e.target.value)} />
                  <button className="remove-btn" onClick={() => removeHeader(i)}>×</button>
                </div>
              ))}
              <button className="add-btn" onClick={addHeader}>+ Add Header</button>
            </div>
          )}

          {activeTab === 'body' && (
            <textarea 
              className="code-area"
              placeholder="Enter JSON or plain text body here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          )}
        </div>

        {/* Response Section */}
        {response && (
          <div className="response-section">
            <div className="response-meta">
              <span>Status: <span className={`status-badge ${response.status >= 200 && response.status < 300 ? 'status-good' : (response.status >= 400 ? 'status-bad' : 'status-warn')}`}>{response.status} {response.statusText}</span></span>
              {response.time && <span>Time: {response.time} ms</span>}
            </div>
            <pre className="resp-body">
              {typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
