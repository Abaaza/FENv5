import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Building, Check } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
}

interface ClientSearchProps {
  value: string;
  clients: Client[];
  onSelect: (client: Client | null) => void;
  onInputChange: (value: string) => void;
  onCreateNew?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ClientSearch({
  value,
  clients,
  onSelect,
  onInputChange,
  onCreateNew,
  placeholder = "Search or create client...",
  className,
  disabled = false,
}: ClientSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter clients based on search value
  const filteredClients = value
    ? clients.filter(client => 
        client.name.toLowerCase().includes(value.toLowerCase()) ||
        client.email?.toLowerCase().includes(value.toLowerCase()) ||
        client.contactPerson?.toLowerCase().includes(value.toLowerCase())
      )
    : clients;

  // Check if exact match exists
  const exactMatch = clients.find(c => c.name.toLowerCase() === value.toLowerCase());

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredClients.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredClients[highlightedIndex]) {
          handleSelect(filteredClients[highlightedIndex]);
        } else if (!exactMatch && value && onCreateNew) {
          onCreateNew();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (client: Client) => {
    onSelect(client);
    onInputChange(client.name);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onInputChange(newValue);
    setIsOpen(true);
    setHighlightedIndex(0);
    
    // If input is cleared, clear selection
    if (!newValue) {
      onSelect(null);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-10"
          disabled={disabled}
        />
        {exactMatch && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {filteredClients.length > 0 ? (
            <div className="py-1">
              {filteredClients.map((client, index) => (
                <button
                  key={client._id}
                  onClick={() => handleSelect(client)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-accent transition-colors",
                    highlightedIndex === index && "bg-accent",
                    exactMatch?._id === client._id && "font-medium"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">{client.name}</div>
                      {(client.contactPerson || client.email) && (
                        <div className="text-sm text-muted-foreground">
                          {client.contactPerson && <span>{client.contactPerson}</span>}
                          {client.contactPerson && client.email && <span> • </span>}
                          {client.email && <span>{client.email}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : value ? (
            <div className="p-3 text-center text-muted-foreground">
              No clients found
            </div>
          ) : (
            <div className="p-3 text-center text-muted-foreground">
              Start typing to search clients
            </div>
          )}

          {value && !exactMatch && onCreateNew && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setIsOpen(false);
                  onCreateNew();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create "{value}" as new client
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}