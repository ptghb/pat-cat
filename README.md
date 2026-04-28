# pat-cat（在线撸猫地图）

一个把「猫咪品种」放到世界地图上的小项目：后端定时从维基百科同步猫咪品种与原产地信息，前端用 Leaflet 渲染成可点击的猫咪头像标记，点击弹窗可查看放大图与维基链接。

## 功能

- 世界地图展示猫咪品种分布点（按原产地定位）
- 点击猫咪头像打开弹窗：展示放大图、原产地、维基百科链接
- 后端定时同步数据（启动时可自动同步，也可手动触发）

## 技术栈

- 前端：原生 HTML/CSS/JS + Leaflet
- 后端：FastAPI + SQLAlchemy + PyMySQL
- 数据库：MySQL 8（可用 Docker Compose 启动）
- 数据源：维基百科「家猫品种列表」与地名坐标查询

## 目录结构

- [index.html](file:///Users/gehongbin/PycharmProjects/pat-cat/index.html)：页面入口
- [app.js](file:///Users/gehongbin/PycharmProjects/pat-cat/app.js)：地图渲染、标记与弹窗逻辑
- [styles.css](file:///Users/gehongbin/PycharmProjects/pat-cat/styles.css)：页面与弹窗样式
- [backend/app/main.py](file:///Users/gehongbin/PycharmProjects/pat-cat/backend/app/main.py)：FastAPI 入口（同时托管静态前端与 API）
- [backend/app/sync_service.py](file:///Users/gehongbin/PycharmProjects/pat-cat/backend/app/sync_service.py)：同步流程与入库逻辑
- [docker-compose.yml](file:///Users/gehongbin/PycharmProjects/pat-cat/docker-compose.yml)：本地 MySQL 8
- [mysql-init.sql](file:///Users/gehongbin/PycharmProjects/pat-cat/mysql-init.sql)：初始化库表结构

## 本地运行

### 1) 启动 MySQL（Docker Compose）

在项目根目录执行：

```bash
docker compose up -d
```

默认会创建数据库 `patcat`，用户名/密码为 `root/password`，并将数据持久化到 `./mysql-data`。

### 2) 安装后端依赖

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3) 启动后端（同时提供 API + 前端页面）

```bash
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

打开：

- http://127.0.0.1:8000/（前端页面）
- http://127.0.0.1:8000/api/health（健康检查）

## 配置项（环境变量）

后端配置在 [backend/app/config.py](file:///Users/gehongbin/PycharmProjects/pat-cat/backend/app/config.py)：

- `DATABASE_URL`：数据库连接串（默认 `mysql+pymysql://root:password@127.0.0.1:3306/patcat?charset=utf8mb4`）
- `SYNC_INTERVAL_SECONDS`：定时同步间隔（默认 6 小时）
- `INITIAL_SYNC_ON_STARTUP`：启动时如库内为空是否自动同步（默认 `true`）

说明：配置读取 `.env` 文件（相对于启动后端时的当前工作目录），也支持直接在环境变量中设置。

## API

- `GET /api/health`：返回服务状态与品种数量
- `GET /api/breeds?limit=5000&offset=0`：返回品种列表（前端渲染使用）
- `GET /api/sync/status`：查看最近一次同步状态
- `POST /api/sync/run`：手动触发一次同步

## 常见问题

- 报错：`'cryptography' package is required for sha256_password or caching_sha2_password auth methods`
  - 这是 MySQL 8 常见认证方式需要依赖 `cryptography`，本项目已在 [backend/requirements.txt](file:///Users/gehongbin/PycharmProjects/pat-cat/backend/requirements.txt) 中包含该依赖；重新安装依赖即可。

