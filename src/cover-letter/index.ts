import { z } from 'zod';

export interface CoverLetterRequest {
  hiringManager?: string;
  title?: string;
  role: string;
  company: string;
  bodyVersionSlug?: string;
}

export interface CoverLetterContactMethod {
  id: 'email' | 'website' | 'linkedin' | 'phone' | 'github';
  label: string;
  value: string;
  href?: string;
  includeInSignature: boolean;
  includeInFooter: boolean;
  footerIcon?: 'email' | 'link' | 'linkedin' | 'github';
}

export interface CoverLetterBodyVersion {
  id: string;
  slug: string;
  name: string;
  greeting: string;
  body: string;
  signOff: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CoverLetterTemplateValues {
  hiringManager: string;
  title: string;
  role: string;
  company: string;
}

interface CoverLetterDataModel {
  defaults: {
    hiringManager: string;
    title: string;
    bodyVersionSlug: string;
  };
  previewRequest: CoverLetterRequest;
  profile: {
    name: string;
    logoAlt: string;
    addressLines: string[];
    footerAddressLines: string[];
    signatureContactIds: CoverLetterContactMethod['id'][];
    footerContactIds: CoverLetterContactMethod['id'][];
    contacts: CoverLetterContactMethod[];
  };
  bodyVersions: CoverLetterBodyVersion[];
}

export interface CoverLetterAdminDocument {
  profile: {
    name: string;
    logoAlt: string;
    addressLines: string[];
    footerAddressLines: string[];
    contacts: CoverLetterContactMethod[];
  };
  defaults: {
    title: string;
    hiringManager: string;
    defaultBodyVersionId: string;
  };
  bodyVersions: CoverLetterBodyVersion[];
}

export const coverLetterContactMethodSchema: z.ZodType<CoverLetterContactMethod> = z.object({
  id: z.enum([ 'email', 'website', 'linkedin', 'phone', 'github' ]),
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
  href: z.string().trim().min(1).optional(),
  includeInSignature: z.boolean(),
  includeInFooter: z.boolean(),
  footerIcon: z.enum([ 'email', 'link', 'linkedin', 'github' ]).optional()
});

export const coverLetterBodyVersionSchema: z.ZodType<CoverLetterBodyVersion> = z.object({
  id: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  greeting: z.string().trim().min(1),
  body: z.string().trim().min(1),
  signOff: z.string().trim().min(1),
  isDefault: z.boolean(),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1)
});

export const coverLetterAdminDocumentSchema: z.ZodType<CoverLetterAdminDocument> = z.object({
  profile: z.object({
    name: z.string().trim().min(1),
    logoAlt: z.string().trim().min(1),
    addressLines: z.array(z.string().trim().min(1)),
    footerAddressLines: z.array(z.string().trim().min(1)),
    contacts: z.array(coverLetterContactMethodSchema)
  }),
  defaults: z.object({
    title: z.string().trim().min(1),
    hiringManager: z.string().trim().min(1),
    defaultBodyVersionId: z.string().trim().min(1)
  }),
  bodyVersions: z.array(coverLetterBodyVersionSchema).min(1)
}).superRefine(function validateAdminDocument(adminDocument, context) {
  const bodyVersionIds = new Set(adminDocument.bodyVersions.map(function mapBodyVersionId(bodyVersion) {
    return bodyVersion.id;
  }));
  const bodyVersionSlugs = new Set<string>();
  let defaultCount = 0;

  for (const bodyVersion of adminDocument.bodyVersions) {
    if (bodyVersionSlugs.has(bodyVersion.slug)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [ 'bodyVersions' ],
        message: `Duplicate body version slug: ${bodyVersion.slug}`
      });
    }

    bodyVersionSlugs.add(bodyVersion.slug);

    if (bodyVersion.isDefault) {
      defaultCount += 1;
    }
  }

  if (!bodyVersionIds.has(adminDocument.defaults.defaultBodyVersionId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [ 'defaults', 'defaultBodyVersionId' ],
      message: 'Default body version id must reference an existing body version.'
    });
  }

  if (defaultCount !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [ 'bodyVersions' ],
      message: 'Exactly one body version must be marked as default.'
    });
  }
});

export interface ResolvedCoverLetter {
  date: string;
  recipient: {
    hiringManager: string;
    role: string;
    company: string;
  };
  bodyVersion: {
    slug: string;
    name: string;
  };
  body: {
    greeting: string;
    paragraphs: string[];
    signOff: string;
  };
  signature: {
    name: string;
    title: string;
    contacts: CoverLetterContactMethod[];
  };
  footer: {
    logoAlt: string;
    name: string;
    title: string;
    addressLines: string[];
    contacts: CoverLetterContactMethod[];
  };
}

