# SMART-PARK — Κανόνες διεπαφής (DG design system)

Πηγή αλήθειας για κάθε σελίδα διαχείρισης (route group `(app)`). Εφαρμογή
διαχείρισης: **πυκνή, καθαρή, ελληνική, ίδια παντού.**

Οι κανόνες είναι κοινοί με το HDCtool (`cloudzeus/hdckolleris`) — τα ίδια tokens,
τα ίδια components, η ίδια δομή σελίδας, ώστε οι δύο εφαρμογές να διαβάζονται ως
ένα προϊόν. Ό,τι λέει παρακάτω για το `/admin` ισχύει εδώ για το `(app)`.

Ειδικά για αυτή την εφαρμογή:
- Το κέλυφος (`src/app/(app)/layout.tsx`) δίνει ήδη `p-4` — η σελίδα δεν βάζει δικό της padding.
- `DataTable` = `@/components/ui/data-table` (TanStack). Το `data-table-legacy`
  είναι ο παλιός πίνακας· όποια σελίδα το χρησιμοποιεί ακόμη μεταφέρεται στο νέο.
- Πινακίδες οχημάτων: `font-mono`, κεφαλαία, `tabular-nums`.

## 1. Γλώσσα
- **Όλα τα κείμενα που βλέπει ο χρήστης στα ελληνικά:** τίτλοι, περιγραφές, κουμπιά, ετικέτες, κεφαλίδες πινάκων, placeholders, tooltips (`title`), `aria-label`, toasts, μηνύματα σφάλματος και κενές καταστάσεις, διάλογοι επιβεβαίωσης.
- **ΜΕΝΟΥΝ ως έχουν:** κωδικοί και ονόματα πεδίων ERP (MTRL, CODE2, PRICER02, BOOL01, SQL 144, SALDOC) — αλλά με tooltip `<ErpField>` (§9α), ονόματα μαρκών/προϊόντων, τιμές από τη βάση, κλειδιά API/JSON, `console.log`, URLs, ονόματα jobs.
- Σύντομη, φυσική διατύπωση. Ρήματα στα κουμπιά («Αποθήκευση», «Εφαρμογή», «Ανανέωση», «Διαγραφή», «Ακύρωση», «Εξαγωγή Excel»).
- Ημερομηνίες/αριθμοί: `toLocaleString("el-GR")`, ζώνη `Europe/Athens`.
- Κεφαλαία μόνο στο πρώτο γράμμα. Όχι `uppercase` σε ελληνικά (χάνονται οι τόνοι).

## 2. Σελίδα
- Κάθε σελίδα ξεκινά με `<PageHeader title description? icon? actions?>` από `@/components/admin/page`.
- Όχι δικό της `<h1>`, όχι hero, όχι `bg-gradient-*`, όχι `text-3xl`+ για τίτλους, όχι εξωτερικό `container mx-auto py-6/8` ή `p-6/8` (το κέλυφος δίνει ήδη padding).
- Ρυθμός κενών: `space-y-4` ανάμεσα σε ενότητες, `gap-2`/`gap-3` μέσα σε ενότητες.
- Ένα κύριο κουμπί (`variant="default"`) ανά οθόνη, τα άλλα `outline`/`ghost`.

## 3. Components (μόνο αυτά)
| Χρειάζομαι | Χρησιμοποιώ | ΟΧΙ |
|---|---|---|
| Κουμπί | `<Button variant="default|outline|secondary|ghost|destructive|success|link" size="default|sm|lg|icon|icon-sm">` | `<button className="bg-blue-600 …">`, δικά χρώματα/ύψη σε Button |
| Κατάσταση/ετικέτα | `<StatusBadge status="FAILED" />` ή `<Badge variant="success|warning|danger|info|neutral|accent|outline">` | `<span className="rounded-full bg-green-100 text-green-800 …">` |
| Ενότητα | `<Card><CardHeader><CardTitle/><CardDescription/></CardHeader><CardContent/></Card>` | `rounded-xl shadow-lg p-6/p-8`, κάρτες μέσα σε κάρτες χωρίς λόγο |
| Αριθμός/KPI | `<StatGrid><StatCard label value hint? tone? icon?/></StatGrid>` | μεγάλα χρωματιστά blocks, gradients |
| Πίνακας | `Table…TableCell` από `@/components/ui/table` | `<table>` με δικό του styling (επιτρέπεται μόνο αν ήδη υπάρχει σύνθετη λογική — τότε `text-xs`, `px-3 py-1.5`, κεφαλίδα `text-xs font-semibold text-muted-foreground bg-muted/50`) |
| Κενό αποτέλεσμα | `<EmptyState title description? action?/>` | σκέτο «No data» |
| Φόρτωση | `Skeleton` ή `Loader2 animate-spin` μέσα στο κουμπί | ολόσελιδα spinners |

