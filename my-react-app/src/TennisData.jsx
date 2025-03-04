import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './TennisData.css';
import WebSocketDebugOverlay from './WebSocketDebugOverlay';

// Debug can be toggled with Alt+D or window.enableWebSocketDebug(true)
const DEBUG = true;

// Helper function for deep equality comparison
function isEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

function TennisData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [wsMessageCount, setWsMessageCount] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  const [updateCount, setUpdateCount] = useState(0);
  const [debugOverlayVisible, setDebugOverlayVisible] = useState(false);
  const [lastWsMessage, setLastWsMessage] = useState(null);
  const [wsConnectionTime, setWsConnectionTime] = useState(null);
  const navigate = useNavigate();
  const ws = useRef(null);
  const dataRef = useRef(null);
  const previousDataHash = useRef('');
  
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
      console.log(`[TennisData:${renderCount}]`, ...args);
      
      // Update the stats in the global object
      if (window.tennisDebug) {
        window.tennisDebug.stats.renders++;
      }
    }
  };

  // Log component renders
  useEffect(() => {
    logDebug(`Component rendered (${renderCount})`);
    setRenderCount(prevCount => prevCount + 1);
  }, [data, renderCount]);

  // Use memo to prevent unnecessary re-renders
  const memoizedRender = useMemo(() => {
    // This will only be recalculated when data changes
    logDebug("Recalculating memoized render");
    return data ? data.matches : null;
  }, [data]);
  
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
          setData(jsonData);
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
          setData(fallbackData);
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
        setData(fallbackData);
      } else {
        console.log('⚠️ Error occurred but keeping existing data rather than using fallback');
      }
    } finally {
      setLoading(false);
    }
  };

  // WebSocket message handler - completely rewritten for efficiency
  const processWebSocketData = useCallback((event) => {
    try {
      // Silent increment of message counter without logging every message
      setWsMessageCount(prev => prev + 1);
      
      // Update global stats
      if (window.tennisDebug) {
        window.tennisDebug.stats.wsMessages++;
      }
      
      // Get data as raw string first for hashing
      const rawData = event.data; 
      
      // Store the last message for debugging
      setLastWsMessage(rawData.length > 500 ? 
        `${rawData.substring(0, 500)}... (${rawData.length} chars)` : 
        rawData);
      
      // Quick check - if we have a hash and the raw data hash matches our previous hash exactly,
      // don't even bother parsing the JSON or doing any additional processing
      if (previousDataHash.current && previousDataHash.current === rawData) {
        // Skip all processing - data is identical
        return;
      }
      
      // Parse JSON only if we need to process it further
      const jsonData = JSON.parse(rawData);
      
      // Only process array data
      if (Array.isArray(jsonData) && jsonData.length > 0) {
        // For React state updates, we need the full object with timestamp
        const newData = {
          timestamp: new Date().toISOString(),
          matches: jsonData
        };
        
        // Only update if we don't have data yet or if it's actually changed
        if (!dataRef.current || !isEqual(dataRef.current.matches, newData.matches)) {
          // Data has changed - update our state
          setUpdateCount(prev => {
            // Update global stats
            if (window.tennisDebug) {
              window.tennisDebug.stats.dataUpdates++;
            }
            return prev + 1;
          });
          
          dataRef.current = newData;
          previousDataHash.current = rawData; // Store raw string for faster comparison
          setData(newData);
          
          // Update timestamp display
          const timestamp = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
          setLastUpdated(timestamp + ' ET (WebSocket)');
          
          // Detailed WebSocket logging when enabled
          if (window.tennisDebug?.enableLogging) {
            console.log(`[Tennis] Data update #${updateCount + 1}: ${jsonData.length} matches`, {
              messageSize: rawData.length,
              matchesCount: jsonData.length
            });
          }
          // Basic periodic logging
          else if (DEBUG || updateCount % 5 === 0) {
            console.log(`[Tennis] Data update #${updateCount + 1}: ${jsonData.length} matches`);
          }
        }
      }
      
      setLoading(false);
    } catch (err) {
      // Only log errors
      console.error('Error processing WebSocket data:', err);
      
      // Update global error stats
      if (window.tennisDebug) {
        window.tennisDebug.stats.errors++;
      }
    }
  }, [updateCount]);

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
          renders: renderCount
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
  }, [wsMessageCount, updateCount, renderCount]);

  useEffect(() => {
    // Fetch data immediately when component mounts
    logDebug('Component mounted, fetching initial data');
    console.log('⚠️ Component mounted, fetching initial data');
    fetchData();
    
    // Setup WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    logDebug(`Connecting to WebSocket at ${wsUrl}`);
    console.log(`⚠️ Connecting to WebSocket at ${wsUrl}`);
    
    // Close any existing connection first
    if (ws.current) {
      ws.current.close();
    }
    
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => {
      console.log('⚠️ WebSocket connected successfully');
      setWsStatus('connected');
      setWsConnectionTime(Date.now());
    };
    
    ws.current.onmessage = processWebSocketData;
    
    ws.current.onerror = (error) => {
      console.error('⚠️ WebSocket error:', error);
      setWsStatus('error');
      setError('WebSocket connection error. Falling back to polling.');
      
      // Update global error stats
      if (window.tennisDebug) {
        window.tennisDebug.stats.errors++;
      }
      
      // Fall back to polling if WebSocket fails
      console.log('⚠️ WebSocket failed, falling back to polling');
      const intervalId = setInterval(fetchData, 30000); // Poll every 30 seconds
      return () => clearInterval(intervalId);
    };
    
    ws.current.onclose = (event) => {
      console.log(`⚠️ WebSocket disconnected with code ${event.code}`);
      setWsStatus('disconnected');
      
      // If WebSocket closes unexpectedly, fall back to polling
      if (event.code !== 1000) { // 1000 is normal closure
        console.log('⚠️ WebSocket closed abnormally, falling back to polling');
        const intervalId = setInterval(fetchData, 30000); // Poll every 30 seconds
        return () => clearInterval(intervalId);
      }
    };
    
    // Clean up
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [processWebSocketData]);

  const handleRefresh = () => {
    logDebug('Manual refresh requested');
    fetchData();
  };

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

  // Show loading message if still loading and no data yet
  if (loading && !data) {
    return (
      <div className="tennis-data-container">
        <div className="loading">
          <p>Loading tennis data...</p>
          <p className="debug-info">WebSocket: {wsStatus}, Messages: {wsMessageCount}, Updates: {updateCount}</p>
          
          {/* Force show debug overlay in loading state */}
          <WebSocketDebugOverlay
            visible={true}
            wsStatus={wsStatus}
            messageCount={wsMessageCount}
            lastMessage={lastWsMessage}
            updateCount={updateCount}
            connectionTime={wsConnectionTime}
            onClose={() => {}}
          />
          
          <button onClick={fetchData} className="retry-button">
            Retry Loading Data
          </button>
        </div>
      </div>
    );
  }

  // Show error message if there was an error
  if (error) {
    return (
      <div className="tennis-data-container">
        <div className="error">
          <p>Error loading tennis data: {error}</p>
          <button onClick={handleRefresh}>Try Again</button>
          <p className="debug-info">WebSocket: {wsStatus}, Messages: {wsMessageCount}, Updates: {updateCount}</p>
        </div>
      </div>
    );
  }

  // No data available
  if (!data || !data.matches || data.matches.length === 0) {
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
        <h2>Live Tennis Matches ({data.matches.length})</h2>
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
        {memoizedRender && memoizedRender.map((match, index) => {
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
          
          // Get score information
          const ss = inplayEvent.ss || '';
          const scores = inplayEvent.scores || {};
          
          return (
            <div 
              key={match.match_id || index} 
              className={`match-card ${expandedMatch === match.match_id ? 'expanded' : ''}`}
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
                <div className="team home-team">
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
                
                <div className="team away-team">
                  <span className="flag">{awayTeam.cc ? `🏴‍ ${awayTeam.cc}` : '🏴‍'}</span>
                  <span className="name">{formatPlayerName(awayTeam.name)}</span>
                </div>
              </div>
              
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
