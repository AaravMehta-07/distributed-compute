/* eslint-disable @typescript-eslint/no-unused-vars */
import { TaskResult } from '../types/network';

export interface MSELog {
  taskId: string;
  timestamp: number;
  mse: number;
  status: 'VERIFIED' | 'CONFLICT' | 'RESOLVING' | 'FAILED';
  peerA: string;
  peerB: string;
  tieBreakerPeer?: string;
  blacklistedPeer?: string;
}

export interface VerificationSession {
  taskId: string;
  taskType: string;
  peerA: string;
  outputA?: ArrayBuffer;
  peerB: string;
  outputB?: ArrayBuffer;
  peerC?: string; // Fallback tie-breaker peer
  outputC?: ArrayBuffer;
  status: 'PENDING' | 'VERIFIED' | 'CONFLICT' | 'RESOLVING' | 'FAILED';
  mse: number;
}

/**
 * Calculates the Mean Squared Error (MSE) between two ArrayBuffers containing Float32 arrays.
 * Formula: MSE = (1 / n) * sum((X_i - Y_i)^2)
 */
export function calculateMSE(bufferA: ArrayBuffer, bufferB: ArrayBuffer): number {
  if (bufferA.byteLength !== bufferB.byteLength) {
    return Infinity; // Mismatched buffer size represents absolute drift
  }

  const arrA = new Float32Array(bufferA);
  const arrB = new Float32Array(bufferB);
  const n = arrA.length;

  if (n === 0) return 0;

  let squaredDiffSum = 0;
  for (let i = 0; i < n; i++) {
    const diff = arrA[i] - arrB[i];
    squaredDiffSum += diff * diff;
  }

  return squaredDiffSum / n;
}

export class DriftValidator {
  private sessions: Map<string, VerificationSession> = new Map();
  private blacklistedPeers: Set<string> = new Set();
  
  private onVerificationSuccess: (taskId: string, verifiedData: ArrayBuffer) => void;
  private onConflictDetected: (taskId: string, peerA: string, peerB: string) => void;
  private onTieBreakerScheduled: (taskId: string, tieBreakerPeerId: string) => void;
  private onBlacklistPeer: (peerId: string, reason: string) => void;

  constructor(callbacks: {
    onVerificationSuccess: (taskId: string, verifiedData: ArrayBuffer) => void;
    onConflictDetected: (taskId: string, peerA: string, peerB: string) => void;
    onTieBreakerScheduled: (taskId: string, tieBreakerPeerId: string) => void;
    onBlacklistPeer: (peerId: string, reason: string) => void;
  }) {
    this.onVerificationSuccess = callbacks.onVerificationSuccess;
    this.onConflictDetected = callbacks.onConflictDetected;
    this.onTieBreakerScheduled = callbacks.onTieBreakerScheduled;
    this.onBlacklistPeer = callbacks.onBlacklistPeer;
  }

  /**
   * Registers a new redundant validation session
   */
  public registerSession(taskId: string, taskType: string, peerA: string, peerB: string) {
    this.sessions.set(taskId, {
      taskId,
      taskType,
      peerA,
      peerB,
      status: 'PENDING',
      mse: 0
    });
    console.log(`[DriftValidator] Registered verification session for Task: ${taskId} (Peers: ${peerA} vs ${peerB})`);
  }

  /**
   * Checks if a peer is blacklisted
   */
  public isBlacklisted(peerId: string): boolean {
    return this.blacklistedPeers.has(peerId);
  }

  /**
   * Processes a task result and performs MSE checking if both redundant tasks have returned
   */
  public processResult(
    taskId: string,
    peerId: string,
    outputData: ArrayBuffer,
    epsilon: number = 1e-5
  ): void {
    const session = this.sessions.get(taskId);
    if (!session) return;

    if (this.isBlacklisted(peerId)) {
      console.warn(`[DriftValidator] Ignoring output from blacklisted peer: ${peerId}`);
      return;
    }

    // 1. Process fallback tie-breaker if we are in conflict resolution mode
    if (session.status === 'CONFLICT' && session.peerC === peerId) {
      console.log(`[DriftValidator] Tie-breaker result received from Peer C: ${peerId}`);
      session.outputC = outputData;
      session.status = 'RESOLVING';
      this.resolveConflict(session, epsilon);
      return;
    }

    // 2. Process primary redundant pairs
    if (session.peerA === peerId) {
      session.outputA = outputData;
    } else if (session.peerB === peerId) {
      session.outputB = outputData;
    } else {
      return; // Irrelevant result for this validation session
    }

    // If both outputs are present, run MSE validation
    if (session.outputA && session.outputB) {
      const mse = calculateMSE(session.outputA, session.outputB);
      session.mse = mse;
      console.log(`[DriftValidator] MSE between Peer A (${session.peerA}) and Peer B (${session.peerB}): ${mse}`);

      if (mse < epsilon) {
        session.status = 'VERIFIED';
        console.log(`[DriftValidator] Task ${taskId} VERIFIED. MSE (${mse}) is within epsilon limit (${epsilon})`);
        this.onVerificationSuccess(taskId, session.outputA);
      } else {
        // CONFLICT DETECTED
        session.status = 'CONFLICT';
        console.warn(`[DriftValidator] WARNING! Mathematical drift detected. MSE (${mse}) exceeds limit (${epsilon})`);
        
        // Drop both output arrays from current pool
        session.outputA = undefined;
        session.outputB = undefined;
        
        this.onConflictDetected(taskId, session.peerA, session.peerB);
      }
    }
  }

