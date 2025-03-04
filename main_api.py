# main_api.py
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import time
import asyncio
import logging
import threading
import uvicorn
from datetime import datetime, timezone, timedelta
import requests
import sys
import json
from typing import Dict, List, Any, Optional
from aggregator.sports.tennis.market_grouper import MarketGrouper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Tennis Bot API endpoint
TENNIS_BOT_API = os.getenv("TENNIS_BOT_API", "http://tennis-bot:8000/api/tennis")

# Global variables
tennis_matches = []
# Add a cache to store historical match data with a TTL
match_cache = {}
CACHE_TTL = 3600  # Cache matches for 1 hour (in seconds)

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
    eastern_time = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=-4)))
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
    await websocket.accept()
    try:
        while True:
            try:
                await websocket.send_json(tennis_matches)
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Error in WebSocket loop: {e}")
                break
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        logger.info("WebSocket connection closed")

# Function to process tennis data
async def process_tennis_data():
    """
    Processes tennis data for frontend consumption.
    If tennis_bot is available, uses its data directly.
    Otherwise, fetches and processes data directly.
    """
    global tennis_matches
    
    while True:
        try:
            logger.info("Processing data from tennis_bot API")
            response = requests.get(TENNIS_BOT_API)
            
            if response.status_code == 200:
                data = response.json()
                raw_matches = data.get("matches", [])
                logger.info(f"Fetched data from tennis_bot API. Raw data length: {len(raw_matches)}")
                
                # Process matches with market grouper
                processed_matches = market_grouper.process_matches(raw_matches)
                
                # Update cache for each match before replacing the current list
                current_time = time.time()
                for match in processed_matches:
                    match_id = match.get("match_id")
                    if match_id:
                        match_cache[match_id] = {
                            "data": match,
                            "timestamp": current_time
                        }
                
                # Clean up expired cache entries
                expired_keys = [k for k, v in match_cache.items() 
                               if current_time - v["timestamp"] > CACHE_TTL]
                for key in expired_keys:
                    del match_cache[key]
                
                # Update the global tennis_matches list
                tennis_matches = processed_matches
                logger.info(f"Processed {len(tennis_matches)} tennis matches from tennis_bot")
                
            else:
                logger.error(f"Failed to fetch data from tennis_bot API. Status code: {response.status_code}")
            
        except Exception as e:
            logger.error(f"Error processing tennis data: {str(e)}")
        
        # Sleep for 30 seconds before next update
        await asyncio.sleep(30)

if __name__ == "__main__":
    # Start the process loop in a separate thread
    process_thread = threading.Thread(target=lambda: asyncio.run(process_tennis_data()))
    process_thread.daemon = True
    process_thread.start()
    
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
