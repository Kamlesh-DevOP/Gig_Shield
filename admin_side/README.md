# 🛡️ GIC Admin Dashboard

The **GIC Admin Dashboard** is a high-fidelity, predictive command center designed for insurance administrators to manage risk, oversee financial health, and simulate real-world disruptions across the gig economy.

## 🚀 Key Features

### 1. Advanced Predictive Finance Engine (Next-Week)
*   **MCP-Driven Forecasting**: The dashboard leverages a dedicated **MCP (Model Context Protocol) Layer** that continuously scans global weather and news feeds for *upcoming* anomalies.
*   **Autonomous Intelligence Pipeline**: When a future disruption is identified, the system automatically:
    1.  **Geo-Queries Supabase**: Fetches all workers active in the predicted disruption radius.
    2.  **Agentic Evaluation**: Passes records through the **LangChain Orchestrator** to evaluate individual risk.
    3.  **Actuarial Forecasting**: Runs ML models to predict potential income loss and rollout disbursed amounts for the next cycle.

### 2. Live Operational Health (Current-Week)
*   **Supabase Integrity**: Displays the "Status Quo" of the current insurance pool—real-time premiums collected, active coverage counts, and historical payout performance fetched directly from **Supabase**.


### 3. Dynamic Disruption Simulator (The "Zap" Tool)
*   **Manual Trigger**: Since real-world disruptions are intermittent, the **"Simulate Disruption"** button allows admins to manually trigger the entire autonomous pipeline described above.
*   **Stress Testing**: Choose any city and disruption type (Floods, Strikes, etc.) to see exactly how the agents and models would react, providing a "sandbox" for financial forecasting.

### 4. Actuarial Transparency & Math Explainability
*   **Worker-Level Records**: View granular details for every affected worker, including their ML Risk Score, Income Context, and Eligibility Status.
*   **Formula Breakdown**: Every payout includes a transparent "Math Breakdown" (e.g., `(Base Coverage * Loyalty Bonus) * Slab Multiplier`), ensuring full auditability of the autonomous engine.

### 5. Geospatial Regional Map
*   **Worker Distribution**: An interactive map of India showing city-level density.
*   **Local Insights**: Hover over operational cities to see total local premiums, active worker counts, and rollout historicals.

## 🧠 Technical Architecture

*   **Frontend**: React + Vite + TailwindCSS (Vanilla CSS for custom components).
*   **State Management**: React Hooks + Supabase Real-time.
*   **Data Visualization**: Recharts (for financial trends) & React Simple Maps (for geospatial data).
*   **AI Backend**: 
    *   **MCP Layer**: Real-time predictive monitoring via external API hooks.
    *   **LSTM & SARIMAX**: Used for high-precision worker income forecasting.
    *   **XGBoost**: Calculates risk probability and financial loss radius.
    *   **LangChain Multi-Agent System**: Orchestrates the autonomous decision-making pipeline.

## 🛠️ Getting Started

### Prerequisites
*   Node.js & npm
*   Running Backend (FastAPI on port 8000)

### Installation
```bash
# Navigate to admin_side
cd admin_side

# Install dependencies
npm install

# Start the dashboard
npm run dev
```

The dashboard will be available at `http://localhost:5173`. Ensure your `.env` file is configured with the correct Supabase credentials.
