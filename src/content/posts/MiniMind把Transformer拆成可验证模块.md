---
title: 从一个 Token 开始，拆开理解 Transformer
published: 2026-09-12
description: 参考 MiniMind 的结构，把 Decoder-only Transformer 拆成可单独理解、组装和验证的模块。
tags: [MiniMind, Transformer, PyTorch, 模型训练]
category: 模型训练
featured: true
featuredOrder: 3
metrics:
  - value: "19"
    label: 核心模块测试
links:
  - label: GitHub
    url: https://github.com/yyylegend/minimind-labs
draft: false
lang: zh_CN
---

:::important
**学习方式**
这篇笔记只讲一条主线：一句话如何经过 Transformer，最后预测下一个词。先看例子，再看公式，最后对照源码。
:::


关联路线：MiniMind 三天速通路线

当前组装记录：MiniMind 从零组装教学笔记

## 1. 先跟着一句话走一遍

假设输入是：

```text
我 喜欢 猫
```

模型大致这样处理：

```text
文字
→ Token ID
→ 向量
→ Attention：互相看一看
→ FFN：每个 Token 自己加工
→ 重复很多层
→ 预测下一个 Token
```

先不要急着记住所有名词。我们只跟踪其中一个 Token，比如“猫”。
接下来会进入Transformer的关键流水线。

## 2. “猫”先变成一个向量

Tokenizer 先把文字变成编号：

```text
我     喜欢     猫
12     58       91       # 这里只是示意
```

编号本身没有语义。Embedding 会把 `91` 查成一个向量：

```text
91 → [0.2, -0.7, 0.4, ...]
```

真实 MiniMind 中，一个序列的形状类似：

```text
[batch, seq_len, hidden_size]
```

例如：

```text
[1, 3, 768]
```

意思是：1 句话，3 个 Token，每个 Token 用 768 个数表示。

## 3. RMSNorm：先把数值整理稳定

如果每层都把数值放大或缩小，深层网络可能出现梯度爆炸或消失。

RMSNorm 做的事情很简单：

```text
看看这个向量整体有多大
→ 把尺度调整到比较稳定
→ 保留方向和主要信息
```

公式：

$$
\operatorname{RMSNorm}(x)=\gamma\frac{x}{\sqrt{\operatorname{mean}(x^2)+\epsilon}}
$$

代码位置：

```text
model/model_minimind.py → RMSNorm
```

## 4. Attention：“猫”去看哪些词？

处理“猫”时，它可能需要参考“喜欢”和“我”。Attention 就是让 Token 互相查看。

每个 Token 会产生三个向量：

```text
Q：我想找什么？
K：我这里有什么信息？
V：真正要传递的内容是什么？
```

类比图书馆：

```text
Q：我要查“谁喜欢谁”？
K：每本书的目录标签
V：书里面的具体内容
```

核心过程：

```text
Q · K
→ 算相关程度
→ softmax 变成权重
→ 按权重合并 V
```

公式：

$$
\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\left(\frac{QK^T}{\sqrt{d_{head}}}+M\right)V
$$

`M` 是因果 Mask，保证模型不能偷看未来 Token。

代码位置：

```text
model/model_minimind.py → Attention.forward
```

## 5. RoPE：Attention 怎么知道顺序？

如果没有位置编码，模型可能分不清：

```text
我喜欢猫
猫喜欢我
```

RoPE 的直觉是：

```text
位置 0：旋转 0°
位置 1：旋转 θ°
位置 2：旋转 2θ°
```

它把 **Attention 里的 Q、K** 的二维小块按位置旋转。注意：不是直接旋转最开始的隐藏向量，而是先经过 Q/K 投影、拆成多个 head 后，再旋转每个 head 内部的向量。V 不旋转。

一个 token 的隐藏向量大致经历：

```text
h → Q/K/V → 拆成多个 head → 只对 Q/K 做 RoPE → QKᵀ
```

高维向量经过多个不同速度的旋转，投影到低维图上可能像螺旋，但它不是一条普通的三维螺旋线。

代码位置：

```text
model/model_minimind.py
├── precompute_freqs_cis
└── apply_rotary_pos_emb
```

## 6. GQA：为什么 KV Cache 可以变小？

MHA 中每个 Q 头都有自己的 K/V：

```text
Q0 → K0,V0
Q1 → K1,V1
Q2 → K2,V2
...
```

GQA 让多个 Q 头共享 K/V：

```text
Q0、Q1 → K0,V0
Q2、Q3 → K1,V1
Q4、Q5 → K2,V2
Q6、Q7 → K3,V3
```

当前 MiniMind 主仓库默认是：

