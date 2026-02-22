#!/bin/bash

# Quick start script for LLM Service

echo "🚀 Starting LLM Action Extraction Service..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating template..."
    cat > .env << 'EOF'
# LLM Provider Configuration
LLM_PROVIDER=toqan  # or "openai"

# Toqan Configuration
TOQAN_API_KEY=your_toqan_api_key_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4

# Server Configuration
HOST=0.0.0.0
PORT=8000
EOF
    echo "📝 Created .env file. Please edit it and add your API keys before running again."
    echo "   Edit: nano .env  (or use your preferred editor)"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip first
echo "📦 Upgrading pip..."
pip install --upgrade pip setuptools wheel

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Start the server
echo "🌟 Starting server on http://localhost:8000"
echo "📄 Test page available at: http://localhost:8000/test"
echo "📋 Or open test.html directly in your browser"
echo ""
python -m app.main
