# 配套参考：SUD/PinK/COCOS CLI 迭代方向分析（ChatGPT 分享）

> - 来源：https://chatgpt.com/s/t_6a91542871c8819183548fbf7192edde（公开分享，作者 tool:web，模型 gpt-5-6-t-mini-mini，发布于 2026-08-28）
> - 抓取日期：2026-08-29（经本地代理；对话标题「梳理迭代方向」，正文 15,679 字符）
> - 用途：CCX 下一阶段（v1.0 路线）的外部对标参考——PinK/COCOS CLI 的演进与评分点
> - 核心要点速览：Cocos CLI 0.0.1-alpha.39 ⇄ PinK ≥0.0.1.33 版本绑定；PinK = Game IDE + Agent Host（长在 CLI 之上）；CLI = 能力编排层（MCP/Preview/Schema 全内）；无统一 Game IR（多 Domain Schema：Scene/Asset/Component/Build/Platform；理想 = Graph + Stable Identity + Schema + Commands + Transaction）；Agent Loop 骨架 DISCOVER→MUTATE→OBSERVE(Preview)→VALIDATE(Build/Test)→DELIVER(Platform)；Editor = Runtime Server（PR #874/#800/#877/#880）；评分差分最大项：Transaction Model ≈30%、Agent Verify/Repair ≈30%；护城河 = Game Semantic Layer；跨平台 = Game OS 底层能力。

---

好，我这一轮就不再停留在“战略猜测”层面，而是把 **2026-08-28 当前公开代码状态**往下解剖。先给你一个很重要的修正：\
\
 **Cocos CLI 现在已经推进到 `0.0.1-alpha.39`，并且它对 PinK 的最低依赖已经提升到 `=0.0.1.33`。**\
\
 这说明截至现在，PinK 与 Cocos CLI 已经不是“并行试验项目”，而是**直接绑定版本演进的两个部分**。citeturn115824view0turn824292view4\
\
我认为这比“PinK 有 MCP”本身重要得多。\
\
---\
\
# 一、先给你一张我现在认为最接近真实情况的图\
\
```text\
                         ┌──────────────────────┐\
                         │      LLM / Agent     │\
                         └──────────┬───────────┘\
                                    │\
                               MCP / Skills\
                                    │\
                                    ▼\
                         ┌──────────────────────┐\
                         │         PinK         │\
                         │                      │\
                         │ Editor + Agent + UX  │\
                         └──────────┬───────────┘\
                                    │\
                               APIs / Schema\
                                    │\
                                    ▼\
                         ┌──────────────────────┐\
                         │      COCOS CLI       │\
                         │                      │\
                         │ Scene / Asset / Build│\
                         │ Preview / Platform   │\
                         │ MCP Server           │\
                         └──────────┬───────────┘\
                                    │\
                         ┌──────────┴──────────┐\
                         ▼                     ▼\
                ┌────────────────┐    ┌─────────────────┐\
                │   COCOS 4      │    │  Platform/PAL   │\
                │    Engine      │    │  Plugins        │\
                │                │    │                 │\
                │ Runtime        │    │ Web/Mobile/...  │\
                │ Renderer       │    │ Build Adapters  │\
                │ Scene          │    │ SDK Integration │\
                └───────┬────────┘    └────────┬────────┘\
                        │                      │\
                        └──────────┬───────────┘\
                                   ▼\
                              Game Output\
                                   │\
                                   ▼\
                              OpenPaaS\
```\
\
**其中最关键的一点：PinK 已经处在 COCOS CLI 之上，而不是旁边。**\
\
当前 CLI 的 `package.json` 直接要求 `pink =0.0.1.33`，并且自身同时提供 MCP、Preview、Schema/DTS 生成、Asset DB、Build 等能力。citeturn115824view0turn824292view1turn824292view3\
\
---\
\
# 二、我现在最关注的是：`cocos-cli` 正在长成什么东西？\
\
从代码结构上看，它已经不是一个传统 CLI 了。\
\
当前 package 中已经有：\
\
```text\
packages/\
    asset-db\
    cc-module\
    engine\
```\
\
再加：\
\
```text\
workflow/\
e2e/\
docs/\
```\
\
它同时负责：\
\
- Engine 安装/编译\
- Asset DB\
- Scene bundle\
- Platform views\
- Build\
- Preview\
- MCP\
- DTS\
- Schema 生成\
\
citeturn115824view0turn824292view3\
\
这其实意味着：\
\
# **CLI 正在逐渐成为 Cocos 的“能力编排层”。**\
\
不是单纯：\
\
```bash\
cocos build\
```\
\
而是：\
\
```text\
CLI\
 ├── Engine\
 ├── Asset\
 ├── Scene\
 ├── Build\
 ├── Preview\
 ├── Platform\
 └── MCP\
```\
\
这和传统 Creator 是非常不同的。\
\
---\
\
# 三、一个特别重要的信号：他们已经有 Schema 自动生成链路\
\
`package.json` 中明确存在：\
\
```text\
generate:mcp-types\
generate:dts\
generate:dts:ci\
generate-schema\
```\
\
并依赖：\
\
```text\
@modelcontextprotocol/sdk\
zod\
zod-to-json-schema\
zod-to-ts\
typescript-json-schema\
```\
\
citeturn115824view0turn824292view1turn824292view2\
\
这说明现在的思路已经很接近：\
\
```text\
TypeScript Definition\
        ↓\
Schema\
        ↓\
JSON Schema\
        ↓\
MCP Type\
        ↓\
Agent\
```\
\
这其实是非常正确的 AI Toolchain 设计。\
\
因为 AI 最怕的是：\
\
```text\
“这个接口可以传什么？”\
```\
\
而 Schema 能直接告诉它：\
\
```text\
name: string\
position: Vec3\
platform: enum\
texture: AssetRef\
```\
\
这样 Agent 才能稳定调用。\
\
---\
\
# 四、这也意味着我之前提出的“Game IR”可以进一步细化\
\
我之前说：\
\
 SUD 可能在构建 Game IR。\
