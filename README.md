# Tennis Scoring System

This is a real-time tennis scoring application that provides up-to-date match data, including scores, statistics, and betting odds.

## System Components

The tennis system consists of several components:

1. **Tennis Bot** - `/aggregator/sports/tennis/tennis_bot.py`
   - Fetches data from external APIs (BetsAPI and RapidAPI)
   - Merges and processes data from different sources
   - Prepares data for consumption by the main API

2. **Main API** - `main_api.py`
   - FastAPI application serving data via REST API
   - Provides WebSocket connections for real-time updates
   - Serves the React frontend

3. **React Frontend** - `my-react-app/`
   - User interface for viewing live tennis matches
   - Shows match details, scores, and betting odds
   - Connects to the API via HTTP and WebSockets

## Starting the System

### Option 1: Using the run_tennis_system.sh Script (Recommended)

The easiest way to start the system is with the provided script:

```bash
cd /root/FinalTennisBot
chmod +x run_tennis_system.sh
./run_tennis_system.sh
```

This script:
- Starts both the tennis bot and main API in a tmux session
- Shows the tennis_bot.log in the current terminal
- Keeps the system running in the background when you close the logs (Ctrl+C)

To stop the system completely:
```bash
tmux kill-session -t tennis-system
```

### Option 2: Using the Python Script

You can also use the Python script for starting the system:

```bash
cd /root/FinalTennisBot
python3 start_tennis_system.py
```

Add the `--verbose` flag to see all output directly in the terminal:
```bash
python3 start_tennis_system.py --verbose
```

## Data Flow

1. **Data Collection**:
   - BetsAPI provides match data and betting odds
   - RapidAPI provides additional match statistics and odds

2. **Data Processing**:
   - The TennisMerger combines data from both sources
   - MarketGrouper organizes betting markets by category

3. **API Endpoints**:
   - `/api/tennis` - Returns all current tennis matches
   - `/api/tennis/match/{id}` - Returns detailed data for a specific match

4. **Frontend**:
   - TennisData.jsx displays the list of all matches
   - MatchDetail.jsx shows detailed information for a single match

## Backup and Recovery

The system includes scripts for backup and recovery:

1. **Backup Script** - `backup_tennis_system.sh`
   - Creates daily backups of the system
   - Usage: `./backup_tennis_system.sh`

2. **Deployment Script** - `deploy_to_server.sh`
   - Safely updates the remote server
   - Usage: `./deploy_to_server.sh`

3. **Recovery Script** - `restore_from_backup.sh`
   - Restores the system from a backup
   - Usage: `./restore_from_backup.sh <backup_file.tar.gz>`

## Troubleshooting

### Common Issues

1. **System not starting**:
   - Check if PYTHONPATH is set correctly
   - Ensure all dependencies are installed in the virtual environment
   - Check the error logs in `tennis_bot.log` and `main_api.log`

2. **No data showing in frontend**:
   - Check if the tennis bot is running and fetching data
   - Verify the WebSocket connection is working
   - Check network requests in the browser developer tools

3. **Import errors**:
   - Make sure the virtual environment is activated
   - Verify that the package is installed in development mode: `pip install -e .`
   - Ensure PYTHONPATH includes the project root

### Debugging

To see detailed logs:
```bash
# For tennis bot logs:
tail -f tennis_bot.log

# For main API logs:
tail -f main_api.log
```

## Development

1. Create and activate the virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
pip install -e .
```

3. Run the application in development mode:
```bash
./run_tennis_system.sh
```

## System Architecture Diagram

```
┌───────────────────────────────────────────────┐
│                 External APIs                 │
├─────────────────────────┬─────────────────────┤
│       BetsAPI           │      RapidAPI       │
└──────────┬──────────────┴──────────┬──────────┘
           │                         │
           ▼                         ▼
┌──────────────────────┐  ┌──────────────────────┐
│   BetsapiPrematch    │  │ RapidInplayOddsFetcher│
│    (betsapi_data)    │  │    (rapid_data)      │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └─────────────┬───────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────┐
│               TennisMerger.merge()              │
│                                                 │
│  • Matches events between BetsAPI and RapidAPI  │
│  • Merges data from both sources                │
│  • Creates unified match objects                │
└───────────────────────┬─────────────────────────┘
                        │
                        │ merged_data
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              MarketGrouper                      │
│                                                 │
│  • Organizes betting markets by category        │
│  • Structures markets for frontend consumption  │
└───────────────────────┬─────────────────────────┘
                        │
                        │ grouped_data
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              main_api.py (FastAPI)              │
│                                                 │
│  • Stores grouped_data in tennis_matches        │
│  • Exposes API endpoints                        │
│  • Serves the React frontend static files       │
└───────────────────────┬─────────────────────────┘
                        │
                        │ HTTP/WebSocket
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              React Frontend                     │
│                                                 │
│  • TennisData.jsx - Lists all matches           │
│  • MatchDetail.jsx - Shows match details        │
└─────────────────────────────────────────────────┘
```
