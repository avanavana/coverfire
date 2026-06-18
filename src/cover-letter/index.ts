import { z } from 'zod';

export interface CoverLetterRequest {
  hiringManager?: string;
  salutation?: string;
  title?: string;
  role: string;
  company: string;
  templateId?: string;
}

export const coverLetterAdminDocumentSchemaVersion = 2;

export interface CoverLetterContactMethod {
  id: 'address' | 'email' | 'website' | 'linkedin' | 'phone' | 'github';
  label: string;
  value: string;
  href?: string;
  includeInSignature: boolean;
  includeInFooter: boolean;
  footerIcon?: 'email' | 'link' | 'linkedin' | 'github';
}

export interface CoverLetterBodyTemplate {
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
    templateId: string;
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
  bodyTemplates: CoverLetterBodyTemplate[];
}

export interface CoverLetterAdminDocument {
  schemaVersion: typeof coverLetterAdminDocumentSchemaVersion;
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
    defaultBodyTemplateId: string;
  };
  bodyTemplates: CoverLetterBodyTemplate[];
}

const coverLetterContactMethodShapeSchema = z.object({
  id: z.enum([ 'address', 'email', 'website', 'linkedin', 'phone', 'github' ]),
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
  href: z.string().trim().min(1).optional(),
  includeInSignature: z.boolean(),
  includeInFooter: z.boolean(),
  footerIcon: z.enum([ 'email', 'link', 'linkedin', 'github' ]).optional()
});

export const coverLetterContactMethodSchema: z.ZodType<CoverLetterContactMethod> = coverLetterContactMethodShapeSchema.superRefine(
  function validateContactMethod(contactMethod, context) {
    switch (contactMethod.id) {
      case 'email':
        if (!isValidEmailValue(contactMethod.value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [ 'value' ],
            message: 'Enter a valid email address.'
          });
        }
        break;
      case 'website':
        if (!isValidWebsiteValue(contactMethod.value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [ 'value' ],
            message: 'Enter a valid website URL or domain.'
          });
        }
        break;
      case 'linkedin':
        if (!isValidLinkedInProfileValue(contactMethod.value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [ 'value' ],
            message: 'Enter a valid LinkedIn profile URL.'
          });
        }
        break;
      case 'github':
        if (!isValidGitHubProfileValue(contactMethod.value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [ 'value' ],
            message: 'Enter a valid GitHub profile URL.'
          });
        }
        break;
      case 'phone':
        if (!isValidPhoneValue(contactMethod.value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [ 'value' ],
            message: 'Enter a valid phone number.'
          });
        }
        break;
      case 'address':
        break;
    }
  }
);

export const coverLetterBodyTemplateSchema: z.ZodType<CoverLetterBodyTemplate> = z.object({
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
  schemaVersion: z.literal(coverLetterAdminDocumentSchemaVersion),
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
    defaultBodyTemplateId: z.string().trim().min(1)
  }),
  bodyTemplates: z.array(coverLetterBodyTemplateSchema).min(1)
}).superRefine(function validateAdminDocument(adminDocument, context) {
  const bodyTemplateIds = new Set(adminDocument.bodyTemplates.map(function mapBodyTemplateId(bodyTemplate) {
    return bodyTemplate.id;
  }));
  const bodyTemplateSlugs = new Set<string>();
  let defaultCount = 0;

  for (const bodyTemplate of adminDocument.bodyTemplates) {
    if (bodyTemplateSlugs.has(bodyTemplate.slug)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [ 'bodyTemplates' ],
        message: `Duplicate body template slug: ${bodyTemplate.slug}`
      });
    }

    bodyTemplateSlugs.add(bodyTemplate.slug);

    if (bodyTemplate.isDefault) {
      defaultCount += 1;
    }
  }

  if (!bodyTemplateIds.has(adminDocument.defaults.defaultBodyTemplateId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [ 'defaults', 'defaultBodyTemplateId' ],
      message: 'Default body template id must reference an existing body template.'
    });
  }

  if (defaultCount !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [ 'bodyTemplates' ],
      message: 'Exactly one body template must be marked as default.'
    });
  }
});