\
现在看代码，我会把它改成：\
\
## **目前正在形成的不是一个单一 Game IR，而是“多种 Domain Schema”。**\
\
目前至少已经能看到：\
\
```text\
Scene Schema\
Asset Schema\
Component Schema\
Build Schema\
Platform Schema\
```\
\
其中 Asset 和 Build 尤其明显：\
\
- Asset 有 property schema；\
- asset userData；\
- serialized enum schema；\
- Build options 从 `any` 改成 Zod object/passthrough；\
- Platform 有自己的 Build Schema。citeturn824292view0\
\
因此当前状态更像：\
\
```text\
                    Domain Schemas\
                         │\
       ┌─────────────────┼─────────────────┐\
       │                 │                 │\
     Scene             Asset             Build\
       │                 │                 │\
       └─────────────────┼─────────────────┘\
                         │\
                     MCP / CLI\
```\
\
而真正的：\
\
```text\
Unified Game IR\
```\
\
还没完全出现。\
\
---\
\
# 五、我认为“统一 Game IR”最后应该不是 JSON\
\
这是一个很容易走歪的地方。\
\
我不会设计：\
\
```json\
{\
  \"scene\": {},\
  \"assets\": {},\
  \"build\": {}\
}\
```\
\
然后把所有东西塞进去。\
\
我会设计成：\
\
# **Graph + Stable Identity + Schema + Commands**\
\
也就是：\
\
```text\
GameProject\
    │\
    ├── Entity\
    │     ├── Component\
    │     ├── AssetRef\
    │     └── PrefabRef\
    │\
    ├── Asset\
    │     ├── dependencies\
    │     └── imported-from\
    │\
    ├── Scene\
    │\
    └── BuildTarget\
```\
\
所有对象都有稳定 ID。\
\
然后操作走：\
\
```text\
Command\
  ↓\
Transaction\
  ↓\
State Change\
  ↓\
Event\
```\
\
这是我认为 **SUD 现在还差得最远、但最应该补上的东西**。\
\
---\
\
# 六、为什么我要特别强调 Transaction？\
\
因为 AI 改项目和人改项目最大的不同，是：\
\
 **AI 可以一秒钟改几百个对象。**\
