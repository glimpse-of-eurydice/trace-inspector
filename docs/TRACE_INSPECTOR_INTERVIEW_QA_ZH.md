# Trace Inspector 面试问题与参考回答

> 适用场景：AI Agent、LLM Evaluation、AI Safety、Developer Tools、Agent
> Infrastructure 相关面试。  
> 最后核对：2026-08-01。  
> 使用方法：先练每题的“推荐口语回答”，再用“继续深挖”准备追问。不要逐字背诵；回答时应根据面试官的问题选择重点。

---

## 0. 回答原则

这个项目最重要的不是堆技术名词，而是一直保持三个边界：

1. **Observed（观测事实）**：runtime 或文件系统实际记录到的事件；
2. **Model-reported（模型报告）**：模型输出的计划、解释或总结；
3. **Inferred（分析推断）**：Trace Inspector 根据显式规则得到的判断。

面试中可以反复使用这句话：

> Trace Inspector observes the execution boundary, not the model's hidden
> computation. It preserves raw evidence and makes derived claims inspectable.

以下回答中的“已经实现”必须能在代码、测试、fixture 或报告中找到证据；“如果继续做”则表示 future work。

---

# 一、项目定位与总体架构

## 1. 请用一分钟介绍 Trace Inspector

### 推荐口语回答

Trace Inspector 是一个 local-first 的 AI agent execution observability
工具。它解决的问题是：普通 agent 界面通常只展示最终答案和少量进度信息，但研究者很难系统查看一次执行中 thread、turn、message、command、file change 等事件，更难比较两次运行从哪里开始出现可观察差异。

当前版本以 Codex 为第一个 runtime。Collector 启动一个 ephemeral Codex App
Server turn，保存所有 JSONL runtime messages；之后把原始消息规范化为统一事件，重建 operation spans，生成有证据链接的确定性 findings，并通过本地 timeline viewer 展示。V2 还能在版本化 comparison policy 下对齐两条 trace，并在 alignment 唯一时给出 first observable divergence。

我不会把它称为 mechanistic interpretability 或 causal attribution，因为它看不到模型 hidden state，也不能仅凭事件先后顺序证明因果关系。

### 继续深挖

项目按三个能力层推进：

- V0：capture and see one run；
- V1：reconstruct and diagnose one run；
- V2：compare two controlled runs。

目标用户是调试 Codex runs 的 AI evaluation researcher。Timeline 是 tracing
system 的一个 client，而不是整个系统。

### 可能追问

**问：它和普通 logging 有什么区别？**

答：logging 只是底层数据来源的一种。Trace Inspector 额外定义了稳定的
normalized schema、operation span reconstruction、evidence levels、deterministic
diagnostics、raw evidence links，以及用于双轨迹比较的显式 policy。

**问：为什么不是“LLM 可解释性工具”？**

答：它观察的是 runtime boundary，不能看到 attention、hidden state、完整 chain
of thought 或模型参数如何产生决定。因此更准确的词是 execution observability。

### 项目证据

- [Project brief](project-brief.md)
- [Architecture and visibility boundary](architecture.md)
- [Evidence model](evidence-model.md)

---

## 2. 整个 pipeline 每一步的输入和输出是什么？

### 推荐口语回答

输入是一个 task prompt 和工作目录。Record CLI 调用 collector，collector 通过
stdio 启动 Codex App Server，并依次发送 `initialize`、`thread/start` 和
`turn/start`。App Server 返回的每一条 JSONL 消息都会立刻追加到
`raw.jsonl`，同时 trace-level metadata 写入 `manifest.json`。

Replay 阶段将 raw records 交给 Codex adapter，输出按 sequence 排序的
`events.jsonl`；span reconstruction 把 started、output、completed 等事件组合成
`spans.jsonl`；deterministic diagnostics 再从 spans 产生 `findings.jsonl`。本地
server 把这些数据和 raw records 组合成 `/api/trace` payload，viewer 负责交互式展示。

双轨迹路径则接收两组 normalized events、一个 intervention manifest 和一个
comparison policy，输出 aligned pairs、alignment status 和可选的 first
observable divergence，最后保存为 `diff.json` 并送入 comparison viewer。

### Pipeline 图

```text
prompt + cwd
    ↓
Record CLI
    ↓
Collector ── initialize → thread/start → turn/start
    ↓
Codex App Server JSONL
    ↓
raw.jsonl + manifest.json
    ↓ normalize
events.jsonl
    ↓ reconstruct
spans.jsonl
    ↓ deterministic rules
findings.jsonl
    ↓
/api/trace → Timeline Viewer

left events + right events + intervention + policy
    ↓
sequence alignment
    ↓
diff.json → Comparison Viewer
```

