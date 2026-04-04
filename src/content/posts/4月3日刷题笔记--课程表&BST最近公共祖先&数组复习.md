---
title: 4月3日刷题笔记--课程表/BST最近公共祖先/数组复习
published: 2026-04-03
description: '有向图环检测（DFS + 回溯 + 记忆化）、二叉树和二叉搜索树的LCA问题详解，三种递归与迭代方法对比'
image: ''
tags: ['LeetCode', '有向图', 'DFS', '二叉树', 'LCA', '递归', '迭代', '数组']
category: 'LeetCode'
draft: false
lang: ''
---

## 本篇题目

::leetcode{id="207" title="Course Schedule" zh="课程表" difficulty="medium"}
::leetcode{id="236" title="Lowest Common Ancestor of a Binary Tree" zh="二叉树的最近公共祖先" difficulty="medium"}
::leetcode{id="235" title="Lowest Common Ancestor of a Binary Search Tree" zh="二叉搜索树的最近公共祖先" difficulty="medium"}
::leetcode{id="46" title="Permutations" zh="全排列" difficulty="medium"}
::leetcode{id="1" title="Two Sum" zh="两数之和" difficulty="easy"}
::leetcode{id="167" title="Two Sum II - Input Array Is Sorted" zh="两数之和 II - 输入有序数组" difficulty="medium"}

---

## 📝 LeetCode 207: 课程表 (Course Schedule)

::leetcode{id="207" title="Course Schedule" zh="课程表" difficulty="medium"}

### 📌 核心思想

本质是“有向图检测环”。

采用 **DFS（深度优先搜索）+ 状态回溯 + 记忆化优化**。

---

### 📦 步骤一：建图（魔法拆快递）

我们要把题目给的二维数组，变成一个方便查询的”字典（邻接表）”。

#### 代码块 1️⃣：准备空容器

```python
preMap = {i: [] for i in range(numCourses)}
```

**说明**：使用**字典推导式**构建邻接表。
- `{...}` 创建字典
- `i: []` 键值对，`i` 是课程号（0 到 numCourses-1），值是空列表
- `for i in range(numCourses)` 遍历所有课程编号
- 结果：每个课程号对应一个空列表，后续用来存储其先修课

#### 代码块 2️⃣：填充邮箱

```python
for crs, pre in prerequisites:
    preMap[crs].append(pre)
```

**说明**：遍历并填充邻接表。
- `prerequisites` 是二维数组，每个元素都是 `[课程号, 先修课程号]`
- `for crs, pre in prerequisites` 使用**元组拆包**（unpacking）——每次迭代直接将 `[crs_val, pre_val]` 拆开赋值给 `crs` 和 `pre` 两个变量
- `preMap[crs].append(pre)` 将先修课程 `pre` 添加到课程 `crs` 的先修课列表中

**最终结果示例**：
```python
preMap = {
    0: [1],        # 课程0 要先修课程1
    1: [2],        # 课程1 要先修课程2
    2: [],         # 课程2 无先修课
}
```

---

### 🕵️‍♂️ 步骤二：DFS 找环（迷宫探险）

把每一门课当成迷宫里的房间，先修课就是通向下一个房间的门。

`visitSet` 记录的是**当前这单趟探险**沿途撒下的“面包屑”，用来防止自己绕圈子。

- **死胡同（发现环）**：如果前面的房间地上有自己的面包屑，说明死循环了，返回 `False`。

- **安全屋（无先修课）**：如果没有前置课，说明这条路走到底且安全，返回 `True`。

- **撒面包屑**：进门探险前，记录当前位置 `visitSet.add(crs)`。

- **捡面包屑（回溯）**：这门课的所有前置路线都安全查完后，**必须把面包屑捡起来** `visitSet.remove(crs)`，以免影响其他路线的判断。

- **贴安全封条（记忆化优化）**：既然证明了这门课绝对安全，直接清空它的前置课表 `preMap[crs] = []`。下次别的路线再走到这里，瞬间就能放行，极大提升运行速度。

---

### 🏝️ 步骤三：全局排查（清剿孤岛）

不能只从 0 号课程查一次就结束，因为图里可能存在**完全不连通的孤岛（几门课互相死循环，但和其他课没关系）**。

#### 代码块 3️⃣：枚举所有起点

```python
for crs in range(numCourses):
    if not dfs(crs): return False
return True
```

**类比**：想象你是一个保安，要排查一个建筑群是否存在”环形走廊”（能够走一圈回到起点）。
- 你不能只从大厅出发检查，还要从每个楼层、每个房间都走一遍
- 对于已经检查过的区域，上面的”记忆化优化”会让你瞬间跳过（贴了”已检查”的封条）
- 一旦发现任何一条路径存在环，立即返回 `False`
- 所有起点都检查完了还没发现环，说明整个建筑是**安全的**，返回 `True`

