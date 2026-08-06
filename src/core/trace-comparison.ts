import type { EvidenceLevel } from "./trace-event.js";

export type ComparisonSide = "left" | "right";

export type AlignmentRelation =
  | "same"
  | "changed"
  | "inserted"
  | "deleted";

export interface ComparisonPolicy {
  schemaVersion: "0.2";
  policyId: "v2-default";
  version: "0.2.0";
  algorithm: {
    name: "dynamic_programming_sequence_alignment";
    version: "0.2.0";
    insertionCost: 2;
    deletionCost: 2;
    sameKindChangeCost: 1;
    differentKindSubstitutionCost: 5;
    ambiguityDetection: "count_minimum_cost_paths";
    optimalPathCountLimit: 2;
  };
  comparedFields: Array<
    | "kind"
    | "command"
    | "status"
    | "output"
    | "plan"
    | "source_event_type"
    | "file_targets"
  >;
  ignoredFields: Array<
    "event_id" | "entity_id" | "absolute_time" | "raw_file" | "raw_sequence"
  >;
  normalization: {
    collapseWhitespace: true;
    workspacePlaceholder: "<WORKSPACE>";
    leftWorkspaceRoot?: string;
    rightWorkspaceRoot?: string;
  };
}

export interface DifferenceReason {
  code:
    | "event_kind_changed"
    | "command_changed"
    | "status_changed"
    | "output_changed"
    | "plan_changed"
    | "source_event_type_changed"
    | "file_targets_changed"
    | "left_event_only"
    | "right_event_only";
  description: string;
}

export interface AlignedEventPair {
  alignmentIndex: number;
  leftEventId?: string;
  rightEventId?: string;
  relation: AlignmentRelation;
  reasons: DifferenceReason[];
}

export interface FirstObservableDivergence {
  alignmentIndex: number;
  leftEventId?: string;
  rightEventId?: string;
  relation: Exclude<AlignmentRelation, "same">;
  reasons: DifferenceReason[];
  evidenceLevel: Extract<EvidenceLevel, "inferred">;
  claimBoundary: string;
}

export interface AlignmentAssessment {
  status: "resolved" | "ambiguous";
  optimalCost: number;
  optimalPathCount: 1 | "multiple";
  pathCountLimit: 2;
  selectedPath: "unique_optimum" | "deterministic_preview";
  evidenceLevel: Extract<EvidenceLevel, "inferred">;
  claimBoundary: string;
}

export interface TraceDiff {
  schemaVersion: "0.2";
  diffId: string;
  leftTraceId: string;
  rightTraceId: string;
  policy: ComparisonPolicy;
  alignment: AlignmentAssessment;
  alignedPairs: AlignedEventPair[];
  firstObservableDivergence?: FirstObservableDivergence;
  summary: {
    same: number;
    changed: number;
    inserted: number;
    deleted: number;
  };
}

export interface InterventionManifest {
  interventionId: string;
  baseTaskId: string;
  taskStatement: string;
  changedVariable: string;
  leftCondition: string;
  rightCondition: string;
  heldConstant: string[];
  knownUncontrolledFactors: string[];
  evidenceBoundary: string;
}
