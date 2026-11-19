import { moviesQuery, parseSearchParams, searchPath } from "./search-query";

describe("search query", () => {
  it("keeps a shareable path and drops an empty search", () => {
    expect(searchPath({ q: "nhà", genre: 2, page: 1 })).toBe("/search?q=nh%C3%A0&genre=2");
    expect(searchPath({})).toBe("/search");
  });

  it("drops a year outside the catalog and a genre that is not an id", () => {
    expect(parseSearchParams({ q: "  nhà ", genre: "no", releaseYear: "1800", page: "3" })).toEqual(
      { q: "nhà", page: 3 },
    );
  });

  it("asks the catalog API with the same filters", () => {
    expect(moviesQuery({ q: "nhà", country: 4, releaseYear: 2020, page: 2 })).toBe(
      "q=nh%C3%A0&country=4&releaseYear=2020&page=2&pageSize=24",
    );
  });
});