**实际效率**：虽然看似要遍历所有课程，但由于 DFS 中的记忆化优化，每条边最多被访问一次，总时间复杂度仍是 $O(V + E)$（顶点数 + 边数）。

---

### 💻 终极背诵模板 (Python)

#### 代码块 4️⃣a：框架与初始化

```python
class Solution:
    def canFinish(self, numCourses: int, prerequisites: List[List[int]]) -> bool:
        # 1. 建图 (Map each course to prereq list)
        preMap = {i: [] for i in range(numCourses)}
        for crs, pre in prerequisites:
            preMap[crs].append(pre)
        
        # 记录当前 DFS 路径上的课程
        visitSet = set()
```

**说明**：
- `preMap`：邻接表（每个课程 → 其先修课列表）
- `visitSet`：当前单趟探险路径上的”面包屑”集合，用来检测环

#### 代码块 4️⃣b：DFS 核心逻辑（三条分支）

```python
        def dfs(crs):
            # ① 发现环：遇到自己留下的面包屑
            if crs in visitSet: 
                return False
            
            # ② 安全出口：没有先修课了
            if preMap[crs] == []: 
                return True

            # ③ 探险模式：标记 + 递归 + 回溯
            visitSet.add(crs)
            for pre in preMap[crs]:
                if not dfs(pre): 
                    return False
            visitSet.remove(crs)  # 关键：捡起面包屑，为其他路径让开
            
            # ④ 记忆化优化：证明当前课程绝对安全，清空其先修课
            preMap[crs] = []
            return True
```

**三条关键分支**：
1. **环检测**（`if crs in visitSet`）：如果当前课程已在当前路径上，说明形成了环，返回 `False`
2. **终止条件**（`if preMap[crs] == []`）：如果没有先修课了，说明这条路是安全的，返回 `True`
3. **状态转移**（回溯过程）：
   - 进入前：撒面包屑 `visitSet.add(crs)`
   - 递归：检查所有先修课
   - 退出前：捡起面包屑 `visitSet.remove(crs)`（必须做！否则会影响其他分支）
   - 清空先修课列表 `preMap[crs] = []`（记忆化，下次查询秒返）

#### 代码块 4️⃣c：主函数（全局遍历）

```python
        # 遍历所有课程，防止有不连通的”孤岛”环
        for crs in range(numCourses):
            if not dfs(crs): 
                return False
        return True
```

**为什么要全局遍历**：图可能不连通，单个 `DFS` 无法覆盖所有分量。从每个课程都试一次，确保没有隐藏的环形孤岛。

**完整模板汇总**：

```python
class Solution:
    def canFinish(self, numCourses: int, prerequisites: List[List[int]]) -> bool:
        # 1. 建图 (Map each course to prereq list)
        preMap = {i: [] for i in range(numCourses)}
        for crs, pre in prerequisites:
            preMap[crs].append(pre)
        
        # 记录当前 DFS 路径上的课程
        visitSet = set()
        
        # 2. 深度优先搜索
        def dfs(crs):
            # 遇到自己撒的面包屑，发现环
            if crs in visitSet: 
                return False
            # 已经是安全屋
            if preMap[crs] == []: 
                return True

            # 标记正在访问（撒面包屑）
            visitSet.add(crs)
            
            # 顺藤摸瓜查所有的前置课
            for pre in preMap[crs]:
                if not dfs(pre): 
                    return False
                
            # 回溯：撤销访问标记（捡面包屑）
            visitSet.remove(crs)
            # 记忆化优化：标记为绝对安全
            preMap[crs] = []
            
            return True

        # 3. 遍历所有课程，防止有不连通的”孤岛”环
        for crs in range(numCourses):
            if not dfs(crs): 
                return False
        return True
```

---

## 📝 LeetCode 236: 二叉树的最近公共祖先

::leetcode{id="236" title="Lowest Common Ancestor of a Binary Tree" zh="二叉树的最近公共祖先" difficulty="medium"}

**适用场景**：普通二叉树（节点值无大小规律）。

**核心思路**：**后序遍历（左右中）**。因为我们要找“祖先”，必须先自顶向下查到底部，然后再**自底向上**把查到的结果层层返回给父节点。

**复杂度**：时间 $O(N)$，空间 $O(N)$（递归调用栈的深度）。

### 🔍 代码分步详解

#### 代码块 1️⃣：终止条件（Base Case）

```python
if not root or root == p or root == q:
    return root
```