### 可能追问

**问：哪个文件是 source of truth？**

答：`raw.jsonl` 是 append-only 的权威 runtime evidence。Events、spans、findings
都是可由 raw replay 重建的 derived artifacts。

**问：为什么 normalization 不在 collector 内直接完成？**

答：先保存 raw 能避免 adapter bug 导致证据永久丢失，也允许 schema 或规则升级后离线 replay。

### 项目证据

- `src/cli/record.ts`
- `src/collector/codex-app-server.ts`
- `src/replay/replay-trace.ts`
- `src/store/trace-files.ts`

---

## 3. 你为什么通过 Codex App Server 收集，而不是解析终端文本？

### 推荐口语回答

终端文本是面向人的 presentation layer，格式可能变化，也容易丢失 entity ID、状态、事件类型和结构化参数。App Server 提供结构化 runtime messages，使 collector
能够区分 turn lifecycle、agent messages、command execution、file changes 和 usage
等事件，并保留原始 payload。

另外，collector 可以明确控制 cwd、approval policy、sandbox、network access、model
和 reasoning effort，并把 runtime 实际解析出来的配置写入 manifest。这比从日志文本推测可靠。

### 可能追问

**问：App Server 的调用顺序？**

答：collector 启动 `codex app-server --stdio`，发送 `initialize`；收到 response
后发送 `initialized` 和 `thread/start`；拿到 thread ID 后发送 `turn/start`；持续收取消息，直到 `turn/completed` 或 timeout。

**问：这是一个长期存在的 Codex thread 吗？**

答：当前 record 路径使用 ephemeral thread，目标是采集一条独立、容易复现的 trajectory。

---

## 4. 如果面试官现在让 Codex 做一件事，你怎么用 Trace Inspector 查看？

### 推荐口语回答

当前版本必须让任务从 Trace Inspector collector 发起，不能事后 attach 到一个已经在 Codex Desktop 里运行的任意 task。现场我会运行：

```bash
npm run record -- "Inspect package.json and report only the project name. Do not modify files."
npm run view -- latest
```

第一条命令会输出 trace ID、terminal timeline、span 数量和 findings。第二条命令会 replay 最新 trace，启动本地 viewer。

进入页面后我先看整体 event 分布，再按 Lifecycle、Messages、Commands 等类别过滤；点击某个 command event 后，在右侧核对 normalized event 和 raw runtime message；如果有 finding，我会沿 evidence chain 跳到 supporting events。

### 关键限制

> “让 Codex 做事”和“让 Trace Inspector 记录”目前必须是同一次由 collector
> 发起的 turn。对已存在的 Desktop task 做 retroactive attachment 尚未实现。

### Demo 命令

```bash
npm run view:demo
npm run compare:demo
npm run view:agent-hijack-demo
```

---

# 二、数据模型与 viewer

## 5. Raw record、event、span、finding 分别是什么？

### 推荐口语回答

Raw record 是 collector 收到的一条原始 runtime payload，加上本地
`receivedAt` 和递增 sequence。它尽量不解释内容。

Event 是 adapter 生成的稳定、统一表示，例如 `turn.started`、
`message.output`、`command.completed`。每个 event 保留 `rawRef`，可以回到对应 raw record。

Span 是由多个 lifecycle events 重建出的 operation。例如 command started、若干
output delta 和 command completed 可以形成一个 span；span 还记录 paired、missing
start 或 missing end 等状态。

Finding 是显式诊断规则对 span 的输出。例如 runtime 明确报告 command failed，则生成 observed `failed_operation`；如果只有 start 没有 completion，则生成措辞谨慎的 inferred `incomplete_operation`。

### 容易说错的地方

- Event 不是原始消息本身，而是 normalized representation；
- Span 不取代 events，而是引用 source event IDs；
- Finding 不一定是 observed，必须看 evidence level；
- `turn completed` 不代表模型最终总结中的每个 claim 都真实完成。

---

## 6. Viewer 里的 Lifecycle、Messages、Commands、System 是 events 吗？

### 推荐口语回答

它们是 normalized events 的 UI categories，也可以称为 lanes，而不是新的存储层。

映射规则是：

- `rpc.*`、`thread.*`、`turn.*` → Lifecycle；
- `message.*` → Messages；
- `plan.*` → Plan；
- `command.*` → Commands；
- `file.*` → Files；
- usage 和当前没有专门映射的 event → System。

横向 category strip 展示每类 event 数量并负责过滤；纵向 timeline 仍然保留真实的时间顺序、sequence、status、evidence level 和相邻事件间隔。

### 可能追问