\
比如：\
\
```text\
把所有敌人的移动速度 ×1.2\
```\
\
人：\
\
```text\
手动几十个 Inspector\
```\
\
Agent：\
\
```text\
query()\
  ↓\
1000 entities\
  ↓\
batch mutate\
```\
\
如果没有 Transaction：\
\
```text\
第 317 个失败\
```\
\
整个项目可能进入半修改状态。\
\
正确设计应该是：\
\
```text\
BEGIN\
  ↓\
1000 mutations\
  ↓\
validate\
  ↓\
COMMIT\
```\
\
失败：\
\
```text\
ROLLBACK\
```\
\
所以现在的：\
\
 Scene Undo/Redo、ServiceEvents、change events\
\
我会把它视为 **Agent 安全机制的雏形**，不只是 Editor UX。Cocos CLI 的近期 changelog 已经明确有 scene undo/redo、change-node/event、gizmo begin/end 通过 ServiceEvents 广播等工作。citeturn824292view0\
\
---\
\
# 七、另一个特别有价值的发现：Preview 也在服务化\
\
CLI 现在直接有：\
\
```text\
start:preview\
```\
\
并带：\
\
```text\
--scene-editor\
```\
\
citeturn115824view0\
\
同时 Alpha 34 已经加入：\
\
 `PreviewService with standalone resource preview page`\
\
citeturn824292view0\
\
这非常重要。\
\
因为 Agent 要完成闭环：\
\
```text\
修改\
 ↓\
观察\
 ↓\
判断\
```\
\
如果：\
\
```text\
preview\
```\
\
必须启动整个 Editor GUI：\
\
Agent 就很难工作。\
\
而现在：\
\
```text\
Asset\
 ↓\
PreviewService\
 ↓\
Screenshot / Inspect\
```\
\
这就是一个真正的 Tool API。\
\
---\
\
# 八、所以 Agent Loop 现在已经出现骨架了\
\
我现在把 Cocos/PinK 的现状定义成：\
\
```text\
DISCOVER\
   ↓\
Schema / Query\
   ↓\
MUTATE\
   ↓\
Scene / Asset API\
   ↓\
OBSERVE\
   ↓\
Preview\
   ↓\
VALIDATE\
   ↓\
Build / Test\
   ↓\
DELIVER\
   ↓\
Platform\
```\
\
这些节点基本都有公开代码痕迹。\
\
尤其：\
\
```text\
cocos start-mcp-server\
```\
\
已经是标准 CLI 命令。citeturn297398search4\
\
---\
\
# 九、而最新 PR 更让我确信“Editor 正在变成 Runtime Server”\
\
截至目前，最重要的几个 PR：\
\
```text\
#874\
feat(scene): route Scene MCP commands to PinK editor runtimes\
\
#800\
[break] refactor(scene): lib service interface\
per-service access, drop browser globals\
\
#877\
fix(build): validate platform build options at CLI/MCP entry\
\
#880\
fix(build): validate build options at CLI/MCP entry\
```\
\
citeturn551065search0\
\
把它们连起来看：\
\
```text\
MCP\
 ↓\
Scene command\
 ↓\
PinK editor runtime\
```\
\
同时：\
\
```text\
CLI\
 ↓\
Service\
 ↓\
Platform schema\
 ↓\
Validation\
```\
\
这已经很接近：\
\
# **Editor Runtime = Server**\
\
而 GUI：\
\
# **PinK UI = Client**\
\
---\
\
# 十、这个架构一旦坐实，未来可以非常灵活\
\
比如：\
\
```text\
PinK Desktop\
       │\
       ▼\
Scene Runtime\
       ▲\
       │\
   ┌───┼────┐\
   │   │    │\
  MCP CLI  Test\
```\
\
甚至可以：\
\
```text\
Browser\
VS Code\
Custom Editor\
AI Agent\
CI\
Remote Build\
```\
\
都连接同一个 Engine/Editor Service。\
\
这是我认为 Cocos 架构真正有机会超越传统 Creator 的地方。\
\
---\
\
# 十一、但是这里出现一个危险信号\
\
目前 `cocos-cli` 仍然依赖：\
\
```text\
@cocos/asset-db\
@cocos/ccbuild\
@cocos/lib-programming\
@cocos/module-system\
cc\
```\
\
citeturn824292view3\
\
这意味着：\
\
 **它现在本质上还是在“抽取 Creator 的核心能力”。**\
