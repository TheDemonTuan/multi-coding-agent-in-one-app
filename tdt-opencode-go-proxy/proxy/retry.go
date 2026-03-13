package proxy

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"
)

type RetryConfig struct {
	MaxRetries     int
	InitialBackoff time.Duration
	MaxBackoff     time.Duration
	Multiplier     float64
	RetryableCodes []int
}

type RetryableError struct {
	message string
}

func (e *RetryableError) Error() string {
	return e.message
}

func NewRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries:     3,
		InitialBackoff: 500 * time.Millisecond,
		MaxBackoff:     5 * time.Second,
		Multiplier:     2.0,
		RetryableCodes: []int{408, 429, 500, 502, 503, 504},
	}
}

type backoff struct {
	base       time.Duration
	multiplier float64
	max        time.Duration
}

func newBackoff(base time.Duration, multiplier float64, max time.Duration) *backoff {
	return &backoff{
		base:       base,
		multiplier: multiplier,
		max:        max,
	}
}

func (b *backoff) Duration(attempt int) time.Duration {
	delay := float64(b.base)
	for i := 0; i < attempt; i++ {
		delay *= b.multiplier
		if delay > float64(b.max) {
			delay = float64(b.max)
		}
	}
	return time.Duration(delay)
}

type RetryClient struct {
	httpClient *http.Client
	config     *RetryConfig
}

func NewRetryClient(httpClient *http.Client, config *RetryConfig) *RetryClient {
	return &RetryClient{
		httpClient: httpClient,
		config:     config,
	}
}

func (rc *RetryClient) DoWithRetry(req *http.Request) (*http.Response, error) {
	var lastErr error
	backoff := newBackoff(rc.config.InitialBackoff, rc.config.Multiplier, rc.config.MaxBackoff)

	for attempt := 0; attempt <= rc.config.MaxRetries; attempt++ {
		if attempt > 0 {
			delay := backoff.Duration(attempt - 1)
			logrus.Debugf("Retry attempt %d after %v", attempt, delay)
			time.Sleep(delay)
		}

		resp, err := rc.httpClient.Do(req)
		if err != nil {
			lastErr = err
			if !rc.isRetryableError(err) {
				logrus.Errorf("Non-retryable error: %v", err)
				return nil, err
			}
			logrus.Warnf("Retryable error: %v", err)
			continue
		}

		if !rc.isRetryableStatusCode(resp.StatusCode) {
			return resp, nil
		}

		lastErr = &RetryableError{
			message: fmt.Sprintf("upstream returned status %d", resp.StatusCode),
		}

		if resp.Body != nil {
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		}

		logrus.Warnf("Retryable status code: %d, attempt %d/%d", resp.StatusCode, attempt, rc.config.MaxRetries)
	}

	return nil, fmt.Errorf("max retries (%d) exceeded, last error: %w", rc.config.MaxRetries, lastErr)
}

func (rc *RetryClient) isRetryableError(err error) bool {
	if err == nil {
		return false
	}

	netErr, ok := err.(net.Error)
	if ok && (netErr.Temporary() || netErr.Timeout()) {
		return true
	}

	_, ok = err.(*RetryableError)
	return ok
}

func (rc *RetryClient) isRetryableStatusCode(code int) bool {
	for _, rc := range rc.config.RetryableCodes {
		if code == rc {
			return true
		}
	}
	return false
}

type CircuitBreakerConfig struct {
	FailureThreshold int
	SuccessThreshold int
	Timeout          time.Duration
}

type CircuitState int

const (
	CircuitClosed CircuitState = iota
	CircuitOpen
	CircuitHalfOpen
)

type CircuitBreaker struct {
	state            CircuitState
	failures         int
	successes        int
	failureThreshold int
	successThreshold int
	timeout          time.Duration
	lastFailure      time.Time
}

func NewCircuitBreaker(config *CircuitBreakerConfig) *CircuitBreaker {
	if config.FailureThreshold == 0 {
		config.FailureThreshold = 5
	}
	if config.SuccessThreshold == 0 {
		config.SuccessThreshold = 3
	}
	if config.Timeout == 0 {
		config.Timeout = 60 * time.Second
	}

	return &CircuitBreaker{
		failureThreshold: config.FailureThreshold,
		successThreshold: config.SuccessThreshold,
		timeout:          config.Timeout,
		state:            CircuitClosed,
	}
}

func (cb *CircuitBreaker) Allow() bool {
	switch cb.state {
	case CircuitClosed:
		return true
	case CircuitOpen:
		if time.Since(cb.lastFailure) > cb.timeout {
			cb.state = CircuitHalfOpen
			cb.successes = 0
			return true
		}
		return false
	case CircuitHalfOpen:
		return true
	}
	return false
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.failures = 0
	if cb.state == CircuitHalfOpen {
		cb.successes++
		if cb.successes >= cb.successThreshold {
			cb.state = CircuitClosed
		}
	}
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.failures++
	cb.lastFailure = time.Now()

	if cb.state == CircuitHalfOpen {
		cb.state = CircuitOpen
	} else if cb.failures >= cb.failureThreshold {
		cb.state = CircuitOpen
	}
}

func (cb *CircuitBreaker) State() CircuitState {
	return cb.state
}

func ExecuteWithRetry(ctx context.Context, config *RetryConfig, fn func() (*http.Response, error)) (*http.Response, error) {
	client := &http.Client{}
	retryClient := NewRetryClient(client, config)
	return retryClient.DoWithRetry(nil)
}

func IsTemporaryNetworkError(err error) bool {
	netErr, ok := err.(net.Error)
	if !ok {
		return false
	}
	return netErr.Temporary() || netErr.Timeout()
}
