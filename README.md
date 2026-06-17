# 港股打新监控面板

一个本地运行的港股打新监控面板，用来跟踪当前可认购 IPO、实时参考认购倍数、截止前关键时间点、资金错峰机会，以及后续可接入的 Telegram 提醒。

> 数据仅作为非官方参考，不构成 IPO 申购建议或投资建议。正式中签率、公开发售认购倍数、定价和上市表现应以港交所公告、配售结果公告及券商官方信息为准。

## 主要功能

- 展示当前可认购的港股 IPO。
- 记录每次抓取到的实时参考认购倍数，沉淀本地历史快照。
- 按 `48h / 36h / 24h / 12h / 8h / 4h / final` 观察截止前认购倍数变化。
- 用折线图对比当前机会和历史样本。
- 识别资金错峰窗口，例如 A 出结果后，资金是否还能赶上 B 的认购截止。
- 生成本地提醒记录，包括截止提醒、热度提醒、加速提醒。
- 预留 Telegram 通知配置，后续可把提醒发送到指定聊天。

## 数据来源

当前默认抓取华盛/VBKR 的港股 IPO 页面：

```text
https://www.vbkr.com/ipo/hk/v2/ipo-hk-index
```

页面里的 `applyRate` 会被保存为 `estimated_margin_multiple`，也就是“实时参考认购倍数”。它不是正式公开发售认购倍数，正式结果需要等配售结果公告。

## 环境要求

- Node.js `>= 24.0.0`
- 本地文件系统可写入 SQLite 数据库

项目使用 Node 内置 `node:sqlite`，运行测试或服务时可能看到 SQLite 实验性 API 的 warning，这是 Node 当前状态导致的，不影响功能。

## 安装与运行

```bash
npm install
npm test
npm start
```

启动后打开：

```text
http://localhost:4188
```

注意：在当前项目目录里执行 `npm start`，启动的是本机 Node 服务，默认读取和写入本机数据库：

```text
data/hk-ipo-monitor.sqlite
```

它不会自动连接服务器上的数据库。因此，本机 `localhost:4188` 和服务器上的数据可能不同。如果本机服务中途关闭过，本机历史曲线就会缺少那段时间的快照。

## 查看服务器上的数据

如果服务已经部署在 `dj` 服务器上，并且服务器上的 `hk-ipo-monitor.service` 正在后台运行，推荐用 SSH 隧道直接访问服务器服务。

不要先执行本机 `npm start`。推荐固定使用本机 `4189` 端口访问服务器数据，避免和本机服务的 `4188` 端口混在一起。

如果之前建过 SSH 隧道，或者电脑换过网络/IP，先清理旧隧道再重建。直接复制执行下面这一整段：

```bash
TUNNEL_PORT=4189
TUNNEL_SOCKET="$HOME/.ssh/hk-ipo-monitor-tunnel.sock"
ssh -S "$TUNNEL_SOCKET" -O exit dj 2>/dev/null || true
rm -f "$TUNNEL_SOCKET"
PIDS=$(lsof -tiTCP:$TUNNEL_PORT -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$PIDS" ]; then kill $PIDS; fi
ssh -fN -M -S "$TUNNEL_SOCKET" -L "$TUNNEL_PORT:127.0.0.1:4188" dj
```

然后在浏览器打开：

```text
http://localhost:4189
```

这时页面虽然是从本机浏览器打开的，但实际访问的是 `dj` 服务器上的服务和服务器上的 SQLite 数据库。

如果需要手动关闭这个后台隧道，可以执行：

```bash
ssh -S "$HOME/.ssh/hk-ipo-monitor-tunnel.sock" -O exit dj 2>/dev/null || true
```

## 把服务器数据库拷回本机

如果只是想在本机离线查看或调试某一刻的服务器数据，可以把服务器数据库复制回来：

```bash
mkdir -p data
scp dj:~/apps/hk-ipo-monitor/data/hk-ipo-monitor.sqlite data/hk-ipo-monitor.sqlite
npm start
```

