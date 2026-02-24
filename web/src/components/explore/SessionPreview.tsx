import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Session,
  fetchSessionJson,
  fetchSessionContent,
  SessionData,
  SessionMessage,
} from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SessionPreviewProps {
  session: Session | null;
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(11, 16);
  }
}

function MessageBubble({
  message,
  isUser,
}: {
  message: SessionMessage;
  isUser: boolean;
}) {
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        )}
      >
        <div
          className={cn(
            "[&_p]:my-1 [&_ul]:my-1 [&_li]:my-0 [&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:p-3 [&_pre_code]:p-0 [&_pre_code]:bg-transparent",
            isUser
              ? "[&_pre]:bg-primary-foreground/15"
              : "[&_pre]:bg-slate-200 [&_pre]:text-slate-900 dark:[&_pre]:bg-slate-700 dark:[&_pre]:text-slate-100"
          )}
        >
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>
        {message.timestamp && (
          <div
            className={cn(
              "mt-1 text-xs opacity-70",
              isUser ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBlock({ message }: { message: SessionMessage }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm dark:border-violet-900 dark:bg-violet-950/50">
              <span className="text-violet-600 dark:text-violet-400">💭</span>
              <span className="font-medium text-violet-800 dark:text-violet-200">
                Thinking
              </span>
              {message.timestamp && (
                <span className="ml-auto text-xs text-violet-600/80">
                  {formatTime(message.timestamp)}
                </span>
              )}
              <span className="ml-1 group-open:rotate-180 transition-transform">
                ▾
              </span>
            </div>
          </summary>
          <div className="mt-1 max-h-64 overflow-auto rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3 text-sm dark:border-violet-900 dark:bg-violet-950/30">
            <pre className="whitespace-pre-wrap font-sans text-violet-900 dark:text-violet-100">
              {message.text}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}

function ToolBlock({ message }: { message: SessionMessage }) {
  const isUse = message.text.startsWith("[tool_use]");
  const label = isUse ? "Tool call" : "Tool result";
  const icon = isUse ? "🔧" : "📤";

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/50">
              <span>{icon}</span>
              <span className="font-medium text-amber-800 dark:text-amber-200">
                {label}
              </span>
              {message.timestamp && (
                <span className="ml-auto text-xs text-amber-600/80">
                  {formatTime(message.timestamp)}
                </span>
              )}
              <span className="ml-1 group-open:rotate-180 transition-transform">
                ▾
              </span>
            </div>
          </summary>
          <div className="mt-1 max-h-64 overflow-auto rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            <pre className="whitespace-pre-wrap font-mono text-xs text-amber-900 dark:text-amber-100">
              {message.text}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}

function SystemBlock({ message }: { message: SessionMessage }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/50">
              <span className="text-slate-500">⚙</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                System
              </span>
              <span className="ml-1 group-open:rotate-180 transition-transform">
                ▾
              </span>
            </div>
          </summary>
          <div className="mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/30">
            <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300">
              {message.text}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}

export function SessionPreview({ session }: SessionPreviewProps) {
  const [data, setData] = useState<SessionData | null>(null);
  const [markdownFallback, setMarkdownFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setData(null);
      setMarkdownFallback(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMarkdownFallback(null);

    (async () => {
      try {
        const json = await fetchSessionJson(session.session_key);
        if (!cancelled) {
          setData(json);
          setMarkdownFallback(null);
        }
      } catch {
        // JSON endpoint failed — fall back to markdown
        try {
          const md = await fetchSessionContent(session.session_key);
          if (!cancelled) {
            if (md.trimStart().startsWith("<")) {
              setError("API returned HTML. Start backend: uv run convx explore");
            } else {
              setData(null);
              setMarkdownFallback(md);
            }
          }
        } catch (e: any) {
          if (!cancelled) setError(e.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session?.session_key]);

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select a session to preview
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (error && !data && !markdownFallback) {
    return (
      <div className="flex h-full items-center justify-center text-destructive text-sm px-4 text-center">
        {error}
      </div>
    );
  }

  if (markdownFallback) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 prose prose-sm max-w-none dark:prose-invert prose-code:break-words prose-pre:overflow-x-auto prose-pre:bg-slate-200 prose-pre:text-slate-900 dark:prose-pre:bg-slate-700 dark:prose-pre:text-slate-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0">
          <ReactMarkdown>{markdownFallback}</ReactMarkdown>
        </div>
      </ScrollArea>
    );
  }

  if (!data) return null;

  const visible = data.messages.filter((m) =>
    ["user", "assistant", "thinking", "tool", "system"].includes(m.kind)
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="text-xs text-muted-foreground mb-6 pb-2 border-b">
          {data.source_system} · {data.user} · {data.system_name}
          {data.cwd && ` · ${data.cwd}`}
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No messages in this session.
          </p>
        ) : (
          visible.map((msg, i) => {
            if (msg.kind === "user") {
              return (
                <MessageBubble key={i} message={msg} isUser={true} />
              );
            }
            if (msg.kind === "assistant") {
              return (
                <MessageBubble key={i} message={msg} isUser={false} />
              );
            }
            if (msg.kind === "thinking") {
              return <ThinkingBlock key={i} message={msg} />;
            }
            if (msg.kind === "tool") {
              return <ToolBlock key={i} message={msg} />;
            }
            if (msg.kind === "system") {
              return <SystemBlock key={i} message={msg} />;
            }
            return null;
          })
        )}
      </div>
    </ScrollArea>
  );
}
