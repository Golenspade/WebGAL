# WebGAL Exporter - 测试状态报告

**日期**: 2025-10-27  
**分支**: mov_gen  
**最新提交**: 5c1dabbe

---

## 提交总结（最近 10 个提交）

```
5c1dabbe (HEAD) fix(exporter): remove TypeScript annotations from browser injection code  ⭐
3b5cb0bf        fix(exporter): improve WebGAL detection and add debug logging
aea6131a        fix(exporter): remove TypeScript syntax from browser injection script  ⭐
7a2b87b1        test(exporter): add comprehensive test suite and guide
572c82be        feat(exporter): make DP-1.2 cooldown/backoff configurable  ⭐
50434348        docs(exporter): add comprehensive DP-1.2 enhancement report
0ffc251e        docs(exporter): update DP-1.2 status with enhancement details
b1c1e799        feat(exporter): enhance DP-1.2 with cooldown and advance confirmation  ⭐
b57daded        docs(exporter): add comprehensive audit response report
c119ad03        fix(exporter): skip auto-advance when interactive elements present  ⭐
```

---

## 关键修复

### 1. 可配置冷却/退避 (572c82be)

**问题**: 冷却和退避时间硬编码，无法根据 autoSpeed 动态调整

**解决方案**:
```javascript
const COOLDOWN_MS = window.__AUTO_COOLDOWN__ ?? 600;
const BACKOFF_MS = window.__AUTO_BACKOFF__ ?? 2000;
```

**影响**: 为 DP-1.4 集成准备就绪

---

### 2. TypeScript 语法移除 (aea6131a, 5c1dabbe)

**问题**: 浏览器注入脚本包含 TypeScript 语法导致运行时错误

**错误日志**:
```
SyntaxError: Unexpected identifier 'as'
at appendChild in browser context
```

**解决方案**:
- 移除 `(window as any)` 类型断言
- 移除所有 `@ts-expect-error` 注释（在模板字符串内）
- 确保注入代码是纯 JavaScript

**验证**: 构建后检查 `build/utils/deterministicInput.js` 无 TypeScript 语法

---

### 3. WebGAL 检测改进 (3b5cb0bf)

**问题**: `window.WebGAL` 检测不一致，导致自动推进未启动

**解决方案**:
- 使用全局 `WebGAL` 而非 `window.WebGAL`（与 timelineCapture 一致）
- 添加 `clearInterval` 防止重复启动
- 添加 30 秒超时清理
- 添加详细调试日志（每 5 秒输出一次状态）

**调试日志**:
```javascript
console.log('[Auto] Waiting for WebGAL... (check:', checkCount, 'WebGAL:', hasWebGAL, 'gameplay:', hasGameplay, 'controller:', hasController, ')');
```

---

## 测试基础设施

### 测试场景

1. **test-basic.txt** - 基础功能
   - 自动进入游戏
   - 对话推进
   - BGM、语音、音效捕获

2. **test-choice.txt** - 选择分支
   - 选择对话框检测
   - 自动选择（根据 branch script）
   - 分支跳转

3. **test-input.txt** - 用户输入
   - 输入对话框检测
   - 自动填写
   - 继续推进

### 测试脚本

- **test-run.sh**: 自动化测试运行器
- **TEST_GUIDE.md**: 完整测试文档

---

## 当前状态

### ✅ 已完成

- [x] 可配置冷却/退避参数
- [x] 移除 TypeScript 语法错误
- [x] 改进 WebGAL 检测逻辑
- [x] 添加详细调试日志
- [x] 创建测试场景和脚本
- [x] 编写测试文档

### ⏳ 待测试

- [ ] 基础功能测试（test-basic.txt）
- [ ] 选择分支测试（test-choice.txt）
- [ ] 用户输入测试（test-input.txt）
- [ ] 长动画场景测试
- [ ] 快速对话场景测试

### 🔍 已知问题

#### 问题 1: 自动推进未启动

**症状**:
```
[Browser] [Timeline] scene_start 103ms
[Browser] [Timeline] bgm 118ms
[Browser] [Exporter] Timeout waiting for WebGAL
```

**分析**:
- 没有看到 `[Auto] Waiting for WebGAL...` 日志
- 说明 deterministicInput 脚本未执行或执行失败
- 可能原因：
  1. 脚本注入失败
  2. 脚本执行时抛出异常
  3. WebGAL 对象结构与预期不符

**下一步调试**:
1. 在浏览器控制台手动检查 `window.__AUTO_ADVANCE_ENABLED__`
2. 检查是否有 JavaScript 错误
3. 验证 `WebGAL.gameplay.performController` 是否存在
4. 添加 try-catch 包裹整个脚本

---

## 调试建议

### 1. 手动浏览器测试

```bash
# 启动 WebGAL 开发服务器
yarn webgal:dev  # 端口 3001

# 在浏览器中打开
open http://localhost:3001

# 打开开发者工具，在控制台执行
typeof WebGAL
WebGAL.gameplay
WebGAL.gameplay.performController
```

### 2. 检查注入脚本

```bash
# 查看生成的 JavaScript
cat packages/exporter/build/utils/deterministicInput.js | head -100

# 确认无 TypeScript 语法
grep -E "as any|@ts-expect-error" packages/exporter/build/utils/deterministicInput.js
```

### 3. 添加全局错误捕获

在 `DETERMINISTIC_INPUT_SCRIPT` 开头添加：

```javascript
window.addEventListener('error', (e) => {
  console.error('[Auto] Global error:', e.message, e.filename, e.lineno);
});

try {
  // 现有代码
} catch (e) {
  console.error('[Auto] Script error:', e);
}
```

---

## 下一步行动

### 立即任务

1. **调试自动推进未启动问题**
   - 添加全局错误捕获
   - 在浏览器中手动验证 WebGAL 对象
   - 检查脚本注入时机

2. **运行基础测试**
   ```bash
   cd packages/exporter
   node build/cli/index.js export test-scenes/test-basic.txt \
     -o test-output/test-basic.mp4 \
     -u http://localhost:3001 \
     -v
   ```

3. **分析日志输出**
   - 查找 `[Auto]` 日志
   - 检查 WebGAL 检测状态
   - 验证推进尝试

### 短期任务

1. **完成 P0 测试验证**
   - 所有测试场景通过
   - 生成视频文件
   - 验证音频混音

2. **补充单元测试**
   - 设置 Vitest
   - 测试纯函数逻辑
   - 测试选择器匹配

3. **实现 DP-1.4**
   - CLI 参数注入
   - 动态调整冷却时间
   - 联动 autoSpeed

---

## 测试环境

- **Node.js**: v18+
- **Yarn**: 1.22.22
- **WebGAL 服务器**: http://localhost:3001
- **FFmpeg**: 已安装
- **Playwright**: Chromium 浏览器

---

## 联系与支持

如遇问题，请提供：
1. 完整错误日志（使用 `-v` 选项）
2. 测试场景文件
3. 浏览器控制台截图
4. 系统信息

---

**状态**: 🔧 调试中  
**下一里程碑**: P0 功能全部测试通过

