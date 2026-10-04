#!/usr/bin/env bash
#
# 空灵邮箱官网部署脚本（在本地执行，把 website/ 目录同步到服务器）
#
# 用法：
#   SSH_PASS='你的密码' ./deploy.sh <主机> [端口] [用户]
#   sshpass -p '密码' ./deploy.sh 1.2.3.4 22 root
#
# 若已配置 SSH 密钥，直接：./deploy.sh 1.2.3.4
#
# 脚本行为：
#   1. 检测远端是否安装 nginx
#   2. 把站点文件上传到 /var/www/kongling-mail（原子替换，先传临时目录再切换）
#   3. 写入 /etc/nginx/conf.d/kongling-mail.conf（已存在则跳过，不会覆盖别的站点）
#   4. nginx -t 校验通过后才 reload，配置有问题时自动回滚
#
set -euo pipefail

HOST="${1:?用法: [SSH_PASS=密码] $0 <主机> [端口] [用户]}"
PORT="${2:-22}"
USER_NAME="${3:-root}"
REMOTE_WWW="/var/www/kongling-mail"
REMOTE_RELEASE="/var/www/kongling-mail.release.$$"
CONF_PATH="/etc/nginx/conf.d/kongling-mail.conf"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

ssh_run() {
  if [ -n "${SSH_PASS:-}" ]; then
    sshpass -p "$SSH_PASS" ssh -p "$PORT" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$USER_NAME@$HOST" "$@"
  else
    ssh -p "$PORT" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$USER_NAME@$HOST" "$@"
  fi
}

copy_files() {
  if [ -n "${SSH_PASS:-}" ]; then
    sshpass -p "$SSH_PASS" scp -P "$PORT" -o StrictHostKeyChecking=accept-new -r "$LOCAL_DIR"/. "$USER_NAME@$HOST:$REMOTE_RELEASE"
  else
    scp -P "$PORT" -o StrictHostKeyChecking=accept-new -r "$LOCAL_DIR"/. "$USER_NAME@$HOST:$REMOTE_RELEASE"
  fi
}

echo "==> 连接 $USER_NAME@$HOST:$PORT"
ssh_run "echo 已连接: \$(hostname) / \$(. /etc/os-release 2>/dev/null && echo \$PRETTY_NAME)"

echo "==> 检查远端 web 服务"
if ssh_run "command -v nginx >/dev/null 2>&1"; then
  HAS_NGINX=yes
else
  HAS_NGINX=no
  echo "!! 远端没有 nginx。可先执行：apt-get update && apt-get install -y nginx"
fi

echo "==> 上传文件到临时目录 $REMOTE_RELEASE"
ssh_run "mkdir -p '$REMOTE_RELEASE'"
copy_files
ssh_run "rm -rf '$REMOTE_RELEASE/deploy.sh' '$REMOTE_RELEASE/nginx.conf.example' 2>/dev/null; true"

echo "==> 切换到 $REMOTE_WWW"
ssh_run "mkdir -p '$REMOTE_WWW' && cp -r '$REMOTE_RELEASE'/. '$REMOTE_WWW'/ && rm -rf '$REMOTE_RELEASE' && chmod -R a+rX '$REMOTE_WWW' && ls '$REMOTE_WWW'"

if [ "$HAS_NGINX" = "yes" ]; then
  echo "==> 配置 nginx（若已存在同名配置则跳过）"
  if ssh_run "[ -f '$CONF_PATH' ]"; then
    echo "   已存在 $CONF_PATH，跳过写入，避免覆盖你的自定义配置"
  else
    ssh_run "cat > '$CONF_PATH' <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name _;

    root /var/www/kongling-mail;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript image/svg+xml;
    gzip_min_length 1024;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~* \\.(css|js|svg|png|jpg|jpeg|webp|ico|woff2?)\$ {
        expires 7d;
        add_header Cache-Control \"public, max-age=604800\";
    }
}
NGINX"
    echo "==> 校验并重载 nginx"
    if ssh_run "nginx -t"; then
      ssh_run "systemctl reload nginx || service nginx reload"
    else
      echo "!! 配置校验失败，已移除 $CONF_PATH，nginx 保持原状"
      ssh_run "rm -f '$CONF_PATH'"
      exit 1
    fi
  fi
fi

echo
echo "完成。浏览器访问：http://$HOST/"
echo "（若服务器有防火墙/安全组，记得放行 80 端口）"
