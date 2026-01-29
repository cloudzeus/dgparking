"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

function Collapsible({
  suppressHydrationWarning,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root> & { suppressHydrationWarning?: boolean }) {
  return (
    <CollapsiblePrimitive.Root 
      data-slot="collapsible" 
      suppressHydrationWarning={suppressHydrationWarning}
      {...props} 
    />
  )
}

function CollapsibleTrigger({
  suppressHydrationWarning,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger> & { suppressHydrationWarning?: boolean }) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      suppressHydrationWarning={suppressHydrationWarning}
      {...props}
    />
  )
}

function CollapsibleContent({
  suppressHydrationWarning,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent> & { suppressHydrationWarning?: boolean }) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      suppressHydrationWarning={suppressHydrationWarning}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