\
并没有完全摆脱旧技术遗产。\
\
换句话说：\
\
```text\
旧 Creator\
   ↓\
抽服务\
   ↓\
CLI\
   ↓\
PinK\
```\
\
目前依然成立。\
\
所以如果你问：\
\
 “SUD 有没有已经做出一个干净的下一代 Engine Platform？”\
\
我的回答还是：\
\
# **没有。**\
\
至少从公开代码看，还没有。\
\
---\
\
# 十二、这也是为什么我不建议现在重写全部 Engine\
\
现在 Engine 层：\
\
```text\
COCOS 4\
```\
\
依然包含：\
\
- TS\
- C++\
- PAL\
- Scene\
- Renderer\
- Native bindings\
- 传统 Creator 兼容逻辑\
\
例如 `cc.config.json` 仍然包含 HTML5、Native、MiniGame 等 build-time overrides，以及 Spine、PAL 等大量兼容逻辑。citeturn297398search2\
\
因此：\
\
 **SUD 目前真正重构得最激进的是 Toolchain，而不是 Runtime。**\
\
这点非常重要。\
\
---\
\
# 十三、如果你让我评价现在 SUD 的“重构完成度”\
\
我会这么画：\
\
```text\
                完成度\
\
AI / MCP                 ████████░░ 80%\
CLI                      ████████░░ 80%\
Service 化               ███████░░░ 70%\
Schema 化                ███████░░░ 70%\
Platform Plugin          ████████░░ 80%\
Preview/Headless         ███████░░░ 70%\
\
统一 Game Model          █████░░░░░ 50%\
Transaction Model        ███░░░░░░░ 30%\
Agent Planning           ████░░░░░░ 40%\
Agent Verify/Repair      ███░░░░░░░ 30%\
\
Engine Kernel             ██████░░░░ 60%\
Renderer                  ██████░░░░ 60%\
Editor UX                 ██████░░░░ 60%\
```\
\
这些是我的架构评分，不是官方指标。\
\
---\
\
# 十四、这也回答了一个你之前的问题：\
\
## “PinK 是不是只是 Cursor for Cocos？”\
\
现在我会明确说：\
\
# **不是。**\
\
如果只是 Cursor，你不会看到这么多：\
\
```text\
Asset Schema\
Build Schema\
Platform Schema\
Scene Service\
Component Service\
Preview Service\
Builder Plugin\
MCP\
Undo/Redo\
Editor Runtime\
```\
\
而这些正是 PinK + CLI 当前公开迭代的主体。citeturn824292view0turn551065search0\
\
所以更准确的定义是：\
\
 **PinK = Game IDE + Agent Host**\
\
 **COCOS CLI = Game Toolchain / Control Plane**\
\
 **COCOS = Runtime**\
\
 **Platform = Distribution substrate**\
\
---\
\
# 十五、现在让我最感兴趣的其实是“Game State”\
\
因为 AI 不光需要操作项目，还需要知道：\
\
 **“现在这个游戏是什么状态？”**\
\
例如：\
\
```text\
Scene State\
Asset State\
Build State\
Runtime State\
Test State\
```\
\
我会设计一个：\
\
# `Game State Graph`\
\
例如：\
\
```text\
Project\
 ├── Scene A\
 │    ├── Player\
 │    ├── Enemy[]\
 │    └── UI\
 │\
 ├── Asset Graph\
 │\
 ├── Build Graph\
 │\
 └── Runtime Session\
      ├── FPS\
      ├── Errors\
      ├── Logs\
      └── Screenshots\
```\
\
Agent 每次行动：\
\
```text\
read state\
→ reason\
→ act\
→ observe delta\
→ verify\
```\
\
而不是只靠 LLM 自己“猜”。\
\
---\
\
# 十六、这会产生真正的“AI-native Engine”\
\
例如：\
\
用户：\
\
 把这个 Boss 的攻击范围扩大 30%，然后确保 Web 和 Android 都保持 60 FPS。\