export const coverLetterDataModel: CoverLetterDataModel = {
  defaults: {
    hiringManager: 'Hiring Manager',
    title: 'Senior Product Designer & Full-Stack Developer',
    bodyVersionSlug: 'standard'
  },
  previewRequest: {
    role: 'Role',
    company: 'Company Name'
  },
  profile: {
    name: 'Avana Vana',
    logoAlt: 'Avana Vana – Design / Engineering',
    addressLines: [
      '287 E. 4th St. Apt. GR',
      'New York, NY 10009'
    ],
    footerAddressLines: [
      '287 E. 4th St. Apt. GR',
      'New York, NY 10009',
      '+1 347 652 8635'
    ],
    signatureContactIds: [ 'website', 'linkedin', 'email', 'phone' ],
    footerContactIds: [ 'email', 'website', 'linkedin' ],
    contacts: [
      {
        id: 'website',
        label: 'Website',
        value: 'www.avanavana.com',
        href: 'https://www.avanavana.com',
        includeInSignature: true,
        includeInFooter: true,
        footerIcon: 'link'
      },
      {
        id: 'linkedin',
        label: 'LinkedIn',
        value: 'www.linkedin.com/in/avanavana',
        href: 'https://linkedin.com/in/avanavana',
        includeInSignature: true,
        includeInFooter: true,
        footerIcon: 'linkedin'
      },
      {
        id: 'email',
        label: 'Email',
        value: 'avana.vana@pm.me',
        href: 'mailto:avana.vana@pm.me',
        includeInSignature: true,
        includeInFooter: true,
        footerIcon: 'email'
      },
      {
        id: 'phone',
        label: 'Phone',
        value: '+1 347 652 8635',
        href: 'tel:+13476528635',
        includeInSignature: true,
        includeInFooter: false
      },
      {
        id: 'github',
        label: 'GitHub',
        value: 'github.com/avanavana',
        href: 'https://github.com/avanavana',
        includeInSignature: false,
        includeInFooter: false,
        footerIcon: 'github'
      }
    ]
  },
  bodyVersions: [
    {
      id: 'standard',
      slug: 'standard',
      name: 'Standard',
      greeting: 'Dear {{hiringManager}},',
      body: [
        "I hope this message finds you well. I'm a {{titlePlainText}} with 15+ years of experience designing, building, and shipping production web and mobile applications, and I'm writing to express my interest in the {{role}} role at {{company}}.",
        "My career has spanned product strategy, UI/UX design, user research, design systems, front-end engineering, systems architecture, and team leadership. I specialize in distilling complex and embryonic ideas into refined products, brands, and user experiences. Having worked extensively across both design and engineering, I bring a developer's implementation expertise and systems thinking to design work, and a designer's sense of taste, discernment, craft, and user perspective to engineering.",
        'Most recently, as Design Lead at CO:CREATE, I led product design for a new universal mobile and web application, established a new brand identity and design system, and helped evolve that system to support emerging AI-native workflows through a formalized component architecture and implementation guidelines designed to reduce ambiguity and improve consistency across both human and agent-generated work.',
        "The rise of AI has only reinforced a belief I've held about building software: as generating product ideas, designs, and code becomes faster, cheaper, and more accessible, the value of discernment, judgment, systems thinking, and multidisciplinary expertise increases. The challenge is no longer generating possibilities—it is identifying the right opportunities, understanding tradeoffs, making better decisions, and synthesizing many moving parts into coherent products that serve both users and business goals. These are the very capabilities I've spent my career cultivating at the intersection of design, engineering, and systems thinking.",
        'I would welcome the opportunity to bring that perspective and experience to {{company}}. Thank you for your time and consideration, and I look forward to speaking with you.'
      ].join('\n\n'),
      signOff: 'Warm regards,',
      isDefault: true,
      createdAt: '2026-06-14T00:00:00.000Z',
      updatedAt: '2026-06-14T00:00:00.000Z'
    }
  ]
};

export const coverLetterPreviewRequest = coverLetterDataModel.previewRequest;
export const coverLetterRequestSchema = z.object({
  hiringManager: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1),
  company: z.string().trim().min(1),
  bodyVersionSlug: z.string().trim().min(1).optional()
});

export function getCoverLetterPreviewRequest(overrides: Partial<CoverLetterRequest> = {}): CoverLetterRequest {
  return coverLetterRequestSchema.parse({
    ...coverLetterPreviewRequest,
    ...normalizeCoverLetterRequest(overrides)
  });
}

export function parseCoverLetterRequest(input: unknown): CoverLetterRequest {
  return coverLetterRequestSchema.parse(normalizeCoverLetterRequest(input));
}

export function buildCoverLetterSearchParams(request: Partial<CoverLetterRequest>): URLSearchParams {
  const searchParams = new URLSearchParams();
  const normalizedRequest = normalizeCoverLetterRequest(request);

  for (const [ key, value ] of Object.entries(normalizedRequest)) {
    if (typeof value === 'string') {
      searchParams.set(key, value);
    }
  }

  return searchParams;
}

export function serializeCoverLetterAdminDocument(adminDocument: CoverLetterAdminDocument) {
  return JSON.stringify(coverLetterAdminDocumentSchema.parse(adminDocument));
}

