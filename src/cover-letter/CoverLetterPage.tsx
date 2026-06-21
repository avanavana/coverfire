import {
  Fragment,
  type ReactNode,
  useEffect,
  useState,
} from 'react';

import { ArrowLeft, Check, ClipboardType, FileText, LoaderCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer } from 'vaul';

import logo from '@/assets/logo.svg';
import { generateAdminPdf, generateAdminText } from '@/admin/api';
import { buttonVariants, Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Email, GitHub, Link, LinkedIn } from '@/components/icons';
import { copyTextToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import {
  buildCoverLetter,
  buildCoverLetterSearchParams,
  createDefaultCoverLetterAdminDocument,
  getCoverLetterAdminDocumentOverride,
  getCoverLetterGenerationValidationMessage,
  getCoverLetterRequestOverrides,
  serializeCoverLetterAdminDocument,
} from '@/cover-letter';

import type { AdminBodyTemplateInput } from '@/admin/api';
import type {
  CoverLetterAdminDocument,
  CoverLetterBodyTemplate,
  CoverLetterContactMethod,
  CoverLetterRequest,
} from '@/cover-letter';

interface PreviewContext {
  adminDocument: CoverLetterAdminDocument;
  previewRequest: CoverLetterRequest;
}

interface PreviewGenerateFormState {
  company: string;
  hiringManager: string;
  role: string;
  salutation: string;
  title: string;
  templateId: string;
}

const footerIconByKey = {
  email: Email,
  link: Link,
  linkedin: LinkedIn,
  github: GitHub,
} as const;
const successToastIcon = <Check className="size-4" />;

function getInitialPreviewContext(): PreviewContext {
  const searchParams = new URLSearchParams(window.location.search);
  const adminDocument =
    getCoverLetterAdminDocumentOverride(searchParams) ||
    createDefaultCoverLetterAdminDocument();
  const previewRequestOverrides = getCoverLetterRequestOverrides(searchParams);
  const previewRequest = {
    company: previewRequestOverrides.company || '',
    hiringManager: previewRequestOverrides.hiringManager,
    role: previewRequestOverrides.role || '',
    salutation: previewRequestOverrides.salutation,
    templateId: previewRequestOverrides.templateId,
    title: previewRequestOverrides.title,
  };

  return {
    adminDocument,
    previewRequest,
  };
}

function getRenderMode() {
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get('mode');

  return mode === 'preview' ? 'preview' : 'print';
}

function isEmbeddedAdminPreview() {
  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get('previewHost') === 'admin-overlay';
}

function renderRoleWithAmpersandBreak(role: string) {
  const roleLines = role.split(/\s+(?=&)/);

  if (roleLines.length === 1) {
    return role;
  }

  return (
    <>
      {roleLines.map(function mapRoleLine(roleLine, index) {
        return (
          <Fragment key={`${roleLine}-${index}`}>
            {index > 0 ? <br /> : null}
            {roleLine}
          </Fragment>
        );
      })}
    </>
  );
}

export default function CoverLetterPage() {
  const renderMode = getRenderMode();
  const isPreviewMode = renderMode === 'preview';
  const isEmbeddedPreview = isEmbeddedAdminPreview();
  const [initialPreviewContext] = useState(getInitialPreviewContext);
  const [isGenerateDrawerOpen, setIsGenerateDrawerOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [previewGenerateForm, setPreviewGenerateForm] =
    useState<PreviewGenerateFormState>(function createInitialPreviewGenerateForm() {
      return createPreviewGenerateFormState(
        initialPreviewContext.adminDocument,
        initialPreviewContext.previewRequest,
      );
    });
  const adminDocument = initialPreviewContext.adminDocument;
  const selectedBodyTemplate =
    getBodyTemplateById(adminDocument, previewGenerateForm.templateId) ||
    getDefaultBodyTemplate(adminDocument);
  const resolvedPreviewRequest = buildPreviewRequest(
    previewGenerateForm,
    adminDocument,
  );
  const previewCoverLetter = buildCoverLetter(
    resolvedPreviewRequest,
    adminDocument,
  );
  const footerPhoneContact = adminDocument.profile.contacts.find(
    function findFooterPhoneContact(contact) {
      return contact.id === 'phone';
    },
  );
  const renderableBodyParagraphs = previewCoverLetter.body.paragraphs.filter(
    isRenderableBodyParagraph,
  );
  const shouldShowSalutationField = shouldShowPreviewSalutationField(
    previewGenerateForm.hiringManager,
    adminDocument.defaults.hiringManager,
  );

  function closePreviewMode() {
    if (!isEmbeddedPreview) {
      window.location.href = '/admin';
      return;
    }

    window.parent.postMessage(
      'coverfire:close-preview',
      window.location.origin,
    );
  }

  useEffect(
    function syncPreviewUrl() {
      if (!isPreviewMode) {
        return;
      }

      const searchParams = buildCoverLetterSearchParams(resolvedPreviewRequest);

      searchParams.set(
        'adminDocument',
        serializeCoverLetterAdminDocument(adminDocument),
      );
      searchParams.set('mode', 'preview');

      if (isEmbeddedPreview) {
        searchParams.set('previewHost', 'admin-overlay');
      }

      window.history.replaceState(null, '', `/letter?${searchParams.toString()}`);
    },
    [adminDocument, isEmbeddedPreview, isPreviewMode, resolvedPreviewRequest],
  );

  useEffect(
    function bindPreviewEscapeKey() {
      if (!isPreviewMode) {
        return;
      }

      function handleWindowKeyDown(event: KeyboardEvent) {
        if (event.key !== 'Escape' || event.defaultPrevented) {
          return;
        }

        event.preventDefault();

        if (isGenerateDrawerOpen) {
          setIsGenerateDrawerOpen(false);
          return;
        }

        if (!isEmbeddedPreview) {
          window.location.href = '/admin';
          return;
        }

        window.parent.postMessage(
          'coverfire:close-preview',
          window.location.origin,
        );
      }

      window.addEventListener('keydown', handleWindowKeyDown);

      return function cleanupWindowKeyDownListener() {
        window.removeEventListener('keydown', handleWindowKeyDown);
      };
    },
    [isEmbeddedPreview, isGenerateDrawerOpen, isPreviewMode],
  );

  async function handleGeneratePdf() {
    const validationMessage =
      getCoverLetterGenerationValidationMessage(resolvedPreviewRequest);

    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const pdf = await generateAdminPdf(resolvedPreviewRequest, {
        method: 'admin-preview',
        previewBodyTemplate: selectedBodyTemplate
          ? getPreviewBodyTemplateInput(selectedBodyTemplate)
          : undefined,
        previewBodyTemplateId: selectedBodyTemplate?.id,
      });

      downloadBlob(
        pdf.blob,
        pdf.filename || buildFallbackFilename(selectedBodyTemplate?.slug),
      );
      toast(`Generated ${pdf.filename || 'cover letter PDF'}.`, {
        icon: successToastIcon,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  async function handleGenerateText() {
    const validationMessage =
      getCoverLetterGenerationValidationMessage(resolvedPreviewRequest);

    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setIsGeneratingText(true);

    try {
      const result = await generateAdminText(resolvedPreviewRequest, {
        method: 'admin-preview',
        previewBodyTemplate: selectedBodyTemplate
          ? getPreviewBodyTemplateInput(selectedBodyTemplate)
          : undefined,
        previewBodyTemplateId: selectedBodyTemplate?.id,
      });

      await copyTextToClipboard(result.text);
      toast('Copied cover letter text to the clipboard.', {
        icon: successToastIcon,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsGeneratingText(false);
    }
  }

  function updatePreviewGenerateFormField(
    field: keyof PreviewGenerateFormState,
    value: string,
  ) {
    setPreviewGenerateForm(function updateCurrentPreviewGenerateForm(
      currentPreviewGenerateForm,
    ) {
      if (field === 'hiringManager') {
        return {
          ...currentPreviewGenerateForm,
          hiringManager: value,
          salutation: syncPreviewSalutation(
            currentPreviewGenerateForm.salutation,
            currentPreviewGenerateForm.hiringManager,
            value,
            adminDocument.defaults.hiringManager,
          ),
        };
      }

      return {
        ...currentPreviewGenerateForm,
        [field]: value,
      };
    });
  }

  return (
    <div className={cn('cover-letter-root', isPreviewMode && 'preview-shell')}>
      {isPreviewMode ? (
        <>
          <a
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'preview-back-button',
            )}
            href="/admin"
            onClick={function handleBackToAdminClick(event) {
              if (!isEmbeddedPreview) {
                return;
              }

              event.preventDefault();
              closePreviewMode();
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            Back to admin
          </a>
          <div className="preview-actions">
            <Button
              onClick={function handleOpenGenerateDrawer() {
                setIsGenerateDrawerOpen(true);
              }}
            >
              <FileText data-icon="inline-start" />
              Generate
            </Button>
            <Button
              aria-label="Back to admin"
              variant="outline"
              size="icon"
              onClick={function handleClosePreviewClick() {
                closePreviewMode();
              }}
            >
              <X />
            </Button>
          </div>
          <Drawer.Root
            direction="right"
            open={isGenerateDrawerOpen}
            onOpenChange={setIsGenerateDrawerOpen}
          >
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-40 bg-black/20" />
              <Drawer.Content
                className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-lg outline-none"
              >
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <Drawer.Title className="text-2xl leading-tight font-semibold tracking-tight">
                      Generate cover letter
                    </Drawer.Title>
                    <Drawer.Description className="text-sm text-muted-foreground">
                      Update the live preview, then generate a PDF or copy plain text.
                    </Drawer.Description>
                  </div>
                </div>
                <div
                  data-vaul-no-drag
                  className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5"
                >
                  <LabeledField htmlFor="preview-body-template" label="Body Template">
                    <Input
                      data-vaul-no-drag
                      disabled
                      id="preview-body-template"
                      value={selectedBodyTemplate?.name || ''}
                    />
                  </LabeledField>
                  <LabeledField
                    htmlFor="preview-hiring-manager"
                    label="Hiring Manager"
                  >
                    <Input
                      data-vaul-no-drag
                      id="preview-hiring-manager"
                      value={previewGenerateForm.hiringManager}
                      onChange={function handleHiringManagerChange(event) {
                        updatePreviewGenerateFormField(
                          'hiringManager',
                          event.target.value,
                        );
                      }}
                    />
                  </LabeledField>
                  {shouldShowSalutationField ? (
                    <LabeledField
                      htmlFor="preview-salutation"
                      label="Salutation"
                    >
                      <Input
                        data-vaul-no-drag
                        id="preview-salutation"
                        value={previewGenerateForm.salutation}
                        onChange={function handleSalutationChange(event) {
                          updatePreviewGenerateFormField(
                            'salutation',
                            event.target.value,
                          );
                        }}
                      />
                    </LabeledField>
                  ) : null}
                  <LabeledField htmlFor="preview-title" label="Title">
                    <Input
                      data-vaul-no-drag
                      id="preview-title"
                      value={previewGenerateForm.title}
                      onChange={function handleTitleChange(event) {
                        updatePreviewGenerateFormField(
                          'title',
                          event.target.value,
                        );
                      }}
                    />
                  </LabeledField>
                  <LabeledField htmlFor="preview-role" label="Role">
                    <Input
                      autoComplete="off"
                      data-vaul-no-drag
                      id="preview-role"
                      name="coverfire-preview-role"
                      value={previewGenerateForm.role}
                      onChange={function handleRoleChange(event) {
                        updatePreviewGenerateFormField(
                          'role',
                          event.target.value,
                        );
                      }}
                    />
                  </LabeledField>
                  <LabeledField htmlFor="preview-company" label="Company">
                    <Input
                      autoComplete="off"
                      data-vaul-no-drag
                      id="preview-company"
                      name="coverfire-preview-company"
                      value={previewGenerateForm.company}
                      onChange={function handleCompanyChange(event) {
                        updatePreviewGenerateFormField(
                          'company',
                          event.target.value,
                        );
                      }}
                    />
                  </LabeledField>
                </div>
                <div data-vaul-no-drag className="grid gap-2 border-t px-6 py-4">
                  <Button
                    className="w-full"
                    disabled={isGeneratingPdf || isGeneratingText}
                    onClick={function handleGeneratePdfClick() {
                      void handleGeneratePdf();
                    }}
                  >
                    {isGeneratingPdf ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <FileText data-icon="inline-start" />
                    )}
                    Generate PDF
                  </Button>
                  <Button
                    className="w-full"
                    disabled={isGeneratingPdf || isGeneratingText}
                    variant="outline"
                    onClick={function handleGenerateTextClick() {
                      void handleGenerateText();
                    }}
                  >
                    {isGeneratingText ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <ClipboardType data-icon="inline-start" />
                    )}
                    Generate text
                  </Button>
                  <Button
                    className="w-full"
                    disabled={isGeneratingPdf || isGeneratingText}
                    variant="outline"
                    onClick={function handleCancelGenerateClick() {
                      setIsGenerateDrawerOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </>
      ) : null}
      <div id="page" className="page gap-[0.25in]">
        <main className="flex grow flex-col">
          <section id="date">
            <span>
              <strong>{previewCoverLetter.date}</strong>
            </span>
          </section>
          <section
            id="address"
            className="flex grow flex-col justify-center max-h-(--recipient-block-max-height)"
          >
            <p>
              <strong>{previewCoverLetter.recipient.hiringManager}</strong>
            </p>
            <p>Re: {previewCoverLetter.recipient.role}</p>
            <p>{previewCoverLetter.recipient.company}</p>
          </section>
          <section id="greeting">
            <p>{previewCoverLetter.body.greeting}</p>
          </section>
          {renderableBodyParagraphs.length > 0 ? (
            <section id="body" className="flex flex-col gap-[10pt] mt-[15pt]">
              {renderableBodyParagraphs.map(function renderParagraph(paragraph) {
                return <p key={paragraph}>{paragraph}</p>;
              })}
            </section>
          ) : null}
          <section id="closing" className="mt-[15pt]">
            <p>{previewCoverLetter.body.signOff}</p>
          </section>
          <section id="signature" className="mt-[15pt]">
            <p>
              <strong>{previewCoverLetter.signature.name}</strong>
            </p>
            <p>{previewCoverLetter.signature.title}</p>
            {previewCoverLetter.signature.contacts.map(
              function renderSignatureContact(contact) {
                return (
                  <p key={contact.id}>
                    <ContactLink contact={contact} />
                  </p>
                );
              },
            )}
          </section>
        </main>
        <footer className="flex h-[1.774in] items-center justify-between border-t border-border text-[9pt] leading-[10.8pt] text-footer">
          <img
            src={logo}
            alt={previewCoverLetter.footer.logoAlt}
            className="h-[0.3854in] w-auto shrink-0"
          />
          <section className="footer-details">
            <div className="footer-column">
              <p>
                <strong>{previewCoverLetter.footer.name}</strong>
              </p>
              <p>{renderRoleWithAmpersandBreak(previewCoverLetter.footer.title)}</p>
            </div>
            <div className="footer-divider" aria-hidden="true" />
            <div className="footer-column">
              {previewCoverLetter.footer.addressLines.map(
                function renderAddressLine(addressLine) {
                  const contact =
                    footerPhoneContact?.value === addressLine
                      ? footerPhoneContact
                      : null;

                  return (
                    <p key={addressLine}>
                      {contact ? (
                        <ContactLink contact={contact} />
                      ) : (
                        addressLine
                      )}
                    </p>
                  );
                },
              )}
            </div>
            <div className="footer-divider" aria-hidden="true" />
            <div className="footer-column flex flex-col">
              {previewCoverLetter.footer.contacts.map(function renderFooterContact(
                contact,
              ) {
                const Icon = contact.footerIcon
                  ? footerIconByKey[contact.footerIcon]
                  : null;

                return (
                  <a
                    key={contact.id}
                    className="inline-flex items-center gap-[0.054in] text-inherit no-underline"
                    href={contact.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {Icon ? (
                      <span className="inline-block text-icon">
                        <Icon size={12} />
                      </span>
                    ) : null}
                    {contact.value}
                  </a>
                );
              })}
            </div>
          </section>
        </footer>
      </div>
    </div>
  );
}

function LabeledField({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor?: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function isRenderableBodyParagraph(paragraph: string) {
  return paragraph.replace(/\u200B/g, '').trim().length > 0;
}

function ContactLink({ contact }: { contact: CoverLetterContactMethod }) {
  if (!contact.href) {
    return contact.value;
  }

  return (
    <a
      className="inline-block text-inherit no-underline"
      href={contact.href}
      rel="noreferrer"
      target="_blank"
    >
      {contact.value}
    </a>
  );
}

function createPreviewGenerateFormState(
  adminDocument: CoverLetterAdminDocument,
  previewRequest: CoverLetterRequest,
): PreviewGenerateFormState {
  const selectedBodyTemplate =
    getBodyTemplateById(adminDocument, previewRequest.templateId) ||
    getDefaultBodyTemplate(adminDocument);
  const hiringManager =
    previewRequest.hiringManager || adminDocument.defaults.hiringManager;
  const title = previewRequest.title || adminDocument.defaults.title;

  return {
    company: previewRequest.company,
    hiringManager,
    role: previewRequest.role,
    salutation:
      previewRequest.salutation ||
      (shouldShowPreviewSalutationField(
        hiringManager,
        adminDocument.defaults.hiringManager,
      )
        ? buildDefaultSalutation(hiringManager)
        : ''),
    title,
    templateId: selectedBodyTemplate.id,
  };
}

function buildPreviewRequest(
  previewGenerateForm: PreviewGenerateFormState,
  adminDocument: CoverLetterAdminDocument,
): CoverLetterRequest {
  return {
    company: previewGenerateForm.company,
    hiringManager: previewGenerateForm.hiringManager || undefined,
    role: previewGenerateForm.role,
    salutation: shouldShowPreviewSalutationField(
      previewGenerateForm.hiringManager,
      adminDocument.defaults.hiringManager,
    )
      ? previewGenerateForm.salutation || undefined
      : undefined,
    title: previewGenerateForm.title || undefined,
    templateId: previewGenerateForm.templateId,
  };
}

function getBodyTemplateById(
  adminDocument: CoverLetterAdminDocument,
  bodyTemplateId?: string,
) {
  if (!bodyTemplateId) {
    return null;
  }

  return (
    adminDocument.bodyTemplates.find(function findBodyTemplate(bodyTemplate) {
      return bodyTemplate.id === bodyTemplateId;
    }) || null
  );
}

function getDefaultBodyTemplate(adminDocument: CoverLetterAdminDocument) {
  return (
    getBodyTemplateById(
      adminDocument,
      adminDocument.defaults.defaultBodyTemplateId,
    ) || adminDocument.bodyTemplates[0]
  );
}

function shouldShowPreviewSalutationField(
  hiringManager: string,
  defaultHiringManager: string,
) {
  const normalizedHiringManager = hiringManager.trim();

  if (!normalizedHiringManager) {
    return false;
  }

  return normalizedHiringManager !== defaultHiringManager.trim();
}

function buildDefaultSalutation(hiringManager: string) {
  return `Dear ${hiringManager.trim()},`;
}

function syncPreviewSalutation(
  currentSalutation: string,
  previousHiringManager: string,
  nextHiringManager: string,
  defaultHiringManager: string,
) {
  if (
    !shouldShowPreviewSalutationField(nextHiringManager, defaultHiringManager)
  ) {
    return '';
  }

  const previousAutoSalutation = shouldShowPreviewSalutationField(
    previousHiringManager,
    defaultHiringManager,
  )
    ? buildDefaultSalutation(previousHiringManager)
    : '';
  const nextAutoSalutation = buildDefaultSalutation(nextHiringManager);

  if (!currentSalutation || currentSalutation === previousAutoSalutation) {
    return nextAutoSalutation;
  }

  return currentSalutation;
}

function getPreviewBodyTemplateInput(
  bodyTemplate: CoverLetterBodyTemplate,
): AdminBodyTemplateInput {
  return {
    body: bodyTemplate.body,
    greeting: bodyTemplate.greeting,
    name: bodyTemplate.name,
    signOff: bodyTemplate.signOff,
    slug: bodyTemplate.slug,
  };
}

function buildFallbackFilename(bodyTemplateSlug?: string) {
  return `cover-letter-${bodyTemplateSlug || 'preview'}.pdf`;
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(function revokeObjectUrl() {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}
