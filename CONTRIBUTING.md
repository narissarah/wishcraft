# Contributing to WishCraft

We love your input! We want to make contributing to WishCraft as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Pull Request Process

1. **Branch Naming**: Use descriptive branch names
   - `feature/add-registry-sharing`
   - `fix/memory-leak-in-monitoring`
   - `docs/update-api-reference`

2. **Commit Messages**: Follow conventional commits format
   ```
   feat: add gift message functionality
   fix: resolve CSRF token validation issue
   docs: update installation instructions
   ```

3. **Testing Requirements**:
   - All new features must include tests
   - Bug fixes must include regression tests
   - Maintain minimum 80% test coverage

4. **Code Review**: All submissions require review from at least one maintainer

## Code Style

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow existing ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### React Components
- Use functional components with hooks
- Follow Shopify Polaris design system
- Implement proper error boundaries
- Use TypeScript interfaces for props

### Database
- Use Prisma migrations for schema changes
- Include proper indexes for performance
- Follow naming conventions (snake_case for columns)

## Setting Up Development Environment

1. **Prerequisites**:
   - Node.js 18.20.0+
   - PostgreSQL 13+
   - Shopify Partner account

2. **Installation**:
   ```bash
   git clone https://github.com/wishcraft-team/wishcraft.git
   cd wishcraft
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm run db:migrate
   npm run dev
   ```

3. **Testing**:
   ```bash
   npm run test          # Unit tests
   npm run test:e2e      # End-to-end tests
   npm run typecheck     # Type checking
   npm run lint          # Code linting
   ```

## Shopify Development Guidelines

### API Usage
- Use GraphQL API exclusively (REST is deprecated for new features)
- Follow Shopify API version 2025-07 standards
- Implement proper error handling and retry logic
- Use webhooks for real-time data synchronization

### Performance
- Maintain Core Web Vitals targets (LCP < 2.5s, INP < 200ms, CLS < 0.1)
- Keep JavaScript bundle under 16KB
- Implement proper caching strategies
- Use performance monitoring and budgets

### Security
- Implement HMAC verification for all webhooks
- Use CSRF protection for form submissions
- Sanitize all user inputs
- Follow GDPR compliance requirements

## Issue Reporting

### Bug Reports
When filing a bug report, please include:
- **Summary**: Clear and concise description
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, browser, Node.js version, etc.
- **Screenshots**: If applicable

### Feature Requests
For feature requests, please provide:
- **Problem**: What problem does this solve?
- **Solution**: Describe your proposed solution
- **Alternatives**: Any alternative solutions considered
- **Additional Context**: Any other relevant information

## Security Vulnerabilities

Please do **NOT** report security vulnerabilities through public GitHub issues. Instead, email us directly at security@wishcraft.app with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We'll respond within 48 hours and work with you to resolve the issue responsibly.

## Release Process

### Version Management
- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Update CHANGELOG.md for each release
- Tag releases in Git

### Pre-release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Shopify compliance verified

## Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers learn and contribute
- Follow GitHub's community guidelines

### Communication
- Use GitHub issues for bugs and feature requests
- Use GitHub discussions for questions and ideas
- Be patient and helpful in code reviews
- Document decisions and reasoning

## Getting Help

- **Documentation**: Check our [wiki](https://github.com/wishcraft-team/wishcraft/wiki)
- **Issues**: Search [existing issues](https://github.com/wishcraft-team/wishcraft/issues)
- **Discussions**: Join [GitHub discussions](https://github.com/wishcraft-team/wishcraft/discussions)
- **Shopify**: Refer to [Shopify documentation](https://shopify.dev)

## Recognition

Contributors who make significant improvements will be:
- Added to the CONTRIBUTORS.md file
- Mentioned in release notes
- Given credit in documentation

Thank you for contributing to WishCraft! 🎁