const coverLetterAdminDocumentNormalizationSchema: z.ZodType<CoverLetterAdminDocument> = z.object({
  schemaVersion: z.literal(coverLetterAdminDocumentSchemaVersion),
  profile: z.object({
    name: z.string().trim().min(1),
    logoAlt: z.string().trim().min(1),
    addressLines: z.array(z.string().trim().min(1)),
    footerAddressLines: z.array(z.string().trim().min(1)),
    contacts: z.array(coverLetterContactMethodShapeSchema)
  }),
  defaults: z.object({
    title: z.string().trim().min(1),
    hiringManager: z.string().trim().min(1),
    defaultBodyTemplateId: z.string().trim().min(1)
  }),
  bodyTemplates: z.array(coverLetterBodyTemplateSchema).min(1)
}).superRefine(function validateAdminDocument(adminDocument, context) {
  const bodyTemplateIds = new Set(adminDocument.bodyTemplates.map(function mapBodyTemplateId(bodyTemplate) {
    return bodyTemplate.id;
  }));
  const bodyTemplateSlugs = new Set<string>();
  let defaultCount = 0;

  for (const bodyTemplate of adminDocument.bodyTemplates) {
    if (bodyTemplateSlugs.has(bodyTemplate.slug)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [ 'bodyTemplates' ],
        message: `Duplicate body template slug: ${bodyTemplate.slug}`
      });
    }

    bodyTemplateSlugs.add(bodyTemplate.slug);

    if (bodyTemplate.isDefault) {
      defaultCount += 1;
    }
  }

  if (!bodyTemplateIds.has(adminDocument.defaults.defaultBodyTemplateId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [ 'defaults', 'defaultBodyTemplateId' ],
      message: 'Default body template id must reference an existing body template.'
    });
  }

  if (defaultCount !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [ 'bodyTemplates' ],
      message: 'Exactly one body template must be marked as default.'
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
  bodyTemplate: {
    id: string;
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
    templateId: 'standard'
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
        id: 'address',
        label: 'Address',
        value: '287 E. 4th St. Apt. GR\nNew York, NY 10009',
        includeInSignature: false,
        includeInFooter: false
      },
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
  bodyTemplates: [
    {
      id: 'standard',
      slug: 'standard',
      name: 'Standard',
      greeting: 'Dear {{hiringManager}},',
      body: [
        "I hope this message finds you well. I'm a {{title}} with 15+ years of experience designing, building, and shipping production web and mobile applications, and I'm writing to express my interest in the {{role}} role at {{company}}.",
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
  salutation: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1),
  company: z.string().trim().min(1),
  templateId: z.string().trim().min(1).optional()
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

export function getCoverLetterGenerationValidationMessage(
  request: Pick<CoverLetterRequest, 'role' | 'company'>
) {
  const hasPlaceholderRole = request.role.trim() === coverLetterPreviewRequest.role;
  const hasPlaceholderCompany = request.company.trim() === coverLetterPreviewRequest.company;

  if (hasPlaceholderRole && hasPlaceholderCompany) {
    return 'Replace the placeholder role and company before generating the PDF.';
  }

  if (hasPlaceholderRole) {
    return 'Replace the placeholder role before generating the PDF.';
  }

  if (hasPlaceholderCompany) {
    return 'Replace the placeholder company before generating the PDF.';
  }

  return '';
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
  return JSON.stringify(normalizeCoverLetterAdminDocument(adminDocument));
}

export function getCoverLetterRequestOverrides(searchParams: URLSearchParams): Partial<CoverLetterRequest> {
  return normalizeCoverLetterRequest({
    hiringManager: searchParams.get('hiringManager') || undefined,
    salutation: searchParams.get('salutation') || undefined,
    title: searchParams.get('title') || undefined,
    role: searchParams.get('role') || undefined,
    company: searchParams.get('company') || undefined,
    templateId: searchParams.get('templateId') || searchParams.get('versionId') || undefined
  });
}

export function getCoverLetterAdminDocumentOverride(searchParams: URLSearchParams) {
  const adminDocument = searchParams.get('adminDocument');

  if (!adminDocument) {
    return null;
  }

  try {
    return normalizeCoverLetterAdminDocument(JSON.parse(adminDocument));
  } catch {
    return null;
  }
}

export function createDefaultCoverLetterAdminDocument(): CoverLetterAdminDocument {
  return normalizeCoverLetterAdminDocument({
    schemaVersion: coverLetterAdminDocumentSchemaVersion,
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
      defaultBodyTemplateId: coverLetterDataModel.bodyTemplates.find(function findDefaultBodyTemplate(bodyTemplate) {
        return bodyTemplate.isDefault;
      })?.id || coverLetterDataModel.bodyTemplates[0].id
    },
    bodyTemplates: coverLetterDataModel.bodyTemplates
  });
}

export function normalizeCoverLetterAdminDocument(input: unknown): CoverLetterAdminDocument {
  const defaultAdminDocument = {
    schemaVersion: coverLetterAdminDocumentSchemaVersion,
    profile: {
      name: coverLetterDataModel.profile.name,
      logoAlt: coverLetterDataModel.profile.logoAlt,
      addressLines: coverLetterDataModel.profile.addressLines,
      footerAddressLines: coverLetterDataModel.profile.footerAddressLines,
      contacts: createDefaultContacts()
    },
    defaults: {
      title: coverLetterDataModel.defaults.title,
      hiringManager: coverLetterDataModel.defaults.hiringManager,
      defaultBodyTemplateId: coverLetterDataModel.bodyTemplates.find(function findDefaultBodyTemplate(bodyTemplate) {
        return bodyTemplate.isDefault;
      })?.id || coverLetterDataModel.bodyTemplates[0].id
    },
    bodyTemplates: coverLetterDataModel.bodyTemplates
  } satisfies CoverLetterAdminDocument;

  const rawInput = isRecord(input) ? input : {};
  const rawProfile = isRecord(rawInput.profile) ? rawInput.profile : {};
  const rawDefaults = isRecord(rawInput.defaults) ? rawInput.defaults : {};
  const rawBodyTemplates = getRawBodyTemplates(rawInput, defaultAdminDocument.bodyTemplates);
  const rawContacts = Array.isArray(rawProfile.contacts) ? rawProfile.contacts : [];
  const legacyAddressLines = Array.isArray(rawProfile.addressLines)
    ? rawProfile.addressLines.filter(function filterAddressLine(addressLine): addressLine is string {
        return typeof addressLine === 'string' && addressLine.trim().length > 0;
      })
    : [];
  const rawAddressValue = rawContacts.find(function findContact(contact) {
    return isRecord(contact) && contact.id === 'address';
  });
  const fallbackAddressValue = normalizeString((rawAddressValue as Partial<CoverLetterContactMethod> | undefined)?.value)
    || defaultAdminDocument.profile.contacts.find(function findContact(contact) {
      return contact.id === 'address';
    })?.value
    || '';
  const nextAddressLines = normalizeAddressLines(legacyAddressLines.length > 0 ? legacyAddressLines : getAddressLinesFromValue(fallbackAddressValue));
  const addressFallback = nextAddressLines.join('\n') || defaultAdminDocument.profile.contacts.find(function findContact(contact) {
    return contact.id === 'address';
  })?.value || '';
  const nextContacts = createDefaultContacts().map(function mapContact(defaultContact) {
    const rawContact = rawContacts.find(function findContact(contact) {
      return isRecord(contact) && contact.id === defaultContact.id;
    }) as Partial<CoverLetterContactMethod> | undefined;
    const nextValue = defaultContact.id === 'address'
      ? addressFallback
      : normalizeString(rawContact?.value) || defaultContact.value;
    const nextIncludeInSignature = typeof rawContact?.includeInSignature === 'boolean'
      ? rawContact.includeInSignature
      : defaultContact.includeInSignature;

    return buildContact(defaultContact.id, nextValue, nextIncludeInSignature);
  });
  const nextFooterAddressLines = getFooterAddressLines(nextAddressLines, nextContacts);
  const nextAdminDocument = {
    schemaVersion: coverLetterAdminDocumentSchemaVersion,
    profile: {
      name: normalizeString(rawProfile.name) || defaultAdminDocument.profile.name,
      logoAlt: normalizeString(rawProfile.logoAlt) || defaultAdminDocument.profile.logoAlt,
      addressLines: nextAddressLines,
      footerAddressLines: nextFooterAddressLines,
      contacts: nextContacts
    },
    defaults: {
      title: normalizeString(rawDefaults.title) || defaultAdminDocument.defaults.title,
      hiringManager: normalizeString(rawDefaults.hiringManager) || defaultAdminDocument.defaults.hiringManager,
      defaultBodyTemplateId: normalizeString(rawDefaults.defaultBodyTemplateId)
        || normalizeString(rawDefaults.defaultBodyVersionId)
        || defaultAdminDocument.defaults.defaultBodyTemplateId
    },
    bodyTemplates: rawBodyTemplates
  };

  return coverLetterAdminDocumentNormalizationSchema.parse(nextAdminDocument);
}

export function buildCoverLetter(
  request: CoverLetterRequest = coverLetterPreviewRequest,
  adminDocument: CoverLetterAdminDocument = createDefaultCoverLetterAdminDocument()
): ResolvedCoverLetter {
  const hiringManager = request.hiringManager || adminDocument.defaults.hiringManager;
  const salutation = request.salutation;
  const title = request.title || adminDocument.defaults.title;
  const bodyTemplate = getBodyTemplate(adminDocument, request.templateId);
  const templateValues = {
    hiringManager,
    title,
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
    bodyTemplate: {
      id: bodyTemplate.id,
      slug: bodyTemplate.slug,
      name: bodyTemplate.name
    },
    body: {
      greeting: salutation || resolveTemplate(bodyTemplate.greeting, templateValues),
      paragraphs: splitBodyIntoParagraphs(bodyTemplate.body).map(function mapParagraph(paragraph) {
        return resolveTemplate(paragraph, templateValues);
      }),
      signOff: resolveTemplate(bodyTemplate.signOff, templateValues)
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
      addressLines: getFooterAddressLines(adminDocument.profile.addressLines, adminDocument.profile.contacts),
      contacts: getOrderedContacts(adminDocument, 'footer')
    }
  };
}

function getBodyTemplate(
  adminDocument: CoverLetterAdminDocument,
  templateId?: string
): CoverLetterBodyTemplate {
  if (templateId) {
    return adminDocument.bodyTemplates.find(function findBodyTemplateById(bodyTemplate) {
      return bodyTemplate.id === templateId;
    }) || adminDocument.bodyTemplates[0];
  }

  return adminDocument.bodyTemplates.find(function findDefaultBodyTemplate(bodyTemplate) {
    return bodyTemplate.id === adminDocument.defaults.defaultBodyTemplateId;
  }) || adminDocument.bodyTemplates[0];
}

function getOrderedContacts(adminDocument: CoverLetterAdminDocument, location: 'signature' | 'footer'): CoverLetterContactMethod[] {
  const orderedContactIds = location === 'signature'
    ? [ 'website', 'linkedin', 'github', 'email', 'phone' ]
    : [ 'email', 'website', 'linkedin' ];

  return orderedContactIds.flatMap(function mapContactId(contactId) {
    const contact = adminDocument.profile.contacts.find(function findContact(candidateContact) {
      return candidateContact.id === contactId;
    });

    if (!contact) {
      return [];
    }

    if (location === 'signature' && !contact.includeInSignature) {
      return [];
    }

    return [ contact ];
  });
}

function createDefaultContacts() {
  return coverLetterDataModel.profile.contacts.map(function mapContact(contact) {
    return buildContact(contact.id, contact.value, contact.includeInSignature);
  });
}

function buildContact(
  id: CoverLetterContactMethod['id'],
  value: string,
  includeInSignature: boolean
): CoverLetterContactMethod {
  const normalizedValue = value.trim();

  switch (id) {
    case 'address':
      return {
        id,
        label: 'Address',
        value: normalizedValue,
        includeInSignature,
        includeInFooter: false
      };
    case 'email':
      return {
        id,
        label: 'Email',
        value: normalizedValue,
        href: normalizedValue ? `mailto:${normalizedValue}` : undefined,
        includeInSignature,
        includeInFooter: true,
        footerIcon: 'email'
      };
    case 'website':
      return {
        id,
        label: 'Website',
        value: normalizedValue,
        href: normalizedValue ? ensureUrl(normalizedValue) : undefined,
        includeInSignature,
        includeInFooter: true,
        footerIcon: 'link'
      };
    case 'linkedin':
      return {
        id,
        label: 'LinkedIn',
        value: normalizedValue,
        href: normalizedValue ? ensureUrl(normalizedValue) : undefined,
        includeInSignature,
        includeInFooter: true,
        footerIcon: 'linkedin'
      };
    case 'phone':
      return {
        id,
        label: 'Phone',
        value: normalizedValue,
        href: normalizedValue ? `tel:${normalizedValue.replace(/[^+\d]/g, '')}` : undefined,
        includeInSignature,
        includeInFooter: false
      };
    case 'github':
      return {
        id,
        label: 'GitHub',
        value: normalizedValue,
        href: normalizedValue ? ensureUrl(normalizedValue) : undefined,
        includeInSignature,
        includeInFooter: false,
        footerIcon: 'github'
      };
  }
}

function getFooterAddressLines(addressLines: string[], contacts: CoverLetterContactMethod[]) {
  const phoneValue = contacts.find(function findPhone(contact) {
    return contact.id === 'phone';
  })?.value || '';

  return [
    ...normalizeAddressLines(addressLines),
    phoneValue
  ].filter(Boolean);
}

function getAddressLinesFromValue(addressValue: string) {
  const normalizedAddressValue = addressValue
    .split('\n')
    .map(function mapAddressLine(addressLine) {
      return addressLine.trim().replace(/,$/, '');
    })
    .filter(Boolean);

  if (normalizedAddressValue.length > 1) {
    return normalizedAddressValue;
  }

  const singleLineAddress = normalizedAddressValue[0];

  if (!singleLineAddress) {
    return [];
  }

  const structuredAddressMatch = singleLineAddress.match(/^(.*?)(?:,\s+)([^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)$/);

  if (!structuredAddressMatch) {
    return [ singleLineAddress ];
  }

  const firstLine = structuredAddressMatch[1]?.trim().replace(/,$/, '');
  const secondLine = structuredAddressMatch[2]?.trim();

  return [ firstLine, secondLine ].filter(Boolean);
}

function normalizeAddressLines(addressLines: string[]) {
  const normalizedAddressLines = addressLines
    .map(function mapAddressLine(addressLine) {
      return addressLine.trim().replace(/,$/, '');
    })
    .filter(Boolean);

  if (normalizedAddressLines.length === 1) {
    return getAddressLinesFromValue(normalizedAddressLines[0]);
  }

  return normalizedAddressLines.slice(0, 2);
}

function ensureUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getRawBodyTemplates(
  rawInput: Record<string, unknown>,
  defaultBodyTemplates: CoverLetterBodyTemplate[]
) {
  if (Array.isArray(rawInput.bodyTemplates)) {
    return rawInput.bodyTemplates;
  }

  if (Array.isArray(rawInput.bodyVersions)) {
    return rawInput.bodyVersions;
  }

  return defaultBodyTemplates;
}

function parseUrlLike(value: string) {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function isValidEmailValue(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidWebsiteValue(value: string) {
  const url = parseUrlLike(value.trim());

  return Boolean(url?.hostname && url.hostname.includes('.'));
}

function isValidLinkedInProfileValue(value: string) {
  const url = parseUrlLike(value.trim());

  if (!url) {
    return false;
  }

  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  const pathname = url.pathname.replace(/\/+$/, '');

  if (hostname !== 'linkedin.com') {
    return false;
  }

  return pathname.startsWith('/in/') || pathname.startsWith('/pub/');
}

function isValidGitHubProfileValue(value: string) {
  const url = parseUrlLike(value.trim());

  if (!url) {
    return false;
  }

  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  const pathSegments = url.pathname.split('/').filter(Boolean);

  if (hostname !== 'github.com') {
    return false;
  }

  return pathSegments.length === 1;
}

function isValidPhoneValue(value: string) {
  const trimmedValue = value.trim();

  if (!/^\+?[\d\s().-]+$/.test(trimmedValue)) {
    return false;
  }

  const digits = trimmedValue.replace(/\D/g, '');

  return digits.length >= 7 && digits.length <= 15;
}

function resolveTemplate(template: string, values: CoverLetterTemplateValues): string {
  return template.replace(/\{\{(\w+)\}\}(\.)?/g, function replaceToken(_, token, trailingPeriod = '') {
    if (token === 'titlePlainText') {
      return resolveTemplateValue(values.title, trailingPeriod);
    }

    return resolveTemplateValue(values[token as keyof typeof values] || '', trailingPeriod);
  });
}

function resolveTemplateValue(value: string, trailingPeriod: string) {
  if (trailingPeriod && value.trimEnd().endsWith('.')) {
    return value;
  }

  return `${value}${trailingPeriod}`;
}

function normalizeCoverLetterRequest(input: unknown): Partial<CoverLetterRequest> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const normalizedRequest = Object.fromEntries(
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

  if (!normalizedRequest.templateId && 'versionId' in normalizedRequest) {
    normalizedRequest.templateId = (normalizedRequest as { versionId?: string }).versionId;
  }

  delete (normalizedRequest as { versionId?: string }).versionId;

  return normalizedRequest;
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
