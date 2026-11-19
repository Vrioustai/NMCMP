"use client";

import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../ui/icon-button";
import { AccountMenu } from "./account-menu";
import { Logo } from "./logo";
import { SearchBox } from "./search-box";

export function SiteHeader({ menuOpen, onMenu }: { menuOpen: boolean; onMenu: () => void }) {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 bg-board">
      <div className="flex h-14 items-center gap-3 border-b border-line px-4 md:h-16 md:px-6 lg:h-[70px] lg:px-7">
        <IconButton
          aria-label="Mở menu"
          aria-expanded={menuOpen}
          className="lg:hidden"
          onClick={onMenu}
        >
          <Menu size={20} />
        </IconButton>
        <Logo priority />
        <div className="hidden min-w-0 flex-1 md:block md:max-w-[1000px]">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <IconButton
            aria-label={searchOpen ? "Đóng ô tìm" : "Mở ô tìm"}
            className="md:hidden"
            onClick={() => setSearchOpen((open) => !open)}
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </IconButton>
          <div className="hidden sm:block">
            <AccountMenu />
          </div>
        </div>
      </div>
      {searchOpen ? (
        <div className="px-4 pb-3 md:hidden">
          <SearchBox autoFocus />
        </div>
      ) : null}
    </header>
  );
}
