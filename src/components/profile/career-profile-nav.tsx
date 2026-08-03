"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  careerProfileNavigation,
  getActiveCareerProfileItem,
} from "@/components/profile/career-profile-navigation";
import { cn } from "@/lib/utils";

export function CareerProfileNav() {
  const pathname = usePathname();
  const active = getActiveCareerProfileItem(pathname);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>("[aria-current='page']");
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    const outsideStart = current.offsetLeft < list.scrollLeft;
    const outsideEnd =
      current.offsetLeft + current.offsetWidth > list.scrollLeft + list.clientWidth;
    if (outsideStart || outsideEnd) {
      current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [pathname]);

  return (
    <nav aria-label="Career Profile" className="mb-8 border-b border-[var(--border-subtle)]">
      <ul ref={listRef} className="-mb-px flex gap-1 overflow-x-auto pb-px">
        {careerProfileNavigation.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active?.href === item.href ? "page" : undefined}
              title={item.description}
              className={cn(
                "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors",
                active?.href === item.href
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-[var(--border-default)] hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
