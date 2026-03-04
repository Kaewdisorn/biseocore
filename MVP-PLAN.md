# BiseoCore MVP Plan

> 8-week roadmap to launch a monetizable personal AI assistant

**Goal**: Ship a focused product with 3-5 core features, get 10 paying beta users, validate product-market fit.

---

## 🎯 Phase 1: Core MVP (Weeks 1-8)

### Must-Have Features

#### 1. User Authentication ✅
**Status**: In progress (see TODO-USER-REGISTRATION.md)

**Scope**:
- Email/password registration & login
- JWT-based session management
- Password reset flow
- Basic profile management

**Why Critical**: Foundation for all user-specific features

---

#### 2. AI Chat with Memory 🔥
**Priority**: CRITICAL | **Effort**: Medium | **Revenue Impact**: High

**Scope**:
- Multi-turn conversational AI
- Persistent chat history (save to PostgreSQL)
- Context-aware responses (load last 10 messages)
- Single AI model: **Gemini API** (generous free tier: 60 req/min)

**Features**:
```
POST /chat/message
GET /chat/history?limit=50
DELETE /chat/history (clear conversation)
```

**AI Prompt Template**:
```
You are {user.name}'s personal AI assistant. 

User preferences: {user.preferences}

Recent conversation context:
{last_10_messages}

Respond naturally and helpfully to: {user_message}
```

**Why Critical**: This is the core differentiator. Everything else supports this.

---

#### 3. Task Manager (Lightweight)
**Priority**: HIGH | **Effort**: Low | **Revenue Impact**: High

**Scope**:
- CRUD operations for tasks
- Fields: title, description, due_date, priority (HIGH/MEDIUM/LOW), completed
- Filter by: status, priority, due date
- **AI Integration**: "Create task from this message" button in chat UI

**API Endpoints**:
```
POST /tasks              - Create task
GET /tasks               - List tasks (with filters)
PATCH /tasks/:id         - Update task
DELETE /tasks/:id        - Delete task
POST /tasks/:id/complete - Mark complete
```

**Why Critical**: Creates daily retention. Users return to check/complete tasks.

---

#### 4. Daily Briefing
**Priority**: HIGH | **Effort**: Low | **Revenue Impact**: High

**Scope**:
- Automated morning summary (8 AM user timezone)
- Content: Today's tasks, overdue items, AI-generated greeting
- Delivery: Email (use nodemailer + SendGrid/Mailgun)
- Cron job: `@nestjs/schedule`

**Example Format**:
```
Good morning {name}! 🌅

TODAY'S TASKS (3)
• [HIGH] Finish MVP plan document - Due today
• [MED] Review authentication code
• [LOW] Update README

OVERDUE (1)
• Set up database schema - Due 2 days ago

AI Insight: You have a lighter day today. Consider tackling that 
overdue task first thing!

---
Reply to this email to chat with your AI assistant.
```

**Why Critical**: Habit-forming. Daily touchpoint = high engagement = conversions.

---

## 🚫 Explicitly NOT Building in MVP

Cut these to ship faster (add in Phase 2 based on feedback):

- ❌ **Email Integration** - Complex OAuth, email parsing, security concerns
- ❌ **Calendar** - Google Calendar API integration is time-consuming
- ❌ **Workflows/Automation** - Scope creep, complex logic
- ❌ **Document Q&A** - Requires vector database (Pinecone/Weaviate)
- ❌ **Web Search** - API costs (SerpAPI, Brave Search)
- ❌ **Multiple AI Models** - Increases complexity and cost
- ❌ **Contact Manager** - Not core to AI assistant value prop
- ❌ **Advanced Notifications** - Daily briefing is enough for MVP
- ❌ **Mobile App** - Web-first, mobile later
- ❌ **Knowledge Base** - Complex wiki functionality
- ❌ **Journal** - Nice-to-have, not critical
- ❌ **Health Tracking** - Too broad, lose focus
- ❌ **Integrations** (Notion, Slack, GitHub) - Post-MVP

