package models

const (
	PoolStatusInitializing = "Initializing"
	PoolStatusActive       = "Active"
	PoolStatusSoldOut      = "SoldOut"
	PoolStatusClosing      = "Closing"
	PoolStatusClosed       = "Closed"

	RoundStatusPendingVRF = "PendingVRF"
	RoundStatusReady      = "Ready"
	RoundStatusSoldOut    = "SoldOut"
	RoundStatusSettled    = "Settled"

	TicketStatusUnscratched = "Unscratched"
	TicketStatusScratched   = "Scratched"
	TicketStatusClaimed     = "Claimed"

	GaslessStatusCreated   = "created"
	GaslessStatusValidated = "validated"
	GaslessStatusSubmitted = "submitted"
	GaslessStatusConfirmed = "confirmed"
	GaslessStatusFinalized = "finalized"
	GaslessStatusFailed    = "failed"
	GaslessStatusDropped   = "dropped"

	JobStatusPending   = "pending"
	JobStatusRunning   = "running"
	JobStatusCompleted = "completed"
	JobStatusFailed    = "failed"
)

var poolStatusNames = []string{
	PoolStatusInitializing,
	PoolStatusActive,
	PoolStatusSoldOut,
	PoolStatusClosing,
	PoolStatusClosed,
}

var roundStatusNames = []string{
	RoundStatusPendingVRF,
	RoundStatusReady,
	RoundStatusSoldOut,
	RoundStatusSettled,
}

var ticketStatusNames = []string{
	TicketStatusUnscratched,
	TicketStatusScratched,
	TicketStatusClaimed,
}

func PoolStatusName(value uint8) string {
	return enumName(poolStatusNames, value, PoolStatusInitializing)
}

func RoundStatusName(value uint8) string {
	return enumName(roundStatusNames, value, RoundStatusPendingVRF)
}

func TicketStatusName(value uint8) string {
	return enumName(ticketStatusNames, value, TicketStatusUnscratched)
}

func enumName(values []string, raw uint8, fallback string) string {
	index := int(raw)
	if index < 0 || index >= len(values) {
		return fallback
	}
	return values[index]
}
