import { describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import pino from "pino";
import { Writable } from "node:stream";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { Buffer } from "node:buffer";

import { DaemonClient, type WebSocketLike } from "@getpaseo/client/internal/daemon-client";
import { generateLocalPairingOffer } from "../pairing-offer.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";
import { createClientChannel, type Transport } from "@getpaseo/relay/e2ee";
import {
  deriveSharedKey,
  decrypt,
  encrypt,
  exportPublicKey,
  generateKeyPair,
  importPublicKey,
} from "@getpaseo/relay";
import { buildRelayWebSocketUrl } from "@getpaseo/protocol/daemon-endpoints";
import { ConnectionOfferSchema } from "@getpaseo/protocol/connection-offer";
import { CLIENT_CAPS } from "@getpaseo/protocol/client-capabilities";
import { WSOutboundMessageSchema, type SessionOutboundMessage } from "@getpaseo/protocol/messages";

const nodeMajor = Number((process.versions.node ?? "0").split(".")[0] ?? "0");
const shouldRunRelayE2e = process.env.FORCE_RELAY_E2E === "1" || nodeMajor < 25;
const require = createRequire(import.meta.url);
const wranglerCliPath = require.resolve("wrangler/bin/wrangler.js");

function createCapturingLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString("utf8"));
      cb();
    },
  });
  const logger = pino({ level: "debug" }, stream);
  return { logger, lines };
}

async function getPairingOfferUrl(args: {
  paseoHome: string;
  relayEnabled?: boolean;
  relayEndpoint?: string;
  relayPublicEndpoint?: string;
  appBaseUrl?: string;
}): Promise<string> {
  const pairing = await generateLocalPairingOffer({
    paseoHome: args.paseoHome,
    relayEnabled: args.relayEnabled,
    relayEndpoint: args.relayEndpoint,
    relayPublicEndpoint: args.relayPublicEndpoint,
    appBaseUrl: args.appBaseUrl,
    includeQr: false,
  });
  if (!pairing.url) {
    throw new Error("Expected relay pairing URL to be available");
  }
  return pairing.url;
}

function decodeOfferFromFragmentUrl(url: string): {
  serverId: string;
  daemonPublicKeyB64: string;
} {
  const marker = "#offer=";
  const idx = url.indexOf(marker);
  if (idx === -1) {
    throw new Error(`missing ${marker} fragment: ${url}`);
  }
  const encoded = url.slice(idx + marker.length);
  const json = Buffer.from(encoded, "base64url").toString("utf8");
  const offer = ConnectionOfferSchema.parse(JSON.parse(json));
  return { serverId: offer.serverId, daemonPublicKeyB64: offer.daemonPublicKeyB64 };
}

function encodeCiphertext(ciphertext: ArrayBuffer): string {
  return Buffer.from(new Uint8Array(ciphertext)).toString("base64");
}

function decodeCiphertext(text: string): ArrayBuffer {
  const buffer = Buffer.from(text, "base64");
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

// Fixed transport key for an unsupported peer public key.
const UNSUPPORTED_PEER_TRANSPORT_KEY = Uint8Array.from(
  Buffer.from("351f86faa3b988468a850122b65b0acece9c4826806aeee63de9c0da2bd7f91e", "hex"),
);

function parseEncryptedJson(sharedKey: Uint8Array, text: string): unknown {
  const plaintext = new TextDecoder().decode(decrypt(sharedKey, decodeCiphertext(text)));
  return JSON.parse(plaintext);
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to acquire port")));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(port: number, timeout = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect(port, "127.0.0.1", () => {
          socket.end();
          resolve();
        });
        socket.on("error", reject);
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`Server did not start on port ${port} within ${timeout}ms`);
}

async function waitForRelayWebSocketReady(port: number, timeout = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const serverId = `probe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const url = buildRelayWebSocketUrl({
      endpoint: `127.0.0.1:${port}`,
      useTls: false,
      serverId,
      role: "server",
    });
    const opened = await new Promise<boolean>((resolve) => {
      let pendingResolve: ((value: boolean) => void) | null = resolve;
      const settle = (value: boolean) => {
        if (!pendingResolve) return;
        const fn = pendingResolve;
        pendingResolve = null;
        clearTimeout(timer);
        fn(value);
      };
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.terminate();
        settle(false);
      }, 5000);
      ws.once("open", () => {
        ws.close(1000, "probe");
        settle(true);
      });
      ws.once("error", () => {
        settle(false);
      });
    });
    if (opened) {
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Relay WebSocket endpoint not ready on port ${port} within ${timeout}ms`);
}

