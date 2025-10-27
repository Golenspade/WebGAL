#!/bin/bash
# WebGAL Exporter - 测试运行脚本
# 验证 P0 功能：自动进入、自动推进、音频捕获、选择/输入自动化

set -e  # 遇到错误立即退出

echo "=========================================="
echo "WebGAL Exporter - P0 功能测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
run_test() {
  local test_name=$1
  local scene_file=$2
  local branch_file=$3
  local output_file=$4
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  echo -e "${YELLOW}[测试 $TOTAL_TESTS] $test_name${NC}"
  echo "场景文件: $scene_file"
  if [ -n "$branch_file" ]; then
    echo "分支文件: $branch_file"
  fi
  echo "输出文件: $output_file"
  echo ""
  
  # 构建命令
  local cmd="node build/cli/index.js export $scene_file -o $output_file -u http://localhost:3001 -v"
  if [ -n "$branch_file" ]; then
    cmd="$cmd -b $branch_file"
  fi
  
  echo "执行命令: $cmd"
  echo ""
  
  # 运行测试
  if eval $cmd; then
    echo -e "${GREEN}✓ 测试通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    # 检查输出文件
    if [ -f "$output_file" ]; then
      local file_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)
      echo "输出文件大小: $file_size bytes"
    else
      echo -e "${RED}⚠ 警告: 输出文件未生成${NC}"
    fi
  else
    echo -e "${RED}✗ 测试失败${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  
  echo ""
  echo "=========================================="
  echo ""
}

# 确保构建产物存在
if [ ! -d "build" ]; then
  echo "构建产物不存在，正在构建..."
  yarn build
  echo ""
fi

# 创建输出目录
mkdir -p test-output

# 测试 1: 基础功能（自动进入、对话推进、音频捕获）
run_test \
  "基础功能测试" \
  "test-scenes/test-basic.txt" \
  "" \
  "test-output/test-basic.mp4"

# 测试 2: 选择分支（选择自动化）
run_test \
  "选择分支测试" \
  "test-scenes/test-choice.txt" \
  "test-scenes/test-choice-branch.json" \
  "test-output/test-choice.mp4"

# 测试 3: 用户输入（输入自动化）
run_test \
  "用户输入测试" \
  "test-scenes/test-input.txt" \
  "test-scenes/test-input-branch.json" \
  "test-output/test-input.mp4"

# 输出测试总结
echo ""
echo "=========================================="
echo "测试总结"
echo "=========================================="
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
if [ $FAILED_TESTS -gt 0 ]; then
  echo -e "${RED}失败: $FAILED_TESTS${NC}"
else
  echo "失败: $FAILED_TESTS"
fi
echo ""

# 计算成功率
if [ $TOTAL_TESTS -gt 0 ]; then
  SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
  echo "成功率: $SUCCESS_RATE%"
  echo ""
fi

# 列出生成的文件
echo "生成的输出文件:"
ls -lh test-output/*.mp4 2>/dev/null || echo "无输出文件"
echo ""

# 退出码
if [ $FAILED_TESTS -gt 0 ]; then
  echo -e "${RED}测试失败！${NC}"
  exit 1
else
  echo -e "${GREEN}所有测试通过！${NC}"
  exit 0
fi

