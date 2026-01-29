# Kolleris Parking App

A production-ready Next.js 16 boilerplate with Tailwind CSS 4.1, Prisma ORM, shadcn/ui, GSAP animations, and complete authentication system.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS 4.1 with Lato font
- **UI Components:** shadcn/ui (54 components included)
- **Database ORM:** Prisma with MySQL
- **Authentication:** Auth.js v5 with role-based access control
- **Animations:** GSAP with ScrollTrigger
- **Language:** TypeScript
- **Icons:** Lucide React

## Features

### Authentication & Authorization
- 🔐 **Auth.js v5** with Next.js 15+ compatibility
- 👥 **Role-based access control** (ADMIN, MANAGER, EMPLOYEE, CLIENT)
- 🛡️ **Protected routes** with middleware
- 📧 **Email/password authentication**
- 🔑 **Password reset functionality**
- 👤 **User profile management**

### User Management
- ➕ **Add/Edit users** with comprehensive profile data
- 📊 **Role-based dashboards**
- 👀 **User status management** (active/inactive)
- 🔍 **Advanced user search and filtering**
- 📱 **Responsive user management interface**
- 🎯 **Column visibility toggle**
- 🔄 **Sortable columns**
- 📋 **Dropdown actions menu**
- 📏 **Compact row design**

### Reusable DataTable Component
- 🎨 **Fully customizable** columns and rendering
- 🔍 **Advanced search** across multiple fields
- 📊 **Column sorting** (ascending/descending)
- 👁️ **Column visibility** toggle
- 📱 **Responsive design**
- 🎯 **Custom actions** via dropdown menu
- 🎨 **Consistent styling** with app theme
- 📏 **Compact rows** for better data density

### Reusable Form Components
- 📝 **FormCard** - Consistent card styling for all forms
- 🔲 **FormDialog** - Standardized modal dialogs with consistent sizing
- 📏 **Compact Form Fields** - Smaller inputs, labels, and buttons for space efficiency
- 🎯 **Consistent Typography** - 8px/9px/10px text sizes throughout
- 🎨 **Uniform Styling** - Same appearance across all application forms

### Form Design System
- 📐 **Consistent Field Dimensions** - All inputs, selects, and textareas use h-7 (28px) height
- 📏 **Uniform Padding** - px-2.5 (10px) horizontal, py-1 (4px) vertical for all fields
- 🔤 **Matching Text Sizes** - Field content (text-[9px]) matches label size
- 🎨 **Centralized Styles** - `formFieldStyles` from `@/lib/form-styles` ensures consistency
- ✅ **Applied Everywhere** - All internal forms follow the same design rules

### Database Schema
- 🗃️ **Extended User model** with profile information
- 🌍 **Country selection** (default: Greece)
- 📞 **Multiple contact numbers** (phone, mobile, work phone)
- 📍 **Address management** (street, city, ZIP, country)
- ⏰ **Timestamps and audit trails**

### UI/UX Features
- 🎨 **shadcn/ui components** (all 54 components)
- 🌓 **Dark/light theme support**
- 📱 **Fully responsive design**
- ✨ **GSAP animations** for smooth interactions
- 🎯 **Modern card-based layouts**
- 🔄 **Loading states and skeleton components**

### Development Tools
- 🏗️ **TypeScript** for type safety
- 🔧 **ESLint** for code quality
- 🎨 **Tailwind CSS 4.1** for styling
- 🗄️ **Prisma Studio** for database management
- 🚀 **Turbopack** for fast development

## Getting Started

### Prerequisites

- **Node.js 22.11.0** (recommended)
- MySQL database
- npm or yarn

### Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Set up your database:**
```bash
npm run db:push
```

3. **Seed initial users:**
```bash
npm run db:seed
```

4. **Start the development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Demo Credentials

The seed script creates users for each role with password `admin123`:

| Role | Email | Password |
|------|-------|----------|
| **ADMIN** | `admin@kolleris.gr` | `admin123` |
| **MANAGER** | `manager@kolleris.gr` | `admin123` |
| **EMPLOYEE** | `employee@kolleris.gr` | `admin123` |
| **CLIENT** | `client@kolleris.gr` | `admin123` |

