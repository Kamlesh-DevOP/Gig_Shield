"""
Convenience launcher for the GigShield MCP Layer server.

Usage:
  python scripts/start_mcp_server.py

By default the server runs on port 5100.
Set MCP_SERVER_PORT env var to override.

Architecture:
  Backend (FastAPI) → RealTimeMCPClient → MCP Layer (this server) → OpenWeatherMap / NewsAPI / Tavily
"""

import os
import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MCP_LAYER = ROOT / "mcp-layer" / "server.py"


def main():
    port = int(os.getenv("MCP_SERVER_PORT", "5100"))

    print(f"\n🚀 Starting GigShield MCP Layer on http://localhost:{port}")
    print("   Tools : get_weather · get_news · crawl_web · analyze_localized_risk")
    print(f"   Docs  : http://localhost:{port}/docs")
    print(f"   Health: http://localhost:{port}/health")
    print("   Press Ctrl+C to stop.\n")

    env = os.environ.copy()
    env["MCP_SERVER_PORT"] = str(port)

    # Prefer venv python if available
    venv_python = ROOT / "venv" / "Scripts" / "python.exe"
    python_exe = str(venv_python) if venv_python.exists() else sys.executable

    subprocess.run(
        [
            python_exe,
            "-m", "uvicorn",
            "server:app",
            "--host", "0.0.0.0",
            "--port", str(port),
            "--app-dir", str(MCP_LAYER.parent),
        ],
        cwd=str(ROOT),
        env=env,
    )


if __name__ == "__main__":
    main()
