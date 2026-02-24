"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Loader2, Monitor, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";
import type { VncScreenHandle } from "react-vnc";

const VncScreen = dynamic(
  () => import("react-vnc").then((m) => ({ default: m.VncScreen })),
  { ssr: false }
);

interface Session {
  wsUrl: string;
  vncPassword: string;
}

interface Props {
  vmId: string;
  vmType: string;
  isRunning: boolean;
}

export function VmConsole({ vmId, vmType, isRunning }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [showClipboard, setShowClipboard] = useState(false);
  const [clipboardText, setClipboardText] = useState("");
  // showClipboard/clipboardText uniquement utilisés en fallback (HTTP sans clipboard API)
  const vncRef = useRef<VncScreenHandle>(null);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/vms/${vmId}/console`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur console");
        return;
      }
      const apiUrl = new URL(getApiBaseUrl());
      const proto = apiUrl.protocol === "https:" ? "wss" : "ws";
      setSession({
        wsUrl: `${proto}://${apiUrl.host}/ws-console/${data.wsToken}`,
        vncPassword: data.vncPassword,
      });
    } catch {
      toast.error("Erreur lors de l'ouverture de la console");
    } finally {
      setLoading(false);
    }
  }, [vmId]);

  const reconnect = useCallback(() => {
    setSession(null);
    setTimeout(connect, 100);
  }, [connect]);

  const sendClipboard = useCallback(() => {
    if (!clipboardText) return;
    vncRef.current?.clipboardPaste(clipboardText);
    toast.success("Texte envoyé à la VM");
    setClipboardText("");
    setShowClipboard(false);
  }, [clipboardText]);

  // Ctrl+Shift+V → colle depuis le presse-papier système directement dans la VM
  useEffect(() => {
    if (!session) return;
    const handler = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyV") {
        e.preventDefault();
        e.stopPropagation();
        try {
          const text = await navigator.clipboard.readText();
          if (text) vncRef.current?.clipboardPaste(text);
        } catch {
          // Clipboard API non disponible (HTTP sans localhost) → ouvrir le panneau
          setShowClipboard(true);
        }
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [session]);

  if (!isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
        <Monitor className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">La VM doit être démarrée pour accéder à la console.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {vmType === "LXC" ? "Console LXC" : "Console KVM"} — noVNC via Proxmox
          {session && <span className="ml-2 text-xs opacity-60">· Ctrl+Shift+V pour coller</span>}
        </p>
        <div className="flex gap-2">
          {session && (
            <Button variant="ghost" size="sm" onClick={reconnect}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Reconnecter
            </Button>
          )}
          {!session && (
            <Button size="sm" onClick={connect} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Monitor className="h-4 w-4 mr-1.5" />
              )}
              Ouvrir la console
            </Button>
          )}
        </div>
      </div>

      {showClipboard && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Collez votre texte ci-dessous puis cliquez sur &quot;Envoyer&quot; — il sera tapé dans la VM.
          </p>
          <textarea
            autoFocus
            rows={3}
            placeholder="Collez votre texte ici…"
            value={clipboardText}
            onChange={(e) => setClipboardText(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowClipboard(false); setClipboardText(""); }}>
              Annuler
            </Button>
            <Button size="sm" onClick={sendClipboard} disabled={!clipboardText}>
              Envoyer à la VM
            </Button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 860 }}>
      <div
        className="rounded-lg border border-border bg-black overflow-hidden"
        style={{ aspectRatio: "16/9", position: "relative" }}
      >
        {session ? (
          <VncScreen
            ref={vncRef}
            url={session.wsUrl}
            rfbOptions={{ credentials: { username: "", password: session.vncPassword, target: "" } }}
            scaleViewport
            resizeSession
            focusOnClick
            qualityLevel={6}
            compressionLevel={2}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            onDisconnect={() => setSession(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-zinc-600">Cliquez sur &quot;Ouvrir la console&quot; pour démarrer</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
