import {
  createRpClient,
  getLoginOptions,
  getLoginVerification,
  getRegistrationOptions,
  getRegistrationVerification,
  toPasskeyTransport,
  WebAuthnMode,
} from "@circle-fin/modular-wallets-core";
import type { P256Credential } from "viem/account-abstraction";
import {
  base64UrlToBytes,
  parseCredentialPublicKey,
  serializePublicKey,
} from "webauthn-p256";
import {
  mapPasskeyRpcError,
  normalizeCircleClientUrl,
  serializeWebAuthnAssertion,
  serializeWebAuthnCredential,
  toCirclePasskeyUsername,
} from "@/lib/passkey-utils";

type CircleRegistrationOptions = Awaited<
  ReturnType<typeof getRegistrationOptions>
>;
type CircleLoginOptions = Awaited<ReturnType<typeof getLoginOptions>>;

function adaptCredentialCreationOptions(
  options: CircleRegistrationOptions,
): PublicKeyCredentialCreationOptions {
  const isChromeExtension =
    typeof window !== "undefined" && window.location?.protocol === "chrome-extension:";

  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64UrlToBytes(options.challenge) as BufferSource,
    user: {
      ...options.user,
      id: base64UrlToBytes(options.user.id) as BufferSource,
    },
  };

  if (isChromeExtension) {
    const { rp, ...rest } = publicKey;
    const { id: _ignored, ...rpWithoutId } = rp;
    return { ...rest, rp: rpWithoutId };
  }

  return publicKey;
}

function adaptCredentialRequestOptions(
  options: CircleLoginOptions,
): PublicKeyCredentialRequestOptions {
  const isChromeExtension =
    typeof window !== "undefined" && window.location?.protocol === "chrome-extension:";

  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64UrlToBytes(options.challenge) as BufferSource,
    allowCredentials: options.allowCredentials?.map((credential) => ({
      ...credential,
      id: base64UrlToBytes(credential.id) as BufferSource,
    })),
  };

  if (isChromeExtension) {
    const { rpId: _ignored, ...rest } = publicKey;
    return rest;
  }

  return publicKey;
}

function publicKeyFromAttestation(response: AuthenticatorAttestationResponse): Uint8Array {
  const direct = response.getPublicKey?.();
  if (direct?.byteLength) return new Uint8Array(direct);

  throw new Error(
    "Could not read your passkey public key on this device. Update iOS/Safari and try again.",
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function parseBase64EncodedPublicKey(base64Url: string) {
  return parseCredentialPublicKey(toArrayBuffer(base64UrlToBytes(base64Url)));
}

export async function createPasskeyCredential(
  clientUrl: string,
  clientKey: string,
  username: string,
): Promise<P256Credential> {
  const circleUsername = toCirclePasskeyUsername(username);
  const transport = toPasskeyTransport(
    normalizeCircleClientUrl(clientUrl),
    clientKey,
  );
  const client = createRpClient({ transport });

  try {
    const registrationOptions = await getRegistrationOptions(client, {
      username: circleUsername,
    });

    const credential = (await navigator.credentials.create({
      publicKey: adaptCredentialCreationOptions(registrationOptions),
    })) as PublicKeyCredential | null;

    if (!credential) throw new Error("No credential created.");

    await getRegistrationVerification(client, {
      credential: serializeWebAuthnCredential(credential) as unknown as PublicKeyCredential,
    });

    const publicKeyBytes = publicKeyFromAttestation(
      credential.response as AuthenticatorAttestationResponse,
    );
    const publicKey = await parseCredentialPublicKey(toArrayBuffer(publicKeyBytes));

    return {
      id: credential.id,
      publicKey: serializePublicKey(publicKey, { compressed: true }),
      raw: credential,
    };
  } catch (error) {
    throw new Error(mapPasskeyRpcError(error), { cause: error });
  }
}

export async function loginPasskeyCredential(
  clientUrl: string,
  clientKey: string,
): Promise<P256Credential> {
  const transport = toPasskeyTransport(
    normalizeCircleClientUrl(clientUrl),
    clientKey,
  );
  const client = createRpClient({ transport });

  try {
    const loginOptions = await getLoginOptions(client, {
      userId: "",
    });

    const credential = (await navigator.credentials.get({
      publicKey: adaptCredentialRequestOptions(loginOptions),
    })) as PublicKeyCredential | null;

    if (!credential) throw new Error("No credential available.");

    const { publicKey: base64Url } = await getLoginVerification(client, {
      credential: serializeWebAuthnAssertion(credential) as unknown as PublicKeyCredential,
    });

    if (!base64Url) throw new Error("Login verification failed.");

    const publicKey = await parseBase64EncodedPublicKey(base64Url);

    return {
      id: credential.id,
      publicKey: serializePublicKey(publicKey, { compressed: true }),
      raw: credential,
    };
  } catch (error) {
    throw new Error(mapPasskeyRpcError(error), { cause: error });
  }
}

export { WebAuthnMode };
