# 🏗️ ArchitectAI Studio — System Architecture Designer & Topology Mesh

[![Automated Tests](https://img.shields.io/badge/Tests-15%2F15%20Passing-brightgreen?style=for-the-badge&logo=node.js)](ai-architect-backend/test/)
[![Frontend Build](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite%208-blue?style=for-the-badge&logo=react)](ai-architect-frontend/)
[![Backend Architecture](https://img.shields.io/badge/Backend-Express%205%20%2B%20LangGraph-orange?style=for-the-badge&logo=express)](ai-architect-backend/)

> **System Architecture Designer, Microservice Topology Mesh & Bulk Ingestion Studio**  
> ArchitectAI Studio provides an AI-assisted system architecture design workspace and microservice topology modeling platform. It integrates a LangGraph multi-node state machine with a 3-panel reactive IDE to design architecture blueprints, generate SQL schemas, audit graph deadlocks via DFS cycle detection, evaluate single points of failure (SPOFs), simulate failure blast radius, manage microservice dependency corridors, execute in-browser SQLite WASM simulations, and spin up dynamic REST API mock servers.

---

## 📸 Platform Showcase

![Platform Hero Showcase](platform_hero_showcase.png)

---

## 🖥️ Desktop Showcase Gallery

### 1. Agent Workspace & Resiliency HUD
| Screen | Screenshot | Description |
|---|---|---|
| **System Designer Workspace** | ![System Designer Workspace](screenshots/desktop/01_desktop_autonomous_system_canvas.png) | 3-panel reactive IDE layout featuring live typewriter code generation, file tree navigation, execution timeline, and top SVG workflow state tracker. |
| **Resilience Auditor HUD** | ![Resilience Auditor HUD](screenshots/desktop/02_desktop_resilience_auditor_hud.png) | Topology resiliency auditor displaying DFS cyclic deadlock detection, single point of failure (SPOF) analysis, reachability-based percolation blast radius estimation, and SHA-256 certification digest. |

### 2. Architecture Topology Mesh & Bulk Ingestion Studio
| Screen | Screenshot | Description |
|---|---|---|
| **Architecture Topology Mesh** | ![Architecture Topology Mesh](screenshots/desktop/03_desktop_architecture_topology_mesh.png) | In-memory microservice dependency corridor manager displaying configured protocols (gRPC, HTTP/2, TCP SQL, Kafka Binary, WebSocket), latency, throughput, SLA attributes, aggregate metrics, and corridor severance controls. |
| **Bulk Ingestion Studio** | ![Bulk Ingestion Studio](screenshots/desktop/04_desktop_enterprise_ingestion_studio.png) | Ingestion studio supporting batch CSV and JSON imports for system nodes, dependency corridors, and topologies, with syntax buffer counters and universal purge controls. |

### 3. Live Endpoint Simulation, In-Browser WASM Database & Chaos Mode
| Screen | Screenshot | Description |
|---|---|---|
| **Live Mock Server Endpoint Manager** | ![Live Endpoint Manager](screenshots/desktop/05_desktop_live_endpoint_manager.png) | Dynamic Express mock server manager parsing endpoints from generated blueprints, serving synthetic data via `@faker-js/faker`, and enabling in-browser route testing. |
| **In-Browser WASM SQL Simulator** | ![WASM SQL Simulator](screenshots/desktop/06_desktop_wasm_sql_simulator.png) | In-browser SQLite WASM simulation engine via `sql.js` that translates PostgreSQL DDL, seeds mock data, and executes benchmark queries. |
| **Chaos Monkey Emergency Failover** | ![Chaos Monkey Red Alert](screenshots/desktop/07_desktop_chaos_monkey_red_alert.png) | Emergency failover view triggering the SRE agent node to generate fallback architectures with Redis caching and circuit breakers. |

---

## 🏛️ Core Features (Ground Truth)

### 1. 3-Panel Reactive Workspace & Workflow Tracker
- **3-Panel Layout**: Left panel displays project file trees and tool execution chips; center panel provides multi-tab syntax-highlighted code with typewriter animation (`useTypewriter`); right panel provides streaming Markdown chat.
- **Workflow State Machine Tracker**: Top SVG status bar visualizes LangGraph execution stages (`__start__`, `architectNode`, `tools`, `writerNode`, `__end__`) in real time.
- **Operating Modes**:
  - `Blueprint`: Generates complete distributed system architecture specifications.
  - `Analyzer`: Critiques designs with an actionable review and quality scorecard.
  - `Writer`: Formats architecture blueprints into structured technical documentation and ADRs.
  - `Scaffold`: Creates project file trees, dependency manifests, and configuration files.
- **Offline Demo Mode**: Replays pre-recorded SSE event streams (`demoData.js`) without requiring Google Gemini API tokens or network access.

### 2. LangGraph Agentic Orchestration (`ai-architect-backend`)
- **State Machine**: Built with `@langchain/langgraph` and `@langchain/google-genai` (Gemini 2.5 Flash), managing state across user prompts, tool calls, and agent transitions.
- **Dynamic Tool Calling**: Executes tools for documentation research (`fetch_api_structure`), SQL schema generation (`generate_database_schema`), and technical writing (`write_technical_documentation`).
- **Dynamic CAP Theorem Steering**: Slider controls consistency versus availability preference (`CP`, `balanced`, `AP`) and triggers live architecture re-generation.
- **Red Team Security Auditor**: Evaluates drafted blueprints for common security vulnerabilities (missing hashing, SQL injection risks, insecure tokens).
- **Algorithmic Complexity Auditor**: Analyzes Big O time complexities for database and API operations.
- **Chaos Monkey Trigger**: Injects a database failure state into the graph to activate the SRE agent node for emergency failover generation.
- **State Persistence**: Uses in-memory `MemorySaver` by default, with background support for `PostgresSaver` when `DATABASE_URL` is configured.

### 3. Distributed Resiliency & Topology Auditor
- **Deadlock Cycle Detection**: Traverses microservice directed graphs using Depth-First Search (DFS) recursion stacks to detect circular synchronous dependencies.
- **Single Point of Failure (SPOF) Discovery**: Evaluates node centrality (in-degree and out-degree) alongside replica counts to flag unreplicated critical nodes.
- **Percolation Blast Radius Analysis**: Simulates node removal reachability across all source-target pairs to calculate cascading failure percentages.
- **SHA-256 Certification Digest**: Generates a SHA-256 hash digest certifying topology audit results.
- **Built-in Presets**: Ships with pre-configured topologies for testing (High-Availability Tier-1 Checkout and Deadlock-Vulnerable Cyclic Mesh).

### 4. Microservice Dependency Corridors & Telemetry
- **In-Memory Corridor Store**: Tracks inter-service communication links between microservice tiers (Gateway, Compute, Cache, Database, Queue).
- **Corridor Attributes**: Stores protocol (`gRPC`, `HTTP2`, `TCP_SQL`, `Kafka_Binary`, `WebSocket`), bandwidth (Mbps), latency (ms), SLA percentage, and encryption standards.
- **Aggregate Metrics**: Calculates active corridor count, average hop latency, average SLA compliance percentage, and total throughput.
- **Interactive Controls**: Supports individual corridor severance, new route provisioning, and cascading node deletion (deleting a node severs all attached corridors).

### 5. Bulk Ingestion & Universal Purge Studio
- **Multi-Entity Ingestion**: Batch upload endpoints for System Nodes (`POST /api/architect/nodes/upload`), Dependency Corridors (`POST /api/architect/corridors/upload`), and Complete Topologies (`POST /api/architect/topology/upload`).
- **Dual Format Support**: Parses RFC 4180 CSV and JSON schemas with template loaders, buffer counters, and syntax validation.
- **Universal Purge Endpoints**: Provides cascade purge controls (`DELETE /api/architect/nodes`, `DELETE /api/architect/corridors`) to reset the topology state.

### 6. Dynamic Mock Server & In-Browser WASM Database
- **Dynamic Express Mock API**: Parses REST routes from generated blueprints and spawns a live Express mock server on an available port (4001+) serving synthetic data generated by `@faker-js/faker`.
- **In-Browser Route Tester**: Allows testing mock endpoints directly in the browser and inspecting response payloads.
- **In-Browser SQLite WASM Simulator**: Uses `sql.js` to execute generated SQL in WebAssembly, sanitizes PostgreSQL DDL into SQLite syntax, seeds up to 1,000 deterministic mock records per table, and measures benchmark query execution latency.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19 (`react` 19.2.5), Vite 8 (`vite` 8.0.10), Lucide React, React Markdown, Remark GFM, `sql.js` (WebAssembly SQLite) |
| **Backend** | Node.js, Express 5 (`express` 5.2.1), LangGraph (`@langchain/langgraph` 1.3.0), `@langchain/google-genai`, `@langchain/core`, Zod 4, `@faker-js/faker`, Opossum, `pg` (optional) |
| **Testing** | Node.js native test runner (`node --test`), `node:assert` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Google Gemini API Key**: Required for live AI agent execution

### 1. Clone the Repository
```bash
git clone https://github.com/Shashankcodelover/ArchitectAI-Studio.git
cd ArchitectAI-Studio
```

### 2. Backend Setup
```bash
cd ai-architect-backend
npm install
```

Create a `.env` file in `ai-architect-backend/`:
```env
GOOGLE_API_KEY=AIzaSy...
PORT=3035
GEMINI_MODEL=gemini-2.5-flash
# Optional:
# DATABASE_URL=postgresql://user:password@localhost:5432/architect_db
# TAVILY_API_KEY=tvly-...
```

Start the backend server:
```bash
npm run dev
# Server starts on http://localhost:3035
```

### 3. Frontend Setup
In a new terminal window:
```bash
cd ai-architect-frontend
npm install
npm run dev
# Frontend starts on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Testing

The backend includes automated test suites covering node lifecycle, cascading deletion, CSV ingestion, corridor metrics, DFS cycle detection, SPOF detection, and blast radius calculation:

```bash
cd ai-architect-backend
npm test
```

### Test Results
```
✔ ArchitectAI Studio v5.0: Enterprise Topology Corridors & Bulk Ingestion Engine (14.5ms)
  ✔ Node Lifecycle & Cascading Deletion
  ✔ Corridor Telemetry & Severing Controls
  ✔ Batch Ingestion (CSV & JSON)
✔ ArchitectAI Studio v5.0: Autonomous System Topology & Resiliency Auditor (9.2ms)
  ✔ retrieves architecture topology presets
  ✔ validates High-Availability E-Commerce checkout topology with zero deadlocks
  ✔ accurately flags synchronous cyclic deadlocks and reports loop path
  ✔ detects un-replicated Single Points of Failure (SPOFs) under high centrality
  ✔ computes percolation failure blast radius when primary hub drops
ℹ tests 15 | suites 5 | pass 15 | fail 0
```

To run a production frontend build:
```bash
cd ai-architect-frontend
npm run build
```

---

## 📁 User Flow Verification

![User Flow](docs/architect_studio_active_canvas_verified.png)
![User Flow](docs/architect_studio_code_complete_verified.png)
![User Flow](docs/architect_studio_overview_verified.png)
![User Flow](docs/arch_visualizer_verified.png)
