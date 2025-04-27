// controllers/dhServerController.js
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

// Store for server-client DH sessions
// serverClientDhSessions[userId] = { p, g, serverPrivKey, clientPub, sharedSecret }
const serverClientDhSessions = {};

// Store for shared session keys between users
// serverSessionKeys[sessionId] = { initiator, target, sessionKey, iv, timestamp }
const serverSessionKeys = {};

// Utility function to safely log cryptographic values
const safeLogKey = (key, length = 8) => {
  if (!key) return "undefined";
  return key.substring(0, length) + "...[tronqué]";
};

/**
 * GET /auth/dh/server/params
 * Returns DH parameters (p, g) for initiating DH with server
 */
const getServerDhParams = (req, res) => {
  const userId = req.user.userId;
  console.log(`[SERVER-DH] 🔑 USER ${userId} a demandé des paramètres DH`);

  const dh = crypto.getDiffieHellman("modp14");
  dh.generateKeys();

  const p = dh.getPrime("hex");
  const g = dh.getGenerator("hex");

  console.log(`[SERVER-DH] 📤 Paramètres générés pour USER ${userId}:`);
  console.log(`[SERVER-DH]    - p: ${safeLogKey(p, 16)}`);
  console.log(`[SERVER-DH]    - g: ${g}`);

  res.json({ p, g });
};

/**
 * POST /auth/dh/server/exchange
 * Client sends their public key, server generates and returns its public key
 * Creates shared secret between server and client
 */
const exchangeDhKeys = (req, res) => {
  const { p, g, clientPub } = req.body;
  const userId = req.user.userId;

  console.log(`[SERVER-DH] 📥 USER ${userId} a envoyé sa clé publique DH`);
  console.log(`[SERVER-DH]    - clientPub: ${safeLogKey(clientPub)}`);

  if (!p || !g || !clientPub) {
    console.log(`[SERVER-DH] ❌ Paramètres manquants de USER ${userId}`);
    return res.status(400).json({ message: "Paramètres DH manquants" });
  }

  try {
    console.log(
      `[SERVER-DH] 🔄 Génération de paire de clés pour le serveur...`
    );
    // Generate server key pair
    const dh = crypto.createDiffieHellman(
      Buffer.from(p, "hex"),
      Buffer.from(g, "hex")
    );
    dh.generateKeys();

    const serverPub = dh.getPublicKey().toString("hex");
    const serverPrivKey = dh.getPrivateKey().toString("hex");

    console.log(
      `[SERVER-DH]    - Clé privée serveur: ${safeLogKey(serverPrivKey)}`
    );
    console.log(
      `[SERVER-DH]    - Clé publique serveur: ${safeLogKey(serverPub)}`
    );

    // Compute shared secret
    console.log(
      `[SERVER-DH] 🔐 Calcul du secret partagé pour USER ${userId}...`
    );
    const sharedSecret = dh
      .computeSecret(Buffer.from(clientPub, "hex"))
      .toString("hex");

    console.log(`[SERVER-DH]    - Secret partagé: ${safeLogKey(sharedSecret)}`);

    // Store session info
    serverClientDhSessions[userId] = {
      p,
      g,
      serverPrivKey,
      clientPub,
      serverPub,
      sharedSecret,
      timestamp: Date.now(),
    };

    console.log(`[SERVER-DH] ✅ Échange DH réussi avec USER ${userId}`);
    console.log(
      `[SERVER-DH]    - Session stockée: serverClientDhSessions[${userId}]`
    );

    res.json({
      serverPub,
    });
  } catch (error) {
    console.error(
      `[SERVER-DH] 🚨 Erreur lors de l'échange DH avec USER ${userId}:`,
      error
    );
    res.status(500).json({ message: "Erreur lors de l'échange DH" });
  }
};

/**
 * POST /auth/dh/server/request-session-key
 * Client requests a session key for communication with another user
 * Server generates a random key and encrypts it for initiator
 * The key will be stored for the target to retrieve later when they establish DH
 */
