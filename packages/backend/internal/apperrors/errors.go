package apperrors

import (
	"errors"
	"net/http"
)

type Error struct {
	StatusCode    int
	PublicMessage string
	Cause         error
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	if e.Cause != nil {
		return e.Cause.Error()
	}
	return e.PublicMessage
}

func (e *Error) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Cause
}

func New(statusCode int, publicMessage string, cause error) error {
	return &Error{
		StatusCode:    statusCode,
		PublicMessage: publicMessage,
		Cause:         cause,
	}
}

func BadRequest(publicMessage string, cause error) error {
	return New(http.StatusBadRequest, publicMessage, cause)
}

func Unauthorized(publicMessage string, cause error) error {
	return New(http.StatusUnauthorized, publicMessage, cause)
}

func Forbidden(publicMessage string, cause error) error {
	return New(http.StatusForbidden, publicMessage, cause)
}

func NotFound(publicMessage string, cause error) error {
	return New(http.StatusNotFound, publicMessage, cause)
}

func Conflict(publicMessage string, cause error) error {
	return New(http.StatusConflict, publicMessage, cause)
}

func TooManyRequests(publicMessage string, cause error) error {
	return New(http.StatusTooManyRequests, publicMessage, cause)
}

func As(err error) (*Error, bool) {
	var typed *Error
	if errors.As(err, &typed) {
		return typed, true
	}
	return nil, false
}
