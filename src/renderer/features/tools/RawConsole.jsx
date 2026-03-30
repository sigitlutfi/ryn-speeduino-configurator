import React, { useEffect, useRef, useState } from "react";
import { Terminal, Trash2, Send, Droplets, Radio, Copy } from "lucide-react";
import { useStore } from "../../core/store.js";
import { serialService } from "../../core/services/serialService.js";

const RX_GROUP_WINDOW_MS = 30;

const formatHex = (bytes) =>
  bytes
    .map((value) => value.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");

const formatAscii = (bytes) =>
  bytes
    .map((value) =>
      value >= 32 && value <= 126 ? String.fromCharCode(value) : ".",
    )
    .join("");

const formatEntryLine = (entry) =>
  `[${entry.timestamp}] ${entry.type.toUpperCase()}  ${formatHex(entry.bytes)}  |  ${formatAscii(entry.bytes)}`;

const truncateMiddle = (text, head = 88, tail = 40) => {
  if (text.length <= head + tail + 5) return text;
  return `${text.slice(0, head)} ... ${text.slice(-tail)}`;
};

const getEntryPreview = (entry) => ({
  hex: truncateMiddle(formatHex(entry.bytes)),
  ascii: truncateMiddle(formatAscii(entry.bytes), 40, 18),
});

const parseHexInput = (value) => {
  const tokens = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);

  if (tokens.length === 0) return [];

  return tokens.map((token) => {
    const normalized = token.replace(/^0x/i, "");
    if (!/^[\da-fA-F]{1,2}$/.test(normalized)) {
      throw new Error(`Invalid hex byte: ${token}`);
    }
    return Number.parseInt(normalized, 16);
  });
};

