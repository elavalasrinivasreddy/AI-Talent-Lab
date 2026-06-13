# AI Talent Lab — developer task runner.
#
# Prereqs: Postgres + Redis running (`docker compose up -d`), backend deps
# installed in the active venv (`pip install -r backend/requirements.txt`), and
# frontend deps installed (`cd frontend && npm install`).

.PHONY: help e2e coverage test-backend test-frontend

# CI coverage floor (%). Baseline measured 2026-06-13 = 37.54% (132 tests);
# floor set just below it so regressions fail CI. Bump as coverage grows. (Q5)
COV_MIN ?= 37

help:
	@echo "Targets:"
	@echo "  make e2e            Boot backend + frontend dev servers, run Playwright core-loop, tear down (Q6)"
	@echo "  make coverage       Backend tests with coverage; fails under COV_MIN% (default $(COV_MIN)) (Q5)"
	@echo "  make test-backend   Run the backend pytest suite"
	@echo "  make test-frontend  Run the frontend vitest suite"

# One command: boots both dev servers, runs the Playwright core-loop (which
# self-seeds via /api/v1/dev/seed-core-loop), then tears the servers down.
e2e:
	bash scripts/e2e.sh

# Backend coverage with an enforced floor. Reads .coveragerc for source/omit.
coverage:
	pytest --cov=backend --cov-report=term-missing --cov-fail-under=$(COV_MIN) backend/tests

test-backend:
	pytest backend/tests

test-frontend:
	cd frontend && npm test
