#!/bin/bash

# Fashion Creative Generator - Streamlit Frontend
# This script starts the Streamlit frontend for the fashion creative generation system

echo "🎨 Starting Fashion Creative Generator Frontend..."

# Check if streamlit is installed
if ! command -v streamlit &> /dev/null; then
    echo "❌ Streamlit not found. Installing requirements..."
    pip install -r requirements_streamlit.txt
fi

# Set environment variables
export N8N_WEBHOOK_URL="http://localhost:5678/webhook/fashion-creative"
export LOCAL_SERVER_URL="http://localhost:3000/api/generate-creative"

# Start Streamlit
echo "🚀 Starting Streamlit on http://localhost:8501"
echo "📱 Make sure n8n is running on http://localhost:5678"
echo "🔧 Make sure your local server is running on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

streamlit run streamlit_app.py --server.port 8501 --server.address localhost
