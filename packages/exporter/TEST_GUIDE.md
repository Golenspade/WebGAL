# WebGAL Exporter - 测试指南

## 测试准备

### 1. 启动 WebGAL 开发服务器

在**根目录**运行：

```bash
yarn webgal:dev
```

这将启动 WebGAL 开发服务器在 `http://localhost:3000`。

**验证服务器启动**：
- 浏览器访问 http://localhost:3000
- 应该看到 WebGAL 标题页

### 2. 构建 Exporter

在 `packages/exporter` 目录运行：

```bash
yarn build
```

**验证构建成功**：
- `build/` 目录存在
- `build/cli/index.js` 存在

---

## 运行测试

### 方式 1: 使用测试脚本（推荐）

```bash
cd packages/exporter
./test-run.sh
```

这将自动运行所有测试场景：
1. 基础功能测试（自动进入、对话推进、音频捕获）
2. 选择分支测试（选择自动化）
3. 用户输入测试（输入自动化）

### 方式 2: 手动运行单个测试

#### 测试 1: 基础功能

```bash
cd packages/exporter
node build/cli/index.js export test-scenes/test-basic.txt \
  -o test-output/test-basic.mp4 \
  -v
```

**验证点**：
- ✅ 自动点击标题页进入游戏
- ✅ 自动推进所有对话
- ✅ 捕获 BGM、语音、音效
- ✅ 正确结束（检测到 end 命令）

#### 测试 2: 选择分支

```bash
cd packages/exporter
node build/cli/index.js export test-scenes/test-choice.txt \
  -b test-scenes/test-choice-branch.json \
  -o test-output/test-choice.mp4 \
  -v
```

**验证点**：
- ✅ 检测到选择对话框
- ✅ 根据 branch script 自动选择选项 B（索引 1）
- ✅ 跳转到正确分支
- ✅ 继续推进直到结束

#### 测试 3: 用户输入

```bash
cd packages/exporter
node build/cli/index.js export test-scenes/test-input.txt \
  -b test-scenes/test-input-branch.json \
  -o test-output/test-input.mp4 \
  -v
```

**验证点**：
- ✅ 检测到输入对话框
- ✅ 根据 branch script 自动填写输入
- ✅ 点击确定按钮
- ✅ 继续推进直到结束

---

## 验证 DP-1.2 增强功能

### 冷却窗口测试

创建一个包含快速对话的场景：

```webgal
; test-rapid.txt
快速对话 1;
快速对话 2;
快速对话 3;
快速对话 4;
快速对话 5;
end;
```

运行导出并观察日志：

```bash
node build/cli/index.js export test-rapid.txt -o test-rapid.mp4 -v
```

**预期行为**：
- 每次推进间隔至少 600ms
- 无连跳现象
- 日志显示稳定的推进节奏

### 长动画测试

创建包含长动画的场景：

```webgal
; test-animation.txt
开始;
setAnimation:fadeIn -duration=2000;
长动画期间;
setAnimation:fadeOut -duration=2000;
结束;
end;
```

运行导出：

```bash
node build/cli/index.js export test-animation.txt -o test-animation.mp4 -v
```

**预期行为**：
- 动画期间不触发推进（performList > 0）
- 动画完成后自动推进
- 无抖动或穿透现象

### 失败退避测试

创建一个可能导致推进失败的场景（例如长视频）：

```webgal
; test-video.txt
开始;
playVideo:long-video.mp4;
视频后;
end;
```

**预期行为**：
- 前 3 次失败使用 600ms 冷却
- 第 3 次失败后切换到 2000ms 退避
- 视频结束后成功推进，重置失败计数

---

## 验证输出

### 检查视频文件

```bash
ls -lh test-output/
```

**预期**：
- 所有测试场景都生成了 .mp4 文件
- 文件大小 > 0

### 播放视频

使用任意视频播放器播放生成的视频：

```bash
open test-output/test-basic.mp4  # macOS
# 或
vlc test-output/test-basic.mp4   # Linux/Windows
```

