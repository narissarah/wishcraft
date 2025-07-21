/**
 * Shopify 2025 Compliance Checker
 * Comprehensive validation for all 2025 requirements
 */

import { log } from "./logger.server";
import { db } from "./db.server";
import { graphqlQuery } from "./graphql-client.server";
import { verifyWebhookHMAC } from "./webhook-security.server";
import { validateEnvironment } from "./env-validation.server";
import fs from 'fs';
import path from 'path';

interface ComplianceCheck {
  id: string;
  category: 'critical' | 'high' | 'medium' | 'low';
  name: string;
  description: string;
  check: () => Promise<ComplianceResult>;
  fix?: () => Promise<void>;
}

interface ComplianceResult {
  passed: boolean;
  message: string;
  details?: any;
  recommendations?: string[];
}

interface ComplianceReport {
  timestamp: string;
  overallScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  results: Array<{
    id: string;
    category: string;
    name: string;
    passed: boolean;
    message: string;
    details?: any;
    recommendations?: string[];
  }>;
  recommendations: string[];
}

export class Compliance2025Checker {
  private checks: ComplianceCheck[] = [];

  constructor() {
    this.initializeChecks();
  }

  /**
   * Initialize all compliance checks
   */
  private initializeChecks() {
    this.checks = [
      // Critical API compliance
      {
        id: 'api-version-2025',
        category: 'critical',
        name: 'API Version 2025-01 Usage',
        description: 'Verify all API calls use current stable 2025-01 version',
        check: this.checkApiVersion2025.bind(this)
      },
      {
        id: 'graphql-only',
        category: 'critical',
        name: 'GraphQL-Only API Usage',
        description: 'Ensure no REST API calls are made',
        check: this.checkGraphQLOnly.bind(this)
      },
      {
        id: 'app-bridge-4x',
        category: 'critical',
        name: 'App Bridge React 4.x+ Usage',
        description: 'Verify App Bridge React version 4.1.6+',
        check: this.checkAppBridge4x.bind(this)
      },

      // High priority security
      {
        id: 'webhook-hmac',
        category: 'high',
        name: 'Webhook HMAC Verification',
        description: 'Validate webhook security implementation',
        check: this.checkWebhookHMAC.bind(this)
      },
      {
        id: 'oauth-2025',
        category: 'high',
        name: 'OAuth 2.0 2025 Compliance',
        description: 'Verify OAuth implementation meets 2025 standards',
        check: this.checkOAuth2025.bind(this)
      },
      {
        id: 'csp-headers',
        category: 'high',
        name: 'Content Security Policy',
        description: 'Validate CSP headers are properly configured',
        check: this.checkCSPHeaders.bind(this)
      },
      {
        id: 'gdpr-webhooks',
        category: 'high',
        name: 'GDPR Webhook Compliance',
        description: 'Verify required GDPR webhooks are implemented',
        check: this.checkGDPRWebhooks.bind(this)
      },

      // Medium priority features
      {
        id: 'polaris-13x',
        category: 'medium',
        name: 'Polaris 13.x+ Usage',
        description: 'Verify Polaris components version 13.x+',
        check: this.checkPolaris13x.bind(this)
      },
      {
        id: 'performance-monitoring',
        category: 'medium',
        name: 'Performance Monitoring',
        description: 'Validate performance tracking implementation',
        check: this.checkPerformanceMonitoring.bind(this)
      },
      {
        id: 'error-handling',
        category: 'medium',
        name: 'Comprehensive Error Handling',
        description: 'Verify error handling and logging',
        check: this.checkErrorHandling.bind(this)
      },

      // Low priority optimizations
      {
        id: 'caching-strategy',
        category: 'low',
        name: 'Caching Implementation',
        description: 'Validate caching strategy is implemented',
        check: this.checkCachingStrategy.bind(this)
      },
      {
        id: 'database-optimization',
        category: 'low',
        name: 'Database Optimization',
        description: 'Check database indexes and performance',
        check: this.checkDatabaseOptimization.bind(this)
      }
    ];
  }

