package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"
)

type RateLimitConfig struct {
	RequestsPerSecond float64
	Burst             int
}

type RateLimiter struct {
	limiters map[string]*clientLimiter
	mu       sync.RWMutex
	config   *RateLimitConfig
}

type clientLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func NewRateLimiter(config *RateLimitConfig) *RateLimiter {
	if config.RequestsPerSecond == 0 {
		config.RequestsPerSecond = 100
	}
	if config.Burst == 0 {
		config.Burst = 200
	}

	rl := &RateLimiter{
		limiters: make(map[string]*clientLimiter),
		config:   config,
	}

	go rl.cleanupStaleClients()

	return rl
}

func (rl *RateLimiter) cleanupStaleClients() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		for key, cl := range rl.limiters {
			if time.Since(cl.lastSeen) > 10*time.Minute {
				delete(rl.limiters, key)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) getClientLimiter(key string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if cl, exists := rl.limiters[key]; exists {
		cl.lastSeen = time.Now()
		return cl.limiter
	}

	limiter := rate.NewLimiter(rate.Limit(rl.config.RequestsPerSecond), rl.config.Burst)
	rl.limiters[key] = &clientLimiter{
		limiter:  limiter,
		lastSeen: time.Now(),
	}
	return limiter
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		limiter := rl.getClientLimiter(clientIP)

		if !limiter.Allow() {
			logrus.Warnf("Rate limit exceeded for client: %s", clientIP)
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": "1s",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func RateLimit(requestsPerSecond float64, burst int) gin.HandlerFunc {
	limiter := NewRateLimiter(&RateLimitConfig{
		RequestsPerSecond: requestsPerSecond,
		Burst:             burst,
	})
	return limiter.Middleware()
}
