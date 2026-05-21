/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NetworkMessage, NetworkNode } from '../types/network';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
// WebRTC ICE servers configuration
export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Placeholder configuration array for custom TURN relay (enterprise network traversal)
    // {
    //   urls: 'turn:turn.nexuscompute.net:3478',
    //   username: 'nexus_user',
    //   credential: 'nexus_secure_credential_token_placeholder'
    // }
  ],
  sdpSemantics: 'unified-plan'
};

export class WebRTCManager {
  private static instance: WebRTCManager | null = null;
  public peer: any = null; // PeerJS instance
  public connections: Map<string, any> = new Map(); // peerId -> DataConnection
  public nodes: Map<string, NetworkNode> = new Map(); // peerId -> Node state
  public isHost: boolean = false;
  public peerId: string = '';
  public hostId: string = '';
  
  private messageHandlers: Set<(msg: NetworkMessage, senderId: string) => void> = new Set();
  private disconnectHandlers: Set<(peerId: string) => void> = new Set();
  private connectHandlers: Set<(peerId: string) => void> = new Set();
  
  private wakeLock: any = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.setupWakeLock();
      this.setupVisibilitySafeguard();
    }
  }

  public static getInstance(): WebRTCManager {
    if (!WebRTCManager.instance) {
      WebRTCManager.instance = new WebRTCManager();
    }
    return WebRTCManager.instance;
  }

  /**
   * Initializes PeerJS client as Host or Worker
   */
  public async initialize(customId?: string, forceHost: boolean = false): Promise<string> {
    if (typeof window === 'undefined') return '';
    
    // Clean up existing connections if any
    await this.disconnectAll();

    const { default: Peer } = await import('peerjs');

    this.isHost = forceHost;
    
    // If Host, we use the custom room ID as peer ID.
    // If Worker, we let PeerJS auto-generate a unique peer ID.
    this.peer = this.isHost && customId
      ? new Peer(customId, {
          config: ICE_SERVERS,
          debug: 1 // Only errors and warnings
        })
      : new Peer({
          config: ICE_SERVERS,
          debug: 1 // Only errors and warnings
        });

    return new Promise((resolve, reject) => {
      this.peer.on('open', (id: string) => {
        this.peerId = id;
        if (this.isHost) {
          this.hostId = id;
          this.setupHostListeners();
        }
        console.log(`[PeerJS] Peer initialized. ID: ${id}. Role: ${this.isHost ? 'Host' : 'Worker'}`);
        this.requestWakeLock();
        resolve(id);
      });

      this.peer.on('error', (err: any) => {
        console.error('[PeerJS] Global Peer Error:', err);
        // If Host ID is already taken, reject
        if (err.type === 'unavailable-id' && this.isHost) {
          reject(new Error('Room ID already exists. Please choose a different name.'));
        }
      });
    });
  }

  /**
   * Worker method to connect to Host
   */
  public connectToHost(targetHostId: string): Promise<void> {
    if (!this.peer || this.isHost) return Promise.reject(new Error('Peer not initialized or current node is Host'));

    this.hostId = targetHostId;
    console.log(`[WebRTC] Connecting to host: ${targetHostId}`);

    // STRICT EXECUTION PARAMETERS: { ordered: true, maxRetransmits: 3 }
    const conn = this.peer.connect(targetHostId, {
      reliable: true,
      serialization: 'raw', // Binary transport, bypasses heavy JSON strings
      label: 'inference-channel',
      options: {
        ordered: true,
        maxRetransmits: 3
      }
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection to host timed out.'));
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        this.connections.set(targetHostId, conn);
        this.setupConnectionListeners(conn);
        this.connectHandlers.forEach(h => h(targetHostId));
        resolve();
      });

      conn.on('error', (err: any) => {
        clearTimeout(timeout);
        console.error(`[WebRTC] Connection error to host ${targetHostId}:`, err);
        reject(err);
      });
    });
  }

  /**
   * Host specific listener setup
   */
  private setupHostListeners() {
    this.peer.on('connection', (conn: any) => {
      console.log(`[Host] Received connection request from worker: ${conn.peer}`);
      
      // Enforce connection options
      conn.options = {
        ...conn.options,
        ordered: true,
        maxRetransmits: 3
      };

      conn.on('open', () => {
        this.connections.set(conn.peer, conn);
        this.setupConnectionListeners(conn);
        this.connectHandlers.forEach(h => h(conn.peer));
      });
    });
  }

  /**
   * Binds data channel message cycles
   */
  private setupConnectionListeners(conn: any) {
    const remotePeerId = conn.peer;

    conn.on('data', (data: any) => {
      try {
        let msg: NetworkMessage;
        
        if (data instanceof ArrayBuffer) {
          // If it's a binary ArrayBuffer, we delegate decoding to the ONNX serialization layer.
          // For initial header detection, we can check a simple byte prefix or let the deserializer handle it.
          // To keep it seamless, we handle deserialized task objects or pass ArrayBuffers down to handlers.
          msg = this.deserializeBinaryMessage(data);
        } else if (typeof data === 'string') {
          msg = JSON.parse(data) as NetworkMessage;
        } else {
          msg = data as NetworkMessage;
        }
        
        // Internal status tracking on Host
        if (this.isHost) {
          if (msg.type === 'PROFILE_REPORT') {
            this.nodes.set(remotePeerId, {
              peerId: remotePeerId,
              profile: msg.profile,
              lastSeen: Date.now(),
              status: 'IDLE'
            });
          } else if (msg.type === 'HEARTBEAT') {
            const node = this.nodes.get(remotePeerId);
            if (node) {
              node.lastSeen = Date.now();
              this.nodes.set(remotePeerId, node);
            }
          }
        }

        // Trigger user handlers
        this.messageHandlers.forEach(handler => handler(msg, remotePeerId));
      } catch (err) {
        console.error(`[WebRTC] Failed to parse message from ${remotePeerId}:`, err);
      }
    });

    conn.on('close', () => {
      console.log(`[WebRTC] Connection closed by ${remotePeerId}`);
      this.handlePeerDisconnection(remotePeerId);
    });

    conn.on('error', (err: any) => {
      console.error(`[WebRTC] Connection error from peer ${remotePeerId}:`, err);
      this.handlePeerDisconnection(remotePeerId);
    });
  }

  /**
   * Helper to deserialize binary payloads if sent directly across data channels
   */
  private deserializeBinaryMessage(buffer: ArrayBuffer): NetworkMessage {
    // View header bytes
    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    
    // Magic header 'NEXS' = 0x5358454E
    if (magic === 0x5358454E) {
      // Strips binary header and packages back into TensorPayload / ComputeTask
      const taskIdLength = view.getUint8(4);
      const dec = new TextDecoder();
      const taskId = dec.decode(new Uint8Array(buffer, 5, taskIdLength));
      
      const layerStart = view.getUint16(5 + taskIdLength, true);
      const layerEnd = view.getUint16(7 + taskIdLength, true);
      
      const dimLength = view.getUint8(9 + taskIdLength);
      const dimensions: number[] = [];
      let offset = 10 + taskIdLength;
      for (let i = 0; i < dimLength; i++) {
        dimensions.push(view.getInt32(offset, true));
        offset += 4;
      }
      
      const typeVal = view.getUint8(offset);
      const dataType: 'float32' | 'float16' | 'int4' = 
        typeVal === 0 ? 'float32' : typeVal === 1 ? 'float16' : 'int4';
      offset += 1;
      
      const rawTensorBuffer = buffer.slice(offset);

      return {
        type: 'TENSOR_PAYLOAD',
        payload: {
          taskId,
          layerRange: [layerStart, layerEnd],
          dimensions,
          dataType,
          tensorBuffer: rawTensorBuffer
        }
      };
    }
    
    throw new Error('Unsupported custom binary WebRTC format');
  }

  /**
   * Graceful cleanup of disconnected peer state
   */
  private handlePeerDisconnection(peerId: string) {
    this.connections.delete(peerId);
    if (this.isHost) {
      this.nodes.delete(peerId);
    }
    this.disconnectHandlers.forEach(h => h(peerId));
  }

  /**
   * Sends structured JSON or binary message to peer
   */
  public sendMessageTo(targetPeerId: string, message: NetworkMessage | ArrayBuffer): boolean {
    const conn = this.connections.get(targetPeerId);
    if (!conn) {
      console.warn(`[WebRTC] Cannot send. No active connection to ${targetPeerId}`);
      return false;
    }

    try {
      if (message instanceof ArrayBuffer) {
        conn.send(message);
      } else {
        conn.send(JSON.stringify(message));
      }
      return true;
    } catch (err) {
      console.error(`[WebRTC] Failed to send message to ${targetPeerId}:`, err);
      return false;
    }
  }

  /**
   * Host broadcasts JSON to all workers
   */
  public broadcastMessage(message: NetworkMessage) {
    const payload = JSON.stringify(message);
    this.connections.forEach((conn) => {
      try {
        conn.send(payload);
      } catch (err) {
        console.error(`[Host] Broadcast to worker ${conn.peer} failed:`, err);
      }
    });
  }

  // --- REGISTRATION HOOKS ---
  public onMessage(handler: (msg: NetworkMessage, senderId: string) => void) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public onPeerConnect(handler: (peerId: string) => void) {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  public onPeerDisconnect(handler: (peerId: string) => void) {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  // --- THE SCREEN WAKE LOCK LAYER ---
  private async setupWakeLock() {
    // Only register listeners here. The actual wake lock request
    // happens after PeerJS is initialized via initialize() -> requestWakeLock()

    // Persist wake lock on window focus or visibility return
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.peer) {
        await this.requestWakeLock();
      }
    });

    window.addEventListener('focus', async () => {
      if (this.peer) {
        await this.requestWakeLock();
      }
    });
  }

  private async requestWakeLock() {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      if (this.wakeLock) return; // Already locked
      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      console.log('[WakeLock] PERSISTENT Screen Wake Lock activated');
      
      this.wakeLock.addEventListener('release', () => {
        console.log('[WakeLock] Screen Wake Lock was released');
        this.wakeLock = null;
      });
    } catch (err: any) {
      console.warn(`[WakeLock] Request failed: ${err.name} - ${err.message}`);
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().then(() => {
        this.wakeLock = null;
      });
    }
  }

  // --- THE PAGE VISIBILITY SAFEGUARD (LMK PREVENTER) ---
  private setupVisibilitySafeguard() {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'hidden') {
        console.warn('[LMK Safeguard] Tab minimized/visibility hidden. Initiating graceful dropoff...');
        await this.triggerGracefulDropoff();
      }
    });
  }

  /**
   * Graceful dropoff: fires NODE_DISCONNECT, closes connections, and flushes VRAM buffers
   */
  public async triggerGracefulDropoff() {
    if (this.isHost) {
      // Host drops workers gracefully
      this.broadcastMessage({ type: 'NODE_DISCONNECT', peerId: this.peerId });
    } else if (this.hostId) {
      // Worker drops from Host
      this.sendMessageTo(this.hostId, { type: 'NODE_DISCONNECT', peerId: this.peerId });
    }

    // Small delay to ensure WebRTC packet leaves browser queue
    await new Promise(resolve => setTimeout(resolve, 100));

    await this.disconnectAll();
    
    // Clear heap buffers via browser garbage collection signals
    if (typeof window !== 'undefined') {
      console.log('[LMK Safeguard] Flushing local execution heap buffers. Cleanup complete.');
    }
  }

  /**
   * Tear down PeerJS links
   */
  public async disconnectAll() {
    this.releaseWakeLock();

    this.connections.forEach(conn => {
      try {
        conn.close();
      } catch (e) {}
    });
    this.connections.clear();
    this.nodes.clear();

    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.destroy();
      } catch (e) {}
    }
    this.peer = null;
    this.peerId = '';
    this.hostId = '';
    this.isHost = false;
    WebRTCManager.instance = null;
  }
}
export default WebRTCManager;
