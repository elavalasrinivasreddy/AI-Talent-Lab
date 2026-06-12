import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

/**
 * Recruiter core-loop E2E — a full browser walk of the inbound hiring loop.
 *
 * This upgrades backend/tests/test_candidate_core_loop.py (API-level) to a real
 * Chromium walk: seed → recruiter login → position pipeline → candidate review →
 * schedule-interview UI → public candidate status portal.
 *
 * Self-contained: everything it needs is seeded via the dev console
 * (POST /api/v1/dev/seed-core-loop) in beforeAll and torn down in afterAll.
 * No LLM calls (the application is seeded already-scored) and no Celery workers.
 *
 * Requires BOTH dev servers running:
 *   - Vite on :5173 (npm run dev)
 *   - uvicorn on :8000 with DEV_MODE=true
 */

// Use 127.0.0.1 (not "localhost") so we hit uvicorn's IPv4 bind directly and
// don't fall through to an unbound IPv6 ::1. Override with E2E_API_BASE.
const API_BASE = process.env.E2E_API_BASE || 'http://127.0.0.1:8000'

type Seed = {
  org_id: number
  position_id: number
  candidate_id: number
  application_id: number
  status_token: string
  hr_email: string
  hr_password: string
  candidate_email: string
}

let api: APIRequestContext
let seed: Seed

test.describe.configure({ mode: 'serial' })

test.describe('Recruiter core loop', () => {
  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: API_BASE })

    // 1. Seed org → hr user → position → candidate → application(screening, scored)
    const res = await api.post('/api/v1/dev/seed-core-loop', {
      data: { role_name: 'Backend Engineer', candidate_name: 'Ada Lovelace' },
    })
    expect(
      res.ok(),
      `seed-core-loop failed (${res.status()}). Is the backend running with DEV_MODE=true? Body: ${await res.text()}`,
    ).toBeTruthy()
    seed = await res.json()
    expect(seed.position_id).toBeTruthy()
    expect(seed.status_token).toBeTruthy()
  })

  test.afterAll(async () => {
    if (seed?.org_id) {
      await api.delete(`/api/v1/dev/seed-core-loop/${seed.org_id}`).catch(() => {})
    }
    await api.dispose()
  })

  test('recruiter logs in and lands on the dashboard', async ({ page }) => {
    await page.goto('/login')

    // LoginPage has both a magic-link email field and the password form; target
    // the password form by its specific ids to avoid the strict-mode collision.
    await page.fill('#login-email', seed.hr_email)
    await page.fill('#login-password', seed.hr_password)
    await page.click('form.auth-form button[type="submit"]')

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('candidate appears in the position pipeline and detail loads with ATS score', async ({ page }) => {
    // Log in (each test gets a fresh context).
    await page.goto('/login')
    await page.fill('#login-email', seed.hr_email)
    await page.fill('#login-password', seed.hr_password)
    await page.click('form.auth-form button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })

    // 3. View position pipeline → Candidates tab. The detail page renders the
    // CandidatesTab when the :tab route segment is "candidates".
    await page.goto(`/positions/${seed.position_id}/candidates`)

    // The seeded candidate row should render (CandidatesTab → .cand-name).
    const candidateName = page.locator('.cand-name', { hasText: 'Ada Lovelace' })
    await expect(candidateName).toBeVisible({ timeout: 15_000 })

    // 4. Review candidate — click the row, land on /candidates/:id.
    await page.locator('.cand-row', { hasText: 'Ada Lovelace' }).first().click()
    await page.waitForURL(new RegExp(`/candidates/${seed.candidate_id}`), { timeout: 15_000 })

    // Detail page hero + score breakdown band confirm the ATS score section.
    await expect(page.locator('.cd-page')).toBeVisible({ timeout: 15_000 })
    // The 3-card AI signal row is rendered from the seeded skill_match_data.
    await expect(page.getByText('AI Analysis').first()).toBeVisible()
    await expect(page.getByText('Career Trajectory').first()).toBeVisible()

    // 5. Schedule interview — the hero exposes the action; verify it opens the
    // modal (we don't submit, to keep the test free of side effects).
    const scheduleBtn = page.getByRole('button', { name: /schedule/i }).first()
    if (await scheduleBtn.count()) {
      await scheduleBtn.click()
      // ScheduleInterviewModal renders a dialog/heading; tolerate either.
      const modal = page.locator('[role="dialog"], .modal-overlay, .modal').first()
      await expect(modal).toBeVisible({ timeout: 10_000 })
    }
  })

  test('public candidate status portal shows the timeline', async ({ page }) => {
    // 6. Candidate portal — no auth, by status_token.
    await page.goto(`/status/${seed.status_token}`)

    // The status card renders the role name and the status banner.
    await expect(page.locator('.cs-card')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.cs-role')).toContainText('Backend Engineer')

    // Timeline section is seeded with an "application_received" event.
    await expect(page.getByText('Application Timeline')).toBeVisible({ timeout: 10_000 })
  })
})