const requestSessionKey = async (req, res) => {
  const { targetId } = req.body;
  const initiatorId = req.user.userId;

  console.log(
    `[SERVER-KEY] 🔑 USER ${initiatorId} demande une clé de session avec USER ${targetId}`
  );

  if (!targetId) {
    console.log(
      `[SERVER-KEY] ❌ ID cible manquant dans la requête de USER ${initiatorId}`
    );
    return res.status(400).json({ message: "ID utilisateur cible manquant" });
  }

  // Check if initiator has established DH with server
  if (!serverClientDhSessions[initiatorId]) {
    console.log(
      `[SERVER-KEY] ⚠️ USER ${initiatorId} n'a pas établi de session DH avec le serveur`
    );
    return res.status(400).json({
      message: "Vous devez d'abord établir une session DH avec le serveur",
    });
  }

  try {
    console.log(
      `[SERVER-KEY] 🔄 Génération d'une clé de session pour USER ${initiatorId} -> USER ${targetId}...`
    );
    // Generate a random session key (256 bits / 32 bytes for AES-256)
    const sessionKey = crypto.randomBytes(32).toString("hex");
    console.log(
      `[SERVER-KEY]    - Clé de session générée: ${safeLogKey(sessionKey)}`
    );

    // Generate a random IV (16 bytes for AES)
    const iv = crypto.randomBytes(16).toString("hex");
    console.log(`[SERVER-KEY]    - IV généré: ${safeLogKey(iv)}`);

    // Generate a unique session ID
    const sessionId = uuidv4();
    console.log(`[SERVER-KEY]    - ID de session: ${sessionId}`);

    // Get shared secret for initiator
    const initiatorSecret = serverClientDhSessions[initiatorId].sharedSecret;
    console.log(
      `[SERVER-KEY]    - Secret partagé avec initiateur: ${safeLogKey(
        initiatorSecret
      )}`
    );

    // Encrypt session key for initiator
    console.log(
      `[SERVER-KEY] 🔒 Chiffrement de la clé de session pour USER ${initiatorId}...`
    );
    const initiatorCipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(initiatorSecret.substring(0, 64), "hex").slice(0, 32),
      Buffer.from(iv, "hex")
    );
    let encryptedKeyForInitiator = initiatorCipher.update(
      sessionKey,
      "hex",
      "hex"
    );
    encryptedKeyForInitiator += initiatorCipher.final("hex");
    console.log(
      `[SERVER-KEY]    - Clé chiffrée pour initiateur: ${safeLogKey(
        encryptedKeyForInitiator
      )}`
    );

    // Store session key info - even if target hasn't established DH yet
    serverSessionKeys[sessionId] = {
      initiator: initiatorId,
      target: parseInt(targetId),
      sessionKey,
      iv,
      timestamp: Date.now(),
    };

    console.log(`[SERVER-KEY] ✅ Clé de session stockée avec succès`);
    console.log(`[SERVER-KEY]    - sessionId: ${sessionId}`);
    console.log(`[SERVER-KEY]    - initiator: ${initiatorId}`);
    console.log(`[SERVER-KEY]    - target: ${targetId}`);

    // Get the io instance from the app
    const io = req.app.get("io");

    // Notify target user of new session availability (if they're online)
    console.log(
      `[SERVER-KEY] 📣 Notification envoyée à USER ${targetId} pour la nouvelle session ${sessionId}`
    );
    io.to(`user:${targetId}`).emit("server-session-available", {
      sessionId,
      initiatorId,
    });

    res.json({
      sessionId,
      encryptedSessionKey: encryptedKeyForInitiator,
      iv,
      targetId: parseInt(targetId),
    });
  } catch (error) {
    console.error(
      `[SERVER-KEY] 🚨 Erreur lors de la génération de clé pour USER ${initiatorId} et USER ${targetId}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Erreur lors de la génération de la clé de session" });
  }
};

/**
 * GET /auth/dh/server/get-session-key/:sessionId
 * Target user retrieves their encrypted session key
 * This requires that the target has now established DH with the server
 */
const getSessionKey = (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  console.log(
    `[SERVER-KEY] 🔍 USER ${userId} demande la clé pour la session ${sessionId}`
  );

  if (!serverSessionKeys[sessionId]) {
    console.log(
      `[SERVER-KEY] ❌ Session ${sessionId} introuvable pour USER ${userId}`
    );
    return res.status(404).json({ message: "Session introuvable" });
  }

  const session = serverSessionKeys[sessionId];
  console.log(
    `[SERVER-KEY]    - Session trouvée: initiateur=${session.initiator}, cible=${session.target}`
  );

  // Verify user is part of this session
  if (session.target !== userId && session.initiator !== userId) {
    console.log(
      `[SERVER-KEY] ⛔ USER ${userId} n'est pas autorisé pour la session ${sessionId}`
    );
    return res.status(403).json({ message: "Non autorisé pour cette session" });
  }

  const userRole = userId === session.initiator ? "initiateur" : "cible";
  console.log(
    `[SERVER-KEY]    - USER ${userId} est ${userRole} dans cette session`
  );

  // Check if the user has established DH with server
  if (!serverClientDhSessions[userId]) {
    console.log(
      `[SERVER-KEY] ⚠️ USER ${userId} n'a pas établi de session DH avec le serveur`
    );
    return res.status(400).json({
      message: "Vous devez d'abord établir une session DH avec le serveur",
    });
  }

  try {
    // Get the user's shared secret with server
    const userSecret = serverClientDhSessions[userId].sharedSecret;
    console.log(
      `[SERVER-KEY]    - Secret partagé de USER ${userId} avec serveur: ${safeLogKey(
        userSecret
      )}`
    );

    // Encrypt session key for this user
    console.log(
      `[SERVER-KEY] 🔒 Chiffrement de la clé de session pour USER ${userId}...`
    );
    const userCipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(userSecret.substring(0, 64), "hex").slice(0, 32),
      Buffer.from(session.iv, "hex")
    );
    let encryptedKey = userCipher.update(session.sessionKey, "hex", "hex");
    encryptedKey += userCipher.final("hex");
    console.log(
      `[SERVER-KEY]    - Clé de session chiffrée: ${safeLogKey(encryptedKey)}`
    );

    console.log(
      `[SERVER-KEY] ✅ Clé de session envoyée à USER ${userId} pour session ${sessionId}`
    );

    // Return response based on user's role in the session
    if (userId === session.initiator) {
      return res.json({
        sessionId,
        encryptedSessionKey: encryptedKey,
        iv: session.iv,
        targetId: session.target,
      });
    } else {
      return res.json({
        sessionId,
        encryptedSessionKey: encryptedKey,
        iv: session.iv,
        initiatorId: session.initiator,
      });
    }
  } catch (error) {
    console.error(
      `[SERVER-KEY] 🚨 Erreur lors de la récupération de clé pour USER ${userId}:`,
      error
    );
    return res
      .status(500)
      .json({ message: "Erreur lors de la récupération de la clé de session" });
  }
};

