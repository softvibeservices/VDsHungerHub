// src/lib/msg91.ts

/**
 * MSG91 OTP Widget client — server-side token verification only.
 * Docs: https://docs.msg91.com/otp (Widget / verifyAccessToken)
 *
 * All functions are server-side only — never import this from client components.
 *
 * Architecture (No-DLT Widget path):
 *   SEND:   handled entirely by the MSG91 Widget JS on the frontend via window.sendOTP().
 *           The backend send-otp routes no longer call MSG91 at all.
 *   VERIFY: frontend calls window.verifyOTP(otp), which returns a JWT access token on
 *           success. The frontend then POSTs that token to our backend verify-otp routes,
 *           which call verifyWidgetToken() here to validate it with MSG91 and get back
 *           the verified mobile number.
 *
 * This replaces the previous sendOtp() / verifyOtp() pair that used MSG91's standard OTP
 * API (/api/v5/otp, /api/v5/otp/verify) — those endpoints require a DLT-registered
 * template and are no longer used.
 */

export class Msg91Error extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "Msg91Error";
  }
}

function getEnvConfig() {
  return {
    baseUrl: process.env.MSG91_BASE_URL ?? "https://control.msg91.com",
    authKey: process.env.MSG91_AUTH_KEY ?? "",
    widgetId: process.env.MSG91_WIDGET_ID ?? "",
  };
}

/**
 * Verifies the JWT access token returned by the MSG91 OTP Widget's success callback
 * on the frontend (window.verifyOTP(otp) → success({ message: jwtToken })).
 *
 * Endpoint: POST https://control.msg91.com/api/v5/widget/verifyAccessToken
 * Body:     { authkey: string, "access-token": string }
 *
 * On success MSG91 returns:
 *   { "type": "success", "message": "917016625488" }
 *   where `message` is the verified mobile in 91XXXXXXXXXX format.
 *
 * Returns the bare 10-digit mobile number (strips the "91" prefix) so it matches
 * the format stored in our database.
 *
 * Throws Msg91Error if the token is invalid, expired, or the network call fails.
 */
export async function verifyWidgetToken(widgetToken: string): Promise<string> {
  const { baseUrl, authKey } = getEnvConfig();

  if (!authKey) {
    throw new Msg91Error(
      "MSG91 credentials not configured. Set MSG91_AUTH_KEY in .env"
    );
  }

  if (!widgetToken) {
    throw new Msg91Error("widgetToken is required");
  }

  const url = `${baseUrl}/api/v5/widget/verifyAccessToken`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authkey: authKey,
      "access-token": widgetToken,
    }),
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Msg91Error(
      `MSG91 verifyWidgetToken failed (HTTP ${res.status})`,
      res.status,
      body
    );
  }

  let json: { type?: string; message?: string };
  try {
    json = JSON.parse(body);
  } catch {
    throw new Msg91Error("MSG91 returned non-JSON body", res.status, body);
  }

  if (json?.type !== "success") {
    throw new Msg91Error(
      `Widget token verification failed: ${json?.message ?? "unknown error"}`,
      res.status,
      body
    );
  }

  // MSG91 returns mobile in "91XXXXXXXXXX" format — strip the country code prefix
  const intlMobile = json.message ?? "";
  const mobile = intlMobile.startsWith("91") ? intlMobile.slice(2) : intlMobile;

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw new Msg91Error(
      `MSG91 returned unexpected mobile format: ${intlMobile}`,
      res.status,
      body
    );
  }

  return mobile; // bare 10-digit Indian mobile, matching our DB convention
}
