import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import CryptoJS from "crypto-js";
import { BigInteger } from "jsbn";
import { io, Socket } from "socket.io-client";
import {
  useGetDhPeerParamsQuery,
  useGetDhPeerParamsForResponseQuery,
  useGetPeerSessionQuery,
  useInitiatePeerMutation,
  useRespondPeerMutation,
  useSendPeerMessageMutation,
  useGetPeerMessagesQuery,
  useFindPeerSessionMutation,
  useGetUsersQuery,
} from "../redux/apiSlice";
import { useAppSelector } from "../redux/hooks";
import AlertService from "../utils/AlertService";
import { ArrowLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/solid";

// --- Constants for localStorage keys ---
const getSessionKeyStorageKey = (sessionId: string) =>
  `session_key_${sessionId}`;
const getSessionIvStorageKey = (sessionId: string) => `session_iv_${sessionId}`;

// --- Message Interface ---
interface Message {
  id: number;
  sessionId: string;
  senderId: number;
  ciphertext: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read";
}

// --- Chat Component ---
const Chat: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const flow = (params.get("flow") as "peer" | "server") || "peer";
  const targetIdParam = params.get("target");
  const me = useAppSelector((s) => s.auth.user?.id)!;
  const [findPeerSession] = useFindPeerSessionMutation();

  // --- State Variables ---
  const [sessionId, setSessionId] = useState(params.get("session") || "");
  // Initialize key/IV state by trying to load from localStorage first
  const [keyHex, setKeyHex] = useState(() => {
    const currentSessionId = params.get("session");
    return currentSessionId
      ? localStorage.getItem(getSessionKeyStorageKey(currentSessionId)) || ""
      : "";
  });
  const [ivHex, setIvHex] = useState(() => {
    const currentSessionId = params.get("session");
    return currentSessionId
      ? localStorage.getItem(getSessionIvStorageKey(currentSessionId)) || ""
      : "";
  });
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
  const initOnce = useRef(false);
  // Add this state at the top with other state variables
  const [hasResponded, setHasResponded] = useState(false);
  // --- RTK Query Hooks ---
  const { data: dhParams } = useGetDhPeerParamsQuery(undefined, {
    skip: flow !== "peer",
  });
  const [initiatePeer] = useInitiatePeerMutation();
  const [respondPeer] = useRespondPeerMutation();
  const { data: respParams, refetch: refetchRespParams } =
    useGetDhPeerParamsForResponseQuery(sessionId, {
      skip: flow !== "peer" || !sessionId,
    });
  const { data: sessionData } = useGetPeerSessionQuery(sessionId, {
    skip: flow !== "peer" || !sessionId,
  });
  const [sendPeer] = useSendPeerMessageMutation();
  const { data: peerMsgsData, isLoading: isLoadingMessages } =
    useGetPeerMessagesQuery(sessionId, { skip: flow !== "peer" || !sessionId });
  const { data: users } = useGetUsersQuery();

  // --- Effect to load keys from localStorage when sessionId changes ---
  useEffect(() => {
    if (sessionId) {
      const storedKey = localStorage.getItem(
        getSessionKeyStorageKey(sessionId)
      );
      const storedIv = localStorage.getItem(getSessionIvStorageKey(sessionId));
      if (storedKey && storedIv) {
        console.log(
          `[User ${me}] Loaded existing AES Key/IV from localStorage for session ${sessionId}.`
        );
        setKeyHex(storedKey);
        setIvHex(storedIv);
      } else {
        // If keys not found for the new session, reset state (important if switching chats)
        setKeyHex("");
        setIvHex("");
        console.log(
          `[User ${me}] No existing keys found in localStorage for session ${sessionId}. Will perform handshake if needed.`
        );
      }
    } else {
      // Clear keys if sessionId becomes empty
      setKeyHex("");
      setIvHex("");
    }
  }, [sessionId, me]); // Rerun when sessionId changes

  // --- Determine Target User ---
  useEffect(() => {
    // ... (no changes needed here) ...
    let peerId: number | null = null;
    if (sessionData) {
      peerId =
        sessionData.initiator === me
          ? sessionData.target
          : sessionData.initiator;
    } else if (targetIdParam) {
      peerId = Number(targetIdParam);
    }
    if (peerId !== null && users) {
      const user = users.find((u) => u.id === peerId);
      if (user) {
        setTargetUser(user);
      } else {
        console.warn(`Target user with ID ${peerId} not found.`);
        setTargetUser(null);
      }
    }
  }, [users, sessionData, targetIdParam, me]);

  // --- Decrypt Message Utility ---
  const decryptMessage = useCallback(
    (ciphertext: string): string => {
      // ... (no changes needed here) ...
      if (!keyHex || !ivHex) {
        return "[Waiting for secure connection...]";
      }
      try {
        const key = CryptoJS.enc.Hex.parse(keyHex);
        const iv = CryptoJS.enc.Hex.parse(ivHex);
        const cipherParams = CryptoJS.lib.CipherParams.create({
          ciphertext: CryptoJS.enc.Base64.parse(ciphertext),
        });
        const decryptedBytes = CryptoJS.AES.decrypt(cipherParams, key, { iv });
        const plainText = decryptedBytes.toString(CryptoJS.enc.Utf8);
        if (plainText === "") return "";
        if (!plainText && ciphertext) return "[Decryption Error]";
        return plainText;
      } catch (error) {
        console.error("Decryption error:", error);
        return "[Decryption Error]";
      }
    },
    [keyHex, ivHex]
  );

  // --- Socket Initialization & Event Handling ---
  useEffect(() => {
    // ... (no changes needed here) ...
    const socket = io("http://localhost:4000", {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      console.log(`Socket connected: ${socket.id}`);
      if (sessionId) {
        socket.emit("join-session", sessionId);
      }
    });
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });
    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      if (reason === "io server disconnect") {
        setIsPeerOnline(false);
      }
    });
    socket.on("new-message", (message: Message) => {
      console.log("Received new message via socket:", message);
      setMessages((prevMessages) => {
        if (prevMessages.some((m) => m.id === message.id)) {
          return prevMessages;
        }
        return [...prevMessages, message];
      });
      if (message.senderId !== me) {
        setPeerIsTyping(false);
      }
    });
    socket.on("handshake-completed", (data: { sessionId: string }) => {
      if (data.sessionId === sessionId) {
        console.log("Handshake completed event received:", data.sessionId);
        refetchRespParams(); // Still refetch to ensure server state is consistent
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
      "user-status-change",
      (data: { userId: number; status: string }) => {
        if (targetUser && data.userId === targetUser.id) {
          setIsPeerOnline(data.status === "online");
          console.log(`Peer ${targetUser.username} status: ${data.status}`);
        }
      }
    );
    return () => {
      console.log("Cleaning up socket connection...");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, refetchRespParams, me, targetUser]);

  // --- Join/Leave Socket Room ---
  useEffect(() => {
    // ... (no changes needed here) ...
    if (socketRef.current?.connected && sessionId) {
      console.log(`Joining session room: session:${sessionId}`);
      socketRef.current.emit("join-session", sessionId);
      return () => {
        console.log(`Leaving session room: session:${sessionId}`);
        socketRef.current?.emit("leave-session", sessionId);
      };
    }
  }, [sessionId, socketRef.current?.connected]);

  // --- Load Initial Messages ---
  useEffect(() => {
    // ... (no changes needed here) ...
    if (peerMsgsData) {
      console.log(`Loaded ${peerMsgsData.length} initial messages from API.`);
      setMessages(peerMsgsData);
    }
  }, [peerMsgsData]);

  // --- Handshake Logic ---

  // Initiator A Logic
  useEffect(() => {
    // Add check: Don't initiate if keys are already loaded from storage
    if (
      flow !== "peer" ||
      sessionId ||
      !targetIdParam ||
      initOnce.current ||
      !dhParams ||
      (keyHex && ivHex) // <-- Skip if keys already exist
    ) {
      return;
    }
    initOnce.current = true;
    console.log("Attempting find/initiate peer session with:", targetIdParam);

    findPeerSession({ otherId: targetIdParam })
      .unwrap()
      .then(({ sessionId: existingSessionId }) => {
        console.log("✅ Existing session found:", existingSessionId);
        setSessionId(existingSessionId);
        // Check if keys exist for this found session
        const storedKey = localStorage.getItem(
          getSessionKeyStorageKey(existingSessionId)
        );
        const storedIv = localStorage.getItem(
          getSessionIvStorageKey(existingSessionId)
        );
        if (storedKey && storedIv) {
          console.log(
            `[User ${me}] Found existing session AND keys in localStorage.`
          );
          setKeyHex(storedKey);
          setIvHex(storedIv);
          initOnce.current = false; // Allow potential future checks if needed? Or keep true? Decide based on desired behavior.
        } else {
          // If session found but no keys, proceed to refetch params which might trigger secret calculation
          console.log(
            `[User ${me}] Found existing session but NO keys in localStorage. Will attempt key derivation.`
          );
          refetchRespParams(); // Trigger fetching params for potential key derivation
        }
      })
      .catch(() => {
        // Only initiate if session NOT found AND keys don't exist
        if (keyHex && ivHex) {
          console.log(
            `[User ${me}] Keys already set, skipping new handshake initiation.`
          );
          return;
        }
        console.log(
          "❌ No existing session found, initiating new handshake..."
        );
        const { p, g } = dhParams;
        const aHex = CryptoJS.lib.WordArray.random(32).toString(
          CryptoJS.enc.Hex
        );
        const pBig = new BigInteger(p, 16);
        const gBig = new BigInteger(g, 16);
        const aBig = new BigInteger(aHex, 16);
        const ApubHex = gBig.modPow(aBig, pBig).toString(16);
        // --- ADD LOG HERE ---
        console.log(
          `[User ${me}] Initiator A generated: p=${p.substring(0, 10)}..., g=${g}, aHex=${aHex.substring(0, 10)}..., ApubHex=${ApubHex.substring(0, 10)}...`
        );
        // --- END LOG ---

        // Clear any stale keys from previous attempts (same peers)
        const targetId = Number(targetIdParam);
        if (targetId) {
          const possibleSessionKeys = Object.keys(localStorage).filter(
            (key) =>
              key.startsWith("session_key_") ||
              key.startsWith("session_iv_") ||
              key.startsWith("dh_a_") ||
              key.startsWith("dh_b_")
          );

          console.log(
            `[User ${me}] Cleaning up ${possibleSessionKeys.length} potential stale keys before new handshake`
          );
        }

        initiatePeer({ p, g, Apub: ApubHex, targetId: targetIdParam })
          .unwrap()
          .then(({ sessionId: newSid }) => {
            console.log("✅ Handshake initiated:", newSid);
            setSessionId(newSid);
            localStorage.setItem(`dh_a_${newSid}`, aHex);
          })
          .catch((e) => {
            console.error("Handshake initiation failed:", e);
            AlertService.error(
              "Handshake Init Failed",
              e.data?.message || "Could not initiate."
            );
            initOnce.current = false;
          });
      });
  }, [
    flow,
    targetIdParam,
    sessionId,
    findPeerSession,
    dhParams,
    initiatePeer,
    keyHex,
    ivHex,
    me,
    refetchRespParams,
  ]); // Added keyHex, ivHex, me, refetchRespParams

  // Responder B Logic
  useEffect(() => {
    const sessionParam = params.get("session");
    // Add check: Don't respond if keys are already loaded from storage or if we've already responded
    if (
      flow !== "peer" ||
      !sessionParam ||
      !respParams ||
      !respParams.Apub ||
      respParams.Bpub || // Already responded
      sessionId !== sessionParam ||
      (keyHex && ivHex) || // Skip if keys already exist
      hasResponded // Add this condition to prevent multiple responses
    ) {
      return;
    }
    console.log("Attempting handshake response for:", sessionId);

    // Check localStorage again just before responding (belt and suspenders)
    const storedKey = localStorage.getItem(getSessionKeyStorageKey(sessionId));
    const storedIv = localStorage.getItem(getSessionIvStorageKey(sessionId));
    if (storedKey && storedIv) {
      console.log(
        `[User ${me}] Keys found in localStorage just before responding. Skipping response.`
      );
      setKeyHex(storedKey);
      setIvHex(storedIv);
      return;
    }

    // Set the flag to indicate we're responding
    setHasResponded(true);

    const bHex = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    const pBig = new BigInteger(respParams.p, 16);
    const gBig = new BigInteger(respParams.g, 16);
    const bBig = new BigInteger(bHex, 16);
    const BpubHex = gBig.modPow(bBig, pBig).toString(16);

    respondPeer({ sessionId, Bpub: BpubHex })
      .unwrap()
      .then(() => {
        console.log("✅ Handshake responded.");
        localStorage.setItem(`dh_b_${sessionId}`, bHex);
        refetchRespParams(); // Refetch to get updated params (including Bpub) to trigger secret calculation
      })
      .catch((e) => {
        console.error("Handshake response failed:", e);
        AlertService.error(
          "Handshake Response Failed",
          e.data?.message || "Could not respond."
        );
        // Reset flag if response fails so we can try again
        setHasResponded(false);
      });
  }, [
    flow,
    sessionId,
    params,
    respParams,
    respondPeer,
    refetchRespParams,
    keyHex,
    ivHex,
    me,
    hasResponded, // Add this dependency
  ]);
  useEffect(() => {
    setHasResponded(false);
  }, [sessionId]);
  // --- Shared Secret Calculation ---
  useEffect(() => {
    // 1. Check if keys already exist in state (either from localStorage or previous calculation)
    if (keyHex && ivHex) {
      // console.log(`[User ${me}] Keys already set in state for session ${sessionId}. Skipping calculation.`);
      return;
    }

    // 2. Check if prerequisites for calculation are met
    if (!sessionId || !respParams?.p || !respParams?.g || !respParams?.Apub) {
      // console.log(`[User ${me}] Prerequisites for secret calculation not met for session ${sessionId}.`);
      return;
    }

    // 3. Check localStorage one last time before calculating
    const storedKey = localStorage.getItem(getSessionKeyStorageKey(sessionId));
    const storedIv = localStorage.getItem(getSessionIvStorageKey(sessionId));
    if (storedKey && storedIv) {
      console.log(
        `[User ${me}] Found keys in localStorage during calculation phase. Setting state.`
      );
      setKeyHex(storedKey);
      setIvHex(storedIv);
      return; // Keys loaded, exit calculation
    }

    console.log(
      `[User ${me}] Attempting to derive shared secret for session: ${sessionId}`
    );
    const pBig = new BigInteger(respParams.p, 16);
    const aHex = localStorage.getItem(`dh_a_${sessionId}`);
    const bHex = localStorage.getItem(`dh_b_${sessionId}`);

    if (aHex)
      console.log(
        `[User ${me}] Found private key 'a': ${aHex.substring(0, 10)}...`
      );
    if (bHex)
      console.log(
        `[User ${me}] Found private key 'b': ${bHex.substring(0, 10)}...`
      );

    let secretKeyHex: string | null = null;

    if (aHex && respParams.Bpub) {
      console.log(
        `[User ${me}] Calculating secret as Initiator (A) using Bpub: ${respParams.Bpub.substring(0, 10)}...`
      );
      const BpubBig = new BigInteger(respParams.Bpub, 16);
      secretKeyHex = BpubBig.modPow(new BigInteger(aHex, 16), pBig).toString(
        16
      );
    } else if (bHex && respParams.Apub) {
      console.log(
        `[User ${me}] Calculating secret as Responder (B) using Apub: ${respParams.Apub.substring(0, 10)}...`
      );
      const ApubBig = new BigInteger(respParams.Apub, 16);
      secretKeyHex = ApubBig.modPow(new BigInteger(bHex, 16), pBig).toString(
        16
      );
    }

    if (secretKeyHex) {
      console.log(
        `[User ${me}] ✅ Shared secret derived: ${secretKeyHex.substring(0, 10)}...`
      );
      const hash = CryptoJS.SHA512(secretKeyHex).toString(CryptoJS.enc.Hex);
      const derivedKeyHex = hash.slice(0, 64);
      const derivedIvHex = hash.slice(64, 96);

      console.log(
        `[User ${me}]   Derived AES Key: ${derivedKeyHex.substring(0, 10)}...`
      );
      console.log(
        `[User ${me}]   Derived AES IV:  ${derivedIvHex.substring(0, 10)}...`
      );

      // Set state
      setKeyHex(derivedKeyHex);
      setIvHex(derivedIvHex);

      // *** Save to localStorage ***
      try {
        localStorage.setItem(getSessionKeyStorageKey(sessionId), derivedKeyHex);
        localStorage.setItem(getSessionIvStorageKey(sessionId), derivedIvHex);
        console.log(
          `[User ${me}] ✅ AES Key and IV saved to localStorage for session ${sessionId}.`
        );
      } catch (error) {
        console.error(
          `[User ${me}] Failed to save keys to localStorage:`,
          error
        );
        // Handle potential storage errors (e.g., quota exceeded)
        AlertService.error(
          "Storage Error",
          "Could not save session keys. Encryption might not persist."
        );
      }
    } else {
      console.log(
        `[User ${me}] Waiting for peer's public key or private key to derive secret...`
      );
    }
  }, [sessionId, respParams, keyHex, ivHex, me]); // Dependencies remain the same, logic inside handles state/localStorage checks

  useEffect(() => {
    if (sessionId && keyHex && ivHex) {
      console.log(`[User ${me}] Active session ${sessionId} has keys:`);
      console.log(`  Key: ${keyHex.substring(0, 10)}...`);
      console.log(`  IV:  ${ivHex.substring(0, 10)}...`);
    }
  }, [sessionId, keyHex, ivHex, me]);
  // --- Scroll to Bottom ---
  useEffect(() => {
    // ... (no changes needed here) ...
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Typing Indicator Logic ---
  const handleTyping = useCallback(() => {
    // ... (no changes needed here) ...
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
  }, [isTyping, sessionId, socketRef.current?.connected]);

  // --- Send Message ---
  const handleSend = useCallback(async () => {
    // ... (no changes needed here) ...
    if (
      !text.trim() ||
      !socketRef.current?.connected ||
      !sessionId ||
      !keyHex ||
      !ivHex
    ) {
      if (!keyHex || !ivHex) {
        AlertService.validation(
          "Secure Connection Pending",
          "Cannot send messages until the secure handshake is complete."
        );
      }
      return;
    }
    console.log("Attempting to send message...");
    try {
      const key = CryptoJS.enc.Hex.parse(keyHex);
      const iv = CryptoJS.enc.Hex.parse(ivHex);
      const encrypted = CryptoJS.AES.encrypt(text, key, { iv });
      const ciphertext = encrypted.toString();
      await sendPeer({ sessionId, ciphertext }).unwrap();
      console.log("✅ Message sent successfully via API.");
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
    } catch (e: any) {
      console.error("Message send failed:", e);
      AlertService.error(
        "Send Failed",
        e.data?.message || "Could not send message."
      );
    }
  }, [
    text,
    sessionId,
    keyHex,
    ivHex,
    socketRef.current?.connected,
    sendPeer,
    me,
    isTyping,
  ]);

  // --- Render ---
  return (
    // ... (no changes needed in JSX structure) ...
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
            <div className="relative flex-shrink-0 mr-3">
              <div className="w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center text-xl font-semibold text-blue-700 dark:text-blue-100">
                {targetUser.username.charAt(0).toUpperCase()}
              </div>
              <span
                className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-800 ${
                  isPeerOnline ? "bg-green-400" : "bg-gray-400"
                }`}
                title={isPeerOnline ? "Online" : "Offline"}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
                {targetUser.username}
              </h2>
              <p
                className={`text-xs ${isPeerOnline ? "text-green-500 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
              >
                {isPeerOnline ? "Online" : "Offline"}
              </p>
            </div>
          </div>
        ) : (
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Chat
          </h2>
        )}
      </header>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
        {isLoadingMessages && (
          <p className="text-center text-gray-500 dark:text-gray-400">
            Loading messages...
          </p>
        )}
        {!isLoadingMessages &&
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
                      ? "bg-blue-500 dark:bg-blue-600 text-white rounded-br-none"
                      : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none"
                  }`}
                >
                  <p className="text-sm break-words whitespace-pre-wrap">
                    {decryptedText}
                  </p>
                  <div
                    className={`text-xs mt-1 ${mine ? "text-blue-100 dark:text-blue-200" : "text-gray-400 dark:text-gray-500"} text-right flex items-center justify-end`}
                  >
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        <div className="h-6 px-4">
          {peerIsTyping && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic animate-pulse">
              {targetUser?.username || "Peer"} is typing...
            </p>
          )}
        </div>
        <div ref={endRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 p-3 border-t border-gray-200 dark:border-gray-700 sticky bottom-0">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-transparent transition duration-150 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
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
                ? "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
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

export default Chat;
