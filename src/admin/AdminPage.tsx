import {
  Fragment,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Check,
  CircleAlert,
  Copy,
  Download,
  Eye,
  LoaderCircle,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Drawer } from 'vaul';

import { BodyEditor } from '@/admin/rich-text';
import {
  AdminApiError,
  createBodyVersion,
  deleteBodyVersion,
  duplicateBodyVersion,
  fetchAdminDocument,
  generateAdminPdf,
  saveAdminDocument,
  setDefaultBodyVersion,
  updateBodyVersion,
} from '@/admin/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  buildCoverLetterSearchParams,
  getCoverLetterPreviewRequest,
  serializeCoverLetterAdminDocument,
} from '@/cover-letter';

import type { AdminBodyVersionInput } from '@/admin/api';
import type {
  CoverLetterAdminDocument,
  CoverLetterBodyVersion,
  CoverLetterContactMethod,
} from '@/cover-letter';

interface BodyVersionDraft extends AdminBodyVersionInput {
  id?: string;
}

interface GenerateFormState {
  company: string;
  hiringManager: string;
  role: string;
  salutation: string;
  title: string;
}

type DrawerTokenField = 'greeting' | 'body' | 'signOff';

interface DrawerSelectionState {
  end: number;
  field: DrawerTokenField;
  start: number;
}

const signatureFieldOrder: CoverLetterContactMethod['id'][] = [
  'website',
  'linkedin',
  'github',
  'email',
  'phone',
];
const footerFieldOrder: Array<'title' | CoverLetterContactMethod['id']> = [
  'title',
  'phone',
  'email',
  'website',
  'linkedin',
];
const drawerTemplateTokens = [
  'hiringManager',
  'title',
  'role',
  'company',
] as const;
const adminDocumentStorageKey = 'coverfire.admin-document';
const successToastIcon = <Check className="size-4" />;

