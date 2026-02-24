"use client";

import * as React from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const commandClassName =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3";

const StyledCommandDialog = React.forwardRef<
  React.ElementRef<typeof CommandDialog>,
  React.ComponentPropsWithoutRef<typeof CommandDialog>
>(({ className, children, ...props }, ref) => (
  <CommandDialog
    ref={ref}
    contentClassName={cn(
      "overflow-hidden p-0 rounded-lg border bg-popover",
      commandClassName,
      className
    )}
    {...props}
  >
    {children}
  </CommandDialog>
));

const StyledCommandInput = React.forwardRef<
  React.ElementRef<typeof CommandInput>,
  React.ComponentPropsWithoutRef<typeof CommandInput>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandInput
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
));

const StyledCommandItem = React.forwardRef<
  React.ElementRef<typeof CommandItem>,
  React.ComponentPropsWithoutRef<typeof CommandItem>
>(({ className, ...props }, ref) => (
  <CommandItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
));

export {
  Command,
  StyledCommandDialog as CommandDialog,
  CommandEmpty,
  CommandGroup,
  StyledCommandInput as CommandInput,
  StyledCommandItem as CommandItem,
  CommandList,
};