**说明**：
- `if not root`：当前节点为空（走到死胡同），直接返回 `None`
- `or root == p or root == q`：当前节点恰好是目标节点 `p` 或 `q`，找到了其中一个目标，直接返回当前节点

#### 代码块 2️⃣：递归查找左右子树

```python
left = self.lowestCommonAncestor(root.left, p, q)
right = self.lowestCommonAncestor(root.right, p, q)
```

**说明**：
- 分别对左子树和右子树进行递归调用
- `left` 保存从左子树返回的结果（可能是 `None`、`p`、`q` 或者 LCA）
- `right` 保存从右子树返回的结果

#### 代码块 3️⃣：自底向上处理结果（归）

```python
if left and right:
    return root

return left or right
```

**逻辑**：
- **情况 A**：`left` 和 `right` **都不为空** → `p` 和 `q` 分别在当前节点的左右两侧 → 当前节点就是 **LCA**，返回 `root`
- **情况 B**：`left` 和 `right` **只有一个不为空** → `p` 和 `q` 都在同一侧（或只找到了其中一个） → 返回那个不为空的结果 `left or right`
  - 这里 `left or right` 等价于：如果 `left` 存在则返回 `left`，否则返回 `right`

### 💻 完整代码模板

```python
class Solution:
    def lowestCommonAncestor(self, root: 'TreeNode', p: 'TreeNode', q: 'TreeNode') -> 'TreeNode':
        # 1. 终止条件：遇到空节点，或找到 p / q
        if not root or root == p or root == q:
            return root
        
        # 2. 递归遍历左右子树
        left = self.lowestCommonAncestor(root.left, p, q)
        right = self.lowestCommonAncestor(root.right, p, q)
        
        # 3. 自底向上处理结果
        if left and right:
            return root
        return left or right
```

### 💡 核心要点

**后序遍历的妙处**：必须先处理完左右子树，再处理当前节点。这样才能确保：
- 当 `left` 和 `right` 都不为空时，当前节点一定处于两个目标的"分界点"
- 体现了"自底向上"的思维：先找到叶子级别的目标，再逐层向上汇报结果

---

## 📝 LeetCode 235: 二叉搜索树的最近公共祖先

::leetcode{id="235" title="Lowest Common Ancestor of a Binary Search Tree" zh="二叉搜索树的最近公共祖先" difficulty="medium"}

**适用场景**：二叉搜索树 (BST)，具备“左子树所有节点 < 根节点 < 右子树所有节点”的严格规律。

**核心思路**：**迭代法 + 分界点逻辑**。利用 BST 的性质，从根节点自顶向下寻找，**第一个值介于 `p` 和 `q` 之间的节点**，必定就是最近公共祖先。

**复杂度**：时间 $O(H)$（$H$ 为树高，最坏 $O(N)$），空间 $O(1)$（仅使用常数级指针）。

### 🔍 代码分步详解

#### 代码块 1️⃣：预处理大小关系

```python
if p.val > q.val:
    p, q = q, p
```

**说明**：
- 交换 `p` 和 `q` 的值，确保 `p.val <= q.val`
- `p, q = q, p` 是 Python 的**元组拆包赋值**，一行代码同时交换两个变量
- 目的是简化后续的区间判断逻辑，无需反复比较

#### 代码块 2️⃣：循环条件

```python
while root:
```

**说明**：
- 只要 `root` 不为空，就继续查找
- 由于是 BST，每次都能向左或向右移动，最终必定找到答案或到达 `None`

#### 代码块 3️⃣：三分支判断（利用 BST 性质）

```python
if root.val > q.val:           # 目标都在左侧
    root = root.left
elif root.val < p.val:         # 目标都在右侧
    root = root.right
else:                           # 找到分界点
    return root
```

**三个分支详解**：

| 条件                                 | 含义                          | 动作                          |
| ---------------------------------- | --------------------------- | --------------------------- |
| `root.val > q.val`                 | 当前节点值 **大于** 最大目标值          | 目标都在左子树，`root = root.left`  |
| `root.val < p.val`                 | 当前节点值 **小于** 最小目标值          | 目标都在右子树，`root = root.right` |
| 其他（即 `p.val <= root.val <= q.val`） | 当前节点值在 `[p.val, q.val]` 区间内 | **找到分界点**，直接返回 `root`       |

**为什么第三种情况必定是 LCA**：
- `p` 和 `q` 发生了”分流”（一个在左一个在右），或其中之一就是当前节点
- BST 的分界点天然就是 LCA

### 💻 完整代码模板

