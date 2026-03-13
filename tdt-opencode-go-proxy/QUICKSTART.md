# Quick Start Guide

## 1. Setup Environment

Copy `.env.example` to `.env` and edit:

```bash
cp .env.example .env
# Edit .env and add your OPENCODE_API_KEY
```

## 2. Run the Proxy

### Windows
```bash
# Set environment variable
set OPENCODE_API_KEY=your_key_here

# Run the binary
opencode-proxy.exe
```

### Linux/macOS
```bash
# Set environment variable
export OPENCODE_API_KEY=your_key_here

# Run the binary
./opencode-proxy
```

## 3. Test the Connection

```bash
# Health check
curl http://localhost:8080/health

# List models
curl http://localhost:8080/v1/models \
  -H "Authorization: Bearer any-token"

# Test chat completion
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer any-token" \
  -d '{
    "model": "opencode-go/kimi-k2.5",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## 4. Configure Claude Code

### Option A: Environment Variables
```bash
export OPENAI_BASE_URL=http://localhost:8080/v1
export OPENAI_API_KEY=any-token
claude
```

### Option B: Config File
Edit `~/.claude/config.json`:
```json
{
  "baseUrl": "http://localhost:8080/v1",
  "apiKey": "any-token"
}
```

## 5. Verify in Claude Code

Inside Claude Code, run:
```
/model opencode-go/kimi-k2.5
```

## Troubleshooting

**Proxy not starting?**
- Check if port 8080 is in use: `netstat -ano | findstr 8080`
- Check if OPENCODE_API_KEY is set: `echo %OPENCODE_API_KEY%`

**Can't connect from Claude Code?**
- Verify proxy is running: `curl http://localhost:8080/health`
- Check firewall settings
- Try using 127.0.0.1 instead of localhost

**Models not found?**
- Use correct model IDs: `opencode-go/kimi-k2.5`, not `kimi-k2.5`
- Check `/v1/models` endpoint for available models