/**
 * POST /auth/dh/server/find-session
 * Find existing session between two users
 */
const findServerSession = (req, res) => {
  const { otherId } = req.body;
  const userId = req.user.userId;

  console.log(
    `[SERVER-KEY] 🔍 USER ${userId} recherche une session avec USER ${otherId}`
  );

  if (!otherId) {
    console.log(
      `[SERVER-KEY] ❌ ID cible manquant dans la requête de USER ${userId}`
    );
    return res.status(400).json({ message: "ID utilisateur cible manquant" });
  }

  // Find session where the current user and the other user are participants
  const sessionId = Object.keys(serverSessionKeys).find((id) => {
    const session = serverSessionKeys[id];
    return (
      (session.initiator === userId && session.target === Number(otherId)) ||
      (session.initiator === Number(otherId) && session.target === userId)
    );
  });

  if (sessionId) {
    const session = serverSessionKeys[sessionId];
    console.log(
      `[SERVER-KEY] ✅ Session ${sessionId} trouvée entre USER ${userId} et USER ${otherId}`
    );
    console.log(
      `[SERVER-KEY]    - Initiateur: ${session.initiator}, Cible: ${session.target}`
    );
    console.log(
      `[SERVER-KEY]    - Date de création: ${new Date(
        session.timestamp
      ).toLocaleString()}`
    );
    return res.json({ sessionId });
  } else {
    console.log(
      `[SERVER-KEY] ❌ Aucune session trouvée entre USER ${userId} et USER ${otherId}`
    );
    return res.status(404).json({ message: "Aucune session trouvée" });
  }
};

/**
 * GET /auth/dh/server/check/user/:userId
 * Check if a user has established DH with server
 * This endpoint is for informational purposes only
 */
const checkUserDhStatus = (req, res) => {
  const { userId } = req.params;
  const requesterId = req.user.userId;

  console.log(
    `[SERVER-DH] 🔍 USER ${requesterId} vérifie le statut DH de USER ${userId}`
  );

  const hasEstablishedDh = !!serverClientDhSessions[userId];

  if (hasEstablishedDh) {
    const dhSession = serverClientDhSessions[userId];
    console.log(
      `[SERVER-DH] ✅ USER ${userId} a établi DH le ${new Date(
        dhSession.timestamp
      ).toLocaleString()}`
    );
  } else {
    console.log(`[SERVER-DH] ❌ USER ${userId} n'a pas établi de session DH`);
  }

  return res.json({
    userId: parseInt(userId),
    hasEstablishedDh,
    timestamp: hasEstablishedDh
      ? serverClientDhSessions[userId].timestamp
      : null,
  });
};

module.exports = {
  getServerDhParams,
  exchangeDhKeys,
  requestSessionKey,
  getSessionKey,
  findServerSession,
  checkUserDhStatus,
  serverClientDhSessions,
  serverSessionKeys,
};
