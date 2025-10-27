# WebGAL Exporter 开发增强计划（分解 + 单测要求）

最后更新：2025-10-27
负责人：Golenspade（实施） / Augment Agent（评审）
目标版本：0.2.x（迭代交付）

本文档列出最小任务单元（WBS），每一项附带：修改点、验收标准、单测要求、影响范围与回滚。

---

## 0. 基础准备（不改动依赖即可推进）
- DP-0.1 新增文档
  - 修改点：已添加 ENHANCEMENT_POD.md / DEVELOPMENT_PLAN.md
  - 验收：文档落库，计划清晰可执行
  - 单测：无
  - 回滚：直接删除文件即可

- DP-0.2 示例素材与脚本（可选）
  - 修改点：在 packages/exporter/examples/ 增加最小场景脚本描述与 README（不必改依赖）
  - 验收：本地可用 demo，便于手动校验
  - 单测：无（属手测辅助）
  - 回滚：删除示例文件

---

## 1. 执行流打通（P0）

- DP-1.1 标题页自动进入
  - 修改点：在 BrowserCapture.initialize 后，page.goto 成功后注入脚本，自动点击 '.title__enter-game-target'，并在 GUI.showTitle==false 前保持重试
  - 验收：不手动点击可进入游戏
  - 单测：JSDOM 单测（模拟按钮存在时会触发 click 计数）；导出时手动烟测
  - 影响：仅注入层
  - 回滚：移除注入段

- DP-1.2 自动推进下一句
  - 修改点：在捕获期间周期性调用 Page.keyboard.press('Space')（或触发 WebGAL.events.userInteractNext），节流 200–300ms；检测阻塞演出时暂停
  - 验收：无人工操作能推进 say/文本
  - 单测：用 spy 断言定时器与调用频率；JSDOM 模拟“阻塞时不触发”逻辑
  - 影响：注入层
  - 回滚：关闭该定时逻辑

- DP-1.3 完成判定修正
  - 修改点：替换 waitForSceneComplete 逻辑：改为“空闲窗口（如 3s 无 perform/文本/音频事件）且 GUI.showTitle==true 或 捕获到 end 指令”，否则继续；增加超时保护
  - 验收：不会在需要下一句时提前停止；end/回标题能正确结束
  - 单测：对轮询函数的纯函数化拆出并单测状态机；模拟事件时间戳和标志位
  - 影响：timelineCapture.waitForSceneComplete
  - 回滚：切回原判断

- DP-1.4 CLI 文本/自动速度注入（基础）
  - 修改点：根据 config.textSpeed / autoSpeed 在浏览器端覆盖 userData.optionData；若 autoSpeed 提供则启用自动推进的节奏
  - 验收：不同 textSpeed/autoSpeed 影响总时长（可观测）
  - 单测：构造注入函数的纯函数单测（生成补丁对象）；手测对比
  - 影响：注入层
  - 回滚：移除覆盖逻辑

---

## 2. 音频覆盖第一批（P0）

- DP-2.1 监听 vocal（#currentVocal）
  - 修改点：在注入脚本中获取 '#currentVocal'，监听 play/pause/ended/volumechange，记录 {type:'vocal', url, start/duration, volume}
  - 验收：说话语音被写入 timeline.json，对应轨进入混音
  - 单测：JSDOM 构造 audio 元素并触发事件，断言事件列表
  - 影响：timeline 注入、AudioReconstruction
  - 回滚：移除监听

- DP-2.2 捕获 SE（playEffect）
  - 修改点：两路并进：
    1）在 arrangeNewPerform hook 中，若 script.command=='playEffect'，即时记录一条 SE 事件（读取 sentence.content 作为 url、volume 参数）；
    2）在页面 MutationObserver 上，补充对动态 <audio> 的监听（若后续接入 DOM 也能抓到）
  - 验收：常见 SE 进入混音
  - 单测：对 1）进行纯函数单测（从 sentence 解析出事件）；对 2）做 JSDOM 事件单测
  - 影响：注入层、AudioReconstruction
  - 回滚：保留 1）去掉 2）

- DP-2.3 捕获视频音轨
  - 修改点：监听页面内 <video> 播放事件，记录 {type:'videoAudio', url, start/duration, volume}
  - 验收：带音轨的视频在最终导出可听见
  - 单测：JSDOM video 元素事件单测
  - 影响：注入层、AudioReconstruction、FFmpegMixer（多一种类型等同 SE）
  - 回滚：移除监听

- DP-2.4 FFmpeg 混音纳入 video 音轨
  - 修改点：AudioReconstruction 将 videoAudio 归类为 SE 组或独立组并参与 amix
  - 验收：最终 mixed.wav 包含视频音轨能量
  - 单测：对 buildAudioTracks 分组与 FFmpegMixer 输入计数进行单测（不真实跑 ffmpeg）
  - 影响：AudioReconstruction、FFmpegMixer
  - 回滚：还原类型映射