export function getCoverLetterRequestOverrides(searchParams: URLSearchParams): Partial<CoverLetterRequest> {
  return normalizeCoverLetterRequest({
    hiringManager: searchParams.get('hiringManager') || undefined,
    title: searchParams.get('title') || undefined,
    role: searchParams.get('role') || undefined,
    company: searchParams.get('company') || undefined,
    bodyVersionSlug: searchParams.get('bodyVersionSlug') || undefined
  });
}

export function getCoverLetterAdminDocumentOverride(searchParams: URLSearchParams) {
  const adminDocument = searchParams.get('adminDocument');

  if (!adminDocument) {
    return null;
  }

  try {
    return coverLetterAdminDocumentSchema.parse(JSON.parse(adminDocument));
  } catch {
    return null;
  }
}

export function createDefaultCoverLetterAdminDocument(): CoverLetterAdminDocument {
  return {
    profile: {
      name: coverLetterDataModel.profile.name,
      logoAlt: coverLetterDataModel.profile.logoAlt,
      addressLines: coverLetterDataModel.profile.addressLines,
      footerAddressLines: coverLetterDataModel.profile.footerAddressLines,
      contacts: coverLetterDataModel.profile.contacts
    },
    defaults: {
      title: coverLetterDataModel.defaults.title,
      hiringManager: coverLetterDataModel.defaults.hiringManager,
      defaultBodyVersionId: coverLetterDataModel.bodyVersions.find(function findDefaultBodyVersion(bodyVersion) {
        return bodyVersion.isDefault;
      })?.id || coverLetterDataModel.bodyVersions[0].id
    },
    bodyVersions: coverLetterDataModel.bodyVersions
  };
}

export function buildCoverLetter(
  request: CoverLetterRequest = coverLetterPreviewRequest,
  adminDocument: CoverLetterAdminDocument = createDefaultCoverLetterAdminDocument()
): ResolvedCoverLetter {
  const hiringManager = request.hiringManager || adminDocument.defaults.hiringManager;
  const title = request.title || adminDocument.defaults.title;
  const bodyVersion = getBodyVersion(adminDocument, request.bodyVersionSlug);
  const templateValues = {
    hiringManager,
    title,
    titlePlainText: title.replace(' & ', ' and '),
    role: request.role,
    company: request.company
  };

  return {
    date: formatLetterDate(),
    recipient: {
      hiringManager,
      role: request.role,
      company: request.company
    },
    bodyVersion: {
      slug: bodyVersion.slug,
      name: bodyVersion.name
    },
    body: {
      greeting: resolveTemplate(bodyVersion.greeting, templateValues),
      paragraphs: splitBodyIntoParagraphs(bodyVersion.body).map(function mapParagraph(paragraph) {
        return resolveTemplate(paragraph, templateValues);
      }),
      signOff: resolveTemplate(bodyVersion.signOff, templateValues)
    },
    signature: {
      name: adminDocument.profile.name,
      title,
      contacts: getOrderedContacts(adminDocument, 'signature')
    },
    footer: {
      logoAlt: adminDocument.profile.logoAlt,
      name: adminDocument.profile.name,
      title,
      addressLines: adminDocument.profile.footerAddressLines,
      contacts: getOrderedContacts(adminDocument, 'footer')
    }
  };
}

function getBodyVersion(adminDocument: CoverLetterAdminDocument, bodyVersionSlug?: string): CoverLetterBodyVersion {
  if (bodyVersionSlug) {
    return adminDocument.bodyVersions.find(function findBodyVersionBySlug(bodyVersion) {
      return bodyVersion.slug === bodyVersionSlug;
    }) || adminDocument.bodyVersions[0];
  }

  return adminDocument.bodyVersions.find(function findDefaultBodyVersion(bodyVersion) {
    return bodyVersion.id === adminDocument.defaults.defaultBodyVersionId;
  }) || adminDocument.bodyVersions[0];
}

function getOrderedContacts(adminDocument: CoverLetterAdminDocument, location: 'signature' | 'footer'): CoverLetterContactMethod[] {
  return adminDocument.profile.contacts.filter(function filterContact(contact) {
    return location === 'signature' ? contact.includeInSignature : contact.includeInFooter;
  });
}

function resolveTemplate(template: string, values: CoverLetterTemplateValues & { titlePlainText: string }): string {
  return template.replace(/\{\{(\w+)\}\}/g, function replaceToken(_, token) {
    return values[token as keyof typeof values] || '';
  });
}

function normalizeCoverLetterRequest(input: unknown): Partial<CoverLetterRequest> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).flatMap(function mapEntry([ key, value ]) {
      if (typeof value !== 'string') {
        return [];
      }

      const normalizedValue = value.trim();

      if (!normalizedValue) {
        return [];
      }

      return [[ key, normalizedValue ]];
    })
  ) as Partial<CoverLetterRequest>;
}

function splitBodyIntoParagraphs(body: string) {
  return body
    .split(/\n\s*\n/g)
    .map(function mapParagraph(paragraph) {
      return paragraph.trim();
    })
    .filter(Boolean);
}

function formatLetterDate(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York'
  });
}
