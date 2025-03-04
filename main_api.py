# main_api.py
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import time
import asyncio
import logging
import threading
import uvicorn
from datetime import datetime, timedelta
import requests
import sys
import json
from typing import Dict, List, Any, Optional
from aggregator.sports.tennis.market_grouper import MarketGrouper, group_markets
import hashlib
import pytz

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)  

# Create a console handler
ch = logging.StreamHandler()
ch.setLevel(logging.INFO)  

# Set eastern timezone for logging
eastern_tz = pytz.timezone('US/Eastern')
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s', 
                              datefmt='%Y-%m-%d %H:%M:%S')
ch.setFormatter(formatter)

# Add the handler to the logger
logger.addHandler(ch)

# Tennis Bot API endpoint
TENNIS_BOT_API = os.environ.get("TENNIS_BOT_API", "http://localhost:8000/api/tennis")

# Global variables
tennis_matches = []
# Add a cache to store historical match data with a TTL
match_cache = {}
CACHE_TTL = 3600  # Cache matches for 1 hour (in seconds)
last_processed_data_hash = ""  # Track when data actually changes in the process loop
websocket_clients = {}  # Store client-specific data
active_connections = []  # Active WebSocket connections

# Market grouper instance
market_grouper = MarketGrouper()

app = FastAPI()

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """
    Run tasks when the FastAPI app starts.
    """
    global tennis_matches
    
    # Set up initial data
    try:
        logger.info("Fetching initial tennis data on startup...")
        tennis_matches = await setup_tennis_data()
    except Exception as e:
        logger.error(f"Error setting up initial tennis data: {e}")
    
    # Start the background task to process tennis data
    asyncio.create_task(process_tennis_data())
    logger.info("Background task for processing tennis data started")

async def setup_tennis_data():
    """
    Initial setup to populate tennis_matches when the server starts.
    Tries to fetch data from tennis_bot and sets up debug data as fallback.
    """
    global tennis_matches
    
    # Try to access the Tennis Bot API
    logger.info(f"Trying to fetch initial data from Tennis Bot API at: {TENNIS_BOT_API}")
    
    # Try alternate URLs in case the main one fails
    urls_to_try = [
        TENNIS_BOT_API,
        "http://localhost:8000/api/tennis",
        "http://127.0.0.1:8000/api/tennis"
    ]
    
    success = False
    
    for url in urls_to_try:
        try:
            logger.info(f"Attempting to fetch initial data from: {url}")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data and isinstance(data, dict) and "matches" in data and len(data["matches"]) > 0:
                logger.info(f"Successfully fetched {len(data['matches'])} matches from {url}")
                tennis_matches = data["matches"]
                success = True
                break
        except Exception as e:
            logger.warning(f"Failed to fetch from {url}: {str(e)}")
    
    # If we couldn't get data from any source, use debug data
    if not success or not tennis_matches:
        logger.warning("Couldn't fetch real tennis data, using debug data")
        tennis_matches = [{
            "match_id": "debug_match_1",
            "betsapi_data": {
                "inplayEvent": {
                    "league": {"name": "Debug Tennis League", "cc": "US"},
                    "time": str(int(time.time())),
                    "time_status": "1", 
                    "home": {"name": "Debug Player 1", "cc": "US"},
                    "away": {"name": "Debug Player 2", "cc": "GB"},
                    "ss": "2-1",
                    "scores": {
                        "1": {"home": 6, "away": 4},
                        "2": {"home": 4, "away": 6},
                        "3": {"home": 2, "away": 1}
                    }
                }
            },
            "rapid_data": {
                "grouped_markets": []
            }
        }]
    
    logger.info(f"Initial tennis data set with {len(tennis_matches)} matches")
    return tennis_matches

