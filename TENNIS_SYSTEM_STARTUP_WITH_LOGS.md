# Tennis System Startup with Visible Logs

This document explains different ways to start the Tennis System while being able to view logs in real-time.

## Method 1: Using run_tennis_system.sh (Recommended)

The simplest way to start the system and see logs is to use the provided shell script:

```bash
./run_tennis_system.sh
```

This script:
1. Starts a tmux session with both the tennis bot and API running
2. Shows the tennis_bot.log in your current terminal
3. Allows you to press Ctrl+C to stop viewing logs without stopping the system
4. To completely stop the system: `tmux kill-session -t tennis-system`

## Method 2: Using start_tennis_system.py with Verbose Flag

The Python script can start the system with logs showing directly in the terminal:

```bash
python3 start_tennis_system.py --verbose
```

With this method:
- All output from both components appears directly in your terminal
- Pressing Ctrl+C will stop the entire system
- This mode is useful for debugging initial setup issues

## Method 3: Standard Mode with Separate Log Viewing

Start the system in the standard way, where logs go to files:

```bash
python3 start_tennis_system.py
```

Then, in a separate terminal, view the logs in real-time:

```bash
# View tennis bot logs
tail -f tennis_bot.log

# Or view main API logs
tail -f main_api.log
```

## Method 4: Manual Component Startup (Advanced)

For development or advanced troubleshooting, you can start components separately:

Terminal 1 (Tennis Bot):
```bash
cd /root/FinalTennisBot
source venv/bin/activate
export PYTHONPATH=/root/FinalTennisBot
python3 aggregator/sports/tennis/tennis_bot.py
```

Terminal 2 (Main API):
```bash
cd /root/FinalTennisBot
source venv/bin/activate
export PYTHONPATH=/root/FinalTennisBot
python3 main_api.py
```

## Best Practice: Using tmux Manually

For the most flexible setup, you can create your own tmux session:

```bash
# Create and attach to a new tmux session
tmux new-session -s tennis

# Split the terminal horizontally
# Press Ctrl-b, then "
```

In the top pane:
```bash
cd /root/FinalTennisBot
source venv/bin/activate
export PYTHONPATH=/root/FinalTennisBot
python3 aggregator/sports/tennis/tennis_bot.py
```

In the bottom pane (press Ctrl-b, then down arrow to navigate):
```bash
cd /root/FinalTennisBot
source venv/bin/activate
export PYTHONPATH=/root/FinalTennisBot
python3 main_api.py
```

To detach from the session without stopping it: Press Ctrl-b, then d
To reattach later: `tmux attach-session -t tennis`
