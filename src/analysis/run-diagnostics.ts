import type {
  DiagnosticFinding,
  DiagnosticRuleId,
  DiagnosticSeverity,
} from "../core/diagnostic-finding.js";
import type { EvidenceLevel } from "../core/trace-event.js";
import type { TraceSpan } from "../core/trace-span.js";

interface FindingDescriptor {
  ruleId: DiagnosticRuleId;
  severity: DiagnosticSeverity;
  evidenceLevel: EvidenceLevel;
  title: string;
  description: string;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function findingFor(span: TraceSpan): FindingDescriptor | undefined {
  const operation = capitalize(span.kind);

  if (span.status === "failed") {
    return {
      ruleId: "failed_operation",
      severity: "error",
      evidenceLevel: "observed",
      title: `${operation} failed`,
      description: `The runtime reported this ${span.kind} operation with failed status.`,
    };
  }

  if (span.status === "interrupted") {
    return {
      ruleId: "interrupted_operation",
      severity: "warning",
      evidenceLevel: "observed",
      title: `${operation} interrupted`,
      description: `The runtime reported this ${span.kind} operation with interrupted status.`,
    };
  }

  if (span.status === "incomplete") {
    return {
      ruleId: "incomplete_operation",
      severity: "warning",
      evidenceLevel: "inferred",
      title: `${operation} has no observed completion`,
      description:
        "No matching completion event was observed before the trace ended. This does not by itself prove that the operation crashed or became stuck.",
    };
  }

  return undefined;
}

export function runDiagnostics(spans: TraceSpan[]): DiagnosticFinding[] {
  return spans.flatMap((span) => {
    const descriptor = findingFor(span);

    if (descriptor === undefined) {
      return [];
    }

    return [
      {
        schemaVersion: "0.1",
        findingId: `${span.traceId}:finding:${descriptor.ruleId}:${span.spanId}`,
        traceId: span.traceId,
        ruleId: descriptor.ruleId,
        severity: descriptor.severity,
        title: descriptor.title,
        description: descriptor.description,
        evidenceLevel: descriptor.evidenceLevel,
        evidenceEventIds: [...span.sourceEventIds],
        evidenceSpanIds: [span.spanId],
        createdBy: {
          type: "deterministic_rule",
          version: "0.1.0",
        },
      } satisfies DiagnosticFinding,
    ];
  });
}