### Environment Variables

Update the `.env` file with your database credentials:

```bash
# Database Configuration
DATABASE_URL="mysql://username:password@host:port/database"

# Auth.js Configuration
AUTH_SECRET="your-secret-key-here"
AUTH_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Deployment (Coolify / Docker)

When deploying to production:

1. **Set `NODE_ENV=production`** at runtime. Next.js expects this and will warn if you use a non-standard value. In Coolify, add it to your app's environment variables.

2. **Ensure the database is reachable** from the app container. If you see `Can't reach database server at ...`:
   - Verify `DATABASE_URL` in the deployment environment (host, port, user, password).
   - Ensure the DB host allows connections from the app server (firewall, security groups).
   - If the DB starts after the app, cron init will skip and retry on the next server restart.

3. See **DB_CONNECTION_TROUBLESHOOTING.md** for connection issues (SSL, firewall, format).

## Project Structure

```
├── prisma/
│   └── schema.prisma       # Database schema
├── public/                 # Static assets
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── api/           # API routes
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   ├── components/
│   │   ├── sections/      # Page sections
│   │   └── ui/            # shadcn/ui components
│   ├── hooks/             # Custom React hooks
│   │   ├── use-gsap.ts    # GSAP animation hooks
│   │   └── use-mobile.ts  # Mobile detection hook
│   ├── lib/
│   │   ├── gsap.ts        # GSAP configuration
│   │   ├── prisma.ts      # Prisma client
│   │   └── utils.ts       # Utility functions
│   └── types/             # TypeScript types
└── components.json        # shadcn/ui configuration
```

## Available Scripts

```bash
# Development
npm run dev          # Start development server with Turbopack

# Build
npm run build        # Build for production
npm run start        # Start production server

# Database
npx prisma db push   # Push schema to database
npx prisma generate  # Generate Prisma client
npx prisma studio    # Open Prisma Studio

# Linting
npm run lint         # Run ESLint
```

## shadcn/ui Components

All shadcn/ui components are pre-installed and available in `src/components/ui/`:

- Accordion, Alert, Alert Dialog
- Aspect Ratio, Avatar, Badge
- Breadcrumb, Button, Button Group
- Calendar, Card, Carousel
- Chart, Checkbox, Collapsible
- Command, Context Menu, Dialog
- Drawer, Dropdown Menu, Empty
- Field, Form, Hover Card
- Input, Input Group, Input OTP
- Item, Kbd, Label
- Menubar, Navigation Menu, Pagination
- Popover, Progress, Radio Group
- Resizable, Scroll Area, Select
- Separator, Sheet, Sidebar
- Skeleton, Slider, Sonner
- Spinner, Switch, Table
- Tabs, Textarea, Toggle
- Toggle Group, Tooltip

## GSAP Usage

### Basic Animation Hook

```tsx
"use client";

import { useGsap } from "@/hooks/use-gsap";

function MyComponent() {
  const { ref, animate } = useGsap<HTMLDivElement>();

  useEffect(() => {
    animate((element, gsap) => {
      gsap.from(element, { opacity: 0, y: 50, duration: 1 });
    });
  }, [animate]);

  return <div ref={ref}>Animated content</div>;
}
```

### Using GSAP Library Directly

```tsx
"use client";

import { gsap, ScrollTrigger } from "@/lib/gsap";

// Use gsap and ScrollTrigger for advanced animations
```

## Database Setup

### MySQL Configuration

1. Create a MySQL database:

```sql
CREATE DATABASE kolleris_parking_app;
```

2. Update your `.env` file with the connection string:

```
DATABASE_URL="mysql://username:password@localhost:3306/kolleris_parking_app"
```

3. Push the schema to the database:

```bash
npx prisma db push
```

### Prisma Studio

To view and manage your database:

```bash
npx prisma studio
```

## 📊 **DataTable Component Usage**

The new **DataTable** component is fully reusable across your application:

