#!/bin/bash

echo "🎬 YouTube AI Summarizer - Demo Recording Setup"
echo "================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npm run install-browsers

if [ $? -ne 0 ]; then
    echo "❌ Failed to install browsers"
    exit 1
fi

echo "✅ Browsers installed"
echo ""

# Check for API key
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  Warning: GEMINI_API_KEY environment variable not set"
    echo ""
    echo "Set it with:"
    echo "  export GEMINI_API_KEY='your-key-here'"
    echo ""
    echo "Or edit demo-recorder.js and set it in the CONFIG object"
else
    echo "✅ API key found in environment"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📹 To record a demo, run:"
echo "  npm run demo:short  (2-3 minute demo)"
echo "  npm run demo:full   (5-7 minute demo)"
echo ""
