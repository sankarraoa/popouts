# Quick Setup Guide

## Step 1: Navigate to the service directory

```bash
cd services/llm-service
```

## Step 2: Create .env file

Create a `.env` file with your API keys:

```bash
# Create .env file
cat > .env << 'EOF'
# LLM Provider Configuration
LLM_PROVIDER=toqan  # or "openai"

# Toqan Configuration
TOQAN_API_KEY=sk_your_toqan_api_key_here

# OpenAI Configuration (if using OpenAI)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4

# Server Configuration
HOST=0.0.0.0
PORT=8000
EOF
```

**Important:** Replace `sk_your_toqan_api_key_here` with your actual Toqan API key.

## Step 3: Run the service

### Option A: Using the start script (recommended)

```bash
./start.sh
```

### Option B: Manual setup

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the service
python -m app.main
```

### Option C: Using Docker

```bash
docker-compose up --build
```

## Step 4: Test the service

1. Open `test.html` in your browser (double-click the file)
2. Or visit `http://localhost:8000/test` once the server is running
3. The test page will load sample data automatically
4. Click "Send Request" to test

## Troubleshooting

### "externally-managed-environment" error
This means you need to use a virtual environment. The `start.sh` script handles this automatically.

### "No such file or directory: ./start.sh"
Make sure you're in the `services/llm-service` directory, not the root `meetingNotes` directory.

### Service won't start
- Check that your `.env` file exists and has valid API keys
- Make sure port 8000 is not already in use
- Check the terminal output for error messages
