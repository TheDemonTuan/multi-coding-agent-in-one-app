package proxy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"
)

// OpenAIChatCompletionRequest represents OpenAI chat completion request type
type OpenAIChatCompletionRequest struct {
	Model               string            `json:"model"`
	Messages            []OpenAIMessage   `json:"messages"`
	MaxTokens           *int              `json:"max_tokens,omitempty"`
	MaxCompletionTokens *int              `json:"max_completion_tokens,omitempty"`
	Temperature         *float32          `json:"temperature,omitempty"`
	TopP                *float32          `json:"top_p,omitempty"`
	StopSequences       []string          `json:"stop,omitempty"`
	Stream              bool              `json:"stream,omitempty"`
	Tools               []OpenAITool      `json:"tools,omitempty"`
	ToolChoice          *OpenAIToolChoice `json:"tool_choice,omitempty"`
	ResponseFormat      *json.RawMessage  `json:"response_format,omitempty"`
}

// OpenAIMessage represents OpenAI message format
type OpenAIMessage struct {
	Role         string                `json:"role"`
	Content      *OpenAIMessageContent `json:"content,omitempty"`
	Name         *string               `json:"name,omitempty"`
	ToolCalls    []OpenAIToolCall      `json:"tool_calls,omitempty"`
	ToolCallID   *string               `json:"tool_call_id,omitempty"`
	FunctionCall *OpenAIFunctionCall   `json:"function_call,omitempty"`
	Refusal      *string               `json:"refusal,omitempty"`
}

// OpenAIMessageContent represents OpenAI message content (string or array)
type OpenAIMessageContent struct {
	String *string      `json:"-"`
	Parts  []OpenAIPart `json:"parts,omitempty"`
}

// OpenAIPart represents a part of message content
type OpenAIPart struct {
	Type     string          `json:"type"`
	Text     *string         `json:"text,omitempty"`
	ImageURL *OpenAIImageURL `json:"image_url,omitempty"`
}

// OpenAIImageURL represents image URL in OpenAI format
type OpenAIImageURL struct {
	URL    string `json:"url"`
	Detail string `json:"detail,omitempty"`
}

// OpenAITool represents OpenAI tool format
type OpenAITool struct {
	Type     string         `json:"type"`
	Function OpenAIFunction `json:"function"`
}

// OpenAIFunction represents OpenAI function definition
type OpenAIFunction struct {
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Parameters  json.RawMessage `json:"parameters"`
}

// OpenAIToolCall represents OpenAI tool call
type OpenAIToolCall struct {
	ID       string             `json:"id"`
	Type     string             `json:"type"`
	Function OpenAIFunctionCall `json:"function"`
}

// OpenAIFunctionCall represents OpenAI function call
type OpenAIFunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// OpenAIToolChoice represents OpenAI tool choice
type OpenAIToolChoice struct {
	Type     string                `json:"type"`
	Value    *string               `json:"value,omitempty"`
	Function *OpenAIToolChoiceFunc `json:"function,omitempty"`
}

// OpenAIToolChoiceFunc represents specific function choice
type OpenAIToolChoiceFunc struct {
	Name string `json:"name"`
}

// OpenAIChatCompletionResponse represents OpenAI response
type OpenAIChatCompletionResponse struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	Created int64          `json:"created"`
	Model   string         `json:"model"`
	Choices []OpenAIChoice `json:"choices"`
	Usage   OpenAIUsage    `json:"usage"`
}

// OpenAIChoice represents OpenAI choice
type OpenAIChoice struct {
	Index        int                   `json:"index"`
	Message      OpenAIResponseMessage `json:"message"`
	FinishReason string                `json:"finish_reason"`
}

// OpenAIResponseMessage represents message in response
type OpenAIResponseMessage struct {
	Role      string           `json:"role"`
	Content   *string          `json:"content,omitempty"`
	ToolCalls []OpenAIToolCall `json:"tool_calls,omitempty"`
	Refusal   *string          `json:"refusal,omitempty"`
}

