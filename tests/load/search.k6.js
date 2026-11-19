import http from "k6/http";
import { check, sleep } from "k6";

// 50 người gọi tìm kiếm và lọc cùng lúc. Ngưỡng p95 là 2 giây.
const base = __ENV.API_URL || "http://host.docker.internal:4000";

export const options = {
  scenarios: {
    searchAndFilter: {
      executor: "constant-vus",
      vus: 50,
      duration: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:search}": ["p(95)<2000"],
    "http_req_duration{kind:filter}": ["p(95)<2000"],
  },
};

export function setup() {
  const genres = http.get(`${base}/api/genres`);
  const countries = http.get(`${base}/api/countries`);
  const genreList = genres.json();
  const countryList = countries.json();
  return {
    genreId: firstId(genreList),
    countryId: firstId(countryList),
  };
}

export default function (data) {
  const search = http.get(`${base}/api/movies?q=${encodeURIComponent("phim")}&page=1&pageSize=24`, {
    tags: { kind: "search" },
  });
  check(search, { "tim kiem tra 200": (res) => res.status === 200 });

  const filter = http.get(
    `${base}/api/movies?genre=${data.genreId}&country=${data.countryId}&releaseYear=2020&page=1&pageSize=24`,
    { tags: { kind: "filter" } },
  );
  check(filter, { "loc tra 200": (res) => res.status === 200 });
  sleep(1);
}

function firstId(value) {
  if (!Array.isArray(value) || value.length === 0) return 1;
  const id = value[0] && value[0].id;
  return typeof id === "number" ? id : 1;
}
