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
- `players` - Players with level rating (1-1M), position (1-5), and playerCode (MySquash identifier)
- `weeklyMatchups` - Team vs team pairings per week
- `matches` - Individual player matches with scores, substitutes, and handicaps
- `weeklyDuties` - Dinner/cleanup team assignments
- `playerDatabase` - Global player directory with playerCode (reusable across tournaments)
- `reserves` - Reserve players with level ratings for active tournament
- `firstOnCourt` - Which position group plays first each week
- `adminSettings` - Password hash for admin auth

**Key Match Columns:**
- `substituteAId` / `substituteBId` - Links to reserve players
- `customSubstituteAName/Level` / `customSubstituteBName/Level` - For non-member substitutes
- `handicap` - Percentage adjustment (positive = A reduced, negative = B reduced)

## Key Features

### Public Dashboard (`/`)
- View current week matches and enter scores (no auth required)
- Team standings (overall and weekly)
- Duty schedule display
- Reserve player contact list
- Handicap-adjusted "weighted results" with tooltip explanations

### Admin Area (`/admin/*`)
- **Tournament Creation**: Configure teams, import players via CSV, auto-generate schedules
- **Player Management**: Swap players between teams, set captains, adjust positions
- **Score Management**: Edit/correct match scores, assign substitutes, set handicaps
- **Reserve Management**: Add/edit reserve players, link to player database, set level ratings, update levels from database
- **Settings**: Change admin password

### Handicap System
- Recommended handicap = half the level advantage between players
- Applied to the stronger player's score (e.g., 24% handicap reduces their score by 24%)
- Admin can auto-calculate or manually set handicaps per match

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
| `setMatchSubstitute()` | Assign reserve/custom substitute to a match |
| `setMatchHandicap()` | Set handicap percentage for a match |
| `getSuggestedHandicap()` | Calculate recommended handicap from level difference |
| `updateReserveLevelsFromDatabase()` | Update reserve levels from player database |

## Generation Algorithms

Located in `src/server/lib/generation.ts`:

- **Snake Draft**: Distributes players evenly across teams by level
- **Round-Robin**: Generates balanced weekly matchups
- **Duty Rotation**: Assigns dinner/cleanup duties
- **First on Court**: Randomizes which level plays first

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
pnpm db:migrate       # Run migrations (drizzle-kit)
pnpm db:migrate:run   # Run migrations (programmatic, same as Docker)
pnpm db:push          # Push schema to database (dev only)
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Initialize admin user
pnpm db:seed-tournament  # Load sample data
```

**IMPORTANT: Database Migrations**

**NEVER manually create migration files in `drizzle/`.** This includes Claude - if `db:generate` requires interactive prompts that Claude cannot answer, ask the user to run it instead.

Always use the drizzle workflow:

1. Edit `src/server/db/schema.ts` with your changes
2. Run `pnpm db:generate` - this creates the migration AND registers it in `drizzle/meta/_journal.json`
3. Run `pnpm db:migrate` to apply

Manually created SQL files won't be registered in the journal and will be silently ignored by the migrator. Even if you add them to the journal manually, the snapshot files in `drizzle/meta/` won't be updated, causing drizzle to get confused about the schema state.

## Docker Deployment

The Docker image automatically runs migrations on startup via `docker-entrypoint.sh`.

```bash
# Build and push
docker buildx build --platform linux/amd64 -t stnickza/squash-team-challenge:latest --push .
```

**Startup sequence:**
1. `docker-entrypoint.sh` runs `scripts/migrate.mjs`
2. Migrations check `drizzle.__drizzle_migrations` table
3. Pending migrations from `drizzle/` are applied
4. App starts

**Cloning prod to dev:**
```bash
# Dump prod (includes drizzle schema with migration history)
pg_dump -Fc "prod_connection_string" > prod_backup.dump

# Restore to dev
pg_restore -d "dev_connection_string" prod_backup.dump
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
