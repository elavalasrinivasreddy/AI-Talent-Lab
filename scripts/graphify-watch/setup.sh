#!/bin/bash
# Setup script for graphify watch service

SERVICE_FILE="graphify-watch.service"
DEST_DIR="$HOME/.config/systemd/user"

# Get absolute path to the directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up Graphify watch service..."

# Create systemd user directory if it doesn't exist
mkdir -p "$DEST_DIR"

# Copy the service file
cp "$SCRIPT_DIR/$SERVICE_FILE" "$DEST_DIR/"

# Reload systemd, enable the service to start on boot, and start it now
systemctl --user daemon-reload
systemctl --user enable "$SERVICE_FILE"
systemctl --user start "$SERVICE_FILE"

echo "Graphify watch service installed and started successfully!"
echo "Check the README.md in this directory for instructions on managing the service."
