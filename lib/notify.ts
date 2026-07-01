import nodemailer from "nodemailer";
import { env } from "./env";

/**
 * Notification transports for reminders (and later, new-ship pings). Email via
 * SMTP (EMAIL_SERVER), Slack via an incoming webhook URL. Both degrade
 * gracefully: if a transport isn't configured, delivery returns a clear error
 * rather than throwing — the caller records it on the reminder.
 */

export type DeliveryResult = { ok: boolean; error?: string };

export function emailConfigured(): boolean {
  return Boolean(env.EMAIL_SERVER && env.EMAIL_FROM);
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<DeliveryResult> {
  if (!emailConfigured()) {
    return { ok: false, error: "Email is not configured (set EMAIL_SERVER)." };
  }
  try {
    const transport = nodemailer.createTransport(env.EMAIL_SERVER!);
    await transport.sendMail({ from: env.EMAIL_FROM, to, subject, text });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Email send failed: ${(err as Error).message}` };
  }
}

export async function sendSlack(
  webhookUrl: string | null | undefined,
  text: string,
): Promise<DeliveryResult> {
  if (!webhookUrl) {
    return { ok: false, error: "No Slack webhook configured for this project." };
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      return { ok: false, error: `Slack responded ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Slack send failed: ${(err as Error).message}` };
  }
}
