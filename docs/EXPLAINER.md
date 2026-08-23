# EXPLAINER: AI Architect (Visual Tool Editor with Agent)

## 1. Project Overview & "In and Out" (ELI15/20)
**AI Architect** is an end-to-end agentic visual prototyping pipeline. It is designed to stop developers from "vibe coding"—which is writing code using random AI prompt adjustments without planning ahead, leading to buggy codebases that nobody understands.
Instead of translating raw prompts directly into code, AI Architect forces a structured quality control process:
- **In**: A developer enters a prompt (e.g. "I want to add a Stripe billing API").
- **Processing**:
  1. **Planner Agent**: Interviews the user to clarify details (which payment gateway? refund limits?).
  2. **Context Search**: Uses PostgreSQL `pgvector` to scan existing code for coding styles and database rules.
  3. **Visual Blueprinting**: Generates a text-to-diagram visual chart (using D2 or Mermaid.js format) mapping the system architecture.
  4. **Human Breakpoint**: Halts the process. The developer can edit the boxes and wires on screen. No code is generated until the human clicks "Approve".
  5. **Implementer Agent**: Runs in an isolated Docker container sandbox to write clean, matching code.
  6. **Verifier Agent**: Audits the code against security and logging guidelines before final merging.
- **Out**: A visually mapped dashboard, signed Architectural Decision Records (MADRs), and a clean GitHub Pull Request containing the approved code.

---

## 2. Tech Stack & Decision Analysis (Why this, not that?)

| Component | Technology | Why we chose it | Why NOT the alternatives? |
| :--- | :--- | :--- | :--- |
| **Orchestrator** | **LangGraph & CrewAI** | LangGraph handles state loops and human interruption nodes easily, while CrewAI spins up role-specific specialists (Architect, Implementer, Auditor). | **LangChain AgentExecutor**: Legacy linear executor that cannot handle cyclical tasks, multi-agent debates, or human validation breakpoints. |
| **Context DB** | **PostgreSQL + pgvector** | Native support for both relational data (users, logs) and high-speed semantic vector matching using L2 distance calculations. | **ChromaDB / Pinecone**: Vector-only databases. Storing operational user logs requires setting up a separate database, creating complex cross-database queries. |
| **Repository Parser**| **Tree-sitter (Python)** | Parses repository files into Abstract Syntax Trees (ASTs), indexing only function headers and class imports. Eliminates context-window token bloat. | **Raw Text Scanners**: Reading full files to find coding patterns wastes thousands of dollars in AI API token costs. |
| **Frontend Canvas**| **React & Excalidraw MCP**| Allows physical drag-and-drop box updates, compiling edits directly back into the underlying D2 syntax. | **Static Images**: Forcing developers to read text plan outputs defeats the purpose of visual system architecting. |

---

## 3. 10x Upgrade Blueprint (Developing to Version 8.0 - 10.0)

To transition this prototyping tool into a production-grade automated enterprise developer ecosystem:

### A. Core Upgrades
1. **Self-Evolving Workflow Synthesis**: Analyze recurring compilation/verification failures to dynamically inject coding hints and instructions into the AI Implementer's system instructions.
2. **Bidirectional Git Sync Engine**: A background listener that tracks manual commits, updates the system database models, and generates matching Mermaid drawings in the repo automatically.
3. **Automated Integration Test Runner**: Deploy generated code to transient Kubernetes test namespaces and run end-to-end integration tests using automated QA agents.

### B. Upgraded Code structure & Backend Logic
Here is the upgraded LangGraph orchestrator script with human-in-the-loop validation:

```python
# tool-editor-with-agent/ai-architect-backend/orchestrator.py
from typing import TypedDict, List
from langgraph.graph import StateGraph, END

# 1. Define global agentic workflow state
class AgentState(TypedDict):
    prompt: str
    requirements: dict
    blueprint_d2: str
    code_diff: str
    review_punchlist: List[str]
    status: str

# 2. Define state nodes
def planner_node(state: AgentState):
    print("Planner Agent clarifying requirements...")
    return {"requirements": {"gateway": "Stripe", "max_limit": 500}, "status": "planning_done"}

def blueprint_node(state: AgentState):
    print("Generating system.d2 diagram schema...")
    d2_code = "API_Gateway -> WebhookHandler\nWebhookHandler -> DB"
    return {"blueprint_d2": d2_code, "status": "pending_human_review"}

def implementer_node(state: AgentState):
    print("Implementer writing code diff in sandbox container...")
    return {"code_diff": "+ app.post('/webhook', verifySignature);", "status": "code_ready"}

def verifier_node(state: AgentState):
    print("Auditing security compliance...")
    # Adversarial verification logic
    if "verifySignature" not in state["code_diff"]:
        return {"review_punchlist": ["Signature verification missing!"], "status": "rejected"}
    return {"status": "approved"}

# 3. Compile the Graph with human approval breakpoints
workflow = StateGraph(AgentState)
workflow.add_node("planner", planner_node)
workflow.add_node("blueprinter", blueprint_node)
workflow.add_node("implementer", implementer_node)
workflow.add_node("verifier", verifier_node)

workflow.set_entry_point("planner")
workflow.add_edge("planner", "blueprinter")

# Pause execution at blueprinter for human dashboard feedback
workflow.add_conditional_edges(
    "blueprinter",
    lambda state: "human_gate" if state["status"] == "pending_human_review" else "implementer",
    {"human_gate": END, "implementer": "implementer"}
)

workflow.add_edge("implementer", "verifier")
workflow.add_conditional_edges(
    "verifier",
    lambda state: "implementer" if state["status"] == "rejected" else END,
    {"implementer": "implementer", END: END}
)

app = workflow.compile()
```
