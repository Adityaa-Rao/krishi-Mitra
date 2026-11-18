import { NextResponse } from "next/server";
import { signJWT } from "@/lib/jwt";
import { DEFAULT_GUEST_USER, saveUserInMemory } from "@/lib/memory-db";

export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // Empty body is acceptable for guest login
    }

    const preferredLanguage = body.preferredLanguage || "hi-IN";

    const guestId = `guest_${Date.now()}`;
    const guestUser = {
      ...DEFAULT_GUEST_USER,
      _id: guestId,
      preferredLanguage,
      voiceLanguage: preferredLanguage,
      lastLogin: new Date().toISOString(),
    };

    // Save in memory cache for session continuity
    saveUserInMemory(guestUser);

    const token = signJWT({
      userId: guestUser._id,
      email: guestUser.email,
      phone: guestUser.phone,
      role: guestUser.role,
      name: guestUser.name,
      isGuest: true,
    });

    const response = NextResponse.json({
      success: true,
      message: "Guest session initialized successfully!",
      user: guestUser,
    });

    // Set HttpOnly Secure Cookie
    response.cookies.set("krishi_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("❌ Guest Auth API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to initialize guest session" },
      { status: 500 }
    );
  }
}
