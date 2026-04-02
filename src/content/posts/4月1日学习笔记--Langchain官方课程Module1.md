---
title: 4月1日学习笔记--LangChain 官方课程 Module 1
published: 2026-04-01
description: 'LangChain 官方课程 Module 1 笔记，覆盖模型初始化、Prompt 设计、工具、网络搜索、记忆与多模态输入'
image: ''
tags: ['LangChain', 'Python', 'LLM', 'Agent']
category: 'AI'
draft: false
lang: ''
---

## 目录

1. [模型初始化与调用](#1-模型初始化与调用)
2. [Prompt 提示词设计](#2-prompt-提示词设计)
3. [工具 Tools](#3-工具-tools)
4. [网络搜索工具](#4-网络搜索工具)
5. [记忆 Memory](#5-记忆-memory)
6. [多模态输入](#6-多模态输入)
7. [常用函数速查表](#7-常用函数速查表)
8. [完整流程模板](#8-完整流程模板)

---

## 1. 模型初始化与调用

### 概念

LangChain 提供了一个统一的接口 `init_chat_model`，可以用同一套代码接入不同的模型提供商（OpenAI、Anthropic、Google 等）。初始化完模型之后，可以直接用 `.invoke()` 发消息。

Agent 是在模型之上封装了一层"行动能力"——它不只是回答问题，还可以决定要不要调用工具、怎么调用。

### 初始化模型

```python
from langchain.chat_models import init_chat_model

# 基础初始化
model = init_chat_model(model="gpt-4o-mini")

# 调整参数（temperature 越高，回答越有创意/随机）
model = init_chat_model(
    model="gpt-4o-mini",
    temperature=0.7
)

# 切换到其他提供商
model = init_chat_model(model="claude-sonnet-4-5")       # Anthropic
```

### 直接调用模型

```python
response = model.invoke("月球的首都是哪里？")
print(response.content)          # 打印回答文字
print(response.response_metadata) # 打印 token 用量等元信息
```

### 创建 Agent 并调用

```python
from langchain.agents import create_agent
from langchain.messages import HumanMessage

agent = create_agent(model=model)

response = agent.invoke(
    {"messages": [HumanMessage(content="月球的首都是哪里？")]}
)

print(response['messages'][-1].content)  # 取最后一条消息（AI 的回答）
```

> **model vs agent 的区别**：`model.invoke()` 直接返回一个 AIMessage 对象；`agent.invoke()` 返回一个包含完整消息列表的字典，用 `response['messages'][-1].content` 取最终答案。

### 多轮对话（手动传历史）

```python
from langchain.messages import HumanMessage, AIMessage

response = agent.invoke({
    "messages": [
        HumanMessage(content="月球的首都叫 Luna City"),
        AIMessage(content="好的，已记录。"),
        HumanMessage(content="告诉我更多关于 Luna City 的事")
    ]
})
```

### 流式输出

```python
for token, metadata in agent.stream(
    {"messages": [HumanMessage(content="给我介绍一下 Luna City")]},
    stream_mode="messages"
):
    if token.content:
        print(token.content, end="", flush=True)
```

---

## 2. Prompt 提示词设计

### 概念

Prompt 是你给模型的"指令"，质量直接影响输出结果。常见的几种设计方式：

| 方式 | 适用场景 |
|------|----------|
| 基础提问 | 简单问答 |
| System Prompt | 设定 AI 的角色和行为边界 |
| Few-shot 示例 | 通过例子教模型输出特定格式 |
| 结构化 Prompt | 规定输出字段 |
| 结构化输出 | 用 Pydantic 强制返回结构化数据 |

### System Prompt（设定角色）

```python
agent = create_agent(
    model="gpt-4o-mini",
    system_prompt="你是一位科幻小说作家，根据用户的要求创造一座太空首都城市。"
)
```

### Few-shot 示例（给例子）

在 system prompt 里直接写几个例子，模型会模仿这种风格回答：

```python
system_prompt = """
你是一位科幻小说作家，根据用户的要求创造一座太空首都城市。

User: 火星的首都是什么？
Scifi Writer: Marsialis

User: 金星的首都是什么？
Scifi Writer: Venusovia
"""
```

### 结构化 Prompt（规定输出格式）

```python
system_prompt = """
你是一位科幻小说作家，根据用户的要求创造一座太空首都城市。

请按以下格式回答：
名称：城市名称
位置：所在星球或位置
氛围：2-3个词描述
经济：主要产业
"""
```

### 结构化输出（Pydantic）

当你需要在代码里直接使用 AI 的输出时，用 Pydantic 定义数据结构，让模型强制返回 JSON 格式：

```python
from pydantic import BaseModel
from langchain.agents import create_agent
from langchain.messages import HumanMessage

class CapitalInfo(BaseModel):
    name: str
    location: str
    vibe: str
    economy: str

agent = create_agent(
    model='gpt-4o-mini',
    system_prompt="你是一位科幻小说作家，根据用户的要求创造一座首都城市。",
    response_format=CapitalInfo
)

response = agent.invoke({"messages": [HumanMessage(content="月球的首都是什么？")]})

# 访问结构化数据
capital = response["structured_response"]
print(capital.name)
print(f"{capital.name} 位于 {capital.location}")
```

> `response_format=CapitalInfo` 告诉模型按这个结构返回数据，之后通过 `response["structured_response"]` 拿到的就是一个 `CapitalInfo` 对象，可以直接用 `.name`、`.location` 等属性访问。

---

## 3. 工具 Tools

### 概念

Tool（工具）是你给 Agent 额外的"能力"。比如计算器、搜索引擎、数据库查询等。Agent 会在需要时自主决定是否调用工具，而不是每次都调用。

### 定义一个工具

用 `@tool` 装饰器把普通函数变成 LangChain 工具。**docstring 很重要**，模型靠它理解这个工具的用途。

```python
from langchain.tools import tool

@tool
def square_root(x: float) -> float:
    """计算一个数的平方根"""
    return x ** 0.5

# 也可以自定义工具名称和描述
@tool("square_root", description="计算一个数的平方根")
def my_func(x: float) -> float:
    return x ** 0.5
```

### 手动测试工具

```python
square_root.invoke({"x": 467})  # 返回 21.61
```

### 把工具给 Agent 使用

```python
agent = create_agent(
    model=model,
    tools=[square_root],
    system_prompt="你是一个数学助手，用工具来计算结果。"
)

response = agent.invoke(
    {"messages": [HumanMessage(content="467 的平方根是多少？")]}
)
print(response['messages'][-1].content)
```

### Agent 调用工具的完整消息流

```
HumanMessage  →  "467 的平方根是多少？"
AIMessage     →  (空内容，但包含 tool_calls 字段，表示要调用工具)
ToolMessage   →  "21.61018..."（工具返回的结果）
AIMessage     →  "467 的平方根约为 21.61"（最终回答）
```

可以这样查看中间调用过程：

```python
print(response["messages"][1].tool_calls)
# [{'name': 'square_root', 'args': {'x': 467}, ...}]
```

---

## 4. 网络搜索工具

### 概念

大模型的知识有截止日期，对于实时信息（比如今天的新闻、当前的市长）它一无所知。通过添加搜索工具，Agent 可以在需要时主动上网查询。

这里用的是 [Tavily](https://tavily.com)，一个专为 AI Agent 设计的搜索 API。

### 定义网络搜索工具

```python
from langchain.tools import tool
from tavily import TavilyClient

tavily_client = TavilyClient()  # 需要设置 TAVILY_API_KEY 环境变量

@tool
def web_search(query: str) -> dict:
    """在网上搜索信息"""
    return tavily_client.search(query)
```

### 单独测试搜索

```python
result = web_search.invoke("旧金山现任市长是谁？")
# 返回包含 url、title、content 的搜索结果列表
```

### 加入 Agent

```python
agent = create_agent(
    model=model,
    tools=[web_search]
)

response = agent.invoke(
    {"messages": [HumanMessage(content="旧金山现任市长是谁？")]}
)
print(response['messages'][-1].content)
# Agent 会先调用 web_search，再根据结果回答
```

---

## 5. 记忆 Memory

### 概念

默认情况下，Agent 每次 `invoke` 都是全新开始，完全不记得之前说过什么。要实现多轮对话记忆，需要用到 **checkpointer** + **thread_id**。

- **checkpointer**：负责存储会话历史（`InMemorySaver` 是存在内存里，程序退出就没了）
- **thread_id**：会话 ID，同一个 ID 下的对话共享历史记录

### 无记忆 vs 有记忆对比

```python
# 无记忆（每次 invoke 都是新的）
agent = create_agent(model=model)

agent.invoke({"messages": [HumanMessage(content="我叫 Runqi，最喜欢蓝色")]})
response = agent.invoke({"messages": [HumanMessage(content="我最喜欢的颜色是什么？")]})
# 结果：不知道，因为上一轮消息没传进来
```

```python
# 有记忆
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model=model,
    checkpointer=InMemorySaver()
)

config = {"configurable": {"thread_id": "session_001"}}

agent.invoke(
    {"messages": [HumanMessage(content="我叫 Runqi，最喜欢蓝色")]},
    config
)

response = agent.invoke(
    {"messages": [HumanMessage(content="我最喜欢的颜色是什么？")]},
    config  # 同一个 thread_id，自动带入历史
)
print(response['messages'][-1].content)
# 结果：你之前提到你最喜欢的颜色是蓝色
```

### 多用户场景

不同的 `thread_id` 代表不同的会话，互相隔离：

```python
config_user1 = {"configurable": {"thread_id": "user_001"}}
config_user2 = {"configurable": {"thread_id": "user_002"}}

# user1 的对话不会影响 user2
```

---

## 6. 多模态输入

### 概念

多模态意味着 Agent 不只能处理文字，还能理解图片、音频等。关键是把非文字内容转成 base64 编码，再包装进 `HumanMessage` 的 `content` 列表里。

### 纯文字输入（显式格式）

```python
question = HumanMessage(content=[
    {"type": "text", "text": "月球的首都是什么？"}
])
```

### 图片输入

```python
import base64

# 读取图片并转 base64
with open("image.png", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode("utf-8")

question = HumanMessage(content=[
    {"type": "text", "text": "描述一下这张图片"},
    {"type": "image", "base64": img_b64, "mime_type": "image/png"}
])

response = agent.invoke({"messages": [question]})
print(response['messages'][-1].content)
```

### 音频输入

```python
import sounddevice as sd
from scipy.io.wavfile import write
import base64, io

# 录音
audio = sd.rec(int(5 * 44100), samplerate=44100, channels=1)
sd.wait()

# 转 base64
buf = io.BytesIO()
write(buf, 44100, audio)
aud_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

# 需要支持音频的模型（如 gpt-4o-audio-preview）
agent = create_agent(model='gpt-4o-audio-preview')

question = HumanMessage(content=[
    {"type": "text", "text": "描述一下这段音频"},
    {"type": "audio", "base64": aud_b64, "mime_type": "audio/wav"}
])
```

---

## 7. 常用函数速查表

| 函数 / 类 | 作用 | 来源模块 |
|-----------|------|----------|
| `init_chat_model(model, **kwargs)` | 初始化聊天模型 | `langchain.chat_models` |
| `create_agent(model, tools, system_prompt, ...)` | 创建 Agent | `langchain.agents` |
| `HumanMessage(content)` | 用户消息 | `langchain.messages` |
| `AIMessage(content)` | AI 消息 | `langchain.messages` |
| `@tool` | 将函数转为 LangChain 工具 | `langchain.tools` |
| `tool.invoke({"param": value})` | 直接调用工具（测试用） | — |
| `agent.invoke({"messages": [...]})` | 运行 Agent（单次） | — |
| `agent.stream({"messages": [...]}, stream_mode="messages")` | 流式运行 Agent | — |
| `InMemorySaver()` | 内存中的对话历史存储器 | `langgraph.checkpoint.memory` |
| `BaseModel` | 定义结构化输出的数据模型 | `pydantic` |
| `TavilyClient()` | 网络搜索客户端 | `tavily` |

---

## 8. 完整流程模板

下面是一个集成了**工具 + 记忆 + 结构化输出**的完整 Agent 模板，你可以按需拆分或组合使用。

```python
from dotenv import load_dotenv
load_dotenv()

# ── 1. 导入依赖 ────────────────────────────────────────────
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain.messages import HumanMessage
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import BaseModel
from tavily import TavilyClient

# ── 2. 定义工具 ────────────────────────────────────────────
tavily_client = TavilyClient()

@tool
def web_search(query: str) -> dict:
    """在网上搜索最新信息"""
    return tavily_client.search(query)

@tool
def calculate(expression: str) -> float:
    """计算数学表达式，例如 '2 + 2' 或 'sqrt(16)'"""
    import math
    return eval(expression, {"__builtins__": {}}, vars(math))

# ── 3. 定义结构化输出（可选）─────────────────────────────────
class Answer(BaseModel):
    summary: str      # 简短总结
    confidence: str   # 高 / 中 / 低
    source: str       # 信息来源

# ── 4. 初始化模型 ──────────────────────────────────────────
model = init_chat_model(
    model="gpt-4o-mini",
    temperature=0.3   # 低一点更稳定
)

# ── 5. 创建 Agent ──────────────────────────────────────────
agent = create_agent(
    model=model,
    tools=[web_search, calculate],
    system_prompt="你是一个智能助手，在需要时使用工具获取最新信息或进行计算。",
    checkpointer=InMemorySaver(),   # 开启记忆
    # response_format=Answer        # 需要结构化输出时取消注释
)

# ── 6. 设定会话 ID ─────────────────────────────────────────
config = {"configurable": {"thread_id": "my_session"}}

# ── 7. 多轮对话 ────────────────────────────────────────────
def chat(user_input: str) -> str:
    response = agent.invoke(
        {"messages": [HumanMessage(content=user_input)]},
        config
    )
    return response['messages'][-1].content

# 示例对话
print(chat("你好，我叫小明"))
print(chat("北京今天的天气怎么样？"))   # 会调用 web_search
print(chat("我叫什么名字？"))           # 从记忆中获取
```

### 流程图

```
用户输入
   │
   ▼
HumanMessage
   │
   ▼
Agent（内置 LLM）
   │
   ├─ 需要工具？─── 是 ──→ 调用 Tool ──→ ToolMessage ──→ 返回 Agent
   │                                                          │
   └─ 不需要 / 已有结果 ────────────────────────────────────→ AIMessage（最终回答）
   │
   ▼
checkpointer 保存消息历史（按 thread_id 区分）
```

---

> **下一步**：1.5 笔记本是一个综合实战项目（Personal Chef Agent），可以把上面学到的所有模块组合起来实现。建议自己动手实现一遍，加深理解。