// OpenAIUsage represents token usage
type OpenAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// AnthropicToOpenAITransform transforms Anthropic request body to OpenAI format
func AnthropicToOpenAITransform(body []byte) ([]byte, error) {
	var anthropicReq struct {
		Model         string             `json:"model"`
		Messages      []AnthropicMessage `json:"messages"`
		MaxTokens     int                `json:"max_tokens"`
		Temperature   *float32           `json:"temperature,omitempty"`
		TopP          *float32           `json:"top_p,omitempty"`
		StopSequences []string           `json:"stop_sequences,omitempty"`
		Stream        bool               `json:"stream,omitempty"`
		Tools         []AnthropicTool    `json:"tools,omitempty"`
		ToolChoice    interface{}        `json:"tool_choice,omitempty"`
		System        string             `json:"system,omitempty"`
	}

	if err := json.Unmarshal(body, &anthropicReq); err != nil {
		return nil, fmt.Errorf("failed to unmarshal Anthropic request: %w", err)
	}

	openaiReq := OpenAIChatCompletionRequest{
		Model:     anthropicReq.Model,
		Stream:    anthropicReq.Stream,
		MaxTokens: &anthropicReq.MaxTokens,
	}

	if anthropicReq.Temperature != nil {
		openaiReq.Temperature = anthropicReq.Temperature
	}
	if anthropicReq.TopP != nil {
		openaiReq.TopP = anthropicReq.TopP
	}
	if len(anthropicReq.StopSequences) > 0 {
		openaiReq.StopSequences = anthropicReq.StopSequences
	}

	// Transform messages
	for _, msg := range anthropicReq.Messages {
		openaiMsg := OpenAIMessage{
			Role: msg.Role,
		}

		if msg.Content != "" {
			openaiMsg.Content = &OpenAIMessageContent{
				String: &msg.Content,
			}
		}

		openaiReq.Messages = append(openaiReq.Messages, openaiMsg)
	}

	// Add system message if present
	if anthropicReq.System != "" {
		systemMsg := OpenAIMessage{
			Role: "system",
			Content: &OpenAIMessageContent{
				String: &anthropicReq.System,
			},
		}
		openaiReq.Messages = append([]OpenAIMessage{systemMsg}, openaiReq.Messages...)
	}

	// Transform tools
	if len(anthropicReq.Tools) > 0 {
		openaiReq.Tools = make([]OpenAITool, len(anthropicReq.Tools))
		for i, tool := range anthropicReq.Tools {
			desc := tool.Description
			if desc == "" {
				desc = fmt.Sprintf("Tool %s", tool.Name)
			}
			openaiReq.Tools[i] = OpenAITool{
				Type: "function",
				Function: OpenAIFunction{
					Name:        tool.Name,
					Description: &desc,
					Parameters:  tool.InputSchema,
				},
			}
		}
	}

	return json.Marshal(openaiReq)
}

// AnthropicMessage represents simplified Anthropic message
type AnthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// AnthropicTool represents simplified Anthropic tool
type AnthropicTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
}

// OpenAIToAnthropicResponseTransform transforms OpenAI response to Anthropic format
func OpenAIToAnthropicResponseTransform(body []byte, model string) ([]byte, error) {
	// Check if response looks like JSON (starts with { or [)
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		return nil, fmt.Errorf("empty response body")
	}
	if trimmed[0] != '{' && trimmed[0] != '[' {
		// Response is not JSON, might be text with ANSI codes or error message
		// Try to extract JSON from it or return as text content
		return wrapNonJSONResponse(body, model), nil
	}

	var openaiResp OpenAIChatCompletionResponse
	if err := json.Unmarshal(body, &openaiResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal OpenAI response: %w", err)
	}

	if len(openaiResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in OpenAI response")
	}

	choice := openaiResp.Choices[0]
	message := choice.Message

	// Build Anthropic content blocks
	content := make([]AnthropicContentBlock, 0)

	// Add text content if present
	if message.Content != nil && *message.Content != "" {
		content = append(content, AnthropicContentBlock{
			Type: "text",
			Text: *message.Content,
		})
	}

	// Add tool calls as tool_use blocks
	for _, toolCall := range message.ToolCalls {
		var input map[string]interface{}
		if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &input); err != nil {
			logrus.WithError(err).Warn("Failed to parse tool arguments")
			input = make(map[string]interface{})
		}

		content = append(content, AnthropicContentBlock{
			Type:  "tool_use",
			ID:    toolCall.ID,
			Name:  toolCall.Function.Name,
			Input: input,
		})
	}

	// Determine stop reason
	stopReason := mapOpenAIFinishReason(choice.FinishReason)

	anthropicResp := AnthropicResponse{
		ID:         openaiResp.ID,
		Type:       "message",
		Role:       "assistant",
		Model:      model,
		Content:    content,
		StopReason: stopReason,
		Usage: AnthropicUsage{
			InputTokens:  openaiResp.Usage.PromptTokens,
			OutputTokens: openaiResp.Usage.CompletionTokens,
		},
	}

	return json.Marshal(anthropicResp)
}

