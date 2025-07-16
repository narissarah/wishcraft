#!/usr/bin/env node
/**
 * Migration script to populate customerEmailHash for existing registries
 * This is required after adding the searchable hash field
 */

import { PrismaClient } from '@prisma/client';
import { decryptPII, createSearchableEmailHash } from '../app/lib/encryption.server';

const prisma = new PrismaClient();

async function migrateEmailHashes() {
  console.log('Starting email hash migration...');
  
  try {
    // Get all registries without email hash
    const registries = await prisma.registry.findMany({
      where: {
        customerEmailHash: null
      },
      select: {
        id: true,
        customerEmail: true
      }
    });
    
    console.log(`Found ${registries.length} registries to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < registries.length; i += batchSize) {
      const batch = registries.slice(i, i + batchSize);
      
      const updates = batch.map(async (registry) => {
        try {
          // Decrypt email
          const decryptedEmail = decryptPII(registry.customerEmail);
          
          if (decryptedEmail && decryptedEmail !== '[ENCRYPTED]') {
            // Create searchable hash
            const emailHash = createSearchableEmailHash(decryptedEmail);
            
            // Update registry
            await prisma.registry.update({
              where: { id: registry.id },
              data: { customerEmailHash: emailHash }
            });
            
            successCount++;
          } else {
            console.warn(`Failed to decrypt email for registry ${registry.id}`);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error migrating registry ${registry.id}:`, error);
          errorCount++;
        }
      });
      
      await Promise.all(updates);
      
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(registries.length / batchSize)}`);
    }
    
    console.log(`\nMigration completed:`);
    console.log(`- Success: ${successCount}`);
    console.log(`- Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateEmailHashes();