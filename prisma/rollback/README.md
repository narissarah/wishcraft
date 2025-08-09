# Database Migration Rollback Scripts

This directory contains rollback scripts for critical database migrations. These scripts should be used with extreme caution as they can result in data loss.

## ⚠️ WARNING

**ALWAYS BACKUP YOUR DATABASE BEFORE RUNNING ANY ROLLBACK SCRIPT**

## Available Rollback Scripts

### 1. `20250720000002_fix_critical_schema_drift_rollback.sql`
Reverts the registryItemId relationship back to registryId.

**Impact:**
- Reverts foreign key from `registry_items` back to `registries`
- Drops tables: `group_gift_contributions`, `metafield_syncs`, `registry_addresses`, `registry_invitations`
- Removes additional fields from `registry_purchases` and `sessions`

**Data Loss Risk:** HIGH - Purchases linked to specific items will be linked to registries instead

### 2. `20250720000000_encrypt_access_tokens_rollback.sql`
Removes encryption fields from sessions table.

**Impact:**
- Removes encrypted token storage fields
- Drops `security_audit` table
- Reverts data retention period

**Data Loss Risk:** MEDIUM - Encrypted tokens will be lost

## How to Run Rollback Scripts

1. **Backup your database:**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run the rollback script:**
   ```bash
   psql $DATABASE_URL < prisma/rollback/[rollback_script_name].sql
   ```

3. **Update Prisma schema:**
   - Manually revert changes in `schema.prisma` to match the rolled-back state
   - Run `npx prisma generate` to update the client

4. **Test thoroughly:**
   - Verify application still functions
   - Check for any data inconsistencies

## Creating New Rollback Scripts

When creating new migrations, always create a corresponding rollback script:

1. Name it with the same timestamp as the migration plus `_rollback`
2. Include validation checks
3. Document potential data loss
4. Test in a development environment first

## Emergency Rollback Procedure

If a migration causes critical issues in production:

1. **Stop the application** to prevent further data corruption
2. **Backup the current state** even if it's problematic
3. **Run the appropriate rollback script**
4. **Deploy the previous version** of the application
5. **Monitor closely** for any issues
6. **Document the incident** for future reference

## Best Practices

- Always test rollbacks in a staging environment first
- Keep rollback scripts in sync with forward migrations
- Document any manual steps required after rollback
- Consider the impact on existing data before rolling back
- Have a communication plan for users if downtime is required