```text
Q 头：8
KV 头：4
```

所以每 2 个 Q 头共享 1 组 KV。这样生成长文本时，需要保存的 KV Cache 更少。这里的“共享”指多个 Q 头使用同一组 K/V，不是 Q 头互相共享。

代码位置：

```text
model/model_minimind.py → repeat_kv
```

## 7. FFN / SwiGLU：切菜、炒菜、装盘

Attention 让“猫”看到了上下文，但还需要对这个上下文向量进行加工。这个工作交给 FFN。

### 7.1 FFN 进入什么？出去什么？

进入的不是 Token ID，而是 Attention 之后的向量：

```text
[batch, seq_len, hidden_size]
```

出去的形状不变：

```text
[batch, seq_len, hidden_size]
```

这样才能和原输入做残差相加。

### 7.2 切菜：扩张

```text
hidden_size → intermediate_size
```

类比：

```text
原始食材：768 维 Token 向量
切菜备料：把它展开成更多中间特征
```

空间变大后，模型更容易把复杂模式拆开。

### 7.3 炒菜：门控加工

SwiGLU 有三组投影：

```python
gate = gate_proj(x)
up = up_proj(x)
hidden = SiLU(gate) * up
```

类比：

```text
up：准备好的候选食材
gate：火候和调味控制
相乘：决定哪些特征多放，哪些特征少放
```

它不是一个硬开关，而是连续地控制特征通过多少。

### 7.4 装盘：压缩

```python
output = down_proj(hidden)
```

类比：

```text
高维加工结果
→ 整理成一道菜
→ 装回 hidden_size 维
```

所以完整过程是：

```text
切菜：扩张
炒菜：SiLU + 门控相乘
装盘：压缩
```

代码位置：

```text
model/model_minimind.py → FeedForward.forward
```

### 7.5 Attention 和 FFN 的分工

```text
Attention：Token 之间交换信息
FFN：每个 Token 独立加工自己的向量
```

“猫”经过 Attention 后已经包含上下文；FFN 再对这个上下文进行非线性处理。

## 8. 一个 Block 如何连起来？

可以先记住这两行：

$$
h_1=h+\operatorname{Attention}(\operatorname{RMSNorm}(h))
$$

$$
h_2=h_1+\operatorname{FFN}(\operatorname{RMSNorm}(h_1))
$$

大白话：

```text
原向量
→ 归一化
→ Attention 交流
→ 加回原向量
→ 归一化
→ FFN 独立加工
→ 再加回去
```

这就是一个 Transformer Block。多个 Block 叠起来，就是完整模型的主体。

## 9. 最后怎么变成预测？

最后一层输出仍然是隐藏向量：

```text
[batch, seq_len, hidden_size]
```

经过 `lm_head` 后变成：

```text
[batch, seq_len, vocab_size]
```

每个位置都会得到一个词表上的分数，也就是 logits。

例如：

```text
“我 喜欢” → 预测“猫”的分数最高
```

训练时，模型拿预测结果和真实的下一个 Token 比较，得到 loss，再通过反向传播更新参数。

## 10. 从原理到代码的组装顺序

不要复制整个仓库。可以把 MiniMind 的主干拆成几个接口清晰的模块，原始仓库只作为源码对照：

```text
minimind_lab/rmsnorm.py          → RMSNorm
minimind_lab/rope.py             → 基础 RoPE
minimind_lab/attention.py        → QKV、RoPE、GQA、KV Cache
minimind_lab/swiglu.py           → SwiGLU / FFN
minimind_lab/transformer_block.py → Transformer Block
minimind_lab/causal_lm.py        → 完整语言模型
```

组装方向是：

```text
RMSNorm → RoPE → Attention → SwiGLU → TransformerBlock
→ CausalLM → next-token loss → toy training
```

每完成一个模块，可以从两个角度自测：

```text
1. 输入输出 shape 对不对？
2. loss.backward() 后梯度是不是存在且有限？
```

模块能运行只是第一步；还需要把它们接成完整模型，并通过训练和固定评测验证整体行为。

## 11. 你现在应该能口头回答

- [ ] Token ID 和 Embedding 向量有什么区别？
- [ ] Attention 为什么要有 Q、K、V？
- [ ] RoPE 解决什么问题？
- [ ] GQA 为什么能减少 KV Cache？
- [ ] FFN 的输入和输出分别是什么？
- [ ] SwiGLU 的 `gate_proj`、`up_proj`、`down_proj` 各自做什么？
- [ ] 为什么 FFN 输出还要和原输入相加？

如果这几个问题能用自己的话讲出来，就可以继续学习 `CausalLM` 和训练主链路。
