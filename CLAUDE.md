# CLAUDE.md - AI Assistant Guide for Slatefolio

This document provides essential context for AI assistants working with the Slatefolio codebase.

## Project Overview

**Slatefolio** is a self-hosted portfolio platform for creative professionals. It's a full-stack monorepo with a Next.js 15 frontend and Express.js backend, using MongoDB for data storage.

**Version**: 0.4.7
**License**: MIT
**Architecture**: pnpm workspaces monorepo

## Quick Reference

### Essential Commands

```bash
# Development (with hot-reload)
docker compose up -d

# Production
docker compose -f docker-compose.yml up -d

# View logs
docker compose logs -f

# Rebuild after dependency changes
docker compose up -d --build

# Stop services
docker compose down

# Frontend only
cd apps/frontend && pnpm dev

# Backend only
cd apps/backend && pnpm start

# Linting
cd apps/frontend && pnpm lint
cd apps/backend && pnpm lint
```

### Key Ports

- Frontend: 8080
- Backend: 5050
- MongoDB: 27017

## Project Structure

```
slatefolio/
├── apps/
│   ├── backend/                    # Express.js API server
│   │   ├── src/
│   │   │   ├── controllers/        # Route handlers
│   │   │   ├── middleware/         # Auth middleware
│   │   │   ├── models/             # Mongoose schemas
│   │   │   ├── app.ts              # Express app & routes
│   │   │   ├── db.ts               # MongoDB connection
│   │   │   └── email.ts            # Nodemailer config
│   │   ├── scripts/                # DB seed scripts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                   # Next.js 15 application
│       ├── src/
│       │   ├── app/                # App Router (locale-based)
│       │   ├── components/         # React components
│       │   ├── contexts/           # React contexts (AuthContext)
│       │   ├── hooks/              # Custom hooks
│       │   ├── i18n/               # next-intl configuration
│       │   ├── stores/             # Zustand stores
│       │   ├── types/              # TypeScript definitions
│       │   ├── utils/              # Utilities & constants
│       │   └── middleware.ts       # Next.js middleware
│       ├── messages/               # i18n translations (en, es, pt)
│       ├── public/                 # Static assets
│       ├── Dockerfile
│       ├── next.config.ts
│       └── tsconfig.json
│
├── docker-compose.yml              # Production config
├── docker-compose.override.yml     # Dev overrides (hot-reload)
├── pnpm-workspace.yaml             # Monorepo config
└── .env.example                    # Environment template
```

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15 | React framework (App Router) |
| React | 19 | UI library |
| TypeScript | 5.8+ | Type safety |
| SCSS Modules | — | Scoped component styling |
| Tailwind CSS | 4 | Utility classes |
| Zustand | 5.0.9 | Global state management |
| next-intl | 4.1.0 | Internationalization |
| @uiw/react-md-editor | 4.0.5 | Markdown editing |
| @simplewebauthn/browser | 11.0.0 | Passkey authentication |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Express.js | 4.21.2 | Web framework |
| TypeScript | 5.8+ | Type safety |
| Mongoose | 8.9.3 | MongoDB ODM |
| jsonwebtoken | 9.0.2 | JWT authentication |
| bcryptjs | 2.4.3 | Password hashing |
| @simplewebauthn/server | 11.0.0 | Passkey verification |
| Multer | 1.4.5 | File uploads |
| Sharp | 0.33.5 | Image processing |
| Nodemailer | 6.9.16 | Email sending |

## Key Patterns and Conventions

### Backend Patterns

#### Controller Pattern

Controllers are async functions that handle HTTP requests:

```typescript
// apps/backend/src/controllers/example.ts
export const getItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await Model.findById(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
```

#### Mongoose Model Pattern

```typescript
// apps/backend/src/models/Example.ts
import mongoose, { Document, Schema } from 'mongoose';

interface IExample extends Document {
  name: LocalizedString;
  key: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExampleSchema = new Schema<IExample>({
  name: { type: LocalizedStringSchema, required: true },
  key: { type: String, required: true, unique: true }
}, { timestamps: true });

export default mongoose.model<IExample>('Example', ExampleSchema);
```

#### LocalizedString Schema

All user-facing text uses the LocalizedString pattern for i18n:

```typescript
interface LocalizedString {
  en: string;
  es: string;
  pt: string;
}

const LocalizedStringSchema = new Schema({
  en: { type: String, required: true },
  es: { type: String, required: true },
  pt: { type: String, required: true }
}, { _id: false });
```

#### Auth Middleware

Protected routes use `requireAuth` middleware:

```typescript
// apps/backend/src/middleware/auth.ts
interface AuthRequest extends Request {
  user?: IUser;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // JWT verification from cookies
  // User lookup in database
  // Attach user to request
};
```

### Frontend Patterns

#### Component Structure

Each component has its own directory with module styles:

```
components/
└── ComponentName/
    ├── ComponentName.tsx
    └── ComponentName.module.scss
```

```typescript
// ComponentName.tsx
import styles from './ComponentName.module.scss';

export default function ComponentName() {
  return <div className={styles.container}>...</div>;
}
```

