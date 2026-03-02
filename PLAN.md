# BiseoCore — Project Plan

**Personal AI Assistant**  
**Stack:** Node.js (NestJS) · TypeScript · Gemini (multi-model later)  
**Started:** March 2026

---

## Vision

BiseoCore is a personal AI assistant built on a clean, extensible Node.js backend. It starts with a simple chat interface powered by Google Gemini and is architected from day one to support multiple AI models, tools, and integrations without major rewrites.

---

## Milestones

### Phase 1 — Foundation
> Goal: Working chat API with Gemini, module-first Clean Architecture scaffold

- [ ] Initialize NestJS project with TypeScript
- [ ] Create `src/modules/chat/` module scaffold with `domain/`, `application/`, `infrastructure/`, `presentation/` sub-folders
- [ ] Create `src/shared/` for config, filters, and interceptors
- [ ] Define `Conversation` and `Message` domain entities (`modules/chat/domain/`)
- [ ] Define `IModelProvider` and `IConversationRepository` port interfaces (`modules/chat/application/ports/`)
- [ ] Implement `SendMessageUseCase` (`modules/chat/application/use-cases/`)
- [ ] Implement `GeminiProvider` (`modules/chat/infrastructure/ai/gemini/`)
- [ ] Implement `InMemoryConversationRepository` (`modules/chat/infrastructure/persistence/in-memory/`)
- [ ] Wire all layers via NestJS DI tokens inside `chat.module.ts`
- [ ] Create `ChatController` + request/response DTOs (`modules/chat/presentation/`)
- [ ] Configure environment variables (`.env`) for API keys via `shared/config/`
- [ ] Add input validation with `class-validator`
- [ ] Write unit tests for use cases (domain + application, zero infrastructure deps)
- [ ] Dockerize the application

### Phase 2 — Conversation Quality
> Goal: Coherent multi-turn conversations

- [ ] Enrich `Conversation` aggregate with history management (domain logic, no I/O)
- [ ] Add context window token trimming inside the domain entity
- [ ] Support system prompt configuration via `SendMessageUseCase` input
- [ ] Add `GetConversationUseCase` (application layer)
- [ ] Add streaming response support (SSE) — stream adapter in infrastructure
- [ ] Add rate limiting and global error-handling filter in presentation layer

### Phase 3 — Multi-Model Support
> Goal: Swap or mix AI providers seamlessly

- [ ] `IModelProvider` port already defined in Phase 1 — no domain/application changes needed
- [ ] Add `OpenAIProvider` (infrastructure adapter)
- [ ] Add `AnthropicProvider` (infrastructure adapter)
- [ ] Add `OllamaProvider` for local models (infrastructure adapter)
- [ ] Add `ModelProviderFactory` (infrastructure) — resolves correct adapter by model name
- [ ] Expose model selection in the API via presentation DTO → passed into use case

### Phase 4 — Persistence & Identity
> Goal: Conversations survive restarts; user context matters

- [ ] Add `PostgresConversationRepository` implementing `IConversationRepository` (infrastructure swap — zero application/domain changes)
- [ ] Define TypeORM ORM entities (infrastructure only, mapped to domain entities)
- [ ] Add `DeleteConversationUseCase` (application layer)
- [ ] User identity — API key auth guard in presentation layer (JWT Phase 5+)
- [ ] Conversation list and delete REST endpoints (presentation layer)

### Phase 5 — Frontend (Optional)
> Goal: Usable chat UI

- [ ] Create a minimal web chat interface (React or vanilla HTML)
- [ ] Connect to streaming API
- [ ] Support conversation history sidebar
- [ ] Model selector dropdown

---

## Architecture Overview

BiseoCore follows **Modular Clean Architecture** — modules are the top-level organizers, and Clean Architecture layers (domain → application → infrastructure → presentation) live **inside** each module. Dependencies point strictly inward within a module.

```
src/modules/
└── chat/                  ← module boundary
    ├── domain/            ← Layer 1  pure TypeScript, no framework
    ├── application/       ← Layer 2  use cases + port interfaces
    ├── infrastructure/    ← Layer 3  implements ports (AI, DB, etc.)
    └── presentation/      ← Layer 4  controllers, DTOs, guards

src/shared/                ← cross-module utilities (config, filters, interceptors)
```

**Dependency rule:** `presentation` → `infrastructure` → `application` → `domain`. No layer imports from a layer outside its module.

### Layer Responsibilities (per module)

| Layer | Path inside module | Contents | Framework dependency |
|---|---|---|---|
| **Domain** | `domain/` | Entities, value objects, domain errors | None — pure TypeScript |
| **Application** | `application/` | Use cases, port interfaces (`IConversationRepository`, `IModelProvider`) | None |
| **Infrastructure** | `infrastructure/` | `GeminiProvider`, `InMemoryRepo`, `PostgresRepo`, `ModelProviderFactory` | NestJS, TypeORM, SDKs |
| **Presentation** | `presentation/` | Controllers, request/response DTOs, guards | NestJS |

### Folder Structure

Modules are the **top-level organizers**. Each module owns all four Clean Architecture layers internally. Cross-module sharing lives in `shared/`. This keeps features self-contained and independently scalable.

