"use client";

import { useEffect } from "react";
import { warmUpFingerprint } from "@/lib/fingerprint-client";

/**
 * Renders nothing — its only job is to pre-load the FingerprintJS agent
 * so it's warm by the time any auth form makes its first call.
 * This shaves ~15-30ms off the first OTP-send click.
 */
export function FingerprintWarmup() {
  useEffect(() => {
    warmUpFingerprint();
  }, []);
  return null;
}
