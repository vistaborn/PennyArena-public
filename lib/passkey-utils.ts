/** Circle Modular Wallets client URL without a trailing slash. */
export function normalizeCircleClientUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Username accepted by Circle's rp_getRegistrationOptions.
 * Profile @username is set separately after wallet connect.
 */
export function toCirclePasskeyUsername(username: string): string {
  const slug = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+/, "")
    .slice(0, 64);
  if (slug.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }
  return slug;
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Safari/iOS often cannot JSON.stringify a native PublicKeyCredential for Circle's API.
 * Convert to the WebAuthn JSON shape expected by rp_getRegistrationVerification.
 */
export function serializeWebAuthnCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse & {
    getTransports?: () => string[];
    getPublicKey?: () => ArrayBuffer | null;
    getPublicKeyAlgorithm?: () => number;
  };

  const payload: Record<string, unknown> = {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      attestationObject: bytesToBase64Url(response.attestationObject),
    },
  };

  const transports = response.getTransports?.();
  if (transports?.length) {
    (payload.response as Record<string, unknown>).transports = transports;
  }

  const publicKey = response.getPublicKey?.();
  if (publicKey) {
    (payload.response as Record<string, unknown>).publicKey = bytesToBase64Url(publicKey);
  }

  const algorithm = response.getPublicKeyAlgorithm?.();
  if (algorithm !== undefined) {
    (payload.response as Record<string, unknown>).publicKeyAlgorithm = algorithm;
  }

  return payload;
}

export function serializeWebAuthnAssertion(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bytesToBase64Url(response.authenticatorData),
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      signature: bytesToBase64Url(response.signature),
      userHandle: response.userHandle?.byteLength
        ? bytesToBase64Url(response.userHandle)
        : null,
    },
  };
}

export function mapPasskeyRpcError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const details =
    error instanceof Error && "details" in error
      ? String((error as Error & { details?: string }).details ?? "")
      : "";

  if (
    message.includes("API parameter invalid") ||
    details.includes("API parameter invalid") ||
    message.includes("Missing or invalid parameters")
  ) {
    const host =
      typeof window !== "undefined" ? window.location.hostname : "this site";
    return [
      "Passkey registration failed for this site.",
      `Confirm Circle Console → Passkey Domain and Client Key Allowed Domain are both set to "${host}".`,
      "Then try Register again in Safari/Chrome on your phone.",
    ].join(" ");
  }

  if (message.includes("SecurityError")) {
    return "Passkey domain mismatch. Update Circle Console Passkey Domain to match this website URL.";
  }

  return message;
}