export default function RawConsole() {
  const connectionStatus = useStore((s) => s.connection.status);
  const notify = useStore((s) => s.notify);
  const [mode, setMode] = useState("ascii");
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState([]);
  const logRef = useRef(null);
  const rxBufferRef = useRef([]);
  const rxTimerRef = useRef(null);

  const appendEntry = (entry) => {
    setEntries((prev) => [...prev.slice(-399), entry]);
  };

  const flushBufferedRx = () => {
    if (rxTimerRef.current) {
      clearTimeout(rxTimerRef.current);
      rxTimerRef.current = null;
    }

    if (rxBufferRef.current.length === 0) return;

    appendEntry({
      id: `${Date.now()}-rx-${Math.random().toString(16).slice(2, 8)}`,
      type: "rx",
      timestamp: new Date().toLocaleTimeString(),
      bytes: rxBufferRef.current,
    });
    rxBufferRef.current = [];
  };

  useEffect(() => {
    serialService.suspendOutputChannelsPolling();

    const unsubscribe = window.serial.onData((data) => {
      const bytes = Array.isArray(data) ? data : Array.from(data || []);
      rxBufferRef.current = [...rxBufferRef.current, ...bytes];

      if (rxTimerRef.current) {
        clearTimeout(rxTimerRef.current);
      }

      rxTimerRef.current = setTimeout(() => {
        flushBufferedRx();
      }, RX_GROUP_WINDOW_MS);
    });

    return () => {
      flushBufferedRx();
      if (typeof unsubscribe === "function") unsubscribe();
      if (rxTimerRef.current) {
        clearTimeout(rxTimerRef.current);
        rxTimerRef.current = null;
      }
      serialService.resumeOutputChannelsPolling();
    };
  }, []);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [entries]);

  const handleSend = async () => {
    if (!command.trim()) return;
    if (connectionStatus !== "connected") {
      notify("Connect to ECU first", "error");
      return;
    }

    try {
      const payload =
        mode === "hex" ? parseHexInput(command) : command;
      const bytes =
        mode === "hex"
          ? payload
          : Array.from(new TextEncoder().encode(payload));

      const result = await window.serial.sendCommand(payload);
      if (!result?.ok) {
        throw new Error(result?.error || "Failed to send command");
      }

      flushBufferedRx();
      appendEntry({
        id: `${Date.now()}-tx-${Math.random().toString(16).slice(2, 8)}`,
        type: "tx",
        timestamp: new Date().toLocaleTimeString(),
        bytes,
      });
      setCommand("");
    } catch (err) {
      notify(err.message || "Failed to send command", "error");
    }
  };

  const handleFlush = async () => {
    const result = await window.serial.flush();
    if (result?.ok) {
      notify("Serial buffer flushed", "success");
    } else {
      notify(result?.error || "Flush failed", "error");
    }
  };

  const handleCopy = async () => {
    try {
      const text = entries.map(formatEntryLine).join("\n");
      await navigator.clipboard.writeText(text);
      notify("Session log copied", "success");
    } catch (err) {
      notify("Failed to copy session log", "error");
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3 text-white">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Terminal size={20} />
                </div>
                <div>
                  <h1 className="text-sm font-orbitron font-black uppercase tracking-[0.24em]">
                    Raw Console
                  </h1>
                  <p className="mt-1 text-xs text-gray-400">
                    Monitor RX/TX traffic and send manual ECU commands.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em]">
                <Radio
                  size={12}
                  className={
                    connectionStatus === "connected"
                      ? "text-emerald-400"
                      : "text-gray-500"
                  }
                />
                <span className="text-gray-400">Link</span>
                <span className="text-white">{connectionStatus}</span>
              </div>

              <button
                type="button"
                onClick={handleFlush}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 transition-colors hover:bg-cyan-400/20"
              >
                <Droplets size={12} />
                Flush
              </button>

              <button
                type="button"
                onClick={handleCopy}
                disabled={entries.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Copy size={12} />
                Copy
              </button>

              <button
                type="button"
                onClick={() => setEntries([])}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 transition-colors hover:bg-white/10"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-h-[420px] rounded-3xl border border-white/10 bg-[#05070d]/95">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <div className="text-[10px] font-orbitron font-black uppercase tracking-[0.22em] text-gray-500">
                  Session Log
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-gray-600">
                  {entries.length} entries
                </div>
              </div>

              <div
                ref={logRef}
                className="h-[420px] overflow-auto px-3 py-2 font-mono text-[11px] leading-5"
              >
                {entries.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-gray-600">
                    Waiting for serial traffic...
                  </div>
                ) : (
                  <div className="space-y-1">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`rounded-lg border px-2.5 py-1.5 ${
                          entry.type === "tx"
                            ? "border-cyan-400/15 bg-cyan-400/5"
                            : "border-emerald-400/15 bg-emerald-400/5"
                        }`}
                        title={formatEntryLine(entry)}
                      >
                        <div className="flex items-start gap-3 break-all">
                          <span className="shrink-0 text-[10px] text-gray-500">
                            [{entry.timestamp}]
                          </span>
                          <span
                            className={`shrink-0 text-[10px] font-black uppercase tracking-[0.16em] ${
                              entry.type === "tx"
                                ? "text-cyan-300"
                                : "text-emerald-300"
                            }`}
                          >
                            {entry.type}
                          </span>
                          <span className="shrink-0 text-[10px] text-gray-600">
                            {entry.bytes.length}B
                          </span>
                          <span className="text-gray-200">
                            {getEntryPreview(entry).hex}
                          </span>
                          <span className="shrink-0 text-gray-600">|</span>
                          <span className="text-gray-500">
                            {getEntryPreview(entry).ascii}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-[10px] font-orbitron font-black uppercase tracking-[0.22em] text-gray-500">
                  Send Command
                </div>

                <div className="mt-4 flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
                  {["ascii", "hex"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      className={`flex-1 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                        mode === value
                          ? "bg-cyan-400/20 text-cyan-300"
                          : "text-gray-500 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>

                <textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder={
                    mode === "hex"
                      ? "Example: 43 00 FF"
                      : "Example: Q"
                  }
                  className="mt-4 h-40 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-cyan-400/40"
                />

                <button
                  type="button"
                  onClick={handleSend}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300 transition-colors hover:bg-cyan-400/20"
                >
                  <Send size={12} />
                  Send Command
                </button>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-xs text-gray-400">
                <div className="text-[10px] font-orbitron font-black uppercase tracking-[0.22em] text-gray-500">
                  Notes
                </div>
                <div className="mt-3 space-y-2 leading-relaxed">
                  <p>`ASCII` sends text exactly as typed.</p>
                  <p>`HEX` expects bytes separated by space or comma.</p>
                  <p>Incoming traffic is shown as both hex and printable ASCII.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
