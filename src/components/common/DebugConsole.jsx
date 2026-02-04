import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import './DebugConsole.css';

const DebugConsole = () => {
    const [logs, setLogs] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const isInitialMount = useRef(true);

    const logsEndRef = useRef(null);

    // Capture console logs once on mount
    useEffect(() => {
        if (!isInitialMount.current) return;
        isInitialMount.current = false;

        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;

        const addLog = (type, args) => {
            const message = args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        // Handle circular references
                        const seen = new WeakSet();
                        return JSON.stringify(arg, (key, value) => {
                            if (typeof value === 'object' && value !== null) {
                                if (seen.has(value)) return '[Circular]';
                                seen.add(value);
                            }
                            return value;
                        }, 2);
                    } catch (e) {
                        return `[Object: ${String(arg)}]`;
                    }
                }
                return String(arg);
            }).join(' ');

            setLogs(prev => {
                const newLogs = [...prev, {
                    type,
                    message,
                    timestamp: new Date().toLocaleTimeString()
                }];
                // Keep only last 100 logs
                return newLogs.slice(-100);
            });
        };

        // Wrap in try-catch to prevent any assignment errors
        try {
            console.log = function (...args) {
                addLog('log', args);
                return originalLog.apply(this, args);
            };

            console.error = function (...args) {
                addLog('error', args);
                return originalError.apply(this, args);
            };

            console.warn = function (...args) {
                addLog('warn', args);
                return originalWarn.apply(this, args);
            };

            console.info = function (...args) {
                addLog('info', args);
                return originalInfo.apply(this, args);
            };
        } catch (error) {
            console.error('Failed to intercept console:', error);
        }

        // Restore on unmount
        return () => {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
            console.info = originalInfo;
        };
    }, []); // Empty dependency array - only run once

    const scrollToBottom = () => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [logs, isOpen]);

    if (!isVisible) return <button className="debug-toggle-mini" onClick={() => setIsVisible(true)}>🐞</button>;

    return (
        <div className={`debug-console-container ${isOpen ? 'open' : 'closed'}`}>
            <div className="debug-header" onClick={() => setIsOpen(!isOpen)}>
                <div className="header-left">
                    <Terminal size={16} />
                    <span>Debug Console ({logs.length})</span>
                </div>
                <div className="header-actions">
                    <button onClick={(e) => { e.stopPropagation(); setLogs([]); }} title="Clear">
                        <Trash2 size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setIsVisible(false); }} title="Close">
                        <X size={16} />
                    </button>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
            </div>

            {isOpen && (
                <div className="debug-content">
                    {logs.length === 0 && <div className="empty-logs">No logs yet...</div>}
                    {logs.map((log, index) => (
                        <div key={index} className={`log-entry ${log.type}`}>
                            <span className="timestamp">[{log.timestamp}]</span>
                            <pre className="message">{log.message}</pre>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}
        </div>
    );
};

export default DebugConsole;