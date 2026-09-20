---
title: llama.cpp 参数怎么选：先算显存，再谈命令
published: 2026-09-16
description: 模型是否跑得动、速度是否正常、上下文能开多长，都可以从带宽和 KV Cache 的约束推出来。
tags: [llama.cpp, 推理部署, KV Cache, 性能]
category: 推理部署
series: 推理部署实验
seriesOrder: 2
metrics:
  - value: 33 tok/s
    label: 27B 实测
  - value: 128K
    label: 上下文实验
draft: false
lang: zh_CN
---

> 目的：从「显存带宽」和「显存容量」两条硬约束出发，把 llama-server 每个参数推出来，
> 而不是背参数表。速度 / 显存数字均来自本机实测日志或公开实测，推算值单独标注。
>
> 硬件：魔改 RTX 2080 Ti 22GB（Turing / SM75，22528 MiB，616 GB/s）
> 相关：[单卡 22GB 推理实验](/posts/22gb单卡推理实验记录/)（同卡的 vLLM 路线）

## 三条硬约束

所有参数都是这三条约束逼出来的。先记住约束，参数自己能推。

### 约束一：decode 是带宽瓶颈，不是算力瓶颈

生成第 N 个 token 时，模型要把**全部权重**从显存读进计算单元一遍。注意是全部——不管你这次只生成一个字还是一百个字，权重都得完整走一趟。

2080 Ti 的带宽是 616 GB/s，算力有 4352 个 CUDA 核心。推理时核心大部分时间在等数据，所以决定速度的是带宽而不是算力。

这条约束直接推出：**权重文件越小，读得越快，生成越快**。量化之所以能提速，不是因为计算变简单了（其实解压还要额外算），而是因为要搬运的数据变少了。

理论天花板 = 带宽 ÷ 权重大小。实测通常能跑到理论值的 75%~80%，剩下的损耗在激活值、采样、kernel 启动这些杂项上。

| 模型 / 量化 | 权重 | 理论天花板 | 本机实测 |
| --- | --- | --- | --- |
| Qwen3.8-27B UD-IQ4_XS | 14.4 GB | ~43 tok/s | **33 tok/s**（77%） |
| Qwen3.8-27B Q4_K_P | 17.92 GB | ~34 tok/s | 32 tok/s（94%） |
| Qwen3.6-27B Q4_K_M | 16.8 GB | ~37 tok/s | 22 tok/s（59%，见踩坑） |

:::tip
**既然量化能提速，为什么不一直往低比特压？**

量化是把权重从 16-bit 压成 4-bit、3-bit，本质是**有损压缩**。
压得越狠，权重越失真，模型的"概率分布"越偏离原始形状。
低于 4-bit 之后，失真开始盖过加速收益：文件是小了，但输出开始变笨、变啰嗦、出现事实错误。
所以 4-bit 是甜点区，3-bit 是"为了塞进去而妥协"。
:::


### 约束二：显存是硬墙，而且溢出不报错

GPU 上必须同时装下三样东西：权重 + KV cache + 计算缓冲。任何一个装不下，整体就崩。

麻烦的是 llama.cpp 遇到显存不够时**不报 OOM**——它会把溢出的层悄悄丢到 CPU 内存里继续跑。程序不崩，但速度掉到个位数，内存吃满。这比直接报错难查得多。

这条约束推出：启动前必须手算显存账，不能指望程序告诉你。

账怎么算：

```
总显存 ≈ 权重大小 + KV cache + 1.5~2.5 GB 固定开销
```

固定开销这部分包含 CUDA context、compute buffer、MTP draft 状态、Windows WDDM 保留。实测过几次，在 22GB 卡上稳定落在 1.9~2.6 GB，**调 batch 参数只能省出 0.3 GB，别在这上面花时间**。

反过来，这条约束还能当诊断工具用：如果实际显存占用 > 权重 + KV，说明全都装进 GPU 了；如果明显小于这个数，就是有层被赶到 CPU 了。

### 约束三：注意力必须记住历史，KV cache 随上下文线性增长

模型生成一个 token 时，要"回头看"前面所有 token。回头看需要之前算过的 Key 和 Value 矩阵，这些缓存起来就是 KV cache。

它的大小 = 每 token 成本 × 上下文长度，线性增长。

Qwen3.8-27B 的每 token 成本是 **64 KB（f16 精度）**，算法：

```
16 层全注意力 × 2(K 和 V) × 4 个 KV head × 256 head_dim × 2 bytes
= 65,536 bytes = 64 KB
```

为什么只有 16 层？因为 Qwen3.6 / 3.8 是**混合架构**：64 层里 48 层是 Gated DeltaNet（线性注意力，用固定大小的递归状态，不存 KV），只有 16 层是传统全注意力。

交叉验证：同架构的 Qwen3.5-9B（head_dim 128）实测每 token 32.3 KB，正好是一半——因为 head_dim 减半。两条数据对得上，说明这个算法可信。

| 上下文 | f16 | q8_0 | q4_0 |
| --- | --- | --- | --- |
| 32K | 2.0 GB | 1.0 GB | 0.5 GB |
| 65K | 4.1 GB | 2.0 GB | 1.0 GB |
| 128K | 8.0 GB | 4.0 GB | 2.0 GB |

