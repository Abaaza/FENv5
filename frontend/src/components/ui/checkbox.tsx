import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="flex items-center">
        <input
          type="checkbox"
          id={id}
          ref={ref}
          className={cn(
            "h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        {label && (
          <label
            htmlFor={id}
            className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };