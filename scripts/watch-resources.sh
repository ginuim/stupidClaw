#!/usr/bin/env sh
# 监控 stupid-claw 进程的资源占用
# 用法: ./scripts/watch-resources.sh [间隔秒数，默认 2]

INTERVAL="${1:-2}"

find_pid() {
  # 优先匹配实际跑业务的 node/tsx 进程（RSS 最大的通常是主进程）
  ps -eo pid,rss,command | grep -E 'tsx.*index|node.*tsx.*index' | grep -v grep | sort -k2 -rn | head -1 | awk '{print $1}'
}

main() {
  pid=$(find_pid)
  if [ -z "$pid" ]; then
    echo "未找到 stupid-claw 进程，请先运行 pnpm dev"
    exit 1
  fi

  echo "监控 PID=$pid (按 Ctrl+C 退出)"
  echo "PID      RSS(KB)  VSZ(KB)  CPU%  MEM%  COMMAND"
  echo "------------------------------------------------------"

  while true; do
    ps -p "$pid" -o pid=,rss=,vsz=,%cpu=,%mem=,comm= 2>/dev/null || break
    sleep "$INTERVAL"
  done
}

main
