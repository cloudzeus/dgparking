/**
 * Consistent form field styles for the entire application
 * 
 * DESIGN SYSTEM RULES:
 * - All internal form fields (Input, Select, Textarea) must use these styles
 * - Height: h-7 (28px) for consistent field height
 * - Padding: px-2.5 (10px horizontal), py-1 (4px vertical)
 * - Text size: text-[9px] to match label size
 * - Labels: text-[9px] uppercase font-medium
 * - Section headers: text-[10px] font-bold uppercase
 * - Buttons: h-7 px-3 text-[10px]
 * 
 * USAGE:
 * ```tsx
 * import { formFieldStyles } from "@/lib/form-styles";
 * 
 * <Input className={formFieldStyles.input} />
 * <SelectTrigger className={formFieldStyles.select} />
 * <Label className={formFieldStyles.label}>FIELD NAME</Label>
 * <Button className={formFieldStyles.button}>ACTION</Button>
 * ```
 */

export const formFieldStyles = {
  // Standard compact form field styling
  // All fields: h-7 (28px), px-2.5 (10px), py-1 (4px), text-[9px]
  // Using !important to override default component styles
  input: "h-7 !px-2.5 !py-1 !text-[9px] rounded-md",
  select: "h-7 !px-2.5 !py-1 !text-[9px] rounded-md w-full",
  selectItem: "!text-[9px]",
  textarea: "min-h-[4rem] !px-2.5 !py-1.5 !text-[9px] rounded-md",
  
  // Label styling - matches input text size
  label: "text-[9px] uppercase font-medium",
  
  // Section header styling
  sectionHeader: "text-[10px] font-bold uppercase text-muted-foreground",
  
  // Button styling
  button: "h-7 px-3 text-[10px] gap-1",
  buttonIcon: "h-3 w-3",
  
  // Form spacing - compact spacing for maximum content density
  formSpacing: "space-y-3",
  fieldSpacing: "space-y-1",
  gridGap: "gap-2",
} as const;

