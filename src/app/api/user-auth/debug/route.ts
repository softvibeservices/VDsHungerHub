import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const info: any = {
    env: {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "PRESENT" : "MISSING",
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "PRESENT" : "MISSING",
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "PRESENT" : "MISSING",
      USER_JWT_SECRET: process.env.USER_JWT_SECRET ? "PRESENT" : "MISSING",
      DATABASE_URL: process.env.DATABASE_URL ? "PRESENT" : "MISSING",
    },
    firebaseAdminImport: "UNKNOWN",
    firebaseAdminInit: "UNKNOWN",
  };

  try {
    // Dynamically import getFirebaseAdmin so it doesn't crash at module load time
    const { getFirebaseAdmin } = await import("@/lib/firebase-admin");
    info.firebaseAdminImport = "SUCCESS";
    
    const auth = getFirebaseAdmin();
    info.firebaseAdminInit = "SUCCESS";
    info.firebaseAdminAppName = auth ? "SUCCESS" : "NULL";
  } catch (err: any) {
    info.firebaseAdminInit = "FAILED";
    info.error = err instanceof Error ? err.message : String(err);
    info.stack = err instanceof Error ? err.stack : undefined;
  }

  return NextResponse.json(info);
}
