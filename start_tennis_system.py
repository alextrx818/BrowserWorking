#!/usr/bin/env python3

import subprocess
import sys
import time
import os
import argparse
import signal
import atexit

# Process tracking
tennis_bot_process = None
main_api_process = None
processes = []

def signal_handler(sig, frame):
    print("\nShutting down tennis system...")
    cleanup()
    sys.exit(0)

def cleanup():
    for process in processes:
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()

def main():
    parser = argparse.ArgumentParser(description='Start the Tennis System')
    parser.add_argument('--verbose', action='store_true', help='Show output in console instead of log files')
    args = parser.parse_args()
    
    # Register cleanup handlers
    atexit.register(cleanup)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Current directory
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Set PYTHONPATH
    env = os.environ.copy()
    env["PYTHONPATH"] = base_dir
    
    # Start tennis_bot.py
    print("Starting tennis_bot.py...")
    if args.verbose:
        tennis_bot_process = subprocess.Popen(
            [sys.executable, os.path.join(base_dir, 'aggregator/sports/tennis/tennis_bot.py')],
            stdout=sys.stdout,
            stderr=sys.stderr,
            env=env,
            cwd=base_dir
        )
    else:
        tennis_bot_log = open(os.path.join(base_dir, 'tennis_bot.log'), 'w')
        tennis_bot_process = subprocess.Popen(
            [sys.executable, os.path.join(base_dir, 'aggregator/sports/tennis/tennis_bot.py')],
            stdout=tennis_bot_log,
            stderr=tennis_bot_log,
            env=env,
            cwd=base_dir
        )
    
    processes.append(tennis_bot_process)
    
    # Wait for tennis_bot to initialize
    print("Waiting for tennis_bot to initialize...")
    time.sleep(5)
    
    # Start main_api.py
    print("Starting main_api.py...")
    if args.verbose:
        main_api_process = subprocess.Popen(
            [sys.executable, os.path.join(base_dir, 'main_api.py')],
            stdout=sys.stdout,
            stderr=sys.stderr,
            env=env,
            cwd=base_dir
        )
    else:
        main_api_log = open(os.path.join(base_dir, 'main_api.log'), 'w')
        main_api_process = subprocess.Popen(
            [sys.executable, os.path.join(base_dir, 'main_api.py')],
            stdout=main_api_log,
            stderr=main_api_log,
            env=env,
            cwd=base_dir
        )
    
    processes.append(main_api_process)
    
    print("Tennis system started successfully!")
    print("- Tennis Bot PID:", tennis_bot_process.pid)
    print("- Main API PID:", main_api_process.pid)
    
    if not args.verbose:
        print("\nLogs are being written to:")
        print("- Tennis Bot: tennis_bot.log")
        print("- Main API: main_api.log")
        print("\nTo view logs in real-time, use: tail -f tennis_bot.log")
    
    print("\nPress Ctrl+C to shutdown the system")
    
    # Keep the script running
    try:
        while True:
            # Check if processes are still running
            if tennis_bot_process.poll() is not None:
                print(f"WARNING: tennis_bot.py exited with code {tennis_bot_process.returncode}")
                break
            
            if main_api_process.poll() is not None:
                print(f"WARNING: main_api.py exited with code {main_api_process.returncode}")
                break
                
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down tennis system...")
    finally:
        cleanup()

if __name__ == "__main__":
    main()
