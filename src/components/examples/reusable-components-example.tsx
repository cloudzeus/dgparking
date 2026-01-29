// Example of how to use the reusable components throughout the application
// This demonstrates PageHeader, FormDialog, FormCard, and DataTable usage

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { FormDialog } from "@/components/ui/form-dialog";
import { FormCard } from "@/components/ui/form-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Plus, Save } from "lucide-react";

// Example data type
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

// Example form component using consistent styling
function ProductForm({ product, onSuccess }: { product?: Product; onSuccess: () => void }) {
  return (
    <form className="space-y-3">
      <div className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase text-muted-foreground">
          PRODUCT INFORMATION
        </h3>
        <div className="space-y-1">
          <Label htmlFor="name" className="text-[9px] uppercase font-medium">
            PRODUCT NAME *
          </Label>
          <Input
            id="name"
            name="name"
            defaultValue={product?.name || ""}
            required
            className="h-7 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="price" className="text-[9px] uppercase font-medium">
              PRICE *
            </Label>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              defaultValue={product?.price || ""}
              required
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category" className="text-[9px] uppercase font-medium">
              CATEGORY *
            </Label>
            <Input
              id="category"
              name="category"
              defaultValue={product?.category || ""}
              required
              className="h-7 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded bg-muted/30 p-2">
          <div className="space-y-0">
            <Label htmlFor="inStock" className="text-[9px] uppercase font-medium">
              IN STOCK
            </Label>
          </div>
          <input type="checkbox" id="inStock" name="inStock" defaultChecked={product?.inStock} />
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-muted-foreground/20">
        <Button type="submit" className="h-7 px-3 text-[10px] gap-1">
          <Save className="h-3 w-3" />
          {product ? "UPDATE" : "CREATE"}
        </Button>
      </div>
    </form>
  );
}

// Example component using all reusable components
export function ReusableComponentsExample() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const columns: Column<Product>[] = [
    {
      key: "name",
      label: "NAME",
      sortable: true,
      className: "font-medium",
    },
    {
      key: "price",
      label: "PRICE",
      sortable: true,
      render: (price: number) => (
        <span className="font-bold text-green-600">
          €{price.toFixed(2)}
        </span>
      ),
    },
    {
      key: "category",
      label: "CATEGORY",
      sortable: true,
      render: (category: string) => (
        <span className="text-[8px] bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold">
          {category}
        </span>
      ),
    },
    {
      key: "inStock",
      label: "STATUS",
      sortable: true,
      render: (inStock: boolean) => (
        <span className={`text-[8px] font-bold ${inStock ? 'text-green-600' : 'text-red-600'}`}>
          {inStock ? "IN STOCK" : "OUT OF STOCK"}
        </span>
      ),
    },
  ];

  const sampleData: Product[] = [
    { id: "1", name: "Laptop", price: 999.99, category: "Electronics", inStock: true },
    { id: "2", name: "Coffee Maker", price: 79.99, category: "Appliances", inStock: false },
    { id: "3", name: "Headphones", price: 149.99, category: "Electronics", inStock: true },
  ];

  return (
    <div className="space-y-6">
      {/* Example using PageHeader */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="PRODUCTS MANAGEMENT"
          highlight="MANAGEMENT"
          subtitle="Manage your product inventory and catalog"
        />
        <Button
          onClick={() => setIsDialogOpen(true)}
          size="sm"
          className="h-7 px-3 text-[10px] gap-1"
        >
          <Plus className="h-3 w-3" />
          ADD PRODUCT
        </Button>
      </div>

      {/* Example using FormCard */}
      <FormCard
        title="PRODUCTS OVERVIEW"
        subtitle="Your current product catalog and inventory status"
      >
        {/* Example using DataTable */}
        <DataTable
          data={sampleData}
          columns={columns}
          title="ALL PRODUCTS"
          subtitle="Complete product listing with real-time status"
          searchPlaceholder="Search products..."
          searchFields={["name", "category"]}
          defaultVisibleColumns={["name", "price", "category", "inStock"]}
        />
      </FormCard>

      {/* Example using FormDialog */}
      <FormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="ADD NEW PRODUCT"
        maxWidth="md"
      >
        <ProductForm onSuccess={() => setIsDialogOpen(false)} />
      </FormDialog>
    </div>
  );
}
