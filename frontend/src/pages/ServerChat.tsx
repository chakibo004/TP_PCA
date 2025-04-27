import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import CryptoJS from "crypto-js";
import { BigInteger } from "jsbn";
import { io, Socket } from "socket.io-client";
import {
  useGetServerDhParamsQuery,
  useExchangeDhKeysMutation,
  useRequestSessionKeyMutation,
  useGetSessionKeyQuery,
  useSendServerMessageMutation,
  useGetServerMessagesQuery,
  useGetUsersQuery,
} from "../redux/apiSlice";
import { useAppSelector } from "../redux/hooks";
import AlertService from "../utils/AlertService";
import { ArrowLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/solid";

// --- Constants for localStorage keys ---
const getSessionKeyStorageKey = (sessionId: string) =>
  `server_session_key_${sessionId}`;
const getSessionIvStorageKey = (sessionId: string) =>
  `server_session_iv_${sessionId}`;
const getServerSharedSecretKey = (sessionId: string) =>
  `server_shared_secret_${sessionId}`;

// --- Message Interface ---
interface Message {
  id: number;
  sessionId: string;
  senderId: number;
  ciphertext: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read";
  isServerSession: boolean;
}

// --- Chat Component ---
const ServerChat: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const flow = (params.get("flow") as "peer" | "server") || "server";
  const targetIdParam = params.get("target"); // User ID we want to chat with
  const initialSessionId = params.get("session"); // Existing session ID (if joining)
  const me = useAppSelector((s) => s.auth.user?.id)!;

  // --- State Variables ---
  const [sessionId, setSessionId] = useState(initialSessionId || "");
  const initialServerSecret = initialSessionId
    ? localStorage.getItem(getServerSharedSecretKey(initialSessionId))
    : null;
  const [serverSharedSecret, setServerSharedSecret] = useState<string | null>(
    initialServerSecret
  );
  const [isDhWithServerComplete, setIsDhWithServerComplete] =
    useState(!!initialServerSecret);

  // Initialize keys from localStorage if session ID exists
  const [keyHex, setKeyHex] = useState<string | null>(() => {
    if (!initialSessionId) return null;
    return localStorage.getItem(getSessionKeyStorageKey(initialSessionId));
  });

  const [ivHex, setIvHex] = useState<string | null>(() => {
    if (!initialSessionId) return null;
    return localStorage.getItem(getSessionIvStorageKey(initialSessionId));
  });

  // If we have initialSessionId, keyHex and ivHex from localStorage, we can set connectionReady initially
  const [isConnectionReady, setIsConnectionReady] = useState(
    !!(initialSessionId && keyHex && ivHex)
  );

  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [targetUser, setTargetUser] = useState<{
    id: number;
    username: string;
  } | null>(null);
  const [isPeerOnline, setIsPeerOnline] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    initialSessionId && keyHex && ivHex
      ? "Retrieving messages..."
      : initialServerSecret
        ? "Retrieving session details..."
        : "Initializing secure connection..."
  );

  const dhExchangeAttempted = useRef(false);
  const sessionKeyRequestAttempted = useRef(false);
  const messagesLoaded = useRef(false);

  // --- RTK Query Hooks ---
  const { data: dhParams, isLoading: isLoadingDhParams } =
    useGetServerDhParamsQuery(undefined, {
      skip: flow !== "server",
    });

  const [exchangeKeys, { isLoading: isExchangingKeys }] =
    useExchangeDhKeysMutation();
  const [requestSessionKey, { isLoading: isRequestingKey }] =
    useRequestSessionKeyMutation();

  const {
    data: sessionKeyData,
    isLoading: isLoadingSessionKey,
    isFetching: isFetchingSessionKey,
  } = useGetSessionKeyQuery(sessionId, {
    // Ne pas récupérer avant que DH avec le serveur soit complet
    skip:
      flow !== "server" || !sessionId || !!keyHex || !isDhWithServerComplete,
  });

  const [sendServerMessage] = useSendServerMessageMutation();

  // Important: only skip if we don't have a sessionId, but always fetch if we have sessionId
  const {
    data: serverMsgsData,
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useGetServerMessagesQuery(sessionId, {
    skip: flow !== "server" || !sessionId,
    // Remove isConnectionReady from skip condition to ensure messages are always fetched
  });

  const { data: users } = useGetUsersQuery();
  // Ajouter ces nouvelles fonctions pour stocker/récupérer l'ID cible dans localStorage
  const getTargetUserIdStorageKey = (sessionId: string) =>
    `server_target_user_${sessionId}`;

  // Dans le composant ServerChat, modifier l'effet qui détermine l'utilisateur cible:
  // --- Determine Target User ---
  useEffect(() => {
    if (!users) return;

    let determinedTargetId: number | undefined;

    // Première option: utiliser targetIdParam (pour les nouvelles conversations)
    if (targetIdParam) {
      determinedTargetId = Number(targetIdParam);
    }
    // Deuxième option: extraire de sessionKeyData
    else if (sessionKeyData) {
      if (sessionKeyData.initiatorId && sessionKeyData.initiatorId !== me) {
        determinedTargetId = sessionKeyData.initiatorId;
      } else if (sessionKeyData.targetId && sessionKeyData.targetId !== me) {
        determinedTargetId = sessionKeyData.targetId;
      }
    }
    // Troisième option: trouver dans les messages
    else if (sessionId && serverMsgsData && serverMsgsData.length > 0) {
      const otherMessage = serverMsgsData.find((m) => m.senderId !== me);
      if (otherMessage) {
        determinedTargetId = otherMessage.senderId;
      }
    }
    // NOUVEAU: Quatrième option (fallback) - récupérer du localStorage
    else if (sessionId) {
      const savedTargetId = localStorage.getItem(
        getTargetUserIdStorageKey(sessionId)
      );
      if (savedTargetId) {
        determinedTargetId = Number(savedTargetId);
        console.log(
          `[User ${me}] Target user recovered from localStorage: ${savedTargetId}`
        );
      }
    }

    if (determinedTargetId) {
      const user = users.find((u) => u.id === determinedTargetId);
      if (user) {
        setTargetUser(user);
        // NOUVEAU: Sauvegarder l'ID de l'utilisateur cible dans localStorage
        if (sessionId) {
          localStorage.setItem(
            getTargetUserIdStorageKey(sessionId),
            determinedTargetId.toString()
          );
        }
        console.log(
          `[User ${me}] Target user determined: ${user.username} (${user.id})`
        );
      } else {
        console.warn(
          `[User ${me}] Target user with ID ${determinedTargetId} not found in user list.`
        );
      }
    }
  }, [users, targetIdParam, sessionKeyData, sessionId, me, serverMsgsData]);
  // --- Step 1: Establish DH Exchange with Server (if needed) ---
  useEffect(() => {
    if (flow !== "server" || dhExchangeAttempted.current) return;

    if (serverSharedSecret) {
      console.log(`[User ${me}] Using existing DH shared secret with server.`);
      setIsDhWithServerComplete(true);
      dhExchangeAttempted.current = true;
      return;
    }

    if (!dhParams || isLoadingDhParams) {
      console.log(`[User ${me}] Waiting for DH parameters to load...`);
      return;
    }

    dhExchangeAttempted.current = true;
    setStatusMessage("Establishing secure channel with server...");
    console.log(`[User ${me}] Initiating DH exchange with server...`);

    const { p, g } = dhParams;
    const aHex = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    const pBig = new BigInteger(p, 16);
    const gBig = new BigInteger(g, 16);
    const aBig = new BigInteger(aHex, 16);
    const clientPubHex = gBig.modPow(aBig, pBig).toString(16);

    exchangeKeys({ p, g, clientPub: clientPubHex })
      .unwrap()
      .then(({ serverPub }) => {
        const serverPubBig = new BigInteger(serverPub, 16);
        const sharedSecretHex = serverPubBig.modPow(aBig, pBig).toString(16);

        console.log(
          `[User ${me}] DH exchange with server successful. Shared secret calculated.`
        );
        // Stockage par session et non par utilisateur
        if (sessionId) {
          localStorage.setItem(
            getServerSharedSecretKey(sessionId),
            sharedSecretHex
          );
        } else {
          // Pour le flow d'initiation où sessionId n'est pas encore disponible
          localStorage.setItem(`temp_server_secret_${me}`, sharedSecretHex);
        }

        setServerSharedSecret(sharedSecretHex);
        setIsDhWithServerComplete(true);
      })
      .catch((e) => {
        console.error("DH key exchange with server failed:", e);
        dhExchangeAttempted.current = false; // Allow retry
        AlertService.error(
          "Server Connection Failed",
          e.data?.message ||
            "Could not establish secure connection with server."
        );
        setStatusMessage("Failed to connect securely with server. Retrying...");
      });
  }, [flow, dhParams, isLoadingDhParams, serverSharedSecret, exchangeKeys, me]);

  // --- Step 2: Session Key Management ---
  useEffect(() => {
    if (
      flow !== "server" ||
      !isDhWithServerComplete ||
      !serverSharedSecret ||
      keyHex ||
      sessionKeyRequestAttempted.current
    ) {
      return;
    }

    // --- A: Initiator Flow (targetIdParam exists) ---
    if (targetIdParam) {
      sessionKeyRequestAttempted.current = true;
      setStatusMessage("Requesting secure session key...");
      console.log(
        `[User ${me}] Requesting new session key for target ${targetIdParam}...`
      );

      requestSessionKey({ targetId: targetIdParam })
        .unwrap()
        .then(({ sessionId: newSessionId, encryptedSessionKey, iv }) => {
          console.log(
            `[User ${me}] Received encrypted session key for session ${newSessionId}. Decrypting...`
          );
          try {
            const aesKeyBytes = CryptoJS.enc.Hex.parse(
              serverSharedSecret.substring(0, 64)
            );
            const ivBytes = CryptoJS.enc.Hex.parse(iv);
            const cipherParams = CryptoJS.lib.CipherParams.create({
              ciphertext: CryptoJS.enc.Hex.parse(encryptedSessionKey),
            });
            const decryptedBytes = CryptoJS.AES.decrypt(
              cipherParams,
              aesKeyBytes,
              { iv: ivBytes }
            );
            const sessionKeyHex = decryptedBytes.toString(CryptoJS.enc.Hex);

            if (!sessionKeyHex)
              throw new Error("Decryption resulted in empty key");

            console.log(
              `[User ${me}] Session key decrypted successfully for session ${newSessionId}.`
            );
            localStorage.setItem(
              getSessionKeyStorageKey(newSessionId),
              sessionKeyHex
            );
            localStorage.setItem(getSessionIvStorageKey(newSessionId), iv);
            setSessionId(newSessionId);
            setKeyHex(sessionKeyHex);
            setIvHex(iv);
            setStatusMessage("Secure connection established.");
            setIsConnectionReady(true);

            AlertService.warning(
              "Session créée",
              "Vous pouvez commencer à envoyer des messages chiffrés."
            );
          } catch (error) {
            console.error("Failed to decrypt session key:", error);
            AlertService.error(
              "Decryption Error",
              "Could not decrypt session key from server."
            );
            setStatusMessage("Failed to establish secure session.");
            setTimeout(() => navigate({ to: "/discussions" }), 3000);
          }
        })
        .catch((e) => {
          console.error("Failed to request session key:", e);
          sessionKeyRequestAttempted.current = false;

          const errorMessage =
            e.data?.message || "Could not get session key from server.";

          if (errorMessage.includes("établir une session DH")) {
            AlertService.warning(
              "Information",
              "Le destinataire n'a pas encore établi une connexion sécurisée avec le serveur. " +
                "Il pourra accéder aux messages une fois connecté."
            );

            setStatusMessage(
              "Waiting for backend to support one-sided secure sessions..."
            );
            setTimeout(() => navigate({ to: "/discussions" }), 5000);
          } else {
            AlertService.error("Session Key Request Failed", errorMessage);
            setStatusMessage("Failed to create secure session.");
            setTimeout(() => navigate({ to: "/discussions" }), 3000);
          }
        });
    }
    // --- B: Joining Flow (sessionId exists) ---
    else if (sessionId) {
      if (isLoadingSessionKey || isFetchingSessionKey) {
        setStatusMessage("Retrieving secure session key...");
        console.log(
          `[User ${me}] Waiting for session key data for session ${sessionId}...`
        );
      } else if (sessionKeyData) {
        sessionKeyRequestAttempted.current = true;
        console.log(
          `[User ${me}] Received encrypted session key data for session ${sessionId}. Decrypting...`
        );
        try {
          const { encryptedSessionKey, iv } = sessionKeyData;
          const aesKeyBytes = CryptoJS.enc.Hex.parse(
            serverSharedSecret.substring(0, 64)
          );
          const ivBytes = CryptoJS.enc.Hex.parse(iv);
          const cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Hex.parse(encryptedSessionKey),
          });
          const decryptedBytes = CryptoJS.AES.decrypt(
            cipherParams,
            aesKeyBytes,
            { iv: ivBytes }
          );
          const sessionKeyHex = decryptedBytes.toString(CryptoJS.enc.Hex);

          if (!sessionKeyHex)
            throw new Error("Decryption resulted in empty key");

          console.log(
            `[User ${me}] Session key decrypted successfully for session ${sessionId}.`
          );
          localStorage.setItem(
            getSessionKeyStorageKey(sessionId),
            sessionKeyHex
          );
          localStorage.setItem(getSessionIvStorageKey(sessionId), iv);
          setKeyHex(sessionKeyHex);
          setIvHex(iv);
          setStatusMessage(
            "Secure connection established. Loading messages..."
          );
          setIsConnectionReady(true);

          // Force refetch messages to ensure we have the latest
          refetchMessages();
        } catch (error) {
          console.error("Failed to decrypt session key:", error);
          AlertService.error(
            "Decryption Error",
            "Could not decrypt session key from server."
          );
          setStatusMessage("Failed to establish secure session.");
          setTimeout(() => navigate({ to: "/discussions" }), 3000);
        }
      } else if (
        !isLoadingSessionKey &&
        !isFetchingSessionKey &&
        !sessionKeyData
      ) {
        sessionKeyRequestAttempted.current = true;
        console.error(
          `[User ${me}] Failed to retrieve session key data for session ${sessionId}.`
        );
        AlertService.error(
          "Session Error",
          "Could not retrieve session details. The session might be invalid or expired."
        );
        setStatusMessage("Failed to join secure session.");
        setTimeout(() => navigate({ to: "/discussions" }), 3000);
      }
    }
  }, [
    flow,
    isDhWithServerComplete,
    serverSharedSecret,
    targetIdParam,
    sessionId,
    keyHex,
    requestSessionKey,
    sessionKeyData,
    isLoadingSessionKey,
    isFetchingSessionKey,
    me,
    navigate,
    refetchMessages,
  ]);

  // --- Process Messages When Available ---
  useEffect(() => {
    if (serverMsgsData && sessionId && keyHex && ivHex) {
      console.log(
        `[User ${me}] Processing ${serverMsgsData.length} messages for session ${sessionId}.`
      );
      setMessages(serverMsgsData);

      // Make sure connection is marked as ready
      if (!isConnectionReady) {
        console.log(
          `[User ${me}] Setting connection ready after loading messages for session ${sessionId}.`
        );
        setIsConnectionReady(true);
      }

      // Mark messages as loaded
      messagesLoaded.current = true;
    }
  }, [serverMsgsData, sessionId, keyHex, ivHex, isConnectionReady, me]);

  // --- Socket Initialization & Event Handling ---
  useEffect(() => {
    if (!sessionId || !keyHex || !ivHex) {
      console.log(
        `Socket connection deferred: SessionId: ${sessionId}, Keys available: ${!!keyHex && !!ivHex}`
      );
      return;
    }

    console.log(`[User ${me}] Initializing socket for session ${sessionId}...`);
    const socket = io("http://localhost:4000", {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(`[User ${me}] Socket connected: ${socket.id}`);
      console.log(`[User ${me}] Joining session room: session:${sessionId}`);
      socket.emit("join-session", sessionId);
      if (targetUser) {
        socket.emit("request-user-status", { userId: targetUser.id });
      }
    });

    socket.on("connect_error", (error) => {
      console.error(`[User ${me}] Socket connection error:`, error.message);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[User ${me}] Socket disconnected:`, reason);
      setIsPeerOnline(false);
    });

    socket.on("new-message", (message: Message) => {
      if (message.sessionId === sessionId) {
        console.log(
          `[User ${me}] Received new message via socket for session ${sessionId}:`,
          message.id
        );
        setMessages((prevMessages) => {
          if (prevMessages.some((m) => m.id === message.id))
            return prevMessages;
          return [...prevMessages, message];
        });
        if (message.senderId !== me) setPeerIsTyping(false);
      }
    });

    socket.on(
      "typing-indicator",
      (data: { userId: number; isTyping: boolean; sessionId: string }) => {
        if (data.sessionId === sessionId && data.userId !== me) {
          setPeerIsTyping(data.isTyping);
        }
      }
    );

    socket.on(
      "user-status",
      (data: { userId: number; status: "online" | "offline" }) => {
        if (targetUser && data.userId === targetUser.id) {
          setIsPeerOnline(data.status === "online");
          console.log(
            `[User ${me}] Peer ${targetUser.username} status update: ${data.status}`
          );
        }
      }
    );

    return () => {
      if (socketRef.current) {
        console.log(
          `[User ${me}] Cleaning up socket connection for session ${sessionId}...`
        );
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [sessionId, me, targetUser, keyHex, ivHex]);

  // --- Retry Button Component ---
  const RetryDhExchangeButton = () => (
    <button
      onClick={() => {
        dhExchangeAttempted.current = false;
        sessionKeyRequestAttempted.current = false;
        messagesLoaded.current = false;
        setStatusMessage("Retrying secure connection setup...");

        // Force refetch messages
        if (sessionId) {
          refetchMessages();
        }
      }}
      className="mt-3 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded shadow-sm transition-colors"
    >
      Retry Connection
    </button>
  );

  // --- Decrypt Message Utility ---
  const decryptMessage = useCallback(
    (ciphertext: string): string => {
      if (!keyHex || !ivHex) {
        console.warn("Decryption skipped: Keys not available.");
        return "[Decrypting...]";
      }
      try {
        const key = CryptoJS.enc.Hex.parse(keyHex);
        const iv = CryptoJS.enc.Hex.parse(ivHex);
        const cipherParams = CryptoJS.lib.CipherParams.create({
          ciphertext: CryptoJS.enc.Base64.parse(ciphertext),
        });
        const decryptedBytes = CryptoJS.AES.decrypt(cipherParams, key, { iv });
        const plainText = decryptedBytes.toString(CryptoJS.enc.Utf8);
        if (!plainText && ciphertext) return "";
        return plainText;
      } catch (error) {
        console.error("Decryption error:", error, { ciphertext });
        return "[Decryption Error]";
      }
    },
    [keyHex, ivHex]
  );

  // --- Scroll to Bottom ---
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Typing Indicator Logic ---
  const handleTyping = useCallback(() => {
    if (!socketRef.current?.connected || !sessionId) return;

    if (!isTyping) {
      setIsTyping(true);
      socketRef.current.emit("typing-indicator", { sessionId, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketRef.current?.emit("typing-indicator", {
        sessionId,
        isTyping: false,
      });
      typingTimeoutRef.current = null;
    }, 2000);
  }, [isTyping, sessionId]);

  // --- Send Message ---
  const handleSend = useCallback(async () => {
    if (!text.trim() || !keyHex || !ivHex || !sessionId) {
      if (!keyHex || !ivHex) {
        AlertService.validation(
          "Connection Not Ready",
          "Please wait until the secure connection is established."
        );
      } else if (!text.trim()) {
        AlertService.validation(
          "Empty Message",
          "Cannot send an empty message."
        );
      }
      return;
    }

    console.log(
      `[User ${me}] Attempting to send server-assisted message for session ${sessionId}...`
    );
    try {
      const key = CryptoJS.enc.Hex.parse(keyHex);
      const iv = CryptoJS.enc.Hex.parse(ivHex);
      const encrypted = CryptoJS.AES.encrypt(text, key, { iv });
      const ciphertext = encrypted.toString();

      setText("");

      if (isTyping) {
        setIsTyping(false);
        socketRef.current?.emit("typing-indicator", {
          sessionId,
          isTyping: false,
        });
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }

      await sendServerMessage({ sessionId, ciphertext }).unwrap();
      console.log(
        `[User ${me}] Message sent successfully via API for session ${sessionId}.`
      );
    } catch (e: any) {
      console.error("Message send failed:", e);
      AlertService.error(
        "Send Failed",
        e.data?.message || "Could not send message."
      );
    }
  }, [text, sessionId, keyHex, ivHex, sendServerMessage, isTyping, me]);

  // --- Determine Loading State ---
  const isLoading =
    isLoadingDhParams ||
    isExchangingKeys ||
    (targetIdParam && isRequestingKey) ||
    (!targetIdParam &&
      sessionId &&
      (isLoadingSessionKey || isFetchingSessionKey));

  // Only show loading indicator if we're still setting up the connection
  const showSetupIndicator = isLoading || !keyHex || !ivHex;

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10 flex items-center p-3 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate({ to: "/discussions" })}
          className="mr-3 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>
        {targetUser ? (
          <div className="flex items-center flex-grow min-w-0">
            {/* Avatar and Status */}
            <div className="relative flex-shrink-0 mr-3">
              <div className="w-10 h-10 rounded-full bg-purple-200 dark:bg-purple-700 flex items-center justify-center text-xl font-semibold text-purple-700 dark:text-purple-100">
                {targetUser.username.charAt(0).toUpperCase()}
              </div>
              <span
                className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-800 ${
                  isPeerOnline ? "bg-green-400" : "bg-gray-400"
                }`}
                title={isPeerOnline ? "Online" : "Offline"}
              />
            </div>
            {/* Username and Status Text */}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
                {targetUser.username}
              </h2>
              <p
                className={`text-xs ${isPeerOnline ? "text-green-500 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
              >
                {isPeerOnline ? "Online" : "Offline"} (Server-Assisted)
              </p>
            </div>
          </div>
        ) : (
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Server-Assisted Chat
          </h2>
        )}
      </header>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
        {/* Setup/Loading Indicator */}
        {showSetupIndicator && (
          <div className="flex flex-col items-center justify-center p-4">
            <div className="bg-purple-100 dark:bg-purple-900 p-4 rounded-lg shadow-sm max-w-sm text-center">
              <p className="text-purple-800 dark:text-purple-200">
                {statusMessage}
              </p>
              {isLoading && (
                <div className="mt-2 flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-800 dark:border-purple-200"></div>
                </div>
              )}

              {/* Show retry button if needed */}
              {(!isDhWithServerComplete ||
                (statusMessage.includes("Failed") &&
                  !statusMessage.includes("join"))) && (
                <RetryDhExchangeButton />
              )}
            </div>

            {/* Target user status message */}
            {statusMessage.includes("destinataire") && (
              <div className="mt-4 bg-yellow-100 dark:bg-yellow-900 p-3 rounded-lg shadow-sm max-w-sm text-center">
                <p className="text-yellow-800 dark:text-yellow-200">
                  Le destinataire pourra voir vos messages une fois qu'il aura
                  établi une connexion sécurisée avec le serveur.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial Message Loading */}
        {keyHex && ivHex && isLoadingMessages && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            Loading messages...
          </p>
        )}

        {/* No messages state */}
        {keyHex && ivHex && !isLoadingMessages && messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-10">
            <p>No messages yet</p>
            <p className="text-sm mt-2">
              Send a message to start the conversation
            </p>
          </div>
        )}

        {/* Rendered Messages */}
        {keyHex &&
          ivHex &&
          !isLoadingMessages &&
          messages.map((m) => {
            const mine = m.senderId === me;
            const decryptedText = decryptMessage(m.ciphertext);
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg shadow-sm ${
                    mine
                      ? "bg-purple-500 dark:bg-purple-600 text-white rounded-br-none"
                      : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none"
                  }`}
                >
                  <p className="text-sm break-words whitespace-pre-wrap">
                    {decryptedText}
                  </p>
                  <div
                    className={`text-xs mt-1 ${mine ? "text-purple-100 dark:text-purple-200" : "text-gray-400 dark:text-gray-500"} text-right flex items-center justify-end`}
                  >
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </div>
                </div>
              </div>
            );
          })}

        {/* Typing Indicator Area */}
        <div className="h-6 px-4">
          {peerIsTyping && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic animate-pulse">
              {targetUser?.username || "Peer"} is typing...
            </p>
          )}
        </div>

        {/* Scroll Anchor */}
        <div ref={endRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 p-3 border-t border-gray-200 dark:border-gray-700 sticky bottom-0">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 focus:border-transparent transition duration-150 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim() && keyHex && ivHex) {
                handleSend();
              }
            }}
            placeholder={
              keyHex && ivHex
                ? "Type a message..."
                : "Establishing secure connection..."
            }
            disabled={!keyHex || !ivHex}
            aria-label="Message input"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || !keyHex || !ivHex}
            className={`p-2 rounded-full text-white transition duration-150 flex-shrink-0 ${
              text.trim() && keyHex && ivHex
                ? "bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700"
                : "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
            }`}
            aria-label="Send message"
          >
            <PaperAirplaneIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServerChat;
