// Pricing on argusinstinct.xyz follows the canonical price book (archymedes-gtm docs/PRICE-BOOK.md, 4 Nov 2026):
// Argus Desktop $79 per computer per year, Argus Server $50 per server per year. No free tier, no Server Review,
// no Watch plan. Run: cd web && bun test
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const llms = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");

const section = (id: string) => {
  const m = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`));
  if (!m) throw new Error(`section #${id} missing`);
  return m[0];
};
const jsonLd = () => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("JSON-LD missing");
  return JSON.parse(m[1]);
};
const offers = (): { name: string; price: string; priceCurrency: string }[] => {
  const graph = jsonLd()["@graph"] ?? [jsonLd()];
  return graph.flatMap((n: any) => n.offers ?? []);
};

const RETIRED: [string, RegExp][] = [
  ["$149 review", /\$\s?149\b/],
  ["Server Review", /server review/i],
  ["Argus Watch", /argus watch\b/i],
  ["$9 a month", /\$\s?9\s?(\/|per|a)\s?(mo|month)/i],
  ["free beta", /free (during the )?beta|free beta|beta and server edition/i],
  ["free download", /download free|free download/i],
  ["free to run", /free to run/i],
  ["then $79", /then \$79/i],
];

describe("retired prices appear nowhere", () => {
  for (const [name, re] of RETIRED) {
    test(`index.html: ${name}`, () => expect(html).not.toMatch(re));
    test(`llms.txt: ${name}`, () => expect(llms).not.toMatch(re));
  }
});

describe("pricing section", () => {
  test("shows Desktop at $79 per computer per year", () => {
    expect(section("pricing")).toMatch(/Desktop[\s\S]*?\$79[\s\S]*?per year/);
  });
  test("shows Server at $50 per server per year", () => {
    expect(section("pricing")).toMatch(/Server[\s\S]*?\$50[\s\S]*?per server, per year/);
  });
  test("has exactly two plans", () => {
    expect(section("pricing").match(/<article class="plan/g)?.length).toBe(2);
  });
});

describe("structured data", () => {
  test("offers are exactly Desktop $79 and Server $50, in USD, never free", () => {
    const o = offers();
    expect(o.map((x) => [x.price, x.priceCurrency]).sort()).toEqual([["50", "USD"], ["79", "USD"]]);
    expect(o.some((x) => Number(x.price) === 0)).toBe(false);
  });
  test("JSON-LD still parses", () => expect(() => jsonLd()).not.toThrow());
});

describe("meta and llms.txt", () => {
  test("meta descriptions name both prices", () => {
    for (const name of ["description", "twitter:description"]) {
      const m = html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`));
      expect(m?.[1]).toMatch(/\$79/);
      expect(m?.[1]).toMatch(/\$50/);
    }
  });
  test("llms.txt lists both yearly prices", () => {
    expect(llms).toMatch(/Argus Desktop[^\n]*\$79 per year/);
    expect(llms).toMatch(/Argus Server[^\n]*\$50 per server, per year/);
  });
});

describe("cost question", () => {
  test("visible FAQ answers what it costs with both prices", () => {
    const m = html.match(/<summary>What does it cost\?<\/summary><p>([^<]*)<\/p>/);
    expect(m?.[1]).toMatch(/\$79/);
    expect(m?.[1]).toMatch(/\$50/);
  });
  test("FAQPage structured data carries the same question", () => {
    const faq = jsonLd()["@graph"].find((n: any) => n["@type"] === "FAQPage");
    const q = faq.mainEntity.find((e: any) => /cost/i.test(e.name));
    expect(q?.acceptedAnswer.text).toMatch(/\$79[\s\S]*\$50/);
  });
});

describe("layout", () => {
  test("the plans grid has one column per plan on wide screens", () => {
    const cols = css.match(/\.plans \{[^}]*grid-template-columns: repeat\((\d+)/)?.[1];
    const plans = section("pricing").match(/<article class="plan/g)?.length;
    expect(Number(cols)).toBe(plans!);
  });
});
