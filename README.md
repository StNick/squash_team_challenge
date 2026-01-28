# Squash Team Challenge

A tournament management application for squash team competitions. Features automated scheduling, public score entry, standings tracking, and reserve player management.

## Features

- **Public Dashboard**: View matches, enter scores, check standings
- **Admin Panel**: Manage tournaments, players, and scores
- **Automated Scheduling**: Round-robin matchups and duty rotation
- **Player Database**: Reusable player directory across tournaments
- **Reserve System**: Track available substitute players with skill ratings
- **Handicap System**: Skill-based scoring adjustments with weighted results
- **Substitute Management**: Assign reserves or custom substitutes to matches

## Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)
- PostgreSQL 16+ (or Docker)

## Local Development Setup

### Option 1: Using Docker for Database

1. **Clone the repository**
   ```bash
   git clone https://github.com/StNick/squash_team_challenge.git
   cd squash_team_challenge
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start PostgreSQL with Docker**
   ```bash
   docker compose up -d db
   ```
   This starts a PostgreSQL container on port 5432 with:
   - Database: `squash`
   - User: `postgres`
   - Password: `postgres`

4. **Create environment file**
   ```bash
   cp .env.example .env
   ```

   Or create `.env` manually:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/squash
   NODE_ENV=development
   ADMIN_PASSWORD=your-admin-password
   COOKIE_SECURE=false
   ```

5. **Run database migrations**
   ```bash
   pnpm db:push
   ```

6. **Seed the database** (creates admin user)
   ```bash
   pnpm db:seed
   ```

7. **Start the development server**
   ```bash
   pnpm dev
   ```

8. **Open the app**
   - Public dashboard: http://localhost:3000
   - Admin login: http://localhost:3000/admin

### Option 2: Using Local PostgreSQL

1. Create a PostgreSQL database
2. Update `DATABASE_URL` in `.env` with your connection string
3. Follow steps 5-8 above

## Docker Deployment (Full Stack)

To run the entire application in Docker:

1. **Configure environment variables**

   Edit `docker-compose.yml` or create a `.env` file:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@db:5432/squash
   ADMIN_PASSWORD=your-secure-password
   COOKIE_SECURE=true
   ```

2. **Build and start all services**
   ```bash
   docker compose up -d
   ```

   This starts:
   - PostgreSQL database on port 5432
   - Application server on port 3000

   **Note:** The container automatically runs database migrations on startup before the app starts. If migrations fail, the container will exit with an error.

3. **View logs**
   ```bash
   docker compose logs -f app
   ```

4. **Stop services**
   ```bash
   docker compose down
   ```

### Publishing to Docker Hub

To build and push a new production image:

```bash
docker buildx build --platform linux/amd64 -t stnickza/squash-team-challenge:latest --push .
```

This builds for `linux/amd64` (required for most cloud servers) and pushes to [Docker Hub](https://hub.docker.com/r/stnickza/squash-team-challenge).

**Source code**: https://github.com/StNick/squash_team_challenge

### Cloning Production to Development

To create a dev database from prod (including migration history):

```bash
# Dump prod (includes all schemas)
pg_dump -Fc "postgresql://user:pass@host:5432/prod_db" > prod_backup.dump

# Create fresh dev database
psql "postgresql://user:pass@host:5432/postgres" -c "DROP DATABASE IF EXISTS dev_db"
psql "postgresql://user:pass@host:5432/postgres" -c "CREATE DATABASE dev_db"

# Restore to dev
pg_restore -d "postgresql://user:pass@host:5432/dev_db" prod_backup.dump
```

**Important:** Use `-Fc` format to include all schemas (including `drizzle` which tracks migrations).

### Docker Configuration Options

The `docker-compose.yml` supports these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `ADMIN_PASSWORD` | Initial admin password | Required |
| `NODE_ENV` | Environment mode | `production` |
| `COOKIE_SECURE` | Require HTTPS for cookies | `true` |

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Run production build |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run pending migrations (drizzle-kit) |
| `pnpm db:migrate:run` | Run migrations (programmatic, same as Docker) |
| `pnpm db:push` | Push schema to database (dev only) |
| `pnpm db:studio` | Open Drizzle Studio GUI |
| `pnpm db:seed` | Create admin user |
| `pnpm db:seed-tournament` | Load sample tournament data |

## Usage

### Creating a Tournament

1. Log in at `/admin` with your admin password
2. Navigate to "Create Tournament"
3. Enter tournament details:
   - Name and number of weeks
   - Import players via CSV or enter manually
   - Configure teams and schedule
4. Click "Create Tournament"

### Entering Scores

Scores can be entered by anyone from the public dashboard:
1. Find the match on the homepage
2. Enter both players' scores
3. Click Submit

Admins can edit scores from `/admin/scores`.

### Managing Players

From `/admin/players`:
- Swap players between teams
- Set team captains
- Adjust player positions (1-5)
- Update player names and skill ratings

## Tech Stack

- **Frontend**: React 19, TanStack Router, Tailwind CSS
- **Backend**: TanStack React Start, Nitro
- **Database**: PostgreSQL with Drizzle ORM
- **Language**: TypeScript

## License

MIT