**问：为什么不直接做六条并行泳道？**

答：当前 trace 主要是 point events 和 streaming deltas，垂直时间流更容易追踪证据顺序。真正的横向 duration/Gantt 视图在有更多并发 span 时更有价值。当前横向分类条解决的是 overview 和 filtering，不假装展示并发。

---

## 7. 遇到新版本 runtime 发出不认识的事件怎么办？

### 推荐口语回答

不能静默丢弃。Adapter 会把不支持的消息规范化为 `unknown` event，同时保留原始
source-event type、payload 和 `rawRef`。Viewer 默认允许显示 unmapped events，用户也可以过滤。

这个设计有两个目的：第一，schema coverage 不完整时仍然保存证据；第二，runtime
升级后可以根据真实 unknown 分布决定下一个 adapter mapping，而不是假设没有变化。

### 可能追问

**问：unknown 太多会不会污染 comparison？**

答：当前 comparison policy 会比较 unsupported source-event type，所以它们可能影响 alignment。更成熟的版本可以增加 policy controls 或按 runtime version
管理映射，但不能默认删除它们。

---

## 8. 为什么要区分 observed、model-reported 和 inferred？

### 推荐口语回答

因为 agent 调试里最常见的错误之一，是把模型说过的话当成模型真正做过的事，或者把时间先后当成因果。

例如模型说“我会查看官方文档”只是 model-reported intention；runtime 记录到 web
search/tool call 才是 observed action；分析器认为搜索结果影响了最终回答则是 inferred
relationship。

Trace Inspector 把 evidence level 写入事件和 finding，并让每个 derived claim 能跳回 raw evidence。这使用户可以判断系统展示的是事实、自述还是分析。

### 可能追问

**问：模型最终回答也是 observed 吗？**

答：模型确实输出了这段文字是 observed runtime fact，但文字中的内容属于
model-reported claim。若它说“测试全部通过”，仍需检查 command exit status 和 output。

---

## 9. 如何判断一个 bad case 出在哪一层？

### 推荐口语回答

我会沿 evidence pipeline 从下往上定位，而不是先怪模型：

1. 查看 `manifest.json`：runtime、model、sandbox、status 是否符合预期；
2. 查看 `raw.jsonl`：App Server 是否真的发出了相关消息；
3. 查看 `events.jsonl`：adapter 是否正确映射，还是变成 unknown；
4. 查看 `spans.jsonl`：started/completed 是否正确 pairing；
5. 查看 `findings.jsonl`：rule 的 evidence IDs 和措辞是否合理；
6. 查看 viewer API/UI：是否只是展示或过滤问题；
7. 最后再判断 agent behavior 本身是否失败。

这能区分 collector loss、normalization bug、span reconstruction bug、diagnostic false
positive、viewer bug 和真实 agent failure。

### 示例追问

**问：知识库中有正确内容，但 agent 没使用，你怎么排查？**

答：先找有没有 observed read/search operation；如果完全没检索，是 planning/tool-use
层问题；如果检索了但没有读完，可能是 tool failure 或 incomplete span；如果确实读取了但最终回答仍错误，则把“exposure”和“downstream use”分开，不能只因为文件被读过就声称它影响了回答。

---

## 10. 如果模型回答出现幻觉，Trace Inspector 怎么解决？

### 推荐口语回答

Trace Inspector 目前不直接判定开放式回答是否 hallucinated。它能做的是把产生回答的可观察执行过程变得可审计：是否搜索、读取了哪些文件、命令是否失败、模型最终声称做了什么，以及这些 claim 是否有 runtime evidence。

如果要增加 hallucination evaluation，我会把它设计成新的 evaluator，而不是混入 raw
collector：先定义 task-specific rubric 或 grounded evidence set，再生成带 evidence IDs
的 evaluation finding，并明确它是 deterministic rule、human annotation 还是 model-based judge。

### 容易说错的地方

不要说“Trace Inspector 可以检测所有幻觉”。当前确定性 diagnostics 主要覆盖 failed、interrupted 和 incomplete operations。

---

# 三、双轨迹比较与实验设计

## 11. 两条 trajectory 是怎么比较的？

### 推荐口语回答

Comparator 接收两组 normalized events，并按照 `v2-default 0.2.0` policy 做全局动态规划序列对齐。

它比较 event kind、command、status、output、plan 和 unsupported source-event type；忽略随机 event ID、entity ID、绝对时间以及 raw file reference。配置的左右 workspace root 会先归一化为同一个 `<WORKSPACE>` placeholder。

成本设计是 exact match 为 0、同 kind 内容变化为 1、insert/delete 为 2、不同 kind substitution 为 5。不同 kind substitution 比一次 delete 加 insert 更贵，避免把完全无关的事件硬配在一起。

