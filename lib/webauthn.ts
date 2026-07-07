export type WebAuthnBlock = "insecure" | "noWebauthn" | "noCredentials";

const BLOCK_ERRORS: Record<WebAuthnBlock, string> = {
  insecure: "Passkeys require HTTPS (or localhost).",
  noWebauthn: "This browser does not support passkeys.",
  noCredentials: "Credential Management API is unavailable.",
};

export function getWebAuthnBlock(): WebAuthnBlock | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) return "insecure";
  if (typeof window.PublicKeyCredential === "undefined") return "noWebauthn";
  if (
    typeof navigator === "undefined" ||
    !navigator.credentials ||
    typeof navigator.credentials.create !== "function" ||
    typeof navigator.credentials.get !== "function"
  ) {
    return "noCredentials";
  }
  return null;
}

export function requireWebAuthn(): void {
  const block = getWebAuthnBlock();
  if (block) throw new Error(BLOCK_ERRORS[block]);
}