@app.get("/api/tennis/match/{match_id}")
def get_match_details(match_id: str):
    logger.info(f"Match details requested for match_id: {match_id}")
    
    # First check current matches
    for match in tennis_matches:
        if match.get("match_id") == match_id:
            return match
    
    # If not found in current matches, check the cache
    if match_id in match_cache:
        cache_entry = match_cache[match_id]
        # Check if cache entry is still valid
        if time.time() - cache_entry["timestamp"] < CACHE_TTL:
            logger.info(f"Match {match_id} found in cache")
            return cache_entry["data"]
    
    # If we get here, the match is not found
    raise HTTPException(status_code=404, detail="Match not found")

@app.get("/api/tennis")
def get_tennis_matches():
    logger.info(f"API request received. Current data length: {len(tennis_matches)}")
    # Use Eastern Time (UTC-4)
    eastern_time = datetime.now(pytz.timezone('US/Eastern'))
    return {
        "timestamp": eastern_time.isoformat(),
        "matches": tennis_matches
    }

@app.get("/")
@app.get("/{full_path:path}")
def serve_react_app(full_path: str = ""):
    logger.info(f"Serving React app for path: {full_path}")
    # Check if it's a static asset request
    if full_path.startswith("static/"):
        logger.info(f"Static file request, but it should go through StaticFiles middleware")
    
    # Always return the index.html file for any non-API route
    index_path = "my-react-app/build/index.html"
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        logger.error(f"Index file not found at: {index_path}")
        return {"message": "Frontend not available. Please build the React app."}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = str(id(websocket))
    try:
        logger.info(f"New WebSocket connection attempt: {client_id}")
        await websocket.accept()
        logger.info(f"WebSocket connection accepted: {client_id}")
        
        # Initialize client data in the global dictionary
        websocket_clients[client_id] = {
            "last_sent_hash": "",
            "last_sent_time": time.time(),
            "connection": websocket
        }
        
        active_connections.append(websocket)
        
        # Debug current state
        logger.info(f"Active connections count: {len(active_connections)}")
        logger.info(f"Current tennis_matches count: {len(tennis_matches)}")
        
        # Send initial data immediately
        if tennis_matches:
            try:
                current_hash = hashlib.md5(json.dumps(tennis_matches, sort_keys=True).encode()).hexdigest()
                logger.info(f"Sending initial data to client {client_id}, data length: {len(tennis_matches)}")
                await websocket.send_json(tennis_matches)
                logger.info(f"Initial data sent successfully to client {client_id}")
                websocket_clients[client_id]["last_sent_hash"] = current_hash
                websocket_clients[client_id]["last_sent_time"] = time.time()
            except Exception as e:
                logger.error(f"Error sending initial data: {e}")
        else:
            logger.warning(f"No tennis_matches data available to send to client {client_id}")
        
        # This is a key change - instead of actively polling and sending data,
        # we now just keep the connection open and wait for client messages
        # The actual updates are pushed from the process_tennis_data function
        while True:
            # Wait for any message from client (could be ping/heartbeat)
            try:
                # This will keep the connection open, waiting for client messages
                # but we won't actually do anything with them for now
                msg = await websocket.receive_text()
                logger.debug(f"Received message from client {client_id}: {msg[:20]}...")
            except WebSocketDisconnect:
                logger.info(f"Client {client_id} disconnected")
                break
            except Exception as e:
                logger.error(f"Error receiving message from client {client_id}: {e}")
                break
    except Exception as e:
        logger.error(f"WebSocket connection error for client {client_id}: {e}")
    finally:
        # Remove the connection
        if websocket in active_connections:
            active_connections.remove(websocket)
        
        # Clean up client data when connection closes
        if client_id in websocket_clients:
            del websocket_clients[client_id]
            
        logger.info(f"WebSocket connection closed for client {client_id}")

