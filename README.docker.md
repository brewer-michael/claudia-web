# 🐳 Claudia Docker Image

[![Docker Pulls](https://img.shields.io/docker/pulls/brewermichael/claudia-code)](https://hub.docker.com/r/brewermichael/claudia-code)
[![Docker Image Size](https://img.shields.io/docker/image-size/brewermichael/claudia-code/latest)](https://hub.docker.com/r/brewermichael/claudia-code)
[![GitHub Stars](https://img.shields.io/github/stars/brewer-michael/claudia-web)](https://github.com/brewer-michael/claudia-web)

**Claudia** (formerly Gooey) is a containerized web interface for interacting with Claude AI. Access Claude from any device through your browser with persistent workspace storage.

## ✨ Features

- 🌐 **Web-based Interface** - Access Claude AI from any device  
- 💾 **Persistent Workspace** - Your projects and files persist between sessions
- 🐳 **Docker Ready** - Easy deployment with Docker/Docker Compose
- 🔒 **Secure** - Optional authentication and reverse proxy support  
- 📁 **File Management** - Built-in file browser and editor
- 🔄 **Git Integration** - Version control for your projects
- 🚀 **Unraid Compatible** - One-click deployment on Unraid servers
- 🎛️ **Configurable** - Extensive configuration options

## 🚀 Quick Start

### Docker Compose (Recommended)

```yaml
version: '3.8'
services:
  claudia:
    image: brewermichael/claudia-code:latest
    container_name: claudia
    ports:
      - "3000:3000"
    environment:
      - ANTHROPIC_API_KEY=your_api_key_here
    volumes:
      - ./workspace:/workspace
      - ./config:/config
    restart: unless-stopped
```

```bash
docker-compose up -d
```

### Docker CLI

```bash
docker run -d \
  --name claudia \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=your_api_key_here \
  -v /path/to/workspace:/workspace \
  -v /path/to/config:/config \
  --restart unless-stopped \
  brewermichael/claudia-code:latest
```

### Unraid

1. Go to **Apps** in your Unraid interface
2. Search for "**claudia**" 
3. Click **Install** and configure:
   - Set your **ANTHROPIC_API_KEY**
   - Configure volume paths
   - Set port (default: 3000)

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key for Claude AI | ✅ Yes |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_USERNAME` | - | Username for basic authentication |
| `AUTH_PASSWORD` | - | Password for basic authentication |
| `PROXY_DOMAIN` | - | Domain for reverse proxy setup |
| `TRUSTED_PROXIES` | `*` | Trusted proxy IPs |
| `DEFAULT_WORKSPACE` | `/workspace` | Default workspace directory |
| `NODE_ENV` | `production` | Node environment |
| `LOG_LEVEL` | `info` | Logging level |
| `MAX_TOKENS` | `4096` | Maximum tokens per response |
| `MODEL` | `claude-3-opus-20240229` | Claude model to use |
| `PUID` | `1000` | User ID for file permissions |
| `PGID` | `1000` | Group ID for file permissions |

### Volume Mounts

| Container Path | Description | Required |
|---------------|-------------|----------|
| `/workspace` | Persistent workspace for projects | ✅ Yes |
| `/config` | Application configuration files | ✅ Yes |  
| `/repos` | Git repositories storage | ❌ No |

## 🎯 Usage

1. **Start the container** with your API key
2. **Open your browser** to `http://localhost:3000`
3. **Create projects** in your workspace
4. **Chat with Claude** and manage your files  
5. **Everything persists** in your mounted volumes

## 🔐 Security

### Authentication
Enable basic authentication by setting:
```bash
-e AUTH_USERNAME=admin
-e AUTH_PASSWORD=your_secure_password  
```

### Reverse Proxy
For production deployments with SSL:
```bash
-e PROXY_DOMAIN=claudia.yourdomain.com
-e TRUSTED_PROXIES=172.16.0.0/12
```

## 📖 Examples

### Development Setup
```yaml
services:
  claudia:
    image: brewermichael/claudia-code:latest
    ports:
      - "3000:3000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - NODE_ENV=development
      - LOG_LEVEL=debug
    volumes:
      - ./workspace:/workspace
      - ./config:/config
```

### Production with Traefik  
```yaml
services:
  claudia:
    image: brewermichael/claudia-code:latest
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - PROXY_DOMAIN=claudia.example.com
      - AUTH_USERNAME=admin
      - AUTH_PASSWORD=${AUTH_PASSWORD}
    volumes:
      - workspace:/workspace
      - config:/config
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.claudia.rule=Host(\`claudia.example.com\`)"
      - "traefik.http.routers.claudia.tls.certresolver=letsencrypt"
```

## 🛠️ Development

### Local Development
```bash
git clone https://github.com/brewer-michael/claudia-web.git
cd claudia-web
npm install
npm run dev
```

### Build Docker Image
```bash  
docker build -t claudia-local .
```

## 📋 Requirements

- Docker 20.10+
- Anthropic API key ([Get one here](https://console.anthropic.com/))
- 512MB+ RAM recommended
- Persistent storage for workspace

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/brewer-michael/claudia-web/issues)
- **Discussions**: [GitHub Discussions](https://github.com/brewer-michael/claudia-web/discussions)  
- **Docker Hub**: [brewermichael/claudia-code](https://hub.docker.com/r/brewermichael/claudia-code)

## 📄 License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/) and [Vite](https://vitejs.dev/)
- Powered by [Anthropic's Claude AI](https://www.anthropic.com/) 
- Inspired by [code-server](https://github.com/coder/code-server)

---

⭐ **Star this repo** if you find it helpful!