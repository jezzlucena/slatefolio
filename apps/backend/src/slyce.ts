/**
 * Slyce live-match gateway — a tiny WebSocket relay for the Logo3 pong game.
 *
 * The server simulates NOTHING. One machine — the SIM — is authoritative:
 * it runs the physics and the AI (which must always run on a player's
 * machine) and streams ~60 Hz state snapshots, including its own court
 * dimensions so every other client letterboxes the exact same aspect.
 * This gateway only:
 *   1. manages the single global room's slots,
 *   2. relays sim snapshots to everyone else and the peer's inputs to the sim,
 *   3. detects abandonment via app-level heartbeats and propagates it.
 *
 * Slot model — authority and paddle side are SEPARATE ideas:
 *   - sim: the simulating player, on side simSide ('L' when they started the
 *     match; may become 'R' through promotion).
 *   - peer: the second player, always on the side opposite the sim. Their
 *     machine runs no physics; they stream paddle inputs.
 *   - Everyone else spectates. While a match is live nobody can claim the
 *     sim's side — the only claimable thing is the free peer side. Nobody's
 *     role EVER changes without their explicit request: spectators stay
 *     spectators until they claim, and promotion is offer/accept.
 *   - If the PEER leaves: the sim's local AI takes their paddle back.
 *   - If the SIM leaves and a peer exists: the peer is OFFERED promotion
 *     ('promote-offer'). Only an explicit 'promote-accept' hands them the
 *     physics (keeping their paddle side, the AI covering the vacated one,
 *     which becomes claimable). Decline, disconnect, or letting the offer
 *     expire (PROMOTE_OFFER_MS) ends the match for everyone — as does the
 *     sim leaving with no peer at all.
 *
 * Protocol (JSON text frames, ≤ MAX_MSG_BYTES):
 *   client → server
 *     { type: 'claim' }          request a slot: sim (side L) if the room is
 *                                idle, else the free peer side, else nothing
 *     { type: 'leave' }          give the slot back
 *     { type: 'snapshot', ... }  sim only — relayed verbatim to non-sims
 *     { type: 'input', y }       peer only — relayed to the sim
 *     { type: 'promote-accept' } peer only, while an offer is pending
 *     { type: 'promote-decline' }peer only, while an offer is pending
 *     { type: 'hb' }             heartbeat (any message refreshes lastSeen)
 *   server → client
 *     { type: 'welcome', role, live, guestFree }     on connect
 *     { type: 'role', role, side? }                  slot changes; role 'sim'
 *                                                    to a current peer = accepted promotion
 *     { type: 'room', live, guestFree }              room state changes
 *     { type: 'snapshot', ... } / { type: 'input', y }  relays
 *     { type: 'peer-joined', side } / { type: 'peer-left' }  sim only
 *     { type: 'promote-offer' }                      peer only — consent request
 *     { type: 'ended' }                              match over (nobody simulating)
 *
 * Heartbeats: browsers auto-answer protocol-level pings even from frozen
 * tabs, so liveness is judged on APPLICATION messages only. The sim's
 * snapshot cadence and the peer's input cadence are their heartbeats (both
 * fall back to explicit 'hb'); a player silent for PLAYER_TIMEOUT_MS has
 * abandoned the match. Spectators are never timed out.
 */
