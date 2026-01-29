// Example usage of the DataTable component
// This demonstrates how to use the reusable DataTable in other parts of the application

import { DataTable, type Column } from "@/components/ui/data-table";

// Example data type
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  createdAt: Date;
}

// Example columns configuration
const productColumns: Column<Product>[] = [
  {
    key: "name",
    label: "PRODUCT NAME",
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
      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
        {category}
      </span>
    ),
  },
  {
    key: "inStock",
    label: "STOCK",
    sortable: true,
  },
  {
    key: "createdAt",
    label: "ADDED",
    sortable: true,
  },
];

// Example data
const sampleProducts: Product[] = [
  {
    id: "1",
    name: "Wireless Headphones",
    price: 99.99,
    category: "Electronics",
    inStock: true,
    createdAt: new Date("2024-01-15"),
  },
  {
    id: "2",
    name: "Coffee Maker",
    price: 149.99,
    category: "Appliances",
    inStock: false,
    createdAt: new Date("2024-01-20"),
  },
];

// Example component using DataTable
export function ProductsDataTable() {
  const handleAddProduct = () => {
    console.log("Add new product");
  };

  const handleEditProduct = (product: Product) => {
    console.log("Edit product:", product);
  };

  const handleDeleteProduct = (product: Product) => {
    console.log("Delete product:", product);
  };

  const handleToggleStock = (product: Product) => {
    console.log("Toggle stock for:", product);
  };

  return (
    <DataTable
      data={sampleProducts}
      columns={productColumns}
      title="PRODUCTS"
      subtitle="Manage your product inventory"
      searchPlaceholder="Search products..."
      searchFields={["name", "category"]}
      addButtonLabel="ADD PRODUCT"
      onAdd={handleAddProduct}
      onEdit={handleEditProduct}
      onDelete={handleDeleteProduct}
      onToggleStatus={handleToggleStock}
      actions={[
        {
          label: "View Details",
          onClick: (product) => console.log("View details:", product),
        },
        {
          label: "Duplicate",
          onClick: (product) => console.log("Duplicate:", product),
        },
      ]}
      defaultVisibleColumns={["name", "price", "category", "inStock", "createdAt"]}
    />
  );
}










