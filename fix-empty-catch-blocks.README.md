# Fix Empty Catch Blocks Script

This script automatically finds and fixes empty catch blocks in your codebase by adding appropriate error logging using the logger.server module.

## Usage

### Dry Run (recommended first)
```bash
npm run fix:catch:dry
```

This will show you what changes would be made without modifying any files.

### Apply Fixes
```bash
npm run fix:catch
```

This will actually modify the files to add error logging to empty catch blocks.

### Command Line Options

- `-d, --dry-run`: Show what would be changed without modifying files
- `-v, --verbose`: Show more detailed output including context detection
- `-h, --help`: Show help message

### Direct Usage
```bash
node fix-empty-catch-blocks.cjs [options]
```

## What It Does

1. **Finds Empty Catch Blocks**: Searches for catch blocks that contain no statements
2. **Adds Error Logging**: Inserts appropriate `log.error()` calls
3. **Smart Context Detection**: Determines the operation context based on:
   - File path (e.g., graphql, cache, webhook files)
   - Function name where the catch block is located
4. **Import Management**: Automatically adds the logger import if needed

## Example Transformation

Before:
```typescript
try {
  await someOperation();
} catch (error) {
}
```

After:
```typescript
import { log } from './logger.server';

try {
  await someOperation();
} catch (error) {
  log.error('someOperation operation failed', error);
}
```

## Notes

- The script ignores catch blocks that already have content (even just comments)
- It preserves the error variable name from the original catch block
- If no error variable is specified, it defaults to `error`
- The script is safe to run multiple times - it won't modify already-fixed catch blocks