**Rule**: If a feature doesn't directly support chat + tasks + daily briefing, cut it.

---

## 💎 Phase 2: Differentiation (Weeks 9-12)

**After validating MVP with 10 paying users**, add ONE feature:

### Option A: AI Memory System (Recommended)
**The Moat**: Competitors can't replicate this easily

**Concept**: Store structured user preferences/habits for AI to reference

**Implementation**:
```typescript
// user_preferences table
{
  user_id: uuid
  key: string        // e.g., "work_schedule", "dietary_preference"
  value: jsonb       // e.g., {"type": "vegetarian"}
  learned_at: timestamp
  confidence: float  // 0.0 - 1.0
}
```

**Examples**:
- "User prefers tasks in the morning"
- "User is vegetarian"
- "User has standing meetings Monday 2pm"
- "User's main project: BiseoCore"

**AI extracts these during conversations** and references them later:
> You: "Suggest lunch spots"  
> AI: "Since you're vegetarian, here are 3 plant-based cafes nearby..."

**Why This Wins**: Makes switching costs HIGH. User invests time teaching the AI.

---

### Option B: Email Integration
**High Value, Higher Complexity**

**Scope**:
- OAuth with Gmail/Outlook
- Fetch unread emails
- AI summarization in chat
- Draft replies with AI assistance

**Why Later**: OAuth flows, security, email parsing = 3-4 weeks minimum

---

## 🏗️ Technical Architecture

### Tech Stack

```
Backend
├── Framework: NestJS (TypeScript)
├── Database: PostgreSQL 15+
├── ORM: TypeORM
├── Auth: JWT (passport-jwt)
├── AI: Google Generative AI SDK (@google/generative-ai)
├── Email: nodemailer + SendGrid
├── Scheduling: @nestjs/schedule (cron)
└── Validation: class-validator, class-transformer

Frontend
├── Framework: Next.js 14+ (App Router) or React + Vite
├── Styling: Tailwind CSS
├── State: React Query (TanStack Query)
├── Forms: React Hook Form + Zod
└── UI Components: shadcn/ui (optional, speeds up development)

DevOps
├── Deployment: Railway.app or Render
├── Database: Railway PostgreSQL (free tier: 100MB)
├── Env Management: dotenv / NestJS ConfigModule
└── CI/CD: GitHub Actions (optional for MVP)
```

### Database Schema (Core Tables)

```sql
-- users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  daily_briefing_time TIME DEFAULT '08:00:00',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- chat_messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  tokens_used INT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);

-- tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  due_date DATE,
  priority VARCHAR(10) DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_date, completed);
```

### Module Structure (Clean Architecture)

```
src/
├── main.ts
├── app.module.ts
└── modules/
    ├── auth/
    │   ├── domain/           # Entities, Value Objects, Errors
    │   ├── application/      # Use Cases, DTOs
    │   ├── infrastructure/   # Repositories, External Services
    │   └── presentation/     # Controllers, Guards
    ├── chat/
    │   ├── domain/
    │   ├── application/
    │   │   ├── use-cases/
    │   │   │   ├── send-message.use-case.ts
    │   │   │   └── get-chat-history.use-case.ts
    │   │   └── services/
    │   │       └── gemini-ai.service.ts
    │   ├── infrastructure/
    │   │   └── repositories/
    │   │       └── typeorm-chat.repository.ts
    │   └── presentation/
    │       └── chat.controller.ts
    ├── tasks/
    │   ├── domain/
    │   ├── application/
    │   ├── infrastructure/
    │   └── presentation/
    └── notifications/
        ├── application/
        │   └── services/
        │       ├── daily-briefing.service.ts
        │       └── email.service.ts
        └── presentation/
            └── notifications.controller.ts (for webhooks if needed)
```

---

## 📆 8-Week Timeline

