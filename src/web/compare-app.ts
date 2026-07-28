import type { RawTraceRecord } from "../adapters/codex/raw-codex-message.js";
import type {
  AlignedEventPair,
  InterventionManifest,
  TraceDiff,
} from "../core/trace-comparison.js";
import type { TraceEvent } from "../core/trace-event.js";

interface TraceManifest {
  traceId: string;
  status: string;
  containsSensitiveData: boolean;
}

interface ComparisonTracePayload {
  manifest: TraceManifest;
  events: TraceEvent[];
  rawRecords: RawTraceRecord[];
}

interface ComparisonPayload {
  comparisonId: string;
  intervention: InterventionManifest;
  diff: TraceDiff;
  left: ComparisonTracePayload;
  right: ComparisonTracePayload;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (element === null) {
    throw new Error(`Missing element #${id}`);
  }

  return element as T;
}

function setText(id: string, value: string): void {
  requireElement(id).textContent = value;
}

function eventStatus(event: TraceEvent): string {
  return event.status ?? (event.kind === "unknown" ? "unmapped" : "observed");
}

function eventById(
  trace: ComparisonTracePayload,
  eventId: string | undefined,
): TraceEvent | undefined {
  return trace.events.find((event) => event.eventId === eventId);
}

function rawFor(
  trace: ComparisonTracePayload,
  event: TraceEvent | undefined,
): RawTraceRecord | undefined {
  return event === undefined
    ? undefined
    : trace.rawRecords.find(
        (record) => record.sequence === event.rawRef.sequence,
      );
}

