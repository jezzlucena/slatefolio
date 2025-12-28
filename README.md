# Slatefolio

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.4.7-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![Node](https://img.shields.io/badge/Node-LTS-339933)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248)

**A beautiful, open-source, self-hosted portfolio platform for creative professionals.**

[Features](#features) • [Quick Start](#quick-start) • [Configuration](#configuration) • [Usage](#usage) • [Tech Stack](#tech-stack) • [License](#license)

</div>

---

## Overview

Slatefolio is a modern, full-stack portfolio platform designed for developers, designers, and creative professionals who want complete control over their online presence. Built with Next.js 15 and Express, it provides a stunning visual experience with interactive sacred geometry backgrounds, multilingual support, and a powerful admin dashboard.

Self-host your portfolio with Docker, manage your projects through an intuitive CMS, and showcase your work with elegant animations and responsive design.

## Features

- 🎨 **Interactive Visual Design** — Mesmerizing sacred geometry animations with hover and click effects
- 🌍 **Multilingual Support** — Built-in i18n with English, Spanish, and Portuguese
- 📱 **Fully Responsive** — Optimized for all devices and screen sizes
- 🔐 **Secure Admin Panel** — Password + WebAuthn/Passkey authentication
- 📝 **Rich Content Management** — Markdown editor for project descriptions
- 🖼️ **Media Management** — Image and video uploads with automatic optimization
- 📄 **Resume Builder** — Upload and manage your downloadable resume
- 💬 **Testimonials** — Showcase client and colleague endorsements
- 📧 **Contact Form** — SMTP-powered contact form with email notifications
- 🐳 **Docker Ready** — One-command deployment with Docker Compose

## Quick Start

### Prerequisites

- [Docker](https://www.docker.com/get-started) and Docker Compose
- A domain (for production) or localhost (for development)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/slatefolio.git
cd slatefolio
```

### 2. Create Environment File

Create a `.env` file in the root directory:

```bash
cp .env.example .env  # if available, or create manually
```

See [Configuration](#configuration) for all environment variables.

### 3. Start with Docker Compose

**Development (with hot-reloading):**
```bash
docker compose up -d
```

**Production:**
```bash
docker compose -f docker-compose.yml up -d
```

### 4. Access the Application

- **Portfolio:** http://localhost:8080
- **Admin Panel:** http://localhost:8080/admin

On first visit to `/admin`, you'll be prompted to create your admin account.

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT token signing (use a strong random string) | `your-super-secret-jwt-key-min-32-chars` |
| `FRONTEND_PORT` | Port for the Next.js frontend | `8080` |
| `BACKEND_PORT` | Port for the Express backend | `5050` |
| `NEXT_PUBLIC_BACKEND_URL` | Public URL of the backend API | `http://localhost:5050` |

#### WebAuthn (Passkey Authentication)

| Variable | Description | Example |
|----------|-------------|---------|
| `WEB_NAME` | Relying Party name displayed during passkey registration | `Slatefolio` |
| `WEB_ID` | Your domain (without protocol) | `localhost` or `yourdomain.com` |
| `WEB_ORIGIN` | Full origin URL | `http://localhost:8080` |

#### Email (Contact Form)

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_SECURE` | Use TLS (`true` for port 465) | `false` |
| `SMTP_USER` | SMTP username/email | `your-email@gmail.com` |
| `SMTP_PASS` | SMTP password or app password | `your-app-password` |
| `SMTP_FROM_EMAIL` | Sender email address | `noreply@yourdomain.com` |
| `CONTACT_EMAIL` | Email to receive contact submissions | `you@yourdomain.com` |

#### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `UPLOADS_URL` | Public URL path for uploaded files | `/uploads` |
| `NEXT_PUBLIC_SOURCE` | Source identifier for analytics | — |

### Example `.env` File

```env
# Application
FRONTEND_PORT=8080
BACKEND_PORT=5050
NEXT_PUBLIC_BACKEND_URL=http://localhost:5050

# Security
JWT_SECRET=change-this-to-a-very-long-random-string-at-least-32-characters

# WebAuthn (Passkeys)
WEB_NAME=Slatefolio
WEB_ID=localhost
WEB_ORIGIN=http://localhost:8080

# Email (optional - for contact form)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
CONTACT_EMAIL=you@yourdomain.com
```

## Usage

### Admin Dashboard

Access the admin panel at `/admin` to manage your portfolio:

1. **First-Time Setup:** Create your admin account with username, email, and password
2. **Profile:** Edit your bio, title, location, social links, and skills
3. **Projects:** Add, edit, and reorder your portfolio projects
4. **Testimonials:** Manage client and colleague testimonials
5. **Resume:** Upload your downloadable resume/CV
6. **Settings:** Register passkeys for passwordless authentication

### Authentication

Slatefolio supports two authentication methods:

- **Password:** Traditional username/password login
- **Passkeys (WebAuthn):** Passwordless authentication using biometrics, security keys, or device PIN

After initial setup, you can register passkeys in the admin settings for enhanced security.

### Managing Projects

Each project supports:
- Localized title and description (Markdown supported)
- Multiple images and video thumbnails
- Tech stack and platform tags
- External links (demo, source code, etc.)
- Featured/hidden status
- Custom ordering

### Internationalization

Add or modify translations in `apps/frontend/messages/`:
- `en.json` — English
- `es.json` — Spanish
- `pt.json` — Portuguese

The locale switcher automatically appears in the UI.

## Tech Stack

### Frontend
- [Next.js 15](https://nextjs.org/) — React framework with App Router
- [TypeScript](https://www.typescriptlang.org/) — Type-safe JavaScript
- [SCSS Modules](https://sass-lang.com/) — Scoped component styling
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS framework
- [next-intl](https://next-intl-docs.vercel.app/) — Internationalization

### Backend
- [Express.js](https://expressjs.com/) — Node.js web framework
- [MongoDB](https://www.mongodb.com/) — Document database
- [Mongoose](https://mongoosejs.com/) — MongoDB ODM
- [SimpleWebAuthn](https://simplewebauthn.dev/) — WebAuthn/Passkey authentication
- [Sharp](https://sharp.pixelplumbing.com/) — Image processing

### Infrastructure
- [Docker](https://www.docker.com/) — Containerization
- [pnpm](https://pnpm.io/) — Fast, disk-efficient package manager
- Monorepo architecture with pnpm workspaces

## Project Structure

```
slatefolio/
├── apps/
│   ├── backend/          # Express.js API server
│   │   ├── src/
│   │   │   ├── controllers/  # Route handlers
│   │   │   ├── middleware/   # Auth middleware
│   │   │   └── models/       # Mongoose schemas
│   │   └── scripts/      # Database seed scripts
│   └── frontend/         # Next.js application
│       ├── src/
│       │   ├── app/          # App Router pages
│       │   ├── components/   # React components
│       │   ├── contexts/     # React contexts
│       │   ├── hooks/        # Custom hooks
│       │   └── types/        # TypeScript types
│       ├── messages/     # i18n translations
│       └── public/       # Static assets
├── docker-compose.yml        # Production compose
├── docker-compose.override.yml  # Development overrides
└── pnpm-workspace.yaml   # Monorepo config
```

## Development

### Local Development with Docker

```bash
# Start all services (with hot-reloading)
docker compose up -d

# View logs
docker compose logs -f

# Rebuild after dependency changes
docker compose up -d --build

# Stop all services
docker compose down
```

### Seeding Data

Populate the database with sample data:

```bash
# Enter the backend container
docker compose exec backend sh

# Run seed scripts
npx ts-node scripts/populate-profile.ts
npx ts-node scripts/populate-projects.ts
npx ts-node scripts/populate-testimonials.ts
```

## Deployment

### Production with Docker Compose

1. Set production values in your `.env`:
   - Use your actual domain for `WEB_ID` and `WEB_ORIGIN`
   - Set a strong `JWT_SECRET`
   - Configure SMTP for contact form

2. Run production compose:
   ```bash
   docker compose -f docker-compose.yml up -d
   ```

3. Configure your reverse proxy (nginx, Caddy, Traefik) to:
   - Serve the frontend on ports 80/443
   - Proxy `/api` requests to the backend
   - Handle SSL termination

### Volumes

Docker Compose creates two persistent volumes:
- `mongo_data` — MongoDB database
- `uploads_data` — Uploaded media files

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [Jezz Lucena](https://github.com/jezzlucena)**

</div>
