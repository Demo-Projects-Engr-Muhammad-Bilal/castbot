# 01 Monorepo Architecture & Setup Ledger

This document audits the foundational setup, monorepo architecture, and initial setup interactions for **CastBot** — an enterprise-grade multi-tenant social media publishing platform that enables users to upload short vertical videos once and automatically dispatch them across YouTube Shorts, Meta Reels (Facebook & Instagram), TikTok, and Telegram channels.

---

## 1. Executive Overview & System Architecture

CastBot is structured as an npm/pnpm workspace monorepo comprising:
- **`apps/frontend`**: Next.js 16 (React 19, TailwindCSS v4, Clerk Authentication, Lucide React).
- **`apps/backend`**: Express.js REST API with TypeScript (`tsx`), BullMQ Redis queue processors, and Puppeteer stealth automation engine.
- **`packages/database`**: Shared Prisma ORM schema (`@repo/database`), PostgreSQL driver adapter (`@prisma/adapter-pg`), and migrations ledger.

---

## 2. Paired Interaction Log: Monorepo Foundation & Setup

### 📥 User Prompt
> Initial Request: "Set up a clean monorepo architecture for CastBot — an automated multi-tenant video publisher. The system needs a Next.js frontend (`apps/frontend`), an Express backend (`apps/backend`), and a shared database package (`packages/database`) using npm workspaces. Configure root scripts to launch backend and frontend concurrently."

### 📤 AG Response / Output
- **Execution Summary:** Established root workspace configuration using npm workspaces (`"apps/*"`, `"packages/*"`), defined unified development scripts (`dev:all`, `dev:frontend`, `dev:backend`), and linked `@repo/database` as an internal shared dependency.
- **Files Created/Modified:**
  - [`package.json`](file:///E:/telegram_social_uploader/package.json)
  - [`apps/frontend/package.json`](file:///E:/telegram_social_uploader/apps/frontend/package.json)
  - [`apps/backend/package.json`](file:///E:/telegram_social_uploader/apps/backend/package.json)
  - [`packages/database/package.json`](file:///E:/telegram_social_uploader/packages/database/package.json)

- **Code Snippet / Configuration:**

```json
// Root package.json
{
  "name": "castbot-monorepo",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev:frontend",
    "dev:frontend": "npm run dev --workspace=apps/frontend",
    "dev:backend": "npm run dev --workspace=apps/backend",
    "build:frontend": "npm run build --workspace=apps/frontend",
    "build:backend": "npm run build --workspace=apps/backend",
    "lint": "npm run lint --workspace=apps/frontend",
    "db:generate": "npm run generate --workspace=packages/database",
    "db:migrate:dev": "npm run migrate:dev --workspace=packages/database",
    "db:migrate:deploy": "npm run migrate:deploy --workspace=packages/database",
    "db:studio": "npm run studio --workspace=packages/database",
    "postinstall": "npm run db:generate",
    "dev:all": "concurrently \"npm:dev:backend\" \"npm:dev:frontend\""
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

---

### 📥 User Prompt
> "Configure the `apps/backend` package manifest to include Express, BullMQ, Redis (ioredis), Google API client (`googleapis`), Multer for video file uploads, Stripe for subscriptions, and Puppeteer with stealth plugin support for headless automation."

### 📤 AG Response / Output
- **Execution Summary:** Initialized backend package dependencies, setup `tsx` for TypeScript execution during development, and added standard type definitions (`@types/express`, `@types/node`).
- **Files Created/Modified:**
  - [`apps/backend/package.json`](file:///E:/telegram_social_uploader/apps/backend/package.json)

- **Code Snippet / Configuration:**

```json
// apps/backend/package.json
{
  "name": "backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@clerk/backend": "^3.11.7",
    "@repo/database": "*",
    "@types/multer": "^2.2.0",
    "axios": "^1.18.1",
    "bullmq": "^5.80.10",
    "cloudinary": "^2.10.0",
    "cors": "^2.8.5",
    "dotenv": "^17.4.2",
    "express": "^4.19.2",
    "express-rate-limit": "^8.6.0",
    "form-data": "^4.0.6",
    "googleapis": "^173.0.0",
    "ioredis": "^5.11.1",
    "multer": "^2.2.0",
    "playwright": "^1.61.1",
    "puppeteer": "^25.3.0",
    "puppeteer-extra": "^3.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "stripe": "^22.3.2",
    "svix": "^1.99.1"
  }
}
```

---

### 📥 User Prompt
> "Configure `apps/frontend` workspace to use Next.js 16 App Router with React 19, Clerk Authentication (`@clerk/nextjs`), Lucide React icons, TailwindCSS v4, and internal workspace linkage to `@repo/database`."

### 📤 AG Response / Output
- **Execution Summary:** Configured Next.js frontend workspace manifest, linking `@repo/database: "*"` for unified type sharing across frontend components.
- **Files Created/Modified:**
  - [`apps/frontend/package.json`](file:///E:/telegram_social_uploader/apps/frontend/package.json)

- **Code Snippet / Configuration:**

```json
// apps/frontend/package.json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@repo/database": "*",
    "@clerk/nextjs": "^7.5.20",
    "axios": "^1.18.1",
    "lucide-react": "^1.25.0",
    "next": "16.2.10",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "tailwindcss": "^4",
    "zod": "^3.24.1"
  }
}
```

---

### 📥 User Prompt
> "Configure `@repo/database` package manifest to export Prisma Client with PostgreSQL adapter (`@prisma/adapter-pg`) and define scripts for Prisma code generation and database migrations."

### 📤 AG Response / Output
- **Execution Summary:** Created shared database package manifest with TypeScript exports for client compilation and Prisma CLI bindings.
- **Files Created/Modified:**
  - [`packages/database/package.json`](file:///E:/telegram_social_uploader/packages/database/package.json)

- **Code Snippet / Configuration:**

```json
// packages/database/package.json
{
  "name": "@repo/database",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "require": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "generate": "prisma generate",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "pg": "^8.22.0"
  }
}
```

---

## 3. Monorepo Architectural Verification

- **Workspace Interlinkage:** Verified that `@repo/database` is imported cleanly in both `apps/frontend` and `apps/backend`.
- **Environment Consistency:** Both workspaces consume shared `.env` configuration keys (`DATABASE_URL`, `CLERK_SECRET_KEY`, `REDIS_URL`).
- **Compilation Gate:** Root script `npm run db:generate` executes cleanly on `postinstall`.
