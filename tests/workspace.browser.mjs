// Opt-in acceptance test. Start the backend WorkspacePreview and Vite first.
// This uses a disposable H2 database and a fake model; never a live account.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.AIOPS_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.AIOPS_PLAYWRIGHT_MODULE).href
    : "playwright"
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto("http://localhost:5173/work");
  await page.getByRole("heading", { name: "Sign in to AIOps" }).waitFor();
  await page.getByLabel("Username").fill("owner");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Work queue", exact: true })
    .waitFor();
  await page.goto("http://localhost:5173/agents");
  const card = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Projects Partner", exact: true }),
  });
  await card.getByText("Edit profile", { exact: true }).click();
  await card
    .getByLabel("Name", { exact: true })
    .fill("Project Employee Preview");
  await card.getByRole("button", { name: "Save profile" }).click();
  const renamed = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Project Employee Preview",
      exact: true,
    }),
  });
  await renamed
    .getByRole("heading", { name: "Project Employee Preview" })
    .waitFor();
  await renamed.getByLabel("Upload Markdown (maximum 50 KiB)").setInputFiles({
    name: "preview.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Milestone\nBuild the private workspace first."),
  });
  await renamed.getByRole("button", { name: "Upload and attach" }).click();
  await renamed.getByText("preview.md", { exact: false }).waitFor();
  await page.goto("http://localhost:5173/connections");
  await page
    .getByLabel("Employee access settings", { exact: true })
    .selectOption({ label: "Project Employee Preview" });
  await page
    .getByText("Current access: No mailbox access.", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByLabel("Mail this employee may read", { exact: true })
      .inputValue(),
    "",
  );
  await page
    .getByLabel("Mail this employee may read", { exact: true })
    .selectOption("threads");
  await page
    .getByRole("checkbox", {
      name: "Preview milestone discussion",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Grant this employee the mailbox access selected above",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Save mailbox access", exact: true })
    .click();
  await page
    .getByText("Current access: Selected threads.", { exact: true })
    .waitFor();
  await page
    .getByLabel("Mail this employee may read", { exact: true })
    .selectOption("labels");
  await page
    .getByRole("checkbox", { name: "Preview project mail", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Save mailbox access", exact: true })
    .click();
  await page
    .getByText("Current access: Selected labels.", { exact: true })
    .waitFor();
  await page
    .getByLabel("Mail this employee may read", { exact: true })
    .selectOption("mailbox");
  await page
    .getByRole("button", { name: "Save mailbox access", exact: true })
    .click();
  await page
    .getByText("Current access: Entire mailbox.", { exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByLabel("Employee access settings", { exact: true })
    .selectOption({ label: "Project Employee Preview" });
  await page
    .getByText("Current access: Entire mailbox.", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Revoke mailbox access", exact: true })
    .click();
  await page
    .getByText("Current access: No mailbox access.", { exact: true })
    .waitFor();
  await page.goto("http://localhost:5173/agents");
  await renamed.getByRole("link", { name: "Assign work" }).click();
  await page
    .getByLabel("Job", { exact: true })
    .fill("Prepare a milestone progress report.");
  await page
    .getByLabel("Desired outcome")
    .fill("A grounded next-step suggestion.");
  await page.getByRole("checkbox", { name: "preview.md" }).check();
  await page.getByRole("button", { name: "Submit job" }).click();
  await page
    .getByRole("heading", { name: "Saved suggestion" })
    .waitFor({ timeout: 20000 });
  await page.reload();
  await page
    .getByRole("button")
    .filter({ hasText: "Prepare a milestone progress report." })
    .click();
  await page.getByRole("heading", { name: "Saved suggestion" }).waitFor();
  assert.match(await page.locator("main").innerText(), /preview\.md/);
  await page
    .getByRole("link", { name: "Create an internal draft for review" })
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Preview follow-up task");
  await page.getByRole("button", { name: "Save draft for review" }).click();
  const proposal = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Preview follow-up task" }),
  });
  await proposal.getByRole("button", { name: "Confirm exact draft" }).click();
  await proposal.waitFor({ state: "detached" });
  await page.goto("http://localhost:5173/tasks");
  await page
    .getByRole("heading", { name: "Preview follow-up task", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Preview follow-up task", exact: true })
      .count(),
    1,
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Preview follow-up task", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Complete occurrence", exact: true })
    .click();
  await page.getByRole("button", { name: "Reopen", exact: true }).waitFor();
  await page.goto("http://localhost:5173/work");
  await page
    .getByRole("button")
    .filter({ hasText: "Prepare a milestone progress report." })
    .click();
  await page.getByRole("heading", { name: "Saved suggestion" }).waitFor();
  await mkdir("node_modules/.cache/acceptance", { recursive: true });
  await page.screenshot({
    path: "node_modules/.cache/acceptance/work-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "node_modules/.cache/acceptance/work-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile layout should not overflow",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByLabel("Employee", { exact: true })
    .selectOption({ label: "Project Employee Preview" });
  await page
    .getByLabel("Job", { exact: true })
    .fill("[simulate-expired-key] Verify repair guidance.");
  await page.getByRole("button", { name: "Submit job" }).click();
  await page
    .getByText(
      "OpenAI rejected the API key. It may be incorrect, expired, or revoked.",
      { exact: true },
    )
    .first()
    .waitFor({ timeout: 20000 });
  assert.match(await page.locator("main").innerText(), /OPENAI_API_KEY/);
  assert.match(await page.locator("main").innerText(), /force-recreate/);
  await page.getByRole("button", { name: "Retry job", exact: true }).click();
  await page
    .getByRole("heading", { name: "Saved suggestion" })
    .waitFor({ timeout: 20000 });
  await page.getByText("Attempt 2: completed", { exact: true }).waitFor();

  await page.goto("http://localhost:5173/inbox");
  await page
    .getByLabel("Capture a thought")
    .fill("Synthetic private capture for routing.");
  await page.getByRole("button", { name: "Save capture" }).click();
  await page.getByRole("link", { name: "Assign to employee" }).click();
  assert.ok(
    !page.url().includes("Synthetic"),
    "Capture text must stay out of URLs",
  );
  await page.getByLabel("Job", { exact: true }).waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('textarea[name="instruction"]')?.value ===
      "Synthetic private capture for routing.",
  );
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector('textarea[name="instruction"]')?.value ===
      "Synthetic private capture for routing.",
  );

  await page.goto("http://localhost:5173/assistant");
  await page
    .getByLabel("Employee", { exact: true })
    .selectOption({ label: "Project Employee Preview" });
  await page
    .getByLabel("New conversation title")
    .fill("Preview employee conversation");
  await page.getByRole("button", { name: "Create conversation" }).click();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Suggest the next milestone.");
  await page.getByRole("button", { name: "Send message" }).click();
  await page
    .getByText("Reply: completed", { exact: true })
    .waitFor({ timeout: 20000 });
  await page.reload();
  await page
    .getByLabel("Employee", { exact: true })
    .selectOption({ label: "Project Employee Preview" });
  await page
    .getByLabel("Conversation", { exact: true })
    .selectOption({ label: "Preview employee conversation" });
  await page.getByText("Reply: completed", { exact: true }).waitFor();
  assert.match(
    await page.locator("main").innerText(),
    /Suggest the next milestone/,
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("heading", { name: "Sign in to AIOps" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: session, profiles, Markdown, mailbox scope selection/persistence/revocation, work/results, approvals, task completion, mobile layout, key repair/retry, private capture routing, chat recovery, logout; fake model and Google only.",
  );
} catch (error) {
  console.error(
    "Acceptance failed at",
    page.url(),
    await page.locator("main").innerText(),
  );
  throw error;
} finally {
  await browser.close();
}