#### Client Components

Interactive components require the `'use client'` directive:

```typescript
'use client';

import { useState } from 'react';

export default function InteractiveComponent() {
  const [state, setState] = useState(initialValue);
  // ...
}
```

#### Zustand Store Pattern

```typescript
// apps/frontend/src/stores/exampleStore.ts
import { create } from 'zustand';

interface ExampleStore {
  data: DataType | null;
  hasFetched: boolean;
  fetchData: () => Promise<void>;
}

const useExampleStore = create<ExampleStore>((set, get) => ({
  data: null,
  hasFetched: false,
  fetchData: async () => {
    if (get().hasFetched) return;
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/endpoint`);
    const data = await response.json();
    set({ data, hasFetched: true });
  }
}));

// Convenient hook wrapper
export function useExample() {
  const { data, fetchData } = useExampleStore();
  useEffect(() => { fetchData(); }, [fetchData]);
  return data;
}
```

#### i18n Usage

```typescript
import { useTranslations, useLocale } from 'next-intl';

export default function Component() {
  const t = useTranslations('namespace');
  const locale = useLocale();

  return <p>{t('key')}</p>;
}
```

#### API Calls Pattern

```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/endpoint`, {
  method: 'POST',
  credentials: 'include', // Required for cookies/auth
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

### Styling Conventions

1. **SCSS Modules** for component-specific styles
2. **Tailwind** for utility classes and responsive design
3. **BEM-ish naming** within SCSS (nesting, no suffixes)
4. **Breakpoints**: 480px (mobile), 768px (tablet)

## API Endpoint Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get portfolio profile |
| GET | `/projects` | List all projects |
| GET | `/projects/:key` | Get single project |
| GET | `/testimonials` | List testimonials |
| GET | `/testimonials/:key` | Get single testimonial |
| GET | `/resume/active` | Get active resume info |
| GET | `/resume/file/:id` | Download resume file |
| GET | `/files/:id` | Serve uploaded files |
| GET | `/meta` | Site metadata |
| POST | `/contact` | Submit contact form |

### Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/status` | Check auth status |
| POST | `/auth/register` | Register first admin |
| POST | `/auth/login` | Password login |
| POST | `/auth/logout` | Logout |
| POST | `/auth/passkey/register-options` | Start passkey registration |
| POST | `/auth/passkey/register` | Complete passkey registration |
| POST | `/auth/passkey/login-options` | Start passkey login |
| POST | `/auth/passkey/login` | Complete passkey login |

### Admin Endpoints (Require Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/admin/profile` | Upsert profile |
| POST | `/admin/projects` | Create project |
| PUT | `/admin/projects/:key` | Update project |
| DELETE | `/admin/projects/:key` | Delete project |
| POST | `/admin/testimonials` | Create testimonial |
| PUT | `/admin/testimonials/:key` | Update testimonial |
| DELETE | `/admin/testimonials/:key` | Delete testimonial |
| POST | `/admin/resumes` | Upload resume |
| GET | `/admin/resumes` | List resumes |
| PUT | `/admin/resumes/:id/activate` | Set active resume |
| DELETE | `/admin/resumes/:id` | Delete resume |
| POST | `/admin/upload` | Upload file |
| DELETE | `/admin/upload` | Delete file |

## Data Models

### Profile (Singleton)

```typescript
interface Profile {
  name: LocalizedString;        // Required
  blurb: LocalizedString;       // Required - short bio
  role: LocalizedString;        // Required - job title
  company?: LocalizedString;    // Optional
  keywords: string[];           // Skills/technologies
  linkedin?: string;
  github?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  profileImageUrl?: string;
}
```

### Project

```typescript
interface Project {
  key: string;                  // Unique identifier
  name: LocalizedString;
  description: LocalizedString;
  company?: LocalizedString;
  role?: LocalizedString;
  year: number;
  platforms: string[];
  stack: string[];
  thumbImgUrl: string;          // Required thumbnail
  thumbVideoUrl?: string;
  thumbGifUrl?: string;
  behanceUrl?: string;
  videoUrl?: string;
  githubUrl?: string;
  liveDemoUrl?: string;
}
```

### Testimonial

```typescript
interface Testimonial {
  key: string;                  // Unique identifier
  author: string;               // Plain string (not localized)
  text: LocalizedString;
  company?: string;
  role?: string;
  imageUrl?: string;
}
```

### User

```typescript
interface User {
  username: string;             // 3-30 chars, unique
  email: string;                // Unique, lowercase
  passwordHash: string;         // bcrypt
  passkeys: Passkey[];          // WebAuthn credentials
  currentChallenge?: string;    // Temp for WebAuthn flow
}
```

## Important Files to Know

### Configuration

| File | Purpose |
|------|---------|
| `.env` | Environment variables (create from .env.example) |
| `pnpm-workspace.yaml` | Monorepo package definitions |
| `docker-compose.yml` | Production Docker configuration |
| `docker-compose.override.yml` | Development overrides |
| `apps/frontend/next.config.ts` | Next.js configuration |
| `apps/frontend/tsconfig.json` | Frontend TypeScript config |
| `apps/backend/tsconfig.json` | Backend TypeScript config |

