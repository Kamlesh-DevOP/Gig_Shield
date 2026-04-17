# Gig Insurance Company - Technical & Project Overview

## 1. Project Objective and Vision
Gig Insurance Company is an autonomous, AI-powered income insurance platform created for the massive demographic of gig economy workers in India. Developed entirely as a **parametric insurance model**, payouts are calculated and deployed instantly based on purely quantitative, real-time data inputs (e.g., rainfall indices, thermal extremes, internet outages)—bypassing any traditional claim forms or manual surveyor delays. 

Operating under a B2B2C framework, Gig Insurance Company partners directly with enterprise platforms (quick-commerce) via API layers natively securing their active workforce.

## 2. Advanced Financial Modelling & Actuarial Architecture
The financial viability of the platform relies on strict algorithmic modeling designed to maintain an exact operating profit margin of 15% across all cohorts. 

### The 75% Payout Threshold Logic
Payouts are exclusively triggered when a worker's validated income falls *below 75% of their rolling 52-week average* due to external disruptions.
- **Statistical Rationale:** Gig earnings are inherently cyclic. Actuarial modeling maps that a natural income fluctuation of up to 25% falls within standard acceptable variance. The platform is designed to cover the **abnormal loss** exceeding that standard deviation.
- **Gap Coverage Calculation:** Maximum payouts are not flat sums. They are purely the mathematical difference between the actual earned income during the disrupted week and that 75% moving average boundary limit. 

### Dynamic Premium Pricing & Slabs
Rather than standard fixed fees, base premiums calculate dynamically every week utilizing deep statistical profiling. 
- **Base Premium:** Established at exactly **4.0%** of the worker's 52-week historic moving average.
- **Tiered Customization Slabs:**
    - **Slab 1 (50% Coverage Gap):** Calculated precisely at **3.6%** of weekly avg income for affordability.
    - **Slab 2 (75% Coverage Gap):** Operates at the **4.0%** standard actuarial baseline.
    - **Slab 3 (100% Coverage Gap):** Priced at **4.8%** of the weekly avg income for ultimate security.

### Behavioral Finances: Penalties & Rewards
- **Consistency Loyalty Rewards:** For every 4 sequential weeks of successful premium payment, workers earn an automatic **0.5% net reduction** in their premium, compounding their ability to stay insured.
- **Risk Default Penalties:** For every week that a worker misses a payment, the core engine introduces a strict **2% financial penalty** added permanently to future pricing. 
- **Mandatory 8-Week Cooling Period:** A solid 8-week financial track record is required before the first claim eligibility unlocks, fully barring "adverse selection" models where workers attempt to buy policies hours before an announced flood.

## 3. The 6 Parallel Machine Learning (ML) Models 
To rapidly compute these complex variables, the backend engine evaluates workers through six distinct, live ML models simultaneously:
1. **Income Forecasting Engine [LSTM / SARIMAX]:** Deep-learning time-series math forecasts extreme anomalies by mathematically tracing historical moving averages to predict a worker's expected pipeline.
2. **Dynamic Risk Scoring [XGBoost / LightGBM]:** Analyzes the raw geographic risk profile attached to the worker's specific delivery hubs.
3. **Fraud Anomaly Detection [Isolation Forest / XGBoost]:** Detects multidimensional pattern anomalies—discovering coordinated fraud rings.
4. **Behavior Analysis Scoring:** Generates quantifiable ratings regarding individual operational habits (login durations, decline ratios).
5. **Disruption Assessment Scaling:** Uses regional meteorological parameters to calculate the physical impact severity against business operations.
6. **Premium Assessor:** Rule-based ML synthesis adjusts next-week premium rates via forecasting future inputs.

## 4. Multi-Agent AI System (LangGraph Architecture)
The logical core is built upon a **Multi-Agent Orchestrator using the LangGraph & LangChain ecosystem**. Gig Insurance Company employs 8 highly specialized autonomous agents running asynchronously:

1. **Monitor Agent:** The Layer 1 tripwire. Runs constantly, triggering a system-wide evaluation state when numerical thresholds (e.g. 15cm rain) get breached via external APIs.
2. **Validation Agent:** Provides cross-regional validation to eliminate false positives. Verifies structural metrics across broader affected geographic clusters.
3. **Context Agent:** Using **Retrieval-Augmented Generation (RAG)** directly linked to a Vector DB, this agent recalls identical historical claims, active insurance policies, and parametric localized thresholds.
4. **Fraud Detection Agent:** Focuses strictly on anti-spoofing vectors and executes complex movement and peer-validation checks (detailed below).
5. **Risk Scoring Agent:** Operates in Layer 4, interfacing with the XGBoost ML pipelines to return definitive numeric risk scores regarding an active file.
6. **Rule Validation Agent:** Strictly audits deterministic policies (accounting for cooling periods, validating premium financial receipts, and checking demographic eligibilities).
7. **Decision Agent (The Integrator):** Synthesizes all parallel output strings from the Layer 4 clusters using LLM chains logically. Issues the final output state: `auto_approve`, `auto_reject`, or `manual_review`.
8. **SQL Data Agent:** Maps nested outputs securely into the primary `Supabase` architecture keeping a heavily audited digital paper trail.  

## 5. Model Context Protocol (MCP) & Data Integration
Gig Insurance Company completely automates physical-world data ingestion entirely through the **Model Context Protocol (MCP)**, connecting the internal neural architecture to live real-world inputs.
- **Regional Meteorological Layers:** Extracts live data regarding severe heatwaves, local rain accumulations, and cyclonic alert volumes.
- **Telecom Outages:** Checks systemic telecommunication failure metrics to validate 'internet blackout' disruption vectors.
- **Civil Feeds via News APIs:** Monitors external news endpoints scaling potential riot situations or civil curfews.
- **Platform Analytics Proxies:** Interfaces with partner b2b platforms seamlessly. Allows the agent pipeline to evaluate backend API server downtimes or systemic food hub failures.

## 6. Advanced Fraud Defense & Anti-Spoofing Architecture
Because gig workers can heavily spoof their GPS variables, the platform leverages a brutal "Market Crash" Adversarial Defense strategy avoiding GPS reliance.
- **Proof of Presence + Proof of Work:** Eligibility strictly requires verifying real economic work streams during an event boundary. Zero active order queries = Zero claim eligibility regardless of static GPS maps.
- **Dynamic Presence Score:** A specific scoring function mathematically combines active geographic time, valid localized orders completed, and precise times spent parked at localized distribution outlets.
- **Movement Realism Engine:** Analyzes vector telemetry looking for non-linear behavioral routes, variable physics (speeds), and delivery pivot points. It automatically identifies GPS tele-portation anomalies or linear macro-spoofing.
- **Peer Group Invalidation:** Validates disruption events cross-cohort. If 1 worker presents total offline disruption logic while 9 workers from the identical dark-store node show completely unaffected online statuses, the platform algorithms reject the single outlier automatically. 
- **Graph-Based Scoring:** Constructs mathematical node graphs detecting multiple clustered IPs or completely unified synchronized offline timelines, identifying 'coordinated fraud rings'.

## 7. Elaborated Dual Frontend Architectures
Gig Insurance Company utilizes modern React + Vite stacks specifically partitioned into distinct Worker-Side and Admin-Side interfaces running via Supabase persistence layers.

### The Worker Interface App
Designed entirely on a highly-responsive mobile-first philosophy, this acts directly as the user dashboard.
- **Policy Timeline UI:** Beautiful graphical visualizations depicting current coverage slabs mapping 52-week moving averages instantly for the user's transparency.
- **Live Simulator Environment:** Contains a "Run Simulation" feature explicitly highlighting how parameter variables instantly impact them via the platform architecture in real-time. 
- **Eligibility & Claims History:** Cleanly categorizes all historical parametric payouts granting UI visibility over exact deduction formulas causing loyalty bumps or default dips. 

### The Underwriter Admin Dashboard
A high-fidelity command and control center built leveraging `React Simple Maps` and `Recharts` providing macroscopic visibility.
- **Predictive Finance Sandbox:** Leveraging the MCP array, admins track *upcoming* weather fronts visually across a Map and run LangChain simulations evaluating exactly how a future flood might impact future corporate financial health in 8 days.
- **Real-Time Operational Mapping:** Geographically pins active gig worker cohorts showing density vs baseline premiums actively collected cross-city in live clusters.
- **Actuarial Transparency Toolkit:** Administrators drill down on exactly how agent AI LLM brains evaluated isolated 'Worker Z'. Showcasing the verbatim `auto_approve` outputs matching XGBoost risks and RAG retrievals against human visibility blocks. 

## 8. End-to-End Execution Workflow
Here is an elaborated flow of exactly what operates on the Python Fast API clusters during a catastrophic disruption:

1. **Continuous Asynchronous Scanning:** The MCP Layer asynchronously polls regional endpoints (e.g. `mock_mcp_client.py`).
2. **Threshold Rupture & Dispatch:** A massive rainfall variable passes exactly 15cm for Chennai. The `Monitor Agent` instantaneously registers the threshold rupture. It triggers the event state and queues a `GICGraphState` package.
3. **Data Verification:** The `Validation Agent` executes immediately confirming that over 50 workers from the system nodes belong inherently to the affected radius, passing validation logic.
4. **Vector Knowledge Appendment (RAG):** The `Context Agent` embeds queries retrieving localized parameter caps, slab maximums, and localized regional historical norms from `Pinecone`.
5. **Parallel Macro AI Evaluation (Layer 4):**
    - The **Fraud Agent** traces all 50 worker activity logs running Movement Realism logic identifying zero macroscopic fraud spikes.
    - The **Risk Agent** pulls XGBoost models verifying standard delivery risk.
    - The **Rules Agent** calculates the specific worker's 8-week history block checking for late penalties.
6. **Deterministic Mathematics Segment:** Time-series Math algorithms calculate Worker Z’s usual income (₹8000). His actual logs reflect (₹4500), breaching the 75% limit gap (₹6000 threshold point). The `PayoutOptimizationModel` computes his Slab 2 coverages modified by historical consistency data, finalizing a net ₹1200 delta.
7. **Synthesis & Rollout:** The `Decision Agent` pulls the Layer 4 strings, matching it alongside the deterministic math outputs, finalizing a completely structured JSON 
```JSON 
{decision: APPROVE, confidence: 91%, reason: parameters satisfied}
```

The API subsequently triggers the disbursement. The `SQLAgent` securely logs every node inference instantly onto Supabase.
