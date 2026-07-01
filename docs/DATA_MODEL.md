# Data model — LaunchWake

PostgreSQL via Prisma. Below is the intended schema (Prisma syntax). Adjust names as needed
but keep the relationships.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  githubId  String?  @unique
  plan      Plan     @default(FREE)
  stripeCustomerId String?
  projects  Project[]
  createdAt DateTime @default(now())
}

enum Plan { FREE PRO }

// The product the user is marketing (e.g., "Hookline")
model Project {
  id          String  @id @default(cuid())
  userId      String
  user        User    @relation(fields: [userId], references: [id])
  name        String
  description String?              // used as LLM context for fit scoring
  url         String?
  githubRepo  String?              // "owner/repo"
  githubInstallationId String?     // for webhook auto-detect
  ships       Ship[]
  createdAt   DateTime @default(now())
}

// A distribution moment: release / feature / blog / other
model Ship {
  id         String     @id @default(cuid())
  projectId  String
  project    Project    @relation(fields: [projectId], references: [id])
  type       ShipType
  title      String
  summary    String?               // what makes it worth sharing
  sourceUrl  String?               // release URL / blog URL
  commitSha  String?
  status     ShipStatus @default(NEW)
  plan       DistributionPlan?
  posts      Post[]
  detectedAt DateTime   @default(now())
}

enum ShipType   { LAUNCH FEATURE BLOG OTHER }
enum ShipStatus { NEW PLANNED POSTED DONE }

// Global, curated catalog of communities/platforms (shared across all users).
// This is the intelligence asset. Seed it; expand over time.
model Channel {
  id           String   @id @default(cuid())
  slug         String   @unique          // "hn-show", "r-webdev", "product-hunt"
  name         String                     // "Hacker News — Show HN"
  platform     Platform
  url          String?
  audienceDesc String?                    // "~5M developers, high intent"
  rules        String?                    // human-readable posting rules
  defaultBanRisk BanRisk @default(LOW)
  bestTime     String?                    // "Tue–Thu 8am ET"
  tags         String[]                   // ["devtools","backend","infra"] for fit matching
  recs         Recommendation[]
  posts        Post[]
  stats        ChannelStat[]
}

enum Platform { HACKERNEWS REDDIT PRODUCTHUNT INDIEHACKERS DEVTO LOBSTERS X LINKEDIN OTHER }
enum BanRisk  { LOW MEDIUM HIGH }

// One plan per ship
model DistributionPlan {
  id        String   @id @default(cuid())
  shipId    String   @unique
  ship      Ship     @relation(fields: [shipId], references: [id])
  recs      Recommendation[]
  createdAt DateTime @default(now())
}

// A ranked channel recommendation for a ship (the hero output)
model Recommendation {
  id         String  @id @default(cuid())
  planId     String
  plan       DistributionPlan @relation(fields: [planId], references: [id])
  channelId  String
  channel    Channel @relation(fields: [channelId], references: [id])
  fitScore   Int                        // 0..100
  banRisk    BanRisk
  bestTime   String?
  whyText    String                     // one-line rationale, product-specific
  ruleNote   String?                    // the safe way in for THIS post
  draft      Draft?
}

// Platform-native draft tied to a recommendation
model Draft {
  id               String @id @default(cuid())
  recommendationId String @unique
  recommendation   Recommendation @relation(fields: [recommendationId], references: [id])
  platform         Platform
  body             String
  safetyNote       String?
  createdAt        DateTime @default(now())
}

// What the user actually posted (they report/confirm it)
model Post {
  id          String   @id @default(cuid())
  shipId      String
  ship        Ship     @relation(fields: [shipId], references: [id])
  channelId   String
  channel     Channel  @relation(fields: [channelId], references: [id])
  url         String?
  status      PostStatus @default(LIVE)
  trackedLink TrackedLink?
  postedAt    DateTime @default(now())
}

enum PostStatus { LIVE REMOVED }

// Tracked short/UTM link for attribution
model TrackedLink {
  id        String  @id @default(cuid())
  postId    String  @unique
  post      Post    @relation(fields: [postId], references: [id])
  shortCode String  @unique
  destUrl   String
  events    Event[]
}

// Attribution events (click -> signup)
model Event {
  id            String   @id @default(cuid())
  trackedLinkId String
  trackedLink   TrackedLink @relation(fields: [trackedLinkId], references: [id])
  type          EventType
  meta          Json?
  createdAt     DateTime @default(now())
}

enum EventType { CLICK SIGNUP }

// Aggregated outcome data per channel (the flywheel / moat).
// Powers outcome-based re-ranking: which channels convert for which product profiles.
model ChannelStat {
  id          String  @id @default(cuid())
  channelId   String
  channel     Channel @relation(fields: [channelId], references: [id])
  productTag  String                     // profile bucket, e.g. "devtools-backend"
  posts       Int     @default(0)
  clicks      Int     @default(0)
  signups     Int     @default(0)
  removals    Int     @default(0)         // ban/removal signal feeds banRisk
  updatedAt   DateTime @updatedAt
  @@unique([channelId, productTag])
}
```

## Notes

- **Channel is global and seeded** — it's the shared knowledge base. Users don't create
  channels; the system curates them. This is deliberate (prevents users pointing the tool
  at communities that will get them banned) and is the moat.
- **ChannelStat** is the flywheel: as real posts produce clicks/signups/removals, fit scores
  and ban risks improve for everyone. `productTag` buckets similar products so the signal is relevant.
- Auth.js will add its own `Account`/`Session`/`VerificationToken` tables — keep them.