\
Agent：\
\
```text\
query(Boss)\
query(AttackComponent.schema)\
set(radius *= 1.3)\
build(web)\
benchmark()\
build(android)\
benchmark()\
if fps  60:\
    inspect()\
    optimize()\
    rebuild()\
```\
\
**这才是我认为 PinK 最终应该做到的东西。**\
\
而目前 Cocos 已经把：\
\
```text\
query\
set\
build\
preview\
platform\
```\
\
这些积木逐步摆出来了。citeturn810220search0turn297398search4\
\
---\
\
# 十七、接下来真正的技术难题反而变成 AI\
\
这一点我认为非常值得注意：\
\
 **Cocos 的下一阶段不是“增加更多工具”，而是“让 Agent 真的会用这些工具”。**\
\
现在：\
\
```text\
Tool Calling\
```\
\
已经有了。\
\
下一阶段必须：\
\
```text\
Task Planning\
      ↓\
Dependency Reasoning\
      ↓\
Execution\
      ↓\
Observation\
      ↓\
Validation\
      ↓\
Repair\
```\
\
否则：\
\
```text\
200 个 Tool\
```\
\
不一定比：\
\
```text\
20 个高质量 Tool\
```\
\
更好。\
\
---\
\
# 十八、因此我对 PinK 2027 的预测现在非常具体\
\
如果我是架构负责人，我会做：\
\
### 第一阶段：Game Query\
\
```text\
query_scene\
query_asset\
query_component\
query_dependency\
query_build\
query_runtime\
```\
\
### 第二阶段：Game Mutation\
\
```text\
create\
update\
delete\
move\
bind\
replace\
```\
\
### 第三阶段：Transaction\
\
```text\
begin\
commit\
rollback\
undo\
redo\
```\
\
### 第四阶段：Observation\
\
```text\
preview\
screenshot\
log\
performance\
runtime state\
```\
\
### 第五阶段：Validation\
\
```text\
schema validation\
asset dependency validation\
build validation\
runtime validation\
```\
\
### 第六阶段：Agent\
\
```text\
goal\
plan\
execute\
observe\
repair\
```\
\
这才形成闭环。\
\
---\
\
# 十九、而 Cocos 4 本身，我反而希望它不要再继续变得“Editor-like”\
\
这是我现在最坚定的一个判断。\
\
Cocos 4 应该越来越像：\
\
```text\
COCOS Runtime\
\
World\
Entity\
Component\
System\
\
Render\
Asset\
Animation\
Physics\
Audio\
Network\
```\
\
而不应该：\
\
```text\
Engine\
  ├── Editor UI\
  ├── Hierarchy\
  ├── Inspector\
  ├── Toolbar\
  └── Project Manager\
```\
\
这些都应该属于 PinK / Extension。\
\
这与官方“Editor 核心能力逐步 Headless + CLI 化”的方向完全一致。citeturn297398search1\
\
---\
\
# 二十、所以如果让我现在重新设计这家公司，我会做一个更激进的边界\
\
```text\
┌──────────────────────────────────────┐\
│              PinK                    │\
│                                      │\
│  Human UI + AI + Workflow            │\
└─────────────────┬────────────────────┘\
                  │\
                  │\
┌─────────────────▼────────────────────┐\
│         Game Semantic Layer          │\
│                                      │\
│ Scene / Asset / Entity / Build       │\
│ Schema / Command / Event / State     │\
└─────────────────┬────────────────────┘\
                  │\
                  │\
┌─────────────────▼────────────────────┐\
│            COCOS Runtime             │\
│                                      │\
│ ECS / Render / Physics / Audio       │\
│ Animation / VFX / Network            │\
└─────────────────┬────────────────────┘\
                  │\
┌─────────────────▼────────────────────┐\
│         Platform Runtime             │\
│                                      │\
│ Web / Android / iOS / MiniGame / PC  │\
└──────────────────────────────────────┘\
```\
\
**注意我在这里把 Game Semantic Layer 单独抽出来了。**\
\
这层我现在认为是 SUD 当前架构里**最值得关注、也是最可能成为真正技术护城河的空白位**。\
\
---\
\
# 二十一、关于“2026～2028 SUD 最终会不会做到”，我的判断\
\
### 2026 下半年\
\
非常明确：\
\
 **Service 化 / CLI / MCP / Platform Plugin / PinK 基础能力。**\
