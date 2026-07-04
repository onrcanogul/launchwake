import { describe, it, expect } from "vitest";
import type { db as realDb } from "../lib/db";
import {
  hashPayload,
  recordDelivery,
  processDelivery,
  retryFailedDeliveries,
} from "../lib/webhookDelivery";

/**
 * Integration test of the ingestion pipeline against an in-memory store — the
 * repo has no test Postgres, so we inject a fake Prisma client that implements
 * exactly the calls the pipeline makes. Covers: authentic delivery → row + Ship,
 * idempotency (same delivery twice → one Ship), and failure → retry.
 */

type SourceT = "GITHUB" | "STRIPE";
type StatusT = "RECEIVED" | "PROCESSED" | "FAILED";

interface StoredDelivery {
  id: string;
  source: SourceT;
  projectId: string | null;
  dedupeKey: string;
  eventType: string | null;
  payload: unknown;
  signature: string | null;
  status: StatusT;
  error: string | null;
  attempts: number;
  nextRetryAt: Date | null;
  shipId: string | null;
  receivedAt: Date;
  processedAt: Date | null;
  updatedAt: Date;
}

interface StoredShip {
  id: string;
  projectId: string;
  type: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  commitSha: string | null;
}

type DeliveryWhere = {
  id?: string;
  source_dedupeKey?: { source: SourceT; dedupeKey: string };
};
type ShipWhere = {
  projectId?: string;
  OR?: Array<{ commitSha?: string; sourceUrl?: string }>;
};

/**
 * In-memory stand-in for the subset of the Prisma client the pipeline touches.
 * Passed to the pipeline via `as unknown as typeof db`, so its method arg shapes
 * only need to satisfy the runtime calls, not Prisma's full generated types.
 */
class FakeDb {
  deliveries = new Map<string, StoredDelivery>();
  ships: StoredShip[] = [];
  private wdSeq = 0;
  private shipSeq = 0;
  /** When > 0, the next N ship.create calls throw (simulates a transient fault). */
  failCreateShipTimes = 0;

  webhookDelivery = {
    findUnique: async ({ where }: { where: DeliveryWhere }): Promise<StoredDelivery | null> => {
      if (where.id != null) return this.deliveries.get(where.id) ?? null;
      if (where.source_dedupeKey) {
        const { source, dedupeKey } = where.source_dedupeKey;
        for (const row of this.deliveries.values()) {
          if (row.source === source && row.dedupeKey === dedupeKey) return row;
        }
      }
      return null;
    },
    create: async ({
      data,
    }: {
      data: Partial<StoredDelivery> & { source: SourceT; dedupeKey: string };
    }): Promise<StoredDelivery> => {
      for (const row of this.deliveries.values()) {
        if (row.source === data.source && row.dedupeKey === data.dedupeKey) {
          throw new Error("Unique constraint failed on (source, dedupeKey)");
        }
      }
      const id = `wd_${++this.wdSeq}`;
      const row: StoredDelivery = {
        id,
        source: data.source,
        projectId: data.projectId ?? null,
        dedupeKey: data.dedupeKey,
        eventType: data.eventType ?? null,
        payload: data.payload ?? {},
        signature: data.signature ?? null,
        status: data.status ?? "RECEIVED",
        error: null,
        attempts: 0,
        nextRetryAt: null,
        shipId: null,
        receivedAt: new Date(),
        processedAt: null,
        updatedAt: new Date(),
      };
      this.deliveries.set(id, row);
      return row;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<StoredDelivery>;
    }): Promise<StoredDelivery> => {
      const row = this.deliveries.get(where.id);
      if (!row) throw new Error("delivery not found");
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    findMany: async ({
      where,
      orderBy,
      take,
    }: {
      where?: { status?: StatusT; attempts?: { lt?: number }; nextRetryAt?: { lte?: Date } };
      orderBy?: { nextRetryAt?: "asc" };
      take?: number;
    }): Promise<StoredDelivery[]> => {
      let rows = [...this.deliveries.values()].filter((r) => {
        if (where?.status && r.status !== where.status) return false;
        if (where?.attempts?.lt != null && !(r.attempts < where.attempts.lt)) return false;
        if (where?.nextRetryAt?.lte != null) {
          if (r.nextRetryAt == null) return false;
          if (r.nextRetryAt.getTime() > where.nextRetryAt.lte.getTime()) return false;
        }
        return true;
      });
      if (orderBy?.nextRetryAt === "asc") {
        rows = rows.sort(
          (a, b) => (a.nextRetryAt?.getTime() ?? 0) - (b.nextRetryAt?.getTime() ?? 0),
        );
      }
      if (take != null) rows = rows.slice(0, take);
      return rows;
    },
  };

