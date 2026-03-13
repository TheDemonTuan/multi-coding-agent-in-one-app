# OpenCode Go Proxy Server

A lightweight proxy server for routing AI requests to OpenCode Go endpoints, supporting both OpenAI-compatible (`/v1/chat/completions`) and Anthropic-compatible (`/v1/messages`) APIs.

## Features

- **Dual API Support**: OpenAI-compatible and Anthropic-compatible endpoints
- **Streaming Support**: Server-Sent Events (SSE) for real-time responses
- **Model Mapping**: Automatic conversion of model IDs (`opencode-go/glm-5` → `glm-5`)
- **Request Logging**: Detailed request/response logging with configurable levels
- **CORS Support**: Ready for browser-based clients
- **Health Checks**: Built-in health endpoint for monitoring

## Supported Models

| Model ID | Endpoint | Format |
|----------|----------|--------|
| `opencode-go/glm-5` | `/v1/chat/completions` | OpenAI-compatible |
| `opencode-go/kimi-k2.5` | `/v1/chat/completions` | OpenAI-compatible |
| `opencode-go/minimax-m2.5` | `/v1/messages` | Anthropic-compatible |

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd tdt-opencode-go-proxy

# Download dependencies
go mod tidy

# Build
go build -o opencode-proxy .
```

## Configuration

Set the following environment variables:

```bash
# Required
export OPENCODE_API_KEY="your_opencode_api_key_here"

# Optional (with defaults)
export OPENCODE_PROXY_PORT=8080              # Server port
export OPENCODE_BASE_URL="https://opencode.ai/zen/go"  # Upstream API base URL
export OPENCODE_PROXY_LOG_LEVEL="info"       # Log level: debug, info, warn, error
export OPENCODE_PROXY_LOG_FILE=""            # Log file path (empty = stdout)
```

## Usage

### Start the Server

```bash
# With environment variables
OPENCODE_API_KEY=your_key ./opencode-proxy

# Or set env vars first
export OPENCODE_API_KEY=your_key
./opencode-proxy
```

The server will start on `http://localhost:8080` (or your configured port).

### Test the Server

```bash
# Health check
curl http://localhost:8080/health

# List models
curl http://localhost:8080/v1/models \
  -H "Authorization: Bearer any-token"

# Chat completion
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer any-token" \
  -d '{
    "model": "opencode-go/kimi-k2.5",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Streaming request
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer any-token" \
  -d '{
    "model": "opencode-go/kimi-k2.5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

## Configure Claude Code

To use this proxy with Claude Code, you need to set the appropriate environment variables before starting Claude Code:

### Option 1: Environment Variables

```bash
# For OpenAI-compatible models (Kimi, GLM-5)
export OPENAI_BASE_URL=http://localhost:8080/v1
export OPENAI_API_KEY=any-token  # Will be replaced by proxy

# For Anthropic-compatible models (MiniMax)
export ANTHROPIC_BASE_URL=http://localhost:8080
export ANTHROPIC_API_KEY=any-token  # Will be replaced by proxy

# Start Claude Code
claude
```

### Option 2: Claude Code Configuration

Edit your Claude Code configuration file:

```json
// ~/.claude/config.json
{
  "baseUrl": "http://localhost:8080/v1",
  "apiKey": "any-token"
}
```

### Integrate with TDT Space

If you want to automatically set these environment variables when spawning Claude Code terminals in TDT Space, you can modify the terminal service to inject these variables:

```go
// In internal/services/terminal.go, modify buildEnv()
func buildEnv(terminalID string) []string {
    env := os.Environ()
    
    // Add proxy configuration
    env = append(env,
        "OPENAI_BASE_URL=http://localhost:8080/v1",
        "ANTHROPIC_BASE_URL=http://localhost:8080",
    )
    
    return env
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service information |
| `/health` | GET | Health check |
| `/v1/models` | GET | List available models |
| `/v1/chat/completions` | POST | OpenAI-compatible chat completions |
| `/v1/messages` | POST | Anthropic-compatible messages |

## Architecture

```
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│   Client App    │─────▶│   Proxy Server      │─────▶│  OpenCode Go    │
│   (Claude Code) │      │   • Request routing │      │  opencode.ai    │
│                 │◄─────│   • Model mapping   │◄─────│                 │
└─────────────────┘      │   • Key injection   │      └─────────────────┘
                         │   • SSE streaming   │
                         └─────────────────────┘
```

## Troubleshooting

### Connection Refused

Make sure the proxy server is running and accessible on the configured port:
```bash
curl http://localhost:8080/health
```

### Invalid API Key

Ensure `OPENCODE_API_KEY` is set correctly:
```bash
echo $OPENCODE_API_KEY
```

### Model Not Found

Use the correct model ID format:
- ✅ `opencode-go/kimi-k2.5`
- ❌ `kimi-k2.5`

### Streaming Not Working

Verify your client supports SSE (Server-Sent Events). Most modern HTTP clients support this automatically.

## Development

```bash
# Run with hot reload (requires air)
air

# Run tests
go test ./...

# Build for production
go build -ldflags="-s -w" -o opencode-proxy .

# Cross-compile
GOOS=linux GOARCH=amd64 go build -o opencode-proxy-linux
GOOS=windows GOARCH=amd64 go build -o opencode-proxy.exe
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
