/* eslint-disable no-loop-func */
/* eslint-disable @typescript-eslint/no-unused-vars */
/*
  ChatbotDialog.tsx — ChatGPT-style dialog with:
    • In-dialog history sidebar (logo top-left)
    • AI replies with logo avatar (/Gaja_out_black.png)
    • User messages as iMessage-style bubbles (right aligned, tail)
    • Thinking + per-char typing simulation
    • Full-screen toggle
*/

import * as React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Stack,
  Typography,
  TextField,
  Chip,
  Tooltip,
  useMediaQuery,
  Divider,
  Button,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import ChatIcon from "@mui/icons-material/Chat";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import HistoryIcon from "@mui/icons-material/History";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";
import Logo from "../ui-component/Logo";

const PANTONE_BLUE = "#0057B8" as const;
const PANTONE_TAN = "#B7A27D" as const;

// iMessage blue + text color
const IMESSAGE_BLUE = "#0b93f6";
const IMESSAGE_TEXT = "#ffffff";

export type BotMsg = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
};

type Session = {
  id: string;
  title: string;
  messages: BotMsg[];
  createdAt: number;
};

const STORAGE_KEY = "ai_messages";
const SESSIONS_KEY = "ai_sessions";

/** Typing shimmer bar */
const Shimmer = styled("span")(() => ({
  display: "inline-block",
  height: 18,
  width: 140,
  background: `linear-gradient(90deg, transparent, ${PANTONE_BLUE}22, transparent)`,
  backgroundSize: "200% 100%",
  animation: "shimmer 1.25s linear infinite",
  borderRadius: 4,
  "@keyframes shimmer": {
    "0%": { backgroundPosition: "200% 0" },
    "100%": { backgroundPosition: "-200% 0" },
  },
}));

/** Animated dots (typing…) */
const Dots = styled("span")(() => ({
  display: "inline-block",
  minWidth: 24,
  textAlign: "left",
  "&::after": { content: '"…"' },
  animation: "dots 1.2s steps(3, end) infinite",
  "@keyframes dots": {
    "0%, 20%": { opacity: 0 },
    "40%": { opacity: 0.4 },
    "60%": { opacity: 0.7 },
    "80%, 100%": { opacity: 1 },
  },
}));

/** Composer at bottom */
const Composer = styled("div")(({ theme }) => ({
  position: "sticky",
  bottom: 0,
  display: "flex",
  gap: 8,
  alignItems: "flex-end",
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

/** Tiny round avatar pill (for user only) */
function UserPill() {
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        fontSize: 12,
        fontWeight: 800,
        display: "grid",
        placeItems: "center",
        bgcolor: `${IMESSAGE_BLUE}1A`,
        color: IMESSAGE_BLUE,
        border: `1px solid ${IMESSAGE_BLUE}55`,
        userSelect: "none",
      }}
    >
      You
    </Box>
  );
}


export interface ChatbotDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  initial?: BotMsg[];
  logo?: React.ReactNode; // optional: custom logo node for sidebar header
}

