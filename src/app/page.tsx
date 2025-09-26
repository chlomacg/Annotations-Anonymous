"use client";

import { Menu, MenuItem, Popover, MenuTrigger, Button } from "react-aria-components";
import { useState } from "react";


type Book = "AA" | "NA";

export default function Home() {
  const [selectedBook, selectBook] = useState<Book>("AA");

  return (
    <div className="flex flex-row bg-amber-50 text-black dark:bg-slate-900 dark:text-white">
      <MenuTrigger>
        <Button className="">Big Book</Button>
        <Popover className="">
          <Menu>
            <MenuItem onAction={() => selectBook("AA")}>
                Alcoholics Anonymous (4th edition)
            </MenuItem>
            <MenuItem onAction={() => selectBook("NA")}>
                Narcotics Anonymous (6th edition)
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
}