```
biseocore/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── modules/
│   │   │
│   │   ├── chat/                                     # Chat feature module
│   │   │   ├── chat.module.ts                        # NestJS module — wires DI
│   │   │   │
│   │   │   ├── domain/                               # Layer 1 — pure TypeScript, no deps
│   │   │   │   ├── entities/
│   │   │   │   │   ├── conversation.entity.ts        # Aggregate root
│   │   │   │   │   └── message.entity.ts
│   │   │   │   ├── value-objects/
│   │   │   │   │   └── model-name.vo.ts
│   │   │   │   └── errors/
│   │   │   │       └── chat.errors.ts
│   │   │   │
│   │   │   ├── application/                          # Layer 2 — depends on domain only
│   │   │   │   ├── ports/
│   │   │   │   │   ├── conversation.repository.port.ts  # IConversationRepository
│   │   │   │   │   └── model-provider.port.ts           # IModelProvider
│   │   │   │   └── use-cases/
│   │   │   │       ├── send-message/
│   │   │   │       │   ├── send-message.use-case.ts
│   │   │   │       │   └── send-message.dto.ts
│   │   │   │       └── get-conversation/
│   │   │   │           ├── get-conversation.use-case.ts
│   │   │   │           └── get-conversation.dto.ts
│   │   │   │
│   │   │   ├── infrastructure/                       # Layer 3 — implements ports
│   │   │   │   ├── ai/
│   │   │   │   │   ├── gemini/
│   │   │   │   │   │   └── gemini.provider.ts        # implements IModelProvider
│   │   │   │   │   ├── openai/                       # Phase 3
│   │   │   │   │   │   └── openai.provider.ts
│   │   │   │   │   ├── anthropic/                    # Phase 3
│   │   │   │   │   │   └── anthropic.provider.ts
│   │   │   │   │   ├── ollama/                       # Phase 3
│   │   │   │   │   │   └── ollama.provider.ts
│   │   │   │   │   └── model-provider.factory.ts     # resolves provider by model name
│   │   │   │   └── persistence/
│   │   │   │       ├── in-memory/                    # Phase 1–2
│   │   │   │       │   └── in-memory-conversation.repository.ts
│   │   │   │       └── postgres/                     # Phase 4
│   │   │   │           ├── conversation.orm-entity.ts
│   │   │   │           └── postgres-conversation.repository.ts
│   │   │   │
│   │   │   └── presentation/                         # Layer 4 — HTTP interface
│   │   │       ├── chat.controller.ts
│   │   │       ├── dto/
│   │   │       │   ├── send-message.request.dto.ts
│   │   │       │   └── send-message.response.dto.ts
│   │   │       └── guards/
│   │   │           └── api-key.guard.ts
│   │   │
│   │   └── health/                                   # Health-check module
│   │       ├── health.module.ts
│   │       └── presentation/
│   │           └── health.controller.ts
│   │
│   └── shared/                                       # Cross-module shared code
│       ├── config/
│       │   └── app.config.ts
│       ├── filters/
│       │   └── global-exception.filter.ts
│       └── interceptors/
│           └── logging.interceptor.ts
│
├── test/
│   ├── unit/
│   │   └── modules/
│   │       └── chat/
│   └── e2e/
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

**Rule:** a module may only import from `shared/`. It must **never** import directly from another module's internals — inter-module communication goes through NestJS module exports or shared ports.

---

## Tech Decisions

| Concern            | Choice                          | Reason                                   |
|--------------------|---------------------------------|------------------------------------------|
| Architecture       | Clean Architecture              | Stable core; swap infra without touching business logic |
| Framework          | NestJS                          | Modular, TypeScript-first, deep DI support |
| Primary AI         | Google Gemini (`gemini-2.0-flash`) | Free tier, strong capability           |
| AI abstraction     | `IModelProvider` port           | Add/swap providers in infra only         |
| Persistence abstraction | `IConversationRepository` port | Swap in-memory → Postgres in Phase 4 |
| Validation         | `class-validator` + `class-transformer` | Presentation-layer DTOs only       |
| Config management  | `@nestjs/config`                | `.env` support with type safety          |
| Testing            | Jest                            | Unit-test use cases with no real infra   |
| Containerization   | Docker + docker-compose         | Portable, reproducible environment       |
| Database (Phase 4) | PostgreSQL + TypeORM            | Relational, TypeScript-friendly ORM      |

---

## API Design (Phase 1–2)

### `POST /chat`
Send a message and receive a reply.

**Request:**
```json
{
  "message": "What is the capital of France?",
  "conversationId": "optional-uuid",
  "model": "gemini-2.0-flash"
}
```

**Response:**
```json
{
  "reply": "The capital of France is Paris.",
  "conversationId": "uuid",
  "model": "gemini-2.0-flash"
}
```

### `GET /chat/:conversationId` _(Phase 4)_
Retrieve full conversation history.

### `DELETE /chat/:conversationId` _(Phase 4)_
Delete a conversation.

---

## Out of Scope (for now)

- Voice input/output
- Document ingestion / RAG
- Task & calendar management
- Mobile app

These can be considered for a Phase 6+ based on usage and need.
