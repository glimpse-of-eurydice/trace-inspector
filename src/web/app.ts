import type { TraceEvent, TraceEventKind } from "../core/trace-event.js";
import type { RawTraceRecord } from "../adapters/codex/raw-codex-message.js";
import type { DiagnosticFinding } from "../core/diagnostic-finding.js";
import type { TraceSpan } from "../core/trace-span.js";

interface TraceManifest {
  traceId: string;
  source: string;
  status: string;
  startedAt: string;
  endedAt: string;
  eventCount: number;
  codexVersion: string;
}

interface TracePayload {
  manifest: TraceManifest;
  events: TraceEvent[];
  spans: TraceSpan[];
  findings: DiagnosticFinding[];
  rawRecords: RawTraceRecord[];
}

type LaneId =
  | "lifecycle"
  | "messages"
  | "plan"
  | "commands"
  | "files"
  | "system";

const laneDefinitions: Array<{
  id: LaneId;
  label: string;
  description: string;
}> = [
  { id: "lifecycle", label: "Lifecycle", description: "RPC · thread · turn" },
  { id: "messages", label: "Messages", description: "user · agent output" },
  { id: "plan", label: "Plan", description: "planning updates" },
  { id: "commands", label: "Commands", description: "tool execution" },
  { id: "files", label: "Files", description: "changes · diffs" },
  { id: "system", label: "System", description: "usage · unmapped" },
];

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (element === null) {
    throw new Error(`Missing element #${id}`);
  }

  return element as T;
}

function laneFor(kind: TraceEventKind): LaneId {
  if (
    kind.startsWith("rpc.") ||
    kind.startsWith("thread.") ||
    kind.startsWith("turn.")
  ) {
    return "lifecycle";
  }

  if (kind.startsWith("message.")) {
    return "messages";
  }

  if (kind.startsWith("plan.")) {
    return "plan";
  }

  if (kind.startsWith("command.")) {
    return "commands";
  }

  if (kind.startsWith("file.")) {
    return "files";
  }

  return "system";
}

function formatClock(isoTime: string): string {
  const date = new Date(isoTime);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  });
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) {
    return `${Math.max(0, Math.round(milliseconds))} ms`;
  }

  return `${(milliseconds / 1_000).toFixed(2)} s`;
}

function setText(id: string, value: string): void {
  requireElement(id).textContent = value;
}

function createMetadataRow(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "metadata-row";
  const labelElement = document.createElement("dt");
  labelElement.textContent = label;
  const valueElement = document.createElement("dd");
  valueElement.textContent = value;
  row.append(labelElement, valueElement);
  return row;
}

function evidenceDescription(level: TraceEvent["evidenceLevel"]): string {
  switch (level) {
    case "observed":
      return "Recorded at the runtime boundary.";
    case "model_reported":
      return "Content emitted by the model and observed by the runtime.";
    case "inferred":
      return "Derived by an analysis rule; inspect supporting evidence.";
  }
}

function eventStatusClass(event: TraceEvent): string {
  if (event.status !== undefined) {
    return `status-${event.status}`;
  }

  return event.kind === "unknown" ? "status-unmapped" : "status-neutral";
}

function createFlowBoundary(
  label: string,
  title: string,
  symbol: string,
  isEnd = false,
): HTMLElement {
  const boundary = document.createElement("div");
  boundary.className = isEnd
    ? "flow-boundary flow-boundary-end"
    : "flow-boundary";
  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  const titleElement = document.createElement("strong");
  titleElement.textContent = title;
  const symbolElement = document.createElement("i");
  symbolElement.setAttribute("aria-hidden", "true");
  symbolElement.textContent = symbol;
  boundary.append(labelElement, titleElement, symbolElement);
  return boundary;
}

