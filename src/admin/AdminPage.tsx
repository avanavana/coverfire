import { useEffect, useState } from 'react';

import {
  Check,
  CircleAlert,
  Copy,
  Download,
  FilePenLine,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2
} from 'lucide-react';
import { Drawer } from 'vaul';

import {
  type CoverLetterAdminDocument,
  type CoverLetterBodyVersion,
  type CoverLetterContactMethod
} from '@/cover-letter';

import {
  type AdminBodyVersionInput,
  AdminApiError,
  createBodyVersion,
  deleteBodyVersion,
  duplicateBodyVersion,
  fetchAdminDocument,
  generatePdf,
  saveAdminDocument,
  setDefaultBodyVersion,
  updateBodyVersion
} from '@/admin/api';
import { BodyEditor } from '@/admin/rich-text';

interface BodyVersionDraft extends AdminBodyVersionInput {
  id?: string;
}

interface GenerateFormState {
  apiKey: string;
  company: string;
  hiringManager: string;
  role: string;
  title: string;
}

const cardClassName = 'rounded-[32px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur';
const buttonClassName = 'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50';
const quietButtonClassName = 'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50';
const inputClassName = 'w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400';
const labelClassName = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500';

export default function AdminPage() {
  const [adminDocument, setAdminDocument] = useState<CoverLetterAdminDocument | null>(null);
  const [persistedDocumentJson, setPersistedDocumentJson] = useState('');
  const [selectedBodyVersionId, setSelectedBodyVersionId] = useState('');
  const [drawerBodyVersion, setDrawerBodyVersion] = useState<BodyVersionDraft | null>(null);
  const [generateForm, setGenerateForm] = useState<GenerateFormState>(createInitialGenerateFormState);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBodyVersion, setIsSavingBodyVersion] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(function loadInitialAdminDocument() {
    let isMounted = true;

    async function loadAdminDocument() {
      try {
        const nextAdminDocument = await fetchAdminDocument();

        if (!isMounted) {
          return;
        }

        persistAdminDocument(nextAdminDocument, setAdminDocument, setPersistedDocumentJson);
        setSelectedBodyVersionId(nextAdminDocument.defaults.defaultBodyVersionId);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAdminDocument();

    return function cleanup() {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(236,233,229,0.95),_rgba(214,211,205,0.85)_45%,_rgba(241,239,236,0.95))] px-6 py-10 text-slate-900">
        <div className="mx-auto flex max-w-3xl items-center justify-center rounded-[32px] border border-black/10 bg-white/85 px-8 py-20 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <LoaderCircle className="animate-spin" />
            Loading admin state...
          </div>
        </div>
      </div>
    );
  }

  if (!adminDocument) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(236,233,229,0.95),_rgba(214,211,205,0.85)_45%,_rgba(241,239,236,0.95))] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-rose-200 bg-rose-50 px-8 py-10 text-rose-700 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <div className="mb-2 flex items-center gap-3 text-base font-semibold">
            <CircleAlert />
            Unable to load admin state
          </div>
          <p className="text-sm leading-7">{errorMessage || 'No admin document was returned by the API.'}</p>
        </div>
      </div>
    );
  }

  const selectedBodyVersion = getBodyVersionById(adminDocument, selectedBodyVersionId) || getDefaultBodyVersion(adminDocument);
  const hasUnsavedSettings = JSON.stringify(adminDocument) !== persistedDocumentJson;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(236,233,229,0.95),_rgba(214,211,205,0.85)_45%,_rgba(241,239,236,0.95))] px-4 py-4 text-slate-900 sm:px-6 sm:py-6">
      <div className="mx-auto flex max-w-[96rem] flex-col gap-6">
        <header className={`${cardClassName} overflow-hidden`}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="flex flex-col gap-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                <Sparkles className="size-3.5" />
                Coverfire Admin
              </div>
              <div className="max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">Edit copy, profile data, and generate PDFs from one screen.</h1>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  The body versions live as cards, and each one opens into a right-side detail editor so the storage model stays separate from the printable cover letter markup.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatusCard
                label="Selected version"
                value={selectedBodyVersion?.name || 'None'}
                detail={selectedBodyVersion?.slug || 'Select a body version below'}
              />
              <StatusCard
                label="Default version"
                value={getDefaultBodyVersion(adminDocument).name}
                detail={adminDocument.defaults.title}
              />
            </div>
          </div>
          {notice ? (
            <div className="mt-5 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}
          {errorMessage ? (
            <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.75fr)]">
          <main className="flex flex-col gap-6">
            <section className={cardClassName}>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Body Versions</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Choose, duplicate, and refine your cover letter variants.</h2>
                </div>
                <button
                  type="button"
                  className={buttonClassName}
                  onClick={function handleCreateBodyVersion() {
                    setErrorMessage('');
                    setDrawerBodyVersion(createNewBodyVersionDraft(adminDocument));
                    setIsDrawerOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  New version
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {adminDocument.bodyVersions.map(function renderBodyVersion(bodyVersion) {
                  const isSelected = bodyVersion.id === selectedBodyVersionId;
                  const isDefault = bodyVersion.id === adminDocument.defaults.defaultBodyVersionId;

                  return (
                    <article
                      key={bodyVersion.id}
                      className={`flex min-h-64 cursor-pointer flex-col rounded-[28px] border p-5 transition ${
                        isSelected
                          ? 'border-slate-950 bg-slate-950 text-white shadow-[0_20px_70px_rgba(15,23,42,0.18)]'
                          : 'border-black/10 bg-stone-50/90 text-slate-900 hover:border-slate-300 hover:bg-white'
                      }`}
                      onClick={function handleSelectBodyVersion() {
                        setSelectedBodyVersionId(bodyVersion.id);
                      }}
                    >
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${isSelected ? 'bg-white/12 text-white/80' : 'bg-white text-slate-500'}`}>
                              {bodyVersion.slug}
                            </span>
                            {isDefault ? (
                              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${isSelected ? 'bg-emerald-400/18 text-emerald-100' : 'bg-emerald-50 text-emerald-700'}`}>
                                <Check className="size-3.5" />
                                Default
                              </span>
                            ) : null}
                          </div>
                          <h3 className="text-xl font-semibold tracking-[-0.03em]">{bodyVersion.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Edit ${bodyVersion.name}`}
                            className={`rounded-full border p-2 transition ${isSelected ? 'border-white/15 bg-white/10 text-white hover:bg-white/15' : 'border-black/10 bg-white text-slate-700 hover:bg-slate-100'}`}
                            onClick={function handleEditBodyVersion(event) {
                              event.stopPropagation();
                              setErrorMessage('');
                              setDrawerBodyVersion(createDraftFromBodyVersion(bodyVersion));
                              setIsDrawerOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Duplicate ${bodyVersion.name}`}
                            className={`rounded-full border p-2 transition ${isSelected ? 'border-white/15 bg-white/10 text-white hover:bg-white/15' : 'border-black/10 bg-white text-slate-700 hover:bg-slate-100'}`}
                            onClick={function handleDuplicateBodyVersion(event) {
                              event.stopPropagation();
                              void handleDuplicate(adminDocument, bodyVersion.id);
                            }}
                          >
                            <Copy className="size-4" />
                          </button>
                        </div>
                      </div>
                      <p className={`mb-3 text-sm leading-6 ${isSelected ? 'text-white/78' : 'text-slate-600'}`}>
                        {bodyVersion.greeting}
                      </p>
                      <p className={`line-clamp-6 text-sm leading-7 ${isSelected ? 'text-white/90' : 'text-slate-700'}`}>
                        {bodyVersion.body}
                      </p>
                      <div className="mt-auto flex flex-wrap gap-2 pt-6">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                            isSelected
                              ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
                              : 'border-black/10 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                          onClick={function handleMarkDefault(event) {
                            event.stopPropagation();
                            void handleSetDefault(adminDocument, bodyVersion.id);
                          }}
                        >
                          <Star className="size-3.5" />
                          Set default
                        </button>
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                            isSelected
                              ? 'border-rose-300/25 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15'
                              : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                          onClick={function handleDeleteClick(event) {
                            event.stopPropagation();
                            void handleDelete(adminDocument, bodyVersion.id);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className={cardClassName}>
              <div className="mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Contacts</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Signature and footer fields</h2>
              </div>
              <div className="grid gap-4">
                {adminDocument.profile.contacts.map(function renderContact(contact) {
                  return (
                    <div key={contact.id} className="rounded-[26px] border border-black/10 bg-stone-50/80 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{contact.id}</p>
                          <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-900">{contact.label}</h3>
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <LabeledField label="Label">
                          <input
                            value={contact.label}
                            className={inputClassName}
                            onChange={function handleContactLabelChange(event) {
                              updateContactField(contact.id, 'label', event.target.value);
                            }}
                          />
                        </LabeledField>
                        <LabeledField label="Value">
                          <input
                            value={contact.value}
                            className={inputClassName}
                            onChange={function handleContactValueChange(event) {
                              updateContactField(contact.id, 'value', event.target.value);
                            }}
                          />
                        </LabeledField>
                        <LabeledField label="Link / href">
                          <input
                            value={contact.href || ''}
                            className={inputClassName}
                            onChange={function handleContactHrefChange(event) {
                              updateContactField(contact.id, 'href', normalizeOptionalString(event.target.value));
                            }}
                          />
                        </LabeledField>
                        <LabeledField label="Footer icon">
                          <select
                            value={contact.footerIcon || ''}
                            className={inputClassName}
                            onChange={function handleContactIconChange(event) {
                              updateContactField(contact.id, 'footerIcon', normalizeFooterIcon(event.target.value));
                            }}
                          >
                            <option value="">None</option>
                            <option value="email">Email</option>
                            <option value="link">Link</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="github">GitHub</option>
                          </select>
                        </LabeledField>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <ToggleChip
                          checked={contact.includeInSignature}
                          label="Include in signature"
                          onChange={function handleSignatureToggle() {
                            updateContactField(contact.id, 'includeInSignature', !contact.includeInSignature);
                          }}
                        />
                        <ToggleChip
                          checked={contact.includeInFooter}
                          label="Include in footer"
                          onChange={function handleFooterToggle() {
                            updateContactField(contact.id, 'includeInFooter', !contact.includeInFooter);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>

          <aside className="flex flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
            <section className={cardClassName}>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Settings</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Defaults and profile</h2>
                </div>
                <button
                  type="button"
                  className={buttonClassName}
                  disabled={!hasUnsavedSettings || isSavingSettings}
                  onClick={function handleSaveSettings() {
                    void saveSettings();
                  }}
                >
                  {isSavingSettings ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save
                </button>
              </div>
              <div className="grid gap-4">
                <LabeledField label="Name">
                  <input
                    value={adminDocument.profile.name}
                    className={inputClassName}
                    onChange={function handleNameChange(event) {
                      updateProfileField('name', event.target.value);
                    }}
                  />
                </LabeledField>
                <LabeledField label="Logo alt text">
                  <input
                    value={adminDocument.profile.logoAlt}
                    className={inputClassName}
                    onChange={function handleLogoAltChange(event) {
                      updateProfileField('logoAlt', event.target.value);
                    }}
                  />
                </LabeledField>
                <LabeledField label="Default title">
                  <input
                    value={adminDocument.defaults.title}
                    className={inputClassName}
                    onChange={function handleDefaultTitleChange(event) {
                      updateDefaultField('title', event.target.value);
                    }}
                  />
                </LabeledField>
                <LabeledField label="Fallback hiring manager">
                  <input
                    value={adminDocument.defaults.hiringManager}
                    className={inputClassName}
                    onChange={function handleDefaultHiringManagerChange(event) {
                      updateDefaultField('hiringManager', event.target.value);
                    }}
                  />
                </LabeledField>
                <LabeledField label="Signature address lines">
                  <textarea
                    rows={4}
                    value={adminDocument.profile.addressLines.join('\n')}
                    className={inputClassName}
                    onChange={function handleAddressLinesChange(event) {
                      updateProfileField('addressLines', splitLines(event.target.value));
                    }}
                  />
                </LabeledField>
                <LabeledField label="Footer address lines">
                  <textarea
                    rows={4}
                    value={adminDocument.profile.footerAddressLines.join('\n')}
                    className={inputClassName}
                    onChange={function handleFooterAddressLinesChange(event) {
                      updateProfileField('footerAddressLines', splitLines(event.target.value));
                    }}
                  />
                </LabeledField>
              </div>
            </section>

            <section className={cardClassName}>
              <div className="mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Generate</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Create a PDF from the selected version</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  This uses the existing protected <code>/api/pdf</code> route, so the API key stays separate from the admin content model.
                </p>
              </div>
              <div className="grid gap-4">
                <LabeledField label="PDF API key">
                  <input
                    type="password"
                    value={generateForm.apiKey}
                    className={inputClassName}
                    onChange={function handleApiKeyChange(event) {
                      updateGenerateField('apiKey', event.target.value);
                    }}
                  />
                </LabeledField>
                <LabeledField label="Role">
                  <input
                    value={generateForm.role}
                    className={inputClassName}
                    onChange={function handleGenerateRoleChange(event) {
                      updateGenerateField('role', event.target.value);
                    }}
                  />
                </LabeledField>
                <LabeledField label="Company">
                  <input
                    value={generateForm.company}
                    className={inputClassName}
                    onChange={function handleGenerateCompanyChange(event) {
                      updateGenerateField('company', event.target.value);
                    }}
                  />
                </LabeledField>
                <LabeledField label="Hiring manager (optional)">
                  <input
                    value={generateForm.hiringManager}
                    className={inputClassName}
                    onChange={function handleGenerateHiringManagerChange(event) {
                      updateGenerateField('hiringManager', event.target.value);
                    }}
                  />
                </LabeledField>
                <LabeledField label="Title override (optional)">
                  <input
                    value={generateForm.title}
                    className={inputClassName}
                    onChange={function handleGenerateTitleChange(event) {
                      updateGenerateField('title', event.target.value);
                    }}
                  />
                </LabeledField>
                <div className="rounded-[24px] border border-black/10 bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Using body version</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">{selectedBodyVersion?.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedBodyVersion?.slug}</p>
                </div>
                <button
                  type="button"
                  className={buttonClassName}
                  disabled={isGenerating}
                  onClick={function handleGenerateButtonClick() {
                    void handleGeneratePdf(selectedBodyVersion);
                  }}
                >
                  {isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Generate PDF
                </button>
              </div>
            </section>
          </aside>
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
          <Drawer.Overlay className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
          <Drawer.Content className="fixed inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-black/10 bg-stone-100 shadow-[0_30px_120px_rgba(15,23,42,0.18)] outline-none">
            <Drawer.Title className="sr-only">Edit body version</Drawer.Title>
            <Drawer.Description className="sr-only">Update the selected cover letter body version.</Drawer.Description>
            {drawerBodyVersion ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-black/10 bg-white/85 px-6 py-5 backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Body version detail</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                        {drawerBodyVersion.id ? 'Edit body version' : 'Create body version'}
                      </h2>
                    </div>
                    <div className="flex gap-3">
                      <Drawer.Close asChild>
                        <button type="button" className={quietButtonClassName}>Cancel</button>
                      </Drawer.Close>
                      <button
                        type="button"
                        className={buttonClassName}
                        disabled={isSavingBodyVersion}
                        onClick={function handleSaveBodyVersionClick() {
                          void saveBodyVersionDraft();
                        }}
                      >
                        {isSavingBodyVersion ? <LoaderCircle className="size-4 animate-spin" /> : <FilePenLine className="size-4" />}
                        Save changes
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="grid gap-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledField label="Name">
                        <input
                          value={drawerBodyVersion.name}
                          className={inputClassName}
                          onChange={function handleDraftNameChange(event) {
                            updateDrawerBodyVersionField('name', event.target.value);
                          }}
                        />
                      </LabeledField>
                      <LabeledField label="Slug">
                        <input
                          value={drawerBodyVersion.slug}
                          className={inputClassName}
                          onChange={function handleDraftSlugChange(event) {
                            updateDrawerBodyVersionField('slug', slugify(event.target.value));
                          }}
                        />
                      </LabeledField>
                    </div>
                    <LabeledField label="Greeting">
                      <input
                        value={drawerBodyVersion.greeting}
                        className={inputClassName}
                        onChange={function handleDraftGreetingChange(event) {
                          updateDrawerBodyVersionField('greeting', event.target.value);
                        }}
                      />
                    </LabeledField>
                    <LabeledField label="Body">
                      <div className="rounded-[32px] border border-black/10 bg-stone-50 p-3">
                        <BodyEditor
                          value={drawerBodyVersion.body}
                          onChange={function handleDraftBodyChange(nextBody) {
                            updateDrawerBodyVersionField('body', nextBody);
                          }}
                        />
                      </div>
                    </LabeledField>
                    <LabeledField label="Sign off">
                      <input
                        value={drawerBodyVersion.signOff}
                        className={inputClassName}
                        onChange={function handleDraftSignOffChange(event) {
                          updateDrawerBodyVersionField('signOff', event.target.value);
                        }}
                      />
                    </LabeledField>
                  </div>
                </div>
              </div>
            ) : null}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );

  function updateProfileField<K extends keyof CoverLetterAdminDocument['profile']>(field: K, value: CoverLetterAdminDocument['profile'][K]) {
    setAdminDocument(function updateDocument(currentAdminDocument) {
      if (!currentAdminDocument) {
        return currentAdminDocument;
      }

      return {
        ...currentAdminDocument,
        profile: {
          ...currentAdminDocument.profile,
          [field]: value
        }
      };
    });
  }

  function updateDefaultField<K extends keyof CoverLetterAdminDocument['defaults']>(field: K, value: CoverLetterAdminDocument['defaults'][K]) {
    setAdminDocument(function updateDocument(currentAdminDocument) {
      if (!currentAdminDocument) {
        return currentAdminDocument;
      }

      return {
        ...currentAdminDocument,
        defaults: {
          ...currentAdminDocument.defaults,
          [field]: value
        }
      };
    });
  }

  function updateContactField<K extends keyof CoverLetterContactMethod>(contactId: CoverLetterContactMethod['id'], field: K, value: CoverLetterContactMethod[K]) {
    setAdminDocument(function updateDocument(currentAdminDocument) {
      if (!currentAdminDocument) {
        return currentAdminDocument;
      }

      return {
        ...currentAdminDocument,
        profile: {
          ...currentAdminDocument.profile,
          contacts: currentAdminDocument.profile.contacts.map(function mapContact(contact) {
            if (contact.id !== contactId) {
              return contact;
            }

            return {
              ...contact,
              [field]: value
            };
          })
        }
      };
    });
  }

  function updateGenerateField<K extends keyof GenerateFormState>(field: K, value: GenerateFormState[K]) {
    setGenerateForm(function updateCurrentGenerateForm(currentGenerateForm) {
      const nextGenerateForm = {
        ...currentGenerateForm,
        [field]: value
      };

      if (field === 'apiKey') {
        window.localStorage.setItem('coverfire.admin.pdfApiKey', String(value));
      }

      return nextGenerateForm;
    });
  }

  function updateDrawerBodyVersionField<K extends keyof BodyVersionDraft>(field: K, value: BodyVersionDraft[K]) {
    setDrawerBodyVersion(function updateCurrentDrawerBodyVersion(currentDrawerBodyVersion) {
      if (!currentDrawerBodyVersion) {
        return currentDrawerBodyVersion;
      }

      return {
        ...currentDrawerBodyVersion,
        [field]: value
      };
    });
  }

  async function saveSettings() {
    if (!adminDocument) {
      return;
    }

    setErrorMessage('');
    setNotice('');
    setIsSavingSettings(true);

    try {
      const savedAdminDocument = await saveAdminDocument(adminDocument);

      persistAdminDocument(savedAdminDocument, setAdminDocument, setPersistedDocumentJson);
      setSelectedBodyVersionId(savedAdminDocument.defaults.defaultBodyVersionId);
      setNotice('Profile and defaults saved.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function saveBodyVersionDraft() {
    if (!adminDocument || !drawerBodyVersion) {
      return;
    }

    setErrorMessage('');
    setNotice('');
    setIsSavingBodyVersion(true);

    try {
      const input = sanitizeBodyVersionDraft(drawerBodyVersion);
      const savedBodyVersion = drawerBodyVersion.id
        ? await updateBodyVersion(drawerBodyVersion.id, input)
        : await createBodyVersion(input);
      const nextAdminDocument = upsertBodyVersion(adminDocument, savedBodyVersion);

      persistAdminDocument(nextAdminDocument, setAdminDocument, setPersistedDocumentJson);
      setSelectedBodyVersionId(savedBodyVersion.id);
      setIsDrawerOpen(false);
      setDrawerBodyVersion(null);
      setNotice(drawerBodyVersion.id ? 'Body version updated.' : 'Body version created.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingBodyVersion(false);
    }
  }

  async function handleDuplicate(currentAdminDocument: CoverLetterAdminDocument, bodyVersionId: string) {
    setErrorMessage('');
    setNotice('');

    try {
      const savedBodyVersion = await duplicateBodyVersion(bodyVersionId);
      const nextAdminDocument = upsertBodyVersion(currentAdminDocument, savedBodyVersion);

      persistAdminDocument(nextAdminDocument, setAdminDocument, setPersistedDocumentJson);
      setSelectedBodyVersionId(savedBodyVersion.id);
      setNotice('Body version duplicated.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleSetDefault(currentAdminDocument: CoverLetterAdminDocument, bodyVersionId: string) {
    setErrorMessage('');
    setNotice('');

    try {
      const savedBodyVersion = await setDefaultBodyVersion(bodyVersionId);
      const nextAdminDocument = {
        ...currentAdminDocument,
        defaults: {
          ...currentAdminDocument.defaults,
          defaultBodyVersionId: savedBodyVersion.id
        },
        bodyVersions: currentAdminDocument.bodyVersions.map(function mapBodyVersion(bodyVersion) {
          return {
            ...bodyVersion,
            isDefault: bodyVersion.id === savedBodyVersion.id
          };
        })
      };

      persistAdminDocument(nextAdminDocument, setAdminDocument, setPersistedDocumentJson);
      setSelectedBodyVersionId(savedBodyVersion.id);
      setNotice('Default body version updated.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleDelete(currentAdminDocument: CoverLetterAdminDocument, bodyVersionId: string) {
    const bodyVersion = getBodyVersionById(currentAdminDocument, bodyVersionId);

    if (!bodyVersion) {
      return;
    }

    if (!window.confirm(`Delete "${bodyVersion.name}"?`)) {
      return;
    }

    setErrorMessage('');
    setNotice('');

    try {
      await deleteBodyVersion(bodyVersionId);

      const remainingBodyVersions = currentAdminDocument.bodyVersions.filter(function filterBodyVersion(candidateBodyVersion) {
        return candidateBodyVersion.id !== bodyVersionId;
      });
      const nextDefaultBodyVersionId = currentAdminDocument.defaults.defaultBodyVersionId === bodyVersionId
        ? remainingBodyVersions[0]?.id || ''
        : currentAdminDocument.defaults.defaultBodyVersionId;
      const nextAdminDocument = {
        ...currentAdminDocument,
        defaults: {
          ...currentAdminDocument.defaults,
          defaultBodyVersionId: nextDefaultBodyVersionId
        },
        bodyVersions: remainingBodyVersions.map(function mapBodyVersion(candidateBodyVersion) {
          return {
            ...candidateBodyVersion,
            isDefault: candidateBodyVersion.id === nextDefaultBodyVersionId
          };
        })
      };

      persistAdminDocument(nextAdminDocument, setAdminDocument, setPersistedDocumentJson);
      setSelectedBodyVersionId(nextDefaultBodyVersionId);
      setNotice('Body version deleted.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleGeneratePdf(currentBodyVersion: CoverLetterBodyVersion | null) {
    if (!currentBodyVersion) {
      setErrorMessage('Select a body version first.');
      return;
    }

    if (!generateForm.apiKey.trim()) {
      setErrorMessage('Enter the PDF API key before generating.');
      return;
    }

    setErrorMessage('');
    setNotice('');
    setIsGenerating(true);

    try {
      const pdf = await generatePdf({
        bodyVersionSlug: currentBodyVersion.slug,
        company: generateForm.company,
        hiringManager: generateForm.hiringManager || undefined,
        role: generateForm.role,
        title: generateForm.title || undefined
      }, generateForm.apiKey.trim());

      downloadBlob(pdf.blob, pdf.filename || buildFallbackFilename(currentBodyVersion.slug));
      setNotice(`Generated ${pdf.filename || 'cover letter PDF'}.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }
}

function StatusCard({ detail, label, value }: { detail: string; label: string; value: string; }) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-stone-50/90 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function LabeledField({ children, label }: { children: React.ReactNode; label: string; }) {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      {children}
    </label>
  );
}

function ToggleChip({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void; }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
        checked
          ? 'border-slate-950 bg-slate-950 text-white'
          : 'border-black/10 bg-white text-slate-600 hover:bg-slate-100'
      }`}
      onClick={onChange}
    >
      {checked ? <Check className="size-3.5" /> : null}
      {label}
    </button>
  );
}

function persistAdminDocument(
  adminDocument: CoverLetterAdminDocument,
  setAdminDocument: React.Dispatch<React.SetStateAction<CoverLetterAdminDocument | null>>,
  setPersistedDocumentJson: React.Dispatch<React.SetStateAction<string>>
) {
  setAdminDocument(adminDocument);
  setPersistedDocumentJson(JSON.stringify(adminDocument));
}

function getDefaultBodyVersion(adminDocument: CoverLetterAdminDocument) {
  return getBodyVersionById(adminDocument, adminDocument.defaults.defaultBodyVersionId) || adminDocument.bodyVersions[0];
}

function getBodyVersionById(adminDocument: CoverLetterAdminDocument, bodyVersionId: string) {
  return adminDocument.bodyVersions.find(function findBodyVersion(bodyVersion) {
    return bodyVersion.id === bodyVersionId;
  }) || null;
}

function createDraftFromBodyVersion(bodyVersion: CoverLetterBodyVersion): BodyVersionDraft {
  return {
    body: bodyVersion.body,
    greeting: bodyVersion.greeting,
    id: bodyVersion.id,
    name: bodyVersion.name,
    signOff: bodyVersion.signOff,
    slug: bodyVersion.slug
  };
}

function createNewBodyVersionDraft(adminDocument: CoverLetterAdminDocument): BodyVersionDraft {
  const nextIndex = adminDocument.bodyVersions.length + 1;
  const baseName = `Version ${nextIndex}`;

  return {
    body: '',
    greeting: 'Dear {{hiringManager}},',
    name: baseName,
    signOff: 'Warm regards,',
    slug: buildUniqueSlug(adminDocument.bodyVersions, slugify(baseName))
  };
}

function sanitizeBodyVersionDraft(bodyVersionDraft: BodyVersionDraft): AdminBodyVersionInput {
  return {
    body: bodyVersionDraft.body.trim(),
    greeting: bodyVersionDraft.greeting.trim(),
    name: bodyVersionDraft.name.trim(),
    signOff: bodyVersionDraft.signOff.trim(),
    slug: slugify(bodyVersionDraft.slug)
  };
}

function upsertBodyVersion(adminDocument: CoverLetterAdminDocument, bodyVersion: CoverLetterBodyVersion): CoverLetterAdminDocument {
  const hasExistingBodyVersion = adminDocument.bodyVersions.some(function someBodyVersion(candidateBodyVersion) {
    return candidateBodyVersion.id === bodyVersion.id;
  });
  const nextBodyVersions = hasExistingBodyVersion
    ? adminDocument.bodyVersions.map(function mapBodyVersion(candidateBodyVersion) {
        return candidateBodyVersion.id === bodyVersion.id ? bodyVersion : candidateBodyVersion;
      })
    : [
        ...adminDocument.bodyVersions,
        bodyVersion
      ];

  return {
    ...adminDocument,
    bodyVersions: nextBodyVersions
  };
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map(function mapLine(line) {
      return line.trim();
    })
    .filter(Boolean);
}

function normalizeOptionalString(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue || undefined;
}

function normalizeFooterIcon(value: string) {
  if (value === 'email' || value === 'link' || value === 'linkedin' || value === 'github') {
    return value;
  }

  return undefined;
}

function buildUniqueSlug(bodyVersions: CoverLetterBodyVersion[], baseSlug: string) {
  const normalizedBaseSlug = slugify(baseSlug) || 'version';
  const slugs = new Set(bodyVersions.map(function mapBodyVersion(bodyVersion) {
    return bodyVersion.slug;
  }));

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
  const storedApiKey = typeof window === 'undefined'
    ? ''
    : window.localStorage.getItem('coverfire.admin.pdfApiKey') || '';

  return {
    apiKey: storedApiKey,
    company: '',
    hiringManager: '',
    role: '',
    title: ''
  };
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
