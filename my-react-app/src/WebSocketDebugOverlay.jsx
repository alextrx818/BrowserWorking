import React, { useState, useEffect } from 'react';
import './WebSocketDebugOverlay.css';

const WebSocketDebugOverlay = ({ 
  visible, 
  wsStatus, 
  messageCount, 
  lastMessage, 
  updateCount, 
  connectionTime,
  onClose
}) => {
  const [expanded, setExpanded] = useState(true);
  const [startTime] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every second for uptime display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  if (!visible) return null;
  
  // Calculate uptime
  const uptimeSeconds = Math.floor((currentTime - startTime) / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Calculate message rate per minute
  const minutesElapsed = uptimeSeconds / 60;
  const messageRate = minutesElapsed > 0 
    ? (messageCount / minutesElapsed).toFixed(2) 
    : messageCount;
  
  // Format the last message for display
  const formatLastMessage = (msg) => {
    if (!msg) return 'None';
    if (typeof msg === 'object') {
      try {
        // Just show basic info about the message
        if (Array.isArray(msg)) {
          return `Array with ${msg.length} items`;
        } else {
          const keys = Object.keys(msg);
          return `Object with keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`;
        }
      } catch (e) {
        return 'Error parsing message';
      }
    }
    // Truncate string messages
    return typeof msg === 'string' && msg.length > 100 
      ? `${msg.substring(0, 100)}...` 
      : String(msg);
  };
  
  const statusColor = {
    connected: '#4CAF50',
    disconnected: '#F44336',
    error: '#FF9800',
    connecting: '#2196F3'
  };
  
  return (
    <div className="websocket-debug-overlay">
      <div className="debug-header">
        <h3>WebSocket Debug {expanded ? '▼' : '▶'}</h3>
        <div className="debug-controls">
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
      </div>
      
      {expanded && (
        <div className="debug-content">
          <div className="status-row">
            <div className="status-label">Status:</div>
            <div className="status-value" style={{ color: statusColor[wsStatus] || '#999' }}>
              {wsStatus.toUpperCase()}
            </div>
          </div>
          
          <div className="metric-row">
            <div className="metric">
              <div className="metric-label">Messages</div>
              <div className="metric-value">{messageCount}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Updates</div>
              <div className="metric-value">{updateCount}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Efficiency</div>
              <div className="metric-value">
                {messageCount > 0 ? (updateCount / messageCount * 100).toFixed(1) + '%' : '0%'}
              </div>
            </div>
          </div>
          
          <div className="timing-row">
            <div className="timing">
              <div className="timing-label">Connected</div>
              <div className="timing-value">
                {connectionTime ? new Date(connectionTime).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
            <div className="timing">
              <div className="timing-label">Uptime</div>
              <div className="timing-value">{uptimeDisplay}</div>
            </div>
            <div className="timing">
              <div className="timing-label">Msg/min</div>
              <div className="timing-value">{messageRate}</div>
            </div>
          </div>
          
          <div className="message-section">
            <div className="message-label">Last Message:</div>
            <div className="message-content">
              {formatLastMessage(lastMessage)}
            </div>
          </div>
          
          <div className="help-text">
            Press <kbd>Alt</kbd> + <kbd>D</kbd> to toggle this overlay
          </div>
        </div>
      )}
    </div>
  );
};

export default WebSocketDebugOverlay;
