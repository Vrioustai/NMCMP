"use client";

import type { Country, Genre } from "@movie/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SearchQuery } from "../../lib/search-query";
import { searchPath } from "../../lib/search-query";
import { Button } from "../ui/button";
import { Drawer } from "../ui/drawer";
import { Select } from "../ui/select";

const YEAR_MIN = 1888;
const YEAR_MAX = 2100;

function readYear(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{4}$/.test(trimmed)) return undefined;
  const year = Number(trimmed);
  if (year < YEAR_MIN || year > YEAR_MAX) return undefined;
  return year;
}

function pushQuery(router: ReturnType<typeof useRouter>, next: SearchQuery) {
  router.push(searchPath({ ...next, page: undefined }));
}

export function SearchFilters({
  genres,
  countries,
  query,
}: {
  genres: Genre[];
  countries: Country[];
  query: SearchQuery;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftGenre, setDraftGenre] = useState(query.genre ? String(query.genre) : "");
  const [draftCountry, setDraftCountry] = useState(query.country ? String(query.country) : "");
  const [draftYear, setDraftYear] = useState(query.releaseYear ? String(query.releaseYear) : "");
  const [yearText, setYearText] = useState(query.releaseYear ? String(query.releaseYear) : "");
  const count = [query.genre, query.country, query.releaseYear].filter((item) => item).length;

  useEffect(() => {
    setYearText(query.releaseYear ? String(query.releaseYear) : "");
  }, [query.releaseYear]);

  const openSheet = () => {
    setDraftGenre(query.genre ? String(query.genre) : "");
    setDraftCountry(query.country ? String(query.country) : "");
    setDraftYear(query.releaseYear ? String(query.releaseYear) : "");
    setOpen(true);
  };

  const applyYear = (text: string) => {
    const trimmed = text.trim();
    if (trimmed && readYear(trimmed) === undefined) {
      setYearText(query.releaseYear ? String(query.releaseYear) : "");
      return;
    }
    pushQuery(router, { ...query, releaseYear: readYear(trimmed) });
  };

  return (
    <>
      <div className="hidden gap-3 md:grid md:grid-cols-3">
        <Select
          label="Thể loại"
          name="genre"
          value={query.genre ? String(query.genre) : ""}
          onChange={(event) =>
            pushQuery(router, {
              ...query,
              genre: event.target.value ? Number(event.target.value) : undefined,
            })
          }
        >
          <option value="">Tất cả</option>
          {genres.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.name}
            </option>
          ))}
        </Select>
        <Select
          label="Quốc gia"
          name="country"
          value={query.country ? String(query.country) : ""}
          onChange={(event) =>
            pushQuery(router, {
              ...query,
              country: event.target.value ? Number(event.target.value) : undefined,
            })
          }
        >
          <option value="">Tất cả</option>
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </Select>
        <label className="grid gap-1 text-sm">
          <span>Năm</span>
          <input
            inputMode="numeric"
            value={yearText}
            placeholder="Một năm"
            className="h-10 rounded-control border border-line bg-raised px-3 text-ink"
            onChange={(event) => setYearText(event.target.value)}
            onBlur={() => applyYear(yearText)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyYear(yearText);
            }}
          />
        </label>
      </div>
      <button
        type="button"
        className="h-10 rounded-control bg-raised px-4 text-sm md:hidden"
        onClick={openSheet}
      >
        Bộ lọc · {count}
      </button>
      <Drawer open={open} title="Bộ lọc" placement="bottom" onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          <Select
            label="Thể loại"
            name="draft-genre"
            value={draftGenre}
            onChange={(event) => setDraftGenre(event.target.value)}
          >
            <option value="">Tất cả</option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </Select>
          <Select
            label="Quốc gia"
            name="draft-country"
            value={draftCountry}
            onChange={(event) => setDraftCountry(event.target.value)}
          >
            <option value="">Tất cả</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>
          <label className="grid gap-1 text-sm">
            <span>Năm</span>
            <input
              inputMode="numeric"
              value={draftYear}
              placeholder="Một năm"
              className="h-10 rounded-control border border-line bg-raised px-3 text-ink"
              onChange={(event) => setDraftYear(event.target.value)}
            />
          </label>
          <Button
            onClick={() => {
              const year = readYear(draftYear);
              pushQuery(router, {
                q: query.q,
                genre: draftGenre ? Number(draftGenre) : undefined,
                country: draftCountry ? Number(draftCountry) : undefined,
                releaseYear: draftYear.trim() ? (year ?? query.releaseYear) : undefined,
              });
              setOpen(false);
            }}
          >
            Áp dụng
          </Button>
        </div>
      </Drawer>
    </>
  );
}
