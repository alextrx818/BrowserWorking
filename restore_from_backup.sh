#!/bin/bash

# Tennis System Restore Script
# This script restores the tennis system from a backup
# Usage: ./restore_from_backup.sh [backup_file]

BACKUP_DIR="/root/tennis_system_backups"

# List available backups if no argument is provided
if [ $# -eq 0 ]; then
    echo "Available backups:"
    ls -lt $BACKUP_DIR/tennis_system_backup_*.tar.gz 2>/dev/null
    echo ""
    echo "Usage: ./restore_from_backup.sh [backup_file]"
    echo "Example: ./restore_from_backup.sh /root/tennis_system_backups/tennis_system_backup_20250304_120000.tar.gz"
    exit 0
fi

BACKUP_FILE=$1

# Check if the backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file $BACKUP_FILE does not exist!"
    exit 1
fi

# Ask for confirmation
echo "WARNING: This will replace your current FinalTennisBot directory with the contents of $BACKUP_FILE"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Restore canceled."
    exit 1
fi

# Create a safety backup of current state
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SAFETY_BACKUP="$BACKUP_DIR/tennis_system_pre_restore_$TIMESTAMP.tar.gz"
echo "Creating safety backup of current state to $SAFETY_BACKUP..."
tar -czf $SAFETY_BACKUP -C /root FinalTennisBot 2>/dev/null || echo "No existing directory to backup"

# Remove existing directory
echo "Removing existing FinalTennisBot directory..."
rm -rf /root/FinalTennisBot

# Extract backup
echo "Restoring from backup $BACKUP_FILE..."
mkdir -p /root/FinalTennisBot
tar -xzf $BACKUP_FILE -C /root

echo "Restore completed successfully!"
echo "If you need to undo this restore, use: ./restore_from_backup.sh $SAFETY_BACKUP"
