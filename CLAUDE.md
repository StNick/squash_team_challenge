# Squash Team Challenge

A full-stack tournament management application for squash team competitions with automated scheduling, scoring, and standings tracking.

## Tech Stack

- **Frontend**: React 19, TanStack Router (file-based routing), Tailwind CSS
- **Backend**: TanStack React Start, Nitro server
- **Database**: PostgreSQL 16 with Drizzle ORM
- **Language**: TypeScript throughout
- **Build**: Vite 7
- **Auth**: Session-based with bcrypt password hashing

## Project Structure

```
src/
├── routes/                    # File-based routing
│   ├── index.tsx              # Public dashboard
│   └── admin/                 # Admin area
│       ├── index.tsx          # Login page
│       └── _authed/           # Protected routes
│           ├── dashboard.tsx  # Week navigation
│           ├── players.tsx    # Player management
│           ├── scores.tsx     # Score entry
│           ├── reserves.tsx   # Reserve management
│           ├── player-database.tsx
│           ├── settings.tsx
│           └── tournament/create.tsx
├── server/
│   ├── db/
│   │   ├── schema.ts          # Drizzle schema definitions
│   │   └── index.ts           # Database connection
│   ├── functions/             # Server functions (API)
│   │   ├── tournament.ts      # Tournament CRUD, week navigation
│   │   ├── players.ts         # Player management
│   │   ├── matches.ts         # Score submission
│   │   ├── reserves.ts        # Reserve management
│   │   └── playerDatabase.ts  # Global player directory
│   └── lib/
│       ├── auth.ts            # Session management
│       └── generation.ts      # Scheduling algorithms
├── components/
│   ├── ui/                    # Button, Card, Input, Modal
│   └── dashboard/             # TeamCard, StandingsTable, WeeklyMatchup, etc.
└── lib/
    ├── constants.ts           # Team colors
    └── utils.ts               # Helpers
```

## Database Schema

**Core Tables:**
- `tournaments` - Tournament metadata (name, weeks, current week)
- `teams` - Teams with color and total score
- `players` - Players with skill rating (1-1M) and position (1-5)
- `weeklyMatchups` - Team vs team pairings per week
- `matches` - Individual player matches with scores
- `weeklyDuties` - Dinner/cleanup team assignments
- `playerDatabase` - Global player directory (reusable across tournaments)
- `reserves` - Reserve players for active tournament
- `firstOnCourt` - Which position group plays first each week
- `adminSettings` - Password hash for admin auth

## Key Features

### Public Dashboard (`/`)
- View current week matches and enter scores (no auth required)
- Team standings (overall and weekly)
- Duty schedule display
- Reserve player contact list

### Admin Area (`/admin/*`)
- **Tournament Creation**: Configure teams, import players via CSV, auto-generate schedules
- **Player Management**: Swap players between teams, set captains, adjust positions
- **Score Management**: Edit/correct match scores
- **Reserve Management**: Add/edit reserve players, link to player database
- **Settings**: Change admin password

## Server Functions

All server functions are in `src/server/functions/`:

| Function | Purpose |
|----------|---------|
| `getDashboardData()` | Fetch all tournament data for public view |
| `createTournament()` | Create tournament with players/schedule |
| `advanceWeek()` / `goBackWeek()` | Navigate weeks |
| `submitMatchScore()` | Public score entry |
| `updateMatchScore()` | Admin score correction |
| `swapPlayers()` | Exchange players between teams |
| `setCaptain()` | Designate team captain |

## Generation Algorithms

Located in `src/server/lib/generation.ts`:

- **Snake Draft**: Distributes players evenly across teams by skill
- **Round-Robin**: Generates balanced weekly matchups
- **Duty Rotation**: Assigns dinner/cleanup duties
- **First on Court**: Randomizes which skill level plays first

## Authentication

- Session-based auth stored in signed HttpOnly cookies
- 7-day session expiry
- Routes under `/admin/_authed/` require valid session
- Password hashed with bcrypt

## Development Commands

```bash
pnpm dev              # Start dev server (port 3000)
pnpm build            # Production build
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Initialize admin user
pnpm db:seed-tournament  # Load sample data
```

## Environment Variables

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NODE_ENV=development|production
ADMIN_PASSWORD=initial-admin-password
COOKIE_SECURE=true|false
```

## Code Patterns

### Server Functions
Server functions use TanStack Start's `createServerFn`:
```typescript
export const myFunction = createServerFn({ method: "POST" })
  .validator(zodSchema)
  .handler(async ({ data }) => {
    // Implementation
  });
```

### Route Loaders
Routes fetch data via loaders:
```typescript
export const Route = createFileRoute("/")({
  loader: async () => await getDashboardData(),
  component: HomePage,
});
```

### Protected Routes
The `_authed.tsx` layout verifies session before rendering children.

## Styling

- Tailwind CSS with custom color palette for teams
- Mobile-first responsive design
- Team colors defined in `src/lib/constants.ts`