async function waitForCapturedLog(
  lines: string[],
  predicate: (line: string) => boolean,
  timeout = 1000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (lines.some(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for captured log. Recent logs:\n${lines.slice(-20).join("")}`);
}

async function waitForCondition(
  predicate: () => boolean,
  timeout = 20_000,
  interval = 10,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timed out waiting for condition after ${timeout}ms`);
}

function isAssistantTimelineMessage(
  message: SessionOutboundMessage,
  agentId: string,
  text?: string,
): boolean {
  return (
    message.type === "agent_stream" &&
    message.payload.agentId === agentId &&
    message.payload.event.type === "timeline" &&
    message.payload.event.item.type === "assistant_message" &&
    (text === undefined || message.payload.event.item.text === text)
  );
}

function countAssistantTimelineMessages(
  messages: SessionOutboundMessage[],
  agentId: string,
  text: string,
): number {
  let count = 0;
  for (const message of messages) {
    if (isAssistantTimelineMessage(message, agentId, text)) {
      count += 1;
    }
  }
  return count;
}

(shouldRunRelayE2e ? describe : describe.skip)("Relay transport (E2EE) - daemon E2E", () => {
  let relayPort: number;
  let relayProcess: ChildProcess | null = null;
  let relayStdoutLines: string[] = [];

  const startRelay = async (options: { useLocalRelay?: boolean } = {}) => {
    relayStdoutLines = [];
    relayPort = await getAvailablePort();
    const relayDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../relay",
    );
    const relayArgs = [
      "wrangler",
      "dev",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(relayPort),
      "--live-reload=false",
      "--show-interactive-dev-session=false",
    ];
    if (options.useLocalRelay) {
      relayArgs.push("--var", "PASEO_RELAY_UPSTREAM:");
    }
    relayProcess = spawn(process.execPath, [wranglerCliPath, ...relayArgs.slice(1)], {
      cwd: relayDir,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    relayProcess.stdout?.on("data", (data: Buffer) => {
      const lines = data
        .toString()
        .split("\n")
        .filter((l) => l.trim());
      for (const line of lines) {
        relayStdoutLines.push(line);
        // eslint-disable-next-line no-console
        console.log(`[relay] ${line}`);
      }
    });
    relayProcess.stderr?.on("data", (data: Buffer) => {
      const lines = data
        .toString()
        .split("\n")
        .filter((l) => l.trim());
      for (const line of lines) {
        // eslint-disable-next-line no-console
        console.error(`[relay] ${line}`);
      }
    });

    await waitForServer(relayPort, 30000);
    await waitForRelayWebSocketReady(relayPort, 60000);
  };

  const stopRelay = async () => {
    if (!relayProcess) return;
    relayProcess.kill("SIGTERM");
    relayProcess = null;
  };

  test("daemon connects to relay and client ping/pong works through relay", async () => {
    process.env.PASEO_PRIMARY_LAN_IP = "192.168.1.12";

    const { logger, lines } = createCapturingLogger();
    await startRelay();

    const daemon = await createTestPaseoDaemon({
      listen: "127.0.0.1",
      logger,
      relayEnabled: true,
      relayEndpoint: `127.0.0.1:${relayPort}`,
    });

    try {
      const offerUrl = await getPairingOfferUrl({
        paseoHome: daemon.paseoHome,
        relayEnabled: daemon.config.relayEnabled,
        relayEndpoint: daemon.config.relayEndpoint,
        relayPublicEndpoint: daemon.config.relayPublicEndpoint,
        appBaseUrl: daemon.config.appBaseUrl,
      });
      const { serverId, daemonPublicKeyB64 } = decodeOfferFromFragmentUrl(offerUrl);

      const stableClientId = `cid_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      const ws = new WebSocket(
        buildRelayWebSocketUrl({
          endpoint: `127.0.0.1:${relayPort}`,
          useTls: false,
          serverId,
          role: "client",
        }),
      );

      const received = await new Promise<unknown>((resolve, reject) => {
        let pendingResolve: ((value: unknown) => void) | null = resolve;
        let pendingReject: ((reason: unknown) => void) | null = reject;
        const settleResolve = (value: unknown) => {
          if (!pendingResolve) return;
          const fn = pendingResolve;
          pendingResolve = null;
          pendingReject = null;
          clearTimeout(timeout);
          fn(value);
        };
        const settleReject = (reason: unknown) => {
          if (!pendingReject) return;
          const fn = pendingReject;
          pendingResolve = null;
          pendingReject = null;
          clearTimeout(timeout);
          fn(reason);
        };
        const timeout = setTimeout(() => {
          ws.close();
          settleReject(new Error("timed out waiting for pong"));
        }, 20000);

        const transport: Transport = {
          send: (data) => ws.send(data),
          close: (code?: number, reason?: string) => ws.close(code, reason),
          onmessage: null,
          onclose: null,
          onerror: null,
        };

        ws.on("message", (data, isBinary) => {
          transport.onmessage?.({
            data: isBinary
              ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
              : data.toString(),
            isBinary,
          });
        });
        ws.on("close", (code, reason) => {
          transport.onclose?.(code, reason.toString());
        });
        ws.on("error", (err) => {
          transport.onerror?.(err);
        });

        ws.on("open", async () => {
          try {
            let pingSent = false;
            let channelRef: Awaited<ReturnType<typeof createClientChannel>> | null = null;
            const channel = await createClientChannel(transport, daemonPublicKeyB64, {
              onmessage: (data) => {
                try {
                  const payload = typeof data === "string" ? JSON.parse(data) : data;
                  const wsMsg = WSOutboundMessageSchema.safeParse(payload);
                  if (
                    wsMsg.success &&
                    wsMsg.data.type === "session" &&
                    wsMsg.data.message.type === "status" &&
                    wsMsg.data.message.payload?.status === "server_info"
                  ) {
                    if (!pingSent && channelRef) {
                      pingSent = true;
                      void channelRef.send(JSON.stringify({ type: "ping" }));
                    }
                    return;
                  }
                  if (wsMsg.success && wsMsg.data.type === "pong") {
                    settleResolve(wsMsg.data);
                    ws.close();
                  }
                } catch (err) {
                  settleReject(err);
                }
              },
              onerror: (err) => {
                settleReject(err);
              },
            });
            channelRef = channel;
            await channel.send(
              JSON.stringify({
                type: "hello",
                clientId: stableClientId,
                clientType: "cli",
                protocolVersion: 1,
              }),
            );
          } catch (err) {
            settleReject(err);
          }
        });
      });

      expect(received).toEqual({ type: "pong" });
    } catch (err) {
      const tail = lines.slice(-50).join("");
      // Only prints on failure to help diagnose relay handshake issues.
      // eslint-disable-next-line no-console
      console.error("daemon logs (tail):\n", tail);
      throw err;
    } finally {
      await daemon.close();
      await stopRelay();
    }
  }, 90000);

  test("daemon closes a relay client that sends an unsupported handshake key", async () => {
    process.env.PASEO_PRIMARY_LAN_IP = "192.168.1.12";

    const { logger, lines } = createCapturingLogger();
    await startRelay({ useLocalRelay: true });

    const daemon = await createTestPaseoDaemon({
      listen: "127.0.0.1",
      logger,
      relayEnabled: true,
      relayEndpoint: `127.0.0.1:${relayPort}`,
    });

    try {
      const offerUrl = await getPairingOfferUrl({
        paseoHome: daemon.paseoHome,
        relayEnabled: daemon.config.relayEnabled,
        relayEndpoint: daemon.config.relayEndpoint,
        relayPublicEndpoint: daemon.config.relayPublicEndpoint,
        appBaseUrl: daemon.config.appBaseUrl,
      });
      const { serverId } = decodeOfferFromFragmentUrl(offerUrl);
      const ws = new WebSocket(
        buildRelayWebSocketUrl({
          endpoint: `127.0.0.1:${relayPort}`,
          useTls: false,
          serverId,
          role: "client",
        }),
      );

      let receivedServerInfo = false;
      const isRelayDataConnectedLog = (line: string) => line.includes("relay_data_connected");
      const outcome = await new Promise<
        { type: "closed"; code: number; reason: string } | { type: "errored"; error: Error }
      >((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("timed out waiting for daemon to reject unsupported handshake key"));
        }, 20_000);

        ws.on("open", async () => {
          try {
            await waitForCapturedLog(lines, isRelayDataConnectedLog);
            ws.send(
              JSON.stringify({
                type: "e2ee_hello",
                key: exportPublicKey(new Uint8Array(32)),
              }),
            );
            ws.send(
              encodeCiphertext(
                encrypt(
                  UNSUPPORTED_PEER_TRANSPORT_KEY,
                  JSON.stringify({
                    type: "hello",
                    clientId: "cid_relay_unsupported_key",
                    clientType: "cli",
                    protocolVersion: 1,
                  }),
                ),
              ),
            );
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        ws.on("message", (data) => {
          try {
            const parsed = WSOutboundMessageSchema.parse(
              parseEncryptedJson(UNSUPPORTED_PEER_TRANSPORT_KEY, data.toString()),
            );
            if (
              parsed.type === "session" &&
              parsed.message.type === "status" &&
              parsed.message.payload?.status === "server_info"
            ) {
              receivedServerInfo = true;
              clearTimeout(timeout);
              reject(
                new Error("daemon sent server_info after accepting an unsupported handshake key"),
              );
            }
          } catch {
            // Plaintext e2ee_ready cannot be decrypted and is irrelevant to this assertion.
          }
        });
        ws.on("close", (code, reason) => {
          clearTimeout(timeout);
          resolve({ type: "closed", code, reason: reason.toString() });
        });
        ws.on("error", (error) => {
          clearTimeout(timeout);
          resolve({ type: "errored", error });
        });
      });

      expect(receivedServerInfo).toBe(false);
      if (outcome.type === "closed") {
        expect(outcome.code).toBeGreaterThan(0);
      } else {
        expect(outcome.error).toBeInstanceOf(Error);
      }

      const isRejectedHandshakeLog = (line: string) =>
        line.includes("relay_e2ee_handshake_failed") && line.includes("Invalid peer public key");
      await waitForCapturedLog(lines, isRejectedHandshakeLog);
      expect(lines.some(isRejectedHandshakeLog)).toBe(true);
    } finally {
      await daemon.close();
      await stopRelay();
    }
  }, 90000);

  test("daemon keeps relay socket open while idle (no handshake timeout loop)", async () => {
    process.env.PASEO_PRIMARY_LAN_IP = "192.168.1.12";

    const { logger, lines } = createCapturingLogger();
    await startRelay();

    const daemon = await createTestPaseoDaemon({
      listen: "127.0.0.1",
      logger,
      relayEnabled: true,
      relayEndpoint: `127.0.0.1:${relayPort}`,
    });

    try {
      const offerUrl = await getPairingOfferUrl({
        paseoHome: daemon.paseoHome,
        relayEnabled: daemon.config.relayEnabled,
        relayEndpoint: daemon.config.relayEndpoint,
        relayPublicEndpoint: daemon.config.relayPublicEndpoint,
        appBaseUrl: daemon.config.appBaseUrl,
      });
      const { serverId, daemonPublicKeyB64 } = decodeOfferFromFragmentUrl(offerUrl);

      // Previously, the daemon would time out waiting for `hello` and reconnect every ~10s.
      // Wait long enough to catch that regression.
      await new Promise((r) => setTimeout(r, 12_000));

      const handshakeFailures = lines.filter((line) =>
        line.includes("relay_e2ee_handshake_failed"),
      );
      expect(handshakeFailures.length).toBe(0);

      // Protocol pings (RFC 6455 control frames) are auto-answered at the Cloudflare edge
      // without waking the hibernated relay Durable Object. After 12s, the keepalive interval
      // (10s) must have fired at least once and received a pong. If this assertion fails, the
      // daemon may have regressed to app-level JSON pings (which wake the DO and cost CPU).
      const pongLines = lines.filter((l) => l.includes("relay_control_pong_received"));
      expect(pongLines.length).toBeGreaterThan(0);
      const staleLines = lines.filter((l) => l.includes("relay_control_stale_terminating"));
      expect(staleLines.length).toBe(0);
      // Guard against the dual-ping regression: if a JSON {type:"ping"} reaches the DO during
      // the idle window, the DO logs `legacy_json_ping_received`. The current daemon code must
      // not send JSON pings on the control socket — only protocol pings via socket.ping().
      const legacyPingLines = relayStdoutLines.filter((l) =>
        l.includes("legacy_json_ping_received"),
      );
      expect(legacyPingLines.length).toBe(0);

      const ws = new WebSocket(
        buildRelayWebSocketUrl({
          endpoint: `127.0.0.1:${relayPort}`,
          useTls: false,
          serverId,
          role: "client",
        }),
      );
      const stableClientId = `cid_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

      const received = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("timed out waiting for pong"));
        }, 20000);

        const transport: Transport = {
          send: (data) => ws.send(data),
          close: (code?: number, reason?: string) => ws.close(code, reason),
          onmessage: null,
          onclose: null,
          onerror: null,
        };

        ws.on("message", (data, isBinary) => {
          transport.onmessage?.({
            data: isBinary
              ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
              : data.toString(),
            isBinary,
          });
        });
        ws.on("close", (code, reason) => {
          transport.onclose?.(code, reason.toString());
        });
        ws.on("error", (err) => {
          transport.onerror?.(err);
        });

        ws.on("open", async () => {
          try {
            let pingSent = false;
            let channelRef: Awaited<ReturnType<typeof createClientChannel>> | null = null;
            const channel = await createClientChannel(transport, daemonPublicKeyB64, {
              onmessage: (data) => {
                const payload = typeof data === "string" ? JSON.parse(data) : data;
                const wsMsg = WSOutboundMessageSchema.safeParse(payload);
                if (
                  wsMsg.success &&
                  wsMsg.data.type === "session" &&
                  wsMsg.data.message.type === "status" &&
                  wsMsg.data.message.payload?.status === "server_info"
                ) {
                  if (!pingSent && channelRef) {
                    pingSent = true;
                    void channelRef.send(JSON.stringify({ type: "ping" }));
                  }
                  return;
                }
                if (wsMsg.success && wsMsg.data.type === "pong") {
                  clearTimeout(timeout);
                  resolve(wsMsg.data);
                  ws.close();
                }
              },
              onerror: (err) => {
                clearTimeout(timeout);
                reject(err);
              },
            });
            channelRef = channel;
            await channel.send(
              JSON.stringify({
                type: "hello",
                clientId: stableClientId,
                clientType: "cli",
                protocolVersion: 1,
              }),
            );
          } catch (err) {
            clearTimeout(timeout);
            reject(err);
          }
        });
      });

      expect(received).toEqual({ type: "pong" });
    } catch (err) {
      const tail = lines.slice(-50).join("");
      // eslint-disable-next-line no-console
      console.error("daemon logs (tail):\n", tail);
      throw err;
    } finally {
      await daemon.close();
      await stopRelay();
    }
  }, 90000);

  test("daemon accepts a relay client that pipelines app hello after E2EE hello", async () => {
    process.env.PASEO_PRIMARY_LAN_IP = "192.168.1.12";

    const { logger, lines } = createCapturingLogger();
    await startRelay();

    const daemon = await createTestPaseoDaemon({
      listen: "127.0.0.1",
      logger,
      relayEnabled: true,
      relayEndpoint: `127.0.0.1:${relayPort}`,
    });

    try {
      const offerUrl = await getPairingOfferUrl({
        paseoHome: daemon.paseoHome,
        relayEnabled: daemon.config.relayEnabled,
        relayEndpoint: daemon.config.relayEndpoint,
        relayPublicEndpoint: daemon.config.relayPublicEndpoint,
        appBaseUrl: daemon.config.appBaseUrl,
      });
      const { serverId, daemonPublicKeyB64 } = decodeOfferFromFragmentUrl(offerUrl);
      const clientKeyPair = generateKeyPair();
      const sharedKey = deriveSharedKey(
        clientKeyPair.secretKey,
        importPublicKey(daemonPublicKeyB64),
      );

      const ws = new WebSocket(
        buildRelayWebSocketUrl({
          endpoint: `127.0.0.1:${relayPort}`,
          useTls: false,
          serverId,
          role: "client",
        }),
      );

      const received = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("timed out waiting for server_info"));
        }, 20000);

        const settleResolve = (value: unknown) => {
          clearTimeout(timeout);
          resolve(value);
          ws.close();
        };
        const settleReject = (reason: unknown) => {
          clearTimeout(timeout);
          reject(reason);
          ws.close();
        };

        ws.on("open", () => {
          ws.send(
            JSON.stringify({
              type: "e2ee_hello",
              key: exportPublicKey(clientKeyPair.publicKey),
            }),
          );
          ws.send(
            encodeCiphertext(
              encrypt(
                sharedKey,
                JSON.stringify({
                  type: "hello",
                  clientId: "cid_relay_pipelined_hello",
                  clientType: "cli",
                  protocolVersion: 1,
                }),
              ),
            ),
          );
        });

        ws.on("message", (data) => {
          try {
            const text = typeof data === "string" ? data : data.toString();
            const maybePlaintext = JSON.parse(text) as unknown;
            if (
              maybePlaintext &&
              typeof maybePlaintext === "object" &&
              "type" in maybePlaintext &&
              maybePlaintext.type === "e2ee_ready"
            ) {
              return;
            }
          } catch {
            // encrypted frame; parse below
          }

          try {
            const parsed = WSOutboundMessageSchema.parse(
              parseEncryptedJson(sharedKey, data.toString()),
            );
            if (
              parsed.type === "session" &&
              parsed.message.type === "status" &&
              parsed.message.payload?.status === "server_info"
            ) {
              settleResolve({
                type: parsed.type,
                message: {
                  type: parsed.message.type,
                  payload: { status: parsed.message.payload.status },
                },
              });
            }
          } catch (error) {
            settleReject(error);
          }
        });

        ws.on("close", (code, reason) => {
          settleReject(new Error(`relay client closed before server_info: ${code} ${reason}`));
        });
        ws.on("error", (err) => {
          settleReject(err);
        });
      });

      expect(received).toEqual({
        type: "session",
        message: {
          type: "status",
          payload: { status: "server_info" },
        },
      });
    } catch (err) {
      const tail = lines.slice(-50).join("");
      // eslint-disable-next-line no-console
      console.error("daemon logs (tail):\n", tail);
      throw err;
    } finally {
      await daemon.close();
      await stopRelay();
    }
  }, 90000);

  test("E2EE relay client reconnects and catches up committed timeline rows", async () => {
    process.env.PASEO_PRIMARY_LAN_IP = "192.168.1.12";

    const { logger, lines } = createCapturingLogger();
    await startRelay({ useLocalRelay: true });

    const daemon = await createTestPaseoDaemon({
      listen: "127.0.0.1",
      logger,
      relayEnabled: true,
      relayEndpoint: `127.0.0.1:${relayPort}`,
    });

    let client: DaemonClient | null = null;
    const sockets: WebSocket[] = [];
    let unsubscribeRaw: (() => void) | null = null;

    try {
      const offerUrl = await getPairingOfferUrl({
        paseoHome: daemon.paseoHome,
        relayEnabled: daemon.config.relayEnabled,
        relayEndpoint: daemon.config.relayEndpoint,
        relayPublicEndpoint: daemon.config.relayPublicEndpoint,
        appBaseUrl: daemon.config.appBaseUrl,
      });
      const { serverId, daemonPublicKeyB64 } = decodeOfferFromFragmentUrl(offerUrl);
      const relayUrl = buildRelayWebSocketUrl({
        endpoint: `127.0.0.1:${relayPort}`,
        useTls: false,
        serverId,
        role: "client",
      });

      client = new DaemonClient({
        url: relayUrl,
        clientId: `cid_relay_reconnect_${Date.now().toString(36)}`,
        clientType: "cli",
        connectTimeoutMs: 20_000,
        e2ee: { enabled: true, daemonPublicKeyB64 },
        reconnect: { enabled: true, baseDelayMs: 50, maxDelayMs: 100 },
        capabilities: { [CLIENT_CAPS.selectiveAgentTimeline]: true },
        webSocketFactory: (target, options) => {
          const socket = new WebSocket(target, options?.protocols, {
            headers: options?.headers,
          });
          sockets.push(socket);
          return socket as unknown as WebSocketLike;
        },
      });

      await client.connect();
      const agent = await client.createAgent({
        provider: "codex",
        cwd: daemon.staticDir,
        title: "Relay reconnect timeline test",
        modeId: "full-access",
      });
      await client.fetchAgents({
        subscribe: { subscriptionId: "relay-reconnect-timeline" },
      });
      await client.setAgentTimelineSubscription([agent.id]);

      await daemon.daemon.agentManager.appendTimelineItem(agent.id, {
        type: "assistant_message",
        text: "baseline committed row",
      });
      const baseline = await client.fetchAgentTimeline(agent.id, {
        direction: "tail",
        limit: 0,
        projection: "canonical",
      });
      const baselineCursor = baseline.endCursor;
      expect(baseline.epoch).not.toBe("");
      expect(baselineCursor).not.toBeNull();
      if (!baselineCursor) {
        throw new Error("Expected a timeline cursor after appending the baseline row");
      }

      const liveMessages: SessionOutboundMessage[] = [];
      unsubscribeRaw = client.subscribeRawMessages((message) => {
        if (isAssistantTimelineMessage(message, agent.id)) {
          liveMessages.push(message);
        }
      });

      await daemon.daemon.agentManager.emitLiveTimelineItem(agent.id, {
        type: "assistant_message",
        text: "provisional before relay disconnect",
      });
      await waitForCondition(
        () =>
          countAssistantTimelineMessages(
            liveMessages,
            agent.id,
            "provisional before relay disconnect",
          ) > 0,
      );
      const provisionalBeforeDisconnect = liveMessages.find((message) =>
        isAssistantTimelineMessage(message, agent.id, "provisional before relay disconnect"),
      );
      if (!provisionalBeforeDisconnect || provisionalBeforeDisconnect.type !== "agent_stream") {
        throw new Error("Expected a provisional timeline event before the relay disconnect");
      }
      expect(provisionalBeforeDisconnect.payload.epoch).toBe(baseline.epoch);
      expect(provisionalBeforeDisconnect.payload.seq).toBeUndefined();

      const firstSocket = sockets[0];
      expect(firstSocket).toBeDefined();
      if (!firstSocket) {
        throw new Error("Expected the relay client to create an initial WebSocket");
      }
      const socketCountBeforeDisconnect = sockets.length;
      const disconnectedAt = Date.now();
      firstSocket.terminate();
      await waitForCondition(() => client?.getConnectionState().status === "disconnected");

      await daemon.daemon.agentManager.appendTimelineItem(agent.id, {
        type: "assistant_message",
        text: "committed while relay disconnected",
      });

      await waitForCondition(
        () =>
          client?.getConnectionState().status === "connected" &&
          sockets.length > socketCountBeforeDisconnect,
        20_000,
      );
      expect(Date.now() - disconnectedAt).toBeLessThan(5_000);

      const catchUp = await client.fetchAgentTimeline(agent.id, {
        direction: "after",
        cursor: baselineCursor,
        limit: 0,
        projection: "canonical",
      });
      expect(catchUp.epoch).toBe(baseline.epoch);
      expect(catchUp.reset).toBe(false);
      expect(catchUp.staleCursor).toBe(false);
      expect(catchUp.gap).toBe(false);
      expect(catchUp.entries).toHaveLength(1);
      expect(catchUp.startCursor).toEqual({
        epoch: baselineCursor.epoch,
        seq: baselineCursor.seq + 1,
      });
      expect(catchUp.endCursor).toEqual({
        epoch: baselineCursor.epoch,
        seq: baselineCursor.seq + 1,
      });
      expect(catchUp.entries[0]?.item).toEqual({
        type: "assistant_message",
        text: "committed while relay disconnected",
      });

      // Re-establish the live subscription after reconnect, then ensure the next
      // provisional event is delivered once and remains explicitly non-replayable.
      await client.fetchAgents({
        subscribe: { subscriptionId: "relay-reconnect-timeline-after" },
      });
      await client.setAgentTimelineSubscription([agent.id]);
      expect(
        countAssistantTimelineMessages(
          liveMessages,
          agent.id,
          "provisional before relay disconnect",
        ),
      ).toBe(1);
      liveMessages.length = 0;
      await daemon.daemon.agentManager.emitLiveTimelineItem(agent.id, {
        type: "assistant_message",
        text: "live after relay reconnect",
      });
      await waitForCondition(
        () =>
          countAssistantTimelineMessages(liveMessages, agent.id, "live after relay reconnect") > 0,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(
        countAssistantTimelineMessages(liveMessages, agent.id, "live after relay reconnect"),
      ).toBe(1);
      const livePayload = liveMessages.find((message) =>
        isAssistantTimelineMessage(message, agent.id, "live after relay reconnect"),
      );
      if (!livePayload || livePayload.type !== "agent_stream") {
        throw new Error("Expected a matching live timeline event");
      }
      expect(livePayload.payload.epoch).toBe(baseline.epoch);
      expect(livePayload.payload.seq).toBeUndefined();
    } catch (err) {
      const tail = lines.slice(-50).join("");
      // Only prints on failure to help diagnose relay reconnect/handshake issues.
      // eslint-disable-next-line no-console
      console.error("daemon logs (tail):\n", tail);
      throw err;
    } finally {
      unsubscribeRaw?.();
      await client?.close();
      await daemon.close();
      await stopRelay();
    }
  }, 90000);

  test("E2EE relay client creates, streams, resizes, and terminates a terminal", async () => {
    process.env.PASEO_PRIMARY_LAN_IP = "192.168.1.12";

    const { logger, lines } = createCapturingLogger();
    await startRelay({ useLocalRelay: true });

    const daemon = await createTestPaseoDaemon({
      listen: "127.0.0.1",
      logger,
      relayEnabled: true,
      relayEndpoint: `127.0.0.1:${relayPort}`,
    });

    let client: DaemonClient | null = null;
    let unsubscribeOutput: (() => void) | null = null;
    let unsubscribeExit: (() => void) | null = null;

    try {
      const offerUrl = await getPairingOfferUrl({
        paseoHome: daemon.paseoHome,
        relayEnabled: daemon.config.relayEnabled,
        relayEndpoint: daemon.config.relayEndpoint,
        relayPublicEndpoint: daemon.config.relayPublicEndpoint,
        appBaseUrl: daemon.config.appBaseUrl,
      });
      const { serverId, daemonPublicKeyB64 } = decodeOfferFromFragmentUrl(offerUrl);
      const relayUrl = buildRelayWebSocketUrl({
        endpoint: `127.0.0.1:${relayPort}`,
        useTls: false,
        serverId,
        role: "client",
      });

      client = new DaemonClient({
        url: relayUrl,
        clientId: `cid_relay_terminal_${Date.now().toString(36)}`,
        clientType: "cli",
        connectTimeoutMs: 20_000,
        e2ee: { enabled: true, daemonPublicKeyB64 },
        reconnect: { enabled: false },
        webSocketFactory: (target, options) =>
          new WebSocket(target, options?.protocols, {
            headers: options?.headers,
          }) as unknown as WebSocketLike,
      });

      await client.connect();
      const opened = await client.openProject(daemon.staticDir);
      if (!opened.workspace) {
        throw new Error(opened.error ?? "Expected a relay workspace");
      }
      const created = await client.createTerminal(daemon.staticDir, "relay-terminal", undefined, {
        command: process.execPath,
        args: [
          "-e",
          "process.stdin.setEncoding('utf8'); process.stdin.on('data', (chunk) => process.stdout.write('relay-output:' + chunk)); setInterval(() => {}, 1000);",
        ],
        workspaceId: opened.workspace.id,
      });
      if (created.error || !created.terminal) {
        throw new Error(created.error ?? "Expected a relay terminal");
      }
      const terminalId = created.terminal.id;

      const output: string[] = [];
      let initialSnapshotReceived = false;
      let terminalExited = false;
      unsubscribeOutput = client.onTerminalStreamEvent((event) => {
        if (event.terminalId !== terminalId) {
          return;
        }
        if (event.type === "snapshot") {
          initialSnapshotReceived = true;
          return;
        }
        if (event.type === "output") {
          output.push(new TextDecoder().decode(event.data));
        }
      });
      unsubscribeExit = client.on("terminal_stream_exit", (message) => {
        if (message.payload.terminalId === terminalId) {
          terminalExited = true;
        }
      });

      const subscribed = await client.subscribeTerminal(terminalId);
      expect(subscribed.error).toBeNull();
      await waitForCondition(() => initialSnapshotReceived);
      client.sendTerminalInput(terminalId, {
        type: "input",
        data: "relay-input\r",
      });
      await waitForCondition(() => output.join("").includes("relay-output:relay-input"));

      client.sendTerminalInput(terminalId, {
        type: "resize",
        rows: 13,
        cols: 51,
      });
      await waitForCondition(() => {
        const state = daemon.daemon.terminalManager?.getTerminal(terminalId)?.getState();
        return state?.rows === 13 && state.cols === 51;
      });

      const killed = await client.killTerminal(terminalId);
      expect(killed.success).toBe(true);
      await waitForCondition(() => terminalExited, 10_000);
    } catch (err) {
      const tail = lines.slice(-50).join("");
      // Only prints on failure to help diagnose encrypted terminal transport.
      // eslint-disable-next-line no-console
      console.error("daemon logs (tail):\\n", tail);
      throw err;
    } finally {
      unsubscribeOutput?.();
      unsubscribeExit?.();
      await client?.close();
      await daemon.close();
      await stopRelay();
    }
  }, 90000);
});