:::tip
**线性注意力这么省，为什么不全用线性注意力？**

线性注意力把历史压缩成一个**固定大小的递归状态**。压缩是有损的。
它擅长"整体把握长文本的大意"，但精确检索"第 3 万字里出现过的那个名字"时会丢。
混合架构的取舍逻辑：48 层线性负责廉价地扫长文本，16 层全注意力负责精确检索。
3:1 的比例是训练时定死的，推理时改不了。

这也是为什么 Qwen3.8-27B 的 KV cache 只有同规模传统模型的四分之一——
22GB 的卡能开 128K 上下文，全靠这个架构。
:::


## 参数逐条：从约束往下推

### -m / -ngl：权重放哪

`-ngl 99` 表示把所有层卸载到 GPU。数字大于实际层数即可，目的是**强制全卸载**，不让 llama.cpp 自作主张"优化"成部分 CPU 推理。

### -c / -ctk / -ctv：上下文与 KV 精度

`-c` 设上下文长度，直接乘上每 token 成本就是 KV 占用。

`-ctk` / `-ctv` 设 K/V 缓存的量化精度（f16 / q8_0 / q4_0）。降精度能省显存，代价是长上下文的保真度。

:::tip
**KV 能量化，为什么权重不也往死里压？**

两者的容错度完全不同。权重的量化误差会被后续所有层的计算**放大传播**，
所以权重压到 4-bit 以下就开始出问题。
KV cache 存的是"历史 token 的特征"，注意力只用它算相似度权重，
而且有 softmax 做归一化，对精度没那么敏感。
所以 KV 压到 q4_0 通常还能用——社区实测 128K 配 q4_0 生成 13K token 的代码
依然能保持结构一致性（ai-muninn，同款 22GB 卡）。

但要清楚这是取舍，不是白拿：KV 精度减半，长对话后期"记错细节"的概率会上升。
:::


`-np` 是并行序列数，每个 slot 一份独立 KV cache。单用户必须设 1，设成 4 就是四份 KV，很多人内存爆掉找不到原因就是这里。

### --spec-type draft-mtp：投机解码

前面说 decode 每生成一个 token 要把权重读一遍。那能不能读一遍权重、多生成几个 token？

能，办法是**投机解码**：让一个轻量 draft 头先猜 N 个 token，然后主模型一次性验证这 N 个。猜对了就白赚 N-1 次权重读取，猜错了就回退，损失一次验证的时间。

Qwen3.8 的 GGUF 里内嵌了 MTP（Multi-Token Prediction）头，训练时就带着，所以不用额外下载 draft 模型，直接 `--spec-type draft-mtp` 就能用。

相关参数：

| 参数 | 作用 | 本机实测 |
| --- | --- | --- |
| `--spec-draft-n-max 2` | 每次最多猜 2 个 | 33.0 tok/s，tg_3s 波动 31.7~34.2 |
| `--spec-draft-n-max 3` | 每次最多猜 3 个 | 32.7 tok/s，tg_3s 波动 29.6~38.1 |
| `--spec-draft-type-k/v f16` | draft 头的 KV 用 f16 | 与主模型 KV 精度无关，独立设置 |

n=3 均值没涨、方差翻倍，说明拐点在 2。猜得越多，猜错时浪费的也越多。

draft 的 KV 用 f16 几乎不花显存（draft 序列只有几个 token），但能让 draft 头看得更清楚，是白捡的优化。

### 采样参数：不只是文风，还影响速度

`--temp` 控制采样随机度，`--top-p` / `--top-k` / `--min-p` 控制候选集合裁剪，`--repeat-penalty` / `--presence-penalty` 控制重复抑制。

这里有个容易忽略的连锁反应：

:::tip
**降 temp 为什么会提速？它不是只改文风吗？**

只在**开着投机解码**时成立。
投机解码的验证环节是：draft 头按自己的分布采样出候选，主模型判断"我自己会不会也这么采样"。
温度越高，两边的分布都越随机、越难对上，接受率就掉；
温度降低，draft 和主模型的分布贴合，猜中的概率上升，接受率上去，等效速度就涨。

本机实测：同样配置下 temp 从 1.0 降到 0.7，速度从 26 → 33 tok/s（+27%）。
这个幅度比换量化还大。

注意：这是从机制推的归因，没有隔离变量单独验证过。
想坐实的话，把 temp 单独改回 1.0 跑一次就知道。
:::


`--presence-penalty` 惩罚已经出现过的 token，逼模型换新词。角色扮演场景建议 0.2~0.5 起步，太高（>1.0）会让用词变生硬。

### --jinja / --reasoning-format：模板与格式

`--jinja` 启用 GGUF 内嵌的 Jinja 聊天模板。**不加它，llama-server 走启发式解析器**，多轮对话和工具调用会出问题——表现是模型"失忆"或者不调工具自己瞎编。

`--reasoning-format deepseek` 指定思考块的解析格式。`--reasoning off` 关掉思考模式，省掉大量 token 预算。

## 本机实测命令

