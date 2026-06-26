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
    googleJwksStatus: "UNKNOWN",
  };

  try {
    const res = await fetch(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );
    if (res.ok) {
      const keys = await res.json();
      info.googleJwksStatus = "SUCCESS";
      info.googleKeyIds = Object.keys(keys);
    } else {
      info.googleJwksStatus = `FAILED (${res.status})`;
    }
  } catch (err: any) {
    info.googleJwksStatus = "ERROR";
    info.error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(info);
}
