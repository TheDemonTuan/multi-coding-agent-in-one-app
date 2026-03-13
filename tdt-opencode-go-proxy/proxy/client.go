package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"tdt-opencode-go-proxy/config"
	"tdt-opencode-go-proxy/models"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"golang.org/x/sync/singleflight"
)

type Client struct {
	httpClient *http.Client
	cfg        *config.Config
	dedup      *Deduplicator
	retry      *RetryConfig
	sfGroup    singleflight.Group
}

func NewClient(cfg *config.Config) *Client {
	dialer := &net.Dialer{
		Timeout:   cfg.DialTimeout,
		KeepAlive: 30 * time.Second,
	}

	retryConfig := &RetryConfig{
		MaxRetries:     cfg.MaxRetries,
		InitialBackoff: cfg.RetryInitialBackoff,
		MaxBackoff:     cfg.RetryMaxBackoff,
		Multiplier:     cfg.RetryMultiplier,
		RetryableCodes: []int{408, 429, 500, 502, 503, 504},
	}

	return &Client{
		httpClient: &http.Client{
			Timeout: cfg.RequestTimeout,
			Transport: &http.Transport{
				DialContext:           dialer.DialContext,
				DialTLSContext:        nil,
				TLSClientConfig:       nil,
				TLSHandshakeTimeout:   cfg.TLSHandshakeTimeout,
				ResponseHeaderTimeout: cfg.ResponseHeaderTimeout,
				ExpectContinueTimeout: 1 * time.Second,
				MaxIdleConns:          100,
				MaxIdleConnsPerHost:   20,
				IdleConnTimeout:       90 * time.Second,
				DisableCompression:    false,
				DisableKeepAlives:     false,
			},
		},
		cfg:   cfg,
		dedup: NewDeduplicator(&DeduplicationConfig{Enabled: cfg.EnableDeduplication}),
		retry: retryConfig,
	}
}

var ModelEndpointMapping = map[string]string{
	"opencode-go/glm-5":        "/v1/chat/completions",
	"opencode-go/kimi-k2.5":    "/v1/chat/completions",
	"opencode-go/minimax-m2.5": "/v1/messages",
}

func RealModelID(proxyModelID string) string {
	realID := strings.TrimPrefix(proxyModelID, "opencode-go/")
	if realID == proxyModelID {
		return proxyModelID
	}
	return realID
}

func GetEndpointForModel(modelID string) string {
	if endpoint, ok := ModelEndpointMapping[modelID]; ok {
		return endpoint
	}
	return "/v1/chat/completions"
}

func IsAnthropicEndpoint(endpoint string) bool {
	return strings.Contains(endpoint, "/messages")
}

func (c *Client) ForwardRequest(ctx *gin.Context, endpoint string, body io.Reader) (*http.Response, error) {
	upstreamURL := c.cfg.BaseURL + endpoint

	req, err := http.NewRequestWithContext(ctx.Request.Context(), ctx.Request.Method, upstreamURL, body)
	if err != nil {
		return nil, err
	}

	for key, values := range ctx.Request.Header {
		for _, value := range values {
			if key != "Host" && key != "Content-Length" && key != "Authorization" {
				req.Header.Add(key, value)
			}
		}
	}

	upstreamKey, exists := ctx.Get("upstream_api_key")
	if !exists {
		upstreamKey = c.cfg.APIKey
	}

	if IsAnthropicEndpoint(endpoint) {
		req.Header.Set("x-api-key", upstreamKey.(string))
	} else {
		req.Header.Set("Authorization", "Bearer "+upstreamKey.(string))
	}

	req.Header.Set("Content-Type", "application/json")

	logrus.Debugf("Forwarding request to %s", upstreamURL)

	if c.cfg.EnableRetry && !c.isStreamingRequest(ctx) {
		return c.doWithRetry(req)
	}

	return c.httpClient.Do(req)
}

