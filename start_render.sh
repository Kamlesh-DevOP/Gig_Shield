#!/usr/bin/env bash
set -e

echo "======================================================="
echo "🚀 Starting internal MCP Layer (Port 5100, Background)"
echo "======================================================="
# We start the MCP server passing the directory to uvicorn to avoid hyphen module import issues
uvicorn server:app --host 127.0.0.1 --port 5100 --app-dir mcp-layer &

# Wait briefly to ensure MCP API is bound
sleep 3

# Inject the local MCP server URL into the environment so the main app connects to it
export MCP_SERVER_URL="http://127.0.0.1:5100"

echo "======================================================="
echo "🚀 Starting Main FastAPI Backend (Port ${PORT:-10000})"
echo "======================================================="
exec uvicorn app:app --host 0.0.0.0 --port "${PORT:-10000}" --workers 1 --timeout-keep-alive 120