## 4. Χρώματα
- Σημασιολογικά tokens: `bg-card`, `bg-muted`, `text-muted-foreground`, `border`, `text-primary`, `bg-primary`, `text-destructive`.
- Κατάσταση **μόνο** μέσω Badge variants / `StatCard tone`: επιτυχία=green, προσοχή=amber, σφάλμα=red, πληροφορία=blue, ουδέτερο=gray.
- Όχι διακοσμητικά χρώματα (violet/purple/pink/orange/cyan) χωρίς νόημα. Όχι `bg-gradient-*`.
- Χρώμα ποτέ μόνο του: πάντα με κείμενο ή εικονίδιο.

## 5. Τυπογραφία (ρευστή)
- Τίτλος σελίδας: μόνο μέσω `PageHeader` (text-xl). Τίτλος κάρτας: `CardTitle` (text-base).
- Σώμα: `text-sm`. Πίνακες: πάντα `text-xs` (§9α). Βοηθητικά: `text-xs text-muted-foreground`.
- Όχι `text-[13px]`, `text-[11px]` κ.λπ. → `text-xs`/`text-sm`. Όχι `text-2xl`+ εκτός από αριθμούς KPI.
- Αριθμοί/τιμές/κωδικοί σε στήλες: `tabular-nums`, κωδικοί `font-mono`.

## 6. Overflow & responsive
- Κάθε πίνακας μέσα σε container με `overflow-x-auto` (το `Table` το έχει ήδη).
- Σε flex/grid παιδιά που περιέχουν κείμενο: `min-w-0`. Μακριά ονόματα: `truncate` + `title={…}` ή `break-words`.
- Γραμμές ενεργειών/φίλτρων: `flex flex-wrap gap-2`.
- Όχι σταθερά πλάτη σε px για containers (`w-[900px]`) — `max-w-*`/`w-full`. Διάλογοι: `sm:max-w-*` και `max-h-[90vh] overflow-y-auto`.
- Πλέγματα: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3…`, ποτέ σταθερό πλήθος στηλών σε κινητό.

## 7. Γραφήματα
- **Μόνο** από `@/components/admin/charts`: `AreaTrendChart` (τάσεις στον χρόνο), `BarTrendChart` (σύγκριση, `horizontal` για μακριές ετικέτες), `LineTrendChart` (μετρήσεις όπως διάρκεια), `DonutChart` (μερίδια ≤5), μέσα σε `ChartCard`.
- Όλα πάνω στο shadcn `ChartContainer` (ύφος ui.shadcn.com/charts). Χρώματα μόνο `--chart-1…5`. Όχι Recharts απευθείας σε σελίδα, όχι μπάρες φτιαγμένες με `style={{ width: … }}` για γραφήματα (οι μπάρες προόδου είναι `Progress`).
- Ετικέτες σειρών στα ελληνικά· αριθμοί/ημερομηνίες `el-GR`.

## 8. Εικονίδια
- Μόνο `lucide-react`, `size-4` (μέσα σε κουμπιά/λίστες), `size-5` σε τίτλους. Όχι emoji ως εικονίδια.
- Κουμπί μόνο με εικονίδιο: `size="icon"|"icon-sm"` + `aria-label` + `title` στα ελληνικά.

## 9. Κανόνες shadcn (από το επίσημο skill `.claude/skills/shadcn`)
- Υπάρχον component πρώτα (`npx shadcn@latest docs <component>`), σύνθεση αντί για δικό markup.
- `className` μόνο για διάταξη· όχι αλλαγή χρωμάτων/τυπογραφίας components — variants και tokens.
- Νέος κώδικας: `flex flex-col gap-*` αντί για `space-y-*`, `size-*` όταν πλάτος=ύψος, `truncate`, `cn()` για συνθήκες (όχι template literals).
- Όχι χειροκίνητα `dark:` χρώματα, όχι `z-*` σε Dialog/Popover/Sheet/Tooltip.
- Επισημάνσεις → `Alert`· κενό → `EmptyState` (πάνω στο `Empty`)· φόρτωση → `Skeleton`· κουμπί σε αναμονή → `<Button disabled><Spinner data-icon="inline-start" />…</Button>`.
- 2–7 επιλογές εναλλαγής → `ToggleGroup` (όχι Buttons με χειροκίνητη ενεργή κατάσταση).
- `SelectItem` μέσα σε `SelectGroup`, `DropdownMenuItem` μέσα σε `DropdownMenuGroup`, `TabsTrigger` μέσα σε `TabsList`.
- Dialog/Sheet/Drawer πάντα με `DialogTitle` (ή `sr-only`)· επιβεβαίωση καταστροφικής ενέργειας → `AlertDialog`.
- `Avatar` πάντα με `AvatarFallback`· `Separator` αντί για `<hr>`/`border-t` div.
- **Ποτέ `npx shadcn add … --overwrite`** στα `button/input/badge/card/table/…`: περιέχουν τις προσαρμογές DG. Νέα components με `--dry-run` πρώτα.

## 9α. Πίνακες και πεδία SoftOne

- **Ένα μέγεθος γραμμάτων σε όλους τους πίνακες: το μικρό (`text-xs`).** Το ορίζει το `ui/table.tsx`· μη βάζεις `text-sm` σε `TableCell`/`TableHead` ή σε `<table>`.
- **Κάθε όνομα πεδίου του SoftOne που φαίνεται στον χρήστη (CODE1, TRDR, PRICER02, BOOL01…) έχει tooltip** με την ετικέτα της φόρμας του ERP και τι σημαίνει:
  - `<ErpField name="CODE1" />` σε επικεφαλίδες, labels, badges· `<ErpText>{"Ίδιο CODE1, διαφορετικό CODE2"}</ErpText>` μέσα σε κείμενο.
  - Σε `title`/`placeholder`/`<option>`: `erpFieldTitle("CODE1")`.
  - Λεξικό: `src/lib/erp-fields.ts` (ετικέτες από `getTableFields` του SoftOne). Νέο πεδίο στην οθόνη → πρόσθεσέ το εκεί.
- Σελίδες παρακολούθησης (π.χ. υγεία cron): **μία** λίστα, όχι δύο με τα ίδια στοιχεία· κάθε γραμμή λέει σε μία πρόταση τι συμβαίνει και τι να κάνει ο χρήστης· στην κορυφή μία ετυμηγορία (όλα καλά / τι χρειάζεται προσοχή).

## 9β. Σελίδες-λίστες (πρότυπο: «Είδη MTRL», `/admin/mtrl-products-new`)

Κάθε σελίδα με λίστα εγγραφών (είδη, παραγγελίες eshop/Skroutz/Magento, πελάτες, προμηθευτές, κανόνες…) έχει **την ίδια δομή, με αυτή τη σειρά**:

1. `PageHeader` — τίτλος, μία πρόταση περιγραφή, ένα κύριο κουμπί δεξιά.
2. **Κάρτες αριθμών** `KpiTile` σε `grid grid-cols-2 gap-2 xl:grid-cols-4` — 4 κάρτες, χρωματιστό εικονίδιο (`tone`: blue/green/amber/violet/red), `hint` μία φράση· όπου έχει νόημα `href` που ανοίγει το αντίστοιχο φίλτρο.
3. **Φίλτρα** σε μία `Card` (αναζήτηση πλήρους πλάτους, από κάτω επιλογές σε `grid-cols-2 lg:grid-cols-4`).
4. **Πίνακας** `DataTable` με `fixedLayout`:
   - Στήλες με `size` και `meta: { label }` (ελληνικό όνομα για το «Στήλες»)· **μία** στήλη `meta.flex` (όνομα/περιγραφή/πελάτης) παίρνει τον χώρο που μένει.
   - Χωρά σε 1440px χωρίς οριζόντια κύλιση: δευτερεύουσες στήλες κρυμμένες εξ ορισμού (`columnVisibility`), δευτερεύον στοιχείο **κάτω** από το κύριο στο ίδιο κελί (κωδικός + SKU, πελάτης + email, κατηγορία + ομάδα › υποομάδα).
   - Ποσά: σκέτος αριθμός `Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" })`, `text-right tabular-nums`, `meta.align: "right"`· το κύριο ποσό `font-semibold text-primary`. **Όχι badges σε ποσά.**
   - Κατάσταση: `Badge`/`StatusBadge` (ένα ανά γραμμή)· χρωματιστή κουκκίδα `size-2 rounded-full bg-chart-N` για κανάλι/διαθεσιμότητα.
   - Κωδικοί `font-mono text-xs`, κανονικό βάρος (όχι bold).
