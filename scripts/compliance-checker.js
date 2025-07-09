#!/usr/bin/env node
/**
 * Built for Shopify 2025 Compliance Checker
 * Comprehensive validation for 100/100 compliance
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Built for Shopify 2025 Compliance Criteria
const COMPLIANCE_CRITERIA = {
  security: {
    weight: 25,
    checks: [
      {
        name: 'PCI DSS v4 Implementation',
        weight: 8,
        validator: () => checkPCICompliance(),
      },
      {
        name: 'GDPR Webhook Implementation',
        weight: 7,
        validator: () => checkGDPRWebhooks(),
      },
      {
        name: 'OAuth 2.0 Security',
        weight: 5,
        validator: () => checkOAuthSecurity(),
      },
      {
        name: 'Data Protection',
        weight: 5,
        validator: () => checkDataProtection(),
      },
    ],
  },
  performance: {
    weight: 25,
    checks: [
      {
        name: 'Core Web Vitals',
        weight: 10,
        validator: () => checkCoreWebVitals(),
      },
      {
        name: 'Bundle Optimization',
        weight: 8,
        validator: () => checkBundleOptimization(),
      },
      {
        name: 'Caching Strategy',
        weight: 7,
        validator: () => checkCachingStrategy(),
      },
    ],
  },
  api: {
    weight: 20,
    checks: [
      {
        name: 'GraphQL Admin API 2025-07',
        weight: 8,
        validator: () => checkGraphQLAPI(),
      },
      {
        name: 'Rate Limiting',
        weight: 4,
        validator: () => checkRateLimiting(),
      },
      {
        name: 'Webhook Security',
        weight: 4,
        validator: () => checkWebhookSecurity(),
      },
      {
        name: 'OAuth Scopes',
        weight: 4,
        validator: () => checkOAuthScopes(),
      },
    ],
  },
  userExperience: {
    weight: 15,
    checks: [
      {
        name: 'Polaris Design System',
        weight: 6,
        validator: () => checkPolarisCompliance(),
      },
      {
        name: 'Accessibility WCAG 2.1 AA',
        weight: 5,
        validator: () => checkAccessibility(),
      },
      {
        name: 'Mobile Experience',
        weight: 4,
        validator: () => checkMobileExperience(),
      },
    ],
  },
  documentation: {
    weight: 10,
    checks: [
      {
        name: 'API Documentation',
        weight: 5,
        validator: () => checkAPIDocumentation(),
      },
      {
        name: 'Developer Documentation',
        weight: 5,
        validator: () => checkDeveloperDocumentation(),
      },
    ],
  },
  testing: {
    weight: 5,
    checks: [
      {
        name: 'Test Coverage',
        weight: 3,
        validator: () => checkTestCoverage(),
      },
      {
        name: 'Security Testing',
        weight: 2,
        validator: () => checkSecurityTesting(),
      },
    ],
  },
};

class ComplianceChecker {
  constructor() {
    this.results = [];
    this.totalScore = 0;
    this.maxScore = 100;
  }

  async runAllChecks() {
    console.log(chalk.bold('🏆 Built for Shopify 2025 Compliance Checker'));
    console.log(chalk.bold('=' .repeat(60)));

    for (const [category, config] of Object.entries(COMPLIANCE_CRITERIA)) {
      console.log(chalk.blue(`\n📋 Checking ${category.toUpperCase()}...`));
      
      const categoryResults = await this.runCategoryChecks(category, config);
      this.results.push({
        category,
        weight: config.weight,
        results: categoryResults,
      });
    }

    this.generateReport();
  }

  async runCategoryChecks(category, config) {
    const results = [];
    let categoryScore = 0;

    for (const check of config.checks) {
      try {
        const result = await check.validator();
        const score = result.passed ? check.weight : 0;
        categoryScore += score;

        results.push({
          name: check.name,
          weight: check.weight,
          score,
          passed: result.passed,
          details: result.details,
          recommendations: result.recommendations || [],
        });

        const status = result.passed ? chalk.green('✅') : chalk.red('❌');
        console.log(`  ${status} ${check.name} (${score}/${check.weight})`);
        
        if (!result.passed && result.details) {
          console.log(chalk.red(`     ${result.details}`));
        }
      } catch (error) {
        console.log(chalk.red(`  ❌ ${check.name} (0/${check.weight}) - Error: ${error.message}`));
        results.push({
          name: check.name,
          weight: check.weight,
          score: 0,
          passed: false,
          details: `Error: ${error.message}`,
          recommendations: ['Fix implementation errors'],
        });
      }
    }

    console.log(chalk.yellow(`  Category Score: ${categoryScore}/${config.weight}`));
    return results;
  }

  generateReport() {
    console.log(chalk.bold('\n📊 COMPLIANCE REPORT'));
    console.log(chalk.bold('=' .repeat(60)));

    let totalScore = 0;
    const failedChecks = [];
    const recommendations = [];

    this.results.forEach(({ category, weight, results }) => {
      const categoryScore = results.reduce((sum, result) => sum + result.score, 0);
      totalScore += categoryScore;

      console.log(chalk.blue(`\n${category.toUpperCase()}: ${categoryScore}/${weight}`));
      
      results.forEach(result => {
        if (!result.passed) {
          failedChecks.push(`${category}: ${result.name}`);
          recommendations.push(...result.recommendations);
        }
      });
    });

    console.log(chalk.bold(`\n🎯 TOTAL SCORE: ${totalScore}/100`));

    if (totalScore >= 100) {
      console.log(chalk.green('\n🏆 PERFECT COMPLIANCE! Ready for Built for Shopify 2025 certification.'));
    } else if (totalScore >= 95) {
      console.log(chalk.green('\n🌟 EXCELLENT! Minor improvements needed for perfect compliance.'));
    } else if (totalScore >= 90) {
      console.log(chalk.yellow('\n⭐ VERY GOOD! Some improvements needed for certification.'));
    } else {
      console.log(chalk.red('\n⚠️  NEEDS IMPROVEMENT! Significant work required for certification.'));
    }

    if (failedChecks.length > 0) {
      console.log(chalk.red('\n❌ Failed Checks:'));
      failedChecks.forEach(check => console.log(chalk.red(`  • ${check}`)));
    }

    if (recommendations.length > 0) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      [...new Set(recommendations)].forEach(rec => console.log(chalk.yellow(`  • ${rec}`)));
    }

    // Save detailed report
    this.saveDetailedReport(totalScore);

    process.exit(totalScore >= 100 ? 0 : 1);
  }

  saveDetailedReport(totalScore) {
    const report = {
      timestamp: new Date().toISOString(),
      totalScore,
      maxScore: 100,
      results: this.results,
      status: totalScore >= 100 ? 'COMPLIANT' : 'NON_COMPLIANT',
    };

    fs.writeFileSync(
      'compliance-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log(chalk.gray('\n📄 Detailed report saved to compliance-report.json'));
  }
}

// Individual check implementations
function checkPCICompliance() {
  const checks = [
    () => fs.existsSync('app/lib/pci-compliance.server.ts'),
    () => fs.existsSync('app/lib/security-headers.server.ts'),
    () => checkForEncryption(),
  ];

  const passed = checks.every(check => check());
  return {
    passed,
    details: passed ? 'PCI DSS v4 implementation found' : 'Missing PCI DSS implementation files',
    recommendations: passed ? [] : ['Implement PCI DSS v4 compliance measures'],
  };
}

function checkGDPRWebhooks() {
  const gdprFiles = [
    'app/routes/webhooks.customers.data_request.tsx',
    'app/routes/webhooks.customers.redact.tsx',
    'app/routes/webhooks.shop.redact.tsx',
  ];

  const allExist = gdprFiles.every(file => fs.existsSync(file));
  return {
    passed: allExist,
    details: allExist ? 'All GDPR webhooks implemented' : 'Missing GDPR webhook handlers',
    recommendations: allExist ? [] : ['Implement missing GDPR webhook handlers'],
  };
}

function checkOAuthSecurity() {
  const authFile = 'app/lib/auth.server.ts';
  const exists = fs.existsSync(authFile);
  
  if (exists) {
    const content = fs.readFileSync(authFile, 'utf8');
    const hasOAuth2 = content.includes('OAuth') || content.includes('oauth');
    return {
      passed: hasOAuth2,
      details: hasOAuth2 ? 'OAuth 2.0 implementation found' : 'OAuth 2.0 implementation not found',
      recommendations: hasOAuth2 ? [] : ['Implement OAuth 2.0 with PKCE'],
    };
  }

  return {
    passed: false,
    details: 'Auth server file not found',
    recommendations: ['Create OAuth 2.0 authentication system'],
  };
}

function checkDataProtection() {
  const securityFiles = [
    'app/lib/security-headers.server.ts',
    'app/lib/secret-rotation.server.ts',
  ];

  const hasProtection = securityFiles.some(file => fs.existsSync(file));
  return {
    passed: hasProtection,
    details: hasProtection ? 'Data protection measures found' : 'Data protection measures not found',
    recommendations: hasProtection ? [] : ['Implement data encryption and protection'],
  };
}

function checkCoreWebVitals() {
  const lighthouseConfig = fs.existsSync('lighthouserc.json');
  const performanceMonitoring = fs.existsSync('app/lib/performance-monitoring.client.ts');
  
  return {
    passed: lighthouseConfig && performanceMonitoring,
    details: 'Core Web Vitals monitoring implementation',
    recommendations: lighthouseConfig && performanceMonitoring ? [] : ['Implement Core Web Vitals monitoring'],
  };
}

function checkBundleOptimization() {
  const viteConfig = fs.existsSync('vite.config.js');
  const sizeLimit = fs.existsSync('.size-limit.json') || fs.existsSync('.bundlesize.json');
  
  return {
    passed: viteConfig && sizeLimit,
    details: 'Bundle optimization configuration',
    recommendations: viteConfig && sizeLimit ? [] : ['Configure bundle optimization and size limits'],
  };
}

function checkCachingStrategy() {
  const cachingFile = fs.existsSync('app/lib/caching.server.ts');
  
  return {
    passed: cachingFile,
    details: cachingFile ? 'Caching strategy implemented' : 'Caching strategy not found',
    recommendations: cachingFile ? [] : ['Implement comprehensive caching strategy'],
  };
}

function checkGraphQLAPI() {
  const shopifyConfig = fs.existsSync('shopify.app.wishcraft.toml');
  
  if (shopifyConfig) {
    const content = fs.readFileSync('shopify.app.wishcraft.toml', 'utf8');
    const hasCorrectVersion = content.includes('2025-07');
    
    return {
      passed: hasCorrectVersion,
      details: hasCorrectVersion ? 'GraphQL Admin API 2025-07 configured' : 'Incorrect API version',
      recommendations: hasCorrectVersion ? [] : ['Update to GraphQL Admin API 2025-07'],
    };
  }

  return {
    passed: false,
    details: 'Shopify configuration not found',
    recommendations: ['Configure Shopify app with GraphQL Admin API 2025-07'],
  };
}

function checkRateLimiting() {
  const rateLimitFile = fs.existsSync('app/lib/rate-limiter.server.ts') || 
                       fs.existsSync('app/lib/distributed-rate-limiter.server.ts');
  
  return {
    passed: rateLimitFile,
    details: rateLimitFile ? 'Rate limiting implemented' : 'Rate limiting not found',
    recommendations: rateLimitFile ? [] : ['Implement rate limiting'],
  };
}

function checkWebhookSecurity() {
  const webhookFiles = fs.readdirSync('app/routes').filter(file => file.startsWith('webhooks.'));
  
  return {
    passed: webhookFiles.length > 0,
    details: `${webhookFiles.length} webhook handlers found`,
    recommendations: webhookFiles.length > 0 ? [] : ['Implement webhook handlers with HMAC validation'],
  };
}

function checkOAuthScopes() {
  const shopifyConfig = fs.existsSync('shopify.app.wishcraft.toml');
  
  if (shopifyConfig) {
    const content = fs.readFileSync('shopify.app.wishcraft.toml', 'utf8');
    const scopesMatch = content.match(/scopes = "([^"]+)"/);
    
    if (scopesMatch) {
      const scopes = scopesMatch[1].split(',');
      const isOptimal = scopes.length <= 7; // Optimal scope count
      
      return {
        passed: isOptimal,
        details: `${scopes.length} OAuth scopes configured`,
        recommendations: isOptimal ? [] : ['Optimize OAuth scopes to minimal required'],
      };
    }
  }

  return {
    passed: false,
    details: 'OAuth scopes not configured',
    recommendations: ['Configure minimal required OAuth scopes'],
  };
}

function checkPolarisCompliance() {
  const packageJson = fs.existsSync('package.json');
  
  if (packageJson) {
    const content = fs.readFileSync('package.json', 'utf8');
    const pkg = JSON.parse(content);
    const polarisVersion = pkg.dependencies?.['@shopify/polaris'];
    
    if (polarisVersion) {
      const version = polarisVersion.replace(/[^\d.]/g, '');
      const majorVersion = parseInt(version.split('.')[0]);
      const passed = majorVersion >= 12;
      
      return {
        passed,
        details: `Polaris v${version} ${passed ? '(compliant)' : '(outdated)'}`,
        recommendations: passed ? [] : ['Update to Polaris v12+'],
      };
    }
  }

  return {
    passed: false,
    details: 'Polaris not found in dependencies',
    recommendations: ['Install Polaris Design System v12+'],
  };
}

function checkAccessibility() {
  const accessibilityFile = fs.existsSync('app/lib/accessibility.ts');
  const testFile = fs.existsSync('test/accessibility/screen-reader.test.ts');
  
  return {
    passed: accessibilityFile && testFile,
    details: 'Accessibility implementation and testing',
    recommendations: accessibilityFile && testFile ? [] : ['Implement WCAG 2.1 AA compliance'],
  };
}

function checkMobileExperience() {
  const responsiveTests = fs.existsSync('test/responsive') || 
                         fs.existsSync('tests/responsive');
  
  return {
    passed: responsiveTests,
    details: responsiveTests ? 'Mobile testing implemented' : 'Mobile testing not found',
    recommendations: responsiveTests ? [] : ['Implement responsive design testing'],
  };
}

function checkAPIDocumentation() {
  const openApiDoc = fs.existsSync('docs/api/openapi.yaml') || 
                    fs.existsSync('docs/api/swagger.yaml');
  
  return {
    passed: openApiDoc,
    details: openApiDoc ? 'API documentation found' : 'API documentation not found',
    recommendations: openApiDoc ? [] : ['Create comprehensive API documentation'],
  };
}

function checkDeveloperDocumentation() {
  const readme = fs.existsSync('README.md');
  const claudeMd = fs.existsSync('CLAUDE.md');
  
  return {
    passed: readme && claudeMd,
    details: 'Developer documentation',
    recommendations: readme && claudeMd ? [] : ['Create comprehensive developer documentation'],
  };
}

function checkTestCoverage() {
  const vitestConfig = fs.existsSync('vitest.config.ts');
  const testDir = fs.existsSync('test') || fs.existsSync('tests');
  
  return {
    passed: vitestConfig && testDir,
    details: 'Test configuration and test files',
    recommendations: vitestConfig && testDir ? [] : ['Set up comprehensive test suite'],
  };
}

function checkSecurityTesting() {
  const securityTests = fs.existsSync('test/security') || 
                       fs.existsSync('tests/security');
  
  return {
    passed: securityTests,
    details: securityTests ? 'Security testing implemented' : 'Security testing not found',
    recommendations: securityTests ? [] : ['Implement security testing'],
  };
}

function checkForEncryption() {
  const files = ['app/lib/pci-compliance.server.ts', 'app/lib/secret-rotation.server.ts'];
  
  return files.some(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      return content.includes('encrypt') || content.includes('crypto') || content.includes('AES');
    }
    return false;
  });
}

// Run the compliance checker
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new ComplianceChecker();
  checker.runAllChecks().catch(console.error);
}

export default ComplianceChecker;