---

## 3. BGM 增强（P1）

- DP-3.1 记录 BGM enter（淡入/淡出）与 volume 变化
  - 修改点：监听 '#currentBgm' 的 volumechange；在 AudioContainer 触发淡入时记录 fadeIn/Out；如无法精准，至少记录起始/终止音量与近似时间窗
  - 验收：导出时能感知 BGM 的淡入/淡出
  - 单测：事件转轨道的函数单测；构造不同 enter 值
  - 影响：注入层、AudioReconstruction
  - 回滚：移除曲线，仅保留恒定音量

- DP-3.2 记录 BGM 切换/停止
  - 修改点：监听 play/pause/ended 与 src 变更，生成上一条 BGM 的 stop 点
  - 验收：连续两首 BGM 的接续边界正确
  - 单测：相邻事件转 duration 的单测
  - 影响：注入层、AudioReconstruction
  - 回滚：回退为“以下一次 BGM 的 start 估算”

- DP-3.3 基础 loop 支持
  - 修改点：若 loop=true，且有 loopEndTime 预估（来自总时长或下一事件），FFmpegMixer 使用 aloop 生成足量长度
  - 验收：长镜头中 BGM 无中断
  - 单测：计算 loop 次数/size 的纯函数单测
  - 影响：FFmpegMixer
  - 回滚：取消 aloop，改为延长轨长

---

## 4. CLI 覆盖与开发体验（P1）

- DP-4.1 应用 textSpeed / autoSpeed 到引擎
  - 修改点：在注入阶段覆写 userData.optionData 并触发相关 reducer
  - 验收：不同参数下总时长差异显著
  - 单测：配置到补丁对象的单测
  - 影响：注入层

- DP-4.2 详细日志与故障自检
  - 修改点：在 verbose 下输出：捕获到的音频事件摘要、空闲窗口触发点、amix 输入数
  - 验收：DEBUG 时能快速定位问题
  - 单测：日志生成函数的单测（纯函数）

---

## 5. 单元测试规划

- 测试框架建议：Vitest（与 monorepo 一致）。需要你执行：
  - 在 packages/exporter 下添加 devDependencies：vitest、@types/node、tsx（如需）
  - 在 package.json scripts 增加："test": "vitest run"、"test:watch": "vitest"
  - 注意：依赖安装需经你确认执行

- 目录结构建议：
  - packages/exporter/tests/
    - audioReconstruction.spec.ts
    - ffmpegMixer.spec.ts
    - deterministicInput.spec.ts
    - timelineCapture.spec.ts（字符串/选择器层面）
    - exporterOrchestrator.spec.ts（用 stub/mocks）

- 覆盖示例：
  1）audioReconstruction.spec.ts
     - BGM duration 由下一条 BGM 推导
     - resolveAudioPath 去掉 game/ 前缀
     - groupTracksByType 正确分组
  2）ffmpegMixer.spec.ts
     - 单轨道 filter 串生成（adelay/volume/afade/atrim）
     - 多轨 amix=inputs=N 语法生成
  3）deterministicInput.spec.ts
     - .Choose_item 与 #user-input/.button 选择器可命中
     - choiceIndex/inputIndex 自增逻辑
  4）timelineCapture.spec.ts
     - 注入字符串包含 arrangeNewPerform hook
     - 事件对象规范化（type/startTime/duration/data）
  5）exporterOrchestrator.spec.ts
     - 进度上报顺序与关键节点（init/capture/audio/encode/done）

---

## 6. 回归与手动验证清单
- 核心路径：
  - 启动 dev server（Vite）
  - 基础场景：say+wait+bgm+vocal+SE+playVideo+choose+getUserInput
  - 指定 branch-script 能自动走通
  - 输出：时长≈手动游玩、音频齐全
- 边界：
  - 快速切换 BGM
  - 长时间 wait / 大段字幕
  - 视频与 BGM 同时存在的优先级

---

## 7. PR 清单
- [ ] 变更说明（含影响面/兼容性）
- [ ] 单测通过与覆盖范围说明
- [ ] 示例导出的视频/日志（或链接）
- [ ] 回滚方案简述

---

## 8. 任务甘特（建议顺序）
1) DP-1.1, DP-1.2, DP-1.3（打通流程）
2) DP-2.1, DP-2.2, DP-2.3, DP-2.4（音频第一批）
3) DP-3.1, DP-3.2, DP-3.3（BGM 增强）
4) DP-4.1, DP-4.2（CLI/日志）

---

## 9. 变更影响与回滚策略
- 注入脚本变更均“可拔插”——通过 feature flag（配置项或 verbose 开关）控制
- 节点级修改（AudioReconstruction/FFmpegMixer）保持向后兼容：未知事件类型忽略
- 任一子任务如导致不稳定，先回退该子任务再分支修复

---

（完）
