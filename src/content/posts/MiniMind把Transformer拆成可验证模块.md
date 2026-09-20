---
title: MiniMind：把 Transformer 拆成可验证的模块
published: 2026-09-14
description: 参考 MiniMind 的结构与训练流程，把一个小型 Decoder-only Transformer 拆成可以单独理解、组装和验证的模块。
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

我不想把一个完整模型仓库当成黑盒照着跑，所以把 MiniMind 的主干拆成几个可以单独检查的部分，再逐步组装。

## 为什么先拆模块

模型能输出结果，不代表每一层都理解了。出现问题时，如果归一化、位置编码、Attention、前馈网络和生成逻辑全部揉在一个文件里，很难判断是形状错、缓存错，还是训练目标错。

因此项目把它拆成：

- RMSNorm；
- RoPE；
- Attention 和 GQA；
- KV Cache；
- SwiGLU 和 Transformer Block；
- Causal Language Model。

每个模块先明确输入输出，再接到下一个模块。这样做的代价是前期代码更多，但每一步都能单独运行和定位。

## 一个 Attention 请求要经过什么

输入先经过 Q、K、V 投影。RoPE 只作用在 Q 和 K 上，用来注入位置信息；GQA 让多个 Query 头共享较少的 KV 头；生成阶段把历史 K、V 放进 KV Cache，避免每生成一个 token 都重新计算完整历史。

这里最容易出错的不是公式，而是形状：

- batch 和 sequence 维度不能混；
- Q 头数和 KV 头数必须满足整除关系；
- 增量生成时，当前位置必须接在历史 cache 后面；
- 手写路径和融合 Attention 路径要给出相同结果。

## 从模块到训练

模块组装完成后，模型提供 Pretrain 和 SFT 的基础训练入口：

- Pretrain 用 next-token prediction 学习下一个 token；
- SFT 只让 assistant 部分参与 loss；
- checkpoint 同时保存模型和训练状态，便于中断后继续；
- TensorBoard 记录 loss、learning rate 和吞吐等训练信息。

仓库目前为核心模块提供了 19 个单元测试，覆盖因果遮罩、KV Cache 增量生成、融合与手写 Attention 对齐以及梯度稳定性。代码在 [minimind-labs](https://github.com/yyylegend/minimind-labs)。

这篇文章的重点不是复述 Transformer 公式，而是记录一个更实际的学习顺序：先定义边界，再固定形状，最后组装训练链路。
