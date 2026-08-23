# 📋 JIRA TRACKER — ArchitectAI Studio (Visual Tool & System Architecture Engine)

## 📌 Project Aim & Modern World Relevance
ArchitectAI Studio is an agentic system design studio and visual tool editor. It allows developers to specify software architecture on a visual canvas (e.g. databases, route paths, handlers) and lets an AI agent container generate the actual code files. Real-time collaboration allows multiple developers to design diagrams simultaneously.

---

## 🔍 Identified Loopholes & Missing Features (Current State)
* **Single User Mode**: The server processes user inputs but lacks WebSocket rooms to broadcast real-time design nodes between multiple designers editing the same workspace.

---

## 🛠️ V20 Upgrade Action Checklist

- [x] **Task 1**: Create `collaborative_state.js` inside `ai-architect-backend/` to implement real-time coordination handlers.
- [x] **Task 2**: Implement simulated memory lock mechanisms to prevent concurrent developers from overwriting each other's visual nodes.
- [x] **Task 3**: Verify compile correctness and execution flow.

---

## 🔮 Next-Level Upgrades (Upcoming Ideas for V21)
- [x] **Task 4**: Integrate a local sandbox code compiler/runner directly in the canvas view to execute generated endpoints.
- [x] **Task 5**: Build an interactive Git diff viewer showing side-by-side edits of files changed by the AI agent.
- [x] **Task 6**: Add automated unit test generation stubs that write test suites verifying user-drawn schema configurations.
- [x] **Task 7**: Add diagram connectivity validation rules.
- [x] **Task 8**: Add architectural schema JSON exporter.
- [x] **Task 9**: Add real-time active user telemetry status dashboard.

---

## 🚦 Status Summary
- **Overall Status**: Completed ✅
- **Completed**: Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9
- **Pending**: None
