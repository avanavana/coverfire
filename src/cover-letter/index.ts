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

interface CoverLetterBodyVersion {
  slug: string;
  name: string;
  greeting: string;
  paragraphs: string[];
  signOff: string;
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
      slug: 'standard',
      name: 'Standard',
      greeting: 'Dear {{hiringManager}},',
      paragraphs: [
        "I hope this message finds you well. I'm a {{titlePlainText}} with 15+ years of experience designing, building, and shipping production web and mobile applications, and I'm writing to express my interest in the {{role}} role at {{company}}.",
        "My career has spanned product strategy, UI/UX design, user research, design systems, front-end engineering, systems architecture, and team leadership. I specialize in distilling complex and embryonic ideas into refined products, brands, and user experiences. Having worked extensively across both design and engineering, I bring a developer's implementation expertise and systems thinking to design work, and a designer's sense of taste, discernment, craft, and user perspective to engineering.",
        'Most recently, as Design Lead at CO:CREATE, I led product design for a new universal mobile and web application, established a new brand identity and design system, and helped evolve that system to support emerging AI-native workflows through a formalized component architecture and implementation guidelines designed to reduce ambiguity and improve consistency across both human and agent-generated work.',
        "The rise of AI has only reinforced a belief I've held about building software: as generating product ideas, designs, and code becomes faster, cheaper, and more accessible, the value of discernment, judgment, systems thinking, and multidisciplinary expertise increases. The challenge is no longer generating possibilities—it is identifying the right opportunities, understanding tradeoffs, making better decisions, and synthesizing many moving parts into coherent products that serve both users and business goals. These are the very capabilities I've spent my career cultivating at the intersection of design, engineering, and systems thinking.",
        'I would welcome the opportunity to bring that perspective and experience to {{company}}. Thank you for your time and consideration, and I look forward to speaking with you.'
      ],
      signOff: 'Warm regards,'
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

export function getCoverLetterRequestOverrides(searchParams: URLSearchParams): Partial<CoverLetterRequest> {
  return normalizeCoverLetterRequest({
    hiringManager: searchParams.get('hiringManager') || undefined,
    title: searchParams.get('title') || undefined,
    role: searchParams.get('role') || undefined,
    company: searchParams.get('company') || undefined,
    bodyVersionSlug: searchParams.get('bodyVersionSlug') || undefined
  });
}

export function buildCoverLetter(request: CoverLetterRequest = coverLetterPreviewRequest): ResolvedCoverLetter {
  const hiringManager = request.hiringManager || coverLetterDataModel.defaults.hiringManager;
  const title = request.title || coverLetterDataModel.defaults.title;
  const bodyVersionSlug = request.bodyVersionSlug || coverLetterDataModel.defaults.bodyVersionSlug;
  const bodyVersion = getBodyVersion(bodyVersionSlug);
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
      paragraphs: bodyVersion.paragraphs.map(function mapParagraph(paragraph) {
        return resolveTemplate(paragraph, templateValues);
      }),
      signOff: resolveTemplate(bodyVersion.signOff, templateValues)
    },
    signature: {
      name: coverLetterDataModel.profile.name,
      title,
      contacts: getOrderedContacts('signature')
    },
    footer: {
      logoAlt: coverLetterDataModel.profile.logoAlt,
      name: coverLetterDataModel.profile.name,
      title,
      addressLines: coverLetterDataModel.profile.footerAddressLines,
      contacts: getOrderedContacts('footer')
    }
  };
}

function getBodyVersion(bodyVersionSlug: string): CoverLetterBodyVersion {
  return coverLetterDataModel.bodyVersions.find(function findBodyVersion(bodyVersion) {
    return bodyVersion.slug === bodyVersionSlug;
  }) || coverLetterDataModel.bodyVersions[0];
}

function getOrderedContacts(location: 'signature' | 'footer'): CoverLetterContactMethod[] {
  const orderedIds = location === 'signature'
    ? coverLetterDataModel.profile.signatureContactIds
    : coverLetterDataModel.profile.footerContactIds;

  return orderedIds.map(function mapContactId(contactId) {
    return coverLetterDataModel.profile.contacts.find(function findContact(contact) {
      return contact.id === contactId;
    });
  }).filter(function filterContact(contact): contact is CoverLetterContactMethod {
    if (!contact) {
      return false;
    }

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

function formatLetterDate(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York'
  });
}
