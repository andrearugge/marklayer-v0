"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, MessageSquare, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface Props {
  projectId: string;
}

const SUGGESTED_PROMPTS = [
  "Quali contenuti dovrei creare adesso?",
  "Come posso migliorare lo score AI?",
  "Quali topic mancano nel mio portfolio?",
  "Analizza i gap critici del mio brand.",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatPanel({ projectId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(messageText?: string) {
    const text = (messageText ?? input).trim();
    if (!text || isStreaming) return;

    setInput("");

    const userMessage: Message = { role: "user", content: text };
    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    // Add user message + empty assistant bubble
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    // Build history (exclude the assistant placeholder we just added)
    const history = messages.map(({ role, content }) => ({ role, content }));

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        const errorMsg =
          (data as { error?: string }).error ?? "Errore durante la risposta.";
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { role: "assistant", content: errorMsg, isStreaming: false }
              : m
          )
        );
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload) as {
              token?: string;
              error?: string;
            };

            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1
                    ? { role: "assistant", content: parsed.error!, isStreaming: false }
                    : m
                )
              );
              return;
            }

            if (parsed.token) {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1
                    ? { ...m, content: m.content + parsed.token }
                    : m
                )
              );
            }
          } catch {
            // skip malformed JSON line
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { role: "assistant", content: "Servizio AI non raggiungibile.", isStreaming: false }
            : m
        )
      );
    } finally {
      // Mark streaming done
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, isStreaming: false } : m
        )
      );
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setIsStreaming(false);
  }

  const isEmpty = messages.length === 0;

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-violet-500" />
            Assistente AI
          </CardTitle>
          {!isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="h-7 gap-1.5 text-xs text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Nuova chat
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Messages area */}
      <CardContent className="flex-1 overflow-y-auto px-4 py-2 space-y-4 min-h-0">
        {isEmpty ? (
          /* Blank state with suggested prompts */
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="space-y-2">
              <Bot className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium">Chiedi qualcosa al tuo assistente</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Risponde con dati contestualizzati sul tuo content portfolio.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={isStreaming}
                  className="text-left rounded-lg border px-3 py-2.5 text-xs hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="shrink-0 mt-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 p-1.5 h-7 w-7 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}
                >
                  {msg.content || (msg.isStreaming ? null : "—")}
                  {msg.isStreaming && msg.content === "" && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  {msg.isStreaming && msg.content !== "" && (
                    <span className="ml-0.5 inline-block w-0.5 h-3.5 bg-current animate-pulse rounded-full align-middle" />
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="shrink-0 mt-0.5 rounded-full bg-muted p-1.5 h-7 w-7 flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>

      {/* Input area */}
      <CardFooter className="shrink-0 flex-col gap-2 pt-3 pb-4 border-t">
        <div className="flex w-full gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un messaggio… (Invio per inviare)"
            rows={2}
            disabled={isStreaming}
            className="resize-none text-sm min-h-0"
          />
          <Button
            onClick={() => handleSend()}
            disabled={isStreaming || !input.trim()}
            size="sm"
            className="self-end h-9 w-9 p-0 shrink-0"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground self-start">
          La conversazione non viene salvata tra sessioni.
        </p>
      </CardFooter>
    </Card>
  );
}
