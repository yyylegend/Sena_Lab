---
title: 从一个 Token 开始，拆开理解 Transformer
published: 2026-09-14
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

完整模型仓库如果直接照着运行，最容易出现的问题是：模型能输出结果，但不知道每一层到底做了什么；一旦结果不对，也很难判断问题来自形状、位置编码、注意力还是训练目标。

MiniMind 的学习实验没有从完整训练开始，而是先把 Transformer 拆开。

## 一个 token 在模型里经历了什么

输入文本先被 tokenizer 切成 token，再映射成向量。这个向量进入每一层 Transformer 时，会反复经过几类计算：

- RMSNorm 先稳定数值范围；
- RoPE 给 Q 和 K 注入位置信息；
- Attention 决定当前位置应该关注哪些历史 token；
- SwiGLU 对信息做非线性加工；
- 残差连接把原始信息带到下一层。

最后，模型把隐藏状态映射回词表，得到下一个 token 的概率。

先理解这条数据流，再看代码，注意力机制和 KV Cache 才不会只剩下几个术语。

## 为什么要拆成模块

实现里把 RMSNorm、RoPE、Attention、SwiGLU、Transformer Block 和 Causal Language Model 分成独立文件。

每个模块先明确三件事：输入形状是什么、输出形状是什么、怎样判断结果没有偏离预期。这样做的好处是，问题可以被限制在一个很小的范围内。

例如，增量生成时 KV Cache 的输出应该和完整前向计算在对应位置一致；融合 Attention 路径和普通路径也应该得到相同结果。只有这些局部约束成立，模型整体的训练结果才有解释基础。

## 从结构到训练

模块组装完成后，训练入口分为两个阶段。

Pretrain 使用 next-token prediction，让模型学习文本序列的基本分布；SFT 则只让 assistant 的回答部分参与 loss，避免把用户提问也当成目标答案。

训练过程会保存模型参数和优化器状态，并记录 loss、learning rate 和吞吐。这样中断之后可以继续运行，也能回看某次配置变化到底带来了什么影响。

## 这类学习项目真正要留下什么

代码能跑只是第一步。更重要的是留下可验证的边界：模块是否独立、缓存是否正确、梯度是否稳定、训练数据和评测是否分开。

仓库目前为核心模块保留了 19 个单元测试，覆盖因果遮罩、KV Cache 增量生成、融合 Attention 对齐和梯度稳定性。代码见 [minimind-labs](https://github.com/yyylegend/minimind-labs)。

这种拆解方式并不能替代完整训练实验，但能让后续的 Pretrain、SFT 和评测不再建立在一个无法定位的问题上。