function createEventCard(
  side: "left" | "right",
  event: TraceEvent | undefined,
  pair: AlignedEventPair,
  onSelect: () => void,
): HTMLElement {
  if (event === undefined) {
    const missing = document.createElement("div");
    missing.className = "comparison-event comparison-event-missing";
    missing.textContent =
      side === "left" ? "No baseline event" : "No variant event";
    return missing;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "comparison-event";
  button.setAttribute(
    "aria-label",
    `Inspect aligned row ${pair.alignmentIndex + 1}, ${side} event ${event.sequence}`,
  );

  const metadata = document.createElement("span");
  metadata.className = "comparison-event-meta";
  const sequence = document.createElement("strong");
  sequence.textContent = String(event.sequence).padStart(2, "0");
  const kind = document.createElement("span");
  kind.textContent = event.kind;
  const status = document.createElement("span");
  status.className = `comparison-event-status status-${eventStatus(event)}`;
  status.textContent = eventStatus(event);
  metadata.append(sequence, kind, status);

  const title = document.createElement("span");
  title.className = "comparison-event-title";
  title.textContent = event.title.replace(
    "Unsupported event:",
    "Unmapped event:",
  );

  button.append(metadata, title);
  button.addEventListener("click", onSelect);
  return button;
}

function createReasonList(pair: AlignedEventPair): HTMLElement {
  const container = document.createElement("div");
  container.className = "alignment-reasons";

  if (pair.reasons.length === 0) {
    container.textContent = "Matched under policy";
    return container;
  }

  for (const reason of pair.reasons) {
    const code = document.createElement("span");
    code.textContent = reason.code.replaceAll("_", " ");
    container.append(code);
  }

  return container;
}

function createEvidenceSide(
  label: string,
  trace: ComparisonTracePayload,
  event: TraceEvent | undefined,
): HTMLElement {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement("div");
  heading.className = "evidence-side-heading";
  const sideLabel = document.createElement("span");
  sideLabel.textContent = label;
  const title = document.createElement("strong");
  title.textContent =
    event === undefined
      ? "No event on this side"
      : `Event ${event.sequence}: ${event.title}`;
  heading.append(sideLabel, title);
  fragment.append(heading);

  if (event === undefined) {
    const missing = document.createElement("p");
    missing.className = "evidence-side-missing";
    missing.textContent =
      "The alignment contains an insertion or deletion at this position.";
    fragment.append(missing);
    const wrapper = document.createElement("div");
    wrapper.append(fragment);
    return wrapper;
  }

  const raw = rawFor(trace, event);
  const reference = document.createElement("p");
  reference.className = "evidence-side-reference";
  reference.textContent = `${event.kind} · ${event.status ?? "no status"} · ${event.rawRef.file} · sequence ${event.rawRef.sequence}`;

  const normalizedDetails = document.createElement("details");
  const normalizedSummary = document.createElement("summary");
  normalizedSummary.textContent = "Normalized event";
  const normalized = document.createElement("pre");
  normalized.textContent = JSON.stringify(event, null, 2);
  normalizedDetails.append(normalizedSummary, normalized);

  const rawDetails = document.createElement("details");
  rawDetails.open = true;
  const rawSummary = document.createElement("summary");
  rawSummary.textContent = "Raw runtime message";
  const rawContent = document.createElement("pre");
  rawContent.textContent =
    raw === undefined
      ? "Raw record not found."
      : JSON.stringify(raw.payload, null, 2);
  rawDetails.append(rawSummary, rawContent);

  fragment.append(reference, rawDetails, normalizedDetails);
  const wrapper = document.createElement("div");
  wrapper.append(fragment);
  return wrapper;
}

function renderPairEvidence(
  payload: ComparisonPayload,
  pair: AlignedEventPair,
): void {
  document
    .querySelectorAll(".alignment-row.selected")
    .forEach((row) => row.classList.remove("selected"));
  document
    .querySelector(`[data-alignment-index="${pair.alignmentIndex}"]`)
    ?.classList.add("selected");

  const leftEvent = eventById(payload.left, pair.leftEventId);
  const rightEvent = eventById(payload.right, pair.rightEventId);
  const reasonText =
    pair.reasons.length === 0
      ? "These events match under the selected comparison policy."
      : pair.reasons.map((reason) => reason.description).join(" ");
  const ambiguityBoundary =
    payload.diff.alignment.status === "ambiguous"
      ? " This row belongs to one deterministic preview of multiple equally optimal alignments."
      : "";

  setText(
    "pairEvidenceTitle",
    `Alignment ${pair.alignmentIndex + 1} · ${pair.relation}`,
  );
  setText("pairEvidenceReason", `${reasonText}${ambiguityBoundary}`);
  requireElement("leftEvidence").replaceChildren(
    createEvidenceSide("BASELINE", payload.left, leftEvent),
  );
  requireElement("rightEvidence").replaceChildren(
    createEvidenceSide("VARIANT", payload.right, rightEvent),
  );
}

function renderAlignment(payload: ComparisonPayload): void {
  const list = requireElement("alignmentList");
  const divergenceIndex =
    payload.diff.firstObservableDivergence?.alignmentIndex;
  const isAmbiguous = payload.diff.alignment.status === "ambiguous";
  list.replaceChildren();

  for (const pair of payload.diff.alignedPairs) {
    const row = document.createElement("article");
    row.className = `alignment-row relation-${pair.relation}`;
    row.dataset.alignmentIndex = String(pair.alignmentIndex);

    if (isAmbiguous) {
      row.classList.add("ambiguous-preview");
    }

    if (pair.alignmentIndex === divergenceIndex) {
      row.classList.add("first-divergence");
    }

    const selectPair = () => renderPairEvidence(payload, pair);
    const leftEvent = eventById(payload.left, pair.leftEventId);
    const rightEvent = eventById(payload.right, pair.rightEventId);
    const center = document.createElement("div");
    center.className = "relation-rail";
    const line = document.createElement("span");
    line.className = "relation-line";
    const badge = document.createElement("strong");
    badge.textContent =
      pair.alignmentIndex === divergenceIndex
        ? "FIRST Δ"
        : pair.relation.toUpperCase();
    center.append(line, badge, createReasonList(pair));

    row.append(
      createEventCard("left", leftEvent, pair, selectPair),
      center,
      createEventCard("right", rightEvent, pair, selectPair),
    );
    list.append(row);
  }

  const initialPair =
    payload.diff.alignedPairs.find(
      (pair) => pair.alignmentIndex === divergenceIndex,
    ) ??
    (isAmbiguous
      ? payload.diff.alignedPairs.find((pair) => pair.relation !== "same")
      : undefined) ??
    payload.diff.alignedPairs[0];

  if (initialPair !== undefined) {
    renderPairEvidence(payload, initialPair);
  }
}

function renderOverview(payload: ComparisonPayload): void {
  const diff = payload.diff;
  const divergence = diff.firstObservableDivergence;
  setText("comparisonId", payload.comparisonId);
  setText(
    "policyVersion",
    `${diff.policy.policyId} · ${diff.policy.version}`,
  );
  setText("alignedCount", String(diff.alignedPairs.length));
  setText("sameCount", String(diff.summary.same));
  setText("changedCount", String(diff.summary.changed));
  setText(
    "oneSidedCount",
    String(diff.summary.inserted + diff.summary.deleted),
  );
  setText("alignmentStatus", diff.alignment.status);
  setText(
    "alignmentMode",
    diff.alignment.status === "ambiguous"
      ? "Deterministic preview · divergence withheld"
      : "Unique minimum-cost alignment",
  );
  setText(
    "optimalPathAssessment",
    `${diff.alignment.optimalCost} total cost · ${
      diff.alignment.optimalPathCount === "multiple"
        ? "2+ minimum-cost paths"
        : "1 minimum-cost path"
    } · ${diff.alignment.selectedPath.replaceAll("_", " ")}`,
  );
  setText("comparisonClaimBoundary", diff.alignment.claimBoundary);
  setText("taskStatement", payload.intervention.taskStatement);
  setText("changedVariable", payload.intervention.changedVariable);
  setText("leftCondition", payload.intervention.leftCondition);
  setText("rightCondition", payload.intervention.rightCondition);
  setText("interventionBoundary", payload.intervention.evidenceBoundary);
  setText("leftTraceId", diff.leftTraceId);
  setText("rightTraceId", diff.rightTraceId);
  setText("comparedFields", diff.policy.comparedFields.join(" · "));
  setText("ignoredFields", diff.policy.ignoredFields.join(" · "));
  setText(
    "algorithmName",
    `${diff.policy.algorithm.name} · ${diff.policy.algorithm.version} · ${diff.policy.algorithm.ambiguityDetection.replaceAll("_", " ")}`,
  );

  if (diff.alignment.status === "ambiguous") {
    requireElement("divergenceCallout").classList.add(
      "divergence-callout-ambiguous",
    );
    setText("divergenceTitle", "First divergence withheld");
    setText("divergenceReason", diff.alignment.claimBoundary);
    requireElement<HTMLButtonElement>("jumpToDivergence").disabled = true;
  } else if (divergence === undefined) {
    setText("divergenceTitle", "No material difference under this policy");
    setText(
      "divergenceReason",
      "All aligned events matched the configured material fields.",
    );
    requireElement<HTMLButtonElement>("jumpToDivergence").disabled = true;
  } else {
    setText(
      "divergenceTitle",
      `Alignment ${divergence.alignmentIndex + 1} · ${divergence.relation}`,
    );
    setText(
      "divergenceReason",
      `${divergence.reasons.map((reason) => reason.description).join(" ")} ${divergence.claimBoundary}`,
    );
    requireElement("jumpToDivergence").addEventListener("click", () => {
      document
        .querySelector(
          `[data-alignment-index="${divergence.alignmentIndex}"]`,
        )
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
}

async function main(): Promise<void> {
  const response = await fetch("/api/comparison", {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Comparison API returned ${response.status}`);
  }

  const payload = (await response.json()) as ComparisonPayload;
  renderOverview(payload);
  renderAlignment(payload);
  requireElement("comparisonLoading").hidden = true;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  setText("comparisonLoading", `Unable to load comparison: ${message}`);
  requireElement("comparisonLoading").classList.add("loading-error");
});
