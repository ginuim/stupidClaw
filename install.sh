#!/bin/bash

# StupidClaw 自动化安装与启动脚本
# 遵循 Linus 哲学：不搞花里胡哨的进度条，只解决问题。

set -e

# --- 颜色定义 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 StupidClaw 自动化安装程序${NC}"
echo "------------------------------------------------"

# 1. 检查 Node.js 环境
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}检测到未安装 Node.js，正在尝试安装...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v brew &> /dev/null; then
            echo -e "${RED}错误: 请先安装 Homebrew (https://brew.sh/) 或手动下载 Node.js (https://nodejs.org/)${NC}"
            exit 1
        fi
        echo "正在通过 Homebrew 安装 Node.js..."
        brew install node
    elif [[ -f /etc/debian_version ]]; then
        echo "正在通过 apt 安装 Node.js..."
        sudo apt-get update && sudo apt-get install -y nodejs npm
    else
        echo -e "${RED}无法自动识别你的操作系统。请手动安装 Node.js (v20+): https://nodejs.org/${NC}"
        exit 1
    fi
fi

# 检查 Node.js 版本 (推荐 v20+)
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}警告: 建议使用 Node.js v20+ (当前: v$(node -v))。如果运行出错，请升级。${NC}"
fi

# 2. 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}正在安装 pnpm...${NC}"
    npm install -g pnpm || sudo npm install -g pnpm
fi

# 3. 安装依赖
echo -e "${YELLOW}📦 正在安装项目依赖...${NC}"
pnpm install

# 4. 初始化 .env 配置文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚙️  正在从 .env.example 初始化配置文件...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ 已生成 .env 文件，请手动编辑填写你的 API Key。${NC}"
else
    echo -e "${GREEN}✅ .env 配置文件已存在。${NC}"
fi

echo "------------------------------------------------"
echo -e "${GREEN}🎉 安装完成！${NC}"
echo -e "你可以通过以下命令启动项目:"
echo -e "${YELLOW}pnpm dev${NC}"
echo ""
echo -e "或者，你也可以使用更高级的 npx 方式在任何地方运行:"
echo -e "${YELLOW}npx stupid-claw${NC}"
