# Git Guide for Popouts

## Initial Setup (Already Done ✅)

The repository has been initialized and pushed to GitHub:
- **Repository**: https://github.com/sankarraoa/popouts.git
- **Branch**: `main`

## Daily Workflow

### Making Changes and Pushing

1. **Check status** (see what files changed):
   ```bash
   git status
   ```

2. **Add files** (stage your changes):
   ```bash
   # Add all changes
   git add .
   
   # Or add specific files
   git add path/to/file.js
   ```

3. **Commit changes** (save with a message):
   ```bash
   git commit -m "Description of what you changed"
   ```

4. **Push to GitHub**:
   ```bash
   git push
   ```

### Example Workflow

```bash
# Make your code changes...

# Check what changed
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Add new feature: LLM integration for action extraction"

# Push to GitHub
git push
```

## Future Server-Side Code Structure

When you add server-side operations (LLM calls, backups, etc.), consider this structure:

```
popouts/
├── client/                    # Chrome Extension (current code)
│   ├── manifest.json
│   ├── sidepanel/
│   ├── popup/
│   ├── js/
│   └── ...
│
├── server/                    # Server-side code (future)
│   ├── api/                   # API endpoints
│   │   ├── llm/
│   │   │   └── extract-actions.js
│   │   └── backup/
│   │       └── sync.js
│   ├── config/
│   │   └── config.js
│   ├── package.json
│   └── server.js
│
├── shared/                    # Shared code between client/server
│   └── types.js
│
└── README.md
```

### Adding Server-Side Code Later

1. **Create server directory**:
   ```bash
   mkdir server
   cd server
   npm init -y
   ```

2. **Add dependencies** (e.g., Express, OpenAI SDK):
   ```bash
   npm install express openai
   ```

3. **Commit and push**:
   ```bash
   git add server/
   git commit -m "Add server-side API for LLM integration"
   git push
   ```

## Branching Strategy (Optional)

For larger features, consider using branches:

```bash
# Create a new branch
git checkout -b feature/llm-integration

# Make changes, commit
git add .
git commit -m "Add LLM integration"

# Push branch
git push -u origin feature/llm-integration

# Merge back to main (via GitHub PR or locally)
git checkout main
git merge feature/llm-integration
git push
```

## Common Commands

- `git status` - See what files changed
- `git add .` - Stage all changes
- `git commit -m "message"` - Commit changes
- `git push` - Push to GitHub
- `git pull` - Pull latest changes from GitHub
- `git log` - See commit history
- `git diff` - See what changed in files

## Troubleshooting

### If push fails (authentication):
```bash
# Use GitHub CLI or set up SSH keys
# Or use personal access token:
git remote set-url origin https://YOUR_TOKEN@github.com/sankarraoa/popouts.git
```

### If you need to undo last commit (but keep changes):
```bash
git reset --soft HEAD~1
```

### If you need to see what's on GitHub vs local:
```bash
git fetch
git log HEAD..origin/main  # See commits on GitHub not locally
```
