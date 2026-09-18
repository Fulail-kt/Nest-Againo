import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

type SmtpBox = { host: string; user: string; pass: string; port: number; from: string };

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private primary: Transporter | null | undefined;
  private fallback: Transporter | null | undefined;

  async sendVerifyCode(to: string, code: string) {
    const html = `<p>Your Againo verification code is <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`;
    const text = `Your Againo verification code is ${code}. It expires in 15 minutes.`;
    const subject = `${code} is your Againo code`;
    const boxes = this.boxes();

    if (!boxes.length) {
      this.log.warn(`SMTP not set — verify code for ${to}: ${code}`);
      return;
    }

    let last: unknown;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const transport = i === 0 ? this.getPrimary(box) : this.getFallback(box);
      if (!transport) continue;
      try {
        await transport.sendMail({ from: box.from, to, subject, html, text });
        return;
      } catch (e) {
        last = e;
        this.log.warn(
          `SMTP ${box.host} failed: ${e instanceof Error ? e.message : e}${i + 1 < boxes.length ? ' — try fallback' : ''}`,
        );
      }
    }
    this.log.error(`All SMTP failed: ${last instanceof Error ? last.message : last}`);
    throw new Error('Could not send verification email');
  }

  private boxes(): SmtpBox[] {
    const out: SmtpBox[] = [];
    const main = this.readBox('', 'smtp-relay.brevo.com');
    const alt = this.readBox('SMTP_FALLBACK_');
    if (main) out.push(main);
    if (alt && (!main || alt.host !== main.host || alt.user !== main.user)) out.push(alt);
    return out;
  }

  private readBox(prefix: string, defaultHost = ''): SmtpBox | null {
    const host = (process.env[`${prefix}SMTP_HOST`] || defaultHost).trim();
    const user = process.env[`${prefix}SMTP_USER`]?.trim();
    const pass = process.env[`${prefix}SMTP_PASS`]?.trim();
    const from =
      process.env[prefix ? `${prefix}MAIL_FROM` : 'MAIL_FROM']?.trim() || user;
    if (!host || !user || !pass || !from) return null;
    const port = Number(process.env[`${prefix}SMTP_PORT`] || 587);
    return { host, user, pass, port, from };
  }

  private getPrimary(box: SmtpBox) {
    if (this.primary !== undefined) return this.primary;
    this.primary = this.make(box);
    return this.primary;
  }

  private getFallback(box: SmtpBox) {
    if (this.fallback !== undefined) return this.fallback;
    this.fallback = this.make(box);
    return this.fallback;
  }

  private make(box: SmtpBox): Transporter {
    const gmail = /gmail\.com$/i.test(box.host);
    return nodemailer.createTransport(
      gmail
        ? { service: 'gmail', auth: { user: box.user, pass: box.pass } }
        : {
            host: box.host,
            port: box.port,
            secure: box.port === 465,
            auth: { user: box.user, pass: box.pass },
          },
    );
  }
}