export default function ChatbotDialog({
  open,
  onClose,
  title = "Gaja AI",
  initial,
  logo,
}: ChatbotDialogProps) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));

  const [pending, setPending] = React.useState(false);
  const [thinking, setThinking] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);
  const [full, setFull] = React.useState(false);

  // in-dialog sidebar
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  // sessions/history
  const [sessions, setSessions] = React.useState<Session[]>(() => {
    try {
      const s = sessionStorage.getItem(SESSIONS_KEY);
      return s ? (JSON.parse(s) as Session[]) : [];
    } catch {
      return [];
    }
  });
  const [sessionId, setSessionId] = React.useState<string>(() => {
    try {
      const existing = sessionStorage.getItem("ai_session_id");
      if (existing) return existing;
    } catch {}
    const id = `s_${Math.random().toString(36).slice(2)}`;
    try {
      sessionStorage.setItem("ai_session_id", id);
    } catch {}
    return id;
  });

  const [messages, setMessages] = React.useState<BotMsg[]>(() => {
    if (initial?.length) return initial;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw
        ? (JSON.parse(raw) as BotMsg[])
        : [{ role: "assistant", content: "Hi 👋 How can I help?" }];
    } catch {
      return [{ role: "assistant", content: "Hi 👋 How can I help?" }];
    }
  });

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // persist current messages + session
  React.useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      // Update sessions list (simple “last used” storage)
      setSessions((prev) => {
        const titleGuess =
          messages.find((m) => m.role === "user")?.content?.slice(0, 48) ||
          "New chat";
        const existing = [...prev];
        const idx = existing.findIndex((s) => s.id === sessionId);
        const entry: Session = {
          id: sessionId,
          title: titleGuess,
          messages,
          createdAt: idx >= 0 ? existing[idx].createdAt : Date.now(),
        };
        if (idx >= 0) {
          existing[idx] = entry;
        } else {
          existing.unshift(entry);
        }
        sessionStorage.setItem(
          SESSIONS_KEY,
          JSON.stringify(existing.slice(0, 20))
        );
        return existing;
      });
    } catch {}
  }, [messages, sessionId]);

  // auto scroll on updates
  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  // “thinking” pulse when a request begins
  React.useEffect(() => {
    let t: any;
    if (pending) {
      setThinking(true);
      t = setTimeout(() => setThinking(false), 700);
    } else setThinking(false);
    return () => clearTimeout(t);
  }, [pending]);

  function newSession() {
    const id = `s_${Math.random().toString(36).slice(2)}`;
    setSessionId(id);
    try {
      sessionStorage.setItem("ai_session_id", id);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch {}
    setMessages([
      { role: "assistant", content: "New session. How can I help?" },
    ]);
  }

  function openSession(id: string) {
    const found = sessions.find((s) => s.id === id);
    if (found) {
      setSessionId(id);
      setMessages(found.messages);
      try {
        sessionStorage.setItem("ai_session_id", id);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found.messages));
      } catch {}
      setSidebarOpen(false);
    }
  }

  async function copyMessage(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1000);
    } catch {}
  }

  // Simulated streaming assistant reply
  async function streamAssistantText(fullText: string) {
    let current = "";
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    for (let i = 0; i < fullText.length; i++) {
      current += fullText[i];
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: current };
        return copy;
      });
      await new Promise((r) => setTimeout(r, fullText[i] === " " ? 4 : 14));
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setPending(true);

    try {
      const origin =
        typeof window !== "undefined"
          ? new URL(window.location.href).origin
          : "http://localhost:9000";
      const base = (window as any).GAJA_API_BASE || origin;

      const res = await fetch(`${base}/bot/web/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sessionId, internal: true }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = data?.reply || "تمام، شن نقدر نعاونك فيه؟";
      await streamAssistantText(reply);
    } catch {
      await streamAssistantText("صار خلل بسيط، جرّب مرة ثانية.");
    } finally {
      setPending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ChatGPT-like centered column
  const columnWidth = { xs: "100%", sm: "min(720px, 92vw)" };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={full}
      maxWidth="xl"
      PaperProps={{
        sx: {
          borderRadius: full ? 0 : 3,
          overflow: "hidden",
          bgcolor: (t) => (t.palette.mode === "dark" ? "#0f1115" : "#ffffff"),
          width: full ? "100%" : { xs: "100%", md: "min(1200px, 96vw)" },
          height: full ? "100%" : { xs: "85vh", md: "88vh" },
          boxShadow: (t) => t.shadows[24],
          position: "relative",
        },
      }}
      BackdropProps={{
        sx: {
          backdropFilter: "blur(14px) saturate(1.12)",
          backgroundColor: "rgba(0,0,0,0.3)",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          px: { xs: 1.5, sm: 2 },
          py: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          background: (t) => t.palette.background.paper,
        }}
      >
        <IconButton
          onClick={() => setSidebarOpen((s) => !s)}
          aria-label="history"
        >
          <HistoryIcon />
        </IconButton>

        <ChatIcon sx={{ color: PANTONE_BLUE }} />
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 800, letterSpacing: 0.2 }}
        >
          {title}
        </Typography>
        <Chip
          size="small"
          label="Thinking"
          sx={{
            ml: 0.5,
            bgcolor: PANTONE_TAN,
            color: "#111",
            height: 22,
            display: thinking ? "inline-flex" : "none",
          }}
        />
        <Box sx={{ flex: 1 }} />

        <Tooltip title={full ? "Exit full screen" : "Full screen"}>
          <IconButton
            onClick={() => setFull((f) => !f)}
            aria-label="fullscreen"
          >
            {full ? <ZoomInMapIcon /> : <ZoomOutMapIcon />}
          </IconButton>
        </Tooltip>

        <IconButton onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          px: 0,
          pt: 0,
          pb: 0,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "#0d0f13" : "background.default",
          position: "relative",
        }}
      >
        {/* IN-DIALOG SIDEBAR */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: sidebarOpen ? 300 : 0,
            transition: "width 250ms ease",
            overflow: "hidden",
            borderRight: sidebarOpen
              ? (t) => `1px solid ${t.palette.divider}`
              : "none",
            bgcolor: theme.palette.mode === "dark" ? "#0f1216" : "#fafafa",
            zIndex: 3,
          }}
        >
          <Box sx={{ p: 2, alignItems: "center", gap: 1 }}>
            {logo ?? (
              <Box
                sx={{
                  width: 290,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Logo />
              </Box>
            )}
          </Box>
          <Divider />
          <Box sx={{ p: 1 }}>
            <Button fullWidth variant="outlined" onClick={newSession}>
              New chat
            </Button>
          </Box>
          <List dense sx={{ px: 1 }}>
            {sessions.length === 0 && (
              <Typography
                variant="caption"
                sx={{ px: 1, py: 1.5, color: "text.secondary" }}
              >
                No conversations yet
              </Typography>
            )}
            {sessions.map((s) => (
              <ListItemButton
                key={s.id}
                onClick={() => openSession(s.id)}
                selected={s.id === sessionId}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                  primary={s.title || "Chat"}
                  secondary={new Date(s.createdAt).toLocaleString()}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        {/* subtle cover to intercept clicks when sidebar is open */}
        {sidebarOpen && (
          <Box
            onClick={() => setSidebarOpen(false)}
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: "rgba(0,0,0,0.04)",
              zIndex: 2,
            }}
          />
        )}

        {/* Scroll area */}
        <Box
          sx={{
            position: "relative",
            flex: 1,
            overflowY: "auto",
            display: "grid",
            placeItems: "stretch",
            py: { xs: 1.5, sm: 2 },
          }}
        >
          {/* Content shifts if sidebar open */}
          <Box sx={{ width: columnWidth, mx: "auto" }}>
            <Stack spacing={0}>
              {messages.map((m, i) => {
                const isAssistant = m.role === "assistant";

                if (isAssistant) {
                  // ASSISTANT: ChatGPT-style full-width block without avatar or bubble
                  return (
                    <Box
                      key={i}
                      sx={{
                        px: { xs: 1.5, sm: 2 },
                        py: 2,
                        borderBottom: (t) => `1px solid ${t.palette.divider}`,
                        bgcolor:
                          theme.palette.mode === "dark" ? "#0f1217" : "#fff",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          mb: 0.75,
                          display: "block",
                        }}
                      >
                        {title}
                      </Typography>

                      <Typography
                        component="div"
                        sx={{
                          whiteSpace: "pre-wrap",
                          fontSize: 15,
                          lineHeight: 1.8,
                          color: "text.primary",
                        }}
                      >
                        {m.content}
                      </Typography>

                      {!!m.images?.length && (
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ mt: 1, flexWrap: "wrap" }}
                        >
                          {m.images.slice(0, 6).map((url, idx) => (
                            <Box
                              key={idx}
                              sx={{
                                width: 96,
                                height: 96,
                                borderRadius: 1,
                                overflow: "hidden",
                                bgcolor: "#00000010",
                              }}
                            >
                              <img
                                src={url}
                                alt={`img-${idx}`}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  display: "block",
                                }}
                              />
                            </Box>
                          ))}
                        </Stack>
                      )}

                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "flex-end",
                          mt: 1,
                        }}
                      >
                        <Tooltip title="Copy">
                          <IconButton
                            size="small"
                            onClick={() => copyMessage(i, m.content)}
                            sx={{ opacity: 0.7 }}
                          >
                            {copiedIdx === i ? (
                              <CheckIcon fontSize="small" />
                            ) : (
                              <ContentCopyIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                }

                // USER: iMessage-style right-aligned blue bubble with tail
                return (
                  <Box
                    key={i}
                    sx={{
                      px: { xs: 1.5, sm: 2 },
                      py: 2,
                      borderBottom: (t) => `1px solid ${t.palette.divider}`,
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.25}
                      sx={{
                        justifyContent: "flex-end",
                        alignItems: "flex-end",
                      }}
                    >
                      {/* bubble */}
                      <Box
                        sx={{
                          position: "relative",
                          maxWidth: "min(80%, 560px)",
                          bgcolor: IMESSAGE_BLUE,
                          color: IMESSAGE_TEXT,
                          px: 1.5,
                          py: 1,
                          borderRadius: 3,
                          borderTopRightRadius: 1,
                          // tail
                          "&:after": {
                            content: '""',
                            position: "absolute",
                            right: -6,
                            bottom: 0,
                            width: 0,
                            height: 0,
                            borderLeft: "6px solid " + IMESSAGE_BLUE,
                            borderTop: "6px solid transparent",
                            borderBottom: "6px solid transparent",
                          },
                        }}
                      >
                        <Typography
                          sx={{
                            whiteSpace: "pre-wrap",
                            fontSize: 15,
                            lineHeight: 1.75,
                          }}
                        >
                          {m.content}
                        </Typography>
                      </Box>

                      {/* small user pill at far right */}
                      <UserPill />
                    </Stack>
                  </Box>
                );
              })}

              {/* thinking panel */}
              {thinking && (
                <Box
                  sx={{
                    px: { xs: 1.5, sm: 2 },
                    py: 2,
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                    bgcolor: theme.palette.mode === "dark" ? "#0f1217" : "#fff",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      mb: 0.75,
                      display: "block",
                    }}
                  >
                    {title}
                  </Typography>
                  <Typography
                    component="pre"
                    sx={{
                      whiteSpace: "pre-wrap",
                      fontSize: 12,
                      color: "text.secondary",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      opacity: 0.7,
                    }}
                  >
                    {`▌ reasoning…
▌ gathering tools…
▌ planning steps…`}
                  </Typography>
                </Box>
              )}

              {/* typing shimmer */}
              {pending && (
                <Box
                  sx={{
                    px: { xs: 1.5, sm: 2 },
                    py: 2,
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                    bgcolor: theme.palette.mode === "dark" ? "#0f1217" : "#fff",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      mb: 0.75,
                      display: "block",
                    }}
                  >
                    {title}
                  </Typography>
                  <Shimmer />
                  <Typography variant="caption" sx={{ ml: 1, opacity: 0.6 }}>
                    typing <Dots />
                  </Typography>
                </Box>
              )}

              <div ref={scrollRef} />
            </Stack>
          </Box>
        </Box>

        {/* Composer */}
        <Box
          sx={{
            width: columnWidth,
            mx: "auto",
            borderTop: (t) => `1px solid ${t.palette.divider}`,
          }}
        >
          <Composer>
            <TextField
              fullWidth
              size="small"
              placeholder="Send a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              multiline
              maxRows={10}
            />
            <IconButton
              aria-label="send"
              onClick={send}
              disabled={pending || !input.trim()}
              sx={{
                bgcolor: input.trim()
                  ? PANTONE_BLUE
                  : "action.disabledBackground",
                color: input.trim() ? "#fff" : "text.disabled",
                "&:hover": input.trim() ? { bgcolor: "#0b63c7" } : undefined,
                alignSelf: "center",
              }}
            >
              <SendIcon />
            </IconButton>
          </Composer>

          <Typography
            variant="caption"
            sx={{
              display: "block",
              textAlign: "center",
              color: "text.secondary",
              py: 1,
            }}
          >
            Gaja AI can make mistakes. Consider checking important info.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