```python
class Solution:
    def lowestCommonAncestor(self, root: 'TreeNode', p: 'TreeNode', q: 'TreeNode') -> 'TreeNode':
        # 1. 确保 p 的值小于 q 的值，简化后续的区间判断
        if p.val > q.val:
            p, q = q, p
            
        # 2. 从根节点开始迭代遍历
        while root:
            # 3. 根据 BST 性质进行分支判断
            if root.val > q.val:      # 目标都在左侧
                root = root.left
            elif root.val < p.val:    # 目标都在右侧
                root = root.right
            else:                      # 当前节点就是分界点(LCA)
                return root
                
        return None
```

### 💡 与普通二叉树的对比

| 题目 | 方法 | 时间复杂度 | 空间复杂度 |
|------|------|-----------|-----------|
| LeetCode 236（普通二叉树） | 递归（后序遍历） | $O(N)$ | $O(H)$ |
| LeetCode 235（BST） | 迭代（利用 BST 性质） | $O(H)$ | $O(1)$ |

**关键区别**：BST 能在 $O(H)$ 时间找到 LCA，因为可以直接排除不相关的子树

---

## 全排列——插入法笔记

::leetcode{id="46" title="Permutations" zh="全排列" difficulty="medium"}

---

## 一、核心思路

不直接枚举，而是把问题拆小：

> 求 `[1,2,3]` 的全排列 = 先求 `[2,3]` 的全排列，再把 `1` 插入每个结果的每个位置。

每一层递归只做两件事：**① 把第一个元素搁置，② 把它插回去**。

---

## 二、完整代码

```python
def permute(self, nums):
    if len(nums) == 0:          # 递归终止：空数组只有一个"排列"——[]
        return [[]]
	
	# 我们每次递归都把nums数组的第一位丢掉 直到剩下[[]]
    perms = self.permute(nums[1:])   # 递归：先算去掉第一个元素的全排列
    res = []
	
	# 写的时候在脑子想象现在的perms已经是[[2,3],[3,2]]了
    for p in perms:                      
        for i in range(len(p) + 1):      # 遍历每个插入位置（共 len+1 个）
            p_copy = p.copy()            # 复制！不能改原来的 p
            p_copy.insert(i, nums[0])    # 把第一个元素(也就是1)插到不同的位置上
            res.append(p_copy)           # 收集结果

    return res
```

---

## 三、语法要点

### ① 列表切片 `nums[1:]`

```python
nums = [1, 2, 3]
nums[1:]   # → [2, 3]   去掉第一个，剩余所有
nums[:2]   # → [1, 2]   前两个
```

### ② `for x in 列表`——遍历

```python
perms = [[2,3], [3,2]]
for p in perms:
    print(p)
# 第1次：p = [2, 3]
# 第2次：p = [3, 2]
```

`p` 只是临时变量名，叫什么都行，每次循环自动装入下一个元素。

### ③ `range(len(p) + 1)`——插入位置

```python
p = [2, 3]          # 长度为 2
range(len(p) + 1)   # → 0, 1, 2   共 3 个位置 所以要len(p)+1
```

一个长度为 n 的列表，有 n+1 个可以插入的位置（前、中间各处、后）。

### ④ 为什么要 `p.copy()`？

```python
# 不 copy 的错误情况：
p = [2, 3]
p.insert(0, 1)   # p → [1, 2, 3]  ← p 被改了！
p.insert(1, 1)   # 在 [1,2,3] 上插 → [1,1,2,3]  ← 错误

# 正确做法：每次从干净的 p 复制
p = [2, 3]
p_copy = p.copy(); p_copy.insert(0, 1)  # p_copy=[1,2,3]，p 还是 [2,3]
p_copy = p.copy(); p_copy.insert(1, 1)  # p_copy=[2,1,3]，p 还是 [2,3]
```

### ⑤ `insert` 和 `append`

```python
p = [2, 3]
p.insert(0, 1)   # → [1, 2, 3]   插到位置 0
p.insert(1, 1)   # → [2, 1, 3]   插到位置 1
p.insert(2, 1)   # → [2, 3, 1]   插到位置 2（末尾）

res = []
res.append([1,2,3])   # res → [[1,2,3]]
res.append([2,1,3])   # res → [[1,2,3],[2,1,3]]
```

---

## 四、执行过程追踪

| 层 | nums | perms（上层返回值） | 本层 return |
|---|---|---|---|
| 最深 | `[]` | — | `[[]]` |
| 第3层 | `[3]` | `[[]]` | `[[3]]` |
| 第2层 | `[2,3]` | `[[3]]` | `[[2,3],[3,2]]` |
| 第1层 | `[1,2,3]` | `[[2,3],[3,2]]` | 6个排列 |

