#!/bin/bash

# Tennis System Deployment Script
# This script safely deploys the tennis system to a remote server
# Usage: ./deploy_to_server.sh [server_ip]

# Default server IP if not provided
SERVER_IP=${1:-"143.198.13.116"}
REMOTE_DIR="/root/FinalTennisBot"
LOCAL_DIR="/root/FinalTennisBot"

# Set timestamp for backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Validate that local directory exists
if [ ! -d "$LOCAL_DIR" ]; then
    echo "ERROR: Local directory $LOCAL_DIR does not exist!"
    exit 1
fi

# Create local backup before deployment
echo "Creating local backup before deployment..."
/root/FinalTennisBot/backup_tennis_system.sh

# Ask for confirmation
echo "About to deploy to $SERVER_IP. The remote directory will be backed up first."
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Deployment canceled."
    exit 1
fi

# Make remote backup
echo "Creating remote backup on $SERVER_IP..."
ssh -o "StrictHostKeyChecking=no" root@$SERVER_IP "mkdir -p /root/tennis_system_backups && tar -czf /root/tennis_system_backups/tennis_system_backup_${TIMESTAMP}.tar.gz -C /root FinalTennisBot 2>/dev/null || echo 'No existing directory to backup'"

# Deploy using rsync (safer than removing the directory first)
echo "Deploying to $SERVER_IP..."
rsync -avz --delete --exclude 'node_modules' --exclude '.git' $LOCAL_DIR/ root@$SERVER_IP:$REMOTE_DIR/

# Restart services if needed
echo "Restarting Docker services on $SERVER_IP..."
ssh -o "StrictHostKeyChecking=no" root@$SERVER_IP "cd $REMOTE_DIR && docker-compose down && docker-compose up -d"

echo "Deployment completed successfully!"
