package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

const RequestIDHeader = "X-Request-ID"

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader(RequestIDHeader)
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("request_id", requestID)
		c.Writer.Header().Set(RequestIDHeader, requestID)

		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()
		requestIDFromCtx, _ := c.Get("request_id")

		logrus.WithFields(logrus.Fields{
			"request_id": requestIDFromCtx,
			"status":     statusCode,
			"latency":    latency,
			"method":     c.Request.Method,
			"path":       path,
			"client_ip":  c.ClientIP(),
		}).Info("Request completed")
	}
}