每深一层，`perms` 的排列数就翻倍——因为多了一个可以插入的位置。

---

## 五、关键心法：信任递归

写递归时，**不要在脑子里追踪所有层**。只需假设"递归已经帮我算好了子问题"，然后思考：拿到这个结果，我该怎么处理它？

具体到这题：脑子里想象 `perms = [[2,3],[3,2]]` 已经有了，剩下只需想"怎么把 `1` 插进去"。

---

## 六、复杂度

| | 复杂度 | 原因 |
|---|---|---|
| 时间 | O(n × n!) | 共 n! 个排列，每个需 O(n) 时间 copy + insert |
| 空间 | O(n²) | 递归栈深度 n，每层有中间列表 |

---

## 七、同类型题目

- leetcode 47 · 全排列 II（有重复元素）
- leetcode 78 · 子集
- leetcode 77 · 组合

套路一样：递归缩小问题 → 在子问题结果上做操作 → 收集结果。

---

## 两数之和笔记

## leetcode 1 · 两数之和（无序数组）

::leetcode{id="1" title="Two Sum" zh="两数之和" difficulty="easy"}

### 思路

对于每个数字 `n`，它需要的"搭档"是 `target - n`。

与其两层循环暴力找，不如**边走边记录**——用一个字典存已经见过的数字和它的下标，每次只需检查搭档是否已经出现过。

> 字典存的是 `{数字: 下标}`，这样可以快速查"某个数字存不存在"，找到了还能直接拿到它的下标。

**关键细节：先查再存，不能先存再查。**

```
比如 nums=[3,3], target=6
先存再查：第一次循环，3 存进去，然后查 diff=3，找到自己，返回 [0,0] ← 错误
先查再存：第一次循环，查 diff=3，表里还没有，存入 {3:0}
          第二次循环，查 diff=3，找到下标0，返回 [0,1] ← 正确
```

### 代码

```python
def twoSum(self, nums: List[int], target: int) -> List[int]:
    # 创建哈希表，存 {数字: 下标}，方便查搭档时直接拿到下标
    seen = {}

    # enumerate 同时拿到下标和值，index 在前，number 在后
    for index, number in enumerate(nums):
        # 计算当前数字需要的搭档
        diff = target - number

        # 如果搭档已经在表里，直接返回两个下标
        if diff in seen:
            return [seen[diff], index]

        # 先查后存：避免同一个元素用两次
        seen[number] = index
```

### 复杂度

| | 复杂度 | 原因 |
|---|---|---|
| 时间 | O(n) | 只遍历一次数组，字典查找是 O(1) |
| 空间 | O(n) | 字典最多存 n 个元素 |

---

## leetcode 167 · 两数之和 II（有序数组）

::leetcode{id="167" title="Two Sum II - Input Array Is Sorted" zh="两数之和 II - 输入有序数组" difficulty="medium"}

### 思路

数组有序这个条件让**双指针**成为可能。

左指针从最小的数开始，右指针从最大的数开始，两数之和：
- **大于 target**：右指针左移，让和变小
- **小于 target**：左指针右移，让和变大
- **等于 target**：找到答案

因为数组有序，每次移动指针都能排除掉一批不可能的组合，所以不需要额外空间。

### 代码

```python
def twoSum(self, numbers: List[int], target: int) -> List[int]:
    # 初始化双指针，左指针指向最小值，右指针指向最大值
    left = 0
    right = len(numbers) - 1

    # left < right：不能用 <=，因为两个元素不能是同一个
    while left < right:
        s = numbers[left] + numbers[right]

        if s > target:
            right -= 1   # 和太大，右指针左移，让和变小
        elif s < target:
            left += 1    # 和太小，左指针右移，让和变大
        else:
            # 题目下标从 1 开始，所以返回时 +1
            return [left + 1, right + 1]

    # 题目保证有解，这行可写可不写
    return []
```

### 复杂度

| | 复杂度 | 原因 |
|---|---|---|
| 时间 | O(n) | 两个指针最多各走 n 步 |
| 空间 | O(1) | 只用了两个指针变量，无额外空间 |

---

## 两题对比

| | 两数之和 I | 两数之和 II |
|---|---|---|
| 数组是否有序 | 无序 | 有序 |
| 方法 | 哈希表 | 双指针 |
| 时间复杂度 | O(n) | O(n) |
| 空间复杂度 | O(n) | O(1) |
| 核心思路 | 边走边查搭档 | 两端夹逼 |

**结论：** 数组有序时优先考虑双指针，空间更省。数组无序时用哈希表，排序再双指针反而更慢（O(n log n)）。