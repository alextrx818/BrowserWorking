#!/bin/bash

# Kill any existing processes that might conflict
pkill -f "python3 main_api.py" || true
pkill -f "python3 -m aggregator.sports.tennis.tennis_bot" || true
killall -9 uvicorn || true

# Kill any existing tennis-system session
tmux kill-session -t tennis-system 2>/dev/null || true

# Create a new tmux session named 'tennis-system' in detached mode
echo "Starting tennis system in a tmux session..."
tmux new-session -d -s tennis-system

# Split the window vertically
tmux split-window -v -t tennis-system:0

# In the top pane, start the tennis bot
tmux send-keys -t tennis-system:0.0 "cd /root/FinalTennisBot && source venv/bin/activate && export PYTHONPATH=/root/FinalTennisBot && python3 -m aggregator.sports.tennis.tennis_bot" Enter

# Wait for tennis bot to initialize
sleep 5

# In the bottom pane, start the main API
tmux send-keys -t tennis-system:0.1 "cd /root/FinalTennisBot && source venv/bin/activate && export PYTHONPATH=/root/FinalTennisBot && export TENNIS_BOT_API=http://localhost:8000/api/tennis && python3 main_api.py" Enter

# Inform the user
echo "Tennis system started successfully in the background"
echo "Displaying tennis_bot.log (press Ctrl+C to stop viewing logs, system will continue running)"
echo "-----------------------"

# Give the system a moment to start and create the log file
sleep 2

# Show the log file to the user (they can press Ctrl+C to stop viewing)
tail -f /root/FinalTennisBot/tennis_bot.log

echo ""
echo "You've stopped viewing the log, but the tennis system is still running in the background."
echo "To completely stop the system, run: tmux kill-session -t tennis-system"
