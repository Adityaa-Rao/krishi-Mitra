import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { UserModel } from "@/models/User";
import { signJWT } from "@/lib/jwt";
import { findUserInMemory, DEFAULT_GUEST_USER } from "@/lib/memory-db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { emailOrPhone, password } = body;

    if (!emailOrPhone || !password) {
      return NextResponse.json(
        { success: false, error: "Please enter your Email/Phone and Password." },
        { status: 400 }
      );
    }

    const identifier = emailOrPhone.trim().toLowerCase();

    let user: any = null;
    let isDbConnected = false;

    try {
      await connectDB();
      isDbConnected = true;

      // Find user by email or phone
      user = await UserModel.findOne({
        $or: [{ email: identifier }, { phone: identifier }],
      });
    } catch (dbErr: any) {
      console.warn("⚠️ [DB FALLBACK FOR LOGIN]: MongoDB unavailable, checking memory store:", dbErr.message);
    }

    // If not found in DB or DB down, check memory store
    if (!user) {
      const memUser = findUserInMemory(identifier);
      if (memUser) {
        user = memUser;
      }
    }

    // Also support default demo credentials fallback if user enters guest credentials
    if (!user && (identifier === "guest" || identifier === "9876543210" || identifier === "guest@krishimitra.in")) {
      user = { ...DEFAULT_GUEST_USER };
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "No account found matching those credentials." },
        { status: 401 }
      );
    }

    // Verify password with bcrypt (if password was hashed)
    if (user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: "Incorrect password. Please try again." },
          { status: 401 }
        );
      }
    }

    // Update last login if mongoose document
    if (typeof user.save === "function") {
      user.lastLogin = new Date();
      await user.save().catch(() => {});
    }

    const userIdStr = user._id ? user._id.toString() : "user_login_session";

    // Generate JWT token
    const token = signJWT({
      userId: userIdStr,
      email: user.email,
      phone: user.phone,
      role: user.role || "Farmer",
      name: user.name,
      isGuest: user.isGuest,
    });

    const userObj = typeof user.toObject === "function" ? user.toObject() : { ...user };
    delete userObj.password;

    const response = NextResponse.json({
      success: true,
      message: "Login successful!",
      user: userObj,
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
    console.error("❌ Login API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error during login." },
      { status: 500 }
    );
  }
}