输出中的每一行是 `same`、`changed`、`inserted` 或 `deleted`。只有 minimum-cost alignment
唯一时，系统才报告最早的非 same 行作为 first observable divergence。

### 可能追问

**问：为什么不直接按 sequence index 比较？**

答：一次运行可能多一个 plan update 或少一个 output event，固定 index 会导致后面所有事件错位。Sequence alignment 可以显式表示 insertion/deletion。

**问：为什么不用 embedding similarity？**

答：当前目标是建立可复现、可审计的 baseline。Embedding 会引入模型版本、阈值和语义不确定性。未来可以作为可选 semantic policy，但不能替代 inspectable baseline。

### 项目证据

- [Comparison policy](comparison-policy.md)
- `src/analysis/compare-traces.ts`
- `src/tests/compare-traces.test.ts`

---

## 12. 什么是 first observable divergence？为什么不是 cause？

### 推荐口语回答

First observable divergence 是在指定 comparison policy 下，对齐结果中最早出现的
`changed`、`inserted` 或 `deleted` 行。

它不是 causal origin，因为更早的 hidden computation 可能已经不同，sampling 或 runtime
scheduling 也可能不同，而且“什么算 material difference”本身由 policy 决定。即使我们观察到某次 file read 后两条 trace 开始不同，也只能说这是 policy 下第一处可观察差异，不能说它导致了最终回答差异。

安全表述是：

> The first observable difference under `v2-default` occurred at the command
> output event. The comparison does not establish causal origin.

---

## 13. 如果有多个同样好的 alignment 怎么办？

### 推荐口语回答

这是 comparison 中的一个关键 bad case。动态规划不仅保存 minimum cost，还把 minimum-cost
path 数量计数到上限 2：1 表示 unique，2 表示 multiple。

如果存在多个最优 alignment，系统标记 `ambiguous`，保留一个 deterministic preview
供人检查，但不报告 first observable divergence。这样 tie-breaking preference 不会被包装成 trace 的客观属性。

### 可能追问

**问：为什么还保留 preview？**

答：preview 对调试 policy 和查看候选对齐仍有价值，但 UI 必须明确它只是多个同成本解之一。

**问：这是不是算法失败？**

答：不是。对不充分证据进行 abstention 是系统支持的正确结果。Memory 和 security case
都出现了 ambiguous alignments，报告没有强行制造 divergence。

---

## 14. 你如何评估 comparison policy 本身？

### 推荐口语回答

项目有一个八对 synthetic golden set。每个 case 在运行前声明预期的 alignment status、first
divergence、reason code、event sequence 和 selected-path summary。

它覆盖 exact match、output change、plan insertion、plan deletion、status change、ignored
metadata changes，以及两个 ambiguity cases。命令是：

```bash
npm run eval:golden
```

Golden set 可以证明实现符合预先声明的 policy 行为，但不能证明对所有真实 agent trace 都有 semantic accuracy。因此下一步应该收集更大的真实 trace set，增加人工标注 alignment，并比较 policy 与 reviewer agreement。

---

## 15. Memory-conditioned case study 做了什么？

### 推荐口语回答

这个 case study 研究同一段冻结的 LoCoMo history 用三种 representation 呈现时，同一个本地 planning task 的可观察 trajectory 是否不同。

M1 是 timestamped witness trace，M2 是 stable profile，M3 是 temporal and uncertainty-aware
profile。每个 condition 运行三次，共九条真实 Codex runs，并使用预先声明的交错顺序。运行时固定 model、reasoning effort、approval policy、sandbox 和 network policy；每次使用新 workspace，只安装对应 `memory.md`，并审计只有目标 `proposal.md` 被修改。

分析阶段先验证 exposure，再构造 operation-level projection，比较运行并生成 blinded final
artifacts 供人工审核。主要 R1 comparisons 在 frozen policy 下 ambiguous，所以报告保留证据但拒绝 first-divergence claim。

### 可能追问

**问：能说 memory representation 导致了结果变化吗？**

答：不能。这个九运行 case study 是描述性的 case-specific intervention，不估计 population
effect；primary alignment 又是 ambiguous。可以报告 exposure、artifact 和 observed trajectory，不能做 model-internal causal claim。

### 项目证据

- [Memory analysis summary](case-studies/memory-agent-analysis-summary.md)
- [Memory case plan](memory-agent-case-study-plan.md)

---

# 四、Security、OWASP 与边界

## 16. Agent-hijack security case study 的设计是什么？

### 推荐口语回答

