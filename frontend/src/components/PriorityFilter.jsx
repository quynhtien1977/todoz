import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { priorityOptions } from "@/lib/data";

const priorityColors = {
  all: "text-foreground",
  high: "text-destructive",
  medium: "text-accent-foreground",
  low: "text-success",
};

const PriorityFilter = ({ priorityQuery, setPriorityQuery }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="lg"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "cursor-pointer",
            priorityColors[priorityQuery]
          )}
        >
          {priorityQuery
            ? priorityOptions.find((option) => option.value === priorityQuery)?.label
            : priorityOptions[0].label}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[150px] p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {priorityOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    setPriorityQuery(currentValue);
                    setOpen(false);
                  }}
                  className={cn(
                    "cursor-pointer",
                    priorityColors[option.value]
                  )}
                >
                  {option.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      priorityQuery === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default PriorityFilter;
