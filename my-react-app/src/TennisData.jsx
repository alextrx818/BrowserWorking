import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import './TennisData.css';
import WebSocketDebugOverlay from './WebSocketDebugOverlay';

// Debug can be toggled with Alt+D or window.enableWebSocketDebug(true)
const DEBUG = true;

// Helper function for deep equality comparison
function isEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

function TennisData() {
  const API_ENDPOINT = '/api/tennis';
  const DEBUG = false; // Set to true to enable more verbose logging
  
  // React Query client
  const queryClient = useQueryClient();
  
  // State variables
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('Never');
  const [wsMessageCount, setWsMessageCount] = useState(0);
  const [updateCount, setUpdateCount] = useState(0);
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [debugOverlayVisible, setDebugOverlayVisible] = useState(false);
  const [lastWsMessage, setLastWsMessage] = useState(null);
  const [wsConnectionTime, setWsConnectionTime] = useState(null);
  const [recentUpdate, setRecentUpdate] = useState(new Set());
  const navigate = useNavigate();
  const ws = useRef(null);
  const dataRef = useRef(null);
  const previousDataHash = useRef('');
  
  // Create a separate state for previous match data to compare for highlighting changes
  const [previousMatches, setPreviousMatches] = useState({});
  
  // React Query hook for fetching tennis data
  const { 
    data: queryData,
    isLoading: queryLoading,
    isError: queryError,
    error: queryErrorDetails,
    refetch
  } = useQuery(
    'tennisData', 
    async () => {
      logDebug('Fetching data using React Query...');
      const response = await fetch(API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return response.json();
    },
    {
      refetchOnWindowFocus: false,
      refetchInterval: false, // Disable auto polling, we'll use WebSockets
      onSuccess: (data) => {
        if (data && data.matches && data.matches.length > 0) {
          dataRef.current = data;
          const timestamp = data.timestamp 
            ? new Date(data.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })
            : new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
          setLastUpdated(timestamp + ' ET (HTTP)');
          setLoading(false);
          setError(null);
        }
      },
      onError: (err) => {
        console.error('⚠️ Error fetching data via React Query:', err);
        setError(err.message);
      }
    }
  );
  
  // Function to check if a specific value has changed
  const hasValueChanged = (matchId, path, newValue) => {
    if (!previousMatches[matchId]) return false;
    
    // Navigate the path to get the old value
    let oldValue = previousMatches[matchId];
    const parts = path.split('.');
    
    for (const part of parts) {
      if (!oldValue || typeof oldValue !== 'object') return false;
      oldValue = oldValue[part];
    }
    
    // Compare the values
    return oldValue !== newValue;
  };

  // Add debug window logging
  window.tennisDebug = {
    enableLogging: false,
    stats: {
      wsMessages: 0,
      dataUpdates: 0,
      errors: 0,
      renders: 0
    }
  };
  
  // Debug logger function
  const logDebug = (...args) => {
    if (DEBUG || window.tennisDebug?.enableLogging) {
      console.log(`[TennisData:${updateCount}]`, ...args);
      
      // Update the stats in the global object
      if (window.tennisDebug) {
        window.tennisDebug.stats.renders++;
      }
    }
  };

  // Log component renders
  useEffect(() => {
    logDebug(`Component rendered (${updateCount})`);
    setUpdateCount(prevCount => prevCount + 1);
  }, [updateCount]);

  // Use memo to prevent unnecessary re-renders
  const memoizedRender = useMemo(() => {
    // This will only be recalculated when data changes
    logDebug("Recalculating memoized render");
    return dataRef.current ? dataRef.current.matches : null;
  }, [dataRef]);

  const fetchData = async () => {
    try {
      logDebug('Fetching data from API...');
      setLoading(true);
      
      console.log('⚠️ Attempting to fetch data from /api/tennis');
      const response = await fetch('/api/tennis');
      console.log('⚠️ API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const jsonData = await response.json();
      console.log('⚠️ API response data:', jsonData);
      
      if (jsonData && jsonData.matches && jsonData.matches.length > 0) {
        logDebug(`Received ${jsonData.matches.length} matches from API`);
        console.log(`⚠️ Received ${jsonData.matches.length} matches from API`);
        
        // Calculate a hash for comparison
        const newDataHash = JSON.stringify(jsonData.matches);
        
        // Deep compare previous and new data
        if (!dataRef.current || previousDataHash.current !== newDataHash) {
          logDebug('Data changed, updating state');
          console.log('⚠️ Data changed, updating state');
          dataRef.current = jsonData;
          previousDataHash.current = newDataHash;
        } else {
          logDebug('Data unchanged, skipping state update');
        }
      } else {
        logDebug('API returned empty or invalid data:', jsonData);
        console.log('⚠️ API returned empty or invalid data:', jsonData);
        
        // If no data AND we don't have any existing data, use fallback
        if (!dataRef.current || !dataRef.current.matches || dataRef.current.matches.length === 0) {
          console.log('⚠️ No existing data, using fallback data');
          // FALLBACK - Use hardcoded data if API returns nothing and we have no existing data
          const fallbackData = {
            timestamp: new Date().toISOString(),
            matches: [
              {
                match_id: "fallback_match_1",
                betsapi_data: {
                  inplayEvent: {
                    league: { name: "Fallback Tennis League", cc: "US" },
                    time: String(Math.floor(Date.now() / 1000)),
                    time_status: "1",
                    home: { name: "Frontend Player 1", cc: "US" },
                    away: { name: "Frontend Player 2", cc: "GB" },
                    ss: "3-2",
                    scores: {
                      "1": { home: 6, away: 4 },
                      "2": { home: 4, away: 6 },
                      "3": { home: 6, away: 2 }
                    }
                  }
                }
              }
            ]
          };
          
          console.log('⚠️ Using fallback data', fallbackData);
          dataRef.current = fallbackData;
          previousDataHash.current = JSON.stringify(fallbackData.matches);
        } else {
          console.log('⚠️ Keeping existing data rather than using fallback');
        }
      }
      
      // Format the timestamp
      const timestamp = jsonData.timestamp 
        ? new Date(jsonData.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })
        : new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
      
      setLastUpdated(timestamp + ' ET');
      setError(null);
    } catch (err) {
      console.error('⚠️ Error fetching data:', err);
      setError(err.message);
      
      // Only use fallback if we have no existing data
      if (!dataRef.current || !dataRef.current.matches || dataRef.current.matches.length === 0) {
        console.log('⚠️ Error occurred AND no existing data, using fallback data');
        // FALLBACK - Use hardcoded data on error
        const fallbackData = {
          timestamp: new Date().toISOString(),
          matches: [
            {
              match_id: "error_fallback_match",
              betsapi_data: {
                inplayEvent: {
                  league: { name: "Error Fallback League", cc: "US" },
                  time: String(Math.floor(Date.now() / 1000)),
                  time_status: "1",
                  home: { name: "Error Handler 1", cc: "US" },
                  away: { name: "Error Handler 2", cc: "GB" },
                  ss: "1-0",
                  scores: {
                    "1": { home: 4, away: 2 }
                  }
                }
              }
            }
          ]
        };
        
        console.log('⚠️ Using error fallback data', fallbackData);
        dataRef.current = fallbackData;
        previousDataHash.current = JSON.stringify(fallbackData.matches);
      } else {
        console.log('⚠️ Error occurred but keeping existing data rather than using fallback');
      }
    } finally {
      setLoading(false);
    }
  };

  // Update the handleRefresh function to use refetch from React Query
  const handleRefresh = useCallback(() => {
    console.log('Manual refresh requested');
    refetch();
  }, [refetch]);

  useEffect(() => {
    // Keep dataRef.current updated when queryData changes
    if (queryData) {
      dataRef.current = queryData;
      setLoading(false);
    }
  }, [queryData]);

  // WebSocket message handler
  const processWebSocketData = useCallback((event) => {
    try {
      // Silent increment of message counter without logging every message
      setWsMessageCount(prev => prev + 1);
      
      // Update global stats
      if (window.tennisDebug) {
        window.tennisDebug.stats.wsMessages++;
      }
      
      console.log('⚠️ WebSocket message received, length:', event.data.length);
      
      // Get data as raw string first for hashing
      const rawData = event.data; 
      
      // Store the last message for debugging
      setLastWsMessage(rawData.length > 500 ? 
        `${rawData.substring(0, 500)}... (${rawData.length} chars)` : 
        rawData);
      
      // Parse JSON immediately
      const jsonData = JSON.parse(rawData);
      console.log('⚠️ JSON parsed successfully:', typeof jsonData, Array.isArray(jsonData));
      
      // Handle both array format and object format with 'matches' property
      let matchesData;
      if (Array.isArray(jsonData)) {
        // Direct array of matches
        console.log('⚠️ Received array format data');
        matchesData = jsonData;
      } else if (jsonData && typeof jsonData === 'object' && Array.isArray(jsonData.matches)) {
        // Object with matches property
        console.log('⚠️ Received object format data with matches property');
        matchesData = jsonData.matches;
      } else {
        console.error('⚠️ Unexpected data format:', jsonData);
        return;
      }
      
      // *** SAFETY CHECK: Don't accept empty data updates that would wipe out our matches ***
      if (!matchesData || matchesData.length === 0) {
        console.warn('⚠️ Received empty matches data - IGNORING UPDATE to prevent data loss');
        return; // Exit early to preserve current data
      }
      
      // Only process if we actually have matches
      console.log(`⚠️ Processing ${matchesData.length} matches`);
      console.log(`⚠️ Match count: ${matchesData.length}`);
      
      // Store current matches as previous before updating
      const currentMatches = {};
      if (dataRef.current && dataRef.current.matches) {
        dataRef.current.matches.forEach(match => {
          if (match.match_id) {
            currentMatches[match.match_id] = {...match};
          }
        });
      }
      
      // For React state updates, we need the full object with timestamp
      const newData = {
        timestamp: new Date().toISOString(),
        matches: matchesData
      };
      
      // Mark which matches have changes
      const changedMatches = new Set();
      matchesData.forEach(match => {
        if (match.match_id) {
          // If the match exists in previous data, check for changes
          if (currentMatches[match.match_id]) {
            // Deep comparison would be better, but for performance we'll use JSON.stringify
            if (JSON.stringify(currentMatches[match.match_id]) !== JSON.stringify(match)) {
              changedMatches.add(match.match_id);
            }
          } else {
            // New match
            changedMatches.add(match.match_id);
          }
        }
      });
      
      // Store which matches have changes
      setRecentUpdate(changedMatches);
      
      // Update the React Query cache instead of using setState
      // This avoids re-rendering the entire component tree
      queryClient.setQueryData('tennisData', newData);
      
      // Also update our refs for compatibility with existing code
      dataRef.current = newData;
      previousDataHash.current = rawData;
      
      // Update timestamp display
      const timestamp = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
      setLastUpdated(timestamp + ' ET (WebSocket)');
      
      // Store the current matches for future change detection
      setPreviousMatches(currentMatches);
      
      // Update counter for tracking
      setUpdateCount(prev => {
        // Update global stats
        if (window.tennisDebug) {
          window.tennisDebug.stats.dataUpdates++;
        }
        return prev + 1;
      });
      
      // Detailed WebSocket logging when enabled
      if (window.tennisDebug?.enableLogging) {
        console.log(`[Tennis] Data update #${updateCount + 1}: ${matchesData.length} matches`, {
          messageSize: rawData.length,
          matchesCount: matchesData.length,
          changedMatches: changedMatches.size
        });
      }
      // Basic periodic logging
      else if (DEBUG || updateCount % 5 === 0) {
        console.log(`[Tennis] Data update #${updateCount + 1}: ${matchesData.length} matches, ${changedMatches.size} changed`);
      }
      
    } catch (err) {
      // Only log errors
      console.error('⚠️ Error processing WebSocket data:', err);
      
      // Update global error stats
      if (window.tennisDebug) {
        window.tennisDebug.stats.errors++;
      }
      
      // Never clear existing data when there's an error
      console.log('⚠️ WebSocket data processing error - keeping existing data');
    } finally {
      setLoading(false);
    }
  }, [queryClient, updateCount]);

  // Function to initialize WebSocket connection
  const initWebSocket = useCallback(() => {
    // Setup WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    logDebug(`Connecting to WebSocket at ${wsUrl}`);
    console.log(`⚠️ Connecting to WebSocket at ${wsUrl}`);
    
    // Close any existing connection first
    if (ws.current) {
      try {
        ws.current.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    
    try {
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        console.log('⚠️ WebSocket connected successfully');
        setWsStatus('connected');
        setWsConnectionTime(Date.now());
        
        // Send an initial message to ensure the connection is working
        try {
          ws.current.send('ping');
          console.log('⚠️ Sent initial ping message');
        } catch (e) {
          console.error('⚠️ Error sending initial ping:', e);
        }
      };
      
      ws.current.onmessage = processWebSocketData;
      
      ws.current.onerror = (error) => {
        console.error('⚠️ WebSocket error:', error);
        setWsStatus('error');
        
        // Update global error stats
        if (window.tennisDebug) {
          window.tennisDebug.stats.errors++;
        }
      };
      
      ws.current.onclose = (event) => {
        console.log(`⚠️ WebSocket disconnected with code ${event.code}`);
        setWsStatus('disconnected');
      };
      
      // Return a cleanup function that window.clearWebSocket can call
      return () => {
        if (ws.current) {
          try {
            ws.current.close();
          } catch (e) {
            // Ignore close errors
          }
          ws.current = null;
        }
      };
      
    } catch (e) {
      console.error('⚠️ Error creating WebSocket connection:', e);
      setWsStatus('error');
      
      // Return empty cleanup function
      return () => {};
    }
  }, [processWebSocketData]);

  // Add keyboard shortcut for debug overlay
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Alt+D to toggle debug overlay
      if (event.altKey && event.key === 'd') {
        setDebugOverlayVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // Define the global WebSocket debug function
  useEffect(() => {
    // Setup the debug console API
    window.enableWebSocketDebug = (enable = true) => {
      window.tennisDebug.enableLogging = enable;
      console.log(`WebSocket debugging ${enable ? 'enabled' : 'disabled'}`);
      
      // Reset stats when enabling
      if (enable) {
        window.tennisDebug.stats = {
          wsMessages: wsMessageCount,
          dataUpdates: updateCount,
          errors: 0,
          renders: updateCount
        };
      }
      
      return {
        status: `WebSocket debugging ${enable ? 'enabled' : 'disabled'}`,
        commands: [
          'window.enableWebSocketDebug(true/false) - Enable/disable debugging',
          'window.tennisDebug.stats - View current stats',
          'Alt+D - Toggle visual debug overlay'
        ]
      };
    };
    
    // Cleanup
    return () => {
      delete window.enableWebSocketDebug;
    };
  }, [wsMessageCount, updateCount]);

  useEffect(() => {
    // For debug mode, we want to auto reconnect websocket when it disconnects
    if (wsStatus === 'disconnected' && window.tennisDebug?.autoReconnect) {
      console.log('Auto reconnect enabled, reconnecting WebSocket...');
      if (ws.current) {
        try {
          ws.current.close();
        } catch (e) {
          // Ignore close error
        }
      }
      setTimeout(() => {
        console.log('Reconnecting WebSocket...');
        initWebSocket();
      }, 1000);
    }
  }, [wsStatus]);

  // Set up data fetching when the component mounts
  useEffect(() => {
    // Remove the initial fetch since React Query handles this now
    
    // Initialize WebSocket connection
    window.clearWebSocket = initWebSocket();
    
    // Add keyboard shortcut for clearing database
    const handleKeyDown = (e) => {
      if (e.key === '`' && e.altKey) { // Alt + ` (backtick)
        setDebugOverlayVisible(prev => !prev);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (ws.current) {
        ws.current.close();
      }
      if (window.clearWebSocket) {
        window.clearWebSocket();
      }
    };
  }, []);

  const toggleExpandMatch = (event, matchId) => {
    event.stopPropagation();
    logDebug(`Toggle expand match: ${matchId}`);
    if (expandedMatch === matchId) {
      setExpandedMatch(null);
    } else {
      setExpandedMatch(matchId);
    }
  };
  
  const navigateToMatchDetail = (matchId) => {
    logDebug(`Navigating to match detail: ${matchId}`);
    navigate(`/match/${matchId}`);
  };

  // Render an individual odds item with change detection
  const renderOddsItem = (match, label, value, matchId) => {
    // Find the appropriate market (e.g., Match Winner)
    const markets = match.rapid_data?.grouped_markets || [];
    const matchWinnerMarket = markets.find(market => 
      market.name === 'Match Winner' || market.market_id === 1);
    
    if (!matchWinnerMarket || !matchWinnerMarket.selections) {
      return (
        <div className="odds-item">
          <div className="odds-label">{label}</div>
          <div className="odds-value">-</div>
        </div>
      );
    }
    
    // Get the appropriate selection based on the value (1, X, 2)
    let selection;
    if (value === 1 || value === '1') {
      // Home player/team
      selection = matchWinnerMarket.selections.find(s => s.name.includes(match.home.name) || s.position === "1");
    } else if (value === 'X' || value === 'x') {
      // Draw (usually not in tennis, but keeping for completeness)
      selection = matchWinnerMarket.selections.find(s => s.name.includes('Draw') || s.position === "X");
    } else {
      // Away player/team
      selection = matchWinnerMarket.selections.find(s => s.name.includes(match.away.name) || s.position === "2");
    }
    
    // If no selection found
    if (!selection) {
      return (
        <div className="odds-item">
          <div className="odds-label">{label}</div>
          <div className="odds-value">-</div>
        </div>
      );
    }
    
    // Get the odds value
    const oddsValue = selection.odds;
    const oddsPath = `rapid_data.grouped_markets.0.selections.${selection.name}.odds`;
    const hasChanged = hasValueChanged(matchId, oddsPath, oddsValue);
    
    return (
      <div className="odds-item">
        <div className="odds-label">{label}</div>
        <div className={`odds-value ${hasChanged ? 'value-changed' : ''}`}>
          {oddsValue ? oddsValue.toFixed(2) : '-'}
        </div>
      </div>
    );
  };

  // Handle showing loading state
  if (queryLoading && !dataRef.current) {
    return (
      <div className="tennis-data-container">
        <div className="loading">
          <p>Loading tennis matches...</p>
          
          <WebSocketDebugOverlay 
            isOpen={debugOverlayVisible}
            stats={{
              connected: wsStatus === 'connected',
              connectionTime: wsConnectionTime ? new Date(wsConnectionTime).toLocaleTimeString() : 'N/A',
              lastMessage: lastWsMessage,
              wsMessages: wsMessageCount,
              dataUpdates: updateCount
            }}
            lastUpdate={lastUpdated}
            onClose={() => setDebugOverlayVisible(false)}
          />
        </div>
      </div>
    );
  }
  
  // Handle error state
  if (queryError && !dataRef.current) {
    return (
      <div className="tennis-data-container">
        <div className="error">
          <h3>Error Loading Data</h3>
          <p>{queryErrorDetails?.message || "Failed to fetch tennis data"}</p>
          
          <WebSocketDebugOverlay 
            isOpen={debugOverlayVisible}
            stats={{
              connected: wsStatus === 'connected',
              connectionTime: wsConnectionTime ? new Date(wsConnectionTime).toLocaleTimeString() : 'N/A',
              lastMessage: lastWsMessage,
              wsMessages: wsMessageCount,
              dataUpdates: updateCount
            }}
            lastUpdate={lastUpdated}
            onClose={() => {}}
          />
          
          <button onClick={handleRefresh} className="retry-button">
            Retry Loading Data
          </button>
        </div>
      </div>
    );
  }
  
  // Get matches from React Query data or from our ref if available
  const matchesData = queryData?.matches || dataRef.current?.matches || [];
  
  // Show no data message if needed
  if (matchesData.length === 0) {
    return (
      <div className="tennis-data-container">
        <div className="no-data">
          <p>No live tennis matches available at the moment.</p>
          <button onClick={handleRefresh}>Check Again</button>
          <p className="debug-info">WebSocket: {wsStatus}, Messages: {wsMessageCount}, Updates: {updateCount}</p>
        </div>
      </div>
    );
  }

  // Format time status into readable text
  const formatTimeStatus = (status) => {
    switch (status) {
      case '1': return 'In Progress';
      case '2': return 'Not Started';
      case '3': return 'Finished';
      case '4': return 'Postponed';
      case '5': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  // Helper function to extract player names
  const formatPlayerName = (name) => {
    if (!name) return 'Unknown Player';
    
    // Fix common name formatting issues
    return name
      .replace(/\s+/g, ' ')  // Remove extra spaces
      .replace(/\([^)]*\)/g, '') // Remove text in parentheses
      .trim();
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(parseInt(timestamp) * 1000);
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid time';
    }
  };

  // Render the matches if we have data
  return (
    <div className="tennis-data-container">
      {/* Debug Overlay */}
      <WebSocketDebugOverlay
        visible={debugOverlayVisible}
        wsStatus={wsStatus}
        messageCount={wsMessageCount}
        lastMessage={lastWsMessage}
        updateCount={updateCount}
        connectionTime={wsConnectionTime}
        onClose={() => setDebugOverlayVisible(false)}
      />
      
      <div className="header-row">
        <h2>Live Tennis Matches ({matchesData.length})</h2>
        <div className="refresh-section">
          <button onClick={handleRefresh}>Refresh Data</button>
          {lastUpdated && <span className="timestamp">Last updated: {lastUpdated}</span>}
          <span className="ws-status">WebSocket: {wsStatus}</span>
          <button 
            onClick={() => setDebugOverlayVisible(prev => !prev)}
            className="debug-toggle-button"
            title="Toggle Debug Overlay (Alt+D)"
          >
            🐞
          </button>
        </div>
      </div>
      
      <div className="debug-panel">
        <p>WebSocket Messages: {wsMessageCount}, Actual Updates: {updateCount}</p>
        <p>Update Efficiency: {wsMessageCount > 0 ? (updateCount / wsMessageCount * 100).toFixed(1) : 0}% of messages caused updates</p>
      </div>
      
      <div className="matches-list">
        {matchesData.map((match, index) => {
          // Extract data from match
          const betsapiData = match.betsapi_data || {};
          const rapidData = match.rapid_data || {};
          
          // Extract team info from betsapi
          const inplayEvent = betsapiData.inplayEvent || betsapiData.inplay_event || {};
          const homeTeam = inplayEvent.home || {};
          const awayTeam = inplayEvent.away || {};
          const league = inplayEvent.league || {};
          
          // Get match status
          const timeStatus = inplayEvent.time_status || '0';
          const statusText = formatTimeStatus(timeStatus);
          const isLive = timeStatus === '1';
          
          // Get score information
          const ss = inplayEvent.ss || '';
          const scores = inplayEvent.scores || {};
          
          return (
            <div 
              key={match.match_id || index} 
              className={`match-card ${expandedMatch === match.match_id ? 'expanded' : ''} ${recentUpdate.has(match.match_id) ? 'recent-update' : ''}`}
              onClick={() => navigateToMatchDetail(match.match_id)}
            >
              <div className="match-header">
                <div className="league-info">
                  {league.name || 'Unknown League'} {league.cc && `(${league.cc})`}
                </div>
                <div className="match-time">
                  {formatTimestamp(inplayEvent.time)}
                </div>
                <div className="match-status">
                  {isLive && (
                    <div className="live-badge">
                      <span className="live-indicator"></span>
                      LIVE
                    </div>
                  )}
                  {statusText}
                </div>
                <button 
                  className="expand-button"
                  onClick={(e) => toggleExpandMatch(e, match.match_id)}
                >
                  {expandedMatch === match.match_id ? '▲' : '▼'}
                </button>
              </div>
              
              <div className="match-teams">
                <div className={`team home ${hasValueChanged(match.match_id, 'betsapi_data.inplayEvent.ss', ss) ? 'element-changed' : ''}`}>
                  <span className="flag">{homeTeam.cc ? `🏴‍ ${homeTeam.cc}` : '🏴‍'}</span>
                  <span className="name">{formatPlayerName(homeTeam.name)}</span>
                </div>
                
                <div className="score-container">
                  {ss && <div className="score-main">{ss}</div>}
                  
                  {scores && Object.keys(scores).length > 0 && (
                    <div className="score-sets">
                      {Object.entries(scores).map(([set, setScore], setIdx) => (
                        <div key={setIdx} className="set-score">
                          <span className="set-number">Set {set}:</span>
                          <span className="points">{setScore.home}-{setScore.away}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {inplayEvent.points && (
                    <div className="current-points">
                      Points: {inplayEvent.points}
                    </div>
                  )}
                </div>
                
                <div className={`team away ${hasValueChanged(match.match_id, 'betsapi_data.inplayEvent.ss', ss) ? 'element-changed' : ''}`}>
                  <span className="flag">{awayTeam.cc ? `🏴‍ ${awayTeam.cc}` : '🏴‍'}</span>
                  <span className="name">{formatPlayerName(awayTeam.name)}</span>
                </div>
              </div>
              
              {/* Add odds display if available */}
              {match.rapid_data && match.rapid_data.grouped_markets && match.rapid_data.grouped_markets.length > 0 && (
                <div className="match-odds">
                  {renderOddsItem(match, 'Home', 1, match.match_id)}
                  {renderOddsItem(match, 'Draw', 'X', match.match_id)}
                  {renderOddsItem(match, 'Away', 2, match.match_id)}
                </div>
              )}
              
              {expandedMatch === match.match_id && (
                <div className="match-details">
                  <Link 
                    to={`/match/${match.match_id}`} 
                    className="view-details-button"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Full Match Details
                  </Link>
                  
                  <div className="data-source-info">
                    <div>Sources: {match.betsapi_data ? '✓ BetsAPI' : '✗ BetsAPI'} {match.rapid_data ? '✓ RapidAPI' : '✗ RapidAPI'}</div>
                    <div>Match ID: {match.match_id}</div>
                  </div>
                  
                  <div className="odds-section">
                    <h3>Match Winner Odds</h3>
                    <div className="odds-grid">
                      {renderOddsItem(match, 'Home', 1, match.match_id)}
                      {renderOddsItem(match, 'Draw', 'X', match.match_id)}
                      {renderOddsItem(match, 'Away', 2, match.match_id)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TennisData;