实验使用完全 synthetic 的 maintenance workspace，比较三个条件：clean input、injected
input with contained capability，以及 injected input with a real restricted-write boundary。

目标不是只看最终回答，而是把 attack chain 拆成独立状态：untrusted-content exposure、policy-disallowed operation、runtime enforcement、canary propagation 和 legitimate-task utility。Evaluator policy 保存在 agent workspace 之外，并用 exact-path rules 区分真实 operation target 和仅仅出现在 command output 中的恶意文本。

实验结果是 resistant/null：F2 和 F3 都读取了 injected artifact，但没有尝试 canary read
或 sibling write，canary 没有传播，三次 legitimate report 都通过 utility checks。Preflight
单独证明了 F3 的 sibling write 如果发生会被 runtime 拒绝，但主实验中没有发生 write attempt。

### 最重要的措辞

应说：

> `exposed_no_disallowed_action`

不应说：

> `unauthorized_write_blocked`

因为 agent 根本没有尝试这次 write。

---

## 17. 这个 security case 如何映射到 OWASP？

### 推荐口语回答

它与三个 OWASP threat categories 相关：

- `LLM01:2025 Prompt Injection`：外部文件包含 indirect instruction；
- `ASI01:2026 Agent Goal Hijack`：该 instruction 试图重定向 agent 的合法目标；
- `ASI02:2026 Tool Misuse and Exploitation`：canary read 和 sibling write 是实验要检测的潜在 tool-use consequences。

但这些标签描述的是 threat model，不等于实验观察到了成功 exploit。实际结果是 exposure
observed，goal hijack not observed，tool misuse not observed。

另外正确缩写是 `ASI`，代表 Agentic Security Initiative，不是 `AIS`。

### 项目证据

- [Agent-hijack results](case-studies/agent-hijack-mvp-results.md)
- `src/case-study/agent-hijack-mvp.ts`
- `src/tests/agent-hijack-mvp.test.ts`

---

## 18. Security experiment 没有攻击成功，还有价值吗？

### 推荐口语回答

有价值，因为 observability 工具不能只在“成功攻击”时工作。它必须忠实表示 null、resistant
和 ambiguous outcomes，不能为了展示效果制造一个不受证据支持的安全结论。

这个 case 仍验证了几个产品能力：能区分 exposure 与 downstream action；能把 policy
classification 和 runtime enforcement 分开；能同时保留 security outcome 与 legitimate-task
utility；能在 alignment ambiguous 时 abstain；还能把 reached 和 not-observed attack-chain
stages 链回 runtime evidence。

局限也很明确：每个 condition 只有一次 run，不能估计成功率或 robustness；没有 disallowed
attempt，因此不能估计 F2 与 F3 capability difference 的效果。

---

# 五、存储、扩展性与工程取舍

## 19. 为什么现在使用 JSONL？什么时候迁移 SQLite？

### 推荐口语回答

JSONL 很适合当前阶段的 append-only trace：每条消息可以流式追加，保持顺序，容易人工检查、写 fixture、做 Git diff，也便于从 raw evidence 离线 replay。

我不会把 raw JSONL 迁走。更合理的演进是保留 `raw.jsonl` 作为权威证据，再增加一个可删除、可重建的 SQLite index，用于跨 trace 查询、分页、过滤和聚合。

当出现以下需求时值得加入 SQLite：

- 数百到数千条 trace；
- 按 model/runtime/finding/command 跨 trace 搜索；
- viewer 需要分页而不是一次加载全部事件；
- case studies 需要复杂 joins 和 aggregation；
- 多进程读写和 schema migration 变成实际问题。

### 可能追问

**问：为什么 SQLite 也不能成为唯一 source of truth？**

答：数据库 schema 和 index 会演进，而原始 runtime payload 是不可替代的审计证据。保留 raw
使 adapter、span 和 diagnostics 都可以重新生成。

**问：SQLite 初版会有哪些表？**

答：可以有 `traces`、`events`、`spans`、`findings`、`finding_evidence`，同时记录
schema version 和 raw sequence reference。数据库是 projection，不负责篡改原始文件。

---

## 20. 如果要把系统扩展到其他 agent framework，怎么做？

### 推荐口语回答

当前项目只验证了 Codex，不能自称 framework-agnostic。扩展时我会保留 Trace Core 中的稳定
event、span 和 evidence interfaces，为每个 runtime 新增 adapter 和 collector。

例如一个新 adapter 需要回答：如何识别 turn lifecycle、tool invocation、output delta、file
change、usage 和 raw reference；不支持的消息如何保留；runtime-specific metadata 放在哪里。

