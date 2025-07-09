#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Icon mappings from old to new (Polaris v13)
const iconMappings = {
  'AnalyticsMajor': 'ChartVerticalIcon',
  'CustomersMajor': 'PersonIcon',
  'TrendingUpMajor': 'ArrowUpIcon',
  'TrendingDownMajor': 'ArrowDownIcon',
  'CircleTickMajor': 'CheckCircleIcon',
  'CashDollarMajor': 'CashDollarIcon',
  'DuplicateMinor': 'DuplicateIcon',
  'CustomerIcon': 'PersonIcon',
  'ShipmentMajor': 'PackageIcon',
  'LockMajor': 'LockIcon',
  'BillingStatementDollarMajor': 'BillIcon',
  'AnalyticsIcon': 'ChartVerticalIcon'
};

console.log('🔧 Fixing Polaris icon imports...\n');

// Find all TypeScript files
const files = glob.sync('app/**/*.{ts,tsx}');

let filesChanged = 0;
let totalReplacements = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Check if file contains Polaris icon imports
  if (content.includes('@shopify/polaris-icons')) {
    Object.entries(iconMappings).forEach(([oldIcon, newIcon]) => {
      const regex = new RegExp(`\\b${oldIcon}\\b`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, newIcon);
        changed = true;
        totalReplacements++;
        console.log(`  ${file}: ${oldIcon} → ${newIcon}`);
      }
    });
    
    if (changed) {
      fs.writeFileSync(file, content);
      filesChanged++;
    }
  }
});

console.log(`\n✅ Fixed ${totalReplacements} icon imports in ${filesChanged} files!`);