import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

/** Remove later: set KEEP_ALIVE=true on Railway test only. */
@Injectable()
export class KeepAliveService {
  private readonly log = new Logger(KeepAliveService.name);

  @Cron('*/10 * * * *')
  async ping() {
    if (process.env.KEEP_ALIVE !== 'true') return;
    const base = process.env.PUBLIC_API_URL?.replace(/\/$/, '');
    if (!base) {
      this.log.warn('KEEP_ALIVE=true but PUBLIC_API_URL missing');
      return;
    }
    try {
      const res = await fetch(`${base}/health`);
      this.log.log(`keep-alive ${res.status}`);
    } catch (e) {
      this.log.warn(`keep-alive failed: ${e instanceof Error ? e.message : 'error'}`);
    }
  }
}
