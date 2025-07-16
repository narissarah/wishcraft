# Changelog

All notable changes to WishCraft will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive monitoring and alerting system
- Performance budget enforcement
- Advanced security headers and CSRF protection
- Real-time inventory synchronization
- Gift registry sharing functionality

### Changed
- Upgraded to Shopify API version 2025-07
- Improved performance monitoring architecture
- Enhanced database schema with better indexing

### Fixed
- Consolidated duplicate utility functions
- Removed redundant performance monitoring systems
- Fixed documentation inconsistencies

## [1.0.0] - 2025-01-15

### Added
- Initial release of WishCraft Shopify app
- Core gift registry functionality
- Shopify admin integration
- Theme extension for storefront
- Database schema with PostgreSQL
- Basic authentication and security measures
- GDPR compliance features
- Webhook handling for customer data

### Security
- HMAC verification for webhooks
- Session encryption and management
- CSRF protection for forms
- Input sanitization and validation

### Performance
- Multi-level caching strategy
- Bundle optimization
- Core Web Vitals monitoring
- Resource hints and critical CSS

---

## Version Numbering

- **Major version**: Breaking changes, significant new features
- **Minor version**: New features, backwards compatible
- **Patch version**: Bug fixes, minor improvements

## Release Process

1. Update version in package.json
2. Update this CHANGELOG.md
3. Create git tag with version number
4. Deploy to production
5. Create GitHub release with release notes