import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "E-Mail-Adresse erforderlich." }, { status: 400 });
    }

    await connectDB();

    // Always respond with success to prevent user enumeration
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetToken = token;
    user.resetTokenExpiresAt = expiresAt;
    await user.save();

    const appUrl = process.env.APP_URL ?? "http://localhost:3001";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    // Send email if Resend API key is configured
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? "InvoiceOS <noreply@invoiceos.app>",
          to: user.email,
          subject: "Passwort zurücksetzen – InvoiceOS",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#111318;color:#ccc;border-radius:12px">
              <h2 style="color:#fff;font-size:22px;margin:0 0 8px">Passwort zurücksetzen</h2>
              <p style="color:#888;font-size:14px;margin:0 0 24px">
                Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.
                Klicken Sie auf den folgenden Link – er ist <strong>1 Stunde</strong> gültig.
              </p>
              <a href="${resetUrl}"
                style="display:inline-block;background:#c8f04a;color:#111;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px">
                Passwort zurücksetzen →
              </a>
              <p style="color:#555;font-size:12px;margin:24px 0 0">
                Falls Sie diese E-Mail nicht erwartet haben, ignorieren Sie sie bitte.
                Ihr Passwort wurde nicht geändert.
              </p>
            </div>
          `,
        }),
      });
    } else {
      // Development fallback: log to console
      console.log("\n[DEV] Password reset link:", resetUrl, "\n");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[reset-request]", err);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
