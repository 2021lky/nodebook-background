# NodeBook Backend

一个基于 Node.js + Express 的后端服务，为 NodeBook 应用提供 API 接口（认证、文件、每日任务、LLM 问答等）。

- Node 版本：建议 >= 18.x
- 包管理器：npm
- 数据库：MySQL

---

## 功能特性

- 用户认证与授权（JWT）
- 每日任务管理（增删改查、区间查询、统计、批量操作）
- 文件上传与文件系统 API
- 大语言模型（LLM）问答（支持流式 SSE、基于文件的问答、请求停止）
- 统一的错误响应格式、速率限制中间件

---

## 快速开始

### 1) 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env` 文件并根据需要修改配置：

```bash
cp .env .env.local
```
配置数据库连接
- 数据库主机：DB_HOST
- 数据库端口：DB_PORT
- 数据库名称：DB_NAME
- 数据库用户名：DB_USER
- 数据库密码：DB_PASSWORD

jwt配置(可选)
- JWT_ACCESS_SECRET: 访问令牌密钥
- JWT_ACCESS_EXPIRES_IN: 访问令牌过期时间（如：1h、1d）
- JWT_REFRESH_SECRET: 刷新令牌密钥
- JWT_REFRESH_EXPIRES_IN: 刷新令牌过期时间（如：7d）
- VALID_API_KEYS: 有效 API 密钥列表，逗号分隔

llm配置(可选)
- LLM_API_KEY: LLM 服务 API 密钥
- LLM_BASE_URL: LLM 服务基础 URL

### 3. 启动服务

开发模式（自动重启）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```