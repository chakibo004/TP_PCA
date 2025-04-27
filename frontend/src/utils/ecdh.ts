// src/utils/ecdh.ts
// Helpers pour ECDH via WebCrypto
export async function generateEcdhKeyPair() {
  return window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // on peut exporter la clé publique
    ["deriveKey", "deriveBits"]
  );
}

export async function exportPublicKey(key: CryptoKey) {
  return window.crypto.subtle.exportKey("jwk", key);
}

export async function importPublicKey(jwk: JsonWebKey) {
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<ArrayBuffer> {
  // 256 bits de secret
  return window.crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256
  );
}