**验证点**：
- ✅ 视频可以正常播放
- ✅ 画面流畅，无卡顿
- ✅ 音频同步正确
- ✅ 对话按预期顺序出现
- ✅ 选择/输入按预期执行

### 检查音频混音

使用 ffprobe 检查音频轨道：

```bash
ffprobe -v error -show_entries stream=codec_name,codec_type test-output/test-basic.mp4
```

**预期输出**：
```
codec_name=h264
codec_type=video
codec_name=aac
codec_type=audio
```

---

## 常见问题排查

### 问题 1: WebGAL 服务器未启动

**症状**：
```
Error: Failed to navigate to http://localhost:3000
```

**解决**：
```bash
# 在根目录启动服务器
cd /path/to/WebGAL
yarn webgal:dev
```

### 问题 2: 构建产物不存在

**症状**：
```
Error: Cannot find module './build/cli/index.js'
```

**解决**：
```bash
cd packages/exporter
yarn build
```

### 问题 3: 测试场景文件找不到

**症状**：
```
Error: ENOENT: no such file or directory, open 'test-scenes/test-basic.txt'
```

**解决**：
确保在 `packages/exporter` 目录运行命令。

### 问题 4: 权限错误

**症状**：
```
Permission denied: ./test-run.sh
```

**解决**：
```bash
chmod +x test-run.sh
```

### 问题 5: FFmpeg 未安装

**症状**：
```
Error: FFmpeg not found
```

**解决**：
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# 下载并安装 FFmpeg from https://ffmpeg.org/download.html
```

---

## 性能基准

### 预期性能指标

| 场景 | 对话数 | 预期时长 | 推进成功率 |
|------|--------|----------|-----------|
| test-basic | 8 | ~10s | >95% |
| test-choice | 5 | ~8s | >95% |
| test-input | 4 | ~6s | >95% |

### 推进统计（DP-4.2 实现后）

未来将输出详细统计：
- 推进尝试次数
- 推进成功次数
- 推进成功率
- 跳过原因分布
- 平均冷却时间
- 最大连续失败次数

---

## 下一步测试

### P1 功能测试（待实现）

1. **DP-1.4: CLI 参数注入**
   ```bash
   node build/cli/index.js export test-basic.txt \
     -o test-basic-fast.mp4 \
     --text-speed 10 \
     --auto-speed 300 \
     -v
   ```

2. **DP-3.x: BGM 增强**
   - 测试 BGM 淡入淡出
   - 测试 BGM 切换
   - 测试 BGM 循环

3. **DP-4.2: 详细日志**
   - 验证统计输出
   - 验证故障自检

### 压力测试

创建长场景（100+ 对话）测试：
- 内存稳定性
- 推进稳定性
- 音频同步准确性

---

## 测试清单

### P0 功能验证 ✅

- [x] 标题页自动进入
- [x] 对话自动推进
- [x] 选择自动化
- [x] 输入自动化
- [x] BGM 捕获
- [x] 语音捕获
- [x] 音效捕获
- [x] 视频音轨捕获
- [x] UI 音效捕获
- [x] 完成判定
- [x] 冷却窗口
- [x] 成功确认
- [x] 自适应退避

### P1 功能验证 📋

- [ ] textSpeed 注入
- [ ] autoSpeed 注入
- [ ] BGM 淡入淡出
- [ ] BGM 切换
- [ ] BGM 循环
- [ ] 详细日志
- [ ] 故障自检

### 质量验证 📋

- [ ] 单元测试
- [ ] 集成测试
- [ ] 压力测试
- [ ] 性能基准

---

## 报告问题

如果发现问题，请提供：

1. **复现步骤**
2. **测试场景文件**
3. **完整错误日志**（使用 `-v` 选项）
4. **系统信息**（OS、Node 版本、FFmpeg 版本）
5. **预期行为 vs 实际行为**

---

**祝测试顺利！** 🎉

