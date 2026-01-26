import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcrypt";
import { db } from "../db";
import { adminSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS } from "~/lib/constants";
import { getWebRequest, setCookie, getCookie } from "@tanstack/react-start/server";

// Simple session management using signed cookies
// In production, consider using a more robust solution like iron-session

function generateSessionToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Store active sessions in memory (in production, use Redis or database)
const activeSessions = new Map<string, { createdAt: Date }>();

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { password } = data;

    // Get admin settings
    const settings = await db.query.adminSettings.findFirst();
    if (!settings) {
      return { success: false, error: "Admin not configured" };
    }

    // Verify password
    const isValid = await bcrypt.compare(password, settings.passwordHash);
    if (!isValid) {
      return { success: false, error: "Invalid password" };
    }

    // Create session
    const sessionToken = generateSessionToken();
    activeSessions.set(sessionToken, { createdAt: new Date() });

    // Set cookie
    // Use COOKIE_SECURE env var to control secure flag (default: true in production)
    const useSecureCookie = process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production";
    setCookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
      path: "/",
    });

    return { success: true };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(
  async () => {
    const sessionToken = getCookie(SESSION_COOKIE_NAME);

    if (sessionToken) {
      activeSessions.delete(sessionToken);
    }

    const useSecureCookie = process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production";
    setCookie(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return { success: true };
  }
);

export const verifyAdminSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const sessionToken = getCookie(SESSION_COOKIE_NAME);

    if (!sessionToken) {
      return { isAuthenticated: false };
    }

    const session = activeSessions.get(sessionToken);
    if (!session) {
      return { isAuthenticated: false };
    }

    // Check if session has expired
    const expiryDate = new Date(session.createdAt);
    expiryDate.setDate(expiryDate.getDate() + SESSION_EXPIRY_DAYS);

    if (new Date() > expiryDate) {
      activeSessions.delete(sessionToken);
      return { isAuthenticated: false };
    }

    return { isAuthenticated: true };
  }
);

export const changeAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { currentPassword: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const { currentPassword, newPassword } = data;

    // Verify current session
    const sessionToken = getCookie(SESSION_COOKIE_NAME);
    if (!sessionToken || !activeSessions.has(sessionToken)) {
      return { success: false, error: "Not authenticated" };
    }

    // Get admin settings
    const settings = await db.query.adminSettings.findFirst();
    if (!settings) {
      return { success: false, error: "Admin not configured" };
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, settings.passwordHash);
    if (!isValid) {
      return { success: false, error: "Current password is incorrect" };
    }

    // Update password
    const newHash = await bcrypt.hash(newPassword, 10);
    await db
      .update(adminSettings)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(adminSettings.id, settings.id));

    return { success: true };
  });
