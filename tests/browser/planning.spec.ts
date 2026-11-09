import { test, expect } from "@playwright/test";
test("confirmed legacy failure is reflected in overview and exported summary", async ({
  page,
}) => {
  const proof = {
    source: "합성 점검",
    checkedAt: "2026-11-09",
    method: "document",
    status: "reviewed",
    reviewer: "점검",
    reviewedAt: "2026-11-09T00:00:00Z",
  };
  await page.addInitScript(
    (p) =>
      localStorage.setItem(
        "letus-pilot-notes-v1",
        JSON.stringify({
          inspection: {
            schemaVersion: 1,
            siteId: "yongin-nampyeong-111-73-floor9",
            observations: [
              { id: "a", field: "parking_height", value: 3, unit: "m", ...p },
              { id: "b", field: "vehicle_height", value: 4, unit: "m", ...p },
            ],
            selected: { parking_height: "a", vehicle_height: "b" },
            margins: { height: 0.2, width: 0.2 },
          },
        }),
      ),
    proof,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "현장 개요", exact: true }).click();
  await expect(page.getByTestId("overview-inspection")).toContainText(
    "조건 초과",
  );
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "기록 내려받기", exact: true }).click(),
  ]);
  const fs = await import("node:fs/promises");
  const data = JSON.parse(await fs.readFile((await download.path())!, "utf8"));
  expect(data.inspectionResult.overall).toBe("fail");
});
test("candidate comparison, replay and fixed work sheet are usable and marked synthetic", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("map-status")).toContainText("지도 연결됨", {
    timeout: 45000,
  });
  await page.getByRole("button", { name: "반입 계획", exact: true }).click();
  await expect(page.getByTestId("plan-overall")).toContainText("정보 부족");
  await page
    .getByRole("button", { name: "합성 예제로 기능 확인", exact: true })
    .click();
  await expect(page.getByTestId("example-banner")).toContainText("실제 현장");
  await expect(page.getByTestId("candidate-Z-wide")).toContainText(
    "입력 조건상 통과",
  );
  await expect(page.getByTestId("candidate-Z-low")).toContainText(
    "간섭·조건 초과",
  );
  await page
    .getByTestId("candidate-Z-wide")
    .getByRole("button", { name: "선택", exact: true })
    .click();
  await page.getByLabel("이동 재생 위치").press("End");
  await page
    .getByRole("button", { name: "현재 조건으로 작업서 발행", exact: true })
    .click();
  await expect(page.getByTestId("work-order-state")).toContainText("현재 조건");
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page
      .getByRole("button", { name: "작업서 인쇄 / PDF", exact: true })
      .click(),
  ]);
  await expect(
    popup.getByRole("heading", { name: /LETUS 반입 작업서/ }),
  ).toBeVisible();
  await expect(popup.locator("body")).toContainText("합성 예제");
  await popup.close();
  await page.getByRole("button", { name: "장비", exact: true }).click();
  await page.getByLabel("차량 높이 (m)", { exact: true }).fill("9");
  await page.getByRole("button", { name: "결과", exact: true }).click();
  await expect(page.getByTestId("work-order-state")).toContainText("재검토");
  await expect(page.getByTestId("candidate-Z-wide")).toContainText("정보 부족");
  const [historical] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", {
        name: "이전 조건 작업서 (재검토본) 내려받기",
        exact: true,
      })
      .click(),
  ]);
  const fs = await import("node:fs/promises");
  const html = await fs.readFile((await historical.path())!, "utf8");
  expect(html).toContain("조건 변경 · 현장 사용 중지");
  expect(html).not.toContain("조건상 추천");
});
test("new measured route can be entered by keyboard and changing a dimension clears verification", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "경로", exact: true }).click();
  await page
    .getByRole("button", { name: "차량 경로 추가", exact: true })
    .click();
  await page
    .getByText("좌표로 경로 지점 추가 (기준점 동·북 m)", { exact: true })
    .click();
  for (const x of ["0", "40"]) {
    await page.getByLabel("경로 지점 동쪽 (m)", { exact: true }).fill(x);
    await page.getByLabel("경로 지점 북쪽 (m)", { exact: true }).fill("0");
    await page
      .getByRole("button", { name: "좌표 지점 추가", exact: true })
      .click();
  }
  await page.getByLabel("구간 1 유효 폭 (m)", { exact: true }).fill("5");
  await page.getByLabel("출처 · 구간 1", { exact: true }).fill("합성 도면");
  await page.getByLabel("확인일 · 구간 1", { exact: true }).fill("2026-11-09");
  const group = page.locator(".segment-editor").first();
  await group
    .getByRole("checkbox", { name: "입력한 위치·치수와 출처를 확인함" })
    .check();
  await page.getByLabel("구간 1 유효 폭 (m)", { exact: true }).fill("4");
  await expect(
    group.getByRole("checkbox", { name: "입력한 위치·치수와 출처를 확인함" }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "경로", exact: true }).click();
  await expect(
    page.getByLabel("구간 1 유효 폭 (m)", { exact: true }),
  ).toHaveValue("4");
});
test("example mode leaves the actual site plan intact and saved work sheets survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "현장·파일", exact: true }).click();
  await page
    .getByLabel("작업 동·반입구", { exact: true })
    .fill("실제 현장 기록 유지");
  await page.getByRole("button", { name: "결과", exact: true }).click();
  await page
    .getByRole("button", { name: "현재 조건으로 작업서 발행", exact: true })
    .click();
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await page
    .getByRole("button", { name: "합성 예제로 기능 확인", exact: true })
    .click();
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("example-banner")).toHaveCount(0);
  await expect(page.getByTestId("work-order-state")).toContainText("현재 조건");
  await page.getByRole("button", { name: "현장·파일", exact: true }).click();
  await expect(page.getByLabel("작업 동·반입구", { exact: true })).toHaveValue(
    "실제 현장 기록 유지",
  );
});
test("mobile planner fits and invalid imports preserve the visible candidate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "반입 계획", exact: true }).click();
  await page
    .getByRole("button", { name: "합성 예제로 기능 확인", exact: true })
    .click();
  await page.getByRole("button", { name: "현장·파일", exact: true }).click();
  await page.getByLabel("반입 계획 파일 가져오기").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await expect(page.getByTestId("plan-message")).toContainText(
    "읽을 수 없습니다",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "결과", exact: true }).click();
  await expect(page.getByTestId("candidate-Z-wide")).toBeVisible();
});