```tsx
import { DataTable, type Column } from "@/components/ui/data-table";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

const columns: Column<User>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    className: "font-medium",
  },
  {
    key: "email",
    label: "EMAIL",
    sortable: true,
  },
  {
    key: "role",
    label: "ROLE",
    sortable: true,
    render: (role) => (
      <Badge variant="secondary" className="text-[8px] font-bold">
        {role}
      </Badge>
    ),
  },
  {
    key: "active",
    label: "STATUS",
    sortable: true,
  },
];

<DataTable
  data={users}
  columns={columns}
  title="USERS"
  subtitle="Manage user accounts"
  searchPlaceholder="Search users..."
  searchFields={["name", "email"]}
  addButtonLabel="ADD USER"
  onAdd={() => setIsAddDialogOpen(true)}
  onEdit={handleEdit}
  onDelete={handleDelete}
  actions={[
    { label: "Edit", onClick: handleEdit },
    { label: "Delete", onClick: handleDelete },
  ]}
  defaultVisibleColumns={["name", "email", "role", "active"]}
/>
```

### **DataTable Features:**
- ✅ **Column Sorting** - Click column headers
- ✅ **Column Visibility** - Use "COLUMNS" dropdown
- ✅ **Search** - Search across multiple fields
- ✅ **Actions Menu** - Dropdown instead of icons
- ✅ **Compact Design** - Smaller rows, better density
- ✅ **Responsive** - Works on all screen sizes

## 🎨 **Form Components Usage**

### **FormCard Component:**
```tsx
import { FormCard } from "@/components/ui/form-card";

<FormCard
  title="SECTION TITLE"
  subtitle="Optional subtitle text"
>
  {/* Your form content */}
</FormCard>
```

### **FormDialog Component:**
```tsx
import { FormDialog } from "@/components/ui/form-dialog";

<FormDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="DIALOG TITLE"
  maxWidth="lg" // sm, md, lg, xl, 2xl
>
  {/* Your form content */}
</FormDialog>
```

### **PageHeader Component:**
```tsx
import { PageHeader } from "@/components/ui/page-header";

<PageHeader
  title="PAGE TITLE"
  highlight="HIGHLIGHT" // Optional: part to highlight with gradient
  subtitle="Optional subtitle text"
/>
```

### **Form Design System (REQUIRED):**
```tsx
import { formFieldStyles } from "@/lib/form-styles";

// ALWAYS use formFieldStyles for consistency across the entire application
<Label className={formFieldStyles.label}>FIELD NAME</Label>
<Input className={formFieldStyles.input} />
<SelectTrigger className={formFieldStyles.select}>
  <SelectValue />
</SelectTrigger>
<Textarea className={formFieldStyles.textarea} />
<Button className={formFieldStyles.button}>ACTION</Button>

// Section headers
<h3 className={formFieldStyles.sectionHeader}>SECTION NAME</h3>

// Form spacing
<form className={formFieldStyles.formSpacing}>
  <div className={formFieldStyles.fieldSpacing}>
    {/* Form fields */}
  </div>
</form>
```

**Design System Rules:**
- ✅ **Height**: All fields use `h-7` (28px) for consistency
- ✅ **Padding**: `px-2.5` (10px) horizontal, `py-1` (4px) vertical
- ✅ **Text Size**: `text-[9px]` for field content (matches labels)
- ✅ **Labels**: `text-[9px] uppercase font-medium`
- ✅ **Buttons**: `h-7 px-3 text-[10px]`
- ✅ **Spacing**: `space-y-3` for forms, `space-y-1` for fields, `gap-2` for grids

**⚠️ IMPORTANT:** Always import and use `formFieldStyles` - never hardcode form field classes!

### **Standardized Header Format:**
```tsx
// All pages should use this consistent header format
<PageHeader
  title="PAGE TITLE"
  highlight="KEY_WORD" // Gets gradient styling
  subtitle="Brief description of page purpose"
/>

// Result:
// PAGE TITLE (with KEY_WORD in violet-cyan gradient)
// Brief description of page purpose (text-xs, muted)
```

## Customization

### Adding New shadcn/ui Components

```bash
npx shadcn@latest add [component-name]
```

### Modifying Theme

Edit the CSS variables in `src/app/globals.css` to customize colors, radius, and other design tokens.

## License

MIT License