### Core Application Files

| File | Purpose |
|------|---------|
| `apps/backend/src/app.ts` | Express app setup & all routes |
| `apps/backend/src/db.ts` | MongoDB connection |
| `apps/frontend/src/middleware.ts` | Next.js middleware (i18n) |
| `apps/frontend/src/contexts/AuthContext.tsx` | Auth state management |
| `apps/frontend/src/i18n/routing.ts` | i18n locale configuration |

## Common Development Tasks

### Adding a New API Endpoint

1. Create controller in `apps/backend/src/controllers/`
2. Add model in `apps/backend/src/models/` if needed
3. Register route in `apps/backend/src/app.ts`
4. Add `requireAuth` middleware if protected

### Adding a New Page

1. Create directory in `apps/frontend/src/app/[locale]/`
2. Add `page.tsx` (and optionally `layout.tsx`)
3. Use `'use client'` if interactive
4. Add translations in `apps/frontend/messages/*.json`

### Adding a New Component

1. Create directory in `apps/frontend/src/components/`
2. Add `ComponentName.tsx` and `ComponentName.module.scss`
3. Export from component file

### Adding a Translation

1. Add key to all three files in `apps/frontend/messages/`:
   - `en.json`
   - `es.json`
   - `pt.json`
2. Use with `useTranslations('namespace')`

### Modifying Database Schema

1. Update model in `apps/backend/src/models/`
2. Update TypeScript types in `apps/frontend/src/types/`
3. Handle migration if needed (MongoDB is schemaless but code changes)

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT signing key (min 32 chars) |
| `FRONTEND_PORT` | Next.js port (default: 8080) |
| `BACKEND_PORT` | Express port (default: 5050) |
| `NEXT_PUBLIC_BACKEND_URL` | Backend URL for API calls |
| `MONGODB_URI` | MongoDB connection string |

### WebAuthn/Passkey

| Variable | Description |
|----------|-------------|
| `WEB_NAME` | Relying party name |
| `WEB_ID` | Domain (localhost or yourdomain.com) |
| `WEB_ORIGIN` | Full origin URL |

### Email (Optional)

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server |
| `SMTP_PORT` | SMTP port |
| `SMTP_SECURE` | Use TLS |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM_EMAIL` | Sender email |
| `CONTACT_EMAIL` | Recipient for contact form |
| `NEXT_PUBLIC_SMTP_ENABLED` | Enable contact form |

### CORS

| Variable | Description |
|----------|-------------|
| `HOST_ALLOWLIST` | Comma-separated allowed origins |
| `ENVIRONMENT` | development or production |

## Code Style Guidelines

1. **TypeScript**: Use strict typing, avoid `any`
2. **Async/Await**: Prefer over callbacks and raw promises
3. **Error Handling**: Use try-catch in controllers, return appropriate HTTP status codes
4. **Naming**: camelCase for variables/functions, PascalCase for components/types
5. **Imports**: Group by external, internal, relative
6. **Components**: One component per file, export default
7. **API Responses**: JSON format with consistent structure

## Testing

Currently no test framework is configured. The backend package.json shows a placeholder test script:

```json
"test": "echo \"Error: no test specified\" && exit 1"
```

When adding tests, consider:
- Jest or Vitest for unit tests
- Supertest for API integration tests
- React Testing Library for component tests

## Security Notes

1. **Authentication**: JWT in httpOnly cookies, bcrypt with 12 salt rounds
2. **CORS**: Configured via HOST_ALLOWLIST environment variable
3. **Passkeys**: WebAuthn for passwordless authentication
4. **File Uploads**: Validated and processed with Sharp
5. **Contact Form**: Rate limiting recommended for production

## Docker Development Tips

```bash
# Enter backend container shell
docker compose exec backend sh

# Enter frontend container shell
docker compose exec frontend sh

# View specific service logs
docker compose logs -f backend
docker compose logs -f frontend

# Run database seed scripts
docker compose exec backend npx ts-node scripts/populate-profile.ts

# Check MongoDB
docker compose exec mongo mongosh
```

## Troubleshooting

### Hot-reload not working

1. Ensure `docker-compose.override.yml` is being used (default for `docker compose up`)
2. Check WATCHPACK_POLLING is set in override file
3. Verify volumes are mounted correctly

### Auth issues

1. Check JWT_SECRET is set and consistent
2. Verify WEB_ID and WEB_ORIGIN match your domain
3. Check cookies are being set (credentials: 'include')

### CORS errors

1. Add origin to HOST_ALLOWLIST (comma-separated, no spaces)
2. Verify NEXT_PUBLIC_BACKEND_URL is correct
3. Check backend is running and accessible

### Database connection

1. Verify MONGODB_URI is correct
2. Check MongoDB container is running: `docker compose ps`
3. Check logs: `docker compose logs mongo`