### Week 1-2: Foundation
- [x] Project setup (done)
- [ ] Complete user authentication (following TODO-USER-REGISTRATION.md)
- [ ] Set up TypeORM with PostgreSQL
- [ ] Configure environment variables
- [ ] Set up basic frontend scaffold (login/register pages)
- [ ] Deploy to Railway/Render (staging environment)

**Deliverable**: Users can register, login, logout

---

### Week 3-4: AI Chat
- [ ] Install Gemini SDK: `npm install @google/generative-ai`
- [ ] Create chat module (domain, application, infrastructure, presentation)
- [ ] Implement chat message endpoints (POST /chat/message, GET /chat/history)
- [ ] Build chat UI (simple messages list + input box)
- [ ] Add context loading (last 10 messages)
- [ ] Handle errors (rate limits, API failures)

**Deliverable**: Users can have multi-turn conversations with AI

---

### Week 5-6: Task Manager + AI Integration
- [ ] Create tasks module
- [ ] Implement CRUD endpoints
- [ ] Build tasks UI (list view, create form, filters)
- [ ] Add "Create task from chat" feature:
  - AI detects task intent in messages
  - Shows "Create Task" button in chat
  - Pre-fills form with AI-extracted data
- [ ] Task completion flow

**Deliverable**: Users can manage tasks, AI can suggest tasks from conversation

---

### Week 7: Daily Briefing
- [ ] Install scheduling: `npm install @nestjs/schedule`
- [ ] Set up email service (SendGrid/Mailgun)
- [ ] Create daily briefing cron job (runs 8 AM user timezone)
- [ ] Email template design
- [ ] Test with multiple timezones
- [ ] Add user settings (enable/disable, change time)

**Deliverable**: Users receive daily morning summary

---

### Week 8: Polish + Launch Prep
- [ ] Landing page (what it does, pricing, signup CTA)
- [ ] Integrate Stripe (subscription billing)
- [ ] Free vs Pro tier enforcement
- [ ] Basic analytics (track: signups, chat messages, tasks created)
- [ ] Documentation (API docs, user guide)
- [ ] Security audit (basic: SQL injection, XSS, CSRF)
- [ ] Performance testing (can handle 100 users?)

**Deliverable**: Ship to 10 beta users

---

## 💰 Pricing Strategy

### Free Tier (Always Free)
**Target**: Trial users, hobbyists, evangelists

**Limits**:
- 50 AI chat messages/month
- 20 active tasks max
- Daily briefing enabled
- 1 user account
- Chat history: 30 days

**Goal**: Let users experience value, hook them, convert to Pro

---

### Pro Tier: $12/month
**Target**: Power users, professionals

**Features**:
- ✅ Unlimited AI chat messages
- ✅ Unlimited tasks
- ✅ Daily briefing with AI insights
- ✅ Priority support (24hr response)
- ✅ Chat history: Forever
- ✅ Phone support (if needed)

**Future additions (Phase 2)**:
- ✅ AI memory system
- ✅ Email integration
- ✅ Calendar integration

**Goal**: $120/year per user. Get 10 users = $1,440 ARR = validation

---

### Enterprise (Future)
- Custom deployment
- Team collaboration
- SSO/SAML
- SLA guarantees
- $50-100/user/year

---

## 🧪 Success Metrics (Validation Checklist)

**Ship MVP at Week 8, then measure for 4 weeks:**

### Usage Metrics
- [ ] **10+ active weekly users** (logs in 3+ times/week)
- [ ] **Chat engagement**: Average 10+ messages/user/week
- [ ] **Task usage**: 50%+ of users create tasks via AI
- [ ] **Daily briefing**: 60%+ open rate
- [ ] **Retention**: 40%+ weekly retention (come back next week)

### Revenue Metrics
- [ ] **3+ paying users** at $12/month = $36 MRR
- [ ] **30%+ free-to-paid conversion** (3 of 10 users)
- [ ] **Activation rate**: 70%+ of signups send 1st message within 24hrs

