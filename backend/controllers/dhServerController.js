const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { users } = require("./authController"); // To find Bob's socket

// --- DH Parameters (Keep consistent with peer controller or use separate ones) ---
// Using pre-computed MODP group 14 (2048-bit) parameters for simplicity
// --- DH Parameters (Keep consistent with peer controller or use separate ones) ---
// Using pre-computed MODP group 14 (2048-bit) parameters for simplicity
const p_hex =
  "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
  "29024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
  "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245" +
  "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED" +
  "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D" +
  "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F" +
  "83655D23DCA3AD961C62F356208552BB9ED529077096966D" +
  "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B" +
  "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9" +
  "DE2BCBF6955817183995497CEA956AE515D2261898FA0510" +
  "15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64" +
  "ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7" +
  "ABF5AE8CDB0933D71E8C94E04A25619DCEF135F0F82D8E03" +
  "85E7D7AB85C1ACAA3EDF058D04FE5E166D91A34B95F7336B" +
  "EBAFBC4EDDB70273E0988EA67BC3BEE391737EA6F4D89473" +
  "5B48617C5F5CED7989DF487C83F22A0F2198A9427E8777CE" +
  "6894F04061A91313583A4F456AD8405681B31E71F9481113" +
  "494F655C3EC1A649E49C737301845FD7B54996D4F53B45DB" +
  "64901E037D5A8FF6A9F31A3B5E43FFA05B";

// Fix: Convert hex strings to actual buffers properly
const p = Buffer.from(p_hex, "hex");
// Fix: Use a number for g instead of a Buffer since it's a small value
const g = 2; // Using the number 2 directly instead of Buffer.from(g_hex, "hex")

// In-memory store for DH state between server and clients
// Structure: { userId: { sharedSecretHex, keyHex, ivHex, createdAt } }
const serverClientDhSessions = {};

// --- Helper to derive AES key and IV from shared secret ---
const deriveKeysFromSecret = (sharedSecretHex) => {
  const hash = crypto
    .createHash("sha512")
    .update(Buffer.from(sharedSecretHex, "hex"))
    .digest("hex");
  const keyHex = hash.slice(0, 64); // 256 bits for AES key
  const ivHex = hash.slice(64, 96); // 128 bits for IV
  return { keyHex, ivHex };
};

