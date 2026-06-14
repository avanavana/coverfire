# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-06-14

### Changed

- Customize generated PDF filenames to use the `avana_vana-{role}-cover_letter-{company}-{yyyy-dd-mm}.pdf` pattern with underscore-normalized role and company segments
- Add a top-level validation error `message` field to make API errors easier to consume in iOS Shortcuts

## [0.0.0] - 2026-06-14

### Added

- Initial Vite-based cover letter renderer
- Shared cover letter data model and request parsing helpers
- Protected PDF generation API backed by Puppeteer