### Qualitative Validation
- [ ] **1+ user says**: "I can't go back to [competitor]"
- [ ] **Users ask for**: Specific new features (validates need)
- [ ] **NPS > 50**: Users recommend to friends

**If you hit these metrics, you have product-market fit.** Invest more time. Otherwise, pivot or cut features.

---

## 🚀 Go-to-Market Strategy

### Beta Launch (Week 8)
**Goal**: 10 users

**Channels**:
1. **Personal network** (5 users) - Friends, colleagues, family who need productivity tools
2. **Reddit** (3 users) - r/Productivity, r/SideProject, r/ADHD
3. **Product Hunt** (2 users) - Soft launch, "we're in beta"
4. **Twitter/X** - Build in public, share progress

**Messaging**: 
> "I built an AI assistant that actually remembers your context. Free beta for the first 10 users who want to try it."

---

### Post-Validation (Week 12+)
**Goal**: 100 users, $1,200 MRR

**Channels**:
1. **SEO** - Blog posts: "Best AI assistant for ADHD", "Personal AI tools"
2. **Content marketing** - Case studies from beta users
3. **Paid ads** - Google Ads, Facebook (target: productivity, ADHD, entrepreneurs)
4. **Partnerships** - ADHD coaches, productivity bloggers

---

## 💡 Key Decisions & Trade-offs

### Why Gemini over OpenAI?
- **Cost**: Free tier is 60 req/min (OpenAI free tier is limited)
- **Quality**: Gemini 1.5 Flash is fast and good enough for conversational AI
- **Flexibility**: Can switch to OpenAI later if needed

### Why Web-First, Not Mobile?
- **Speed**: Web app ships in 8 weeks. Mobile adds 4-6 weeks
- **Iteration**: Faster to iterate on web
- **MVP goal**: Validate willingness to pay, not platform preference

### Why No Email Integration in MVP?
- **Complexity**: OAuth, email parsing, security = 3-4 weeks
- **Risk**: If users don't pay for core chat + tasks, email won't save it
- **Strategy**: Add it in Phase 2 after validation

### Why PostgreSQL over MongoDB?
- **Simplicity**: Relational data (users, tasks) fits SQL better
- **Familiarity**: Most developers know PostgreSQL
- **Cost**: Railway/Render have generous free tiers

---

## 🎬 Your Next Actions (This Week)

1. **Finish authentication** - Complete TODO-USER-REGISTRATION.md checklist
2. **Set up database** - PostgreSQL on Railway/Render
3. **Install Gemini SDK** - `npm install @google/generative-ai`
4. **Scaffold frontend** - Next.js or React + Vite
5. **Create chat module** - Follow Clean Architecture like auth module

---

## 📚 Resources

### Gemini API
- [Google AI Studio](https://ai.google.dev/) - Get API key
- [Quickstart Guide](https://ai.google.dev/gemini-api/docs/quickstart?lang=node)

### Deployment
- [Railway](https://railway.app/) - Free tier: 500 hours/month, PostgreSQL included
- [Render](https://render.com/) - Free tier: PostgreSQL 90 days, then $7/month

### Payment Processing
- [Stripe](https://stripe.com/) - Subscription billing, 2.9% + $0.30 per transaction

### Email Service
- [SendGrid](https://sendgrid.com/) - Free tier: 100 emails/day
- [Mailgun](https://www.mailgun.com/) - Free tier: 5,000 emails/month (first 3 months)

---

## 🎯 Remember

> "The best way to predict the future is to ship it."

- **Perfect is the enemy of shipped** - Launch at Week 8 even if incomplete
- **Talk to users weekly** - Their feedback > your assumptions
- **One feature at a time** - Resist scope creep
- **Validate before scaling** - 10 paying users first, then 100

**You can do this. Start with auth, then chat, then tasks. Ship in 8 weeks. Good luck! 🚀**

---

*Last updated: March 4, 2026*
