import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect } from "vitest";
import { AdLabel } from "../AdLabel";

const messages = { ads: { label: "Advertisement" } };

function renderWithIntl(ui: React.ReactElement, locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("AdLabel", () => {
  it("renders the label text from translations", () => {
    renderWithIntl(<AdLabel><div>child</div></AdLabel>);
    expect(screen.getByText("Advertisement")).toBeInTheDocument();
  });

  it("renders children inside the wrapper", () => {
    renderWithIntl(<AdLabel><span data-testid="inner">ad here</span></AdLabel>);
    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });

  it("uses aside with aria-label for accessibility", () => {
    renderWithIntl(<AdLabel><div>child</div></AdLabel>);
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveAttribute("aria-label", "Advertisement");
  });
});
