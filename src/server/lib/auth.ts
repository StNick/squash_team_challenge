import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcrypt";
import { db } from "../db";
import { adminSettings, adminSessions } from "../db/schema";
import { eq, lt } from "drizzle-orm";
import { SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS } from "~/lib/constants";
import { setCookie, getCookie } from "@tanstack/react-start/server";

// Session management using database persistence
// Sessions survive server restarts

function generateSessionToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Clean up expired sessions (called periodically)
async function cleanExpiredSessions(): Promise<void> {
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { password } = data;
    console.log("[AUTH] adminLogin called");

    // Get admin settings
    const settings = await db.query.adminSettings.findFirst();
    if (!settings) {
      console.log("[AUTH] No admin settings found");
      return { success: false, error: "Admin not configured" };
    }

    // Verify password
    const isValid = await bcrypt.compare(password, settings.passwordHash);
    if (!isValid) {
      console.log("[AUTH] Invalid password");
      return { success: false, error: "Invalid password" };
    }

    console.log("[AUTH] Password valid, creating session");

    // Clean up expired sessions occasionally
    await cleanExpiredSessions();

    // Create session in database
    const sessionToken = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    await db.insert(adminSessions).values({
      token: sessionToken,
      expiresAt,
    });
    console.log("[AUTH] Session created in DB:", sessionToken.substring(0, 8) + "...");

    // Set cookie
    // Use COOKIE_SECURE env var to control secure flag (default: true in production)
    const useSecureCookie = process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production";
    console.log("[AUTH] Setting cookie, secure:", useSecureCookie);
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
      // Delete session from database
      await db.delete(adminSessions).where(eq(adminSessions.token, sessionToken));
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
    console.log("[AUTH] verifyAdminSession, token:", sessionToken ? sessionToken.substring(0, 8) + "..." : "none");

    if (!sessionToken) {
      console.log("[AUTH] No session token in cookie");
      return { isAuthenticated: false };
    }

    // Look up session in database
    const session = await db.query.adminSessions.findFirst({
      where: eq(adminSessions.token, sessionToken),
    });

    if (!session) {
      console.log("[AUTH] Session token not found in database");
      return { isAuthenticated: false };
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      console.log("[AUTH] Session expired");
      // Delete expired session
      await db.delete(adminSessions).where(eq(adminSessions.id, session.id));
      return { isAuthenticated: false };
    }

    console.log("[AUTH] Session valid");
    return { isAuthenticated: true };
  }
);

export const changeAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { currentPassword: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const { currentPassword, newPassword } = data;

    // Verify current session
    const sessionToken = getCookie(SESSION_COOKIE_NAME);
    if (!sessionToken) {
      return { success: false, error: "Not authenticated" };
    }

    const session = await db.query.adminSessions.findFirst({
      where: eq(adminSessions.token, sessionToken),
    });

    if (!session || new Date() > session.expiresAt) {
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