function renderDetail(
  event: TraceEvent,
  rawRecord: RawTraceRecord | undefined,
): void {
  const empty = requireElement("detailEmpty");
  const content = requireElement("detailContent");
  empty.hidden = true;
  content.hidden = false;

  setText("detailSequence", `EVENT ${String(event.sequence).padStart(2, "0")}`);
  setText("detailTitle", event.title);
  setText("detailEvidence", event.evidenceLevel.replace("_", " "));
  setText("detailEvidenceNote", evidenceDescription(event.evidenceLevel));

  const badge = requireElement("detailEvidence");
  badge.className = `evidence-badge evidence-${event.evidenceLevel}`;

  const metadata = requireElement<HTMLDListElement>("detailMetadata");
  metadata.replaceChildren(
    createMetadataRow("Kind", event.kind),
    createMetadataRow("Status", event.status ?? "not reported"),
    createMetadataRow("Occurred", formatClock(event.occurredAt)),
    createMetadataRow("Source event", event.sourceEventType),
    createMetadataRow("Event ID", event.eventId),
    createMetadataRow("Entity ID", event.entityId ?? "not reported"),
    createMetadataRow(
      "Raw reference",
      `${event.rawRef.file} · sequence ${event.rawRef.sequence}`,
    ),
  );

  setText("normalizedJson", JSON.stringify(event, null, 2));
  setText(
    "rawJson",
    rawRecord === undefined
      ? "Raw record not found."
      : JSON.stringify(rawRecord.payload, null, 2),
  );
}

function renderSummary(payload: TracePayload): void {
  const startedAt = new Date(payload.manifest.startedAt).getTime();
  const endedAt = new Date(payload.manifest.endedAt).getTime();
  const duration = Math.max(0, endedAt - startedAt);
  const unmappedCount = payload.events.filter(
    (event) => event.kind === "unknown",
  ).length;
  const modelReportedCount = payload.events.filter(
    (event) => event.evidenceLevel === "model_reported",
  ).length;

  setText("traceId", payload.manifest.traceId);
  setText("traceStatus", payload.manifest.status);
  setText("eventCount", String(payload.events.length));
  setText("spanCount", String(payload.spans.length));
  setText("findingCount", String(payload.findings.length));
  setText("duration", formatDuration(duration));
  setText("unmappedCount", String(unmappedCount));
  setText("modelReportedCount", String(modelReportedCount));
  setText("runtimeVersion", payload.manifest.codexVersion);

  const status = requireElement("traceStatus");
  status.className = `status-pill status-${payload.manifest.status}`;
}

function renderTimeline(payload: TracePayload): void {
  const viewport = requireElement("timelineViewport");
  const showUnmapped =
    requireElement<HTMLInputElement>("showUnmapped").checked;
  const events = showUnmapped
    ? payload.events
    : payload.events.filter((event) => event.kind !== "unknown");

  viewport.replaceChildren();

  if (events.length === 0) {
    const empty = document.createElement("p");
    empty.className = "timeline-empty";
    empty.textContent = "No events match the current filters.";
    viewport.append(empty);
    return;
  }

  const rawBySequence = new Map(
    payload.rawRecords.map((record) => [record.sequence, record]),
  );
  const flow = document.createElement("div");
  flow.className = "flow-list";

  flow.append(createFlowBoundary("START", "Runtime connection opened", "↓"));

  for (const [index, event] of events.entries()) {
    const previousEvent = events[index - 1];

    if (previousEvent !== undefined) {
      const gap = document.createElement("div");
      gap.className = "flow-gap";
      const gapTime =
        new Date(event.occurredAt).getTime() -
        new Date(previousEvent.occurredAt).getTime();
      const spacer = document.createElement("span");
      const arrow = document.createElement("span");
      arrow.className = "flow-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↓";
      const delta = document.createElement("span");
      delta.className = "flow-delta";
      delta.textContent = `+${formatDuration(Math.max(0, gapTime))}`;
      gap.append(spacer, arrow, delta);
      flow.append(gap);
    }

    const laneId = laneFor(event.kind);
    const lane = laneDefinitions.find(
      (definition) => definition.id === laneId,
    );
    const row = document.createElement("article");
    row.className = "flow-event";
    row.dataset.lane = laneId;

    const clock = document.createElement("time");
    clock.className = "flow-clock";
    clock.dateTime = event.occurredAt;
    clock.textContent = formatClock(event.occurredAt);

    const node = document.createElement("span");
    node.className = `flow-node ${eventStatusClass(event)}`;
    node.textContent = String(event.sequence);

    const card = document.createElement("button");
    card.type = "button";
    card.className = "event-card";
    card.dataset.eventId = event.eventId;
    card.setAttribute("aria-label", `Inspect event ${event.sequence}`);

    const cardHeader = document.createElement("span");
    cardHeader.className = "event-card-header";

    const laneBadge = document.createElement("span");
    laneBadge.className = `lane-badge lane-${laneId}`;
    laneBadge.textContent = lane?.label ?? laneId;

    const evidenceBadge = document.createElement("span");
    evidenceBadge.className = `event-evidence evidence-${event.evidenceLevel}`;
    evidenceBadge.textContent = event.evidenceLevel.replace("_", " ");

    const status = document.createElement("span");
    status.className = "event-status";
    status.textContent =
      event.status ?? (event.kind === "unknown" ? "unmapped" : "observed");
    cardHeader.append(laneBadge, evidenceBadge, status);

    const title = document.createElement("strong");
    title.className = "event-card-title";
    title.textContent = event.title.replace("Unsupported event:", "Unmapped event:");

    const source = document.createElement("span");
    source.className = "event-source";
    source.textContent = event.sourceEventType;

    card.append(cardHeader, title, source);
    card.addEventListener("click", () => {
      document
        .querySelectorAll(".event-card.evidence-linked")
        .forEach((element) => element.classList.remove("evidence-linked"));
      document
        .querySelectorAll(".event-card.selected")
        .forEach((element) => element.classList.remove("selected"));
      card.classList.add("selected");
      renderDetail(event, rawBySequence.get(event.rawRef.sequence));
    });

    row.append(clock, node, card);
    flow.append(row);
  }

  const endStatus = payload.manifest.status.toUpperCase();
  flow.append(
    createFlowBoundary(
      "END",
      `Turn ${endStatus.toLowerCase()}`,
      "●",
      true,
    ),
  );
  viewport.append(flow);

  const firstEvent = events[0];

  if (firstEvent !== undefined) {
    viewport
      .querySelector<HTMLButtonElement>(".event-card")
      ?.classList.add("selected");
    renderDetail(firstEvent, rawBySequence.get(firstEvent.rawRef.sequence));
  }
}