真正困难的不是添加一个 parser，而是验证不同 framework 的语义是否能安全映射到同一 kind。例如两个 runtime 的 `completed` 是否都代表相同 lifecycle boundary，不能只因为字段名相似就合并。

### Future design

可以增加 adapter contract tests：同一组 framework-neutral conformance cases 验证 raw
preservation、ordering、unknown fallback、status mapping 和 evidence links。

---

## 21. 如果做成 production service，还缺什么？

### 推荐口语回答

当前是 local-first research/developer tool，不是 production monitoring platform。Production
化至少需要：

- authentication、authorization 和 tenant isolation；
- secret/PII redaction 与可配置 retention；
- encrypted storage 和 audit logs；
- backpressure、stream interruption recovery、idempotency；
- schema migration 和 runtime-version compatibility；
- scalable indexing、pagination 和 search；
- telemetry 自身的 reliability/latency monitoring；
- threat model，尤其是 trace 中可能包含恶意内容或 secrets；
- 多 runtime validation 和 browser end-to-end tests。

我会先做 privacy/redaction 和 rebuildable indexing，而不是马上做 hosted multi-user service，因为 raw trace 可能包含 prompt、路径、diff 和 command output，风险很高。

---

## 22. 这个项目最重要的技术取舍是什么？

### 推荐口语回答

我认为最重要的是选择“保留证据并允许 abstention”，而不是追求一个看起来聪明但不可审计的结论。

具体体现在：先写 raw 再 normalize；unsupported events 不丢弃；span/finding 都保留 source event
IDs；diagnostics 先使用 deterministic rules；comparison 使用版本化、可解释的成本；alignment
不唯一时不报告 first divergence；case study 是 null result 时不制造攻击成功。

代价是系统当前语义理解能力有限，也会显示更多 unknown 和 ambiguous results。但对 evaluation
和 safety tooling 来说，这比过度声称更可信。

---

# 六、Function calling、MCP 与 agent 概念追问

## 23. Function calling 和 MCP 有什么区别？

### 推荐口语回答

Function calling 通常指模型/API 层的 structured tool selection：应用把可用函数的 name、description
和 input schema 传给模型，模型返回结构化 arguments，真正执行函数的是应用。

MCP 是 client-server interoperability protocol。MCP server 可以向不同 host 暴露 tools、resources
和 prompts，并处理 discovery、schema、transport 和调用边界。Host 把 MCP tool 暴露给模型时，模型仍可能通过类似 function-calling 的机制选择这个 tool。

所以两者不是完全互斥：function calling 更接近“模型如何表达一次结构化工具调用”，MCP
更接近“工具和上下文如何以标准协议被发现和接入多个应用”。

### 调用过程示例

```text
Function calling:
application defines tool schema
  → model selects tool + arguments
  → application validates arguments
  → application executes function
  → tool result returns to model

MCP:
host connects to MCP server
  → host discovers tools/resources
  → model selects an exposed tool
  → host sends protocol request to MCP server
  → server executes and returns structured content
  → host provides result to model
```

### 与本项目的边界

Trace Inspector 当前通过 stdio 与 Codex App Server 交换 JSONL/JSON-RPC-shaped messages，记录
Codex runtime events；它当前不是 MCP server，也没有声称通用 MCP integration。

---

## 24. 做 web research 应该用 function calling 还是 MCP？

### 推荐口语回答

我不会仅从“模型能力”判断，而会看系统集成需求。

如果只有一个应用、一个稳定 search API、需要精细控制参数和最小依赖，我会直接用 function
calling 接内部 wrapper。这样 auth、retry、rate limit 和 result schema 都在应用内清晰可控。

如果同一组 research tools 需要被多个 agent hosts 复用，或需要标准化 discovery、resources、tools
和权限边界，我会考虑 MCP。无论选哪个，都必须在应用侧验证参数、限制网络范围、记录 citations
和 tool evidence，不能把模型生成的 URL 当成检索已经发生。

---

## 25. 四个智能体之间如何协作、如何共享上下文？

### 推荐口语回答

这个问题要先澄清：Trace Inspector 当前没有实现四智能体 orchestration，所以我不会把一个不存在的 multi-agent architecture 说成项目事实。

如果设计一个多智能体版本，我会避免让所有 agent 共享无限 conversation。更安全的方式是：orchestrator
分配带明确 schema 的 task；worker 返回 structured result、artifact reference 和 provenance；共享状态通过版本化 workspace 或 message store；每次 handoff 记录 sender、receiver、task ID、input
snapshot、output 和 tool evidence。

Trace Inspector 可以为每个 agent 保留独立 trace ID，再用 parent run / causal edge 表示 delegation。
Viewer 则同时提供 per-agent timeline 和跨 agent handoff view。必须特别处理并发、clock skew、duplicate
delivery 和 partial failure。