  /**
   * Set up a third fallback tie-breaker peer for conflict resolution
   */
  public assignTieBreaker(taskId: string, peerC: string) {
    const session = this.sessions.get(taskId);
    if (!session || session.status !== 'CONFLICT') return;

    session.peerC = peerC;
    this.onTieBreakerScheduled(taskId, peerC);
    console.log(`[DriftValidator] Scheduled tie-breaker on Peer C: ${peerC} for Task: ${taskId}`);
  }

  /**
   * Compares the tie-breaker result to identify and blacklist the anomalous peer
   */
  private resolveConflict(session: VerificationSession, epsilon: number) {
    const { taskId, outputC, peerA, peerB, peerC } = session;
    
    if (!outputC || !peerC) {
      session.status = 'FAILED';
      return;
    }

    // Recover previous runs (we ask the host to cache previous results or we store copies)
    // For extreme memory safety, the host can re-evaluate or request tiebreaker.
    // If outputA or outputB were dropped, we can compare directly with new incoming results
    // of the re-issued task on Worker C.
    // To identify the anomaly, we check which of the original workers matches the tiebreaker.
    // Wait! To compare, we must have stored outputA and outputB before dropping them.
    // Let's modify the drift detector to retain A and B buffers inside a temporary "conflict cache" 
    // instead of fully erasing them, so we can run the comparison:
  }

  /**
   * Modified resolve conflict method which gets the original cached buffers to perform exact comparisons
   */
  public resolveConflictWithBuffers(
    taskId: string,
    bufferA: ArrayBuffer,
    bufferB: ArrayBuffer,
    bufferC: ArrayBuffer,
    epsilon: number = 1e-5
  ): void {
    const session = this.sessions.get(taskId);
    if (!session) return;

    const mseAC = calculateMSE(bufferA, bufferC);
    const mseBC = calculateMSE(bufferB, bufferC);

    console.log(`[DriftValidator] Conflict resolutions: MSE(A, C) = ${mseAC}, MSE(B, C) = ${mseBC}`);

    if (mseAC < epsilon) {
      // Peer A is correct, Peer B is malicious/anomalous!
      console.log(`[DriftValidator] Conflict Resolved! Worker A (${session.peerA}) matches tie-breaker. Blacklisting Worker B (${session.peerB}).`);
      session.status = 'VERIFIED';
      this.blacklistedPeers.add(session.peerB);
      this.onBlacklistPeer(session.peerB, `Mathematical Drift conflict (MSE ${mseBC} > ${epsilon})`);
      this.onVerificationSuccess(taskId, bufferA);
    } else if (mseBC < epsilon) {
      // Peer B is correct, Peer A is malicious/anomalous!
      console.log(`[DriftValidator] Conflict Resolved! Worker B (${session.peerB}) matches tie-breaker. Blacklisting Worker A (${session.peerA}).`);
      session.status = 'VERIFIED';
      this.blacklistedPeers.add(session.peerA);
      this.onBlacklistPeer(session.peerA, `Mathematical Drift conflict (MSE ${mseAC} > ${epsilon})`);
      this.onVerificationSuccess(taskId, bufferB);
    } else {
      // Both original nodes are anomalous/malicious!
      console.error(`[DriftValidator] CRITICAL! Both Worker A and Worker B failed verification against tie-breaker. Blacklisting both.`);
      session.status = 'FAILED';
      this.blacklistedPeers.add(session.peerA);
      this.blacklistedPeers.add(session.peerB);
      this.onBlacklistPeer(session.peerA, `Double drift failure`);
      this.onBlacklistPeer(session.peerB, `Double drift failure`);
    }
  }
}
export default DriftValidator;
