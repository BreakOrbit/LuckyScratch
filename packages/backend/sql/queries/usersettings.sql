-- name: GetUserSettings :one
SELECT * FROM user_settings
WHERE wallet_address = lower(sqlc.arg(wallet_address));

-- name: UpsertUserSettings :one
INSERT INTO user_settings (
    wallet_address,
    nickname,
    broadcast_wins,
    security_alerts,
    terminal_hints,
    auto_lock,
    avatar_url
) VALUES (
    lower(sqlc.arg(wallet_address)),
    sqlc.arg(nickname),
    sqlc.arg(broadcast_wins),
    sqlc.arg(security_alerts),
    sqlc.arg(terminal_hints),
    sqlc.arg(auto_lock),
    sqlc.arg(avatar_url)
)
ON CONFLICT (wallet_address) DO UPDATE SET
    nickname = EXCLUDED.nickname,
    broadcast_wins = EXCLUDED.broadcast_wins,
    security_alerts = EXCLUDED.security_alerts,
    terminal_hints = EXCLUDED.terminal_hints,
    auto_lock = EXCLUDED.auto_lock,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW()
RETURNING *;