import type { Server, IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';

type Role = 'sim' | 'player' | 'spectator';
type Side = 'L' | 'R';

interface Client {
  ws: WebSocket;
  role: Role;
  lastSeen: number;
}

const SWEEP_MS = 2000;
const PLAYER_TIMEOUT_MS = 8000;
const PROMOTE_OFFER_MS = 15000; // how long the peer may ponder the offer
const MAX_MSG_BYTES = 4096;

const opposite = (s: Side): Side => (s === 'L' ? 'R' : 'L');

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export default function attachSlyceGateway(server: Server): void {
  // Same allowlist the REST CORS uses — app.ts crashes without it, so the
  // non-null assertion mirrors the existing contract.
  const whitelist = process.env.HOST_ALLOWLIST!.split(',');

  const wss = new WebSocketServer({ server, path: '/slyce' });
  const clients = new Map<WebSocket, Client>();
  let sim: Client | null = null;
  let simSide: Side = 'L';
  let peer: Client | null = null; // always on opposite(simSide)
  let offerUntil: number | null = null; // a promotion offer awaits the peer

  const send = (c: Client, msg: object): void => {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(msg));
  };
  const broadcast = (msg: object, except?: Client): void => {
    const data = JSON.stringify(msg);
    for (const c of clients.values()) {
      if (c !== except && c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
    }
  };
  const roomState = () => ({
    // A pending promotion offer keeps the room "live" so spectators hold
    // their (frozen) view instead of flickering back to attract.
    live: sim !== null || offerUntil !== null,
    guestFree: sim !== null && peer === null,
  });
  const broadcastRoom = (): void => broadcast({ type: 'room', ...roomState() });

  /** Peer slot released mid-match: the sim's local AI takes that paddle back. */
  const dropPeer = (): void => {
    if (!peer) return;
    peer.role = 'spectator';
    send(peer, { type: 'role', role: 'spectator' });
    peer = null;
    if (sim) send(sim, { type: 'peer-left' });
    broadcastRoom();
  };

  /** The match is over for everyone: nobody is simulating and nobody
   * (consentingly) will. */
  const endMatch = (): void => {
    if (peer) {
      peer.role = 'spectator';
      send(peer, { type: 'role', role: 'spectator' });
      peer = null;
    }
    offerUntil = null;
    sim = null;
    simSide = 'L';
    broadcast({ type: 'ended' });
    broadcastRoom();
  };

  /** Sim gone. With a peer: OFFER them the promotion — their machine only
   * takes over the physics if they explicitly accept (see 'promote-accept'
   * below); decline/expiry/disconnect ends the match. Without a peer the
   * match just ends. */
  const dropSim = (): void => {
    if (!sim) return;
    sim.role = 'spectator';
    send(sim, { type: 'role', role: 'spectator' });
    sim = null;
    if (peer) {
      offerUntil = Date.now() + PROMOTE_OFFER_MS;
      send(peer, { type: 'promote-offer' });
      broadcastRoom();
    } else {
      endMatch();
    }
  };

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (origin && !whitelist.includes(origin)) {
      ws.close(4403, 'origin not allowed');
      return;
    }

    const client: Client = { ws, role: 'spectator', lastSeen: Date.now() };
    clients.set(ws, client);
    send(client, { type: 'welcome', role: client.role, ...roomState() });

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const text = data.toString();
      if (text.length > MAX_MSG_BYTES) return;
      let msg: unknown;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (!isRecord(msg) || typeof msg.type !== 'string') return;
      client.lastSeen = Date.now();

      switch (msg.type) {
        case 'claim': {
          if (client === sim || client === peer) break;
          if (!sim && offerUntil === null) {
            sim = client;
            simSide = 'L'; // a fresh match always starts the sim on the left
            client.role = 'sim';
            send(client, { type: 'role', role: 'sim', side: simSide });
          } else if (sim && !peer) {
            peer = client;
            client.role = 'player';
            const side = opposite(simSide);
            send(client, { type: 'role', role: 'player', side });
            send(sim, { type: 'peer-joined', side });
          } else {
            send(client, { type: 'role', role: 'spectator' });
            break; // room unchanged — no broadcast needed
          }
          broadcastRoom();
          break;
        }
        case 'leave': {
          if (client === sim) dropSim();
          else if (client === peer) {
            if (offerUntil !== null) endMatch(); // walked out on the offer
            else dropPeer();
          }
          break;
        }
        case 'promote-accept': {
          if (client === peer && offerUntil !== null) {
            offerUntil = null;
            sim = client;
            peer = null;
            simSide = opposite(simSide); // they keep their own paddle side
            sim.role = 'sim';
            send(sim, { type: 'role', role: 'sim', side: simSide });
            broadcastRoom();
          }
          break;
        }
        case 'promote-decline': {
          if (client === peer && offerUntil !== null) endMatch();
          break;
        }
        case 'snapshot': {
          // Relayed verbatim (sim-authoritative); never parsed here.
          if (client === sim) broadcast(msg, client);
          break;
        }
        case 'input': {
          if (client === peer && sim && typeof msg.y === 'number') {
            send(sim, { type: 'input', y: msg.y });
          }
          break;
        }
        case 'hb':
          break; // lastSeen already refreshed above
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      if (client === sim) dropSim();
      else if (client === peer) {
        if (offerUntil !== null) endMatch();
        else dropPeer();
      }
    });
    ws.on('error', () => ws.terminate());
  });

  // Abandonment sweep — see the heartbeat note in the header.
  const sweep = setInterval(() => {
    const now = Date.now();
    if (sim && now - sim.lastSeen > PLAYER_TIMEOUT_MS) dropSim();
    if (peer && offerUntil === null && now - peer.lastSeen > PLAYER_TIMEOUT_MS) dropPeer();
    if (offerUntil !== null && now > offerUntil) endMatch(); // offer expired unanswered
  }, SWEEP_MS);
  sweep.unref(); // never keep the process alive just for the sweep

  wss.on('close', () => clearInterval(sweep));
}
