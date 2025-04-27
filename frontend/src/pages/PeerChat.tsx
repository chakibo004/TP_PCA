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
  useGetPeerMessagesQuery, // Ensure this is imported
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
  const initialSessionId = params.get("session") || ""; // Get initial session ID
  const me = useAppSelector((s) => s.auth.user?.id)!;
  const [findPeerSession] = useFindPeerSessionMutation();

  // --- State Variables ---
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [keyHex, setKeyHex] = useState<string | null>(() => {
    if (!initialSessionId) return null;
    return localStorage.getItem(getSessionKeyStorageKey(initialSessionId));
  });
  const [ivHex, setIvHex] = useState<string | null>(() => {
    if (!initialSessionId) return null;
    return localStorage.getItem(getSessionIvStorageKey(initialSessionId));
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
  const [hasResponded, setHasResponded] = useState(false);
  const [isHandshakeComplete, setIsHandshakeComplete] = useState(false); // New state

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
  // Use the hook for peer messages
  const {
    data: peerMsgsData,
    isLoading: isLoadingMessages,
    refetch: refetchMessages, // Get the refetch function
    isFetching: isFetchingMessages, // Get fetching status
  } = useGetPeerMessagesQuery(sessionId, {
    skip: flow !== "peer" || !sessionId,
    refetchOnMountOrArgChange: true,
  });
  const { data: users } = useGetUsersQuery();

  // --- Update handshake complete state ---
  useEffect(() => {
    setIsHandshakeComplete(!!(keyHex && ivHex));
  }, [keyHex, ivHex]);

  useEffect(() => {
    // Update only if not fetching and data exists
    if (peerMsgsData && !isFetchingMessages) {
      console.log(
        `[User ${me}] Received ${peerMsgsData.length} messages from API for session ${sessionId}. Updating state.`
      );
      // Simple comparison to avoid unnecessary re-renders if data hasn't actually changed
      if (JSON.stringify(messages) !== JSON.stringify(peerMsgsData)) {
        setMessages(peerMsgsData);
      }
    }
  }, [peerMsgsData, isFetchingMessages, me, sessionId, messages]); // Keep dependencies

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
        setKeyHex(null); // Use null instead of "" for clarity
        setIvHex(null);
        console.log(
          `[User ${me}] No existing keys found in localStorage for session ${sessionId}. Will perform handshake if needed.`
        );
      }
    } else {
      setKeyHex(null);
      setIvHex(null);
    }
  }, [sessionId, me]);

  // --- Determine Target User ---
  useEffect(() => {
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
      if (!isHandshakeComplete) {
        // Use state here
        return "[Waiting for secure connection...]";
      }
      try {
        const key = CryptoJS.enc.Hex.parse(keyHex!); // Assert non-null as isHandshakeComplete is true
        const iv = CryptoJS.enc.Hex.parse(ivHex!); // Assert non-null
        const cipherParams = CryptoJS.lib.CipherParams.create({
          ciphertext: CryptoJS.enc.Base64.parse(ciphertext),
        });
        const decryptedBytes = CryptoJS.AES.decrypt(cipherParams, key, { iv });
        const plainText = decryptedBytes.toString(CryptoJS.enc.Utf8);
        // Handle potential empty string after decryption
        if (plainText === "" && ciphertext) return ""; // Return empty if original was not empty
        if (!plainText && ciphertext) return "[Decryption Error]";
        return plainText || ""; // Ensure always returning string
      } catch (error) {
        console.error("Decryption error:", error, { ciphertext });
        return "[Decryption Error]";
      }
    },
    [keyHex, ivHex, isHandshakeComplete] // Add isHandshakeComplete
  );

  // --- Effect to refetch messages when sessionId becomes available ---
  useEffect(() => {
    if (sessionId && flow === "peer") {
      console.log(
        `[User ${me}] Session ID available (${sessionId}), attempting to refetch messages.`
      );
      refetchMessages();
    }
  }, [sessionId, flow, refetchMessages, me]);

  // --- Effect to update messages state when data arrives ---
  useEffect(() => {
    // Update only if not fetching and data exists
    if (peerMsgsData && !isFetchingMessages) {
      console.log(
        `[User ${me}] Received ${peerMsgsData.length} messages from API for session ${sessionId}. Updating state.`
      );
      // Simple comparison to avoid unnecessary re-renders
      if (JSON.stringify(messages) !== JSON.stringify(peerMsgsData)) {
        setMessages(peerMsgsData);
      }
    }
    // Optional: Handle case where data becomes undefined (e.g., after error or session change)
    // else if (!isFetchingMessages && !peerMsgsData && messages.length > 0) {
    //   console.log(`[User ${me}] Message data cleared. Resetting local messages.`);
    //   setMessages([]);
    // }
  }, [peerMsgsData, isFetchingMessages, me, sessionId, messages]); // Add messages to dependencies

  // --- Socket Initialization & Event Handling ---
  useEffect(() => {
    // Conditions to initialize socket
    if (!sessionId || !isHandshakeComplete || flow !== "peer") {
      // Use state here
      if (socketRef.current) {
        console.log(
          `[User ${me}] Disconnecting socket due to missing session info or incomplete handshake.`
        );
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Avoid reconnecting if already connected
    if (socketRef.current?.connected) {
      // Ensure joining the room if sessionId changed while connected
      socketRef.current.emit("join-session", sessionId);
      return;
    }

    console.log(
      `[User ${me}] Initializing peer socket for session ${sessionId}...`
    );
    const socket = io("http://localhost:4000", {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(`[User ${me}] Peer socket connected: ${socket.id}`);
      socket.emit("join-session", sessionId);
      // Optional: Refetch messages on connect/reconnect for robustness
      // refetchMessages();
      // Request peer status on connect
      if (targetUser) {
        socket.emit("request-user-status", { userId: targetUser.id });
      }
    });

    socket.on("connect_error", (error) => {
      console.error(
        `[User ${me}] Peer socket connection error:`,
        error.message
      );
    });

    socket.on("disconnect", (reason) => {
      console.log(`[User ${me}] Peer socket disconnected:`, reason);
      setIsPeerOnline(false); // Assume offline on disconnect
    });

    socket.on("new-message", (message: Message) => {
      if (message.sessionId === sessionId) {
        console.log(
          `[User ${me}] Received new peer message via socket for session ${sessionId}:`,
          message.id
        );
        setMessages((prevMessages) => {
          if (prevMessages.some((m) => m.id === message.id)) {
            return prevMessages; // Avoid duplicates
          }
          return [...prevMessages, message];
        });
        refetchMessages(); // Trigger RTK refetch for consistency

        if (message.senderId !== me) {
          setPeerIsTyping(false);
        }
      }
    });

    socket.on("handshake-completed", (data: { sessionId: string }) => {
      if (data.sessionId === sessionId) {
        console.log(
          `[User ${me}] Handshake completed event received for ${data.sessionId}. Refetching response params.`
        );
        refetchRespParams();
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

    // Listen for specific user status updates
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

    // Cleanup function
    return () => {
      if (socketRef.current) {
        console.log(
          `[User ${me}] Cleaning up peer socket connection for session ${sessionId}...`
        );
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // Dependencies: Ensure effect runs if these change
  }, [
    sessionId,
    isHandshakeComplete, // Use state here
    flow,
    me,
    targetUser,
    refetchRespParams,
    refetchMessages, // Added refetchMessages
  ]);

  // --- Handshake Logic ---

  // Initiator A Logic
  // Add this with your other state variables
  const [isWaitingForPeer, setIsWaitingForPeer] = useState(false);

  useEffect(() => {
    if (
      flow !== "peer" ||
      sessionId || // Don't initiate if we already have a session ID (from URL or find)
      !targetIdParam ||
      initOnce.current ||
      !dhParams ||
      isHandshakeComplete // Skip if keys already exist (using state)
    ) {
      return;
    }
    initOnce.current = true; // Mark attempt
    console.log(
      `[User ${me}] Attempting find/initiate peer session with target: ${targetIdParam}`
    );

    findPeerSession({ otherId: targetIdParam })
      .unwrap()
      .then(({ sessionId: existingSessionId }) => {
        console.log(
          `[User ${me}] ✅ Existing session found: ${existingSessionId}`
        );
        setSessionId(existingSessionId); // Set the found session ID
        // Let the other useEffect load keys or trigger calculation
        initOnce.current = false; // Reset flag as we didn't initiate
      })
      .catch(() => {
        // No existing session found, proceed to initiate
        if (isHandshakeComplete) {
          // Check state again
          console.log(
            `[User ${me}] Keys already set, skipping new handshake initiation.`
          );
          initOnce.current = false; // Reset flag
          return;
        }
        console.log(
          `[User ${me}] ❌ No existing session found, initiating new handshake...`
        );
        const { p, g } = dhParams;
        const aHex = CryptoJS.lib.WordArray.random(32).toString(
          CryptoJS.enc.Hex
        );
        localStorage.setItem(`dh_a_temp_${targetIdParam}`, aHex); // Store temporarily with targetId
        const pBig = new BigInteger(p, 16);
        const gBig = new BigInteger(g, 16);
        const aBig = new BigInteger(aHex, 16);
        const ApubHex = gBig.modPow(aBig, pBig).toString(16);
        console.log(
          `[User ${me}] Initiator A generated: p=${p.substring(0, 10)}..., g=${g}, aHex=${aHex.substring(0, 10)}..., ApubHex=${ApubHex.substring(0, 10)}...`
        );

        // Set waiting for peer status when initiating
        setIsWaitingForPeer(true);

        initiatePeer({ p, g, Apub: ApubHex, targetId: targetIdParam })
          .unwrap()
          .then(({ sessionId: newSid }) => {
            console.log(
              `[User ${me}] ✅ Handshake initiated, session: ${newSid}`
            );
            // Move private key from temp storage to session-specific storage
            const tempAHex = localStorage.getItem(`dh_a_temp_${targetIdParam}`);
            if (tempAHex) {
              localStorage.setItem(`dh_a_${newSid}`, tempAHex);
              localStorage.removeItem(`dh_a_temp_${targetIdParam}`);
              console.log(
                `[User ${me}] Moved private key 'a' to storage for session ${newSid}`
              );
            }
            setSessionId(newSid); // Set the new session ID
            // We continue to wait for peer to respond
          })
          .catch((e) => {
            console.error("Handshake initiation failed:", e);
            localStorage.removeItem(`dh_a_temp_${targetIdParam}`); // Clean up temp key on failure
            // Don't reset initOnce to prevent retry loop
            AlertService.error(
              "Connection Request",
              "Invitation sent, waiting for peer to accept..."
            );
          });
      });
  }, [
    flow,
    targetIdParam,
    sessionId,
    findPeerSession,
    dhParams,
    initiatePeer,
    isHandshakeComplete, // Use state here
    me,
  ]);
  // Responder B Logic
  useEffect(() => {
    // Check if we're the responder by confirming sessionData exists and we're the target
    const isResponder =
      sessionData && sessionData.target === me && !(respParams as any).Bpub;

    // Ensure we have the session ID from the URL/state for this logic
    if (
      flow !== "peer" ||
      !sessionId || // Must have a session ID
      !respParams || // Must have params from server
      !(respParams as any).Apub || // Must have initiator's public key - add type assertion
      (respParams as any).Bpub || // Don't respond if already responded - add type assertion
      isHandshakeComplete || // Don't respond if keys are already derived/loaded
      hasResponded || // Don't respond multiple times
      !isResponder // Make sure we're actually the responder
    ) {
      return;
    }

    console.log(
      `[User ${me}] Attempting handshake response for session: ${sessionId}`
    );

    // Double check localStorage just before responding
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

    setHasResponded(true); // Mark that we are attempting to respond

    const bHex = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    const pBig = new BigInteger(respParams.p, 16);
    const gBig = new BigInteger(respParams.g, 16);
    const bBig = new BigInteger(bHex, 16);
    const BpubHex = gBig.modPow(bBig, pBig).toString(16);
    console.log(
      `[User ${me}] Responder B generated: bHex=${bHex.substring(0, 10)}..., BpubHex=${BpubHex.substring(0, 10)}...`
    );

    respondPeer({ sessionId, Bpub: BpubHex })
      .unwrap()
      .then(() => {
        console.log(
          `[User ${me}] ✅ Handshake responded for session ${sessionId}.`
        );
        localStorage.setItem(`dh_b_${sessionId}`, bHex); // Save private key 'b'
        refetchRespParams(); // Refetch params to confirm Bpub is set and trigger secret calculation
      })
      .catch((e) => {
        console.error("Handshake response failed:", e);
        setHasResponded(false); // Allow retry on failure
      });
  }, [
    flow,
    sessionId,
    respParams,
    respondPeer,
    refetchRespParams,
    isHandshakeComplete,
    me,
    hasResponded,
    sessionData, // Add sessionData to deps
  ]);

  // Reset hasResponded flag if sessionId changes
  useEffect(() => {
    setHasResponded(false);
  }, [sessionId]);

  // Add this effect to reset waiting state when handshake completes
  useEffect(() => {
    if (isHandshakeComplete) {
      setIsWaitingForPeer(false);

      // Notify user about successful connection (optional)
      if (targetUser) {
        AlertService.success(
          "Secure Connection Established",
          `Your chat with ${targetUser.username} is now end-to-end encrypted.`
        );
      }
    }
  }, [isHandshakeComplete, targetUser]);
  // --- Shared Secret Calculation ---
  useEffect(() => {
    // 1. Skip if keys already exist in state
    if (isHandshakeComplete) {
      // Use state here
      return;
    }

    // 2. Check prerequisites
    if (!sessionId || !respParams?.p || !respParams?.g || !respParams?.Apub) {
      return;
    }

    // 3. Check localStorage again (belt-and-suspenders)
    const storedKey = localStorage.getItem(getSessionKeyStorageKey(sessionId));
    const storedIv = localStorage.getItem(getSessionIvStorageKey(sessionId));
    if (storedKey && storedIv) {
      console.log(
        `[User ${me}] Found keys in localStorage during calculation phase for ${sessionId}. Setting state.`
      );
      setKeyHex(storedKey);
      setIvHex(storedIv);
      return;
    }

    console.log(
      `[User ${me}] Attempting to derive shared secret for session: ${sessionId}`
    );
    const pBig = new BigInteger(respParams.p, 16);
    const aHex = localStorage.getItem(`dh_a_${sessionId}`);
    const bHex = localStorage.getItem(`dh_b_${sessionId}`);

    let secretKeyHex: string | null = null;

    // Calculate as Initiator (A) if 'a' and Bpub exist
    if (aHex && respParams.Bpub) {
      console.log(
        `[User ${me}] Calculating secret as Initiator (A) using Bpub: ${respParams.Bpub.substring(0, 10)}...`
      );
      try {
        const BpubBig = new BigInteger(respParams.Bpub, 16);
        secretKeyHex = BpubBig.modPow(new BigInteger(aHex, 16), pBig).toString(
          16
        );
      } catch (e) {
        console.error("[User ${me}] Error calculating secret as Initiator:", e);
      }
    }
    // Calculate as Responder (B) if 'b' and Apub exist
    else if (bHex && respParams.Apub) {
      console.log(
        `[User ${me}] Calculating secret as Responder (B) using Apub: ${respParams.Apub.substring(0, 10)}...`
      );
      try {
        const ApubBig = new BigInteger(respParams.Apub, 16);
        secretKeyHex = ApubBig.modPow(new BigInteger(bHex, 16), pBig).toString(
          16
        );
      } catch (e) {
        console.error("[User ${me}] Error calculating secret as Responder:", e);
      }
    }

    if (secretKeyHex) {
      console.log(
        `[User ${me}] ✅ Shared secret derived for ${sessionId}: ${secretKeyHex.substring(0, 10)}...`
      );
      // Derive AES key and IV from the shared secret using SHA512
      const hash = CryptoJS.SHA512(secretKeyHex).toString(CryptoJS.enc.Hex);
      const derivedKeyHex = hash.slice(0, 64); // First 256 bits (32 bytes) for AES key
      const derivedIvHex = hash.slice(64, 96); // Next 128 bits (16 bytes) for IV

      console.log(
        `[User ${me}]   Derived AES Key: ${derivedKeyHex.substring(0, 10)}...`
      );
      console.log(
        `[User ${me}]   Derived AES IV:  ${derivedIvHex.substring(0, 10)}...`
      );

      // Set state
      setKeyHex(derivedKeyHex);
      setIvHex(derivedIvHex);

      // Save to localStorage
      try {
        localStorage.setItem(getSessionKeyStorageKey(sessionId), derivedKeyHex);
        localStorage.setItem(getSessionIvStorageKey(sessionId), derivedIvHex);
        console.log(
          `[User ${me}] ✅ AES Key and IV saved to localStorage for session ${sessionId}.`
        );
        // Optionally remove private keys after successful derivation and storage
        // localStorage.removeItem(`dh_a_${sessionId}`);
        // localStorage.removeItem(`dh_b_${sessionId}`);
      } catch (error) {
        console.error(
          `[User ${me}] Failed to save keys to localStorage for ${sessionId}:`,
          error
        );
        AlertService.error(
          "Storage Error",
          "Could not save session keys. Encryption might not persist."
        );
      }
    } else {
      console.log(
        `[User ${me}] Waiting for peer's public key or own private key to derive secret for ${sessionId}...`
      );
    }
  }, [sessionId, respParams, isHandshakeComplete, me]); // Dependencies - use state here

  // Log active keys
  useEffect(() => {
    if (sessionId && isHandshakeComplete) {
      // Use state here
      console.log(`[User ${me}] Active session ${sessionId} has keys.`);
      // console.log(`  Key: ${keyHex.substring(0, 10)}...`);
      // console.log(`  IV:  ${ivHex.substring(0, 10)}...`);
    }
  }, [sessionId, isHandshakeComplete, me]); // Use state here

  // --- Scroll to Bottom ---
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Typing Indicator Logic ---
  const handleTyping = useCallback(() => {
    if (!socketRef.current?.connected || !sessionId || !isHandshakeComplete)
      return; // Check handshake state
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
  }, [isTyping, sessionId, isHandshakeComplete]); // Add isHandshakeComplete

  // --- Send Message ---
  const handleSend = useCallback(async () => {
    // Check handshake completion first, no popup needed here
    if (!isHandshakeComplete || !text.trim() || !sessionId) {
      return;
    }
    console.log(
      `[User ${me}] Attempting to send peer message for ${sessionId}...`
    );
    try {
      const key = CryptoJS.enc.Hex.parse(keyHex!); // Assert non-null
      const iv = CryptoJS.enc.Hex.parse(ivHex!); // Assert non-null
      const encrypted = CryptoJS.AES.encrypt(text, key, { iv });
      const ciphertext = encrypted.toString(); // Base64 format

      setText(""); // Clear input immediately

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

      await sendPeer({ sessionId, ciphertext }).unwrap();
      console.log(
        `[User ${me}] ✅ Message sent successfully via API for ${sessionId}.`
      );
      // RTK Query invalidation should handle the update
    } catch (e: any) {
      console.error("Message send failed:", e);
      AlertService.error(
        "Send Failed",
        e.data?.message || "Could not send message."
      );
      // Consider restoring text if send fails
      // setText(text);
    }
  }, [
    text,
    sessionId,
    keyHex,
    ivHex,
    sendPeer,
    me,
    isTyping,
    isHandshakeComplete,
  ]); // Add isHandshakeComplete

  // --- Render ---
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
                {isPeerOnline ? "Online" : "Offline"} (Peer-to-Peer)
              </p>
            </div>
          </div>
        ) : (
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Peer Chat
          </h2>
        )}
      </header>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
        {/* Loading/Fetching Indicator */}
        {(isLoadingMessages || isFetchingMessages) && messages.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            Chargement des messages...
          </p>
        )}

        {/* No messages state */}
        {!isLoadingMessages && !isFetchingMessages && messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-10">
            <p>Aucun message pour le moment</p>
            <p className="text-sm mt-2">
              Envoyez un message pour démarrer la conversation
            </p>
          </div>
        )}

        {/* Rendered Messages */}
        {messages.map((m) => {
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
                    hour12: false, // Use 24-hour format for consistency
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
            className={`flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-transparent transition duration-150 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 ${
              !isHandshakeComplete
                ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" // Lighter background when disabled
                : "bg-white dark:bg-gray-700" // Normal background when enabled
            }`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim() && isHandshakeComplete) {
                handleSend();
              }
            }}
            placeholder={
              isHandshakeComplete
                ? "Type a message..."
                : isWaitingForPeer
                  ? "Waiting for peer to connect..."
                  : "Establishing secure connection..."
            }
            disabled={!isHandshakeComplete}
            aria-label="Message input"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || !isHandshakeComplete}
            className={`p-2 rounded-full text-white transition duration-150 flex-shrink-0 ${
              text.trim() && isHandshakeComplete
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