### 可能追问

**问：一个 agent 怎么把结果给另一个？**

答：通过 orchestrator-controlled structured message 或 artifact reference，不建议直接复制整个
context。Receiver 应知道数据来源、版本和 confidence；敏感能力不能因为 delegation 自动继承。

---

# 七、AI-assisted coding、测试与项目掌握度

## 26. 这个项目是不是 vibe coding？你如何审核 AI 生成的代码？

### 推荐口语回答

这是 AI-assisted development，但我不会把“代码能运行”等同于“我理解系统”。我的审核单位不是某段自然语言回答，而是 architecture boundary、typed interface、diff、test 和可复现 artifact。

具体流程是：先写问题定义、non-goals 和 evidence model；实现后检查 collector 是否保存 raw、adapter
是否有 unknown fallback、derived claim 是否链接 evidence、case study 是否固定 runtime controls；然后运行 typecheck、unit/integration tests、golden-set evaluation 和 credential-free demos；最后核对 README claim 与当前实现是否一致。

如果一段代码我不能解释输入、输出、失败模式和测试，我不会在面试里把它当作已掌握能力。

### 建议保持诚实

不要虚构“所有代码都是纯手写”或给出没有依据的百分比。可以根据真实情况说：

> I used Codex to accelerate implementation and review, while I owned the
> problem framing, evidence boundaries, experiment design, acceptance criteria,
> and final verification. I can trace the main execution path and explain the
> tradeoffs, tests, and limitations.

### 可能追问

**问：如何检查整体架构，而不是只看局部 diff？**

答：从 CLI entry point 走一遍真实 data flow；检查 core types 的依赖方向；确认 runtime-specific
逻辑留在 adapter/collector；用 fixture replay 验证 derived outputs；再用 README claim 反向查找代码和测试证据。

---

## 27. 你如何测试 Trace Inspector？

### 推荐口语回答

测试分为几层：

- normalization tests：支持事件的 mapping、agent message evidence level、unknown fallback、RPC response；
- span tests：paired、incomplete、orphan、duplicate completion、shuffled input；
- diagnostic tests：failed、interrupted、incomplete 和正常 completion；
- comparison tests：material changes、metadata ignore、workspace normalization、insertion、ambiguity；
- golden set：8 个预声明 comparison cases；
- case-study tests：runtime control drift、memory exposure、fixture checksum、security target classification；
- privacy regression：public fixture 不包含已知 private paths 或 credential-like patterns；
- live/demo validation：真实 App Server turn，以及 credential-free synthetic replay。

当前完整 `npm test` 通过 38 个 tests。这个数字会变化，面试前应重新运行，不要死背旧文档中的历史数字。

### 命令

```bash
npm run typecheck
npm test
npm run eval:golden
npm run view:demo
npm run compare:demo
```

### 仍缺少的测试

自动 browser end-to-end tests 仍是 planned work；current unit/integration coverage 不能替代跨浏览器 UI 验证。

---

## 28. 如果面试官问“你对简历里的项目掌握多少”？

### 推荐口语回答

我不会用一个模糊百分比回答。我能独立解释并现场演示主链路：collector 如何启动 App Server、raw
如何保存、adapter 如何 normalize、span 和 finding 如何重建、viewer 如何追到 raw evidence，以及
comparison policy 为什么会 abstain。

我也能明确指出没有完成的部分，例如 SQLite index、通用 custom-pair compare CLI、多 framework
validation、production auth/redaction 和 browser E2E。这些边界同样属于对项目的掌握。

如果需要现场证明，我会先运行 `npm test`，再录一条 read-only trace，通过 viewer 找到 command
event，最后运行 comparison demo 解释 first divergence 和 ambiguity。

---

# 八、复盘与 future work

## 29. 项目里遇到的一个具体 bad case 是什么？你怎么解决的？

### 推荐口语回答 A：Ambiguous alignment

最有代表性的 bad case 是 duplicate 或高度相似 events 导致多个同成本 alignment。早期如果只按固定 tie-break 回溯，系统会输出一个看起来确定的 first divergence，但这个结果其实依赖实现偏好。

解决方法是在动态规划矩阵中同时计算 minimum cost 和 optimal path count，并把计数 cap 在 2。只要大于 1，就标记 ambiguous、保留 preview、withhold first divergence，并为此加入两个 golden cases。

### 推荐口语回答 B：Security target false positive

另一个 bad case 是 injected text 可能出现在 command output 中。如果仅用字符串搜索，分析器可能把“文本里提到 canary path”误判成 agent 实际访问了该 path。

