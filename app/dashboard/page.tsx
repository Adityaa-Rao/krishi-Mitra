"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/store/useStore";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const storeAuth = useStore((state) => state.isAuthenticated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    if (mounted && !loading) {
      const isUserAuthed = isAuthenticated || storeAuth;
      console.log("AUTH: Dashboard auth check - authenticated:", isUserAuthed);

      if (!isUserAuthed && !isDemoMode) {
        console.log("AUTH: Unauthenticated access attempt to /dashboard. Redirecting to /login...");
        router.push("/login");
      }
    }
  }, [mounted, loading, isAuthenticated, storeAuth, router]);

  // Loading state guard: Wait until mounted and auth check has settled
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-[#F8FAF7] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 border-4 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-gray-500">Loading Protected Dashboard...</p>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}