5. **Ανοιχτό περιεχόμενο γραμμής** (`expandableContent`):
   - Κεφαλίδα: τίτλος `text-sm font-semibold` + badges κατάστασης· από κάτω μία γραμμή `text-xs text-muted-foreground` με αναγνωριστικά/ημερομηνίες.
   - **Ενέργειες με κείμενο** (όχι σκέτα εικονίδια): `Button size="sm"` — πρώτη η κύρια (`default`), οι άλλες `outline`, η καταστροφική `ghost text-destructive ml-auto` δεξιά (με μενού αν έχει επιλογές).
   - Στοιχεία σε `InfoPanel` + `InfoRow` μέσα σε `grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4` (π.χ. Τιμές · Απόθεμα · Κωδικοί · Κατηγοριοποίηση / Πελάτης · Αποστολή · Πληρωμή · SoftOne).
   - Λίστες (γραμμές παραγγελίας, ιστορικό) από κάτω, σε `rounded-md border bg-card p-3` με `Table`.
6. Αν η σελίδα δεν χρησιμοποιεί `DataTable`, ακολουθεί **οπτικά** τα ίδια (Table με `text-xs`, ίδιες στήλες/στοιχίσεις, ίδιο ανοιχτό περιεχόμενο).

## 10. Ασφάλεια αλλαγών
- **Μόνο παρουσίαση και κείμενα.** Καμία αλλαγή σε λογική, state, fetch, props APIs, ονόματα πεδίων, ροές δεδομένων.
- Αν ένα component μοιράζεται με σελίδες άλλης ομάδας, μην το ξαναγράφεις — αλλάζεις μόνο κείμενα/κλάσεις χωρίς να αλλάξεις το API του.
