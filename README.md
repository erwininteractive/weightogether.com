# WeighTogether

A weight loss tracking application with social features, built from the ground up with TypeScript, Express, and PostgreSQL.

![Build Status](https://github.com/erwininteractive/weightloss.watch/actions/workflows/deploy.yml/badge.svg)

## Features

### Core Tracking

- **Weight Tracking** - Log weight entries with body composition metrics (body fat %, muscle mass, measurements)
- **Progress Photos** - Upload and attach photos to weight entries
- **Charts & Analytics** - Visual progress tracking with interactive Chart.js graphs
- **Unit System** - Support for both Imperial (lbs/inches) and Metric (kg/cm) units

### Social Features

- **Teams** - Create and join teams for collaborative tracking
- **Posts** - Share updates, milestones, tips, and motivation
- **Comments & Likes** - Engage with community posts
- **Real-time Messaging** - Direct messages with Socket.io
- **Team Roles** - Owner, Admin, Moderator, and Member permissions
- **Privacy Controls** - Private, team-only, or public weight entries

### Challenges & Achievements

- **Challenges** - Team-based and global weight loss challenges
- **Challenge Types** - Weight loss, consistency, muscle gain, body fat reduction
- **Achievements** - Milestone tracking and badges (5 lbs lost, 10 lbs lost, streaks, etc.)
- **Leaderboards** - Track progress within teams and challenges

### User Experience

- **Authentication** - Dual auth system: JWT for API, HTTP-only cookies for web
- **Email Verification** - Secure account activation flow
- **Password Reset** - Email-based password recovery
- **Profile Management** - Customizable profiles with avatars
- **Dark/Light Mode** - Theme preference with system detection
- **Responsive Design** - Mobile-first design with TailwindCSS 4

### Administration

- **Admin Panel** - User and content management
- **User Management** - View, edit, suspend, and manage accounts
- **Activity Monitoring** - Track user activity and system health

## Design Philosophy

### Why No Framework?

WeighTogether is intentionally built without heavy full-stack frameworks like Next.js, Nuxt, or Rails. Instead, it's hand-rolled using Express as a minimal foundation. This approach provides:

- **Full Control** - No framework abstractions or magic; every piece of code is intentional and understandable
- **Learning Value** - Great reference for understanding how web applications work at a fundamental level
- **Flexibility** - Easy to customize without fighting framework conventions
- **Lightweight** - No unnecessary dependencies or bloat
- **Longevity** - Less susceptible to framework churn and breaking changes

### Architecture Decisions

**MVC Pattern**: Clean separation of concerns with controllers handling HTTP requests, services containing business logic, and Prisma managing data access. Views are server-rendered EJS templates.

```
Request → Logger → LoadUser → Auth Middleware → Controller → Service → Prisma → Response
```

**Static Methods**: Controllers and services use static methods rather than class instances. This keeps the code simple and avoids unnecessary object instantiation.

```typescript
// Controllers use static methods with validation arrays
class WeightController {
    static validation = [body("weight").isFloat({ min: 50, max: 1000 })];
    static async log(req: Request, res: Response) { ... }
}

// Services are stateless
class AuthService {
    static async hashPassword(password: string) { ... }
    static async verifyToken(token: string) { ... }
}
```

**Dual Authentication**: Web routes use HTTP-only cookies with automatic refresh for security and UX. API routes use Bearer tokens for programmatic access.

**Server-Side Rendering**: EJS templates with a master layout system. Alpine.js adds interactivity where needed without the complexity of a SPA.

**View Partials**: The layout is decomposed into reusable partials for maintainability:

| Partial                  | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `_head.ejs`              | Meta tags, favicons, Open Graph, fonts, CSS   |
| `_nav.ejs`               | Desktop and mobile navigation with auth state |
| `_toast.ejs`             | Toast notification container                  |
| `_achievement-modal.ejs` | Achievement celebration modal with confetti   |
| `_scripts.ejs`           | Alpine.js, toast system, Socket.io client     |
| `_avatar.ejs`            | User avatar with fallback to initials         |
| `_card.ejs`              | Reusable card component                       |
| `_empty-state.ejs`       | Empty state with icon, message, and CTA       |

**Toast Notifications**: A global notification system for user feedback:

```javascript
// Client-side (after page load)
toast.success("Profile updated!");
toast.error("Something went wrong");
toast.warning("Please check your input");
toast.info("New message received", 10000); // custom duration

// Server-side (via redirect query params)
res.redirect("/dashboard?success=Welcome+back!");
```

Visit `/toast-demo` in development to test the notification system.

## Tech Stack

### Backend

| Technology            | Purpose                               |
| --------------------- | ------------------------------------- |
| **Node.js 20.x**      | Runtime environment                   |
| **TypeScript**        | Type safety and developer experience  |
| **Express.js**        | Minimal, unopinionated web framework  |
| **Prisma 7**          | Type-safe ORM with PostgreSQL adapter |
| **PostgreSQL 16**     | Primary database                      |
| **Socket.io**         | Real-time messaging and notifications |
| **JWT + bcrypt**      | Authentication and password hashing   |
| **Nodemailer**        | Email delivery (SMTP)                 |
| **Multer**            | File upload handling                  |
| **express-validator** | Request validation                    |

### Frontend

| Technology        | Purpose                         |
| ----------------- | ------------------------------- |
| **EJS**           | Server-side templating          |
| **TailwindCSS 4** | Utility-first CSS framework     |
| **Alpine.js**     | Lightweight reactive components |
| **Chart.js**      | Data visualization              |
| **Vite**          | CSS build tooling               |

### Development & Operations

| Technology            | Purpose                         |
| --------------------- | ------------------------------- |
| **Jest + Supertest**  | Unit and integration testing    |
| **ESLint + Prettier** | Code quality and formatting     |
| **PM2**               | Process management (production) |
| **Docker Compose**    | Local PostgreSQL container      |
| **GitHub Actions**    | CI/CD pipeline                  |
| **Nginx**             | Reverse proxy (production)      |

## Future Roadmap

- **Redis Integration** - Add Redis for session storage and Socket.io adapter, enabling horizontal scaling with multiple Node.js instances in PM2 cluster mode
- **Push Notifications** - Web push for achievement unlocks and messages
- **API Documentation** - OpenAPI/Swagger docs for the REST API
- **Mobile App** - React Native companion app using the existing API

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- Docker (for PostgreSQL)
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/andrewthecodertx/weightloss.watch.git
cd weightloss.watch

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL container
npm run db:start

# Run database migrations
npm run db:migrate

# Seed database (optional - adds test data)
npm run db:seed

# Start development server
npm run dev
```

Visit **http://localhost:3000** in your browser.

### Test Login (After Seeding)

- Email: john@example.com
- Password: Password123

## Development Commands

### Database

```bash
npm run db:start       # Start PostgreSQL container
npm run db:stop        # Stop PostgreSQL container
npm run db:migrate     # Create and run migrations
npm run db:push        # Push schema changes (dev only)
npm run db:studio      # Open Prisma Studio GUI
npm run db:seed        # Seed with test data
```

### Application

```bash
npm run dev            # Start with hot reload + CSS watch
npm run build          # Build for production
npm start              # Run production build
```

### Testing

```bash
npm test                      # Run all tests
npm test -- path/to/file      # Run single test file
npm run test:unit             # Unit tests only
npm run test:integration      # Integration tests only
npm run test:coverage         # Generate coverage report
```

### Code Quality

```bash
npm run lint           # Run ESLint
npm run format         # Format with Prettier
```

## Project Structure

```
src/
├── config/            # Environment and auth configuration
├── controllers/       # Request handlers (MVC controllers)
│   ├── HomeController.ts      # Public pages (home, about, resources, contribute)
│   ├── AuthController.ts      # API authentication
│   ├── WebAuthController.ts   # Web authentication (login/register pages)
│   ├── DashboardController.ts
│   ├── TeamController.ts
│   └── ...
├── middleware/        # Express middleware
│   ├── auth.ts        # JWT authentication (API)
│   ├── webAuth.ts     # Cookie authentication (Web)
│   ├── loadUser.ts    # User context loader
│   └── errorHandler.ts
├── routes/            # Route definitions
│   └── index.ts       # Route mounting
├── services/          # Business logic layer
│   ├── auth.service.ts
│   ├── achievement.service.ts
│   ├── message.service.ts
│   ├── socket.service.ts
│   └── database.ts    # Prisma client
├── views/             # EJS templates
│   ├── layout.ejs     # Master layout (16 lines - includes partials)
│   ├── partials/      # Reusable components
│   │   ├── _head.ejs, _nav.ejs, _toast.ejs, _scripts.ejs
│   │   ├── _avatar.ejs, _card.ejs, _empty-state.ejs
│   │   └── _achievement-modal.ejs, _team-chat-widget.ejs
│   └── */             # Feature-specific views
├── styles/            # Source CSS (Tailwind)
└── server.ts          # Application entry point

prisma/
├── schema.prisma      # Database schema
├── migrations/        # Migration history
└── seed.ts            # Development seed data

tests/
├── unit/              # Service unit tests
├── integration/       # Route integration tests
└── helpers/           # Test utilities and factories
```

## Environment Variables

See `.env.example` for all options. Key variables:

```bash
# Server
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5433/db?schema=public"

# JWT (generate with: openssl rand -base64 48)
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"

# Email (leave empty in dev to log to console)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""

# Homepage
HOME_NEWS_COUNT="6"
```

## License

MIT, see [LICENSE](LICENSE).

## Contributing

PRs welcome. Please open an issue first for major changes.
