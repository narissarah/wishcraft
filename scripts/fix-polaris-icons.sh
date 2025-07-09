#!/bin/bash

# Fix Polaris icon imports
# Maps old icon names to new ones

echo "🔧 Fixing Polaris icon imports..."

# Icon mappings
declare -A icon_mappings=(
    ["EyeIcon"]="ViewIcon"
    ["BellIcon"]="NotificationIcon"
    ["AnalyticsIcon"]="AnalyticsMajor"
    ["CustomerIcon"]="CustomersMajor"
    ["TrendingUpIcon"]="TrendingUpMajor"
    ["TrendingDownIcon"]="TrendingDownMajor"
    ["CircleTickIcon"]="CircleTickMajor"
    ["CashIcon"]="CashDollarMajor"
    ["CopyIcon"]="DuplicateMinor"
    ["ShipmentIcon"]="ShipmentMajor"
    ["SecurityIcon"]="LockMajor"
    ["BillingIcon"]="BillingStatementDollarMajor"
)

# Find all files with icon imports
files=$(grep -r "import.*Icon.*from.*@shopify/polaris-icons" app --include="*.tsx" --include="*.ts" -l)

for file in $files; do
    echo "Processing: $file"
    
    # Create backup
    cp "$file" "$file.bak"
    
    # Replace icon names
    for old_icon in "${!icon_mappings[@]}"; do
        new_icon="${icon_mappings[$old_icon]}"
        
        # Replace in imports
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/\b${old_icon}\b/${new_icon}/g" "$file"
        else
            sed -i "s/\b${old_icon}\b/${new_icon}/g" "$file"
        fi
    done
done

echo "✅ Icon imports fixed!"
echo ""
echo "Changed icons:"
for old_icon in "${!icon_mappings[@]}"; do
    echo "  $old_icon → ${icon_mappings[$old_icon]}"
done