import { Fragment } from 'react';

import logo from '@/assets/logo.svg';
import { Email, GitHub, Link, LinkedIn } from '@/components/icons';
import {
  buildCoverLetter,
  createDefaultCoverLetterAdminDocument,
  getCoverLetterAdminDocumentOverride,
  getCoverLetterPreviewRequest,
  getCoverLetterRequestOverrides
} from '@/cover-letter';

const footerIconByKey = {
  email: Email,
  link: Link,
  linkedin: LinkedIn,
  github: GitHub
} as const;

function getPreviewCoverLetter() {
  const searchParams = new URLSearchParams(window.location.search);
  const request = getCoverLetterPreviewRequest(getCoverLetterRequestOverrides(searchParams));
  const adminDocument = getCoverLetterAdminDocumentOverride(searchParams) || createDefaultCoverLetterAdminDocument();

  return buildCoverLetter(request, adminDocument);
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
            {index > 0 && <br />}
            {roleLine}
          </Fragment>
        );
      })}
    </>
  );
}

export default function CoverLetterPage() {
  const previewCoverLetter = getPreviewCoverLetter();

  return (
    <div id="page" className="cover-letter-root page gap-[0.25in]">
      <main className="flex grow flex-col">
        <section id="date">
          <span><strong>{previewCoverLetter.date}</strong></span>
        </section>
        <section id="address" className="flex grow flex-col justify-center max-h-[var(--recipient-block-max-height)]">
          <p><strong>{previewCoverLetter.recipient.hiringManager}</strong></p>
          <p>Re: {previewCoverLetter.recipient.role}</p>
          <p>{previewCoverLetter.recipient.company}</p>
        </section>
        <section id="body" className="flex flex-col gap-[10pt]">
          <p>{previewCoverLetter.body.greeting}</p>
          {previewCoverLetter.body.paragraphs.map(function renderParagraph(paragraph) {
            return <p key={paragraph}>{paragraph}</p>;
          })}
        </section>
        <section id="closing" className="mt-[15pt]">
          <p>{previewCoverLetter.body.signOff}</p>
        </section>
        <section id="signature" className="mt-[15pt]">
          <p><strong>{previewCoverLetter.signature.name}</strong></p>
          <p>{previewCoverLetter.signature.title}</p>
          {previewCoverLetter.signature.contacts.map(function renderSignatureContact(contact) {
            return <p key={contact.id}>{contact.value}</p>;
          })}
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
            <p><strong>{previewCoverLetter.footer.name}</strong></p>
            <p>{renderRoleWithAmpersandBreak(previewCoverLetter.footer.title)}</p>
          </div>
          <div className="footer-divider" aria-hidden="true" />
          <div className="footer-column">
            {previewCoverLetter.footer.addressLines.map(function renderAddressLine(addressLine) {
              return <p key={addressLine}>{addressLine}</p>;
            })}
          </div>
          <div className="footer-divider" aria-hidden="true" />
          <div className="footer-column flex flex-col">
            {previewCoverLetter.footer.contacts.map(function renderFooterContact(contact) {
              const Icon = contact.footerIcon ? footerIconByKey[contact.footerIcon] : null;

              return (
                <a key={contact.id} className="inline-flex items-center gap-[0.054in]" href={contact.href}>
                  {Icon ? <span className="inline-block text-icon"><Icon size={12} /></span> : null}
                  {contact.value}
                </a>
              );
            })}
          </div>
        </section>
      </footer>
    </div>
  );
}