# Broadcast function that will be called from the data processing task
async def broadcast_data_update(data):
    """Send data updates to all connected clients, but only if their data is stale"""
    # Create a hash of the current data
    current_hash = hashlib.md5(json.dumps(data, sort_keys=True).encode()).hexdigest()
    current_time = time.time()
    
    logger.info(f"Broadcasting data update: {len(data)} items, hash: {current_hash[:8]}...")
    logger.info(f"Number of connected clients: {len(websocket_clients)}")
    
    if len(websocket_clients) == 0:
        logger.warning("No WebSocket clients connected. Nothing to broadcast to.")
    
    # Send to each client if they need an update
    for client_id, client_info in list(websocket_clients.items()):
        try:
            # Get client-specific data
            client_last_hash = client_info.get("last_sent_hash", "")
            client_last_time = client_info.get("last_sent_time", 0)
            websocket = client_info.get("connection")
            
            # Determine if we should send an update
            should_send = False
            
            # Send if data changed from what this client last saw
            if current_hash != client_last_hash:
                should_send = True
                logger.info(f"Data changed, broadcasting to client {client_id}")
            # Or send heartbeat every 5 seconds even if no change
            elif current_time - client_last_time > 5:
                should_send = True
                logger.debug(f"Sending periodic heartbeat to client {client_id}")
            
            if should_send and websocket:
                logger.info(f"Sending update to client {client_id}")
                try:
                    await websocket.send_json(data)
                    logger.info(f"Successfully sent data to client {client_id}")
                    # Update client tracking data
                    websocket_clients[client_id]["last_sent_hash"] = current_hash
                    websocket_clients[client_id]["last_sent_time"] = current_time
                except Exception as e:
                    logger.error(f"Error during send_json to client {client_id}: {e}")
            else:
                logger.debug(f"Not sending to client {client_id}: should_send={should_send}, websocket exists={websocket is not None}")
        except Exception as e:
            logger.error(f"Error sending to client {client_id}: {e}")
            # If we can't send, remove the client
            try:
                if client_id in websocket_clients:
                    del websocket_clients[client_id]
                    logger.info(f"Removed client {client_id} due to error")
            except:
                pass

