# EventSphere (VideoMeet)

This project is a demo Virtual Event / Video Meeting system built with Node.js, Express and Socket.IO, and uses static HTML/CSS/JS for the frontend.

Important: this project currently stores user and meeting data in local JSON files (`users.json`, `meetings.json`). For production you should use a proper database and persistent storage.

## Deployment options

Below are quick instructions for common deployment targets.

### 1) Docker (recommended, portable)

Build image locally:

```powershell
cd 'C:\Users\HP\Downloads\ankit conference site'
docker build -t eventsphere:latest .
```

Run container locally:

```powershell
docker run -p 3000:3000 --name eventsphere eventsphere:latest
```

Notes: The container writes `users.json` and `meetings.json` inside the container filesystem. If you need persistence across container restarts, mount a host volume:

```powershell
docker run -p 3000:3000 -v "${PWD}:/usr/src/app" --name eventsphere eventsphere:latest
```

### 2) Render / Railway / Fly.io

- Push this repo to GitHub.
- Create a new service on your chosen platform and connect the GitHub repo.
- Build command: `npm ci --only=production`
- Start command: `node server.js` (or use the provided `Procfile` for Heroku-compatible platforms)

Note about storage: Many PaaS containers have ephemeral filesystems. Use an external DB (Postgres, Mongo) or object storage for user/meeting persistence in production.

### 3) Heroku (if still available)

```powershell
heroku create your-app-name
git push heroku main
heroku open
```

## Environment & Ports
- The app listens on `PORT` environment variable (defaults to 3000).

## Preparing repository
1. Initialize git if not already:

```powershell
cd 'C:\Users\HP\Downloads\ankit conference site'
git init
git add .
git commit -m "Initial EventSphere commit"
```

2. Create a GitHub repo and push:

```powershell
git remote add origin https://github.com/yourusername/eventsphere.git
git branch -M main
git push -u origin main
```

## Next steps (recommended)
- Replace file-based storage with a database (Postgres / MongoDB / SQLite) before production.
- Secure authentication: store hashed passwords (bcrypt) and add session management.
- Add TLS/HTTPS via the host (Render, Fly, etc. provide this automatically).

If you want, I can:
- Create Docker image locally here and run it to verify (requires Docker installed on your machine).
- Prepare a one-click Deploy to Render/Fly configuration (e.g., `render.yaml` or `fly.toml`).

Which provider do you want to deploy to? Or should I create a Docker image and run it locally to verify now?
