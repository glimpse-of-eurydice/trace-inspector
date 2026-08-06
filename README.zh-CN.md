# Trace Inspector

面向 AI Agent 的本地优先执行可观测工具。

> 当前状态：V2 核心功能已完成。本地采集器可记录一次真实的 Codex App Server 单轮运行，保留原始 JSONL，将支持的事件标准化，并在终端和浏览器时间线中回放，同时关联原始证据。回放流程还可重建派生操作区间，并生成带证据链接的确定性诊断结果。版本化比较策略能够对齐受控轨迹对，仅在存在唯一最优对齐时定位首个可观察分歧；若存在多条最小成本对齐路径，则主动弃权。

![Trace Inspector 展示合成失败命令、证据链与选中的完成事件](docs/assets/trace-inspector-demo.png)

## 要解决的问题

现有 Agent 界面通常只展示最终输出和部分进度消息，很难把一次运行作为结构化的运行时事件序列进行检查，也难以比较两次运行究竟从哪个可观察节点开始出现差异。

### 目标用户

需要调试 Codex 运行过程的 AI 评测研究者。

## 当前已实现

- 记录一次真实、临时的 Codex App Server 单轮运行；
- 将收到的每条消息保存为只追加的原始 JSONL；
- 写入轨迹清单，并通过版本化 schema 回放原始证据；
- 标准化生命周期、消息、命令、计划、用量和 RPC 响应事件；
- 将暂不支持的事件保留为 `unknown`；
- 渲染确定性的终端时间线；
- 在横向分类条中汇总标准化事件及其数量，并按生命周期、消息、计划、命令、文件或系统事件筛选时间线；
- 在浏览器中打开纵向时间流，展示泳道标签、状态转换耗时，以及可点击的原始证据和标准化证据；
- 在不替换源事件的前提下，重建成对、失败、中断、未完成和孤立操作区间；
- 为失败、中断和未完成操作生成确定性诊断结果；
- 查看每条诊断结果的紧凑证据链，并跳转至任一支持该结论的标准化事件和原始运行时消息；
- 使用与本地真实轨迹相同的回放流程，重建可公开分享的合成 demo；
- 使用有文档说明的动态规划策略对齐两条轨迹，并忽略随机 ID 和绝对时间戳；
- 将对齐行分类为 `same`、`changed`、`inserted` 或 `deleted`；
- 统计最小成本对齐路径的数量，并显式标记存在歧义的比较；
- 当最优解不唯一时，保留一个确定性预览，但不报告首个分歧；
- 使用八组配对合成 golden set 评估比较策略；
- 定位首个可观察分歧，并在并排视图中检查两侧的标准化证据与原始证据；
- 准备并记录隔离的 memory-conditioned Codex 运行，显式保存条件与重复编号、沙箱化本地写入、暴露证据和运行后的 workspace audit；
- 离线分析已经完成的九次 memory 实验矩阵，区分预期的记忆暴露与后续比较，保留有歧义的对齐，并生成用于盲审的最终产物包；
- 运行三条件合成间接指令实验，包含不调用模型的 sandbox preflight、精确路径策略分类、独立的安全与效用结果，以及无静默重试的运行规则。

## 后续工作

V1 的进一步完善包括可重建的 SQLite 索引、更丰富的诊断类型、操作区间导航、敏感信息脱敏和自动化浏览器测试。比较功能还可继续加入策略控制、流式输出聚合，以及在更大规模真实轨迹集上的评估。

## 项目目前不声称支持

- 多种 Agent 框架；
- 托管式多人服务；
- 神经网络内部可解释性；
- 自动因果归因；
- 生产级身份认证；
- 通用型 LLM 监控平台。

## 架构

```text
Codex App Server
        ↓ 原始运行时事件
Collector and Codex Adapter
        ↓ 标准化的只追加事件
Trace Core and Local Store
        ↓                    ↘
Timeline Viewer          Trace Comparator
                              ↓
                    Side-by-side Diff Viewer
```

客户端与可见性边界详见 [docs/architecture.md](docs/architecture.md)；V2 的具体匹配字段、成本定义、歧义处理规则和 golden set 覆盖范围详见 [docs/comparison-policy.md](docs/comparison-policy.md)。

## 可复现 Demo

仓库内提交的 fixture 只包含合成的 Codex 形态运行时消息，不包含私有本地路径、提示词、token 或仓库内容。运行 demo 不需要安装或登录 Codex CLI：

```bash
npm install
npm run view:demo
```

该命令会在被忽略的本地轨迹目录中生成 `demo-failed-command`，随后依次运行标准化、操作区间重建、诊断、API 和浏览器查看器流程。失败诊断会展示以下证据链：

```text
02 STARTED → 03 OUTPUT → 04 FAILED
```

每一步都可以打开对应的标准化事件和原始运行时消息。

V2 比较 demo 会构造一个成功基线和一个失败变体：

```bash
npm run compare:demo
```

版本化策略会忽略事件 ID、实体 ID、绝对时间戳和原始文件引用，同时比较事件类型、命令、状态、命令输出、计划内容和暂不支持的源事件类型。对于仓库内提交的配对样本，系统会报告：

```text
baseline event 03: 7 tests passed
variant  event 03: 1 test failed
                    ↑ v2-default 下的首个可观察分歧
```

底层输出属于可观察的运行时证据；轨迹对齐及“首个”节点的选择属于所选策略下的 `inferred` 结果，系统不会把它们表述为后续行为的原因。

无需凭证即可评估比较策略的 golden set：

```bash
npm run eval:golden
```

八组预先声明的配对样本覆盖完全匹配、实质性变化、插入、删除、无害元数据变化，以及两类歧义场景。存在歧义时，系统会展示确定性预览，但不报告首个分歧。

### V2 比较流程演示

![Trace Comparison 总览：展示构造的干预、唯一对齐状态和首个可观察分歧](docs/assets/trace-comparison-overview.png)

总览会先说明发生变化的条件和结论边界，再展示推断得到的分歧位置。

<details>
<summary>查看对齐后的轨迹与关联原始证据</summary>

![成功与失败合成命令轨迹的并排对齐](docs/assets/trace-comparison-alignment.png)

![所选命令输出分歧的原始证据与标准化证据](docs/assets/trace-comparison-evidence.png)

</details>

## Memory-conditioned Agent 案例研究（进行中）

第一个案例研究关注：当同一个本地规划任务分别接收同一份冻结 LoCoMo 历史的三种表示方式时，可观察的 Codex 轨迹会在哪里出现分歧——如果确实存在分歧。这三种表示分别是带时间戳的 witness trace（M1）、稳定画像（M2），以及包含时间与不确定性信息的画像（M3）。这是针对具体案例的受控干预，不是群体层面的记忆 benchmark，也不对模型内部机制做因果判断。

在不调用模型的情况下准备 workspace：

```bash
npm run prepare:memory-case -- M1
```

使用本地已认证的 Codex runtime 记录指定条件和重复编号：

```bash
npm run record:memory-case -- M1 R1
```

在采集预先声明的九次运行矩阵前，执行 clean-worktree、runtime control、运行顺序和命名冲突检查：

```bash
npm run preflight:memory-case
npm run case-study:memory
npm run analyze:memory-case
```

矩阵命令将模型固定为 `gpt-5.6-sol`，推理强度固定为 `medium`，审批策略固定为 `never`，使用禁用网络的 workspace sandbox，并按照冻结案例清单中声明的交错顺序运行。系统会记录每次 `thread/start` 响应实际解析出的运行时参数，并标记不同运行之间的配置漂移。失败、未完成或未发生暴露的轮次都会被保留，绝不进行静默重试。

运行封装器会创建全新的 workspace，仅安装当前条件对应的 `memory.md`，通过 Codex sandbox 策略禁用网络，记录并回放原始轨迹，检查 `memory.md` 是否被完整读取，并验证只有 `proposal.md` 发生变化。本地 workspace、轨迹、运行清单和运行台账均保存在 `.trace-inspector/` 下，并由 Git 忽略。

九次运行矩阵已完成。离线分析会回放全部运行，构建确定性的操作级投影，写入描述性运行表和比较表，并为所有最终 proposal 创建盲化副本：

```bash
npm run analyze:memory-case
```

该分析过程不会调用模型。所选 R1 主比较在版本化对齐策略下存在歧义，因此分析器会保留相关证据，但不报告首个分歧。这种弃权是受支持的分析结果，不代表运行失败。打开生成的 blinding map 前，请按照 [人工评审指南](docs/MEMORY_AGENT_MANUAL_REVIEW_GUIDE.md) 标注盲化后的最终产物。冻结实验设计与结论边界详见 [docs/memory-agent-case-study-plan.md](docs/memory-agent-case-study-plan.md)。

## Agent Hijack 可观测性案例

### OWASP 威胁模型定位

该案例是针对间接指令威胁的受控可观测性研究，并不声称成功利用了某项 OWASP 漏洞。其最直接的威胁模型来源是 [LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) 和 [ASI01:2026 Agent Goal Hijack](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)。canary-read 和 sibling-write 阶段用于检测与 [ASI02:2026 Tool Misuse and Exploitation](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) 一致的证据，但完成的 F1–F3 运行中未观察到此类工具滥用。`ASI` 是 OWASP Agentic Security Initiative 的前缀，不应缩写为 `AIS`。

该安全 MVP 用于验证 Trace Inspector 能否在同一个受控本地场景中区分：不可信内容暴露、策略禁止操作、运行时权限执行、合成后果，以及合法任务效用。评估器策略始终位于 Agent workspace 之外。