func (c *Client) doWithRetry(req *http.Request) (*http.Response, error) {
	backoff := newBackoff(c.retry.InitialBackoff, c.retry.Multiplier, c.retry.MaxBackoff)
	var lastErr error

	for attempt := 0; attempt <= c.retry.MaxRetries; attempt++ {
		if attempt > 0 {
			delay := backoff.Duration(attempt - 1)
			logrus.Debugf("Retry attempt %d after %v", attempt, delay)
			time.Sleep(delay)
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			if !c.isNetworkError(err) {
				return nil, err
			}
			logrus.Warnf("Retryable network error: %v", err)
			continue
		}

		if !c.isRetryableStatusCode(resp.StatusCode) {
			return resp, nil
		}

		lastErr = &RetryableError{message: "upstream returned retryable status"}
		if resp.Body != nil {
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		}

		logrus.Warnf("Retryable status %d, attempt %d/%d", resp.StatusCode, attempt, c.retry.MaxRetries)
	}

	return nil, lastErr
}

func (c *Client) isNetworkError(err error) bool {
	netErr, ok := err.(net.Error)
	return ok && (netErr.Temporary() || netErr.Timeout())
}

func (c *Client) isRetryableStatusCode(code int) bool {
	for _, rc := range c.retry.RetryableCodes {
		if code == rc {
			return true
		}
	}
	return false
}

func (c *Client) isStreamingRequest(ctx *gin.Context) bool {
	return ctx.GetHeader("Content-Type") == "text/event-stream" ||
		strings.Contains(ctx.GetHeader("Accept"), "text/event-stream")
}

func (c *Client) ForwardRequestWithDedup(ctx *gin.Context, endpoint string, body []byte) (*http.Response, error) {
	if !c.cfg.EnableDeduplication {
		return c.ForwardRequest(ctx, endpoint, bytes.NewReader(body))
	}

	key := GenerateRequestHash(body, endpoint)

	result, err, _ := c.sfGroup.Do(key, func() (interface{}, error) {
		return c.ForwardRequest(ctx, endpoint, bytes.NewReader(body))
	})

	if err != nil {
		return nil, err
	}
	return result.(*http.Response), nil
}

func (c *Client) HandleChatCompletions(ctx *gin.Context) {
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		logrus.WithError(err).Error("Failed to read request body")
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	var reqData models.ChatCompletionRequest
	if err := json.Unmarshal(body, &reqData); err != nil {
		logrus.WithError(err).Warn("Failed to parse request JSON, proceeding with raw body")
	}

	modelID := RealModelID(reqData.Model)
	endpoint := GetEndpointForModel(reqData.Model)

	requestID, _ := ctx.Get("request_id")
	logrus.WithFields(logrus.Fields{
		"request_id": requestID,
		"model":      reqData.Model,
		"real_model": modelID,
		"endpoint":   endpoint,
		"streaming":  reqData.Stream,
	}).Info("Chat completion request")

	var modifiedBody []byte
	if reqData.Model != "" {
		reqData.Model = modelID
		modifiedBody, _ = json.Marshal(reqData)
	} else {
		modifiedBody = body
	}

	if c.cfg.EnableDeduplication && !reqData.Stream {
		resp, err := c.ForwardRequestWithDedup(ctx, endpoint, modifiedBody)
		if err != nil {
			logrus.WithError(err).Error("Failed to forward request")
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to forward request: " + err.Error()})
			return
		}
		c.processResponse(ctx, resp, false)
		return
	}

	resp, err := c.ForwardRequest(ctx, endpoint, bytes.NewReader(modifiedBody))
	if err != nil {
		logrus.WithError(err).Error("Failed to forward request")
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to forward request: " + err.Error()})
		return
	}
	c.processResponse(ctx, resp, false)
}

