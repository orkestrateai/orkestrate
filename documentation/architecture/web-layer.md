# Web Layer

## Overview

The Web layer is the Next.js 15 frontend application that provides the user-facing dashboard, authentication flows, billing management, and landing pages for Orkestrate. It is a server-side rendered (SSR) React application built with the App Router.

## Architecture

### Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI Components | Radix UI + custom components |
| Styling | Tailwind CSS 4 |
| Animation | Motion + React Spring |
| 3D Graphics | Three.js / React Three Fiber |
| Auth | Supabase Auth |
| Data Fetching | SWR |
| Database | Supabase PostgreSQL (via `@supabase/ssr`) |
| ORM | Drizzle ORM |
| Payments | Razorpay |

### Directory Structure

```
src/app/
├── api/                    # API routes (MCP, auth, payments, etc.)
├── auth/                   # Authentication pages
├── dashboard/              # Dashboard pages (authenticated)
│   ├── billing/           # Billing & subscription management
│   ├── knowledge-base/    # Knowledge base editor
│   ├── settings/          # User & workspace settings
│   ├── workspaces/        # Workspace management
│   └── page.tsx          # Main dashboard
├── login/                  # Login page
├── oauth/                  # OAuth callback handlers
├── pricing/               # Pricing page
├── changelog/             # Changelog page
├── docs/                  # Documentation page
├── whitepaper/            # Whitepaper page
├── layout.tsx            # Root layout
├── page.tsx              # Landing page
└── globals.css           # Global styles
```

### Key Pages

#### Landing Page (`/`)
- Hero section with BackgroundShader (Three.js)
- Features showcase
- Pricing information
- Call-to-action for sign-up

#### Dashboard (`/dashboard`)
- Workspace listing with search
- Quick access to active workspaces
- Create new workspace button

#### Workspace View (`/dashboard/workspaces/[id]`)
- Active agents list
- Real-time state updates via Supabase Realtime
- Scope claims visualization
- Agent session management

#### Knowledge Base (`/dashboard/knowledge-base`)
- Hierarchical folder/document view
- Markdown editor for documents
- Search across all documents
- CRUD operations for docs

#### Settings (`/dashboard/settings`)
- Profile settings
- Workspace configuration
- Member management
- API key management

## Component Architecture

### Components Directory

```
src/components/
├── auth/           # Authentication-related components
├── brand/          # Brand assets (logos, etc.)
├── dashboard/      # Dashboard-specific components
│   └── Sidebar.tsx
├── marketing/      # Marketing pages components
├── ui/             # Shared UI primitives
├── BackgroundShader.tsx  # Three.js background
└── DocsLayout.tsx       # Documentation layout
```

### UI Primitives

Built with Radix UI and styled with Tailwind CSS:
- Buttons with variants (default, outline, ghost)
- Cards for content containers
- Dialogs and modals
- Form inputs
- Navigation components
- Tables for data display

## Authentication Flow

### OAuth Integration

1. User clicks "Sign in with GitHub/Google"
2. Redirect to Supabase Auth
3. OAuth callback handled at `/oauth/callback`
4. Session stored in HTTP-only cookies via `@supabase/ssr`
5. User redirected to dashboard

### Supabase SSR Flow

```typescript
// Client-side client
import { createSupabaseBrowserClient } from '@/utils/supabase/client'

// Server-side client
import { createSupabaseServerClient } from '@/utils/supabase/server'

// Admin client for API routes
import { createServiceClient } from '@/lib/supabase'
```

### Middleware Protection

`src/middleware.ts` handles:
- CSP (Content Security Policy) with nonces
- Rate limiting
- Request proxying
- Session validation

## Real-time Features

### Supabase Realtime Subscriptions

Dashboard subscribes to database changes:

```typescript
const supabase = createSupabaseBrowserClient()
const channel = supabase
  .channel('workspace-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'agent_states',
    filter: `workspaceId=eq.${workspaceId}`
  }, handleAgentStateChange)
  .subscribe()
```

### Workspace Live Updates

- Agent state changes broadcast instantly
- New agent sessions trigger notifications
- Scope claims updates reflected in real-time
- Knowledge base changes sync across clients

## Database Schema (Frontend Perspective)

### Frontend-Visible Entities

