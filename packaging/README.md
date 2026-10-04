# 打包与分发

本目录存放各 Linux 发行渠道的打包配置。AppImage 与 deb 由 electron-builder 在
CI 中产出，这里补充两个「用户实际习惯使用的安装入口」。

| 路径 | 用途 |
|---|---|
| `aur/PKGBUILD` | AUR 包，供 Arch / Manjaro 用户安装 |
| `flatpak/com.kongling.mail.yml` | Flathub 构建清单 |
| `flatpak/com.kongling.mail.metainfo.xml` | AppStream 元数据（应用商店展示信息） |
| `flatpak/com.kongling.mail.desktop` | 桌面入口 |
| `flatpak/com.kongling.mail.png` | 应用图标（512×512） |
| `flatpak/screenshots/` | 商店展示截图 |

---

## AUR

包名 **`kongling-mail-bin`**，从 GitHub Release 的 AppImage 直接打包（`-bin` 后缀
表示二进制包，AUR 上 Electron 应用的通行做法）。

### 首次发布前的准备

1. 在 <https://aur.archlinux.org> 注册账号
2. 登录后进入 **My Account**，把本机公钥内容粘贴到 **SSH Public Key**：

   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

3. 验证认证是否生效（出现欢迎语即成功）：

   ```bash
   ssh aur@aur.archlinux.org
   ```

### 发布新版本

```bash
cd packaging/aur

# 1. 更新版本号
sed -i "s/^pkgver=.*/pkgver=0.2.4/" PKGBUILD

# 2. 自动下载新安装包并写入 sha256（pacman-contrib 提供）
updpkgsums

# 3. 本地构建验证，确认能正常打包再上传
makepkg -f

# 4. 生成 AUR 必需的元数据文件
makepkg --printsrcinfo > .SRCINFO

# 5. 推送到 AUR
git clone ssh://aur@aur.archlinux.org/kongling-mail-bin.git /tmp/aur-pkg
cp PKGBUILD .SRCINFO /tmp/aur-pkg/
cd /tmp/aur-pkg
git add -A
git commit -m "upgpkg: kongling-mail-bin 0.2.4"
git push
```

> 不想手动下载安装包算校验和？CI 每次发版都会把各产物的 sha256 写进
> Actions 运行摘要（`Print package checksums` 步骤），复制过来即可。

`makepkg` 会自动校验 `PKGBUILD` 里声明的依赖是否齐全。想额外做质量检查可安装
`namcap` 并运行 `namcap PKGBUILD kongling-mail-bin-*.pkg.tar.zst`。

---

## Flatpak / Flathub

清单基于 `org.electronjs.Electron2.BaseApp`，用 `zypak` 接管进程模型，因此不打进
自带的 Electron 二进制。源指向 GitHub Release 的 **tar.gz** 产物（`electron-builder.yml`
中的 `tar.gz` 目标，供 Flatpak 打包使用）。

### 本地校验（不需要 root）

Flathub 的构建由它自己的服务器完成，本地只做元数据体检：

```bash
cd packaging/flatpak
appstreamcli validate --no-net com.kongling.mail.metainfo.xml
desktop-file-validate com.kongling.mail.desktop
```

想本地完整构建（需自行安装 `flatpak-builder` 与对应运行时）：

```bash
flatpak install flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 \
  org.electronjs.Electron2.BaseApp//24.08
flatpak-builder --force-clean --repo=repo build-dir com.kongling.mail.yml
flatpak build-bundle repo kongling-mail.flatpak com.kongling.mail
```

### 提交到 Flathub

1. Fork <https://github.com/flathub/flathub>
2. 新建分支，分支名必须是应用 ID：`com.kongling.mail`
3. 在该分支根目录放入清单与元数据文件（`com.kongling.mail.yml`、`.metainfo.xml`、
   `.desktop`、`.png`）
4. 提交 Pull Request，并在 PR 中评论 `bot, build` 触发 Flathub 的测试构建
5. 构建通过后等待人工审核。审核通过会新建 `flathub/com.kongling.mail` 仓库，
   后续版本更新直接在**那个仓库**里改清单并提 PR 即可

> 首次提审通常会有几轮来回，主要集中在元数据规范（截图、分类、描述措辞）。

---

## 版本更新时需要同步的地方

| 文件 | 需要改什么 |
|---|---|
| `packaging/aur/PKGBUILD` | `pkgver`、`sha256sums` |
| `packaging/flatpak/com.kongling.mail.yml` | `source` 的 `url` 与 `sha256` |
| `packaging/flatpak/com.kongling.mail.metainfo.xml` | `<releases>` 增加一条 `<release>` |

`com.kongling.mail.yml` 里的 `x-checker-data` 已配置 GitHub 版本检查，Flathub 的
自动更新机器人会在上游发版后自动提 PR，通常无需手动改。

---

## 已知待办

- **许可协议尚未统一**：仓库根目录的 `LICENSE` 是 GPL-3.0 全文，而 `package.json`
  与打包产物标注的是 MIT。上架前必须二选一，`PKGBUILD` 的 `license=` 与
  `metainfo.xml` 的 `<project_license>` 都要跟着改。（当前均按 MIT 填写）
