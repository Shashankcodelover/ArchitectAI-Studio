import React, { useState } from 'react';
import { Play, Copy, Check, Globe, Zap, Terminal, Activity } from 'lucide-react';

export default function LiveEndpointManager({ mockUrl, endpoints }) {
    const [testResponse, setTestResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);

    const copyToClipboard = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const runTest = async (method, path) => {
        setLoading(true);
        setTestResponse(null);
        try {
            const fullUrl = `${mockUrl}${path}`;
            const res = await fetch(fullUrl, { method });
            const data = await res.json();
            setTestResponse({
                status: res.status,
                data
            });
        } catch (err) {
            setTestResponse({
                status: 'Error',
                data: err.message
            });
        } finally {
            setLoading(false);
        }
    };

    if (!mockUrl || !endpoints || endpoints.length === 0) return null;

    return (
        <div className="live-endpoint-manager animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="manager-header">
                <div className="flex items-center gap-2">
                    <div className="live-indicator">
                        <div className="pulse-dot"></div>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-green-500">Live Mock API Active</h3>
                </div>
                <div className="mock-url-badge">
                    <Globe size={10} className="text-slate-400" />
                    <span>{mockUrl}</span>
                </div>
            </div>

            <div className="manager-body">
                <div className="endpoints-list">
                    <div className="section-label">Available Endpoints</div>
                    {endpoints.map((ep, i) => (
                        <div key={i} className="endpoint-item group">
                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                <span className={`method-badge ${ep.method.toLowerCase()}`}>
                                    {ep.method}
                                </span>
                                <span className="path-text font-mono text-xs truncate">
                                    {ep.path}
                                </span>
                            </div>
                            
                            <div className="endpoint-actions opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    className="action-btn"
                                    onClick={() => copyToClipboard(`curl -X ${ep.method} ${mockUrl}${ep.path}`, i)}
                                    title="Copy cURL"
                                >
                                    {copiedIndex === i ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                </button>
                                <button 
                                    className="action-btn run-btn"
                                    onClick={() => runTest(ep.method, ep.path)}
                                    disabled={loading}
                                    title="Test Request"
                                >
                                    <Play size={12} fill="currentColor" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="test-client">
                    <div className="section-label">Test Client Output</div>
                    <div className="output-screen">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
                                <Zap size={20} className="animate-pulse text-amber-500" />
                                <span className="text-[10px] font-mono">Fetching synthetic data...</span>
                            </div>
                        ) : testResponse ? (
                            <div className="json-container">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-mono text-slate-500 uppercase">Status: {testResponse.status}</span>
                                    <Activity size={10} className="text-green-500" />
                                </div>
                                <pre className="json-pre">
                                    {JSON.stringify(testResponse.data, null, 2)}
                                </pre>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600 italic text-[11px]">
                                <Terminal size={18} opacity={0.3} />
                                <span>Select an endpoint to run a test request</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .live-endpoint-manager {
                    margin: 12px;
                    background: #111827;
                    border: 1px solid #1f2937;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
                }
                .manager-header {
                    padding: 8px 12px;
                    background: rgba(16, 185, 129, 0.05);
                    border-bottom: 1px solid #1f2937;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .live-indicator {
                    width: 12px;
                    height: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .pulse-dot {
                    width: 8px;
                    height: 8px;
                    background: #10b981;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #10b981;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(0.95); opacity: 0.5; }
                    50% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.5; }
                }
                .mock-url-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #030712;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-family: var(--font-code);
                    font-size: 10px;
                    color: #94a3b8;
                    border: 1px solid #1f2937;
                }
                .manager-body {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    height: 220px;
                }
                .endpoints-list {
                    padding: 10px;
                    border-right: 1px solid #1f2937;
                    overflow-y: auto;
                }
                .section-label {
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #4b5563;
                    margin-bottom: 8px;
                }
                .endpoint-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 6px 8px;
                    border-radius: 6px;
                    margin-bottom: 4px;
                    transition: background 0.15s;
                }
                .endpoint-item:hover {
                    background: #1f2937;
                }
                .method-badge {
                    font-size: 9px;
                    font-weight: 800;
                    padding: 1px 5px;
                    border-radius: 4px;
                    min-width: 45px;
                    text-align: center;
                }
                .method-badge.get { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
                .method-badge.post { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
                .method-badge.put { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
                .method-badge.delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
                
                .endpoint-actions {
                    display: flex;
                    gap: 4px;
                }
                .action-btn {
                    padding: 4px;
                    border-radius: 4px;
                    color: #64748b;
                    transition: all 0.15s;
                }
                .action-btn:hover {
                    background: #374151;
                    color: #f1f5f9;
                }
                .run-btn:hover {
                    color: #10b981;
                }
                
                .test-client {
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                }
                .output-screen {
                    flex: 1;
                    background: #030712;
                    border: 1px solid #1f2937;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .json-container {
                    padding: 10px;
                    height: 100%;
                    overflow: auto;
                }
                .json-pre {
                    font-family: var(--font-code);
                    font-size: 11px;
                    color: #a6accd;
                    line-height: 1.4;
                }
                
                /* Custom Scrollbar */
                .endpoints-list::-webkit-scrollbar, .json-container::-webkit-scrollbar {
                    width: 4px;
                }
                .endpoints-list::-webkit-scrollbar-thumb, .json-container::-webkit-scrollbar-thumb {
                    background: #374151;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