// --- Helper for AES Encryption (CBC with PKCS7 padding) ---
const encryptAES = (plaintextUtf8, keyHex, ivHex) => {
  try {
    const key = Buffer.from(keyHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(plaintextUtf8, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString("base64");
  } catch (error) {
    console.error("AES Encryption failed:", error.message);
    return null;
  }
};

// --- Helper for AES Decryption (CBC with PKCS7 padding) ---
// Note: Decryption might only be needed on the client-side in this KDC model
const decryptAES = (ciphertextB64, keyHex, ivHex) => {
  try {
    const key = Buffer.from(keyHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    // Basic unpadding (PKCS7) - Consider a library for robustness
    const padding = decrypted[decrypted.length - 1];
    if (padding > 16 || padding === 0) {
      console.warn("Potential invalid padding detected during decryption.");
    } else {
      let validPadding = true;
      for (let i = 0; i < padding; i++) {
        if (decrypted[decrypted.length - 1 - i] !== padding) {
          validPadding = false;
          break;
        }
      }
      if (validPadding) {
        decrypted = decrypted.slice(0, decrypted.length - padding);
      } else {
        console.warn("Invalid PKCS7 padding detected.");
      }
    }
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("AES Decryption failed:", error.message);
    return null; // Indicate decryption failure
  }
};

/**
 * @description Provide DH parameters (p, g) to the client
 * @route GET /api/dh/server/params
 * @access Private
 */
const getServerDhParams = (req, res) => {
  res.json({ p: p_hex, g: g_hex });
};
/**
 * @description Client sends its public key, server calculates shared secret
 * @route POST /api/dh/server/exchange
 * @access Private
 */
const exchangeDhKeys = (req, res) => {
  // Fix for undefined userId - add safeguard
  const userId = req.user?.id;

  console.log(`🔄 DH Key Exchange requested by User ${userId || "unknown"}`);
  console.log(`🔍 req.user object:`, req.user); // Debug the entire user object

  if (!userId) {
    console.error(`❌ Authentication error: No user ID in request`);
    return res
      .status(401)
      .json({ message: "Authentication failed: No user ID found" });
  }

  const { clientPubHex } = req.body; // Client's public key (A or B)

  if (!clientPubHex) {
    console.error(`❌ [User ${userId}] Missing client public key in request`);
    return res.status(400).json({ message: "Client public key is required" });
  }

  try {
    console.log(`🔑 [User ${userId}] Generating server DH parameters`);

    // 1. Server generates its ephemeral key pair for this exchange
    // Fix: Create DH instance AND explicitly generate key pair
    const serverDH = crypto.createDiffieHellman(p, g);
    serverDH.generateKeys(); // <-- This was missing! Need to explicitly generate keys

    const serverPubHex = serverDH.getPublicKey("hex");

    console.log(
      `✅ [User ${userId}] Generated server public key: ${serverPubHex.substring(
        0,
        10
      )}...`
    );

    // 2. Server computes the shared secret
    console.log(
      `🔐 [User ${userId}] Computing shared secret with client public key: ${clientPubHex.substring(
        0,
        10
      )}...`
    );
    const sharedSecret = serverDH.computeSecret(
      Buffer.from(clientPubHex, "hex")
    );
    const sharedSecretHex = sharedSecret.toString("hex");
    console.log(
      `✅ [User ${userId}] Computed shared secret: ${sharedSecretHex.substring(
        0,
        10
      )}...`
    );

    // 3. Derive AES keys
    console.log(`🔑 [User ${userId}] Deriving AES keys from shared secret`);
    const { keyHex, ivHex } = deriveKeysFromSecret(sharedSecretHex);

    // 4. Store the shared secret and derived keys for this user
    serverClientDhSessions[userId] = {
      sharedSecretHex, // Store the secret
      keyHex, // Store derived key
      ivHex, // Store derived IV
      createdAt: new Date(),
    };

    console.log(
      `✅ [User ${userId}] DH shared secret established and stored: ${sharedSecretHex.substring(
        0,
        10
      )}...`
    );
    console.log(`  Derived Key: ${keyHex.substring(0, 10)}...`);
    console.log(`  Derived IV: ${ivHex.substring(0, 10)}...`);

    // 5. Send Server's public key back to the client
    console.log(`📤 [User ${userId}] Sending server public key back to client`);
    res.json({ serverPubHex });
  } catch (error) {
    console.error(`❌ [User ${userId}] DH key exchange error:`, error);
    res.status(500).json({ message: "DH key exchange failed" });
  }
};
// The rest of your code remains unchanged...

/**
 * @description KDC Function: Generate session key (Ks) and distribute securely
 * @route POST /api/dh/server/request-session-key
 * @access Private
 */
const requestSessionKey = async (req, res) => {
  const initiatorId = req.user.id;
  const { targetId } = req.body;

  if (!targetId) {
    return res.status(400).json({ message: "Target ID is required" });
  }
  const targetIdNum = parseInt(targetId, 10);
  if (isNaN(targetIdNum) || initiatorId === targetIdNum) {
    return res.status(400).json({ message: "Invalid Target ID" });
  }

  // 1. Check if DH sessions exist for both users with the server
  const initiatorDhSession = serverClientDhSessions[initiatorId];
  const targetDhSession = serverClientDhSessions[targetIdNum];

  if (!initiatorDhSession || !initiatorDhSession.keyHex) {
    return res
      .status(400)
      .json({ message: "Initiator DH session not established with server" });
  }
  if (!targetDhSession || !targetDhSession.keyHex) {
    // Handle offline target or target who hasn't done DH exchange
    return res
      .status(400)
      .json({ message: "Target DH session not established with server" });
  }

  try {
    // 2. Generate the new symmetric session key (Ks)
    const sessionKeyKs = crypto.randomBytes(32); // 256-bit AES key
    const sessionKeyKsHex = sessionKeyKs.toString("hex");
    const sessionId = uuidv4(); // Unique ID for this specific chat session

    console.log(
      `Generated Session Key (Ks) ${sessionId} for ${initiatorId}<->${targetIdNum}: ${sessionKeyKsHex.substring(
        0,
        10
      )}...`
    );

    // 3. Encrypt Ks for Initiator (A) using S_AS keys
    const packageForA = {
      sessionId,
      sessionKey: sessionKeyKsHex,
      peerId: targetIdNum, // Let A know who this key is for
    };
    const encryptedKsForA = encryptAES(
      JSON.stringify(packageForA),
      initiatorDhSession.keyHex,
      initiatorDhSession.ivHex
    );
    if (!encryptedKsForA)
      throw new Error("Failed to encrypt key for initiator");

    // 4. Encrypt Ks for Target (B) using S_BS keys
    const packageForB = {
      sessionId,
      sessionKey: sessionKeyKsHex,
      peerId: initiatorId, // Let B know who this key is from
    };
    const encryptedKsForB = encryptAES(
      JSON.stringify(packageForB),
      targetDhSession.keyHex,
      targetDhSession.ivHex
    );
    if (!encryptedKsForB) throw new Error("Failed to encrypt key for target");

    // 5. Send encrypted Ks to Initiator (A) via HTTP response
    res.status(201).json({
      message: "Session key generated. Sending encrypted key.",
      sessionId, // Send the session ID in plaintext
      encryptedKeyPackage: encryptedKsForA, // Send A their encrypted package
    });

    // 6. Send encrypted Ks to Target (B) via WebSocket
    const io = req.app.get("io"); // Get io instance from app
    // **Important**: Ensure 'users' object in authController is correctly populated with socketId
    const targetUser = users[targetIdNum]; // Get user object which should contain socketId
    const targetSocketId = targetUser?.socketId;

    if (targetSocketId) {
      io.to(targetSocketId).emit("session-key-offer", {
        // Use a specific event name
        sessionId,
        encryptedKeyPackage: encryptedKsForB, // Send B their encrypted package
      });
      console.log(
        `Sent encrypted session key package to target ${targetIdNum} via socket ${targetSocketId}`
      );
    } else {
      console.warn(
        `Target user ${targetIdNum} is offline. Cannot deliver session key package via socket.`
      );
      // How to handle this?
      // - Fail the request?
      // - Let initiator know target is offline?
      // - Store the package and deliver when B connects? (More complex)
      // For now, the initiator gets their key, but the target doesn't.
    }

    // Note: The server does NOT store Ks. It only uses S_AS and S_BS to transport Ks.
  } catch (error) {
    console.error("Error requesting session key:", error);
    res.status(500).json({ message: "Server error generating session key" });
  }
};

module.exports = {
  getServerDhParams,
  exchangeDhKeys,
  requestSessionKey,
  serverClientDhSessions, // Export for potential use elsewhere (e.g., checking)
  deriveKeysFromSecret, // Export helper if needed
  encryptAES, // Export helper if needed
  decryptAES, // Export helper if needed
};
