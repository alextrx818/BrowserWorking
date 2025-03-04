"""
Market Grouper for Tennis Bot

This module processes match data after it has been merged by tennis_merger.py,
further organizing the betting markets from RapidAPI by their group names.
"""

import logging
from typing import Dict, List, Any

# Configure logging
logger = logging.getLogger(__name__)

class MarketGrouper:
    """
    Groups betting markets from RapidAPI data by their 'group' field.
    Works with data that has already been processed by TennisMerger.
    """
    
    def __init__(self):
        self.processed_matches = {}
    
    def process_matches(self, merged_matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process a list of already merged matches and group their markets.
        
        Args:
            merged_matches: List of match data that has already been processed by TennisMerger
            
        Returns:
            List of matches with grouped markets
        """
        processed_matches = []
        
        for match in merged_matches:
            # Create a copy of the match to avoid modifying the original
            processed_match = match.copy()
            
            # Only process matches that have RapidAPI data
            if 'rapid_data' in match and match['rapid_data'] and 'raw_odds_data' in match['rapid_data']:
                raw_odds_data = match['rapid_data']['raw_odds_data']
                
                if 'markets' in raw_odds_data and raw_odds_data['markets']:
                    # Group the markets by their 'group' field
                    grouped_markets = self._group_markets_by_name(raw_odds_data['markets'])
                    
                    # Add the grouped markets to the processed match
                    if 'grouped_markets' not in processed_match:
                        processed_match['grouped_markets'] = {}
                    
                    processed_match['grouped_markets'] = grouped_markets
            
            processed_matches.append(processed_match)
            
        return processed_matches
    
    def _group_markets_by_name(self, markets: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Group markets by their 'group' field.
        
        Args:
            markets: Dictionary of markets from RapidAPI
            
        Returns:
            Dictionary of markets grouped by their 'group' field
        """
        grouped = {}
        
        # Handle the case where markets is a list
        if isinstance(markets, list):
            for market_data in markets:
                # Skip if not a dictionary or missing 'group' field
                if not isinstance(market_data, dict) or 'group' not in market_data:
                    continue
                    
                group_name = market_data['group']
                
                # Create list for this group if it doesn't exist
                if group_name not in grouped:
                    grouped[group_name] = []
                
                # Add market data to its group
                grouped[group_name].append(market_data)
        else:
            # Handle the case where markets is a dictionary (as originally expected)
            for market_id, market_data in markets.items():
                # Skip if not a dictionary or missing 'group' field
                if not isinstance(market_data, dict) or 'group' not in market_data:
                    continue
                    
                group_name = market_data['group']
                
                # Create list for this group if it doesn't exist
                if group_name not in grouped:
                    grouped[group_name] = []
                
                # Add market data to its group, including the original market ID
                market_with_id = market_data.copy()
                market_with_id['market_id'] = market_id
                grouped[group_name].append(market_with_id)
        
        return grouped

def group_markets(matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Convenience function to group markets in matches.
    
    Args:
        matches: List of already merged matches
        
    Returns:
        List of matches with grouped markets
    """
    grouper = MarketGrouper()
    return grouper.process_matches(matches)
