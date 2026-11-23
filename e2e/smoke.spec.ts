import { test, expect, type Locator } from '@playwright/test';

/** All aria-labels at once (atomic, never waits for an element that just disappeared). */
const labels = (l: Locator) => l.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));

test('onboarding → first workout → progress (iPhone viewport)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');

  // Onboarding: four steps, defaults prefilled.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: "Let's go" }).click();

  // Today recommends Workout A with a reason.
  await expect(page.getByText('Lift today')).toBeVisible();
  await expect(page.getByText(/First session/)).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  // Calibration on the first exercise: one tap logs, Solid locks the weight in.
  await expect(page.getByText('Exercise 1 of 6')).toBeVisible();
  await page.getByRole('button', { name: /^Mark set/ }).first().click();
  await expect(page.getByText(/is your working weight/)).toBeVisible();
  // The rating belongs to the set just done.
  await expect(page.getByRole('group', { name: 'How was set 1?' })).toBeVisible();
  await page.getByRole('button', { name: /^Solid/ }).click();
  await expect(page.getByRole('button', { name: /Set 1 felt solid/ })).toBeVisible();

  // Log every remaining prescribed set with one tap each.
  for (let ex = 0; ex < 6; ex++) {
    const mark = page.getByRole('button', { name: /^Mark set/ });
    while (await mark.count()) {
      const label = await mark.first().getAttribute('aria-label');
      await mark.first().click();
      // Wait until the set is saved and the next row (or none) is shown.
      await expect.poll(() => labels(mark), { intervals: [50, 100, 200] }).not.toContain(label);
    }
    // Timed holds (plank): Start → 3 s get-ready → Stop logs the seconds.
    const timer = page.getByRole('button', { name: /^Start the timer/ });
    while (await timer.count()) {
      const label = await timer.first().getAttribute('aria-label');
      await timer.first().click();
      await page.getByRole('button', { name: /^Stop & log/ }).click({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /^Stop & log/ })).toHaveCount(0);
      await expect.poll(() => labels(timer), { intervals: [50, 100, 200] }).not.toContain(label);
    }
    const next = page.getByRole('button', { name: /^Next(:| exercise:)/ });
    if (await next.count()) {
      await next.click();
      await expect(page.getByText(`Exercise ${ex + 2} of 6`)).toBeVisible();
    }
  }
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout done' })).toBeVisible();
  await page.getByRole('link', { name: 'Done' }).click();

  await expect(page.getByText('This week 1 of 3 lifting sessions')).toBeVisible();
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('Sessions this month')).toBeVisible();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('Workout A')).toBeVisible();
  expect(errors).toEqual([]);
});
