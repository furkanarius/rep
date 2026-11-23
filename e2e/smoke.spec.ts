import { test, expect } from '@playwright/test';

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

  // Log every remaining prescribed set with one tap each.
  for (let ex = 0; ex < 6; ex++) {
    const mark = page.getByRole('button', { name: /^Mark set/ });
    while (await mark.count()) {
      const label = await mark.first().getAttribute('aria-label');
      await mark.first().click();
      // Wait until the set is saved and the next row (or none) is shown.
      await expect(async () => {
        const n = await mark.count();
        expect(n === 0 || (await mark.first().getAttribute('aria-label')) !== label).toBe(true);
      }).toPass();
    }
    const next = page.getByRole('button', { name: /^Next:/ });
    if (await next.count()) await next.click();
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
