export interface EvidenceRecord {
  id: string;
  actId: 'act1';
  pointId: string;
  reading: string;
  zone: string;
  position: { x: number; y: number; z: number };
  width: number;
  height: number;
  capturedAt: number;
  dataUrl: string;
}

export interface CaptureEvidenceResult {
  record: EvidenceRecord | null;
  /** 取景失败时给玩家的具体原因。 */
  error?: string;
}

export const EVIDENCE_LIMIT = 20;

export function createEvidenceRecord(params: {
  actId: 'act1';
  pointId: string;
  reading: string;
  zone: string;
  position: { x: number; y: number; z: number };
  width: number;
  height: number;
  dataUrl: string;
  now?: number;
}): EvidenceRecord {
  const capturedAt = params.now ?? Date.now();
  return {
    id: `ev-${params.pointId}-${capturedAt.toString(36)}`,
    actId: params.actId,
    pointId: params.pointId,
    reading: params.reading,
    zone: params.zone,
    position: params.position,
    width: params.width,
    height: params.height,
    capturedAt,
    dataUrl: params.dataUrl,
  };
}

export function trimEvidence(list: EvidenceRecord[]): EvidenceRecord[] {
  return list.slice(-EVIDENCE_LIMIT);
}

export function findEvidence(
  list: EvidenceRecord[],
  id: string | undefined
): EvidenceRecord | null {
  if (!id) return null;
  return list.find((e) => e.id === id) ?? null;
}

/** Human-readable stamp used in the review thumbnails. */
export function formatEvidenceTime(record: EvidenceRecord): string {
  const d = new Date(record.capturedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
