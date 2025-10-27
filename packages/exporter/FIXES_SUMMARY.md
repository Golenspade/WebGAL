# WebGAL Exporter - P0 修复总结

## 修复日期
2025-10-27

## 修复的关键问题

### P0-1: 交互推进修复 ✅

**问题描述**：
- 无法自动进入游戏（标题页需要手动点击）
- 对话无法自动推进（say 命令等待用户输入）
- 选择/输入的自动化选择器错误

**修复内容**：

1. **自动进入游戏**
   - 添加了自动点击 `.title__enter-game-target` 的逻辑
   - 在页面加载后自动触发进入游戏

2. **对话自动推进**
   - 实现了自动推进机制，每 300ms 检测一次
   - 当无活动演出且不在标题页时，模拟空格键按下/释放
   - 触发 WebGAL 的 `useSpaceAndEnter` 热键处理器

3. **修正选择器**
   - **选择按钮**：从 `.ChooseItem` 改为 `.Choose_item`（实际类名带下划线）
   - **输入框**：从 `.UserInput` 改为 `#user-input`（实际是 ID）
   - **提交按钮**：使用 `.button` 类名（在 getUserInput.module.scss 中）

**修改文件**：
- `packages/exporter/src/utils/deterministicInput.ts`

---

### P0-2: 完善音频捕获 ✅

**问题描述**：
- 仅捕获 BGM，缺失 vocal（语音）、SE（音效）、UI SE、视频音轨
- BGM 的淡入/淡出、音量变化未记录

**修复内容**：

1. **Vocal（语音）捕获**
   - 监听 `#currentVocal` 元素的 `play` 和 `ended` 事件
   - 记录语音的 URL、音量、时长

2. **SE（音效）捕获**
   - 在 `arrangeNewPerform` 钩子中检测 `commandType.playEffect` (34)
   - 从 script 参数中提取 URL、音量、循环信息
   - 记录 SE 事件到时间线

3. **UI SE 捕获**
   - 监听 Redux store 的 `stage.uiSe` 变化
   - 当 uiSe 值改变时记录 UI SE 事件

4. **视频音轨捕获**
   - 监听所有 `<video>` 元素的 `play` 事件
   - 使用 MutationObserver 监听新添加的视频元素
   - 记录视频音轨的 URL、音量、时长

5. **BGM 增强监听**
   - 添加 `volumechange` 事件监听（为未来的音量曲线记录做准备）
   - 添加 `pause` 事件监听（记录 BGM 停止）

**修改文件**：
- `packages/exporter/src/timeline/timelineCapture.ts`

---

### P0-3: 修复完成判定 ✅

**问题描述**：
- 当前逻辑仅检查 `performList.length > 0`
- 在对话等待用户输入时，performList 为空，误判为场景完成
- 导致过早停止录制

**修复内容**：

1. **改进完成判定逻辑**
   - 不再仅依赖 `performList` 是否为空
   - 检查是否回到标题页（`showTitle = true`）
   - 检查是否到达场景末尾（`currentSentenceId >= totalSentences - 1`）
   - 检查是否有持续的空闲期（无演出、无音频、无文本变化）

2. **空闲检测机制**
   - 引入 `idleCount` 计数器
   - 当有活动（演出、音频、文本变化）时重置计数器
   - 当空闲计数达到阈值（3 秒）且在场景末尾时，判定为完成

3. **音频活动检测**
   - 检查 BGM 和 Vocal 元素是否在播放
   - 将音频活动纳入完成判定条件

4. **详细的完成原因**
   - 记录完成原因（title_screen、sustained_idle 等）
   - 便于调试和日志分析

**修改文件**：
- `packages/exporter/src/timeline/timelineCapture.ts`

---

---

### P0-4: 输出 MP4 无法播放（空/损坏容器）修复 ✅

**问题表现**：
- 导出产物存在，但大小异常（例如 ~261B），播放器/查看器提示 “failed to load image data” 或无法解析时长/码率。

**根因分析**：
- 时间线中的音频 URL（如 `http://localhost:3002/game/vocal/v1.wav`）在重建阶段被错误地当作相对路径拼接，导致 ffmpeg 输入文件指向不存在的磁盘路径；
- 在某些情况下会导致音频混合/复用阶段提前失败或写出空容器文件。

**修复内容**：
1) 统一解析音频路径（URL -> 本地文件）
   - 去除 `http(s)://host` 前缀，仅保留路径部分
   - 映射 `game/...` 到 `packages/webgal/public/game/...`
   - 映射 `src/...`（UI SE）到 `packages/webgal/src/...`
2) 修正资源基路径
   - `exporter` 传入音频资源根目录改为仓库内真实路径：`packages/webgal/public/game`

**修改文件**：
- `packages/exporter/src/audio/audioReconstruction.ts`（新增 `resolveAudioPath` 规范化逻辑）
- `packages/exporter/src/exporter.ts`（assetsBase 指向仓库内 `packages/webgal/public/game`）