function eventCardFor(eventId: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>(".event-card")].find(
    (card) => card.dataset.eventId === eventId,
  );
}

function jumpToEvidence(finding: DiagnosticFinding): void {
  const cards = finding.evidenceEventIds
    .map((eventId) => eventCardFor(eventId))
    .filter((card): card is HTMLButtonElement => card !== undefined);
  const firstCard = cards[0];

  if (firstCard === undefined) {
    return;
  }

  firstCard.click();
  cards.forEach((card) => card.classList.add("evidence-linked"));
  firstCard.scrollIntoView({ behavior: "smooth", block: "center" });
  firstCard.focus({ preventScroll: true });
}

function renderFindings(payload: TracePayload): void {
  const list = requireElement("findingsList");
  list.replaceChildren();

  if (payload.findings.length === 0) {
    const empty = document.createElement("p");
    empty.className = "findings-empty";
    empty.textContent = "No failed, interrupted, or incomplete operations detected.";
    list.append(empty);
    return;
  }

  for (const finding of payload.findings) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `finding-card severity-${finding.severity}`;
    button.setAttribute(
      "aria-label",
      `${finding.title}. Jump to supporting evidence.`,
    );

    const heading = document.createElement("span");
    heading.className = "finding-heading";

    const severity = document.createElement("strong");
    severity.textContent = finding.severity;

    const evidence = document.createElement("span");
    evidence.className = `event-evidence evidence-${finding.evidenceLevel}`;
    evidence.textContent = finding.evidenceLevel.replace("_", " ");

    const action = document.createElement("span");
    action.className = "finding-action";
    action.textContent = "View evidence ↓";

    heading.append(severity, evidence, action);

    const title = document.createElement("span");
    title.className = "finding-title";
    title.textContent = finding.title;

    const description = document.createElement("span");
    description.className = "finding-description";
    description.textContent = finding.description;

    button.append(heading, title, description);
    button.addEventListener("click", () => jumpToEvidence(finding));
    list.append(button);
  }
}

async function main(): Promise<void> {
  const response = await fetch("/api/trace", {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Trace API returned ${response.status}`);
  }

  const payload = (await response.json()) as TracePayload;
  renderSummary(payload);
  renderTimeline(payload);
  renderFindings(payload);
  requireElement("loadingState").hidden = true;

  requireElement<HTMLInputElement>("showUnmapped").addEventListener(
    "change",
    () => renderTimeline(payload),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  setText("loadingState", `Unable to load trace: ${message}`);
  requireElement("loadingState").classList.add("loading-error");
});
