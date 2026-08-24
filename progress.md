# CMSME Loan Application - Current Progress Report

This document outlines the features, enhancements, and bug fixes that have been successfully implemented into the BKB TMS application (specifically for the CMSME loan section) up to this point.

## 1. User Interface & Experience
- **Global Custom Alert System**: Replaced the native browser `alert()` function with a sleek, global HTML overlay modal. This completely resolves the issue where the Electron application would freeze or hang when alerts were triggered.
- **Custom Category Prompt**: Replaced the blocking native `prompt()` dialog with an inline HTML modal overlay for the **+ নতুন শ্রেণী** (New Category) button in the product price list section.

## 2. Data Management & Import
- **Excel (.xlsx/.xls) Support**: Upgraded the product data importer. The system now seamlessly parses Excel files (using `xlsx.full.min.js`) instead of relying solely on CSV formats.
- **Intelligent Header Skipping**: The data importer automatically detects and skips the header row in Excel/CSV files, preventing column titles from being incorrectly inserted into the database as product names.
- **Database Fallback (Demo List)**: Hardened the product list loading logic so that if the database returns an empty object (`{}`), the system correctly falls back and loads the default demo grocery items.

## 3. Data Linkage & Automation
- **Category & Business Nature Synchronization**: Linked the **শ্রেণী নির্বাচন** (Settings Category Selection) directly with the main form's **ব্যবসায়ের প্রকৃতি** (Nature of Business) dropdown. The product autocomplete search is now dynamically filtered based on the selected business nature.
- **Financial Cross-Linking**: The **বিনিয়োগকৃত মূলধন** (Invested Capital) and **আবেদনকৃত ঋণের পরিমাণ (অংকে)** (Applied Loan Amount) fields from the business information section now automatically sync to and populate the respective fields in the Stock Report section.

## 4. Stock Report Auto-Generation (Trading Sector)
- **Randomized Algorithm**: Implemented a sophisticated "Generate Stock Report" algorithm that takes the total available capital and distributes it using randomized weightings across a specified number of products.
- **Financial Logic Constraints**: The system strictly limits product purchasing to a maximum of **80% of the Total Investment** (Equity + Loan), accurately reserving 20% for administrative costs, rent, salaries, utilities, and hidden expenses.
- **Sales Price Calculation**: Sales prices are automatically and accurately derived by applying the user-provided **গড় লভ্যাংশের হার (%) (Average Profit Margin)** to the fetched cost prices.

## 5. Physical Storage & Volume Validation
- **Dynamic Capacity Assessment**: The system dynamically calculates total storage capacity by summing the volumes (Length × Width × Height) directly from all active **Godown** and **Showroom** rows. It functions flawlessly whether the user utilizes both areas, just a Godown, or just a Showroom.
- **Physical Volume Enforcement**: During stock generation, the algorithm converts the required volume of the generated inventory (from cubic inches to cubic feet) and rigorously checks it against the physical Godown/Showroom capacity. If the generated goods exceed the physical space available, generation is aborted with a smart warning.
- **Uniform Table Layouts**: Standardized the Showroom and Godown tables. Both tables now have identical column structures (including the **অবস্থান** / Location field) and spawn with completely blank default fields, ensuring clean and deliberate user data entry.

---

### Next Steps / Future Roadmap
- Implementation and configuration of auto-generation logic specifically tailored for the **Manufacturing** and **Service** sectors.
- Continued refinement of UI elements and potential performance optimizations for larger product datasets.
