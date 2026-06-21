import {
  buildCoverLetterSearchParams,
  serializeCoverLetterAdminDocument,
} from '../cover-letter/index.ts';

import type {
  CoverLetterAdminDocument,
  CoverLetterRequest,
} from '../cover-letter/index.ts';

export function buildCoverLetterPreviewUrl(
  adminDocument: CoverLetterAdminDocument,
  request: Partial<CoverLetterRequest>,
  options: {
    embedded?: boolean;
  } = {},
) {
  const searchParams = buildCoverLetterSearchParams(request);

  searchParams.set(
    'adminDocument',
    serializeCoverLetterAdminDocument(adminDocument),
  );
  searchParams.set('mode', 'preview');

  if (options.embedded) {
    searchParams.set('previewHost', 'admin-overlay');
  }

  return `/letter?${searchParams.toString()}`;
}