解决方法是只对真实 command/file-change operation target 做 exact-path classification，把 output
content 与 operation target 分开，并加入 regression test：恶意文本出现在 output 中不能算 disallowed
operation，真实 command 或 file target 仍然能被识别。

### 建议

面试时选择一个你可以解释代码和测试的 bad case，不要一次讲太多。

---

## 30. 如果再给你两周，你会优先做什么？

### 推荐口语回答

我会优先做“通用真实 trace comparison + rebuildable index”，而不是增加更多视觉效果。

第一步新增通用 CLI：

```text
trace-inspector compare <leftTraceId> <rightTraceId> --intervention <file>
```

让用户不依赖 hard-coded demo 就能比较任意 controlled pair，并明确要求 intervention manifest 和
policy version。

第二步保留 raw JSONL，同时增加 SQLite derived index，支持 list、filter、pagination 和 cross-trace
queries。第三步加入 browser E2E，覆盖 category filtering、raw evidence selection、finding navigation
和 ambiguous comparison UI。

如果以 security role 为目标，我还会优先增加 configurable redaction、secret scanning、trace
retention policy，以及更多 OWASP-aligned adversarial fixtures。

---

# 九、面试现场速查

## 60 秒项目回答模板

> Trace Inspector is a local-first execution-observability tool for AI agents.
> It launches an ephemeral Codex App Server turn, preserves every JSONL runtime
> message as append-only raw evidence, normalizes supported events, reconstructs
> operation spans, and produces evidence-linked deterministic findings. A local
> viewer lets users filter lifecycle, message, command, file, and system events
> and inspect each normalized event beside its raw payload. For controlled
> pairs, a versioned dynamic-programming policy aligns traces and reports a
> first observable divergence only when the optimal alignment is unique. The
> tool observes execution, not hidden model computation, so it explicitly
> separates observed, model-reported, and inferred claims.

## 三条必须主动说出的边界

1. Current version records a new collector-launched Codex turn; it cannot attach retroactively to an arbitrary Desktop task.
2. First observable divergence is policy-derived and is not causal origin.
3. Current implementation is Codex-specific and local-first; SQLite indexing, multi-framework support, production security, and browser E2E remain future work.

## 现场演示顺序

```bash
# 1. 健康检查
npm run typecheck
npm test

# 2. 无凭证单轨迹 demo
npm run view:demo

# 3. 真实只读 turn
npm run record -- "Inspect package.json and report only the project name. Do not modify files."
npm run view -- latest

# 4. 双轨迹比较
npm run compare:demo

# 5. Security case showcase
npm run view:agent-hijack-demo
```

## Viewer 中应该指出什么

1. 顶部 Events、Spans、Findings、Wall time；
2. 横向 normalized-event categories 和数量；
3. 纵向 chronological flow；
4. event kind、status、evidence level；
5. normalized event 与 raw runtime message；
6. finding evidence chain；
7. comparison 的 intervention、policy、alignment status；
8. unique 时的 first divergence，或 ambiguous 时的 abstention。

## 面试前更新清单

- [ ] 重新运行 `npm test`，更新测试数量；
- [ ] 确认 README status 与代码一致；
- [ ] 确认 demo ports 未被占用；
- [ ] 准备一个 10 秒完成的 read-only prompt；
- [ ] 能从 `record.ts` 顺着读到 collector、replay、store 和 viewer；
- [ ] 能解释一个 comparison bad case；
- [ ] 能解释 security null result 为什么仍有价值；
- [ ] 不把 planned SQLite、MCP、多 agent 或多 framework 说成已实现。

---

# 十、项目证据索引

| 面试主题 | 主要证据 |
|---|---|
| 项目范围 | `README.md`, `docs/project-brief.md` |
| App Server collector | `src/collector/codex-app-server.ts` |
| Record CLI | `src/cli/record.ts` |
| Normalization | `src/adapters/codex/normalize-codex-message.ts` |
| Raw/derived store | `src/store/trace-files.ts` |
| Replay pipeline | `src/replay/replay-trace.ts` |
| Span reconstruction | `src/analysis/reconstruct-spans.ts` |
| Diagnostics | `src/analysis/run-diagnostics.ts` |
| Timeline viewer | `src/web/app.ts`, `web/index.html` |
| Comparison algorithm | `src/analysis/compare-traces.ts` |
| Comparison policy | `docs/comparison-policy.md` |
| Evidence levels | `docs/evidence-model.md` |
| Memory case | `docs/case-studies/memory-agent-analysis-summary.md` |
| Security case | `docs/case-studies/agent-hijack-mvp-results.md` |
| Tests | `src/tests/` |