async def process_tennis_data():
    """
    Processes tennis data for frontend consumption.
    If tennis_bot is available, uses its data directly.
    Otherwise, fetches and processes data directly.
    """
    global tennis_matches, last_processed_data_hash

    # Initialize with empty data
    if not tennis_matches:
        # Only use debug data if we don't have any data yet
        debug_match = {
            "match_id": "debug_match_1",
            "betsapi_data": {
                "inplayEvent": {
                    "league": {"name": "Debug Tennis League", "cc": "US"},
                    "time": str(int(time.time())),
                    "time_status": "1", 
                    "home": {"name": "Debug Player 1", "cc": "US"},
                    "away": {"name": "Debug Player 2", "cc": "GB"},
                    "ss": "2-1",
                    "scores": {
                        "1": {"home": 6, "away": 4},
                        "2": {"home": 4, "away": 6},
                        "3": {"home": 2, "away": 1}
                    }
                }
            },
            "rapid_data": {
                "grouped_markets": []
            }
        }
        tennis_matches = [debug_match]
        logger.info(f"Initialized with debug tennis match data: {len(tennis_matches)} matches")
    
    # Send initial data to any clients
    if websocket_clients:
        await broadcast_data_update(tennis_matches)

    while True:
        try:
            start_time = time.time()
            logger.info("Fetching tennis data...")
            
            # Log the API endpoint we're trying to connect to
            logger.info(f"Attempting to fetch data from Tennis Bot API at: {TENNIS_BOT_API}")
            
            # Try to fetch from Tennis Bot API
            try:
                # Log every attempt to connect to the Tennis Bot API
                logger.info(f"Making HTTP request to: {TENNIS_BOT_API}")
                
                # First try the configured API endpoint
                response = requests.get(TENNIS_BOT_API, timeout=10)
                response.raise_for_status()
                tennis_data = response.json()
                
                # Check if we got valid data
                if not tennis_data or not isinstance(tennis_data, list) or len(tennis_data) == 0:
                    # Try alternate URL if the primary one fails
                    logger.warning(f"Invalid or empty data from primary API, trying local alternate: {len(tennis_data) if tennis_data else 0} items")
                    
                    # Try alternate URLs if the first one fails (adapt names based on your Docker setup)
                    alternate_urls = [
                        "http://localhost:8000/api/tennis",
                        "http://127.0.0.1:8000/api/tennis",
                        "http://tennis-bot:8000/api/tennis"
                    ]
                    
                    for alt_url in alternate_urls:
                        if alt_url != TENNIS_BOT_API:  # Skip if it's the same as primary
                            try:
                                logger.info(f"Trying alternate API URL: {alt_url}")
                                alt_response = requests.get(alt_url, timeout=5)
                                alt_response.raise_for_status()
                                tennis_data = alt_response.json()
                                if tennis_data and isinstance(tennis_data, list) and len(tennis_data) > 0:
                                    logger.info(f"Successfully fetched {len(tennis_data)} matches from alternate URL: {alt_url}")
                                    break  # We got good data, break out of the loop
                            except Exception as e:
                                logger.warning(f"Alternate URL failed: {alt_url} - {str(e)}")
                
                # Still no valid data after trying alternatives
                if not tennis_data or not isinstance(tennis_data, list) or len(tennis_data) == 0:
                    logger.warning("All API sources failed, keeping current data")
                    # Just keep using the current data
                    tennis_data = tennis_matches
                else:
                    logger.info(f"Successfully fetched {len(tennis_data)} matches from Tennis Bot API")
                
                # Process the data using market grouper
                for match in tennis_data:
                    if "rapid_data" in match and "raw_odds_data" in match["rapid_data"]:
                        try:
                            # Use the standalone function instead of a method on the instance
                            match["rapid_data"]["grouped_markets"] = group_markets(
                                [match["rapid_data"]["raw_odds_data"].get("markets", {})]
                            )
                        except Exception as e:
                            logger.error(f"Error grouping markets for match {match.get('match_id')}: {e}")
                
                # Create a hash of the new data
                new_data_hash = hashlib.md5(json.dumps(tennis_data, sort_keys=True).encode()).hexdigest()
                
                # For tennis data, we should ALWAYS update and broadcast
                # Live tennis has constant changes (score, serve, points, odds)
                tennis_matches = tennis_data
                last_processed_data_hash = new_data_hash
                logger.info(f"Tennis data updated with {len(tennis_matches)} matches (hash: {new_data_hash[:8]}...)")
                
                # Cache matches for history
                for match in tennis_matches:
                    match_id = match.get("match_id")
                    if match_id:
                        match_cache[match_id] = {
                            "data": match,
                            "timestamp": time.time()
                        }
                
                # Always broadcast the update to all connected WebSocket clients
                # Tennis is a real-time sport with constant data changes
                await broadcast_data_update(tennis_matches)
                logger.info("Broadcasting tennis update to all clients")
                
            except Exception as e:
                logger.error(f"Error fetching from Tennis Bot API: {e}")
                # Keep using current data, don't replace with debug data
            
            # Sleep until next update cycle
            execution_time = time.time() - start_time
            sleep_time = max(1, 10 - execution_time)  # Reduce to 10 seconds per cycle, min 1 sec
            logger.debug(f"Sleeping for {sleep_time:.2f} seconds before next update")
            await asyncio.sleep(sleep_time)
            
        except Exception as e:
            logger.error(f"Error in process loop: {e}")
            await asyncio.sleep(10)  # Sleep for a bit before retrying

if __name__ == "__main__":
    # Check if the build directory exists
    build_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "my-react-app/build")
    if os.path.exists(build_dir):
        logger.info(f"Serving static files from: {build_dir}")
        # Mount the entire static files directory
        app.mount("/static", StaticFiles(directory=f"{build_dir}/static"), name="static")
        
        # Mount individual asset files
        for asset_file in os.listdir(build_dir):
            if asset_file.endswith('.ico') or asset_file.endswith('.json') or asset_file.endswith('.png'):
                asset_path = os.path.join(build_dir, asset_file)
                app.mount(f"/{asset_file}", StaticFiles(directory=os.path.dirname(asset_path), html=False), name=asset_file)
    else:
        logger.error(f"Build directory not found: {build_dir}")
    
    # Run the FastAPI app
    uvicorn.run(app, host="0.0.0.0", port=8080)
