import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './MatchDetail.css';

function MatchDetail() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  const fetchMatchDetails = async () => {
    try {
      setLoading(true);
      console.log(`Fetching details for match ID: ${id}`);
      const response = await fetch(`/api/tennis/match/${id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Match detail data:', data);
      setMatch(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching match details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchMatchDetails();
  }, [id]);
  
  const handleGoBack = () => {
    navigate('/');
  };
  
  // Helper function to format player names
  const formatPlayerName = (name) => {
    if (!name) return 'Unknown Player';
    
    return name
      .replace(/\s+/g, ' ')
      .replace(/\([^)]*\)/g, '')
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
  
  // Show loading message
  if (loading) {
    return (
      <div className="match-detail-container">
        <div className="loading">
          <p>Loading match details...</p>
        </div>
      </div>
    );
  }
  
  // Show error message
  if (error) {
    return (
      <div className="match-detail-container">
        <div className="error-container">
          <h3>Error Loading Match Details</h3>
          <p>{error}</p>
          <div className="button-row">
            <button onClick={fetchMatchDetails}>Try Again</button>
            <button onClick={handleGoBack}>Back to Matches</button>
          </div>
        </div>
      </div>
    );
  }
  
  // Show not found message
  if (!match) {
    return (
      <div className="match-detail-container">
        <div className="not-found">
          <h3>Match Not Found</h3>
          <p>The match with ID {id} could not be found.</p>
          <button onClick={handleGoBack}>Back to Matches</button>
        </div>
      </div>
    );
  }
  
  // Extract data from match
  const betsapiData = match.betsapi_data || {};
  const rapidData = match.rapid_data || {};
  
  const inplayEvent = betsapiData.inplayEvent || betsapiData.inplay_event || {};
  const homeTeam = inplayEvent.home || {};
  const awayTeam = inplayEvent.away || {};
  const league = inplayEvent.league || {};
  
  const player1Name = formatPlayerName(homeTeam.name);
  const player2Name = formatPlayerName(awayTeam.name);
  
  const scoreText = inplayEvent.ss || '0-0';
  const scores = inplayEvent.scores || {};
  const points = inplayEvent.points || '0-0';
  const startTime = formatTimestamp(inplayEvent.time);
  
  // Group markets
  const groupedMarkets = {};
  
  if (match.grouped_markets) {
    Object.entries(match.grouped_markets).forEach(([category, markets]) => {
      if (markets && Object.keys(markets).length > 0) {
        groupedMarkets[category] = markets;
      }
    });
  }
  
  return (
    <div className="match-detail-container">
      <div className="match-detail-header">
        <button className="back-button" onClick={handleGoBack}>
          &larr; Back to Matches
        </button>
        <h2>Match Details</h2>
      </div>
      
      <div className="match-detail-card">
        <div className="match-overview">
          <div className="league-info">
            <h3>{league.name || 'Tennis Match'}</h3>
            <p className="match-id">Match ID: {id}</p>
          </div>
          
          <div className="match-teams-detail">
            <div className="team-detail">
              <h4>{player1Name}</h4>
              {homeTeam.cc && <p className="country-code">{homeTeam.cc}</p>}
            </div>
            <div className="vs-detail">VS</div>
            <div className="team-detail">
              <h4>{player2Name}</h4>
              {awayTeam.cc && <p className="country-code">{awayTeam.cc}</p>}
            </div>
          </div>
          
          <div className="match-info-grid">
            <div className="info-item">
              <h5>Start Time</h5>
              <p>{startTime}</p>
            </div>
            <div className="info-item">
              <h5>Current Score</h5>
              <p className="score-large">{scoreText}</p>
            </div>
            <div className="info-item">
              <h5>Current Points</h5>
              <p>{points}</p>
            </div>
          </div>
          
          {Object.keys(scores).length > 0 && (
            <div className="set-scores-detail">
              <h4>Set Scores</h4>
              <div className="sets-table">
                <div className="set-header">
                  <div className="player-column">Player</div>
                  {Object.keys(scores).map(set => (
                    <div key={set} className="set-column">Set {set}</div>
                  ))}
                </div>
                <div className="player-row">
                  <div className="player-column">{player1Name.split('/')[0]}</div>
                  {Object.keys(scores).map(set => (
                    <div key={set} className="set-column">
                      {scores[set]?.home || '0'}
                    </div>
                  ))}
                </div>
                <div className="player-row">
                  <div className="player-column">{player2Name.split('/')[0]}</div>
                  {Object.keys(scores).map(set => (
                    <div key={set} className="set-column">
                      {scores[set]?.away || '0'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {Object.keys(groupedMarkets).length > 0 && (
          <div className="markets-section">
            <h3>Betting Markets</h3>
            <div className="market-categories">
              {Object.entries(groupedMarkets).map(([category, markets]) => (
                <div key={category} className="market-category">
                  <h4>{category}</h4>
                  <div className="markets-list-detail">
                    {Object.entries(markets).map(([marketName, data]) => (
                      <div key={marketName} className="market-item-detail">
                        <h5>{marketName}</h5>
                        <div className="market-options">
                          {Object.entries(data).map(([option, value]) => (
                            <div key={option} className="market-option">
                              <span className="option-name">{option}:</span>
                              <span className="option-value">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {!Object.keys(groupedMarkets).length && (
          <div className="no-markets">
            <p>No markets available for this match.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MatchDetail;
