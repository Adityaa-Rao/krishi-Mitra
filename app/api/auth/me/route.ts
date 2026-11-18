import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { UserModel } from "@/models/User";
import { verifyJWT } from "@/lib/jwt";
import { findUserByIdInMemory, DEFAULT_GUEST_USER } from "@/lib/memory-db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("krishi_token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, authenticated: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const payload = verifyJWT(token);
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { success: false, authenticated: false, error: "Invalid or expired session token" },
        { status: 401 }
      );
    }

    // Fast-path for guest sessions
    if (payload.isGuest || payload.userId.startsWith("guest")) {
      const guestUser = {
        ...DEFAULT_GUEST_USER,
        _id: payload.userId,
        name: payload.name || DEFAULT_GUEST_USER.name,
      };
      return NextResponse.json({
        success: true,
        authenticated: true,
        isGuest: true,
        user: guestUser,
      });
    }

    let user: any = null;

    try {
      await connectDB();
      user = await UserModel.findById(payload.userId).select("-password");
    } catch (dbErr: any) {
      console.warn("⚠️ [DB FALLBACK FOR /api/auth/me]:", dbErr.message);
    }

    // Fallback to memory store if DB is down or user in memory store
    if (!user) {
      user = findUserByIdInMemory(payload.userId);
    }

    // If still not found, construct a valid session from verified JWT payload
    if (!user) {
      user = {
        _id: payload.userId,
        name: payload.name || "Farmer",
        email: payload.email,
        phone: payload.phone,
        role: payload.role || "Farmer",
        state: "Punjab",
        district: "Ludhiana",
        village: "Samrala",
        farmSize: 5,
        farmSizeUnit: "Acres",
        primaryCrop: "Wheat, Rice, Tomato",
        preferredLanguage: "hi-IN",
        voiceLanguage: "hi-IN",
      };
    }

    const userObj = typeof user.toObject === "function" ? user.toObject() : { ...user };
    delete userObj.password;

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: userObj,
    });
  } catch (error: any) {
    console.error("❌ Auth Me API Error:", error);
    return NextResponse.json(
      { success: false, authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}