export default function AdminPage() {
  const [adminDocument, setAdminDocument] =
    useState<CoverLetterAdminDocument | null>(null);
  const [persistedDocumentJson, setPersistedDocumentJson] = useState('');
  const [selectedBodyVersionId, setSelectedBodyVersionId] = useState('');
  const [drawerBodyVersion, setDrawerBodyVersion] =
    useState<BodyVersionDraft | null>(null);
  const [pendingDeleteBodyVersionId, setPendingDeleteBodyVersionId] =
    useState('');
  const [generateForm, setGenerateForm] = useState<GenerateFormState>(
    createInitialGenerateFormState,
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewingBodyVersion, setIsPreviewingBodyVersion] = useState(false);
  const [isRetryingAdminDocument, setIsRetryingAdminDocument] = useState(false);
  const [isSavingBodyVersion, setIsSavingBodyVersion] = useState(false);
  const [isSavingSignatureFields, setIsSavingSignatureFields] = useState(false);
  const [connectionWarning, setConnectionWarning] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [drawerSelection, setDrawerSelection] =
    useState<DrawerSelectionState | null>(null);
  const greetingInputRef = useRef<HTMLInputElement | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const signOffInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(true);
  const latestAdminDocumentRef = useRef<CoverLetterAdminDocument | null>(null);
  const latestDrawerBodyVersionRef = useRef<BodyVersionDraft | null>(null);
  const latestPersistedDocumentJsonRef = useRef('');

  const canRefreshAdminDocumentInPlace = useCallback(
    function canRefreshAdminDocumentInPlace() {
      const currentAdminDocument = latestAdminDocumentRef.current;

      if (!currentAdminDocument) {
        return true;
      }

      if (latestDrawerBodyVersionRef.current) {
        return false;
      }

      return (
        JSON.stringify(currentAdminDocument) ===
        latestPersistedDocumentJsonRef.current
      );
    },
    [],
  );

  const applyLoadedAdminDocument = useCallback(
    function applyLoadedAdminDocument(
      nextAdminDocument: CoverLetterAdminDocument,
    ) {
      persistAdminDocument(
        nextAdminDocument,
        setAdminDocument,
        setPersistedDocumentJson,
      );
      setSelectedBodyVersionId(
        function updateSelectedBodyVersionId(currentSelectedBodyVersionId) {
          if (
            currentSelectedBodyVersionId &&
            getBodyVersionById(nextAdminDocument, currentSelectedBodyVersionId)
          ) {
            return currentSelectedBodyVersionId;
          }

          return nextAdminDocument.defaults.defaultBodyVersionId;
        },
      );
      setGenerateForm(function updateCurrentGenerateForm(currentGenerateForm) {
        const nextHiringManager =
          currentGenerateForm.hiringManager ||
          nextAdminDocument.defaults.hiringManager;

        return {
          company: currentGenerateForm.company,
          hiringManager: nextHiringManager,
          role: currentGenerateForm.role,
          salutation: syncGenerateSalutation(
            currentGenerateForm.salutation,
            currentGenerateForm.hiringManager,
            nextHiringManager,
            nextAdminDocument.defaults.hiringManager,
          ),
          title: currentGenerateForm.title || nextAdminDocument.defaults.title,
        };
      });
    },
    [],
  );

  const loadAdminDocument = useCallback(
    async function loadAdminDocument(options: {
      allowCachedFallback: boolean;
      background: boolean;
    }) {
      if (options.background) {
        setIsRetryingAdminDocument(true);
      }

      try {
        const nextAdminDocument = await fetchAdminDocument();

        if (!isMountedRef.current) {
          return;
        }

        applyLoadedAdminDocument(nextAdminDocument);
        setConnectionWarning('');
        setErrorMessage('');
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        const currentAdminDocument = latestAdminDocumentRef.current;
        const cachedAdminDocument = options.allowCachedFallback
          ? readCachedAdminDocument()
          : null;

        if (!currentAdminDocument && cachedAdminDocument) {
          applyLoadedAdminDocument(cachedAdminDocument);
          setConnectionWarning(
            'The local API is temporarily unavailable. The page will retry when it reconnects.',
          );
          setErrorMessage('');
          return;
        }

        if (currentAdminDocument) {
          setConnectionWarning(
            'The local API is temporarily unavailable. Your last loaded admin state is still on screen.',
          );
          return;
        }

        setErrorMessage(getErrorMessage(error));
      } finally {
        if (isMountedRef.current) {
          if (!options.background) {
            setIsLoading(false);
          }

          if (options.background) {
            setIsRetryingAdminDocument(false);
          }
        }
      }
    },
    [applyLoadedAdminDocument],
  );

  useEffect(
    function syncLatestAdminDocumentRef() {
      latestAdminDocumentRef.current = adminDocument;
    },
    [adminDocument],
  );

  useEffect(
    function syncLatestDrawerBodyVersionRef() {
      latestDrawerBodyVersionRef.current = drawerBodyVersion;
    },
    [drawerBodyVersion],
  );

  useEffect(
    function syncLatestPersistedDocumentJsonRef() {
      latestPersistedDocumentJsonRef.current = persistedDocumentJson;
    },
    [persistedDocumentJson],
  );

  useEffect(function trackMountedState() {
    isMountedRef.current = true;

    return function cleanup() {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(
    function loadInitialAdminDocument() {
      const timeoutId = window.setTimeout(
        function beginInitialAdminDocumentLoad() {
          void loadAdminDocument({
            allowCachedFallback: true,
            background: false,
          });
        },
        0,
      );

      return function cleanup() {
        window.clearTimeout(timeoutId);
      };
    },
    [loadAdminDocument],
  );

  useEffect(
    function retryAdminDocumentWhenPageBecomesActive() {
      if (!connectionWarning) {
        return;
      }

      function handleWindowFocus() {
        if (!canRefreshAdminDocumentInPlace()) {
          return;
        }

        void loadAdminDocument({
          allowCachedFallback: false,
          background: true,
        });
      }

      function handleVisibilityChange() {
        if (document.visibilityState !== 'visible') {
          return;
        }

        handleWindowFocus();
      }

      window.addEventListener('focus', handleWindowFocus);
      window.addEventListener('online', handleWindowFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return function cleanup() {
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('online', handleWindowFocus);
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        );
      };
    },
    [canRefreshAdminDocumentInPlace, connectionWarning, loadAdminDocument],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <Card>
            <CardContent className="flex min-h-40 items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="animate-spin" />
                Loading admin state...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!adminDocument) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Unable to load admin state</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>
                {errorMessage || 'No admin document was returned by the API.'}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={isRetryingAdminDocument}
                onClick={function handleRetryInitialLoadClick() {
                  setErrorMessage('');
                  setIsLoading(true);
                  void loadAdminDocument({
                    allowCachedFallback: true,
                    background: false,
                  });
                }}
              >
                {isRetryingAdminDocument ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const selectedBodyVersion =
    getBodyVersionById(adminDocument, selectedBodyVersionId) ||
    getDefaultBodyVersion(adminDocument);
  const pendingDeleteBodyVersion = pendingDeleteBodyVersionId
    ? getBodyVersionById(adminDocument, pendingDeleteBodyVersionId)
    : null;
  const persistedDocument = parsePersistedDocument(persistedDocumentJson);
  const canReloadLatestAdminState =
    !drawerBodyVersion &&
    JSON.stringify(adminDocument) === persistedDocumentJson;
  const hasUnsavedSignatureFields =
    JSON.stringify({
      addressLines: adminDocument.profile.addressLines,
      contacts: adminDocument.profile.contacts,
      title: adminDocument.defaults.title,
    }) !==
    JSON.stringify({
      addressLines: persistedDocument?.profile.addressLines,
      contacts: persistedDocument?.profile.contacts,
      title: persistedDocument?.defaults.title,
    });
  const usedDrawerTokens = getUsedDrawerTokens(drawerBodyVersion);
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Coverfire Admin
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedSignatureFields ? (
              <Button
                variant="outline"
                disabled={isSavingSignatureFields}
                onClick={function handleSaveSignatureFieldsClick() {
                  void saveSignatureFields(adminDocument);
                }}
              >
                {isSavingSignatureFields ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Save
              </Button>
            ) : null}
            <Button
              onClick={function handleOpenGenerateDialog() {
                setErrorMessage('');
                setGenerateForm(
                  function updateGenerateForm(currentGenerateForm) {
                    const nextHiringManager =
                      currentGenerateForm.hiringManager ||
                      adminDocument.defaults.hiringManager;

                    return {
                      ...currentGenerateForm,
                      hiringManager: nextHiringManager,
                      salutation: syncGenerateSalutation(
                        currentGenerateForm.salutation,
                        currentGenerateForm.hiringManager,
                        nextHiringManager,
                        adminDocument.defaults.hiringManager,
                      ),
                      title:
                        currentGenerateForm.title ||
                        adminDocument.defaults.title,
                    };
                  },
                );
                setIsGenerateDialogOpen(true);
              }}
            >
              <Download data-icon="inline-start" />
              Generate PDF
            </Button>
          </div>
        </header>

        {connectionWarning ? (
          <Alert>
            <CircleAlert />
            <AlertTitle>Using cached admin state</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{connectionWarning}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={isRetryingAdminDocument || !canReloadLatestAdminState}
                onClick={function handleRetryAdminDocumentClick() {
                  if (!canReloadLatestAdminState) {
                    setErrorMessage(
                      'Save or close the current draft before reloading the latest admin state.',
                    );
                    return;
                  }

                  void loadAdminDocument({
                    allowCachedFallback: false,
                    background: true,
                  });
                }}
              >
                {isRetryingAdminDocument ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid flex-1 gap-6 pb-6 xl:min-h-0 xl:grid-cols-[minmax(0,1.35fr)_24rem]">
          <Card className="shadow-sm xl:min-h-0">
            <CardHeader>
              <CardTitle>Body Versions</CardTitle>
              <CardDescription>
                Select the body version you want to generate.
              </CardDescription>
              <CardAction>
                <Button
                  variant="outline"
                  onClick={function handleCreateBodyVersion() {
                    setErrorMessage('');
                    setDrawerBodyVersion(
                      createNewBodyVersionDraft(adminDocument),
                    );
                    setIsDrawerOpen(true);
                  }}
                >
                  <Plus data-icon="inline-start" />
                  New version
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <div className="grid gap-4 py-1 md:grid-cols-2">
                {adminDocument.bodyVersions.map(
                  function renderBodyVersion(bodyVersion) {
                    const isDefault =
                      bodyVersion.id ===
                      adminDocument.defaults.defaultBodyVersionId;
                    const isSelected = bodyVersion.id === selectedBodyVersionId;

                    return (
                      <Card
                        key={bodyVersion.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-muted/30',
                          isSelected && 'ring-2 ring-primary shadow-md',
                        )}
                        onClick={function handleSelectBodyVersion() {
                          setSelectedBodyVersionId(bodyVersion.id);
                        }}
                        onKeyDown={function handleBodyVersionKeyDown(event) {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedBodyVersionId(bodyVersion.id);
                          }
                        }}
                      >
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-lg border bg-muted">
                              <Checkbox
                                aria-label={`Select ${bodyVersion.name}`}
                                checked={isSelected}
                                onCheckedChange={function handleCheckedChange() {
                                  setSelectedBodyVersionId(bodyVersion.id);
                                }}
                                onClick={function handleCheckboxClick(event) {
                                  event.stopPropagation();
                                }}
                                onKeyDown={function handleCheckboxKeyDown(
                                  event,
                                ) {
                                  event.stopPropagation();
                                }}
                              />
                            </div>
                            <div className="grid gap-1">
                              <CardTitle>{bodyVersion.name}</CardTitle>
                              <CardDescription>
                                <InlineCode>{bodyVersion.slug}</InlineCode>
                              </CardDescription>
                            </div>
                          </div>
                          <CardAction className="flex items-center gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                aria-label={`Manage ${bodyVersion.name}`}
                                className={cn(
                                  buttonVariants({
                                    size: 'icon',
                                    variant: 'ghost',
                                  }),
                                  'text-muted-foreground',
                                )}
                                onClick={function handleTriggerClick(event) {
                                  event.stopPropagation();
                                }}
                              >
                                <MoreVertical />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onClick={function handleEditBodyVersion(
                                    event,
                                  ) {
                                    event.stopPropagation();
                                    setDrawerBodyVersion(
                                      createDraftFromBodyVersion(bodyVersion),
                                    );
                                    setIsDrawerOpen(true);
                                  }}
                                >
                                  <Pencil />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={function handlePreviewBodyVersionClick(
                                    event,
                                  ) {
                                    event.stopPropagation();
                                    void previewSavedBodyVersion(bodyVersion);
                                  }}
                                >
                                  <Eye />
                                  Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={function handleDuplicateBodyVersion(
                                    event,
                                  ) {
                                    event.stopPropagation();
                                    void handleDuplicate(
                                      adminDocument,
                                      bodyVersion.id,
                                    );
                                  }}
                                >
                                  <Copy />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={isDefault}
                                  onClick={function handleSetDefaultClick(
                                    event,
                                  ) {
                                    event.stopPropagation();
                                    void handleSetDefault(
                                      adminDocument,
                                      bodyVersion.id,
                                    );
                                  }}
                                >
                                  <Star />
                                  Set as default
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={function handleDeleteClick(event) {
                                    event.stopPropagation();
                                    setPendingDeleteBodyVersionId(
                                      bodyVersion.id,
                                    );
                                  }}
                                >
                                  <Trash2 />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                          <p className="text-sm text-muted-foreground">
                            {renderTemplatePreview(bodyVersion.greeting)}
                          </p>
                          <div className="line-clamp-8 text-sm">
                            {renderTemplatePreview(bodyVersion.body)}
                          </div>
                        </CardContent>
                        <CardFooter>
                          {isDefault ? (
                            <Badge>Default</Badge>
                          ) : (
                            <button
                              type="button"
                              className={cn(
                                badgeVariants({ variant: 'outline' }),
                                'cursor-pointer',
                              )}
                              onClick={function handleSetDefaultBadgeClick(
                                event,
                              ) {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleSetDefault(
                                  adminDocument,
                                  bodyVersion.id,
                                );
                              }}
                            >
                              Set as default
                            </button>
                          )}
                        </CardFooter>
                      </Card>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>

          <Accordion
            defaultValue={['signature']}
            multiple={false}
            className="flex w-full flex-col gap-6 self-start"
          >
            <AccordionItem
              value="signature"
              className="overflow-hidden rounded-xl border-0 bg-card text-card-foreground ring-1 ring-foreground/10 shadow-sm"
            >
              <AccordionTrigger className="px-4 py-4 hover:no-underline">
                <div className="grid gap-1">
                  <div className="text-base font-medium">Signature Fields</div>
                  <div className="text-sm text-muted-foreground">
                    Choose which items appear in the signature.
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div className="grid gap-2">
                      <Label htmlFor="signature-title">Title</Label>
                      <Input
                        id="signature-title"
                        value={adminDocument.defaults.title}
                        onChange={function handleTitleChange(event) {
                          updateDefaultTitle(event.target.value);
                        }}
                      />
                    </div>
                  </div>
                  {signatureFieldOrder.map(
                    function mapSignatureField(contactId) {
                      const contact = getContact(adminDocument, contactId);

                      if (!contact) {
                        return null;
                      }

                      const valueFieldId = `signature-${contact.id}-value`;
                      return (
                        <div
                          key={contact.id}
                          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                        >
                          <div className="grid gap-2">
                            <Label htmlFor={valueFieldId}>
                              {contact.label}
                            </Label>
                            <Input
                              id={valueFieldId}
                              value={contact.value}
                              onChange={function handleValueChange(event) {
                                updateContact(contact.id, {
                                  includeInSignature:
                                    contact.includeInSignature,
                                  value: event.target.value,
                                });
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-end pb-2 sm:pb-2">
                            <Checkbox
                              aria-label={`Include ${contact.label} in signature`}
                              checked={contact.includeInSignature}
                              onCheckedChange={function handleCheckedChange(
                                value,
                              ) {
                                updateContact(contact.id, {
                                  includeInSignature: Boolean(value),
                                  value: contact.value,
                                });
                              }}
                            />
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="footer"
              className="overflow-hidden rounded-xl border-0 bg-card text-card-foreground ring-1 ring-foreground/10 shadow-sm"
            >
              <AccordionTrigger className="px-4 py-4 hover:no-underline">
                <div className="grid gap-1">
                  <div className="text-base font-medium">Footer Fields</div>
                  <div className="text-sm text-muted-foreground">
                    Shared fields stay linked with the signature where
                    applicable.
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid gap-4">
                  {footerFieldOrder.map(function mapFooterField(fieldId) {
                    if (fieldId === 'title') {
                      return (
                        <div key={fieldId} className="grid gap-2">
                          <Label htmlFor="footer-title">Title</Label>
                          <Input
                            id="footer-title"
                            value={adminDocument.defaults.title}
                            onChange={function handleFooterTitleChange(event) {
                              updateDefaultTitle(event.target.value);
                            }}
                          />
                        </div>
                      );
                    }

                    if (fieldId === 'phone') {
                      const [addressLine1, addressLine2] =
                        getEditableAddressLines(adminDocument);

                      return (
                        <Fragment key="footer-address-fields">
                          <div className="grid gap-2">
                            <Label htmlFor="footer-address-line-1">
                              Address Line 1
                            </Label>
                            <Input
                              id="footer-address-line-1"
                              value={addressLine1}
                              onChange={function handleAddressLine1Change(
                                event,
                              ) {
                                updateAddressLines(0, event.target.value);
                              }}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="footer-address-line-2">
                              Address Line 2
                            </Label>
                            <Input
                              id="footer-address-line-2"
                              value={addressLine2}
                              onChange={function handleAddressLine2Change(
                                event,
                              ) {
                                updateAddressLines(1, event.target.value);
                              }}
                            />
                          </div>
                          {renderFooterContactField(fieldId)}
                        </Fragment>
                      );
                    }

                    return renderFooterContactField(fieldId);
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <Drawer.Root
        direction="right"
        open={isDrawerOpen}
        onOpenChange={function handleDrawerOpenChange(open) {
          setIsDrawerOpen(open);

          if (!open) {
            setDrawerBodyVersion(null);
          }
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Drawer.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l bg-background shadow-lg outline-none">
            <Drawer.Title className="sr-only">Edit body version</Drawer.Title>
            <Drawer.Description className="sr-only">
              Edit a single cover-letter body version.
            </Drawer.Description>
            {drawerBodyVersion ? (
              <>
                <div className="flex items-center justify-between gap-4 p-6">
                  <div className="grid gap-1">
                    <h2 className="text-lg font-semibold">
                      {drawerBodyVersion.id
                        ? 'Edit body version'
                        : 'Create body version'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Update the selected body version.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={function handleCancelDrawerClick() {
                        setIsDrawerOpen(false);
                        setDrawerBodyVersion(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isSavingBodyVersion}
                      onClick={function handleSaveBodyVersionClick() {
                        void saveBodyVersionDraft();
                      }}
                    >
                      {isSavingBodyVersion ? (
                        <LoaderCircle
                          className="animate-spin"
                          data-icon="inline-start"
                        />
                      ) : (
                        <Save data-icon="inline-start" />
                      )}
                      Save changes
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Preview letter"
                      disabled={isPreviewingBodyVersion}
                      onClick={function handlePreviewButtonClick() {
                        void previewBodyVersionDraft();
                      }}
                    >
                      {isPreviewingBodyVersion ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Eye />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto border-t p-6">
                  <div className="grid gap-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <LabeledField htmlFor="drawer-name" label="Name">
                        <Input
                          data-vaul-no-drag
                          id="drawer-name"
                          value={drawerBodyVersion.name}
                          onChange={function handleNameChange(event) {
                            updateDrawerBodyVersionField(
                              'name',
                              event.target.value,
                            );
                          }}
                        />
                      </LabeledField>
                      <LabeledField htmlFor="drawer-slug" label="Slug">
                        <Input
                          data-vaul-no-drag
                          id="drawer-slug"
                          value={drawerBodyVersion.slug}
                          onChange={function handleSlugChange(event) {
                            updateDrawerBodyVersionField(
                              'slug',
                              slugify(event.target.value),
                            );
                          }}
                        />
                      </LabeledField>
                    </div>
                    <div className="grid gap-3">
                      <div className="grid gap-1">
                        <p className="text-sm font-medium">Template tokens</p>
                        <p className="text-sm text-muted-foreground">
                          Click a token to insert it at the current cursor
                          position.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {drawerTemplateTokens.map(function mapToken(token) {
                          const isUsed = usedDrawerTokens.includes(token);

                          return (
                            <button
                              key={token}
                              type="button"
                              className={cn(
                                badgeVariants({
                                  variant: isUsed ? 'default' : 'outline',
                                }),
                                'cursor-pointer font-mono',
                              )}
                              onClick={function handleInsertTokenClick() {
                                insertDrawerToken(token);
                              }}
                            >
                              {`{{${token}}}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <LabeledField htmlFor="drawer-greeting" label="Greeting">
                      <Input
                        data-vaul-no-drag
                        id="drawer-greeting"
                        ref={greetingInputRef}
                        value={drawerBodyVersion.greeting}
                        onFocus={function handleGreetingFocus(event) {
                          captureDrawerSelection(
                            'greeting',
                            event.currentTarget,
                          );
                        }}
                        onChange={function handleGreetingChange(event) {
                          updateDrawerBodyVersionField(
                            'greeting',
                            event.target.value,
                          );
                        }}
                        onSelect={function handleGreetingSelect(event) {
                          captureDrawerSelection(
                            'greeting',
                            event.currentTarget,
                          );
                        }}
                      />
                    </LabeledField>
                    <div data-vaul-no-drag className="grid gap-2">
                      <Label>Body</Label>
                      <BodyEditor
                        textareaRef={bodyTextareaRef}
                        value={drawerBodyVersion.body}
                        onFocus={function handleBodyFocus() {
                          if (bodyTextareaRef.current) {
                            captureDrawerSelection(
                              'body',
                              bodyTextareaRef.current,
                            );
                          }
                        }}
                        onChange={function handleBodyChange(value) {
                          updateDrawerBodyVersionField('body', value);
                        }}
                        onSelect={function handleBodySelect(event) {
                          captureDrawerSelection('body', event.currentTarget);
                        }}
                      />
                    </div>
                    <LabeledField htmlFor="drawer-sign-off" label="Sign off">
                      <Input
                        data-vaul-no-drag
                        id="drawer-sign-off"
                        ref={signOffInputRef}
                        value={drawerBodyVersion.signOff}
                        onFocus={function handleSignOffFocus(event) {
                          captureDrawerSelection(
                            'signOff',
                            event.currentTarget,
                          );
                        }}
                        onChange={function handleSignOffChange(event) {
                          updateDrawerBodyVersionField(
                            'signOff',
                            event.target.value,
                          );
                        }}
                        onSelect={function handleSignOffSelect(event) {
                          captureDrawerSelection(
                            'signOff',
                            event.currentTarget,
                          );
                        }}
                      />
                    </LabeledField>
                  </div>
                </div>
              </>
            ) : null}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <Dialog
        open={isGenerateDialogOpen}
        onOpenChange={setIsGenerateDialogOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate PDF</DialogTitle>
            <DialogDescription>
              Fill in the recipient fields and generate a cover letter PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <LabeledField htmlFor="generate-role" label="Role">
              <Input
                id="generate-role"
                value={generateForm.role}
                onChange={function handleRoleChange(event) {
                  updateGenerateField('role', event.target.value);
                }}
              />
            </LabeledField>
            <LabeledField htmlFor="generate-company" label="Company">
              <Input
                id="generate-company"
                value={generateForm.company}
                onChange={function handleCompanyChange(event) {
                  updateGenerateField('company', event.target.value);
                }}
              />
            </LabeledField>
            <LabeledField
              htmlFor="generate-hiring-manager"
              label="Hiring manager"
            >
              <Input
                id="generate-hiring-manager"
                value={generateForm.hiringManager}
                onChange={function handleHiringManagerChange(event) {
                  updateGenerateField('hiringManager', event.target.value);
                }}
              />
            </LabeledField>
            {shouldShowGenerateSalutationField(
              generateForm.hiringManager,
              adminDocument.defaults.hiringManager,
            ) ? (
              <LabeledField htmlFor="generate-salutation" label="Salutation">
                <Input
                  id="generate-salutation"
                  value={generateForm.salutation}
                  onChange={function handleSalutationChange(event) {
                    updateGenerateField('salutation', event.target.value);
                  }}
                />
              </LabeledField>
            ) : null}
            <LabeledField htmlFor="generate-title" label="Title">
              <Input
                id="generate-title"
                value={generateForm.title}
                onChange={function handleTitleChange(event) {
                  updateGenerateField('title', event.target.value);
                }}
              />
            </LabeledField>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={function handleCloseGenerateDialog() {
                setIsGenerateDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={isGenerating}
              onClick={function handleGenerateButtonClick() {
                void handleGenerate();
              }}
            >
              {isGenerating ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Download data-icon="inline-start" />
              )}
              Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDeleteBodyVersion)}
        onOpenChange={function handleDeleteDialogOpenChange(open) {
          if (!open) {
            setPendingDeleteBodyVersionId('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete body version?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteBodyVersion
                ? `This will delete "${pendingDeleteBodyVersion.name}".`
                : 'This body version will be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={function handleConfirmDeleteClick() {
                if (pendingDeleteBodyVersion) {
                  void handleDelete(adminDocument, pendingDeleteBodyVersion.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  function updateDrawerBodyVersionField<K extends keyof BodyVersionDraft>(
    field: K,
    value: BodyVersionDraft[K],
  ) {
    setDrawerBodyVersion(
      function updateCurrentDrawerBodyVersion(currentDrawerBodyVersion) {
        if (!currentDrawerBodyVersion) {
          return currentDrawerBodyVersion;
        }

        return {
          ...currentDrawerBodyVersion,
          [field]: value,
        };
      },
    );
  }

  function captureDrawerSelection(
    field: DrawerTokenField,
    element: HTMLInputElement | HTMLTextAreaElement,
  ) {
    setDrawerSelection({
      end: element.selectionEnd ?? element.value.length,
      field,
      start: element.selectionStart ?? element.value.length,
    });
  }

  function insertDrawerToken(token: (typeof drawerTemplateTokens)[number]) {
    if (!drawerBodyVersion) {
      return;
    }

    const field = drawerSelection?.field || 'body';
    const tokenText = `{{${token}}}`;
    const currentValue = drawerBodyVersion[field];
    const selectionStart =
      drawerSelection?.field === field
        ? drawerSelection.start
        : currentValue.length;
    const selectionEnd =
      drawerSelection?.field === field
        ? drawerSelection.end
        : currentValue.length;
    const nextValue = [
      currentValue.slice(0, selectionStart),
      tokenText,
      currentValue.slice(selectionEnd),
    ].join('');
    const nextCaretPosition = selectionStart + tokenText.length;

    updateDrawerBodyVersionField(field, nextValue);
    setDrawerSelection({
      end: nextCaretPosition,
      field,
      start: nextCaretPosition,
    });

    window.requestAnimationFrame(function focusUpdatedField() {
      const target = getDrawerFieldElement(field);

      if (!target) {
        return;
      }

      target.focus();
      target.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  }

  function getDrawerFieldElement(field: DrawerTokenField) {
    switch (field) {
      case 'greeting':
        return greetingInputRef.current;
      case 'body':
        return bodyTextareaRef.current;
      case 'signOff':
        return signOffInputRef.current;
    }
  }

  function updateGenerateField<K extends keyof GenerateFormState>(
    field: K,
    value: GenerateFormState[K],
  ) {
    setGenerateForm(function updateCurrentGenerateForm(currentGenerateForm) {
      if (field === 'hiringManager') {
        return {
          ...currentGenerateForm,
          hiringManager: String(value),
          salutation: syncGenerateSalutation(
            currentGenerateForm.salutation,
            currentGenerateForm.hiringManager,
            String(value),
            adminDocument?.defaults.hiringManager || 'Hiring Manager',
          ),
        };
      }

      return {
        ...currentGenerateForm,
        [field]: value,
      };
    });
  }

  function updateDefaultTitle(value: string) {
    setAdminDocument(function updateCurrentAdminDocument(currentAdminDocument) {
      if (!currentAdminDocument) {
        return currentAdminDocument;
      }

      return {
        ...currentAdminDocument,
        defaults: {
          ...currentAdminDocument.defaults,
          title: value,
        },
      };
    });

    setGenerateForm(function updateCurrentGenerateForm(currentGenerateForm) {
      return {
        ...currentGenerateForm,
        title: value,
      };
    });
  }

  function updateContact(
    contactId: CoverLetterContactMethod['id'],
    input: {
      includeInSignature: boolean;
      value: string;
    },
  ) {
    setAdminDocument(function updateCurrentAdminDocument(currentAdminDocument) {
      if (!currentAdminDocument) {
        return currentAdminDocument;
      }

      return {
        ...currentAdminDocument,
        profile: {
          ...currentAdminDocument.profile,
          contacts: currentAdminDocument.profile.contacts.map(
            function mapContact(contact) {
              if (contact.id !== contactId) {
                return contact;
              }

              return {
                ...contact,
                includeInSignature: input.includeInSignature,
                value: input.value,
              };
            },
          ),
          footerAddressLines: buildFooterAddressLines(
            currentAdminDocument.profile.addressLines,
            contactId === 'phone'
              ? input.value
              : getContact(currentAdminDocument, 'phone')?.value || '',
          ),
        },
      };
    });
  }

  function updateAddressLines(lineIndex: 0 | 1, value: string) {
    setAdminDocument(function updateCurrentAdminDocument(currentAdminDocument) {
      if (!currentAdminDocument) {
        return currentAdminDocument;
      }

      const [currentAddressLine1, currentAddressLine2] =
        getEditableAddressLines(currentAdminDocument);
      const nextAddressLines = buildStoredAddressLines(
        lineIndex === 0 ? value : currentAddressLine1,
        lineIndex === 1 ? value : currentAddressLine2,
      );
      const phoneValue = getContact(currentAdminDocument, 'phone')?.value || '';

      return {
        ...currentAdminDocument,
        profile: {
          ...currentAdminDocument.profile,
          addressLines: nextAddressLines,
          footerAddressLines: buildFooterAddressLines(
            nextAddressLines,
            phoneValue,
          ),
          contacts: currentAdminDocument.profile.contacts.map(
            function mapContact(contact) {
              if (contact.id !== 'address') {
                return contact;
              }

              return {
                ...contact,
                value: nextAddressLines.join('\n'),
              };
            },
          ),
        },
      };
    });
  }

  function renderFooterContactField(fieldId: CoverLetterContactMethod['id']) {
    if (!adminDocument) {
      return null;
    }

    const contact = getContact(adminDocument, fieldId);

    if (!contact) {
      return null;
    }

    const valueFieldId = `footer-${contact.id}-value`;

    return (
      <div key={contact.id} className="grid gap-2">
        <Label htmlFor={valueFieldId}>{contact.label}</Label>
        <Input
          id={valueFieldId}
          value={contact.value}
          onChange={function handleFooterValueChange(event) {
            updateContact(contact.id, {
              includeInSignature: contact.includeInSignature,
              value: event.target.value,
            });
          }}
        />
      </div>
    );
  }

  async function saveSignatureFields(documentToSave: CoverLetterAdminDocument) {
    if (!documentToSave) {
      return;
    }

    const snapshotBeforeSave = getSignatureSettingsSnapshot(documentToSave);

    setErrorMessage('');
    setIsSavingSignatureFields(true);

    try {
      const savedAdminDocument = await saveAdminDocument(documentToSave);

      if (
        getSignatureSettingsSnapshot(latestAdminDocumentRef.current) ===
        snapshotBeforeSave
      ) {
        persistAdminDocument(
          savedAdminDocument,
          setAdminDocument,
          setPersistedDocumentJson,
        );
        setConnectionWarning('');
        toast('Signature and footer fields saved.', {
          icon: successToastIcon,
        });
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingSignatureFields(false);
    }
  }

  async function saveBodyVersionDraft() {
    if (!adminDocument || !drawerBodyVersion) {
      return;
    }

    setErrorMessage('');
    setIsSavingBodyVersion(true);

    try {
      const input = sanitizeBodyVersionDraft(drawerBodyVersion);
      const savedBodyVersion = drawerBodyVersion.id
        ? await updateBodyVersion(drawerBodyVersion.id, input)
        : await createBodyVersion(input);
      const nextAdminDocument = upsertBodyVersion(
        adminDocument,
        savedBodyVersion,
      );

      persistAdminDocument(
        nextAdminDocument,
        setAdminDocument,
        setPersistedDocumentJson,
      );
      setConnectionWarning('');
      setSelectedBodyVersionId(savedBodyVersion.id);
      setDrawerBodyVersion(null);
      setIsDrawerOpen(false);
      toast(
        drawerBodyVersion.id
          ? 'Body version updated.'
          : 'Body version created.',
        {
          icon: successToastIcon,
        },
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingBodyVersion(false);
    }
  }

  async function previewBodyVersionDraft() {
    if (!adminDocument || !drawerBodyVersion) {
      return;
    }

    const input = sanitizeBodyVersionDraft(drawerBodyVersion);
    const previewAdminDocument = buildPreviewAdminDocument(
      adminDocument,
      input,
      drawerBodyVersion.id,
    );
    const previewVersionId = drawerBodyVersion.id || 'preview-draft';
    const previewUrl = buildLetterPreviewUrl(
      previewAdminDocument,
      previewVersionId,
    );
    const previewWindow = window.open(previewUrl, '_blank');

    if (!previewWindow) {
      setErrorMessage('Unable to open a preview tab.');
      return;
    }

    setErrorMessage('');
    setIsPreviewingBodyVersion(true);

    try {
      toast('Preview opened in a new tab.', {
        icon: successToastIcon,
      });
    } finally {
      previewWindow.focus();
      setIsPreviewingBodyVersion(false);
    }
  }

  async function previewSavedBodyVersion(bodyVersion: CoverLetterBodyVersion) {
    if (!adminDocument) {
      return;
    }

    const previewUrl = buildLetterPreviewUrl(adminDocument, bodyVersion.id);
    const previewWindow = window.open(previewUrl, '_blank');

    if (!previewWindow) {
      setErrorMessage('Unable to open a preview tab.');
      return;
    }

    setErrorMessage('');

    try {
      toast('Preview opened in a new tab.', {
        icon: successToastIcon,
      });
      previewWindow.focus();
    } catch {
      setErrorMessage('Unable to open a preview tab.');
    }
  }

  async function handleDuplicate(
    currentAdminDocument: CoverLetterAdminDocument,
    bodyVersionId: string,
  ) {
    setErrorMessage('');

    try {
      const savedBodyVersion = await duplicateBodyVersion(bodyVersionId);
      const nextAdminDocument = upsertBodyVersion(
        currentAdminDocument,
        savedBodyVersion,
      );

      persistAdminDocument(
        nextAdminDocument,
        setAdminDocument,
        setPersistedDocumentJson,
      );
      setConnectionWarning('');
      setSelectedBodyVersionId(savedBodyVersion.id);
      toast('Body version duplicated.', {
        icon: successToastIcon,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleSetDefault(
    currentAdminDocument: CoverLetterAdminDocument,
    bodyVersionId: string,
  ) {
    setErrorMessage('');

    try {
      const savedBodyVersion = await setDefaultBodyVersion(bodyVersionId);
      const nextAdminDocument = {
        ...currentAdminDocument,
        defaults: {
          ...currentAdminDocument.defaults,
          defaultBodyVersionId: savedBodyVersion.id,
        },
        bodyVersions: currentAdminDocument.bodyVersions.map(
          function mapBodyVersion(bodyVersion) {
            return {
              ...bodyVersion,
              isDefault: bodyVersion.id === savedBodyVersion.id,
            };
          },
        ),
      };

      persistAdminDocument(
        nextAdminDocument,
        setAdminDocument,
        setPersistedDocumentJson,
      );
      setConnectionWarning('');
      setSelectedBodyVersionId(savedBodyVersion.id);
      toast('Default body version updated.', {
        icon: successToastIcon,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleDelete(
    currentAdminDocument: CoverLetterAdminDocument,
    bodyVersionId: string,
  ) {
    setErrorMessage('');

    try {
      await deleteBodyVersion(bodyVersionId);

      const remainingBodyVersions = currentAdminDocument.bodyVersions.filter(
        function filterBodyVersion(bodyVersion) {
          return bodyVersion.id !== bodyVersionId;
        },
      );
      const nextDefaultBodyVersionId =
        currentAdminDocument.defaults.defaultBodyVersionId === bodyVersionId
          ? remainingBodyVersions[0]?.id || ''
          : currentAdminDocument.defaults.defaultBodyVersionId;
      const nextAdminDocument = {
        ...currentAdminDocument,
        defaults: {
          ...currentAdminDocument.defaults,
          defaultBodyVersionId: nextDefaultBodyVersionId,
        },
        bodyVersions: remainingBodyVersions.map(
          function mapBodyVersion(bodyVersion) {
            return {
              ...bodyVersion,
              isDefault: bodyVersion.id === nextDefaultBodyVersionId,
            };
          },
        ),
      };

      persistAdminDocument(
        nextAdminDocument,
        setAdminDocument,
        setPersistedDocumentJson,
      );
      setConnectionWarning('');
      setPendingDeleteBodyVersionId('');
      setSelectedBodyVersionId(nextDefaultBodyVersionId);
      toast('Body version deleted.', {
        icon: successToastIcon,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleGenerate() {
    if (!adminDocument) {
      setErrorMessage('Admin document is unavailable.');
      return;
    }

    if (!selectedBodyVersion) {
      setErrorMessage('Select a body version first.');
      return;
    }

    if (!generateForm.role.trim() || !generateForm.company.trim()) {
      setErrorMessage('Role and company are required.');
      return;
    }

    setErrorMessage('');
    setIsGenerating(true);

    try {
      const pdf = await generateAdminPdf({
        versionId: selectedBodyVersion.id,
        company: generateForm.company,
        hiringManager: generateForm.hiringManager || undefined,
        role: generateForm.role,
        salutation: shouldShowGenerateSalutationField(
          generateForm.hiringManager,
          adminDocument.defaults.hiringManager,
        )
          ? generateForm.salutation || undefined
          : undefined,
        title: generateForm.title || undefined,
      });

      downloadBlob(
        pdf.blob,
        pdf.filename || buildFallbackFilename(selectedBodyVersion.slug),
      );
      setIsGenerateDialogOpen(false);
      toast(`Generated ${pdf.filename || 'cover letter PDF'}.`, {
        icon: successToastIcon,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }
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
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function InlineCode({ children }: { children: string }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8125rem] text-foreground">
      {children}
    </code>
  );
}

function persistAdminDocument(
  adminDocument: CoverLetterAdminDocument,
  setAdminDocument: Dispatch<SetStateAction<CoverLetterAdminDocument | null>>,
  setPersistedDocumentJson: Dispatch<SetStateAction<string>>,
) {
  writeCachedAdminDocument(adminDocument);
  setAdminDocument(adminDocument);
  setPersistedDocumentJson(JSON.stringify(adminDocument));
}

function readCachedAdminDocument() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const cachedAdminDocument = window.localStorage.getItem(
      adminDocumentStorageKey,
    );

    if (!cachedAdminDocument) {
      return null;
    }

    return JSON.parse(cachedAdminDocument) as CoverLetterAdminDocument;
  } catch {
    return null;
  }
}

function writeCachedAdminDocument(adminDocument: CoverLetterAdminDocument) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      adminDocumentStorageKey,
      JSON.stringify(adminDocument),
    );
  } catch {
    // Ignore storage write failures and keep the in-memory document as the source of truth.
  }
}

function parsePersistedDocument(persistedDocumentJson: string) {
  if (!persistedDocumentJson) {
    return null;
  }

  try {
    return JSON.parse(persistedDocumentJson) as CoverLetterAdminDocument;
  } catch {
    return null;
  }
}

function getDefaultBodyVersion(adminDocument: CoverLetterAdminDocument) {
  return (
    getBodyVersionById(
      adminDocument,
      adminDocument.defaults.defaultBodyVersionId,
    ) || adminDocument.bodyVersions[0]
  );
}

function getBodyVersionById(
  adminDocument: CoverLetterAdminDocument,
  bodyVersionId: string,
) {
  return (
    adminDocument.bodyVersions.find(function findBodyVersion(bodyVersion) {
      return bodyVersion.id === bodyVersionId;
    }) || null
  );
}

function getContact(
  adminDocument: CoverLetterAdminDocument,
  contactId: CoverLetterContactMethod['id'],
) {
  return (
    adminDocument.profile.contacts.find(function findContact(contact) {
      return contact.id === contactId;
    }) || null
  );
}

function getEditableAddressLines(adminDocument: CoverLetterAdminDocument) {
  return [
    adminDocument.profile.addressLines[0] || '',
    adminDocument.profile.addressLines[1] || '',
  ] as const;
}

function buildStoredAddressLines(addressLine1: string, addressLine2: string) {
  return [addressLine1.trim(), addressLine2.trim()].filter(Boolean);
}

function buildFooterAddressLines(addressLines: string[], phoneValue: string) {
  return [...addressLines, phoneValue.trim()].filter(Boolean);
}

function createDraftFromBodyVersion(
  bodyVersion: CoverLetterBodyVersion,
): BodyVersionDraft {
  return {
    body: bodyVersion.body,
    greeting: bodyVersion.greeting,
    id: bodyVersion.id,
    name: bodyVersion.name,
    signOff: bodyVersion.signOff,
    slug: bodyVersion.slug,
  };
}

function createNewBodyVersionDraft(
  adminDocument: CoverLetterAdminDocument,
): BodyVersionDraft {
  const nextIndex = adminDocument.bodyVersions.length + 1;
  const baseName = `Version ${nextIndex}`;

  return {
    body: '',
    greeting: 'Dear {{hiringManager}},',
    name: baseName,
    signOff: 'Warm regards,',
    slug: buildUniqueSlug(adminDocument.bodyVersions, slugify(baseName)),
  };
}

function sanitizeBodyVersionDraft(
  bodyVersionDraft: BodyVersionDraft,
): AdminBodyVersionInput {
  return {
    body: bodyVersionDraft.body.trim(),
    greeting: bodyVersionDraft.greeting.trim(),
    name: bodyVersionDraft.name.trim(),
    signOff: bodyVersionDraft.signOff.trim(),
    slug: slugify(bodyVersionDraft.slug),
  };
}

function upsertBodyVersion(
  adminDocument: CoverLetterAdminDocument,
  bodyVersion: CoverLetterBodyVersion,
): CoverLetterAdminDocument {
  const hasExistingBodyVersion = adminDocument.bodyVersions.some(
    function someBodyVersion(candidateBodyVersion) {
      return candidateBodyVersion.id === bodyVersion.id;
    },
  );
  const nextBodyVersions = hasExistingBodyVersion
    ? adminDocument.bodyVersions.map(
        function mapBodyVersion(candidateBodyVersion) {
          return candidateBodyVersion.id === bodyVersion.id
            ? bodyVersion
            : candidateBodyVersion;
        },
      )
    : [...adminDocument.bodyVersions, bodyVersion];

  return {
    ...adminDocument,
    bodyVersions: nextBodyVersions,
  };
}

function buildUniqueSlug(
  bodyVersions: CoverLetterBodyVersion[],
  baseSlug: string,
) {
  const normalizedBaseSlug = slugify(baseSlug) || 'version';
  const slugs = new Set(
    bodyVersions.map(function mapBodyVersion(bodyVersion) {
      return bodyVersion.slug;
    }),
  );

  if (!slugs.has(normalizedBaseSlug)) {
    return normalizedBaseSlug;
  }

  let counter = 2;

  while (slugs.has(`${normalizedBaseSlug}-${counter}`)) {
    counter += 1;
  }

  return `${normalizedBaseSlug}-${counter}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getErrorMessage(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}

function createInitialGenerateFormState(): GenerateFormState {
  return {
    company: '',
    hiringManager: '',
    role: '',
    salutation: '',
    title: '',
  };
}

function shouldShowGenerateSalutationField(
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

function syncGenerateSalutation(
  currentSalutation: string,
  previousHiringManager: string,
  nextHiringManager: string,
  defaultHiringManager: string,
) {
  if (
    !shouldShowGenerateSalutationField(nextHiringManager, defaultHiringManager)
  ) {
    return '';
  }

  const previousAutoSalutation = shouldShowGenerateSalutationField(
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

function buildFallbackFilename(bodyVersionSlug: string) {
  return `cover-letter-${bodyVersionSlug}.pdf`;
}

function buildLetterPreviewUrl(
  adminDocument: CoverLetterAdminDocument,
  versionId: string,
) {
  const previewRequest = getCoverLetterPreviewRequest({
    hiringManager: adminDocument.defaults.hiringManager,
    title: adminDocument.defaults.title,
    versionId,
  });
  const searchParams = buildCoverLetterSearchParams(previewRequest);

  searchParams.set(
    'adminDocument',
    serializeCoverLetterAdminDocument(adminDocument),
  );

  return `/admin/preview?${searchParams.toString()}`;
}

function buildPreviewAdminDocument(
  adminDocument: CoverLetterAdminDocument,
  input: AdminBodyVersionInput,
  existingBodyVersionId?: string,
) {
  const now = new Date().toISOString();
  const previewBodyVersion = {
    id: existingBodyVersionId || 'preview-draft',
    slug: input.slug,
    name: input.name,
    greeting: input.greeting,
    body: input.body,
    signOff: input.signOff,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  const existingBodyVersion = adminDocument.bodyVersions.find(
    function findBodyVersion(bodyVersion) {
      return bodyVersion.id === previewBodyVersion.id;
    },
  );

  return {
    ...adminDocument,
    bodyVersions: existingBodyVersion
      ? adminDocument.bodyVersions.map(function mapBodyVersion(bodyVersion) {
          return bodyVersion.id === previewBodyVersion.id
            ? previewBodyVersion
            : bodyVersion;
        })
      : [ ...adminDocument.bodyVersions, previewBodyVersion ],
  };
}

function renderTemplatePreview(value: string) {
  return value.split('\n').map(function mapLine(line, lineIndex, lines) {
    return (
      <span key={`${lineIndex}-${line}`} className="contents">
        {line
          .split(/(\{\{\w+\}\})/g)
          .filter(Boolean)
          .map(function mapSegment(segment, segmentIndex) {
            return isTemplateVariable(segment) ? (
              <InlineCode key={`${lineIndex}-${segmentIndex}`}>
                {segment}
              </InlineCode>
            ) : (
              <span key={`${lineIndex}-${segmentIndex}`}>{segment}</span>
            );
          })}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

function isTemplateVariable(value: string) {
  return /^\{\{\w+\}\}$/.test(value);
}

function getUsedDrawerTokens(drawerBodyVersion: BodyVersionDraft | null) {
  if (!drawerBodyVersion) {
    return [] as Array<(typeof drawerTemplateTokens)[number]>;
  }

  const content = [
    drawerBodyVersion.greeting,
    drawerBodyVersion.body,
    drawerBodyVersion.signOff,
  ].join('\n');

  return drawerTemplateTokens.filter(function filterToken(token) {
    return content.includes(`{{${token}}}`);
  });
}

function getSignatureSettingsSnapshot(
  adminDocument: CoverLetterAdminDocument | null,
) {
  if (!adminDocument) {
    return '';
  }

  return JSON.stringify({
    addressLines: adminDocument.profile.addressLines,
    contacts: adminDocument.profile.contacts,
    title: adminDocument.defaults.title,
  });
}