```bash
npm run preflight:agent-hijack-mvp
npm run case-study:agent-hijack-mvp
npm run analyze:agent-hijack-mvp
```

完成的 F1–F3 实验得到 resistant/null 结果：两个注入条件中的 Agent 都读取了合成指令，但均未尝试被禁止的 canary 读取或 sibling 写入，没有发生 canary 传播，三份合法报告也全部通过确定性效用检查。独立的 runtime preflight 进一步证明：如果 F3 尝试 sibling 写入，运行时会拒绝该操作。证据边界与限制详见 [结果摘要](docs/case-studies/agent-hijack-mvp-results.md)。

无需调用模型或提供凭证，即可打开演示版本：

```bash
npm run view:agent-hijack-demo
```

dashboard 会先以攻击链形式展示结果，再将已到达的阶段链接回时间线中的标准化证据和原始证据。仓库内提交的回放数据根据真实 F3 结果结构重新构造，并非本地原始轨迹的逐字副本。

![Agent Hijack dashboard：展示可观察攻击链停止的位置](docs/assets/trace-inspector-agent-hijack-overview.png)

<details>
<summary>查看关联时间线与原始证据</summary>

![模型自述“指令与任务范围冲突”事件的时间线证据下钻](docs/assets/trace-inspector-agent-hijack-evidence.png)

</details>

## 开发里程碑

- **V0 — 看见一次运行：** 采集、标准化、保存并可视化一次真实 Codex turn；
- **V1 — 诊断一次运行：** 持久化轨迹、重建操作区间，并生成带证据链接的诊断结果；
- **V2 — 比较两次运行：** 在有文档说明的比较策略下对齐轨迹，并定位首个可观察分歧。

## 证据模型

Trace Inspector 将主张区分为 `observed`、`model_reported` 和 `inferred`。后续每项诊断结果都应链接回可检查的证据。详见 [docs/evidence-model.md](docs/evidence-model.md)。

## 隐私与安全

原始轨迹可能包含提示词、文件路径、命令输出、diff 和其他本地敏感数据。本地轨迹、数据库、日志和环境文件均通过 `.gitignore` 排除。仓库只会提交合成 fixture 或经过人工脱敏的 fixture。

## 本地开发

环境要求：Node.js 22+、已安装并完成认证的 Codex CLI，以及一个允许被记录轮次检查的本地 checkout。

```bash
npm install
npm run typecheck
npm test
npm run demo:fixture
npm run view:demo
npm run view:agent-hijack-demo
npm run compare:demo
npm run eval:golden
npm run prepare:memory-case -- M1
npm run record:memory-case -- M1 R1
npm run preflight:memory-case
npm run case-study:memory
npm run analyze:memory-case
npm run preflight:agent-hijack-mvp
npm run case-study:agent-hijack-mvp
npm run analyze:agent-hijack-mvp
npm run record -- "Reply with exactly TRACE_INSPECTOR_SMOKE_OK. Do not run commands, use tools, or edit files."
npm run view -- latest
```

本地轨迹会写入 `.trace-inspector/traces/`。由于其中可能包含提示词、路径、命令输出或代码，该目录会被 Git 忽略。

## 项目状态

V0 的 collector-to-viewer 流程与带证据链接的 V1 核心均已实现。回放过程会重建派生操作区间、写入 `spans.jsonl`，并将确定性诊断写入 `findings.jsonl`。目前共有 34 项测试，覆盖事件标准化、操作区间重建、轨迹比较、fixture 隐私、隔离的 memory case 准备与记录，以及自动 memory case 投影和证据层级边界。一次执行无害失败命令 `false` 的真实 Codex 运行产生了一条可观察的失败诊断，并链接至对应的开始和完成事件。中断与未完成诊断目前仅通过合成测试验证，尚未作为真实运行演示结果。可通过 `npm run view:demo` 打开公开合成 fixture；README 截图展示的是该可复现轨迹，而非私有本地数据。

V2 核心会写入版本化的 `diff.json`，保留 intervention manifest，将仓库中的一组成功/失败轨迹对齐为七行，并在 alignment index 2 定位到构造的输出变化。测试覆盖对事件 ID、实体 ID、时间戳、原始引用和配置 workspace root 等无害变化的忽略逻辑。`v2-default` `0.2.0` 策略会统计最优对齐路径，在存在并列最优解时标记歧义，并通过不报告首个分歧来避免把确定性 tie-break 误当成真实结论。仓库内八组 golden pair 已全部通过。这是一个有明确边界的本地轨迹比较系统，而不是语义或因果层面的轨迹裁判。

实现顺序记录在 [TRACE_INSPECTOR_GUIDANCE_BOOK.md](TRACE_INSPECTOR_GUIDANCE_BOOK.md) 中。
