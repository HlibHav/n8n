# Fashion Creative Generator

AI-powered fashion marketing content generation using LangGraph agents and Black Forest Labs image generation.

## Features

- 🎨 **AI Image Generation**: Category-aware image creation using BFL API
- 🧠 **Multi-Agent System**: LangGraph agents for persona inference, image generation, and copy creation
- 📊 **Excel Data Integration**: Load personas from Excel files
- 🎯 **Category-Specific**: Generate content for fashion, beauty, travel, tech, etc.
- 🔄 **Real-time Polling**: Asynchronous image generation with progress tracking

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   pip install -r requirements_streamlit.txt
   ```

2. **Set Environment Variables**:
   ```bash
   cp env.example .env
   # Edit .env with your API keys
   ```

3. **Start the Server**:
   ```bash
   npx tsc && node dist/src/server.js
   ```

4. **Start the Frontend**:
   ```bash
   ./run_streamlit.sh
   ```

5. **Open the App**: http://localhost:8501

## API Keys Required

- `BFL_API_KEY`: Black Forest Labs API key for image generation
- `OPENAI_API_KEY`: OpenAI API key for copy generation

## Architecture

- **Backend**: Node.js + Express + LangGraph
- **Frontend**: Streamlit
- **Image Generation**: Black Forest Labs API
- **AI Agents**: LangGraph multi-agent system
- **No External Dependencies**: Pure LangGraph + Streamlit application

## File Structure

```
├── src/                    # TypeScript source code
│   ├── agent/             # LangGraph agents
│   └── server.ts          # Express server
├── dist/                  # Compiled JavaScript
├── streamlit_app.py       # Streamlit frontend
├── personas.xlsx          # Sample data
└── requirements_streamlit.txt
```