\
目前正在发生，而且近期 PR 速度很快。citeturn551065search0turn824292view0\
\
### 2027\
\
我认为真正应该出现：\
\
 **统一 Game Schema + Transaction + Agent Planning。**\
\
如果这一阶段没发生，我会下调对 SUD 的长期评价。\
\
### 2028\
\
真正的分水岭：\
\
 **Goal → Game → Build → Verify → Repair 是否能稳定闭环。**\
\
如果做到：\
\
# 我会认为 SUD 已经进入一个新的产品类别。\
\
---\
\
# 二十二、我现在给 SUD 一个非常简单的“路线完成公式”\
\
```text\
现在：\
\
Cocos Engine\
    +\
Creator legacy\
    ↓\
CLI / Service\
    +\
PinK\
    +\
MCP\
```\
\
最终应该变成：\
\
```text\
Game Semantic Layer\
         ↓\
Agent\
         ↓\
COCOS Runtime\
         ↓\
Platform\
         ↓\
Distribution\
         ↓\
Telemetry\
         ↓\
Agent\
```\
\
这才是真正的飞轮。\
\
---\
\
# 二十三、最后说一个我认为非常关键、甚至可能改变我们最初判断的东西\
\
**SUD 现在没有必要把所有 Engine 都做得像 Unreal。**\
\
因为一旦 Game Semantic Layer 成立：\
\
```text\
Semantic Layer\
      ↓\
COCOS\
```\
\
以后甚至理论上可以：\
\
```text\
Semantic Layer\
      ├── COCOS\
      ├── Unity\
      ├── Laya\
      └── Other Runtime\
```\
\
而事实上 SUD 的 OpenPaaS Runtime 已经公开支持 Cocos、Unity、LayaAir。citeturn810220search3\
\
所以我现在对 SUD 的终局有一个更大的猜测：\
\
 **COCOS 不一定是 SUD 的“全部”，甚至不一定需要成为“全球第一 Engine”。**\
\
 **COCOS 更可能成为 SUD 自己控制最深的一条 Runtime；真正的上层资产是 Game Semantic Layer + PinK + Distribution。**\
\
如果这个判断成立，那么你最开始说的：\
\
 **“Cocos 最大优势其实是跨平台。”**\
\
我现在会把它升级成：\
\
# **“跨平台不是 Cocos 的一个 Feature，而是 SUD 整个 Game OS 的底层能力。”**\
\
而目前 Cocos CLI 最新已经到 `alpha.39`，并要求 PinK 至少 `0.0.1.33`；Scene MCP 正在直接路由到 PinK editor runtime，Scene/Asset/Build/Platform 又在持续 Schema 化。这个组合已经足够让我认为：**SUD 的“Game OS”方向不是我脑补出来的，而是已经在源码结构中出现了，只是还没有完成最后的统一。** citeturn115824view0turn551065search0turn824292view0\
\
---\
\
接下来如果继续往源码级走，我建议我们干一件更“硬核”的事：\
\
**直接建立一张 `COCOS CLI 当前真实 Service/API 图`。**\
\
把现在已经存在的：\
\
`SceneService / ComponentService / SelectionService / AssetService / PreviewService / Builder / Platform Plugin / MCP`\
\
逐个拆出来，标出它们的**输入、输出、Schema、状态、事件、依赖谁**，然后我再根据这张图判断：\
\
 **它距离真正的 Game IR / Game Semantic Layer，到底还差哪 20% 最关键的东西。**\
\
这一步做完以后，我们甚至可以反过来设计一版**我心目中的“下一代 Cocos Engine/PinK 架构”接口规范**，包括 TypeScript、C#、MCP 三套 API 应该如何从同一个 Schema 自动生成。\
\
---\
\
If you want, I can:\
\
- 继续建立COCOS CLI当前真实Service/API图以分析架构差距\
- 细化2027年PinK统一Game Schema与Transaction设计方案\
- 展望未来AI Agent完整闭环能力实现路线",