"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useStore } from "@/store/useStore";

export interface UserProfile {
  _id?: string;
  name: string;
  email: string;
  phone: string;
  gender?: string;
  dob?: string;
  state: string;
  district: string;
  village: string;
  address?: string;
  pincode?: string;
  gpsLocation?: { lat: number; lon: number };
  farmSize: number;
  farmSizeUnit: string;
  primaryCrop: string;
  soilType?: string;
  irrigationSource?: string;
  experience?: string;
  preferredLanguage: string;
  voiceLanguage: string;
  profilePhoto?: string;
  role: "Farmer" | "Admin";
  isGuest?: boolean;
  notificationPreferences?: Record<string, boolean>;
  createdAt?: string;
  lastLogin?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  checkAuth: () => Promise<boolean>;
  login: (emailOrPhone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (formData: any) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: (preferredLanguage?: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const GUEST_STORAGE_KEY = "krishi_guest_session";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const setStoreProfile = useStore((state) => state.setProfile);
  const setStoreLanguage = useStore((state) => state.setLanguage);
  const storeLogin = useStore((state) => state.login);
  const storeLogout = useStore((state) => state.logout);

  const syncUserToStore = useCallback((userData: UserProfile) => {
    setUser(userData);
    setIsAuthenticated(true);

    // Sync to Zustand Store
    setStoreProfile({
      name: userData.name || "Farmer",
      email: userData.email,
      phone: userData.phone,
      state: userData.state || "Punjab",
      district: userData.district || "Ludhiana",
      village: userData.village || "Samrala",
      farmSize: String(userData.farmSize || 5),
      landUnit: userData.farmSizeUnit || "Acres",
      mainCrops: userData.primaryCrop || "Wheat, Rice, Tomato",
      preferredLanguage: userData.preferredLanguage || "hi-IN",
      soilType: userData.soilType || "Loamy Soil",
      irrigationType: userData.irrigationSource || "Drip / Tube-well",
    });

    if (userData.preferredLanguage) {
      setStoreLanguage(userData.preferredLanguage);
    }

    storeLogin(userData._id || "session-token", true);
  }, [setStoreProfile, setStoreLanguage, storeLogin]);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    console.log("AUTH: Checking authentication status...");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { method: "GET" });
      const data = await res.json();

      if (res.ok && data.success && data.authenticated && data.user) {
        syncUserToStore(data.user);
        console.log("AUTH: Verified user session from server:", data.user.name);
        setLoading(false);
        return true;
      }
    } catch (error) {
      console.warn("⚠️ AUTH Verification network warning:", error);
    }

    // Fallback: Check if client has a preserved guest session
    if (typeof window !== "undefined") {
      try {
        const savedGuest = localStorage.getItem(GUEST_STORAGE_KEY);
        if (savedGuest) {
          const parsed = JSON.parse(savedGuest);
          if (parsed && parsed.isGuest) {
            console.log("AUTH: Restored guest session from localStorage:", parsed.name);
            syncUserToStore(parsed);
            setLoading(false);
            return true;
          }
        }
      } catch (e) {
        // ignore parse error
      }
    }

    setUser(null);
    setIsAuthenticated(false);
    setLoading(false);
    return false;
  }, [syncUserToStore]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (emailOrPhone: string, password: string) => {
    console.log("AUTH: Login request started");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, password }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        console.log("AUTH: Login successful for:", data.user.name);
        if (typeof window !== "undefined") {
          localStorage.removeItem(GUEST_STORAGE_KEY);
        }
        syncUserToStore(data.user);
        setLoading(false);
        return { success: true };
      } else {
        setLoading(false);
        return { success: false, error: data.error || "Login failed" };
      }
    } catch (error: any) {
      setLoading(false);
      return { success: false, error: error.message || "Network error during login" };
    }
  };

  const register = async (formData: any) => {
    console.log("AUTH: Registration request started");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        console.log("AUTH: Registration successful for:", data.user.name);
        if (typeof window !== "undefined") {
          localStorage.removeItem(GUEST_STORAGE_KEY);
        }
        syncUserToStore(data.user);
        setLoading(false);
        return { success: true };
      } else {
        setLoading(false);
        return { success: false, error: data.error || "Registration failed" };
      }
    } catch (error: any) {
      setLoading(false);
      return { success: false, error: error.message || "Network error during registration" };
    }
  };

  const loginAsGuest = async (preferredLanguage?: string) => {
    console.log("AUTH: Initializing guest session...");
    setLoading(true);

    const targetLang = preferredLanguage || useStore.getState().currentLanguage || "hi-IN";

    // Immediate optimistic guest user to guarantee instant dashboard launch
    const fallbackGuestUser: UserProfile = {
      _id: `guest_${Date.now()}`,
      name: "Rajesh Kumar",
      email: "guest@krishimitra.in",
      phone: "9876543210",
      state: "Punjab",
      district: "Ludhiana",
      village: "Samrala",
      farmSize: 5,
      farmSizeUnit: "Acres",
      primaryCrop: "Wheat, Rice, Tomato",
      preferredLanguage: targetLang,
      voiceLanguage: targetLang,
      role: "Farmer",
      isGuest: true,
    };

    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLanguage: targetLang }),
      });
      const data = await res.json();

      const activeUser = (res.ok && data.success && data.user) ? data.user : fallbackGuestUser;

      if (typeof window !== "undefined") {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(activeUser));
      }

      syncUserToStore(activeUser);
      setLoading(false);
      return { success: true };
    } catch (e) {
      console.warn("⚠️ Guest API call failed, using client guest session:", e);
      if (typeof window !== "undefined") {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(fallbackGuestUser));
      }
      syncUserToStore(fallbackGuestUser);
      setLoading(false);
      return { success: true };
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        syncUserToStore(data.user);
        if (data.user.isGuest && typeof window !== "undefined") {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data.user));
        }
        return { success: true };
      } else {
        // Local update fallback if offline
        if (user) {
          const merged = { ...user, ...updates };
          syncUserToStore(merged);
          return { success: true };
        }
        return { success: false, error: data.error || "Profile update failed" };
      }
    } catch (error: any) {
      if (user) {
        const merged = { ...user, ...updates };
        syncUserToStore(merged);
        return { success: true };
      }
      return { success: false, error: error.message || "Network error during profile update" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout API Error:", error);
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }
      setUser(null);
      setIsAuthenticated(false);
      storeLogout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        checkAuth,
        login,
        register,
        loginAsGuest,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
