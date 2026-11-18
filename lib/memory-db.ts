/**
 * In-Memory Fallback Database for KrishiMitra
 * Provides zero-crash resilience on Vercel or cloud deployments when
 * MONGODB_URI is not yet configured or temporarily unreachable.
 */

export interface MemoryUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
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
  createdAt: string;
  lastLogin: string;
}

export const DEFAULT_GUEST_USER: MemoryUser = {
  _id: "guest_farmer_01",
  name: "Rajesh Kumar",
  email: "guest@krishimitra.in",
  phone: "9876543210",
  gender: "Male",
  dob: "1988-06-15",
  state: "Punjab",
  district: "Ludhiana",
  village: "Samrala",
  address: "Samrala Farm Sector 4",
  pincode: "141114",
  gpsLocation: { lat: 30.901, lon: 75.8573 },
  farmSize: 5,
  farmSizeUnit: "Acres",
  primaryCrop: "Wheat, Rice, Tomato",
  soilType: "Alluvial / Loamy",
  irrigationSource: "Canal / Borewell",
  experience: "5-10 Years",
  preferredLanguage: "hi-IN",
  voiceLanguage: "hi-IN",
  profilePhoto: "",
  role: "Farmer",
  isGuest: true,
  createdAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
};

// Global cache across serverless warm requests
const globalWithMemoryDB = global as typeof globalThis & {
  memoryUsersMap?: Map<string, MemoryUser>;
};

if (!globalWithMemoryDB.memoryUsersMap) {
  globalWithMemoryDB.memoryUsersMap = new Map<string, MemoryUser>();
  // Seed with default guest user
  globalWithMemoryDB.memoryUsersMap.set(DEFAULT_GUEST_USER._id, { ...DEFAULT_GUEST_USER });
  globalWithMemoryDB.memoryUsersMap.set(DEFAULT_GUEST_USER.email, { ...DEFAULT_GUEST_USER });
  globalWithMemoryDB.memoryUsersMap.set(DEFAULT_GUEST_USER.phone, { ...DEFAULT_GUEST_USER });
}

const memoryUsers = globalWithMemoryDB.memoryUsersMap;

export function saveUserInMemory(user: MemoryUser): MemoryUser {
  memoryUsers.set(user._id, user);
  if (user.email) memoryUsers.set(user.email.toLowerCase().trim(), user);
  if (user.phone) memoryUsers.set(user.phone.trim(), user);
  return user;
}

export function findUserInMemory(identifier: string): MemoryUser | null {
  const clean = identifier.toLowerCase().trim();
  return memoryUsers.get(clean) || memoryUsers.get(identifier.trim()) || null;
}

export function findUserByIdInMemory(id: string): MemoryUser | null {
  if (id.startsWith("guest") || id === DEFAULT_GUEST_USER._id) {
    return { ...DEFAULT_GUEST_USER };
  }
  return memoryUsers.get(id) || null;
}

export function updateUserInMemory(id: string, updates: Partial<MemoryUser>): MemoryUser | null {
  const existing = findUserByIdInMemory(id);
  if (!existing) return null;

  const updated: MemoryUser = {
    ...existing,
    ...updates,
    lastLogin: new Date().toISOString(),
  };

  saveUserInMemory(updated);
  return updated;
}
