package main

import (
	"log"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/app"
)

func main() {
	if err := app.RunWorker(); err != nil {
		log.Fatal(err)
	}
}
