#!/bin/bash
# 把本目录初始化为 git 仓库并推送到你的 GitHub。
#
# 用法：
#   ./setup-and-push.sh <GitHub用户名> [仓库名]
#
# 仓库名默认 bilibili-qx-rules。
#
# 若已导出 GITHUB_TOKEN（需 repo 权限），脚本会自动创建远程仓库并免交互推送；
# 否则请先在 https://github.com/new 手动建好空仓库（不要勾选 README/.gitignore），
# 再运行本脚本，push 时按提示输入用户名和 Personal Access Token 作为密码。

set -euo pipefail

GH_USER="${1:-}"
GH_REPO="${2:-bilibili-qx-rules}"

if [ -z "$GH_USER" ]; then
  echo "用法: $0 <GitHub用户名> [仓库名]" >&2
  exit 1
fi

cd "$(dirname "$0")"

echo "==> 将占位符替换为 $GH_USER/$GH_REPO"
for f in module/bilibili-qx.conf module/bilibili-qx-safe.conf README.md; do
  # macOS 与 GNU sed 兼容写法
  perl -pi -e "s/__GH_USER__/${GH_USER}/g; s/__GH_REPO__/${GH_REPO}/g" "$f"
  echo "    已处理 $f"
done

if grep -rq '__GH_USER__\|__GH_REPO__' module README.md 2>/dev/null; then
  echo "!! 仍有未替换的占位符，请检查" >&2
  exit 1
fi

if [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "==> 检测到 GITHUB_TOKEN，尝试创建远程仓库"
  code=$(curl -s -o /tmp/gh_create_resp.json -w '%{http_code}' \
    -X POST https://api.github.com/user/repos \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -d "{\"name\":\"${GH_REPO}\",\"description\":\"Quantumult X bilibili 去广告规则（修复评论区加载失败）\",\"private\":false}")
  case "$code" in
    201) echo "    仓库创建成功" ;;
    422) echo "    仓库已存在，跳过创建" ;;
    *)   echo "!! 创建失败 HTTP $code:"; cat /tmp/gh_create_resp.json; exit 1 ;;
  esac
  ORIGIN="https://${GH_USER}:${GITHUB_TOKEN}@github.com/${GH_USER}/${GH_REPO}.git"
else
  echo "==> 未设置 GITHUB_TOKEN，假定远程空仓库已手动创建"
  ORIGIN="https://github.com/${GH_USER}/${GH_REPO}.git"
fi

echo "==> 初始化本地仓库"
rm -rf .git
git init -q
git symbolic-ref HEAD refs/heads/main
git add .
git -c user.name="${GH_USER}" -c user.email="${GH_USER}@users.noreply.github.com" \
    commit -q -m "bilibili 去广告规则：修复开启后评论区无法加载"

echo "==> 推送到 $GH_USER/$GH_REPO (main)"
git remote add origin "$ORIGIN"
git push -u origin main

# 推送后立即清掉可能含 token 的 remote URL
git remote set-url origin "https://github.com/${GH_USER}/${GH_REPO}.git"

cat <<EOF

完成。Quantumult X 里把原来的链接替换为：

  https://raw.githubusercontent.com/${GH_USER}/${GH_REPO}/main/module/bilibili-qx.conf

保险档（推荐档仍偶发评论区失败时改用）：

  https://raw.githubusercontent.com/${GH_USER}/${GH_REPO}/main/module/bilibili-qx-safe.conf

改完请重启网络扩展，并杀掉 B 站后台重新打开。
EOF
