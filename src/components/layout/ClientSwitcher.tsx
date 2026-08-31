import { useMemo, useState } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { displayClientName, useClient } from "@/contexts/ClientContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function ClientSwitcher({ compact = false }: { compact?: boolean }) {
  const { clients, selectedClientId, selectedClient, setSelectedClientId, loading } = useClient();
  const [open, setOpen] = useState(false);

  const selectedLabel = selectedClient ? displayClientName(selectedClient) : "Cliente";

  const items = useMemo(
    () =>
      clients.map((c) => ({
        id: c.id,
        label: displayClientName(c),
        search: normalize(`${c.companyName} ${c.tradeName}`),
      })),
    [clients],
  );

  if (loading) {
    return <Skeleton className={compact ? "h-8 w-8 rounded-md" : "h-8 w-44 rounded-md"} />;
  }

  if (clients.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
        <Building2 className="w-4 h-4" />
        {!compact && <span>Sem clientes</span>}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 justify-between font-normal px-2",
            compact ? "w-9" : "w-48 text-xs",
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {!compact && <span className="truncate">{selectedLabel}</span>}
          </span>
          {!compact && <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command
          filter={(value, search) => (normalize(value).includes(normalize(search)) ? 1 : 0)}
        >
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {items.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.search} ${c.id}`}
                  onSelect={() => {
                    setSelectedClientId(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5 shrink-0",
                      selectedClientId === c.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{c.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
