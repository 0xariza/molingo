# Shortcuts for the pnpm scripts in package.json. Run `make` to list them.
COMPOSE := docker compose -f compose.dev.yml

.DEFAULT_GOAL := help
.PHONY: help setup install env db-up db-down migrate seed dev live studio check test e2e build start

help: ## List the targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'

setup: install env db-up migrate seed ## First-time setup: deps, .env.local, database, dev accounts

install: ## Install dependencies
	pnpm install

env: ## Create .env.local from .env.example if it is missing
	@test -f .env.local || cp .env.example .env.local

db-up: ## Start Postgres in Docker and wait until it is ready
	$(COMPOSE) up -d --wait db

db-down: ## Stop the Docker services (data is kept)
	$(COMPOSE) down

migrate: ## Apply database migrations
	pnpm db:migrate

seed: ## Create the dev admin and student accounts
	pnpm db:seed

dev: db-up ## Start Postgres and the dev server on http://localhost:3000
	pnpm dev

live: ## Start LiveKit for the live classroom
	$(COMPOSE) --profile live up -d

studio: ## Open Drizzle Studio
	pnpm db:studio

check: ## Formatting, types, lint, i18n, RTL, unit + integration tests
	pnpm check

test: ## Unit + integration tests
	pnpm test

e2e: ## Production build + Playwright
	pnpm test:e2e

build: ## Production build
	pnpm build

start: ## Run the production build
	pnpm start