func (c *Client) HandleMessages(ctx *gin.Context) {
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		logrus.WithError(err).Error("Failed to read request body")
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	var reqData map[string]interface{}
	if err := json.Unmarshal(body, &reqData); err != nil {
		logrus.WithError(err).Error("Failed to parse messages request")
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse request"})
		return
	}

	modelIface, hasModel := reqData["model"]
	modelID := ""
	originalModelID := ""
	if hasModel {
		originalModelID = modelIface.(string)
		modelID = RealModelID(originalModelID)
		reqData["model"] = modelID
	}

	// Auto-route to correct endpoint based on model type
	targetEndpoint := "/v1/messages"
	needsTransform := false
	expectedEndpoint := GetEndpointForModel(originalModelID)
	if !IsAnthropicEndpoint(expectedEndpoint) {
		// Model uses OpenAI endpoint, need to convert format
		targetEndpoint = "/v1/chat/completions"
		needsTransform = true
		logrus.WithFields(logrus.Fields{
			"model":             originalModelID,
			"from_endpoint":     "/v1/messages",
			"to_endpoint":       targetEndpoint,
		}).Info("Auto-routing request to correct endpoint")
		logrus.WithFields(logrus.Fields{
			"model":             originalModelID,
			"from_endpoint":     "/v1/messages",
			"to_endpoint":       targetEndpoint,
		}).Info("Auto-routing request to correct endpoint")
		
		// Transform tools from Anthropic format to OpenAI format
		if toolsIface, hasTools := reqData["tools"]; hasTools {
			if tools, ok := toolsIface.([]interface{}); ok {
				openaiTools := make([]interface{}, 0, len(tools))
				for _, tool := range tools {
					if toolMap, ok := tool.(map[string]interface{}); ok {
						// Convert to OpenAI function tool format
						openaiTool := map[string]interface{}{
							"type": "function",
						}
						
						// Extract function info from various Anthropic tool formats
						if name, ok := toolMap["name"].(string); ok {
							funcDef := map[string]interface{}{
								"name": name,
							}
							if desc, ok := toolMap["description"].(string); ok {
								funcDef["description"] = desc
							}
							if inputSchema, ok := toolMap["input_schema"]; ok {
								funcDef["parameters"] = inputSchema
							} else if params, ok := toolMap["parameters"]; ok {
								funcDef["parameters"] = params
							}
							openaiTool["function"] = funcDef
						} else if function, ok := toolMap["function"].(map[string]interface{}); ok {
							// Already in OpenAI format
							openaiTool["function"] = function
						}
						
						openaiTools = append(openaiTools, openaiTool)
					}
				}
				reqData["tools"] = openaiTools
				logrus.WithField("tool_count", len(openaiTools)).Info("Transformed tools to OpenAI format")
			}
		}
	}

	streaming := false
	if streamIface, hasStream := reqData["stream"]; hasStream {
		streaming, _ = streamIface.(bool)
	}

	requestID, _ := ctx.Get("request_id")
	logrus.WithFields(logrus.Fields{
		"request_id": requestID,
		"model":      modelID,
		"streaming":  streaming,
	}).Info("Messages request")

	modifiedBody, _ := json.Marshal(reqData)

	if c.cfg.EnableDeduplication && !streaming {
		resp, err := c.ForwardRequestWithDedup(ctx, targetEndpoint, modifiedBody)
		if err != nil {
			logrus.WithError(err).Error("Failed to forward request")
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to forward request: " + err.Error()})
			return
		}
		c.processResponse(ctx, resp, needsTransform)
		return
	}

	resp, err := c.ForwardRequest(ctx, targetEndpoint, bytes.NewReader(modifiedBody))
	if err != nil {
		logrus.WithError(err).Error("Failed to forward request")
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to forward request: " + err.Error()})
		return
	}
	c.processResponse(ctx, resp, needsTransform)
}