```typescript
// Workspace
interface Workspace {
  id: string
  name: string
  ownerUserId: string
  repoUrl?: string
  defaultBranch: string
  maxAgents: number
  maxMembers: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Agent Session
interface AgentSession {
  id: string
  agentId: string
  workspaceId: string
  status: 'active' | 'ended'
  normalizedRemote?: string
  branchAtJoin?: string
  headShaAtJoin?: string
  toolNameRaw?: string
  startedAt: Date
  lastMessageAt: Date
}

// Agent State
interface AgentState {
  id: string
  sessionId: string
  workspaceId: string
  status: 'active' | 'idle' | 'blocked' | 'planning' | 'handoff' | 'done'
  objective: string
  footprint: string[]
  plan: string[]
  completed: string[]
  notes: string
  gitRemote?: string
  gitBranch?: string
  gitHeadSha?: string
}

// Knowledge Document
interface KnowledgeDoc {
  id: string
  workspaceId: string
  title: string
  description: string
  content: string
  parentId: string | null
  isFolder: boolean
  createdAt: Date
  updatedAt: Date
}
```

## API Integration

### Dashboard API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workspaces` | GET | List user's workspaces |
| `/api/workspaces` | POST | Create new workspace |
| `/api/workspaces/[id]` | GET | Get workspace details |
| `/api/workspaces/[id]` | PATCH | Update workspace |
| `/api/workspaces/[id]` | DELETE | Delete workspace |
| `/api/workspace-members` | GET | List workspace members |
| `/api/workspace-members` | POST | Add member |
| `/api/knowledge` | GET/POST | Knowledge base operations |
| `/api/payments` | POST | Payment processing |

### Knowledge Base API

```typescript
// Fetch documents
const res = await fetch('/api/knowledge', {
  headers: { Authorization: `Bearer ${session.access_token}` }
})
const { docs } = await res.json()

// Search documents
const res = await fetch('/api/knowledge?query=auth&workspaceId=ws_xxx', {
  headers: { Authorization: `Bearer ${session.access_token}` }
})
```

## Styling System

### Tailwind CSS 4

Using Tailwind CSS 4 with:
- CSS variables for theming
- `@apply` for component patterns
- Just-in-time compilation

### Design Tokens

```css
/* globals.css */
@theme {
  --color-background: #050505
  --color-foreground: #ffffff
  --color-muted: #18181b
  --color-border: rgba(255, 255, 255, 0.05)
}
```

### Animation System

Using Motion (formerly Framer Motion):

```typescript
import { motion } from 'motion/react'

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
/>
```

### 3D Background

React Three Fiber for immersive hero section:

```typescript
import { Canvas } from '@react-three/fiber'
import { BackgroundShader } from '@/components/BackgroundShader'
```

## Deployment

### Vercel Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/mcp/route.ts": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | Public site URL |
| `RAZORPAY_KEY_ID` | Razorpay API key |
| `DATABASE_URL` | PostgreSQL connection string |

### Edge Functions

- `/api/mcp` - MCP coordination endpoint
- `/middleware.ts` - CSP, rate limiting, proxying

## Performance Optimizations

### React Server Components

- Dashboard pages are Server Components by default
- Client components marked with `'use client'`
- Reduced JavaScript bundle size

### Image Optimization

- Next.js Image component for all images
- WebP format with fallbacks
- Responsive srcset

### Caching Strategy

```typescript
// API routes
return NextResponse.json(data, {
  headers: { 'Cache-Control': 'no-store' }
})
```

### Bundle Analysis

```bash
# Analyze bundle size
bunx @next/bundle-analyzer
```

## Security

### Content Security Policy

```typescript
// middleware.ts
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
`
```

### Rate Limiting

Implemented in middleware:
- 100 requests per minute per IP for API routes
- 1000 requests per minute for dashboard pages

### Input Validation

- Zod schemas for API request validation
- TypeScript for compile-time safety
- Sanitized HTML in markdown rendering

## Testing

### Component Testing

```typescript
// __tests__/Dashboard.test.tsx
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

test('shows workspaces', () => {
  render(<DashboardPage />)
  expect(screen.getByText('Your Workspaces')).toBeInTheDocument()
})
```

### E2E Testing

Using Playwright for critical flows:
- Sign-up/sign-in
- Workspace creation
- Agent connection
- Knowledge base operations

## Future Enhancements

### Planned Features

- Real-time collaborative cursors in dashboard
- WebSocket-based live agent communication
- Enhanced 3D workspace visualizations
- Advanced search with vector embeddings
- Mobile-responsive dashboard