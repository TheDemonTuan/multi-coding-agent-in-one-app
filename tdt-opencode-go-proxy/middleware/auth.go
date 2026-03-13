package middleware

import (
	"net/http"
	"strings"

	"tdt-opencode-go-proxy/config"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// APIKey middleware validates the incoming API key and injects the upstream key
type APIKey struct {
	cfg *config.Config
}

// NewAPIKey creates a new APIKey middleware
func NewAPIKey(cfg *config.Config) *APIKey {
	return &APIKey{cfg: cfg}
}

// Middleware returns the gin handler function
func (a *APIKey) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			logrus.Warn("Missing Authorization header")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing Authorization header"})
			c.Abort()
			return
		}

		// Extract Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			logrus.Warn("Invalid Authorization header format")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Authorization header format. Expected: Bearer <token>"})
			c.Abort()
			return
		}

		// Store the client's API key
		clientKey := parts[1]
		c.Set("client_api_key", clientKey)

		// Store upstream API key in context for proxy client to use
		c.Set("upstream_api_key", a.cfg.APIKey)

		c.Next()
	}
}
