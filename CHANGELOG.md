# Changelog

All notable changes to this project will be documented in this file.

## [1.0.4] - 2026-06-16

### Fixed

- Downgrade the frontend toolchain from Vite 8 to Vite 7 to avoid the Render production build resolver failure in Rolldown

## [1.0.3] - 2026-06-16

### Fixed

- Cast the Vite experimental resolver workaround through `UserConfig` so TypeScript accepts the production-build configuration on Render

## [1.0.2] - 2026-06-16

### Fixed

- Disable Vite 8's native Rolldown resolver so Render production builds avoid the `tslib` resolution bug triggered by `react-remove-scroll`

## [1.0.1] - 2026-06-16

### Fixed

- Add the missing `tslib` runtime dependency so production Vite/Rolldown builds succeed on Render

## [1.0.0] - 2026-06-16

### Added

- Add a full `/admin` editing interface for managing body versions, signature fields, footer fields, and on-demand PDF generation
- Add admin API routes for loading and saving admin state, managing body versions, and generating preview PDFs from draft content
- Add local JSON persistence fallback for admin data when Redis is not configured
- Add support for optional request-level `salutation` overrides to customize the greeting independently of the hiring manager

### Changed

- Reorganize local scripts so frontend and server can run together or independently with dedicated `dev:*` and `start:*` commands
- Move the cover-letter content into a richer shared data model that supports editable body versions and configurable signature/footer fields
- Update the admin generate flow to support conditional salutation editing and better preview behavior
- Scope Sonner toasts to the admin route so the print/render route stays isolated from admin UI chrome

### Fixed

- Prevent blank trailing PDF pages by restricting generated output to the single intended page
- Improve local admin resilience by falling back to cached state and retrying when the API is briefly unavailable
- Validate saved contact fields so website, LinkedIn, GitHub, email, and phone values must match the expected formats
- Preserve health and PDF API behavior while improving local render-origin fallback and filename generation

## [0.1.0] - 2026-06-14

### Changed

- Customize generated PDF filenames to use the `avana_vana-{role}-cover_letter-{company}-{yyyy-dd-mm}.pdf` pattern with underscore-normalized role and company segments
- Add a top-level validation error `message` field to make API errors easier to consume in iOS Shortcuts

## [0.0.0] - 2026-06-14

### Added

- Initial Vite-based cover letter renderer
- Shared cover letter data model and request parsing helpers
- Protected PDF generation API backed by Puppeteer