**预期结果**：
- ffmpeg 能正确读取音频输入并完成混音；
- 最终 MP4 具备有效的视频/音频轨（`ffprobe` 可见 streams 与时长）；
- 常见播放器可正常播放。


## 测试建议

### 测试场景 1：基本对话
```
; 测试自动推进
你好，欢迎使用 WebGAL！;
这是第二句对话。;
这是第三句对话。;
```

**预期结果**：
- 自动进入游戏
- 自动推进每句对话
- 正确判定场景结束

### 测试场景 2：选择分支
```
; 测试选择自动化
请选择一个选项：;
choose:选项A:label_a|选项B:label_b;

label:label_a;
你选择了 A。;
end;

label:label_b;
你选择了 B。;
end;
```

**预期结果**：
- 自动选择第一个选项（或 branchScript 指定的选项）
- 正确跳转到对应标签

### 测试场景 3：音频混合
```
; 测试音频捕获
changeBg:bg.jpg;
bgm:bgm.mp3;
这是一句带语音的对话。 -vocal:voice.mp3;
playEffect:se.mp3;
```

**预期结果**：
- 捕获 BGM 事件
- 捕获 Vocal 事件
- 捕获 SE 事件
- 时间线包含所有音频轨道

### 测试场景 4：视频播放
```
; 测试视频音轨
playVideo:video.mp4;
```

**预期结果**：
- 捕获视频音轨事件
- 视频播放完成后继续

---

## 已知限制（P1 待修复）

### 1. BGM 淡入/淡出未完全记录
- 当前仅监听 `volumechange` 事件，未记录到时间线
- 需要捕获 `bgmEnter` 参数和淡入/淡出曲线

### 2. BGM 循环信息不完整
- 未记录 `loopEndTime`
- ffmpeg 的 `aloop` 参数未生效

### 3. CLI 参数未生效
- `textSpeed` 和 `autoSpeed` 未注入到引擎
- 需要在页面注入中覆盖 `userData.optionData`

### 4. 音量曲线未记录
- 视频期间的静音/恢复未记录
- 语音优先导致的 BGM 音量降低未记录

---

## 下一步计划

### P1 优先级修复
1. **BGM 质量提升**
   - 记录 `enter` 参数（淡入/淡出时间）
   - 记录音量变化曲线
   - 记录循环边界和 `loopEndTime`

2. **CLI 参数生效**
   - 在页面注入中覆盖 `textSpeed` 和 `autoSpeed`
   - 可选：启用自动模式（`isAuto = true`）

### 测试与验证
1. 创建完整的测试场景集
2. 验证所有音频轨道正确混合
3. 验证完成判定在各种场景下的准确性
4. 性能测试（长场景、多音轨）

---

## 技术细节

### 自动推进实现
```javascript
// 每 300ms 检测一次
const autoAdvanceInterval = setInterval(() => {
  const hasActivePerforms = controller?.performList?.length > 0;
  const showTitle = GUIState?.showTitle;

  if (!hasActivePerforms && !showTitle) {
    // 模拟空格键按下/释放
    document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 32 }));
    setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', { keyCode: 32 }));
    }, 50);
  }
}, 300);
```

### SE 捕获实现
```javascript
// 在 arrangeNewPerform 钩子中
if (script?.command === 34) { // commandType.playEffect
  const url = script.content;
  const volume = script.args?.find(arg => arg.key === 'volume')?.value || 100;

  window.__logTimelineEvent__({
    type: 'se',
    startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
    duration: -1,
    data: { audioType: 'se', url, volume, loop: false },
  });
}
```

### 完成判定实现
```javascript
// 检查多个条件
const status = {
  hasActivePerforms: controller.performList?.length > 0,
  hasAudioActivity: (bgm && !bgm.paused) || (vocal && !vocal.paused),
  currentSentenceId,
  totalSentences,
  atEnd: currentSentenceId >= totalSentences - 1,
};

// 空闲计数
if (hasActivity || sentenceChanged) {
  idleCount = 0;
} else {
  idleCount++;
}

// 判定完成
if (idleCount >= IDLE_THRESHOLD && status.atEnd) {
  return complete;
}
```

---

## 参考资料

### WebGAL 引擎关键文件
- `packages/webgal/src/hooks/useHotkey.tsx` - 热键处理
- `packages/webgal/src/Core/gameScripts/playEffect.ts` - SE 实现
- `packages/webgal/src/Stage/AudioContainer/AudioContainer.tsx` - 音频容器
- `packages/webgal/src/Core/gameScripts/getUserInput/index.tsx` - 输入对话框
- `packages/webgal/src/Core/gameScripts/choose/index.tsx` - 选择分支

### 命令类型枚举
- `commandType.say` = 0
- `commandType.bgm` = 11
- `commandType.playEffect` = 34
- `commandType.video` = 12
- `commandType.choose` = 18
- `commandType.getUserInput` = 39

---

## 贡献者
- 修复实施：AI Assistant (Claude Sonnet 4.5)
- 问题分析：基于 WebGAL 引擎源码和 exporter 实现的全面对比

