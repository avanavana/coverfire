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
  ClipboardType,
  Copy,
  Eye,
  FileText,
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

import { AdminLogsTable } from '@/admin/AdminLogsTable';
import { BodyEditor } from '@/admin/rich-text';
import {
  AdminApiError,
  createBodyTemplate,
  deleteBodyTemplate,
  duplicateBodyTemplate,
  fetchAdminDocument,
  fetchCoverLetterGenerationLogs,
  generateAdminPdf,
  generateAdminText,
  saveAdminDocument,
  setDefaultBodyTemplate,
  updateBodyTemplate,
} from '@/admin/api';
import { buildCoverLetterPreviewUrl } from '@/admin/preview-url';
import { type CoverLetterGenerationLogSummary } from '@/admin/generation-logs';
import FireAnimation from '@/components/fire-animation';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { copyTextToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import { getCoverLetterGenerationValidationMessage } from '@/cover-letter';

import type { AdminBodyTemplateInput } from '@/admin/api';
import type {
  CoverLetterAdminDocument,
  CoverLetterBodyTemplate,
  CoverLetterContactMethod,
} from '@/cover-letter';

interface BodyTemplateDraft extends AdminBodyTemplateInput {
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
  const [selectedBodyTemplateId, setSelectedBodyTemplateId] = useState('');
  const [drawerBodyTemplate, setDrawerBodyTemplate] =
    useState<BodyTemplateDraft | null>(null);
  const [pendingDeleteBodyTemplateId, setPendingDeleteBodyTemplateId] =
    useState('');
  const [bodyTemplatePreviewUrl, setBodyTemplatePreviewUrl] = useState('');
  const [generationLogs, setGenerationLogs] = useState<
    CoverLetterGenerationLogSummary[]
  >([]);
  const [generateForm, setGenerateForm] = useState<GenerateFormState>(
    createInitialGenerateFormState,
  );
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGenerateDialogKeyboardVisible, setIsGenerateDialogKeyboardVisible] =
    useState(false);
  const [isLoadingGenerationLogs, setIsLoadingGenerationLogs] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetryingAdminDocument, setIsRetryingAdminDocument] = useState(false);
  const [isSavingBodyTemplate, setIsSavingBodyTemplate] = useState(false);
  const [isSavingSignatureFields, setIsSavingSignatureFields] = useState(false);
  const [connectionWarning, setConnectionWarning] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [generationLogsErrorMessage, setGenerationLogsErrorMessage] =
    useState('');
  const [drawerSelection, setDrawerSelection] =
    useState<DrawerSelectionState | null>(null);
  const greetingInputRef = useRef<HTMLInputElement | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const signOffInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(true);
  const latestAdminDocumentRef = useRef<CoverLetterAdminDocument | null>(null);
  const latestDrawerBodyTemplateRef = useRef<BodyTemplateDraft | null>(null);
  const latestPersistedDocumentJsonRef = useRef('');

  useEffect(
    function syncGenerateDialogViewport() {
      if (!isGenerateDialogOpen) {
        return;
      }

      const root = document.documentElement;
      const content = document.querySelector<HTMLElement>(
        '[data-generate-dialog-content="true"]',
      );
      const resizeObserver = content
        ? new ResizeObserver(updateGenerateDialogViewport)
        : null;
      let animationFrameId = 0;

      function updateGenerateDialogViewport() {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = window.requestAnimationFrame(function updatePosition() {
          const visualViewport = window.visualViewport;
          const viewportTop = visualViewport?.offsetTop || 0;
          const viewportHeight = visualViewport?.height || window.innerHeight;
          const occludedBottom = Math.max(
            0,
            window.innerHeight - viewportTop - viewportHeight,
          );
          const contentHeight = content?.offsetHeight || 0;
          const topSpacing = viewportTop + Math.max(
            16,
            (viewportHeight - contentHeight) / 2,
          );
          const bottomSpacing = Math.max(16, occludedBottom + 16);
          const isKeyboardVisible = occludedBottom > 80;

          root.style.setProperty(
            '--coverfire-generate-dialog-top-spacing',
            `${topSpacing}px`,
          );
          root.style.setProperty(
            '--coverfire-generate-dialog-bottom-spacing',
            `${bottomSpacing}px`,
          );
          setIsGenerateDialogKeyboardVisible(isKeyboardVisible);
        });
      }

      if (content) {
        resizeObserver?.observe(content);
      }
      updateGenerateDialogViewport();
      window.addEventListener('resize', updateGenerateDialogViewport);
      window.visualViewport?.addEventListener(
        'resize',
        updateGenerateDialogViewport,
      );
      window.visualViewport?.addEventListener(
        'scroll',
        updateGenerateDialogViewport,
      );

      return function cleanupGenerateDialogViewport() {
        window.cancelAnimationFrame(animationFrameId);
        resizeObserver?.disconnect();
        window.removeEventListener('resize', updateGenerateDialogViewport);
        window.visualViewport?.removeEventListener(
          'resize',
          updateGenerateDialogViewport,
        );
        window.visualViewport?.removeEventListener(
          'scroll',
          updateGenerateDialogViewport,
        );
        root.style.removeProperty('--coverfire-generate-dialog-top-spacing');
        root.style.removeProperty('--coverfire-generate-dialog-bottom-spacing');
        setIsGenerateDialogKeyboardVisible(false);
      };
    },
    [isGenerateDialogOpen],
  );

  const canRefreshAdminDocumentInPlace = useCallback(
    function canRefreshAdminDocumentInPlace() {
      const currentAdminDocument = latestAdminDocumentRef.current;

      if (!currentAdminDocument) {
        return true;
      }

      if (latestDrawerBodyTemplateRef.current) {
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
      setSelectedBodyTemplateId(
        function updateSelectedBodyTemplateId(currentSelectedBodyTemplateId) {
          if (
            currentSelectedBodyTemplateId &&
            getBodyTemplateById(nextAdminDocument, currentSelectedBodyTemplateId)
          ) {
            return currentSelectedBodyTemplateId;
          }

          return nextAdminDocument.defaults.defaultBodyTemplateId;
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

  const loadGenerationLogs = useCallback(
    async function loadGenerationLogs() {
      setIsLoadingGenerationLogs(true);

      try {
        const nextGenerationLogs = await fetchCoverLetterGenerationLogs();

        if (!isMountedRef.current) {
          return;
        }

        setGenerationLogs(nextGenerationLogs);
        setGenerationLogsErrorMessage('');
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        setGenerationLogsErrorMessage(getErrorMessage(error));
      } finally {
        if (isMountedRef.current) {
          setIsLoadingGenerationLogs(false);
        }
      }
    },
    [],
  );

  useEffect(
    function syncLatestAdminDocumentRef() {
      latestAdminDocumentRef.current = adminDocument;
    },
    [adminDocument],
  );

  useEffect(
    function syncLatestDrawerBodyTemplateRef() {
      latestDrawerBodyTemplateRef.current = drawerBodyTemplate;
    },
    [drawerBodyTemplate],
  );

  useEffect(function closeBodyTemplatePreviewFromFrame() {
    function handlePreviewMessage(event: MessageEvent) {
      if (
        event.origin === window.location.origin
        && event.data === 'coverfire:close-preview'
      ) {
        setBodyTemplatePreviewUrl('');
        void loadGenerationLogs();
      }
    }

    window.addEventListener('message', handlePreviewMessage);

    return function cleanupPreviewMessageListener() {
      window.removeEventListener('message', handlePreviewMessage);
    };
  }, [loadGenerationLogs]);

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
    function loadInitialGenerationLogs() {
      const timeoutId = window.setTimeout(function beginInitialLogLoad() {
        void loadGenerationLogs();
      }, 0);

      return function cleanup() {
        window.clearTimeout(timeoutId);
      };
    },
    [loadGenerationLogs],
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

  const selectedBodyTemplate =
    getBodyTemplateById(adminDocument, selectedBodyTemplateId) ||
    getDefaultBodyTemplate(adminDocument);
  const pendingDeleteBodyTemplate = pendingDeleteBodyTemplateId
    ? getBodyTemplateById(adminDocument, pendingDeleteBodyTemplateId)
    : null;
  const persistedDocument = parsePersistedDocument(persistedDocumentJson);
  const canReloadLatestAdminState =
    !drawerBodyTemplate &&
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
  const usedDrawerTokens = getUsedDrawerTokens(drawerBodyTemplate);
  return (
    <div className="min-h-screen bg-muted/30">
      <Tabs
        value={activeTab}
        className="container mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6"
        onValueChange={setActiveTab}
      >
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-0">
              <FireAnimation size={32} className="shrink-0 relative -top-1" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Coverfire Admin
              </h1>
            </div>
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
          </div>
          {activeTab === 'dashboard' ? (
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
                <FileText data-icon="inline-start" />
                Generate PDF
              </Button>
            </div>
          ) : null}
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

        <TabsContent
          value="dashboard"
          className="mt-0 flex flex-1 flex-col xl:min-h-0"
        >
          <div className="grid flex-1 gap-6 pb-6 xl:min-h-0 xl:grid-cols-[minmax(0,1.35fr)_24rem]">
          <Card className="flex flex-col shadow-sm xl:min-h-0">
            <CardHeader>
              <CardTitle>Body Templates</CardTitle>
              <CardDescription>
                Select the body template you want to generate.
              </CardDescription>
              <CardAction>
                <Button
                  variant="outline"
                  onClick={function handleCreateBodyTemplate() {
                    setErrorMessage('');
                    setDrawerBodyTemplate(
                      createNewBodyTemplateDraft(adminDocument),
                    );
                    setIsDrawerOpen(true);
                  }}
                >
                  <Plus data-icon="inline-start" />
                  New template
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pb-(--card-spacing) xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <div className="grid gap-4 py-1 md:grid-cols-2">
                {adminDocument.bodyTemplates.map(
                  function renderBodyTemplate(bodyTemplate) {
                    const isDefault =
                      bodyTemplate.id ===
                      adminDocument.defaults.defaultBodyTemplateId;
                    const isSelected = bodyTemplate.id === selectedBodyTemplateId;

                    return (
                      <Card
                        key={bodyTemplate.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-muted/30',
                          isSelected && 'ring-2 ring-primary shadow-md',
                        )}
                        onClick={function handleSelectBodyTemplate() {
                          setSelectedBodyTemplateId(bodyTemplate.id);
                        }}
                        onKeyDown={function handleBodyTemplateKeyDown(event) {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedBodyTemplateId(bodyTemplate.id);
                          }
                        }}
                      >
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-lg border bg-muted">
                              <Checkbox
                                aria-label={`Select ${bodyTemplate.name}`}
                                checked={isSelected}
                                onCheckedChange={function handleCheckedChange() {
                                  setSelectedBodyTemplateId(bodyTemplate.id);
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
                              <CardTitle>{bodyTemplate.name}</CardTitle>
                              <CardDescription>
                                <InlineCode>{bodyTemplate.slug}</InlineCode>
                              </CardDescription>
                            </div>
                          </div>
                          <CardAction className="flex items-center gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                aria-label={`Manage ${bodyTemplate.name}`}
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
                                  onClick={function handleEditBodyTemplate(
                                    event,
                                  ) {
                                    event.stopPropagation();
                                    setDrawerBodyTemplate(
                                      createDraftFromBodyTemplate(bodyTemplate),
                                    );
                                    setIsDrawerOpen(true);
                                  }}
                                >
                                  <Pencil />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={function handlePreviewBodyTemplateClick(
                                    event,
                                  ) {
                                    event.stopPropagation();
                                    previewSavedBodyTemplate(bodyTemplate);
                                  }}
                                >
                                  <Eye />
                                  Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={function handleDuplicateBodyTemplate(
                                    event,
                                  ) {
                                    event.stopPropagation();
                                    void handleDuplicate(
                                      adminDocument,
                                      bodyTemplate.id,
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
                                      bodyTemplate.id,
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
                                    setPendingDeleteBodyTemplateId(
                                      bodyTemplate.id,
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
                            {renderTemplatePreview(bodyTemplate.greeting)}
                          </p>
                          <div className="line-clamp-8 text-sm">
                            {renderTemplatePreview(bodyTemplate.body)}
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
                                'cursor-pointer font-medium',
                              )}
                              onClick={function handleSetDefaultBadgeClick(
                                event,
                              ) {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleSetDefault(
                                  adminDocument,
                                  bodyTemplate.id,
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
            type="single"
            collapsible
            defaultValue="signature"
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
        </TabsContent>

        <TabsContent value="logs" className="mt-0 flex flex-1 flex-col pb-6">
          <Card className="flex-1 shadow-sm">
            <CardHeader>
              <CardTitle>Generated PDFs</CardTitle>
              <CardDescription>
                Browse, preview, and re-generate previously created cover
                letters.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <AdminLogsTable
                errorMessage={generationLogsErrorMessage}
                generationLogs={generationLogs}
                isLoading={isLoadingGenerationLogs}
                onGenerationLogsChanged={function handleGenerationLogsChanged() {
                  void loadGenerationLogs();
                }}
                onOpenPreview={setBodyTemplatePreviewUrl}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <Drawer.Root
        direction="right"
        open={isDrawerOpen}
        onOpenChange={function handleDrawerOpenChange(open) {
          setIsDrawerOpen(open);

          if (!open) {
            setDrawerBodyTemplate(null);
          }
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Drawer.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l bg-background shadow-lg outline-none">
            <Drawer.Title className="sr-only">Edit body template</Drawer.Title>
            <Drawer.Description className="sr-only">
              Edit a single cover-letter body template.
            </Drawer.Description>
            {drawerBodyTemplate ? (
              <>
                <div className="flex items-center justify-between gap-4 p-6">
                  <div className="grid gap-1">
                    <h2 className="text-lg font-semibold">
                      {drawerBodyTemplate.id
                        ? 'Edit body template'
                        : 'Create body template'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Update the selected body template.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={function handleCancelDrawerClick() {
                        setIsDrawerOpen(false);
                        setDrawerBodyTemplate(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isSavingBodyTemplate}
                      onClick={function handleSaveBodyTemplateClick() {
                        void saveBodyTemplateDraft();
                      }}
                    >
                      {isSavingBodyTemplate ? (
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
                      onClick={function handlePreviewButtonClick() {
                        previewBodyTemplateDraft();
                      }}
                    >
                      <Eye />
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
                          value={drawerBodyTemplate.name}
                          onChange={function handleNameChange(event) {
                            updateDrawerBodyTemplateField(
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
                          value={drawerBodyTemplate.slug}
                          onChange={function handleSlugChange(event) {
                            updateDrawerBodyTemplateField(
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
                                'cursor-pointer font-mono font-medium',
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
                        value={drawerBodyTemplate.greeting}
                        onFocus={function handleGreetingFocus(event) {
                          captureDrawerSelection(
                            'greeting',
                            event.currentTarget,
                          );
                        }}
                        onChange={function handleGreetingChange(event) {
                          updateDrawerBodyTemplateField(
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
                        value={drawerBodyTemplate.body}
                        onFocus={function handleBodyFocus() {
                          if (bodyTextareaRef.current) {
                            captureDrawerSelection(
                              'body',
                              bodyTextareaRef.current,
                            );
                          }
                        }}
                        onChange={function handleBodyChange(value) {
                          updateDrawerBodyTemplateField('body', value);
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
                        value={drawerBodyTemplate.signOff}
                        onFocus={function handleSignOffFocus(event) {
                          captureDrawerSelection(
                            'signOff',
                            event.currentTarget,
                          );
                        }}
                        onChange={function handleSignOffChange(event) {
                          updateDrawerBodyTemplateField(
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
        open={Boolean(bodyTemplatePreviewUrl)}
        onOpenChange={function handlePreviewDialogOpenChange(open) {
          if (!open) {
            setBodyTemplatePreviewUrl('');
          }
        }}
      >
        <DialogContent
          className="h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-hidden p-0 max-[895px]:top-0 max-[895px]:left-0 max-[895px]:h-dvh max-[895px]:w-screen max-[895px]:max-w-none max-[895px]:translate-x-0 max-[895px]:translate-y-0 max-[895px]:rounded-none max-[895px]:overflow-auto max-[895px]:shadow-none sm:max-w-none"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Preview body template</DialogTitle>
            <DialogDescription>
              Preview the selected cover-letter body template.
            </DialogDescription>
          </DialogHeader>
          {bodyTemplatePreviewUrl ? (
            <iframe
              className="h-full w-full border-0"
              src={bodyTemplatePreviewUrl}
              title="Body template preview"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isGenerateDialogOpen}
        onOpenChange={setIsGenerateDialogOpen}
      >
        <DialogContent
          className={cn(
            'p-6 sm:max-w-lg',
            isGenerateDialogKeyboardVisible &&
              'relative! top-auto! left-auto! mx-auto! translate-x-0! translate-y-0!',
          )}
          data-generate-dialog-content="true"
          style={
            isGenerateDialogKeyboardVisible
              ? {
                  marginBottom:
                    'var(--coverfire-generate-dialog-bottom-spacing, 1rem)',
                  marginTop:
                    'var(--coverfire-generate-dialog-top-spacing, 1rem)',
                }
              : undefined
          }
        >
          <DialogHeader>
            <DialogTitle className="text-2xl leading-tight font-semibold tracking-tight">
              Generate cover letter
            </DialogTitle>
            <DialogDescription>
              Fill in the recipient fields and generate a PDF or copy plain text.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <LabeledField htmlFor="generate-body-template" label="Body Template">
              <Input
                disabled
                id="generate-body-template"
                value={selectedBodyTemplate?.name || ''}
              />
            </LabeledField>
            <LabeledField
              htmlFor="generate-hiring-manager"
              label="Hiring Manager"
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
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4">
            <Button
              variant="outline"
              onClick={function handleCloseGenerateDialog() {
                setIsGenerateDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={isGeneratingPdf || isGeneratingText}
              variant="outline"
              onClick={function handleGenerateTextButtonClick() {
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
              disabled={isGeneratingPdf || isGeneratingText}
              onClick={function handleGenerateButtonClick() {
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDeleteBodyTemplate)}
        onOpenChange={function handleDeleteDialogOpenChange(open) {
          if (!open) {
            setPendingDeleteBodyTemplateId('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete body template?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteBodyTemplate
                ? `This will delete "${pendingDeleteBodyTemplate.name}".`
                : 'This body template will be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={function handleConfirmDeleteClick() {
                if (pendingDeleteBodyTemplate) {
                  void handleDelete(adminDocument, pendingDeleteBodyTemplate.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </Tabs>
    </div>
  );

  function updateDrawerBodyTemplateField<K extends keyof BodyTemplateDraft>(
    field: K,
    value: BodyTemplateDraft[K],
  ) {
    setDrawerBodyTemplate(
      function updateCurrentDrawerBodyTemplate(currentDrawerBodyTemplate) {
        if (!currentDrawerBodyTemplate) {
          return currentDrawerBodyTemplate;
        }

        return {
          ...currentDrawerBodyTemplate,
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
    if (!drawerBodyTemplate) {
      return;
    }

    const field = drawerSelection?.field || 'body';
    const tokenText = `{{${token}}}`;
    const currentValue = drawerBodyTemplate[field];
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

    updateDrawerBodyTemplateField(field, nextValue);
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

  async function saveBodyTemplateDraft() {
    if (!adminDocument || !drawerBodyTemplate) {
      return;
    }

    setErrorMessage('');
    setIsSavingBodyTemplate(true);

    try {
      const input = sanitizeBodyTemplateDraft(drawerBodyTemplate);
      const savedBodyTemplate = drawerBodyTemplate.id
        ? await updateBodyTemplate(drawerBodyTemplate.id, input)
        : await createBodyTemplate(input);
      const nextAdminDocument = upsertBodyTemplate(
        adminDocument,
        savedBodyTemplate,
      );

      persistAdminDocument(
        nextAdminDocument,
        setAdminDocument,
        setPersistedDocumentJson,
      );
      setConnectionWarning('');
      setSelectedBodyTemplateId(savedBodyTemplate.id);
      setDrawerBodyTemplate(null);
      setIsDrawerOpen(false);
      toast(
        drawerBodyTemplate.id
          ? 'Body template updated.'
          : 'Body template created.',
        {
          icon: successToastIcon,
        },
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingBodyTemplate(false);
    }
  }

  function previewBodyTemplateDraft() {
    if (!adminDocument || !drawerBodyTemplate) {
      return;
    }

    const input = sanitizeBodyTemplateDraftForPreview(drawerBodyTemplate);
    const previewAdminDocument = buildPreviewAdminDocument(
      adminDocument,
      input,
      drawerBodyTemplate.id,
    );
    const previewTemplateId = drawerBodyTemplate.id || 'preview-draft';
    const previewUrl = buildCoverLetterPreviewUrl(
      previewAdminDocument,
      {
        hiringManager: previewAdminDocument.defaults.hiringManager,
        title: previewAdminDocument.defaults.title,
        templateId: previewTemplateId,
      },
      {
        embedded: true,
      },
    );

    setErrorMessage('');
    setBodyTemplatePreviewUrl(previewUrl);
  }

  function previewSavedBodyTemplate(bodyTemplate: CoverLetterBodyTemplate) {
    if (!adminDocument) {
      return;
    }

    const previewUrl = buildCoverLetterPreviewUrl(
      adminDocument,
      {
        hiringManager: adminDocument.defaults.hiringManager,
        title: adminDocument.defaults.title,
        templateId: bodyTemplate.id,
      },
      {
        embedded: true,
      },
    );

    setErrorMessage('');
    setBodyTemplatePreviewUrl(previewUrl);
  }

  async function handleDuplicate(
    currentAdminDocument: CoverLetterAdminDocument,
    bodyTemplateId: string,
  ) {
    setErrorMessage('');

    try {
      const savedBodyTemplate = await duplicateBodyTemplate(bodyTemplateId);
      const nextAdminDocument = upsertBodyTemplate(
        currentAdminDocument,
        savedBodyTemplate,
      );

      persistAdminDocument(
        nextAdminDocument,
        setAdminDocument,
        setPersistedDocumentJson,
      );
      setConnectionWarning('');
      setSelectedBodyTemplateId(savedBodyTemplate.id);
      toast('Body template duplicated.', {
        icon: successToastIcon,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleSetDefault(
    currentAdminDocument: CoverLetterAdminDocument,
    bodyTemplateId: string,
  ) {
    setErrorMessage('');

    try {
      const savedBodyTemplate = await setDefaultBodyTemplate(bodyTemplateId);
      const nextAdminDocument = {
        ...currentAdminDocument,
        defaults: {
          ...currentAdminDocument.defaults,
          defaultBodyTemplateId: savedBodyTemplate.id,
        },
        bodyTemplates: currentAdminDocument.bodyTemplates.map(
          function mapBodyTemplate(bodyTemplate) {
            return {
              ...bodyTemplate,
              isDefault: bodyTemplate.id === savedBodyTemplate.id,
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
      setSelectedBodyTemplateId(savedBodyTemplate.id);
      toast('Default body template updated.', {
        icon: successToastIcon,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleDelete(
    currentAdminDocument: CoverLetterAdminDocument,
    bodyTemplateId: string,
  ) {
    setErrorMessage('');

    try {
      await deleteBodyTemplate(bodyTemplateId);

      const remainingBodyTemplates = currentAdminDocument.bodyTemplates.filter(
        function filterBodyTemplate(bodyTemplate) {
          return bodyTemplate.id !== bodyTemplateId;
        },
      );
      const nextDefaultBodyTemplateId =
        currentAdminDocument.defaults.defaultBodyTemplateId === bodyTemplateId
          ? remainingBodyTemplates[0]?.id || ''
          : currentAdminDocument.defaults.defaultBodyTemplateId;
      const nextAdminDocument = {
        ...currentAdminDocument,
        defaults: {
          ...currentAdminDocument.defaults,
          defaultBodyTemplateId: nextDefaultBodyTemplateId,
        },
        bodyTemplates: remainingBodyTemplates.map(
          function mapBodyTemplate(bodyTemplate) {
            return {
              ...bodyTemplate,
              isDefault: bodyTemplate.id === nextDefaultBodyTemplateId,
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
      setPendingDeleteBodyTemplateId('');
      setSelectedBodyTemplateId(nextDefaultBodyTemplateId);
      toast('Body template deleted.', {
        icon: successToastIcon,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleGeneratePdf() {
    if (!adminDocument) {
      toast.error('Admin document is unavailable.');
      return;
    }

    if (!selectedBodyTemplate) {
      toast.error('Select a body template first.');
      return;
    }

    const validationMessage = getCoverLetterGenerationValidationMessage({
      role: generateForm.role,
      company: generateForm.company,
    });

    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setErrorMessage('');
    setIsGeneratingPdf(true);

    try {
      const pdf = await generateAdminPdf(
        {
          templateId: selectedBodyTemplate.id,
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
        },
        {
          method: 'admin-ui',
        },
      );

      downloadBlob(
        pdf.blob,
        pdf.filename || buildFallbackFilename(selectedBodyTemplate.slug),
      );
      setIsGenerateDialogOpen(false);
      void loadGenerationLogs();
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
    if (!adminDocument) {
      toast.error('Admin document is unavailable.');
      return;
    }

    if (!selectedBodyTemplate) {
      toast.error('Select a body template first.');
      return;
    }

    const validationMessage = getCoverLetterGenerationValidationMessage({
      role: generateForm.role,
      company: generateForm.company,
    });

    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setErrorMessage('');
    setIsGeneratingText(true);

    try {
      const result = await generateAdminText(
        {
          templateId: selectedBodyTemplate.id,
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
        },
        {
          method: 'admin-ui',
        },
      );

      await copyTextToClipboard(result.text);
      setIsGenerateDialogOpen(false);
      toast('Copied cover letter text to the clipboard.', {
        icon: successToastIcon,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsGeneratingText(false);
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

function getDefaultBodyTemplate(adminDocument: CoverLetterAdminDocument) {
  return (
    getBodyTemplateById(
      adminDocument,
      adminDocument.defaults.defaultBodyTemplateId,
    ) || adminDocument.bodyTemplates[0]
  );
}

function getBodyTemplateById(
  adminDocument: CoverLetterAdminDocument,
  bodyTemplateId: string,
) {
  return (
    adminDocument.bodyTemplates.find(function findBodyTemplate(bodyTemplate) {
      return bodyTemplate.id === bodyTemplateId;
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

function createDraftFromBodyTemplate(
  bodyTemplate: CoverLetterBodyTemplate,
): BodyTemplateDraft {
  return {
    body: bodyTemplate.body,
    greeting: bodyTemplate.greeting,
    id: bodyTemplate.id,
    name: bodyTemplate.name,
    signOff: bodyTemplate.signOff,
    slug: bodyTemplate.slug,
  };
}

function createNewBodyTemplateDraft(
  adminDocument: CoverLetterAdminDocument,
): BodyTemplateDraft {
  const nextIndex = adminDocument.bodyTemplates.length + 1;
  const baseName = `Version ${nextIndex}`;

  return {
    body: '',
    greeting: 'Dear {{hiringManager}},',
    name: baseName,
    signOff: 'Warm regards,',
    slug: buildUniqueSlug(adminDocument.bodyTemplates, slugify(baseName)),
  };
}

function sanitizeBodyTemplateDraft(
  bodyTemplateDraft: BodyTemplateDraft,
): AdminBodyTemplateInput {
  return {
    body: bodyTemplateDraft.body.trim(),
    greeting: bodyTemplateDraft.greeting.trim(),
    name: bodyTemplateDraft.name.trim(),
    signOff: bodyTemplateDraft.signOff.trim(),
    slug: slugify(bodyTemplateDraft.slug),
  };
}

function sanitizeBodyTemplateDraftForPreview(
  bodyTemplateDraft: BodyTemplateDraft,
): AdminBodyTemplateInput {
  const input = sanitizeBodyTemplateDraft(bodyTemplateDraft);

  return {
    body: input.body || '\u200B',
    greeting: input.greeting || '\u200B',
    name: input.name || 'Untitled preview',
    signOff: input.signOff || '\u200B',
    slug: input.slug || 'preview-draft',
  };
}

function upsertBodyTemplate(
  adminDocument: CoverLetterAdminDocument,
  bodyTemplate: CoverLetterBodyTemplate,
): CoverLetterAdminDocument {
  const hasExistingBodyTemplate = adminDocument.bodyTemplates.some(
    function someBodyTemplate(candidateBodyTemplate) {
      return candidateBodyTemplate.id === bodyTemplate.id;
    },
  );
  const nextBodyTemplates = hasExistingBodyTemplate
    ? adminDocument.bodyTemplates.map(
        function mapBodyTemplate(candidateBodyTemplate) {
          return candidateBodyTemplate.id === bodyTemplate.id
            ? bodyTemplate
            : candidateBodyTemplate;
        },
      )
    : [...adminDocument.bodyTemplates, bodyTemplate];

  return {
    ...adminDocument,
    bodyTemplates: nextBodyTemplates,
  };
}

function buildUniqueSlug(
  bodyTemplates: CoverLetterBodyTemplate[],
  baseSlug: string,
) {
  const normalizedBaseSlug = slugify(baseSlug) || 'version';
  const slugs = new Set(
    bodyTemplates.map(function mapBodyTemplate(bodyTemplate) {
      return bodyTemplate.slug;
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

function buildFallbackFilename(bodyTemplateSlug: string) {
  return `cover-letter-${bodyTemplateSlug}.pdf`;
}

function buildPreviewAdminDocument(
  adminDocument: CoverLetterAdminDocument,
  input: AdminBodyTemplateInput,
  existingBodyTemplateId?: string,
) {
  const now = new Date().toISOString();
  const previewBodyTemplate = {
    id: existingBodyTemplateId || 'preview-draft',
    slug: input.slug,
    name: input.name,
    greeting: input.greeting,
    body: input.body,
    signOff: input.signOff,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  const existingBodyTemplate = adminDocument.bodyTemplates.find(
    function findBodyTemplate(bodyTemplate) {
      return bodyTemplate.id === previewBodyTemplate.id;
    },
  );

  return {
    ...adminDocument,
    bodyTemplates: existingBodyTemplate
      ? adminDocument.bodyTemplates.map(function mapBodyTemplate(bodyTemplate) {
          return bodyTemplate.id === previewBodyTemplate.id
            ? previewBodyTemplate
            : bodyTemplate;
        })
      : [ ...adminDocument.bodyTemplates, previewBodyTemplate ],
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

function getUsedDrawerTokens(drawerBodyTemplate: BodyTemplateDraft | null) {
  if (!drawerBodyTemplate) {
    return [] as Array<(typeof drawerTemplateTokens)[number]>;
  }

  const content = [
    drawerBodyTemplate.greeting,
    drawerBodyTemplate.body,
    drawerBodyTemplate.signOff,
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
