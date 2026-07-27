export type EvidenceLevel =
  | "observed"
  | "model_reported"
  | "inferred";

export interface TraceEvent {
  eventId: string;
  sequence: number;
  title: string;
  evidenceLevel: EvidenceLevel;
}