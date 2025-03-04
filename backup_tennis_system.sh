#!/bin/bash

# Tennis System Backup Script
# This script creates daily backups of the tennis system
# Usage: ./backup_tennis_system.sh

# Set backup directory
BACKUP_DIR="/root/tennis_system_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/tennis_system_backup_$TIMESTAMP.tar.gz"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup
echo "Creating backup of FinalTennisBot to $BACKUP_FILE"
tar -czf $BACKUP_FILE -C /root FinalTennisBot

# Set correct permissions
chmod 600 $BACKUP_FILE

# Report success
echo "Backup completed successfully at $(date)"
echo "Backup stored at: $BACKUP_FILE"

# Keep only the 7 most recent backups to save space
echo "Cleaning up old backups..."
ls -t $BACKUP_DIR/tennis_system_backup_*.tar.gz | tail -n +8 | xargs rm -f 2>/dev/null

echo "Backup process completed"
