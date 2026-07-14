import { permanentRedirect } from "next/navigation";

/**
 * /order is the legacy customer ordering URL.
 * The canonical URL is now /menu — all traffic redirects there permanently.
 * (next.config.ts also covers static redirects; this handles server-component-level redirect)
 */
export default function LegacyOrderPage() {
  permanentRedirect("/menu");
}