// AnthropicContentBlock represents content block in Anthropic response
type AnthropicContentBlock struct {
	Type  string                 `json:"type"`
	Text  string                 `json:"text,omitempty"`
	ID    string                 `json:"id,omitempty"`
	Name  string                 `json:"name,omitempty"`
	Input map[string]interface{} `json:"input,omitempty"`
}

// AnthropicResponse represents Anthropic API response
type AnthropicResponse struct {
	ID         string                  `json:"id"`
	Type       string                  `json:"type"`
	Role       string                  `json:"role"`
	Model      string                  `json:"model"`
	Content    []AnthropicContentBlock `json:"content"`
	StopReason *string                 `json:"stop_reason,omitempty"`
	Usage      AnthropicUsage          `json:"usage"`
}

// AnthropicUsage represents Anthropic token usage
type AnthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// mapOpenAIFinishReason maps OpenAI finish_reason to Anthropic stop_reason
func mapOpenAIFinishReason(finishReason string) *string {
	var stopReason string
	switch finishReason {
	case "stop":
		stopReason = "end_turn"
	case "length":
		stopReason = "max_tokens"
	case "tool_calls":
		stopReason = "tool_use"
	case "content_filter":
		stopReason = "stop_sequence"
	default:
		return nil
	}
	return &stopReason
}

// TransformToolsToOpenAI transforms Anthropic tools to OpenAI format
func TransformToolsToOpenAI(anthropicTools []interface{}) []OpenAITool {
	openaiTools := make([]OpenAITool, 0, len(anthropicTools))

	for _, tool := range anthropicTools {
		toolMap, ok := tool.(map[string]interface{})
		if !ok {
			continue
		}

		name, _ := toolMap["name"].(string)
		description, _ := toolMap["description"].(string)

		var parameters json.RawMessage
		if inputSchema, ok := toolMap["input_schema"]; ok {
			parameters, _ = json.Marshal(inputSchema)
		}

		desc := description
		if desc == "" {
			desc = fmt.Sprintf("Tool %s", name)
		}

		openaiTools = append(openaiTools, OpenAITool{
			Type: "function",
			Function: OpenAIFunction{
				Name:        name,
				Description: &desc,
				Parameters:  parameters,
			},
		})
	}

	return openaiTools
}

// ExtractTextContent extracts text content from Anthropic content blocks
func ExtractTextContent(content []AnthropicContentBlock) string {
	var texts []string
	for _, block := range content {
		if block.Type == "text" {
			texts = append(texts, block.Text)
		}
	}
	return strings.Join(texts, "")
}

// StandardizeModelName standardizes model names to current versions
func StandardizeModelName(model string) string {
	switch strings.TrimRight(model, "0123456789@-") {
	case "claude-3-5-sonnet":
		return "claude-3-5-sonnet-20241022"
	case "claude-3-opus":
		return "claude-3-opus-20240229"
	case "claude-3-sonnet":
		return "claude-3-sonnet-20240229"
	case "claude-3-haiku":
		return "claude-3-haiku-20240307"
	}
	return model
}

// wrapNonJSONResponse wraps non-JSON response (e.g., text with ANSI codes) in Anthropic format
func wrapNonJSONResponse(body []byte, model string) []byte {
	// Clean ANSI escape codes
	cleaned := cleanANSICodes(string(body))
	
	anthropicResp := AnthropicResponse{
		ID:    "msg_nonjson",
		Type:  "message",
		Role:  "assistant",
		Model: model,
		Content: []AnthropicContentBlock{
			{
				Type: "text",
				Text: cleaned,
			},
		},
		StopReason: stringPtr("end_turn"),
		Usage: AnthropicUsage{
			InputTokens:  0,
			OutputTokens: len(cleaned),
		},
	}
	
	result, _ := json.Marshal(anthropicResp)
	return result
}

// cleanANSICodes removes ANSI escape sequences from text
func cleanANSICodes(text string) string {
	// Remove ANSI escape sequences like \x1b[31m, \x1b[0m, etc.
	var result strings.Builder
	inEscape := false
	for i := 0; i < len(text); i++ {
		if text[i] == '\x1b' {
			inEscape = true
			continue
		}
		if inEscape {
			if text[i] == 'm' || (text[i] >= 'A' && text[i] <= 'Z') || (text[i] >= 'a' && text[i] <= 'z') {
				inEscape = false
			}
			continue
		}
		result.WriteByte(text[i])
	}
	return result.String()
}

// stringPtr returns pointer to string
func stringPtr(s string) *string {
	return &s
}