### Qwen3.8-27B（推荐，128K 上下文 / 33 tok/s）

模型：`Huihui-Qwen3.8-27B-abliterated-UD-IQ4_XS.gguf`（14.4 GB）

```powershell
D:\llama.cpp\llama-server.exe -m "D:\UnslothWork\models\Huihui-Qwen3.8-27B-abliterated-UD-IQ4_XS.gguf" -ngl 99 -c 131072 -np 1 -fa 1 -ctk q8_0 -ctv q8_0 --jinja --reasoning-format deepseek --reasoning off --spec-type draft-mtp --spec-draft-n-max 2 --spec-draft-type-k f16 --spec-draft-type-v f16 --temp 0.7 --top-p 0.80 --top-k 20 --min-p 0.0 --presence-penalty 0.5 --repeat-penalty 1.0 --metrics --port 8080
```

显存账：14.4（权重）+ 4.0（128K q8_0 KV）+ ~2.2（固定）≈ **20.6 GB**，余量约 1.6 GB。

### Qwen3.6-27B（已实测，65K 上下文 / 22 tok/s）

模型：`Qwen3.6-27B-Fable-Fus-711-UnHeretic-NM-DAU-NEO-MAX-NEO-MTP-Q4_K_M.gguf`（16.8 GB）

```powershell
D:\llama.cpp\llama-server.exe -m "D:\UnslothWork\models\Qwen3.6-27B-Fable-Fus-711-UnHeretic-NM-DAU-NEO-MAX-NEO-MTP-Q4_K_M.gguf" -ngl 99 -c 65536 -np 1 -fit off -fa 1 -ctk q4_0 -ctv q4_0 --spec-type draft-mtp --spec-draft-n-max 3 --spec-draft-p-min 0.75 --temp 1.0 --top-p 0.95 --top-k 64 --min-p 0.05 --repeat-penalty 1.1 --reasoning off --port 8080
```

实测 21 GB / 22 tok/s。带宽利用率只有 59%，明显偏低——怀疑是 Fable-Fus 这个 merge 破坏了 MTP 头的对齐，导致投机接受率暴跌。待验证：看日志里的 `llama_speculative: accepted X/Y tokens` 那行。

按 3.8 的经验，这版应该改 MTP n=2、temp 0.7、KV 升 q8_0。**但未实测，先别当结论用。**

## 调优全程数据

| 阶段 | 模型 / 配置 | 上下文 | 速度 |
| --- | --- | --- | --- |
| 起点 | 3.6 Fable-Fus Q4_K_M，MTP n=3，KV q4_0，temp 1.0 | 65K | 22 tok/s |
| 换模型 | 3.8 HauhauCS Q4_K_P，MTP n=2，KV q8_0，temp 1.0 | 32K | 32 tok/s |
| 换包 | 3.8 huihui UD-IQ4_XS，同上 | 128K | 26 tok/s |
| 融合版 | + temp 0.7 / top-p 0.80 / draft KV f16 / presence 0.5 | 128K | **33 tok/s** |
| 试 n=3 | 其余不变 | 128K | 32.7（方差翻倍，回退） |

最后一行是关键：**128K 上下文比 32K 时代还快**。参数调优的收益（26 → 33）超过了上下文翻四倍的代价。

## 踩坑记录

1. **参数改名频繁，别背旧命令**。llama.cpp 2026-08 之后废弃了一批：`--draft-max` → `--spec-draft-n-max`，`--spec-ngram-size-n` → `--spec-ngram-simple-size-n` / `--spec-ngram-map-k-size-n`。报错信息会提示新名字，照着改即可。
2. **ngram 投机在角色扮演场景无收益**。实测 ngram-simple 只有 15~20 tok/s，比 MTP 的 32 还慢。角色扮演的文本重复度没高到能"抄水"的程度。
3. **batch 参数是无效变量**。`-b 4096` vs `-b 3072` 只差 0.3 GB 显存、0 速度差异。默认 2048/512 就行。
4. **显存溢出不报错**。发现速度突然掉到个位数、内存吃满，第一时间查是不是有层被赶到 CPU 了。
5. **SillyTavern 的 Post-History Instructions 用 system role 会触发 Jinja 报错**（`System message must be at the beginning`）。这个字段别用。
6. **uncensored / abliterated 模型容易中英混杂**。根因是 abliteration 用的 refusal 数据集基本是英文的，在英文分布上拉伸权重时顺带污染了语言偏好。提示词是软约束，压不住权重层面的偏移。选型时看消融层数：消融层数越少、起始层越靠后，语言漂移越小（huihui UD 系列只消融 18~51 层，前 18 层完整保留）。

## 待办

- [ ] 验证 3.6 慢的原因：抓 `llama_speculative: accepted X/Y` 看接受率
- [ ] 隔离变量验证 temp 对速度的影响（temp 1.0 vs 0.7，其余不变）
- [ ] 长对话验收：聊 20~30 轮，看 huihui UD 系列是否还切英文
- [ ] 若仍切英文，上 logit_bias 方案（中文标点 +1.2~1.5 正向锚定，英文句首词 -3~-5 软压制）
