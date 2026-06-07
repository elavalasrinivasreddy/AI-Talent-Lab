# Graphify Watch Service

This directory contains the systemd service to automatically run `graphify watch .` in the background for the **AI Talent Lab** project. It runs as a user service, so it doesn't require root/sudo privileges and will automatically start when you log in.

## Installation

To install and start the service, simply run the setup script:

```bash
cd scripts/graphify-watch
bash setup.sh
```

## How to Manage the Service

You can manage the background service using `systemctl --user`:

### 🟢 Check Status
To see if it's currently running and view recent logs:
```bash
systemctl --user status graphify-watch
```

### ⏸️ Pause/Stop
To temporarily stop the watcher:
```bash
systemctl --user stop graphify-watch
```

### ▶️ Resume/Start
To start it again:
```bash
systemctl --user start graphify-watch
```

### 🔄 Restart
If you need to force a restart of the watcher:
```bash
systemctl --user restart graphify-watch
```

### 📜 View Logs
To view the full real-time logs of the graphify watcher:
```bash
journalctl --user -u graphify-watch -f
```

### 🗑️ Delete/Uninstall
If you no longer want the background service:
```bash
systemctl --user stop graphify-watch
systemctl --user disable graphify-watch
rm ~/.config/systemd/user/graphify-watch.service
systemctl --user daemon-reload
```

## How to Modify the Service
1. Edit `graphify-watch.service` in this directory.
2. Run `bash setup.sh` again to copy your changes to the systemd config folder and reload the daemon.
3. Run `systemctl --user restart graphify-watch` for changes to take effect.