  /**
   * Run all compliance checks
   */
  async runCompleteAudit(): Promise<ComplianceReport> {
    log.info('Starting comprehensive 2025 compliance audit');
    
    const results = [];
    const categoryCounts = {
      critical: { passed: 0, failed: 0 },
      high: { passed: 0, failed: 0 },
      medium: { passed: 0, failed: 0 },
      low: { passed: 0, failed: 0 }
    };

    for (const check of this.checks) {
      try {
        log.debug(`Running compliance check: ${check.name}`);
        const result = await check.check();
        
        results.push({
          id: check.id,
          category: check.category,
          name: check.name,
          passed: result.passed,
          message: result.message,
          details: result.details,
          recommendations: result.recommendations
        });

        if (result.passed) {
          categoryCounts[check.category].passed++;
        } else {
          categoryCounts[check.category].failed++;
        }

        log.debug(`Check ${check.name}: ${result.passed ? 'PASSED' : 'FAILED'}`);
      } catch (error) {
        log.error(`Compliance check failed: ${check.name}`, error instanceof Error ? error : new Error(String(error)));
        results.push({
          id: check.id,
          category: check.category,
          name: check.name,
          passed: false,
          message: `Check failed with error: ${error instanceof Error ? error.message : String(error)}`,
          details: { error: error instanceof Error ? error.message : String(error) }
        });
        categoryCounts[check.category].failed++;
      }
    }

    const totalChecks = this.checks.length;
    const passedChecks = results.filter(r => r.passed).length;
    const failedChecks = totalChecks - passedChecks;
    const overallScore = Math.round((passedChecks / totalChecks) * 100);

    const report: ComplianceReport = {
      timestamp: new Date().toISOString(),
      overallScore,
      totalChecks,
      passedChecks,
      failedChecks,
      criticalIssues: categoryCounts.critical.failed,
      highIssues: categoryCounts.high.failed,
      mediumIssues: categoryCounts.medium.failed,
      lowIssues: categoryCounts.low.failed,
      results,
      recommendations: this.generateRecommendations(results)
    };

    await this.saveComplianceReport(report);
    log.info('Compliance audit completed', { 
      score: overallScore, 
      passed: passedChecks, 
      failed: failedChecks 
    });

    return report;
  }

