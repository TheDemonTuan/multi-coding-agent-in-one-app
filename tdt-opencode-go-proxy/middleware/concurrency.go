package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"golang.org/x/sync/semaphore"
)

type ConcurrencyConfig struct {
	MaxConcurrent int64
}

type ConcurrencyLimiter struct {
	sem *semaphore.Weighted
}

func NewConcurrencyLimiter(maxConcurrent int64) *ConcurrencyLimiter {
	if maxConcurrent == 0 {
		maxConcurrent = 50
	}
	return &ConcurrencyLimiter{
		sem: semaphore.NewWeighted(maxConcurrent),
	}
}

func (cl *ConcurrencyLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		err := cl.sem.Acquire(c.Request.Context(), 1)
		if err != nil {
			logrus.Warn("Failed to acquire semaphore")
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": "too many concurrent requests, please try again later",
			})
			c.Abort()
			return
		}
		defer cl.sem.Release(1)
		c.Next()
	}
}

func ConcurrencyLimit(maxConcurrent int64) gin.HandlerFunc {
	limiter := NewConcurrencyLimiter(maxConcurrent)
	return limiter.Middleware()
}

func WithConcurrencyLimit(ctx context.Context, maxConcurrent int64, fn func() error) error {
	sem := semaphore.NewWeighted(maxConcurrent)
	if err := sem.Acquire(ctx, 1); err != nil {
		return err
	}
	defer sem.Release(1)
	return fn()
}