这种方式只是复制数据库快照，不会持续同步。执行 `npm start` 后，本机服务仍然会按本机定时任务继续抓取并写入本机数据库；长期历史数据仍以服务器后台服务为准。

## 手动刷新

页面右上角的“刷新”按钮会触发一次实时抓取。

也可以在命令行执行：

```bash
npm run refresh
```

## 自动刷新

运行 `npm start` 后，服务会启动后台刷新循环：

- 有当前可认购 IPO：默认每 1 小时抓取一次。
- 没有当前可认购 IPO：默认每 4 小时抓取一次。
- 服务刚启动时会立即抓取一次。

可以通过环境变量调整刷新间隔：

```bash
HK_IPO_ACTIVE_REFRESH_MS=3600000 HK_IPO_IDLE_REFRESH_MS=14400000 npm start
```

注意：这是本地 Node 服务内的定时任务。服务关闭后不会继续抓取，也不会继续积累历史数据。

## Telegram 配置

Telegram 默认关闭。需要发送通知时，可以用以下环境变量启用：

```bash
TELEGRAM_ENABLED=true \
TELEGRAM_BOT_TOKEN=123456:ABCDEF \
TELEGRAM_CHAT_IDS=123456789 \
npm start
```

多个 chat id 用英文逗号分隔：

```bash
TELEGRAM_CHAT_IDS=123456789,987654321
```

## 常用环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `4188` | 本地服务端口 |
| `HK_IPO_SOURCE_URL` | 华盛/VBKR IPO 页面 | IPO 数据源 |
| `HK_IPO_DB_PATH` | `data/hk-ipo-monitor.sqlite` | 本地 SQLite 数据库路径 |
| `HK_IPO_ACTIVE_REFRESH_MS` | `3600000` | 有可认购 IPO 时的刷新间隔 |
| `HK_IPO_IDLE_REFRESH_MS` | `14400000` | 无可认购 IPO 时的刷新间隔 |
| `HK_IPO_DEFAULT_RESULT_TIME` | `09:30` | 结果日默认时间，用于估算资金错峰 |
| `TELEGRAM_ENABLED` | `false` | 是否启用 Telegram |
| `TELEGRAM_BOT_TOKEN` | 空 | Telegram Bot Token |
| `TELEGRAM_CHAT_IDS` | 空 | Telegram 接收方 chat id |

## 本地数据

SQLite 数据库默认写入：

```text
data/hk-ipo-monitor.sqlite
```

数据库会保存：

- IPO 基础信息
- 每次抓取的认购倍数快照
- 本地提醒记录
- 数据源状态

`data/` 目录不会提交到 Git，因为它属于本地运行数据。

## 测试

```bash
npm test
```

测试覆盖：

- IPO 数据解析与标准化
- SQLite 仓储写入
- 截止桶位计算
- 热度、动量、时间信号
- 资金错峰计算
- 本地提醒生成
- Telegram 发送逻辑
- Dashboard 静态资源约束

## 目录结构

```text
.
├── public/                 # 前端页面、样式和交互逻辑
├── src/
│   ├── scrapers/           # 数据源抓取与解析
│   ├── alerts.js           # 本地提醒生成
│   ├── config.js           # 配置
│   ├── db.js               # SQLite 初始化
│   ├── normalize.js        # IPO 数据标准化
│   ├── repository.js       # 数据库读写
│   ├── scheduler.js        # 自动刷新调度
│   ├── signals.js          # 热度、动量、桶位、错峰逻辑
│   ├── snapshot-service.js # 刷新主流程
│   └── telegram.js         # Telegram 发送
├── test/                   # Node test 测试
├── server.js               # 本地 HTTP 服务
└── package.json
```

## 免责声明

本项目只用于个人数据跟踪和研究。IPO 申购涉及市场风险、流动性风险、暗盘和上市首日波动风险。任何基于本项目数据作出的操作，都需要自行判断并承担结果。