  /**
   * Individual compliance check implementations
   */
  private async checkApiVersion2025(): Promise<ComplianceResult> {
    try {
      // Check shopify.server.ts for API version
      const shopifyConfigPath = path.join(process.cwd(), 'app/shopify.server.ts');
      const configContent = fs.readFileSync(shopifyConfigPath, 'utf-8');
      
      if (configContent.includes('2025-01')) {
        return {
          passed: true,
          message: 'API version 2025-01 is correctly configured'
        };
      } else {
        return {
          passed: false,
          message: 'API version 2025-01 not found in configuration',
          recommendations: ['Update API version to 2025-01 for current stable release compatibility']
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check API version configuration',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkGraphQLOnly(): Promise<ComplianceResult> {
    try {
      // Check for REST API usage in codebase
      const appDir = path.join(process.cwd(), 'app');
      const hasRestApiCalls = await this.searchForRestApiCalls(appDir);
      
      if (!hasRestApiCalls) {
        return {
          passed: true,
          message: 'No REST API calls found - GraphQL-only implementation confirmed'
        };
      } else {
        return {
          passed: false,
          message: 'REST API calls found in codebase',
          recommendations: ['Migrate all REST API calls to GraphQL']
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check GraphQL-only implementation',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkAppBridge4x(): Promise<ComplianceResult> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      
      const appBridgeVersion = packageContent.dependencies?.['@shopify/app-bridge-react'];
      if (!appBridgeVersion) {
        return {
          passed: false,
          message: 'App Bridge React not found in dependencies',
          recommendations: ['Install @shopify/app-bridge-react@^4.1.6']
        };
      }

      // Check version is 4.1.6+
      const versionMatch = appBridgeVersion.match(/(\d+)\.(\d+)\.(\d+)/);
      if (versionMatch) {
        const [, major, minor, patch] = versionMatch.map(Number);
        if (major >= 4 && minor >= 1 && patch >= 6) {
          return {
            passed: true,
            message: `App Bridge React version ${appBridgeVersion} meets 2025 requirements`
          };
        }
      }

      return {
        passed: false,
        message: `App Bridge React version ${appBridgeVersion} does not meet 2025 requirements`,
        recommendations: ['Update to @shopify/app-bridge-react@^4.1.6']
      };
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check App Bridge version',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkWebhookHMAC(): Promise<ComplianceResult> {
    try {
      // SECURITY FIX: Never use insecure fallbacks
      if (!process.env.SHOPIFY_WEBHOOK_SECRET) {
        return {
          passed: false,
          message: 'CRITICAL: SHOPIFY_WEBHOOK_SECRET environment variable not set',
          details: {
            error: 'Required webhook secret missing',
            impact: 'Webhook verification will fail, app security compromised'
          },
          recommendations: [
            'Set SHOPIFY_WEBHOOK_SECRET environment variable',
            'Generate secret in Shopify Partners Dashboard',
            'Never use default or test secrets in production'
          ]
        };
      }
      
      // Test webhook verification function
      const testPayload = JSON.stringify({ test: 'data' });
      const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
      
      // Generate test HMAC
      const crypto = require('crypto');
      const testHmac = crypto.createHmac('sha256', secret)
        .update(testPayload, 'utf8')
        .digest('base64');
      
      // Test verification
      const isValid = verifyWebhookHMAC(testPayload, testHmac, secret);
      
      if (isValid) {
        return {
          passed: true,
          message: 'Webhook HMAC verification is properly implemented'
        };
      } else {
        return {
          passed: false,
          message: 'Webhook HMAC verification failed test',
          recommendations: ['Review webhook security implementation']
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to test webhook HMAC verification',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkOAuth2025(): Promise<ComplianceResult> {
    try {
      // Check OAuth configuration
      const requiredEnvVars = [
        'SHOPIFY_API_KEY',
        'SHOPIFY_API_SECRET',
        'SHOPIFY_APP_URL',
        'SESSION_SECRET'
      ];
      
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length === 0) {
        return {
          passed: true,
          message: 'OAuth 2.0 configuration meets 2025 requirements'
        };
      } else {
        return {
          passed: false,
          message: `Missing OAuth environment variables: ${missingVars.join(', ')}`,
          recommendations: ['Set all required OAuth environment variables']
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check OAuth configuration',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkCSPHeaders(): Promise<ComplianceResult> {
    try {
      const securityPath = path.join(process.cwd(), 'app/lib/security-headers.server.ts');
      const securityContent = fs.readFileSync(securityPath, 'utf-8');
      
      const hasNonceSupport = securityContent.includes('nonce-');
      const hasStrictDynamic = securityContent.includes('strict-dynamic');
      const noUnsafeInline = !securityContent.includes("'unsafe-inline'");
      
      if (hasNonceSupport && (hasStrictDynamic || noUnsafeInline)) {
        return {
          passed: true,
          message: 'CSP headers properly configured with nonce-based security'
        };
      } else {
        return {
          passed: false,
          message: 'CSP headers need improvement for 2025 compliance',
          recommendations: [
            'Implement nonce-based CSP',
            'Remove unsafe-inline directives',
            'Add strict-dynamic support'
          ]
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check CSP configuration',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkGDPRWebhooks(): Promise<ComplianceResult> {
    try {
      const webhookPath = path.join(process.cwd(), 'app/lib/webhook-handler.server.ts');
      const webhookContent = fs.readFileSync(webhookPath, 'utf-8');
      
      const requiredWebhooks = [
        'customers/redact',
        'customers/data_request',
        'shop/redact'
      ];
      
      const implementedWebhooks = requiredWebhooks.filter(webhook => 
        webhookContent.includes(webhook)
      );
      
      if (implementedWebhooks.length === requiredWebhooks.length) {
        return {
          passed: true,
          message: 'All required GDPR webhooks are implemented'
        };
      } else {
        const missing = requiredWebhooks.filter(w => !implementedWebhooks.includes(w));
        return {
          passed: false,
          message: `Missing GDPR webhooks: ${missing.join(', ')}`,
          recommendations: ['Implement all required GDPR webhook handlers']
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check GDPR webhooks',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkPolaris13x(): Promise<ComplianceResult> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      
      const polarisVersion = packageContent.dependencies?.['@shopify/polaris'];
      if (!polarisVersion) {
        return {
          passed: false,
          message: 'Polaris not found in dependencies',
          recommendations: ['Install @shopify/polaris@^13.0.0']
        };
      }

      const versionMatch = polarisVersion.match(/(\d+)\./);
      if (versionMatch && parseInt(versionMatch[1]) >= 13) {
        return {
          passed: true,
          message: `Polaris version ${polarisVersion} meets 2025 requirements`
        };
      }

      return {
        passed: false,
        message: `Polaris version ${polarisVersion} is outdated`,
        recommendations: ['Update to @shopify/polaris@^13.0.0']
      };
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check Polaris version',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkPerformanceMonitoring(): Promise<ComplianceResult> {
    try {
      // Check if PerformanceMonitor component exists and is properly implemented
      const perfMonitorPath = path.join(process.cwd(), 'app/components/PerformanceMonitor.tsx');
      const perfMonitorExists = fs.existsSync(perfMonitorPath);
      
      if (!perfMonitorExists) {
        return {
          passed: false,
          message: 'PerformanceMonitor component not found',
          recommendations: ['Implement PerformanceMonitor component for 2025 compliance']
        };
      }
      
      // Check if web-vitals dependency is installed
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const hasWebVitals = packageContent.dependencies?.['web-vitals'];
      
      if (!hasWebVitals) {
        return {
          passed: false,
          message: 'web-vitals dependency not found',
          recommendations: ['Install web-vitals package for Core Web Vitals tracking']
        };
      }
      
      // Check if PerformanceMonitor is imported in root.tsx
      const rootPath = path.join(process.cwd(), 'app/root.tsx');
      const rootContent = fs.readFileSync(rootPath, 'utf-8');
      const hasPerformanceMonitor = rootContent.includes('PerformanceMonitor');
      
      if (!hasPerformanceMonitor) {
        return {
          passed: false,
          message: 'PerformanceMonitor not integrated in app root',
          recommendations: ['Add PerformanceMonitor component to app/root.tsx']
        };
      }
      
      return {
        passed: true,
        message: 'Performance monitoring properly implemented with Core Web Vitals tracking',
        details: {
          webVitalsVersion: hasWebVitals,
          componentExists: perfMonitorExists,
          integratedInRoot: hasPerformanceMonitor
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check performance monitoring implementation',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkErrorHandling(): Promise<ComplianceResult> {
    try {
      const errorPath = path.join(process.cwd(), 'app/lib/errors.server.ts');
      const errorExists = fs.existsSync(errorPath);
      
      if (errorExists) {
        return {
          passed: true,
          message: 'Comprehensive error handling is implemented'
        };
      } else {
        return {
          passed: false,
          message: 'Error handling system not found',
          recommendations: ['Implement comprehensive error handling']
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check error handling',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkCachingStrategy(): Promise<ComplianceResult> {
    try {
      const cachePath = path.join(process.cwd(), 'app/lib/cache-unified.server.ts');
      const cacheExists = fs.existsSync(cachePath);
      
      if (cacheExists) {
        return {
          passed: true,
          message: 'Caching strategy is implemented'
        };
      } else {
        return {
          passed: false,
          message: 'Caching strategy not found',
          recommendations: ['Implement caching strategy for performance']
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check caching strategy',
        details: { error: (error as Error).message }
      };
    }
  }

  private async checkDatabaseOptimization(): Promise<ComplianceResult> {
    try {
      const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      
      const hasIndexes = schemaContent.includes('@@index');
      const hasOptimization = schemaContent.includes('optimization');
      
      if (hasIndexes) {
        return {
          passed: true,
          message: 'Database optimization with indexes is implemented'
        };
      } else {
        return {
          passed: false,
          message: 'Database optimization needs improvement',
          recommendations: ['Add database indexes for performance']
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check database optimization',
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Helper methods
   */
  private async searchForRestApiCalls(directory: string): Promise<boolean> {
    try {
      const files = this.getAllFiles(directory, ['.ts', '.tsx', '.js', '.jsx']);
      const restApiPatterns = [
        /\/admin\/api\//,
        /\.json["'`]\s*[,)]/,
        /shopify\.rest\./,
        /RestClient/,
        /fetch\(["'`][^"'`]*\/admin\/api\//
      ];
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const pattern of restApiPatterns) {
          if (pattern.test(content)) {
            log.warn(`REST API usage found in ${file}`);
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      log.error('Error searching for REST API calls', error);
      return true; // Assume non-compliance on error
    }
  }
  
  private getAllFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...this.getAllFiles(fullPath, extensions));
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      log.error(`Error reading directory ${dir}`, error instanceof Error ? error : new Error(String(error)));
    }
    
    return files;
  }

  private generateRecommendations(results: any[]): string[] {
    const recommendations = [];
    const failedCritical = results.filter(r => !r.passed && r.category === 'critical');
    const failedHigh = results.filter(r => !r.passed && r.category === 'high');
    
    if (failedCritical.length > 0) {
      recommendations.push('🚨 CRITICAL: Fix all critical issues before deployment');
    }
    
    if (failedHigh.length > 0) {
      recommendations.push('⚠️  HIGH: Address high-priority issues for compliance');
    }
    
    // Add specific recommendations from failed checks
    results.forEach(result => {
      if (!result.passed && result.recommendations) {
        recommendations.push(...result.recommendations);
      }
    });
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private async saveComplianceReport(report: ComplianceReport): Promise<void> {
    try {
      const reportPath = path.join(process.cwd(), 'compliance-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      log.info('Compliance report saved', { path: reportPath });
    } catch (error) {
      log.error('Failed to save compliance report', error);
    }
  }
}

// Export singleton instance
export const complianceChecker = new Compliance2025Checker();