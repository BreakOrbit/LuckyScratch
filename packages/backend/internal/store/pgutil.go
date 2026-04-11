package store

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func Int8(value int64) pgtype.Int8 {
	return pgtype.Int8{Int64: value, Valid: true}
}

func NullInt8() pgtype.Int8 {
	return pgtype.Int8{}
}

func Timestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func NullTimestamptz() pgtype.Timestamptz {
	return pgtype.Timestamptz{}
}
