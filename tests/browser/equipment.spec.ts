import { test, expect } from "@playwright/test";
for (const mobile of [false, true])
  test(`equipment choices are saved and recovered (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    await page.goto("/");
    await expect(page.getByTestId("map-status")).toContainText("지도 연결됨", {
      timeout: 45000,
    });
    await page.getByRole("button", { name: "장비", exact: true }).click();
    await page.getByLabel("반입 차량 대수", { exact: true }).selectOption("2");
    await page.getByLabel("차량 종류", { exact: true }).selectOption("cargo");
    await page.getByLabel("톤급 빠른 선택", { exact: true }).selectOption("5");
    await page.getByLabel("차량 높이 (m)", { exact: true }).fill("3.8");
    await page
      .getByLabel("하역 장비 종류", { exact: true })
      .selectOption("ladder");
    await page.getByLabel("목표 작업 높이 (m)", { exact: true }).fill("28");
    await expect(
      page.getByLabel("포크 돌출 길이 (m)", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("하역 장비 종류", { exact: true })
      .selectOption("forklift");
    await page.getByLabel("하강 마스트 높이 (m)", { exact: true }).fill("2.9");
    await page
      .getByLabel("하역 장비 종류", { exact: true })
      .selectOption("ladder");
    await expect(
      page.getByLabel("목표 작업 높이 (m)", { exact: true }),
    ).toHaveValue("28");
    await page.getByRole("button", { name: "기록 저장", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "장비", exact: true }).click();
    await expect(
      page.getByLabel("반입 차량 대수", { exact: true }),
    ).toHaveValue("2");
    await expect(page.getByLabel("차량 종류", { exact: true })).toHaveValue(
      "cargo",
    );
    await expect(
      page.getByLabel("톤수 직접 입력 (t)", { exact: true }),
    ).toHaveValue("5");
    await expect(
      page.getByLabel("하역 장비 종류", { exact: true }),
    ).toHaveValue("ladder");
    await page.getByLabel("반입 차량 대수", { exact: true }).selectOption("6");
    await page.getByLabel("반입 차량 대수", { exact: true }).selectOption("2");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.data/equipment-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "결과", exact: true }).click();
    await expect(page.getByTestId("plan-overall")).toContainText("정보 부족");
    await page
      .getByRole("button", { name: "현재 조건으로 작업서 발행", exact: true })
      .click();
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page
        .getByRole("button", { name: "작업서 인쇄 / PDF", exact: true })
        .click(),
    ]);
    await expect(popup.locator("body")).toContainText("전체 2대");
    await expect(popup.locator("body")).toContainText("5톤 카고");
    await expect(popup.locator("body")).toContainText("사다리차");
    await popup.close();
  });
