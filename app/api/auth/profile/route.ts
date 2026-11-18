import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { UserModel } from "@/models/User";
import { verifyJWT } from "@/lib/jwt";
import { findUserByIdInMemory, updateUserInMemory, DEFAULT_GUEST_USER } from "@/lib/memory-db";

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("krishi_token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const payload = verifyJWT(token);
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired session token" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const allowedUpdates = [
      "name",
      "phone",
      "email",
      "state",
      "district",
      "village",
      "gpsLocation",
      "farmSize",
      "farmSizeUnit",
      "primaryCrop",
      "preferredLanguage",
      "voiceLanguage",
      "profilePhoto",
      "notificationPreferences",
    ];

    const updates: Record<string, any> = {};
    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    // Guest user profile update
    if (payload.isGuest || payload.userId.startsWith("guest")) {
      const updatedGuest = updateUserInMemory(payload.userId, updates) || {
        ...DEFAULT_GUEST_USER,
        ...updates,
      };
      return NextResponse.json({
        success: true,
        message: "Guest profile updated successfully!",
        user: updatedGuest,
      });
    }

    let updatedUser: any = null;

    try {
      await connectDB();
      updatedUser = await UserModel.findByIdAndUpdate(
        payload.userId,
        { $set: updates },
        { new: true, runValidators: true }
      ).select("-password");
    } catch (dbErr: any) {
      console.warn("⚠️ [DB FALLBACK FOR PROFILE UPDATE]:", dbErr.message);
    }

    if (!updatedUser) {
      updatedUser = updateUserInMemory(payload.userId, updates);
    }

    if (!updatedUser) {
      updatedUser = {
        _id: payload.userId,
        name: payload.name || "Farmer",
        email: payload.email,
        phone: payload.phone,
        role: payload.role || "Farmer",
        ...updates,
      };
    }

    const userObj = typeof updatedUser.toObject === "function" ? updatedUser.toObject() : { ...updatedUser };
    delete userObj.password;

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully!",
      user: userObj,
    });
  } catch (error: any) {
    console.error("❌ Profile Update API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update profile." },
      { status: 500 }
    );
  }
}