func (c *Client) HandleCountTokens(ctx *gin.Context) {
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		logrus.WithError(err).Error("Failed to read request body")
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	var reqData map[string]interface{}
	if err := json.Unmarshal(body, &reqData); err != nil {
		logrus.WithError(err).Error("Failed to parse count_tokens request")
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse request"})
		return
	}

	if modelIface, hasModel := reqData["model"]; hasModel {
		originalModelID := modelIface.(string)
		modelID := RealModelID(originalModelID)
		reqData["model"] = modelID

		// Validate that the model supports Anthropic endpoint for count_tokens
		expectedEndpoint := GetEndpointForModel(originalModelID)
		if !IsAnthropicEndpoint(expectedEndpoint) {
			logrus.WithFields(logrus.Fields{
				"model":             originalModelID,
				"expected_endpoint": expectedEndpoint,
			}).Error("Count tokens not supported for this model")
			ctx.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Count tokens is only supported for Anthropic-compatible models. Model '%s' uses %s.", originalModelID, expectedEndpoint),
			})
			return
		}

		logrus.WithField("model", modelID).Info("Count tokens request")
	} else {
		logrus.Error("Count tokens request missing model field")
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Model field is required"})
		return
	}

	modifiedBody, _ := json.Marshal(reqData)
	resp, err := c.ForwardRequest(ctx, "/v1/messages/count_tokens", bytes.NewReader(modifiedBody))
	if err != nil {
		logrus.WithError(err).Error("Failed to forward count_tokens request")
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to forward request: " + err.Error()})
		return
	}
	c.processResponse(ctx, resp, false)
}

// transformResponse transforms OpenAI response to Anthropic format using library
func (c *Client) transformResponse(respBody []byte, model string) []byte {
	transformed, err := OpenAIToAnthropicResponseTransform(respBody, model)
	if err != nil {
		logrus.WithError(err).Warn("Failed to transform response, returning original")
		return respBody
	}
	return transformed
}

func (c *Client) processResponse(ctx *gin.Context, resp *http.Response, needsTransform bool) {
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		logrus.WithFields(logrus.Fields{
			"status": resp.StatusCode,
			"body":   string(body),
		}).Error("Upstream API error")
		ctx.Data(resp.StatusCode, "application/json", body)
		return
	}

	streaming := c.isStreamingResponse(resp.Header)
	if streaming {
		// Note: Streaming transform not fully implemented for Anthropic format
		if needsTransform {
			logrus.Warn("Streaming response transform to Anthropic format not fully implemented")
		}
		c.handleStreamResponse(ctx, resp)
		return
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		logrus.WithError(err).Error("Failed to read response body")
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response"})
		return
	}

	// Transform response from OpenAI format to Anthropic format if needed
	if needsTransform {
		respBody = c.transformResponse(respBody, "")
	}

	for key, values := range resp.Header {
		for _, value := range values {
			ctx.Writer.Header().Add(key, value)
		}
	}

	ctx.Data(resp.StatusCode, "application/json", respBody)
}

func (c *Client) isStreamingResponse(header http.Header) bool {
	ct := header.Get("Content-Type")
	return strings.Contains(ct, "text/event-stream") || strings.Contains(ct, "stream")
}

func (c *Client) handleStreamResponse(ctx *gin.Context, resp *http.Response) {
	ctx.Writer.Header().Set("Content-Type", "text/event-stream")
	ctx.Writer.Header().Set("Cache-Control", "no-cache")
	ctx.Writer.Header().Set("Connection", "keep-alive")
	ctx.Writer.Header().Set("X-Accel-Buffering", "no")

	ctx.Stream(func(w io.Writer) bool {
		reader := resp.Body
		buf := make([]byte, 4096)

		for {
			select {
			case <-ctx.Request.Context().Done():
				logrus.Debug("Stream context cancelled")
				return false
			default:
			}

			n, err := reader.Read(buf)
			if n > 0 {
				w.Write(buf[:n])
				if flusher, ok := w.(http.Flusher); ok {
					flusher.Flush()
				}
			}
			if err != nil {
				if err != io.EOF {
					logrus.WithError(err).Error("Error reading stream")
				}
				return false
			}
		}
	})
}

func GetUpstreamContext() context.Context {
	return context.Background()
}
