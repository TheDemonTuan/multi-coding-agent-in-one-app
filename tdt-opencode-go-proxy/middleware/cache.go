package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/patrickmn/go-cache"
	"github.com/sirupsen/logrus"
)

type CacheConfig struct {
	Enabled      bool
	TTL          time.Duration
	ExcludePaths []string
}

type CacheMiddleware struct {
	cache  *cache.Cache
	config *CacheConfig
}

func NewCacheMiddleware(config *CacheConfig) *CacheMiddleware {
	if config.TTL == 0 {
		config.TTL = 5 * time.Minute
	}
	return &CacheMiddleware{
		cache:  cache.New(config.TTL, 10*time.Minute),
		config: config,
	}
}

func (cm *CacheMiddleware) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !cm.config.Enabled {
			c.Next()
			return
		}

		for _, path := range cm.config.ExcludePaths {
			if strings.HasPrefix(c.Request.URL.Path, path) {
				c.Next()
				return
			}
		}

		if c.Request.Method != http.MethodGet {
			c.Next()
			return
		}

		cacheKey := cm.generateCacheKey(c)
		if cached, found := cm.cache.Get(cacheKey); found {
			logrus.Debugf("Cache hit for key: %s", cacheKey)
			c.Data(http.StatusOK, "application/json", cached.([]byte))
			c.Abort()
			return
		}

		c.Set("cache_key", cacheKey)
		c.Next()
	}
}

func (cm *CacheMiddleware) SetResponse(key string, responseBody []byte) {
	cm.cache.Set(key, responseBody, cache.DefaultExpiration)
}

func (cm *CacheMiddleware) generateCacheKey(c *gin.Context) string {
	hash := sha256.New()
	hash.Write([]byte(c.Request.URL.String()))
	return hex.EncodeToString(hash.Sum(nil))
}

func CacheResponse() gin.HandlerFunc {
	cacheMiddleware := NewCacheMiddleware(&CacheConfig{
		Enabled:      true,
		TTL:          5 * time.Minute,
		ExcludePaths: []string{},
	})

	return func(c *gin.Context) {
		if c.Request.Method != http.MethodGet {
			c.Next()
			return
		}

		cacheKey := cacheMiddleware.generateCacheKey(c)
		if cached, found := cacheMiddleware.cache.Get(cacheKey); found {
			logrus.Debugf("Cache hit for: %s", c.Request.URL.Path)
			c.Data(http.StatusOK, "application/json", cached.([]byte))
			c.Abort()
			return
		}

		rec := &responseRecorder{
			ResponseWriter: c.Writer,
			body:           nil,
		}
		c.Writer = rec

		c.Next()

		if rec.body != nil && len(rec.body) > 0 {
			cacheMiddleware.cache.Set(cacheKey, rec.body, cache.DefaultExpiration)
		}
	}
}

type responseRecorder struct {
	gin.ResponseWriter
	body []byte
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body = append(r.body, b...)
	return r.ResponseWriter.Write(b)
}

func ParseRequestBody(body io.Reader, v interface{}) ([]byte, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}
	if err := json.Unmarshal(data, v); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON: %w", err)
	}
	return data, nil
}

func MarshalResponse(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}
