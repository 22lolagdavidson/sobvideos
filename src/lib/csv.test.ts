import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";
import { parseDate, parseRoster } from "./roster";

describe("csv", () => {
  it("parses quotes, commas and CRLF", () => {
    expect(parseCsv('a,"b, c","d ""q"""\r\n1,2,3\r\n')).toEqual([["a", "b, c", 'd "q"'], ["1", "2", "3"]]);
  });
  it("round-trips and blocks formula injection", () => {
    expect(toCsv([["=SUM(A1)", 'x"y', "plain"]])).toBe(`'=SUM(A1),"x""y",plain\r\n`);
  });
});

describe("parseRoster", () => {
  it("reads headerless name,email,hire rows", () => {
    const r = parseRoster("Ana Diaz, ANA@x.com, 3/4/2022\nBo Kim,bo@x.com,");
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { name: "Ana Diaz", email: "ana@x.com", hireDate: "2022-03-04" },
      { name: "Bo Kim", email: "bo@x.com", hireDate: null },
    ]);
  });
  it("uses a header to find columns, joins first/last, accepts tabs", () => {
    const r = parseRoster("Email\tFirst Name\tLast Name\tHire Date\nana@x.com\tAna\tDiaz\t2022-03-04");
    expect(r.rows).toEqual([{ name: "Ana Diaz", email: "ana@x.com", hireDate: "2022-03-04" }]);
  });
  it("reports bad rows with line numbers", () => {
    const r = parseRoster("name,email,hire date\nAna,not-an-email,\nBo,bo@x.com,2/30/2022\nCy,cy@x.com,\nCy2,CY@x.com,");
    expect(r.rows.map((x) => x.email)).toEqual(["cy@x.com"]);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 5]);
  });
  it("validates dates", () => {
    expect(parseDate("12/31/99")).toBe("1999-12-31");
    expect(() => parseDate("2022-02-30")).toThrow();
  });
});
