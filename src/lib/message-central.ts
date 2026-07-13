/**
 * Message Central VerifyNow OTP client
 * Docs: https://cpaas.messagecentral.com
 *
 * All functions are server-side only — never import this from client components.
 */

const BASE_URL = process.env.MESSAGECENTRAL_BASE_URL ?? "https://cpaas.messagecentral.com";
const CUSTOMER_ID = process.env.MESSAGECENTRAL_CUSTOMER_ID ?? "";
const AUTH_TOKEN = process.env.MESSAGECENTRAL_AUTH_TOKEN ?? "";

export class MessageCentralError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "MessageCentralError";
  }
}

/**
 * Send an OTP to an Indian mobile number via Message Central VerifyNow.
 * Returns the verificationId which must be stored and passed back to verifyOtp().
 */
export async function sendOtp(mobile: string): Promise<string> {
  if (!CUSTOMER_ID || !AUTH_TOKEN) {
    throw new MessageCentralError(
      "Message Central credentials not configured. Set MESSAGECENTRAL_CUSTOMER_ID and MESSAGECENTRAL_AUTH_TOKEN in .env"
    );
  }

  const url = new URL(`${BASE_URL}/verification/v3/send`);
  url.searchParams.set("countryCode", "91");
  url.searchParams.set("customerId", CUSTOMER_ID);
  url.searchParams.set("flowType", "SMS");
  url.searchParams.set("mobileNumber", mobile);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      authToken: AUTH_TOKEN,
    },
  });

  const body = await res.text();

  if (!res.ok) {
    throw new MessageCentralError(
      `Message Central sendOtp failed (HTTP ${res.status})`,
      res.status,
      body
    );
  }

  let json: { verificationId?: string; data?: { verificationId?: string }; responseCode?: number };
  try {
    json = JSON.parse(body);
  } catch {
    throw new MessageCentralError("Message Central returned non-JSON body", res.status, body);
  }

  // The API returns verificationId at the top level or nested under `data`
  const verificationId =
    json?.verificationId ?? json?.data?.verificationId;

  if (!verificationId) {
    throw new MessageCentralError(
      "Message Central did not return a verificationId",
      res.status,
      body
    );
  }

  return verificationId;
}

/**
 * Verify the OTP submitted by the user against Message Central.
 * Returns true if valid, throws MessageCentralError on invalid/expired.
 */
export async function verifyOtp(
  verificationId: string,
  otpCode: string
): Promise<true> {
  if (!CUSTOMER_ID || !AUTH_TOKEN) {
    throw new MessageCentralError(
      "Message Central credentials not configured."
    );
  }

  const url = new URL(`${BASE_URL}/verification/v3/validateOtp`);
  url.searchParams.set("countryCode", "91");
  url.searchParams.set("mobileNumber", ""); // required by API but not checked on verify
  url.searchParams.set("verificationId", verificationId);
  url.searchParams.set("customerId", CUSTOMER_ID);
  url.searchParams.set("code", otpCode);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      authToken: AUTH_TOKEN,
    },
  });

  const body = await res.text();

  if (!res.ok) {
    throw new MessageCentralError(
      `Message Central verifyOtp failed (HTTP ${res.status})`,
      res.status,
      body
    );
  }

  let json: { responseCode?: number; message?: string; data?: { verificationStatus?: string } };
  try {
    json = JSON.parse(body);
  } catch {
    throw new MessageCentralError("Message Central returned non-JSON body", res.status, body);
  }

  const status = json?.data?.verificationStatus;
  if (status === "VERIFICATION_COMPLETED") {
    return true;
  }

  throw new MessageCentralError(
    `OTP verification failed: ${json?.message ?? status ?? "unknown"}`,
    res.status,
    body
  );
}
