FROM golang:1.25-bookworm AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
  go build -trimpath -ldflags="-s -w" -o /out/lucky-scratch-backend .

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /out/lucky-scratch-backend /usr/local/bin/lucky-scratch-backend
COPY sql ./sql

ENTRYPOINT ["/usr/local/bin/lucky-scratch-backend"]
CMD ["all"]