  ship = {
    findFirst: async ({ where }: { where: ShipWhere }): Promise<StoredShip | null> => {
      const clauses = where?.OR ?? [];
      for (const s of this.ships) {
        if (where?.projectId && s.projectId !== where.projectId) continue;
        const match =
          clauses.length === 0 ||
          clauses.some(
            (c) =>
              (c.commitSha != null && s.commitSha === c.commitSha) ||
              (c.sourceUrl != null && s.sourceUrl === c.sourceUrl),
          );
        if (match) return s;
      }
      return null;
    },
    create: async ({
      data,
    }: {
      data: Omit<StoredShip, "id">;
    }): Promise<StoredShip> => {
      if (this.failCreateShipTimes > 0) {
        this.failCreateShipTimes -= 1;
        throw new Error("transient db error");
      }
      const row: StoredShip = { id: `ship_${++this.shipSeq}`, ...data };
      this.ships.push(row);
      return row;
    },
  };
}

const PUSH_PAYLOAD = {
  ref: "refs/heads/main",
  repository: { full_name: "acme/rocket", default_branch: "main" },
  head_commit: {
    id: "abc123def",
    message: "Add dark mode\n\nMakes the whole app switchable.",
    url: "https://github.com/acme/rocket/commit/abc123def",
  },
};

/** Mirror the webhook route: record the authentic delivery, then process it. */
async function ingestGithub(fake: FakeDb, payload: unknown, eventType = "push") {
  const client = fake as unknown as typeof realDb;
  const { delivery, isNew } = await recordDelivery(
    {
      source: "GITHUB",
      dedupeKey: hashPayload(JSON.stringify(payload)),
      projectId: "proj_1",
      eventType,
      payload,
      signature: "sha256=test",
    },
    client,
  );
  const outcome = await processDelivery(delivery, client);
  return { isNew, outcome };
}

/** Assert a FAILED delivery has a scheduled retry time and return it. */
function retryAt(d: StoredDelivery): Date {
  if (!d.nextRetryAt) throw new Error("expected a scheduled retry time");
  return d.nextRetryAt;
}

describe("webhook ingestion pipeline", () => {
  it("persists a WebhookDelivery row and creates a Ship from a push payload", async () => {
    const fake = new FakeDb();
    const { isNew, outcome } = await ingestGithub(fake, PUSH_PAYLOAD);

    expect(isNew).toBe(true);
    expect(outcome.status).toBe("PROCESSED");
    expect(outcome.created).toBe(true);
    expect(outcome.shipId).toBeTruthy();

    expect(fake.deliveries.size).toBe(1);
    const row = [...fake.deliveries.values()][0];
    expect(row.status).toBe("PROCESSED");
    expect(row.shipId).toBe(outcome.shipId);
    expect(row.processedAt).toBeInstanceOf(Date);

    expect(fake.ships).toHaveLength(1);
    expect(fake.ships[0]).toMatchObject({
      projectId: "proj_1",
      title: "Add dark mode",
      commitSha: "abc123def",
    });
  });

  it("is idempotent — the same delivery twice yields one Ship", async () => {
    const fake = new FakeDb();
    const first = await ingestGithub(fake, PUSH_PAYLOAD);
    const second = await ingestGithub(fake, PUSH_PAYLOAD);

    expect(first.outcome.created).toBe(true);
    expect(second.isNew).toBe(false);
    expect(second.outcome.deduped).toBe(true);
    expect(second.outcome.created).toBe(false);

    expect(fake.deliveries.size).toBe(1);
    expect(fake.ships).toHaveLength(1);
  });

  it("marks a delivery FAILED with a scheduled retry when processing throws", async () => {
    const fake = new FakeDb();
    fake.failCreateShipTimes = 1; // first ship.create throws

    const { outcome } = await ingestGithub(fake, PUSH_PAYLOAD);
    expect(outcome.status).toBe("FAILED");
    expect(outcome.exhausted).toBe(false);

    const row = [...fake.deliveries.values()][0];
    expect(row.status).toBe("FAILED");
    expect(row.attempts).toBe(1);
    expect(row.error).toMatch(/transient/i);
    expect(row.nextRetryAt).toBeInstanceOf(Date);
    expect(fake.ships).toHaveLength(0);
  });

  it("recovers a FAILED delivery on the next retry sweep — still one Ship", async () => {
    const fake = new FakeDb();
    fake.failCreateShipTimes = 1;
    await ingestGithub(fake, PUSH_PAYLOAD); // fails, schedules a retry

    const row = [...fake.deliveries.values()][0];
    const after = new Date(retryAt(row).getTime() + 1_000);

    const summary = await retryFailedDeliveries(after, fake as unknown as typeof realDb);

    expect(summary.attempted).toBe(1);
    expect(summary.processed).toBe(1);
    expect(summary.stillFailing).toBe(0);
    expect(summary.analyzedShipIds).toHaveLength(1);

    expect(row.status).toBe("PROCESSED");
    expect(row.attempts).toBe(2);
    expect(fake.ships).toHaveLength(1);
  });

  it("does not retry a delivery whose backoff has not elapsed", async () => {
    const fake = new FakeDb();
    fake.failCreateShipTimes = 1;
    await ingestGithub(fake, PUSH_PAYLOAD);

    const row = [...fake.deliveries.values()][0];
    const beforeBackoff = new Date(retryAt(row).getTime() - 1_000);

    const summary = await retryFailedDeliveries(beforeBackoff, fake as unknown as typeof realDb);
    expect(summary.attempted).toBe(0);
    expect(row.status).toBe("FAILED");
  });
});
