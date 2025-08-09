# Registry Purchase Relationship Migration Guide

## Overview

In migration `20250720000002_fix_critical_schema_drift`, the relationship between `registry_purchases` and registries was fundamentally changed. Previously, purchases were linked directly to registries, but they are now correctly linked to specific registry items.

## The Problem

The original schema design had a critical flaw:
- Purchases were linked to `registries` (the entire wishlist)
- This made it impossible to track which specific item was purchased
- Multiple items in a registry couldn't be properly tracked

## The Solution

The migration changes the relationship:
- **Old**: `registry_purchases.registryId` → `registries.id`
- **New**: `registry_purchases.registryItemId` → `registry_items.id`

## Migration Status

### Current State
- The `registryItemId` column is now the primary foreign key
- The old `registryId` column is marked as DEPRECATED but still exists
- All new purchases must use `registryItemId`

### Deprecation Timeline
- **Phase 1 (Current)**: Both columns exist, `registryId` is deprecated
- **Phase 2 (Future)**: Remove `registryId` column completely
- **Phase 3 (Future)**: Clean up any remaining references

## Code Migration

### Finding Affected Code

Search for uses of the deprecated field:
```bash
# Find direct references to registryId in purchases
grep -r "registry_purchases.*registryId" app/
grep -r "purchase.*registryId" app/

# Find Prisma queries that might use it
grep -r "registry_purchases.*include.*registries" app/
```

### Updating Queries

#### Old Pattern (DEPRECATED)
```typescript
// DON'T DO THIS
const purchase = await db.registry_purchases.create({
  data: {
    registryId: registry.id, // WRONG!
    // ... other fields
  }
});

// DON'T DO THIS
const purchases = await db.registry_purchases.findMany({
  where: { registryId: registryId }, // WRONG!
});
```

#### New Pattern (CORRECT)
```typescript
// DO THIS
const purchase = await db.registry_purchases.create({
  data: {
    registryItemId: item.id, // CORRECT!
    // ... other fields
  }
});

// DO THIS
const purchases = await db.registry_purchases.findMany({
  where: { registryItemId: itemId }, // CORRECT!
});

// To get purchases for a whole registry
const purchases = await db.registry_purchases.findMany({
  where: {
    registry_items: {
      registryId: registryId
    }
  },
  include: {
    registry_items: true
  }
});
```

### Joining Tables

#### Old Pattern (DEPRECATED)
```typescript
// DON'T DO THIS
const purchase = await db.registry_purchases.findUnique({
  where: { id },
  include: {
    registries: true // WRONG! Direct relationship doesn't exist
  }
});
```

#### New Pattern (CORRECT)
```typescript
// DO THIS
const purchase = await db.registry_purchases.findUnique({
  where: { id },
  include: {
    registry_items: {
      include: {
        registries: true // Access registry through items
      }
    }
  }
});

// Access registry data
const registry = purchase.registry_items.registries;
```

## Data Migration

### For Existing Data

The migration attempted to map old purchases to items:
```sql
-- This was done in the migration
UPDATE "registry_purchases" 
SET "registryItemId" = (
    SELECT "id" 
    FROM "registry_items" 
    WHERE "registryId" = "registry_purchases"."registryId" 
    LIMIT 1
)
```

**Note**: This was a best-effort mapping. Purchases were linked to the first item in each registry, which may not be accurate.

### Verifying Data Integrity

```typescript
// Find purchases that might have incorrect item mappings
const suspiciousPurchases = await db.registry_purchases.findMany({
  where: {
    registryId: { not: null }, // Still has old registryId
    registryItemId: { not: null } // Has new registryItemId
  },
  include: {
    registry_items: {
      include: {
        registries: true
      }
    }
  }
});

// Check if the registryId matches the item's registry
for (const purchase of suspiciousPurchases) {
  if (purchase.registryId !== purchase.registry_items.registryId) {
    console.log(`Mismatch found in purchase ${purchase.id}`);
  }
}
```

## Best Practices

1. **Always use `registryItemId`** for new code
2. **Include `registry_items`** when you need registry data
3. **Don't rely on `registryId`** - it will be removed
4. **Test thoroughly** when updating old code
5. **Log warnings** if you encounter `registryId` usage

## Rollback Procedure

If you need to rollback this migration:

1. **Backup your database first**
2. Run the rollback script: `prisma/rollback/20250720000002_fix_critical_schema_drift_rollback.sql`
3. Update your code to use `registryId` again
4. Redeploy the previous version

**Warning**: Rollback will lose the item-level tracking for purchases.

## Future Cleanup

Once all code is updated:

1. Remove the deprecated `registryId` column:
   ```sql
   ALTER TABLE "registry_purchases" DROP COLUMN "registryId";
   ```

2. Remove any code that references it

3. Update this documentation

## Questions?

If you encounter issues with this migration:
1. Check the migration file for details
2. Review the rollback script for understanding
3. Test in development first
4. Document any manual fixes needed